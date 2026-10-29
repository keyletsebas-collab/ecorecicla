/* =============================================
   DGII-API.JS – Conexión con las APIs de la DGII
   Soporte Multi-Proveedor (Megaplus + DominicanTech)
   Permite consultar RNC, Cédula o Razón Social.
   ============================================= */

// Proveedor 1: Megaplus API (Pública / Sin token obligatorio)
const MEGAPLUS_API_BASE_URL = 'https://rnc.megaplus.com.do/api';

// Proveedor 2: Dominican Technology API (Respaldo con token)
const DGII_API_TOKEN = 'dgii_41346f9633e04c1287001ec8aa0fde4b';
const DGII_API_BASE_URL = 'https://api-dgii.dominicantechnology.com/api/v1';

/**
 * Obtiene la URL para consultar Megaplus. Si se ejecuta en localhost,
 * usa el proxy local del dev-server para evitar bloqueos de CORS en el navegador.
 */
function getMegaplusQueryUrl(endpoint, params) {
    const isLocalhost = typeof window !== 'undefined' && window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const qs = new URLSearchParams(params).toString();
    if (isLocalhost) {
        const origin = window.location.origin || `http://${window.location.hostname}:${window.location.port || 3000}`;
        return `${origin}/api/dgii-megaplus?${qs}`;
    }
    return `${MEGAPLUS_API_BASE_URL}/${endpoint}?${qs}`;
}

/**
 * Consulta directa por RNC/Cédula en Megaplus API.
 */
async function queryMegaplusByRNC(cleanId) {
    try {
        const url = getMegaplusQueryUrl('consulta', { rnc: cleanId });
        const res = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!res.ok) return null;
        const json = await res.json();
        if (json.error || !json.nombre_razon_social) return null;

        return {
            rnc: json.cedula_rnc ? json.cedula_rnc.replace(/\D/g, '') : cleanId,
            formattedRnc: json.cedula_rnc || cleanId,
            name: json.nombre_razon_social || json.nombre_comercial || '',
            tradeName: json.nombre_comercial || '',
            address: '',
            activity: json.actividad_economica || '',
            isRST: (json.regimen_de_pagos || '').toUpperCase().includes('RST'),
            status: json.estado || 'ACTIVO',
            isElectronic: json.facturador_electronico === 'SI',
            source: 'Megaplus'
        };
    } catch (e) {
        console.warn('Fallo consulta Megaplus RNC:', e);
        return null;
    }
}

/**
 * Búsqueda por nombre en Megaplus API.
 */
async function queryMegaplusByName(term) {
    try {
        const url = getMegaplusQueryUrl('consulta/nombres', { buscar: term, mode: 'nombres' });
        const res = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!res.ok) return [];
        const json = await res.json();
        if (json.error || !Array.isArray(json.resultados)) return [];

        return json.resultados.map(item => ({
            rnc: item.cedula_rnc ? item.cedula_rnc.replace(/\D/g, '') : '',
            formattedRnc: item.cedula_rnc || '',
            name: item.nombre_razon_social || item.nombre_comercial || '',
            tradeName: item.nombre_comercial || '',
            address: '',
            activity: item.actividad_economica || '',
            isRST: (item.regimen_de_pagos || '').toUpperCase().includes('RST'),
            status: item.estado || 'ACTIVO',
            isElectronic: item.facturador_electronico === 'SI',
            source: 'Megaplus'
        }));
    } catch (e) {
        console.warn('Fallo consulta Megaplus por nombre:', e);
        return [];
    }
}

/**
 * Consulta de respaldo en Dominican Technology API por RNC o Cédula.
 */
async function queryDominicanTechByRNC(cleanId) {
    try {
        const url = `${DGII_API_BASE_URL}/rnc/${cleanId}`;
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${DGII_API_TOKEN}`,
                'Accept': 'application/json'
            }
        });

        if (!res.ok) return null;
        const json = await res.json();
        if (!json.exito || !json.data) return null;

        const data = Array.isArray(json.data) ? json.data[0] : json.data;
        if (!data) return null;

        return {
            rnc: data.rnc || cleanId,
            formattedRnc: data.rnc || cleanId,
            name: data.razon_social || data.nombre || '',
            tradeName: data.nombre_comercial || '',
            address: '',
            activity: data.actividad_economica || '',
            isRST: data.regimen_pago === 'RST' || data.regimen_pago === 'RST (Regimen Simplificado de Tributacion)' || false,
            status: data.estado || 'ACTIVO',
            source: 'DominicanTech'
        };
    } catch (e) {
        console.warn('Fallo consulta DominicanTech RNC:', e);
        return null;
    }
}

/**
 * Consulta de respaldo en Dominican Technology API por nombre.
 */
async function queryDominicanTechByName(term) {
    try {
        const url = term.length >= 4 
            ? `${DGII_API_BASE_URL}/buscardgi?q=${encodeURIComponent(term)}`
            : `${DGII_API_BASE_URL}/buscar?q=${encodeURIComponent(term)}`;

        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${DGII_API_TOKEN}`,
                'Accept': 'application/json'
            }
        });

        if (!res.ok) return [];
        const json = await res.json();
        if (!json.exito || !json.data) return [];

        const list = Array.isArray(json.data) ? json.data : [json.data];
        return list.map(item => ({
            rnc: item.rnc || '',
            formattedRnc: item.rnc || '',
            name: item.razon_social || item.nombre || item.nombre_comercial || '',
            tradeName: item.nombre_comercial || '',
            address: '',
            activity: item.actividad_economica || '',
            isRST: item.regimen_pago === 'RST',
            status: item.estado || 'ACTIVO',
            source: 'DominicanTech'
        }));
    } catch (e) {
        console.warn('Fallo consulta DominicanTech por nombre:', e);
        return [];
    }
}

