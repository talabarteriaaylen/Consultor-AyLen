// --- CONFIGURACIÓN ---
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRQQ0Yin3EQ_EJKCaorI85djD7mLuOww815QF_gXyXMBYqIhWRLPzSMVoJcwR7xRA/pub?output=csv'; // URL pública del CSV de Google Sheets
const STORAGE_KEY_DATA = 'nya_inventory_data'; // Clave para guardar productos
const STORAGE_KEY_DATE = 'nya_inventory_date'; // Clave para guardar fecha de actualización
const STORAGE_KEY_HISTORY = 'nya_search_history'; // Clave para el historial

// Variables globales
let inventory = [];
let searchHistory = []; 

// Elementos del DOM
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultContainer = document.getElementById('resultContainer');
const historyListDiv = document.getElementById('historyList');
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const statusIndicator = document.getElementById('statusIndicator');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// 1. INICIALIZACIÓN
window.addEventListener('DOMContentLoaded', () => {
    loadHistoryFromStorage(); // Cargar historial guardado inmediatamente
    fetchData(); // Intentar cargar productos
    searchInput.focus();
});

// 2. LÓGICA DE DATOS (ONLINE / OFFLINE)
function fetchData() {
    loadingDiv.classList.remove('hidden');
    updateStatus('Cargando...', 'neutral');

    Papa.parse(SHEET_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            // ÉXITO ONLINE
            console.log("Conexión exitosa. Actualizando datos locales.");
            inventory = results.data;
            
            // Guardar en LocalStorage para uso futuro
            saveToLocalStorage(inventory);
            
            loadingDiv.classList.add('hidden');
            updateStatus('🟢 Sistema Actualizado', 'online');
        },
        error: function(err) {
            // ERROR DE CONEXIÓN -> MODO OFFLINE
            console.warn("Fallo la descarga. Intentando modo offline.");
            loadFromLocalStorage();
        }
    });
}

function saveToLocalStorage(data) {
    try {
        const now = new Date().toLocaleString();
        localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(data));
        localStorage.setItem(STORAGE_KEY_DATE, now);
    } catch (e) {
        console.error("Error al guardar en LocalStorage (posiblemente espacio lleno):", e);
        errorDiv.textContent = "⚠️ Memoria llena. No se pudo guardar copia offline.";
        errorDiv.classList.remove('hidden');
    }
}

function loadFromLocalStorage() {
    const localData = localStorage.getItem(STORAGE_KEY_DATA);
    const localDate = localStorage.getItem(STORAGE_KEY_DATE);

    if (localData) {
        inventory = JSON.parse(localData);
        loadingDiv.classList.add('hidden');
        // Mostrar aviso de que estamos usando datos viejos
        updateStatus(`🟠 Modo Offline (Datos del: ${localDate})`, 'offline');
    } else {
        // FATAL: No hay internet y no hay datos guardados
        loadingDiv.classList.add('hidden');
        errorDiv.textContent = "❌ Sin conexión y sin datos guardados. Conéctate a internet para la primera carga.";
        errorDiv.classList.remove('hidden');
    }
}

function updateStatus(msg, type) {
    statusIndicator.textContent = msg;
    statusIndicator.className = 'status-badge'; // Reset classes
    statusIndicator.classList.remove('hidden');
    
    if (type === 'online') statusIndicator.classList.add('status-online');
    if (type === 'offline') statusIndicator.classList.add('status-offline');
}

// 3. LÓGICA DE BÚSQUEDA
function performSearch() {
    const query = searchInput.value.toLowerCase().trim();
    searchInput.value = '';
    searchInput.focus();

    if (query === '') return;

    // Filtrar
    const results = inventory.filter(item => {
        const code = item.Codigo ? item.Codigo.toLowerCase() : '';
        const desc = item.Descripcion ? item.Descripcion.toLowerCase() : '';
        return code === query || (query.length > 3 && desc.includes(query));
    });

    displayResults(results);

    // Si es resultado único, agregar al historial
    if (results.length === 1) {
        addToHistory(results[0]);
    }
}

function displayResults(products) {
    resultContainer.innerHTML = ''; 

    if (products.length === 0) {
        resultContainer.innerHTML = '<div class="placeholder-text">Producto no encontrado ❌</div>';
        return;
    }

    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';

        // Función segura para formatear moneda
        const formatMoney = (val) => {
            if (!val) return '$0';
            // Remover signos $ anteriores si existen en el excel para no duplicar
            const cleanVal = val.toString().replace('$', '').trim();
            return '$' + cleanVal;
        };

        card.innerHTML = `
            <div class="product-title">${product.Descripcion || 'Art. Sin Nombre'}</div>
            
            <div class="price-box credit">
                <span class="price-label">Precio Lista / Tarjeta</span>
                <span class="price-value">${formatMoney(product.Credito)}</span>
            </div>

            <div class="price-box cash">
                <span class="price-label">Precio Efectivo</span>
                <span class="price-value">${formatMoney(product.Efectivo)}</span>
            </div>

            <div class="code-ref">${product.Codigo}</div>
        `;
        resultContainer.appendChild(card);
    });
}

// 4. LÓGICA DE HISTORIAL PERSISTENTE
function loadHistoryFromStorage() {
    const storedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (storedHistory) {
        searchHistory = JSON.parse(storedHistory);
        renderHistory();
    }
}

function saveHistoryToStorage() {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(searchHistory));
}

function addToHistory(product) {
    // Evitar duplicados consecutivos
    if (searchHistory.length > 0 && searchHistory[0].Codigo === product.Codigo) {
        return;
    }

    searchHistory.unshift(product);

    if (searchHistory.length > 20) { // Guardamos hasta 20 en memoria
        searchHistory.pop();
    }

    saveHistoryToStorage(); // <--- GUARDAR EN LOCALSTORAGE
    renderHistory();
}

function renderHistory() {
    historyListDiv.innerHTML = '';
    
    searchHistory.forEach(item => {
        const row = document.createElement('div');
        row.className = 'history-item';
        // Al hacer click en el historial, vuelve a mostrar el producto grande
        row.onclick = () => displayResults([item]); 
        row.style.cursor = 'pointer';

        row.innerHTML = `
            <div class="h-desc">${item.Descripcion}</div>
            <div class="h-prices">
                <div class="h-list">L: $${item.Credito}</div>
                <div class="h-cash">E: $${item.Efectivo}</div>
            </div>
        `;
        historyListDiv.appendChild(row);
    });
}

// Borrar historial manual
clearHistoryBtn.addEventListener('click', () => {
    if(confirm('¿Borrar historial?')) {
        searchHistory = [];
        saveHistoryToStorage();
        renderHistory();
    }
});

// Event Listeners Inputs
searchBtn.addEventListener('click', () => {
    performSearch();
    searchInput.focus();
});

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        performSearch();
    }
});