/**
 * Consulta un RNC, Cédula o busca por Razón Social en la DGII con failover automático.
 * Flujo:
 * 1. Clientes locales guardados en recim_clients.
 * 2. API Megaplus (Sin límites estrictos diarios).
 * 3. API Dominican Technology (Respaldo oficial con token).
 * @param {string} query - RNC (9), Cédula (11) o Razón Social (texto)
 * @returns {Promise<Object|null>} - Retorna los datos o null si falla.
 */
async function fetchDGIIData(query) {
    const trimmed = (query || '').trim();
    if (!trimmed) {
        showToast('⚠️ Ingresa un término de búsqueda', 'warning');
        return null;
    }

    const cleanId = trimmed.replace(/\D/g, ''); // Solo números

    // 1. Revisar si ya está guardado en el directorio local de clientes
    const localClients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
    const localMatch = localClients.find(c => {
        if (cleanId && c.nit) {
            return c.nit.replace(/\D/g, '') === cleanId;
        }
        if (trimmed && c.name) {
            return c.name.toLowerCase().includes(trimmed.toLowerCase());
        }
        return false;
    });

    if (localMatch) {
        showToast('✅ Datos cargados desde clientes registrados', 'success');
        return {
            rnc: localMatch.nit || '',
            formattedRnc: localMatch.nit || '',
            name: localMatch.name || '',
            tradeName: localMatch.name || '',
            address: localMatch.address || '',
            activity: '',
            isRST: localMatch.isRst || false,
            status: 'ACTIVO',
            source: 'Local'
        };
    }

    const isDirect = cleanId.length === 9 || cleanId.length === 11;
    showToast('🔍 Consultando DGII...', 'info');

    // 2. Intentar con Proveedor 1: Megaplus
    try {
        let megaData = null;
        if (isDirect) {
            megaData = await queryMegaplusByRNC(cleanId);
        } else {
            const list = await queryMegaplusByName(trimmed);
            if (list && list.length > 0) megaData = list[0];
        }

        if (megaData && megaData.name) {
            if (megaData.status.toUpperCase() !== 'ACTIVO' && megaData.status.toUpperCase() !== 'NORMAL') {
                showToast(`⚠️ El contribuyente está: ${megaData.status}`, 'warning');
            } else {
                showToast('✅ Datos recuperados de DGII (Megaplus)', 'success');
            }
            return megaData;
        }
    } catch (err) {
        console.warn('API Megaplus no respondió, intentando proveedor de respaldo...', err);
    }

    // 3. Fallback a Proveedor 2: Dominican Technology
    try {
        let fallbackData = null;
        if (isDirect) {
            fallbackData = await queryDominicanTechByRNC(cleanId);
        } else {
            const list = await queryDominicanTechByName(trimmed);
            if (list && list.length > 0) fallbackData = list[0];
        }

        if (fallbackData && fallbackData.name) {
            if (fallbackData.status.toUpperCase() !== 'ACTIVO' && fallbackData.status.toUpperCase() !== 'NORMAL') {
                showToast(`⚠️ El contribuyente está: ${fallbackData.status}`, 'warning');
            } else {
                showToast('✅ Datos recuperados de DGII (Respaldo)', 'success');
            }
            return fallbackData;
        }
    } catch (err) {
        console.warn('Proveedor de respaldo falló:', err);
    }

    showToast('⚠️ No se encontraron datos para este RNC/Cédula en las fuentes DGII. Ingresa los datos manualmente.', 'warning');
    return null;
}

/**
 * Busca empresas en la DGII por nombre o razón social combinando resultados locales y remotos.
 * @param {string} query 
 * @returns {Promise<Array>}
 */
async function searchDGIICompanies(query) {
    const trimmed = (query || '').trim();
    if (!trimmed) {
        showToast('⚠️ Ingresa el nombre de la empresa para buscar su RNC', 'warning');
        return [];
    }

    if (trimmed.length < 3) {
        showToast('⚠️ La búsqueda por nombre requiere al menos 3 caracteres', 'warning');
        return [];
    }

    // 1. Revisar primero en la base local de clientes
    const localClients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
    const localMatches = localClients.filter(c => c.name && c.name.toLowerCase().includes(trimmed.toLowerCase())).map(c => ({
        rnc: c.nit || '',
        formattedRnc: c.nit || '',
        name: c.name,
        tradeName: c.name,
        isRST: c.isRst || false,
        status: 'ACTIVO',
        activity: 'Cliente Registrado',
        source: 'Local'
    }));

    showToast('🔍 Buscando empresa en la DGII...', 'info');

    // 2. Consultar Proveedor 1: Megaplus
    let apiResults = [];
    try {
        apiResults = await queryMegaplusByName(trimmed);
    } catch (err) {
        console.warn('Error buscando en Megaplus:', err);
    }

    // 3. Si Proveedor 1 falló o no dio resultados, consultar Proveedor 2: Dominican Technology
    if (!apiResults || apiResults.length === 0) {
        try {
            apiResults = await queryDominicanTechByName(trimmed);
        } catch (err) {
            console.warn('Error buscando en DominicanTech:', err);
        }
    }

    // 4. Combinar resultados locales con los de las APIs evitando duplicados por RNC
    const combined = [...localMatches];
    (apiResults || []).forEach(ar => {
        const cleanArRnc = (ar.rnc || '').replace(/\D/g, '');
        if (!combined.some(c => (c.rnc || '').replace(/\D/g, '') === cleanArRnc)) {
            combined.push(ar);
        }
    });

    if (combined.length === 0) {
        showToast('⚠️ No se encontraron empresas registradas con ese nombre', 'warning');
    }

    return combined;
}

/**
 * Abre un modal con los resultados encontrados en la DGII para que el usuario elija la empresa.
 * @param {Array} companies 
 * @param {Function} onSelect 
 */
function openDGIICompanyPickerModal(companies, onSelect) {
    let modal = document.getElementById('dgii-company-picker-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'dgii-company-picker-modal';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal" style="max-width: 650px; width: 95%; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden;">
            <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--clr-border);">
                <div>
                    <h3 class="modal-title" style="margin: 0; font-size: 1.1rem; color: var(--clr-text);">🏢 Empresas encontradas en DGII</h3>
                    <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: var(--clr-text-muted);">Selecciona la empresa para vincular su RNC y razón social:</p>
                </div>
                <button class="modal-close" onclick="closeDGIICompanyPickerModal()" type="button">✕</button>
            </div>

            <div class="modal-body" style="padding: 16px 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 10px;">
                ${companies.map((c, idx) => `
                    <div class="card" style="padding: 12px 14px; margin: 0; cursor: pointer; transition: transform 0.15s, border-color 0.15s; border: 1px solid var(--clr-border); background: var(--clr-surface-2); display: flex; justify-content: space-between; align-items: center; gap: 12px;"
                         onclick="selectDGIICompanyItem(${idx})">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <span style="font-weight: 700; font-size: 0.95rem; color: var(--clr-text);">${c.name}</span>
                                <span class="badge" style="background: ${c.status === 'ACTIVO' ? '#10b981' : '#f59e0b'}; color: white; font-size: 0.7rem; padding: 2px 7px; border-radius: 10px;">
                                    ${c.status}
                                </span>
                                ${c.isRST ? '<span class="badge" style="background: #3b82f6; color: white; font-size: 0.7rem; padding: 2px 7px; border-radius: 10px;">RST</span>' : ''}
                            </div>
                            <div style="font-size: 0.82rem; color: var(--clr-text-muted); margin-top: 4px;">
                                <span style="color: var(--clr-primary); font-weight: 600;">RNC: ${c.rnc}</span>
                                ${c.tradeName && c.tradeName !== c.name ? ` • <i>${c.tradeName}</i>` : ''}
                            </div>
                        </div>
                        <button class="btn-primary" style="margin: 0; padding: 6px 12px; font-size: 0.8rem; white-space: nowrap;" type="button">
                            Seleccionar
                        </button>
                    </div>
                `).join('')}
            </div>

            <div class="modal-footer" style="padding: 12px 20px; border-top: 1px solid var(--clr-border); display: flex; justify-content: flex-end;">
                <button class="btn-secondary" onclick="closeDGIICompanyPickerModal()" type="button">Cancelar</button>
            </div>
        </div>
    `;

    window._dgiiPickerCompanies = companies;
    window._dgiiPickerCallback = onSelect;
    modal.style.display = 'flex';
}

function selectDGIICompanyItem(index) {
    const list = window._dgiiPickerCompanies || [];
    const cb = window._dgiiPickerCallback;
    const item = list[index];
    closeDGIICompanyPickerModal();
    if (item && typeof cb === 'function') {
        cb(item);
    }
}

function closeDGIICompanyPickerModal() {
    const modal = document.getElementById('dgii-company-picker-modal');
    if (modal) modal.style.display = 'none';
}

window.fetchDGIIData = fetchDGIIData;
window.searchDGIICompanies = searchDGIICompanies;
window.openDGIICompanyPickerModal = openDGIICompanyPickerModal;
window.selectDGIICompanyItem = selectDGIICompanyItem;
window.closeDGIICompanyPickerModal = closeDGIICompanyPickerModal;

