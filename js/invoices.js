/* =============================================
   INVOICES.JS – Módulo Integral de Facturación (v1.18.0)
   Incluye: Cotizaciones, Facturas Unificadas, Despachos,
            Devoluciones, Notas de Crédito, Notas de Débito
            y Control de Secuencias NCF según normativa DGII.
   ============================================= */

// =============================================
// 1. CONFIGURACIÓN Y PARAMETRIZACIONES DGII (NCF)
// =============================================

// =============================================
// 1. CONFIGURACIÓN Y CONTROL DE SECUENCIAS DGII (NCF)
// =============================================

const NCF_TYPES_BY_SERIE = {
  B: [
    { code: 'B01', name: '01 - Factura de Crédito Fiscal (B01)' },
    { code: 'B02', name: '02 - Factura de Consumo (B02)' },
    { code: 'B03', name: '03 - Nota de Débito (B03)' },
    { code: 'B04', name: '04 - Nota de Crédito (B04)' },
    { code: 'B11', name: '11 - Registro de Proveedores Informales (B11)' },
    { code: 'B12', name: '12 - Registro Único de Ingresos (B12)' },
    { code: 'B13', name: '13 - Gastos Menores (B13)' },
    { code: 'B14', name: '14 - Regímenes Especiales de Tributación (B14)' },
    { code: 'B15', name: '15 - Comprobante Gubernamental (B15)' },
    { code: 'B16', name: '16 - Comprobante para Exportaciones (B16)' },
    { code: 'B17', name: '17 - Comprobante para Pagos al Exterior (B17)' }
  ],
  E: [
    { code: 'E31', name: '31 - Factura de Crédito Fiscal Electrónica (E31)' },
    { code: 'E32', name: '32 - Factura de Consumo Electrónica (E32)' },
    { code: 'E33', name: '33 - Nota de Débito Electrónica (E33)' },
    { code: 'E34', name: '34 - Nota de Crédito Electrónica (E34)' },
    { code: 'E41', name: '41 - Compras Electrónico (E41)' },
    { code: 'E43', name: '43 - Gastos Menores Electrónico (E43)' },
    { code: 'E44', name: '44 - Regímenes Especiales Electrónico (E44)' },
    { code: 'E45', name: '45 - Gubernamental Electrónico (E45)' },
    { code: 'E46', name: '46 - Exportaciones Electrónico (E46)' },
    { code: 'E47', name: '47 - Pagos al Exterior Electrónico (E47)' }
  ]
};

function getNcfTypeName(code) {
  for (const s of ['B', 'E']) {
    const found = NCF_TYPES_BY_SERIE[s].find(t => t.code === code);
    if (found) return found.name;
  }
  return code;
}

// Purga automática inmediata de secuencias ficticias/demostración
(function purgeDummyNcfSequences() {
  try {
    const keysToCheck = ['recim_ncf_sequences'];
    if (typeof userKey === 'function') {
      try { keysToCheck.push(userKey('recim_ncf_sequences')); } catch (_) {}
    }
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.includes('recim_ncf_sequences')) {
        keysToCheck.push(k);
      }
    }

    [...new Set(keysToCheck)].forEach(storageKey => {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return;

        let hasDummy = false;
        const cleaned = {};
        for (const [code, item] of Object.entries(parsed)) {
          // Detectar secuencias ficticias del modelo de demostración previo (rango 1 a 100 sin fecha de vencimiento)
          if (item && item.from === 1 && item.to === 100 && !item.dueDate &&
              (item.current === 1 || item.current === 25 || item.current === 4)) {
            hasDummy = true;
            continue;
          }
          cleaned[code] = item;
        }

        if (hasDummy) {
          localStorage.setItem(storageKey, JSON.stringify(cleaned));
        }
      } catch (_) {}
    });
  } catch (_) {}
})();

// Quitar NCF de todas las facturas existentes (limpieza de NCF en facturas para dejarlas estándar internas)
function stripNcfFromAllInvoices() {
  try {
    const keysToCheck = ['recim_invoices'];
    if (typeof userKey === 'function') {
      try { keysToCheck.push(userKey('recim_invoices')); } catch (_) {}
    }
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.includes('recim_invoices')) {
        keysToCheck.push(k);
      }
    }

    [...new Set(keysToCheck)].forEach(storageKey => {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      try {
        const list = JSON.parse(raw);
        if (!Array.isArray(list) || list.length === 0) return;

        let hasModified = false;
        list.forEach(inv => {
          if (inv.ncf || inv.ncfType || (inv.typeName && inv.typeName.toLowerCase() !== 'factura estándar')) {
            inv.ncf = '';
            inv.ncfType = '';
            inv.typeName = 'Factura Estándar';
            hasModified = true;
          }
        });

        if (hasModified) {
          localStorage.setItem(storageKey, JSON.stringify(list));
        }
      } catch (_) {}
    });
  } catch (_) {}
}
stripNcfFromAllInvoices();
window.stripNcfFromAllInvoices = stripNcfFromAllInvoices;

function getNcfSequences() {
  try {
    const raw = localStorage.getItem(typeof userKey === 'function' ? userKey('recim_ncf_sequences') : 'recim_ncf_sequences') || localStorage.getItem('recim_ncf_sequences');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};

    // Filtrar cualquier secuencia de prueba ficticia si quedase en almacenamiento
    let hasDummy = false;
    const clean = {};
    for (const [code, item] of Object.entries(parsed)) {
      if (item && item.from === 1 && item.to === 100 && !item.dueDate &&
          (item.current === 1 || item.current === 25 || item.current === 4)) {
        hasDummy = true;
        continue;
      }
      clean[code] = item;
    }
    if (hasDummy) {
      saveNcfSequences(clean);
    }
    return clean;
  } catch (_) {
    return {};
  }
}

function saveNcfSequences(seqs) {
  const key = typeof userKey === 'function' ? userKey('recim_ncf_sequences') : 'recim_ncf_sequences';
  localStorage.setItem(key, JSON.stringify(seqs));
  localStorage.setItem('recim_ncf_sequences', JSON.stringify(seqs));
  if (typeof window.forceSync === 'function') {
    try { window.forceSync(); } catch (_) {}
  }
}

/**
 * Genera el HTML de opciones del select de Comprobante según los NCF efectivamente creados por el usuario
 */
function getNcfTypeSelectOptionsHtml(selectedVal = '') {
  const seqs = getNcfSequences();
  const keys = Object.keys(seqs).filter(k => seqs[k] && seqs[k].active !== false);

  let html = `<option value="">${(typeof t === 'function') ? t('inv.no_voucher', 'Sin Comprobante') : 'Sin Comprobante'}</option>`;

  if (keys.length === 0) {
    html += `<option value="" disabled style="color: var(--clr-text-muted);">⚠️ Sin secuencias creadas (Configurar en ⚙️ Inventario NCF)</option>`;
  } else {
    keys.forEach(k => {
      const item = seqs[k];
      let desc = item.name || getNcfTypeName(k);
      desc = desc.replace(/^\d+\s*-\s*/, '').replace(/\s*\([BE]\d+\)$/, '').trim();
      const isSelected = selectedVal === k ? 'selected' : '';
      html += `<option value="${k}" ${isSelected}>${k} - ${desc}</option>`;
    });
  }

  // Si se pasó un valor seleccionado (ej: por prellenado o cliente) que no está en las llaves, agregarlo
  if (selectedVal && !keys.includes(selectedVal)) {
    const desc = getNcfTypeName(selectedVal);
    html += `<option value="${selectedVal}" selected>${selectedVal} - ${desc}</option>`;
  }

  return html;
}

function refreshAllNcfTypeSelects(selectVal = '') {
  const select = document.getElementById('fac-ncf-type-unified');
  if (select) {
    const curVal = selectVal || select.value;
    select.innerHTML = getNcfTypeSelectOptionsHtml(curVal);
    if (curVal) select.value = curVal;
  }
}
window.refreshAllNcfTypeSelects = refreshAllNcfTypeSelects;

function getModuleParams(moduleKey) {
  try {
    const raw = localStorage.getItem(userKey(`recim_params_${moduleKey}`));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (_) {}

  const defaults = {
    cotizaciones: { prefix: 'COT-', validityDays: 15 },
    despachos: { prefix: 'DESP-', defaultCarrier: '', defaultNotes: '' },
    devoluciones: { prefix: 'DEV-' },
    facturas: { prefix: 'FAC-' },
    nota_credito: { prefix: 'NC-' },
    nota_debito: { prefix: 'ND-' }
  };

  return defaults[moduleKey] || { prefix: 'DOC-' };
}

function saveModuleParams(moduleKey, params) {
  try {
    localStorage.setItem(userKey(`recim_params_${moduleKey}`), JSON.stringify(params));
    if (typeof window.forceSync === 'function') {
      try { window.forceSync(); } catch (_) {}
    }
  } catch (_) {}
}


/**
 * Calcula el siguiente NCF formateado para un tipo y evalúa límites autorizados por la DGII.
 */
function getNextNcfInfo(ncfType) {
  if (!ncfType) return { ncf: '', remaining: null, exhausted: false, isConfigured: false };
  
  const seqs = getNcfSequences();
  const seq = seqs[ncfType];
  
  if (!seq || !seq.active) {
    return { ncf: '', remaining: null, exhausted: false, isConfigured: false };
  }

  const currentNum = parseInt(seq.current, 10) || 1;
  const toNum = parseInt(seq.to, 10) || 1;
  const remaining = toNum - currentNum + 1;

  if (currentNum > toNum) {
    return { ncf: '', remaining: 0, exhausted: true, isConfigured: true, seq };
  }

  const isE = ncfType.startsWith('E') || seq.serie === 'E';
  const totalLength = isE ? 13 : 11;
  const seqLength = totalLength - ncfType.length;
  const padded = String(currentNum).padStart(seqLength, '0');
  const ncf = ncfType + padded;
  const alertThreshold = parseInt(seq.alertThreshold, 10) || 10;
  const isExpired = seq.dueDate ? (new Date().toISOString().split('T')[0] > seq.dueDate) : false;

  return { ncf, remaining, exhausted: false, isConfigured: true, seq, alertThreshold, isExpired };
}

/**
 * Consume e incrementa el contador de la secuencia autorizada tras guardar.
 */
function consumeNcfSequence(ncfType) {
  if (!ncfType) return;
  const seqs = getNcfSequences();
  if (seqs[ncfType] && seqs[ncfType].active) {
    seqs[ncfType].current = (parseInt(seqs[ncfType].current, 10) || 1) + 1;
    saveNcfSequences(seqs);
  }
}

// =============================================
// 2. MODAL DE PARAMETRIZACIONES (NCF)
// =============================================

function openParametrizacionesModal(activeTab = 'facturas') {
  let modal = document.getElementById('parametrizaciones-modal');
  if (modal) {
    modal.remove();
  }

  modal = document.createElement('div');
  modal.id = 'parametrizaciones-modal';
  modal.className = 'modal-overlay';
  document.body.appendChild(modal);

  modal.innerHTML = `
    <div class="modal" style="max-width: 1100px; width: 95%; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; background: linear-gradient(160deg, #101c13 0%, #0a110c 100%) !important; color: var(--clr-text, #f0fdf0) !important; border-radius: 16px !important; box-shadow: 0 25px 60px rgba(0,0,0,0.85), 0 0 35px rgba(34, 197, 94, 0.15) !important; border: 1px solid rgba(34, 197, 94, 0.25) !important; font-family: inherit;">
      <!-- Header Inventario de NCF -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; border-bottom: 1px solid rgba(34, 197, 94, 0.15); background: rgba(0, 0, 0, 0.25); backdrop-filter: blur(10px);">
        <h2 id="param-modal-main-title" style="margin: 0; font-size: 1.35rem; font-weight: 800; color: var(--clr-text, #f0fdf0); letter-spacing: -0.02em;">Inventario de NCF</h2>
        <div style="display: flex; align-items: center; gap: 10px;">
          <button id="btn-modal-action-header" class="btn-primary" onclick="showCrearSecuenciaView()" type="button" style="background: var(--clr-primary, #22c55e); color: #041207; border: none; border-radius: 8px; padding: 8px 18px; font-weight: 800; font-size: 0.9rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 0 15px rgba(34, 197, 94, 0.35); transition: all 0.2s;">
            + Nuevo
          </button>
          <button class="modal-close" onclick="closeParametrizacionesModal()" type="button" style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: var(--clr-text-secondary, #9ca3af); border-radius: 50%; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; font-size: 1.15rem; font-weight: bold; transition: all 0.2s; margin: 0;" title="Cerrar modal">
            ✕
          </button>
        </div>
      </div>

      <div class="modal-body" style="padding: 20px 24px; overflow-y: auto; flex: 1; background: transparent;">
        <!-- Vista 1: Ver Secuencia (Inventario Tabla) -->
        <div id="param-ver-secuencia-view">
          <div id="param-secuencias-container"></div>
        </div>

        <!-- Vista 2: Crear / Editar Secuencia -->
        <div id="param-crear-secuencia-view" style="display: none;">
          <form id="form-crear-secuencia" onsubmit="event.preventDefault(); saveNcfSequenceFromForm('${activeTab}');">
            <input type="hidden" id="ncf-form-editing-id" value="" />

            <!-- Sección: Información del Comprobante -->
            <div style="margin-bottom: 22px; background: var(--clr-surface-2, #172017); border: 1px solid var(--clr-border, rgba(34, 197, 94, 0.15)); border-radius: 12px; padding: 18px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px; color: var(--clr-primary, #22c55e);">
                <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid var(--clr-primary, #22c55e); font-size: 0.8rem; font-weight: bold;">i</span>
                <h4 id="ncf-form-title" style="margin: 0; font-size: 0.98rem; font-weight: 700; color: var(--clr-text, #f0fdf0);">Información del Comprobante (Serie B)</h4>
              </div>

              <div class="form-row" style="grid-template-columns: 1fr 2fr; gap: 14px; margin-bottom: 0;">
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-weight: 600; font-size: 0.85rem; color: var(--clr-text, #f0fdf0);">Serie <span style="color: var(--clr-text-muted);">#</span></label>
                  <select id="ncf-form-serie" class="form-select" onchange="onNcfFormSerieChange(this.value)" style="background: var(--clr-surface-3, #1e2e1e); color: var(--clr-text, #f0fdf0); border: 1px solid var(--clr-border, rgba(34, 197, 94, 0.2)); border-radius: 8px; padding: 8px 12px;">
                    <option value="B" selected>B - Físico (Serie B)</option>
                    <option value="E" disabled>E - Electrónico (Próximamente)</option>
                  </select>
                  <span style="display: block; margin-top: 4px; font-size: 0.75rem; color: var(--clr-text-muted, #6b7280);">
                    E – Electrónico (Próximamente), B – Físico tradicional
                  </span>
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-weight: 600; font-size: 0.85rem; color: var(--clr-text, #f0fdf0);">Tipo de Comprobante</label>
                  <select id="ncf-form-tipo" class="form-select" required style="background: var(--clr-surface-3, #1e2e1e); color: var(--clr-text, #f0fdf0); border: 1px solid var(--clr-border, rgba(34, 197, 94, 0.2)); border-radius: 8px; padding: 8px 12px;">
                    <option value="">Seleccione Tipo</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Sección: Rango y Control de Secuencia -->
            <div style="margin-bottom: 24px; background: var(--clr-surface-2, #172017); border: 1px solid var(--clr-border, rgba(34, 197, 94, 0.15)); border-radius: 12px; padding: 18px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px; color: var(--clr-primary, #22c55e);">
                <span style="font-size: 1.15rem; font-weight: bold; line-height: 1;">⇅</span>
                <h4 style="margin: 0; font-size: 0.98rem; font-weight: 700; color: var(--clr-text, #f0fdf0);">Rango y Control de Secuencia</h4>
              </div>

              <div class="form-row" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 14px;">
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-weight: 600; font-size: 0.82rem; color: var(--clr-text, #f0fdf0);">Secuencia Inicial (Desde)</label>
                  <input type="number" id="ncf-form-from" class="form-input" placeholder="1" min="1" oninput="onNcfFormFromChange(this.value)" required style="background: var(--clr-surface-3, #1e2e1e); color: var(--clr-text, #f0fdf0); border: 1px solid var(--clr-border, rgba(34, 197, 94, 0.2)); border-radius: 8px; padding: 8px 12px;" />
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-weight: 600; font-size: 0.82rem; color: var(--clr-text, #f0fdf0);">Secuencia Final (Hasta)</label>
                  <input type="number" id="ncf-form-to" class="form-input" placeholder="100" min="1" required style="background: var(--clr-surface-3, #1e2e1e); color: var(--clr-text, #f0fdf0); border: 1px solid var(--clr-border, rgba(34, 197, 94, 0.2)); border-radius: 8px; padding: 8px 12px;" />
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-weight: 600; font-size: 0.82rem; color: var(--clr-text, #f0fdf0);">Siguiente a Emitir (Actual)</label>
                  <div style="position: relative;">
                    <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--clr-primary, #22c55e); font-weight: bold; pointer-events: none;">➔</span>
                    <input type="number" id="ncf-form-current" class="form-input" placeholder="1" min="1" style="padding-left: 28px; background: var(--clr-surface-3, #1e2e1e); color: var(--clr-text, #f0fdf0); border: 1px solid var(--clr-border, rgba(34, 197, 94, 0.2)); border-radius: 8px; padding-top: 8px; padding-bottom: 8px;" required />
                  </div>
                  <span style="display: block; margin-top: 4px; font-size: 0.72rem; color: var(--clr-text-muted, #6b7280);">
                    Se autocompleta con el valor 'Desde'.
                  </span>
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-weight: 600; font-size: 0.82rem; color: var(--clr-text, #f0fdf0);">Fecha de Vencimiento</label>
                  <input type="date" id="ncf-form-due-date" class="form-input" style="background: var(--clr-surface-3, #1e2e1e); color: var(--clr-text, #f0fdf0); border: 1px solid var(--clr-border, rgba(34, 197, 94, 0.2)); border-radius: 8px; padding: 8px 12px;" />
                </div>
              </div>

              <div class="form-row" style="grid-template-columns: 1fr; margin-bottom: 0;">
                <div class="form-group" style="max-width: 320px; margin-bottom: 0;">
                  <label class="form-label" style="font-weight: 600; font-size: 0.82rem; color: var(--clr-text, #f0fdf0);">Alerta al restar (Cantidad)</label>
                  <input type="number" id="ncf-form-alert" class="form-input" placeholder="Ej. 10" min="1" value="10" style="background: var(--clr-surface-3, #1e2e1e); color: var(--clr-text, #f0fdf0); border: 1px solid var(--clr-border, rgba(34, 197, 94, 0.2)); border-radius: 8px; padding: 8px 12px;" />
                  <span style="display: block; margin-top: 4px; font-size: 0.72rem; color: var(--clr-text-muted, #6b7280);">
                    Avisará al facturar cuando queden esta cantidad o menos.
                  </span>
                </div>
              </div>
            </div>

            <!-- Botones Guardar y Cancelar -->
            <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 16px;">
              <button type="button" class="btn-secondary" onclick="showVerSecuenciaView()" style="background: rgba(255, 255, 255, 0.06); color: var(--clr-text-secondary, #9ca3af); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; padding: 9px 20px; font-weight: 600; cursor: pointer;">Cancelar</button>
              <button type="submit" id="btn-ncf-form-submit" class="btn-primary" style="background: var(--clr-primary, #22c55e); color: #041207; border: none; border-radius: 8px; padding: 9px 22px; font-weight: 800; cursor: pointer; box-shadow: 0 0 15px rgba(34, 197, 94, 0.35);">💾 Guardar Secuencia</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  // Cerrar al hacer clic en el backdrop
  modal.onclick = (e) => {
    if (e.target === modal) closeParametrizacionesModal();
  };

  // Cerrar con Escape
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeParametrizacionesModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  modal.style.display = 'flex';
  
  // Vista inicial: Ver Secuencia (Inventario)
  showVerSecuenciaView();
}

function showVerSecuenciaView() {
  const verView = document.getElementById('param-ver-secuencia-view');
  const crearView = document.getElementById('param-crear-secuencia-view');
  const mainTitle = document.getElementById('param-modal-main-title');
  const btnAction = document.getElementById('btn-modal-action-header');

  if (verView) verView.style.display = 'block';
  if (crearView) crearView.style.display = 'none';
  if (mainTitle) mainTitle.textContent = 'Inventario de NCF';
  if (btnAction) {
    btnAction.innerHTML = '+ Nuevo';
    btnAction.onclick = showCrearSecuenciaView;
    btnAction.style.background = 'var(--clr-primary, #22c55e)';
    btnAction.style.color = '#041207';
  }

  // Limpiar modo edición
  const editIdEl = document.getElementById('ncf-form-editing-id');
  if (editIdEl) editIdEl.value = '';

  renderNcfSequencesList();
}

function showCrearSecuenciaView() {
  const verView = document.getElementById('param-ver-secuencia-view');
  const crearView = document.getElementById('param-crear-secuencia-view');
  const mainTitle = document.getElementById('param-modal-main-title');
  const btnAction = document.getElementById('btn-modal-action-header');

  if (verView) verView.style.display = 'none';
  if (crearView) crearView.style.display = 'block';
  if (mainTitle) mainTitle.textContent = 'Nueva Secuencia NCF';
  if (btnAction) {
    btnAction.innerHTML = '← Volver al Inventario';
    btnAction.onclick = showVerSecuenciaView;
    btnAction.style.background = 'rgba(255, 255, 255, 0.1)';
    btnAction.style.color = 'var(--clr-text, #f0fdf0)';
  }

  // Resetear id de edición
  const editIdEl = document.getElementById('ncf-form-editing-id');
  if (editIdEl) editIdEl.value = '';

  const titleEl = document.getElementById('ncf-form-title');
  if (titleEl) titleEl.textContent = 'Información del Comprobante (Serie B)';

  const submitBtn = document.getElementById('btn-ncf-form-submit');
  if (submitBtn) submitBtn.textContent = '💾 Guardar Secuencia';

  // Inicializar formulario con serie B por defecto
  const serieEl = document.getElementById('ncf-form-serie');
  if (serieEl) {
    serieEl.value = 'B';
    onNcfFormSerieChange('B');
  }

  const fromEl = document.getElementById('ncf-form-from');
  const toEl = document.getElementById('ncf-form-to');
  const currentEl = document.getElementById('ncf-form-current');
  const dateEl = document.getElementById('ncf-form-due-date');
  const alertEl = document.getElementById('ncf-form-alert');

  if (fromEl) fromEl.value = '1';
  if (toEl) toEl.value = '100';
  if (currentEl) currentEl.value = '1';
  if (dateEl) dateEl.value = '';
  if (alertEl) alertEl.value = '10';
}

function editNcfSequence(typeKey) {
  const seqs = getNcfSequences();
  const item = seqs[typeKey];
  if (!item) {
    showToast('No se encontró la secuencia seleccionada', 'warning');
    return;
  }

  const verView = document.getElementById('param-ver-secuencia-view');
  const crearView = document.getElementById('param-crear-secuencia-view');
  const mainTitle = document.getElementById('param-modal-main-title');
  const btnAction = document.getElementById('btn-modal-action-header');

  if (verView) verView.style.display = 'none';
  if (crearView) crearView.style.display = 'block';
  if (mainTitle) mainTitle.textContent = `✏️ Editando: ${item.name || typeKey}`;
  if (btnAction) {
    btnAction.innerHTML = '← Volver al Inventario';
    btnAction.onclick = showVerSecuenciaView;
    btnAction.style.background = 'rgba(255, 255, 255, 0.1)';
    btnAction.style.color = 'var(--clr-text, #f0fdf0)';
  }

  // Establecer id de edición
  const editIdEl = document.getElementById('ncf-form-editing-id');
  if (editIdEl) editIdEl.value = typeKey;

  const titleEl = document.getElementById('ncf-form-title');
  if (titleEl) titleEl.textContent = `✏️ Editando Secuencia: ${item.name || typeKey}`;

  const submitBtn = document.getElementById('btn-ncf-form-submit');
  if (submitBtn) submitBtn.textContent = '💾 Actualizar Secuencia';

  const serieEl = document.getElementById('ncf-form-serie');
  const serie = item.serie || (typeKey.startsWith('E') ? 'E' : 'B');
  if (serieEl) {
    serieEl.value = serie === 'E' ? 'B' : serie;
    onNcfFormSerieChange(serie === 'E' ? 'B' : serie);
  }

  const tipoEl = document.getElementById('ncf-form-tipo');
  if (tipoEl) {
    tipoEl.value = item.tipo || typeKey;
  }

  const fromEl = document.getElementById('ncf-form-from');
  const toEl = document.getElementById('ncf-form-to');
  const currentEl = document.getElementById('ncf-form-current');
  const dateEl = document.getElementById('ncf-form-due-date');
  const alertEl = document.getElementById('ncf-form-alert');

  if (fromEl) fromEl.value = item.from;
  if (toEl) toEl.value = item.to;
  if (currentEl) currentEl.value = item.current;
  if (dateEl) dateEl.value = item.dueDate || '';
  if (alertEl) alertEl.value = item.alertThreshold || 10;
}

function onNcfFormSerieChange(serie) {
  const tipoSelect = document.getElementById('ncf-form-tipo');
  if (!tipoSelect) return;
  if (serie === 'E') {
    tipoSelect.innerHTML = `<option value="">Serie E no disponible (Próximamente)</option>`;
    showToast('La Serie Electrónica (E) estará disponible próximamente en ReciminsaApp', 'info');
    return;
  }
  const list = NCF_TYPES_BY_SERIE.B;

  let html = `<option value="">Seleccione Tipo</option>`;
  list.forEach(t => {
    html += `<option value="${t.code}">${t.name}</option>`;
  });
  tipoSelect.innerHTML = html;
}

function onNcfFormFromChange(val) {
  const currentEl = document.getElementById('ncf-form-current');
  const isEditing = !!(document.getElementById('ncf-form-editing-id')?.value);
  if (!currentEl) return;
  // Solo autocompletar si no estamos editando
  if (!isEditing) {
    currentEl.value = val;
  }
}

function renderNcfSequencesList() {
  const container = document.getElementById('param-secuencias-container');
  if (!container) return;

  const seqs = getNcfSequences();
  const keys = Object.keys(seqs);

  // Obtener nombre de la empresa para la columna 'Asignado A'
  let companyName = 'Reciminsa SRL';
  try {
    const s = JSON.parse(localStorage.getItem(userKey('recim_company_settings')) || '{}');
    if (s.name) companyName = s.name;
    else {
      const d = localStorage.getItem(userKey('recim_company_name')) || localStorage.getItem('recim_company_name');
      if (d) companyName = d;
    }
  } catch (_) {}

  if (keys.length === 0) {
    container.innerHTML = `
      <div style="background: var(--clr-surface-2, #172017); border: 1px dashed var(--clr-border, rgba(34, 197, 94, 0.2)); border-radius: 12px; padding: 48px 24px; text-align: center;">
        <div style="font-size: 2.2rem; margin-bottom: 12px;">📑</div>
        <h3 style="margin: 0 0 8px 0; color: var(--clr-text, #f0fdf0); font-weight: 700; font-size: 1.15rem;">No hay secuencias fiscales registradas</h3>
        <p style="margin: 0 0 20px 0; color: var(--clr-text-secondary, #9ca3af); font-size: 0.88rem;">No tienes secuencias fiscales configuradas. Haz clic en <strong>+ Nueva Secuencia</strong> para agregar las autorizadas por la DGII.</p>
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
          <button type="button" class="btn-primary" onclick="showCrearSecuenciaView()" style="background: var(--clr-primary, #22c55e); color: #041207; border: none; padding: 9px 22px; border-radius: 8px; font-weight: 800; cursor: pointer; box-shadow: 0 0 15px rgba(34, 197, 94, 0.35);">
            + Nueva Secuencia
          </button>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; gap: 10px; flex-wrap: wrap;">
      <div style="font-size: 0.84rem; color: var(--clr-text-secondary, #9ca3af);">
        Secuencias fiscales configuradas: <strong style="color: var(--clr-primary-light, #4ade80);">${keys.length}</strong>
      </div>
      <div style="display: flex; gap: 8px;">
        <button type="button" class="btn-primary" onclick="showCrearSecuenciaView()" style="background: var(--clr-primary, #22c55e); color: #041207; border: none; border-radius: 6px; padding: 5px 14px; font-size: 0.78rem; font-weight: 800; cursor: pointer;">
          + Nueva Secuencia
        </button>
        <button type="button" onclick="clearAllNcfSequences()" style="background: rgba(239, 68, 68, 0.12); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 5px 12px; font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: all 0.2s;" title="Eliminar todas las secuencias del inventario">
          🗑️ Vaciar Todo
        </button>
      </div>
    </div>
    <div style="overflow-x: auto; width: 100%; border: 1px solid var(--clr-border, rgba(34, 197, 94, 0.2)); border-radius: 12px; background: var(--clr-surface, #111a11);">
      <table style="width: 100%; min-width: 960px; border-collapse: collapse; font-family: inherit; font-size: 0.88rem; text-align: left;">
        <thead>
          <tr style="border-bottom: 2px solid rgba(34, 197, 94, 0.25); color: var(--clr-text-secondary, #9ca3af); font-weight: 700; font-size: 0.82rem; background: rgba(0, 0, 0, 0.35); text-transform: uppercase; letter-spacing: 0.03em;">
            <th style="padding: 14px 14px; white-space: nowrap;">Tipo ⇅</th>
            <th style="padding: 14px 14px; white-space: nowrap;">Descripción</th>
            <th style="padding: 14px 14px; white-space: nowrap;">Asignado A</th>
            <th style="padding: 14px 14px; white-space: nowrap;">Desde</th>
            <th style="padding: 14px 14px; white-space: nowrap;">Hasta</th>
            <th style="padding: 14px 14px; white-space: nowrap;">Actual</th>
            <th style="padding: 14px 14px; white-space: nowrap;">% Uso</th>
            <th style="padding: 14px 14px; white-space: nowrap;">Vencimiento</th>
            <th style="padding: 14px 14px; white-space: nowrap;">Estado</th>
            <th style="padding: 14px 14px; white-space: nowrap; text-align: center;">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${keys.map(typeKey => {
            const item = seqs[typeKey];
            const isE = typeKey.startsWith('E') || item.serie === 'E';
            const serie = isE ? 'E' : (item.serie || 'B');
            const code = typeKey.replace(/^[BE]/, '');
            const displayTipo = `${code} (${serie})`;

            // Limpiar nombre DGII (quitar códigos redundantes al inicio o al final)
            let desc = item.name || getNcfTypeName(typeKey);
            desc = desc.replace(/^\d+\s*-\s*/, '').replace(/\s*\([BE]\d+\)$/, '').trim();

            const fromNum = parseInt(item.from, 10) || 1;
            const toNum = parseInt(item.to, 10) || 100;
            const currentNum = parseInt(item.current, 10) || fromNum;
            const total = Math.max(1, toNum - fromNum + 1);
            const consumed = Math.max(0, currentNum - fromNum);
            const pct = Math.min(100, Math.max(0, Math.round((consumed / total) * 100)));

            const isActive = item.active !== false;

            // Formato de vencimiento
            let dueDisplay = '<span style="color: var(--clr-text-muted); font-size: 0.82rem;">Sin Vencimiento</span>';
            if (item.dueDate) {
              const parts = item.dueDate.split('-');
              if (parts.length === 3) {
                const day = parseInt(parts[2], 10);
                const month = parseInt(parts[1], 10);
                const year = parts[0];
                dueDisplay = `<span style="color: var(--clr-primary-light, #4ade80); font-weight: 700; font-size: 0.86rem;">${day}/${month}/${year}</span>`;
              } else {
                dueDisplay = `<span style="color: var(--clr-primary-light, #4ade80); font-weight: 700; font-size: 0.86rem;">${item.dueDate}</span>`;
              }
            }

            return `
              <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.06); transition: background 0.15s;" onmouseover="this.style.background='rgba(34, 197, 94, 0.05)'" onmouseout="this.style.background='transparent'">
                <td style="padding: 14px 14px; white-space: nowrap;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <b style="color: var(--clr-text, #f0fdf0); font-size: 0.9rem;">${displayTipo}</b>
                    ${isE ? `<span style="font-size: 0.68rem; color: #f59e0b; background: rgba(245,158,11,0.15); padding: 2px 6px; border-radius: 4px; font-weight: 700; border: 1px solid rgba(245,158,11,0.3);">Próximamente</span>` : ''}
                  </div>
                </td>
                <td style="padding: 14px 14px; color: var(--clr-text, #f0fdf0); font-weight: 500;">
                  ${desc}
                </td>
                <td style="padding: 14px 14px; white-space: nowrap;">
                  <div style="font-weight: 700; color: var(--clr-text, #f0fdf0); font-size: 0.84rem;">Empresa: ${companyName}</div>
                  <div style="color: var(--clr-text-muted); font-size: 0.77rem; line-height: 1.3;">Sucursal: Todos</div>
                  <div style="color: var(--clr-text-muted); font-size: 0.77rem; line-height: 1.3;">Caja: Todos</div>
                </td>
                <td style="padding: 14px 14px; color: var(--clr-text-secondary, #9ca3af);">
                  ${fromNum}
                </td>
                <td style="padding: 14px 14px; color: var(--clr-text-secondary, #9ca3af);">
                  ${toNum}
                </td>
                <td style="padding: 14px 14px; font-weight: 800; color: var(--clr-primary-light, #4ade80); font-size: 0.95rem;">
                  ${currentNum}
                </td>
                <td style="padding: 14px 14px; white-space: nowrap;">
                  <div style="display: inline-flex; align-items: center; gap: 6px;">
                    <div style="background: rgba(255, 255, 255, 0.08); border-radius: 999px; height: 12px; width: 56px; overflow: hidden; position: relative;">
                      <div style="background: var(--clr-primary, #22c55e); height: 100%; width: ${pct}%; border-radius: 999px;"></div>
                    </div>
                    ${pct > 0 ? `<span style="font-size: 0.74rem; font-weight: 700; color: var(--clr-primary-light, #4ade80);">${pct}%</span>` : ''}
                  </div>
                </td>
                <td style="padding: 14px 14px; white-space: nowrap;">
                  ${dueDisplay}
                </td>
                <td style="padding: 14px 14px; white-space: nowrap;">
                  <button type="button" onclick="toggleNcfSequenceActive('${typeKey}', ${!isActive})" style="background: ${isActive ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${isActive ? '#4ade80' : '#f87171'}; border: 1px solid ${isActive ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}; border-radius: 6px; padding: 4px 12px; font-weight: 700; font-size: 0.78rem; cursor: pointer; transition: all 0.2s;" title="Clic para cambiar estado">
                    ${isActive ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td style="padding: 14px 14px; text-align: center; white-space: nowrap;">
                  <div style="display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                    <button type="button" onclick="editNcfSequence('${typeKey}')" style="background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.35); border-radius: 50%; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.95rem; transition: transform 0.15s;" title="Editar secuencia">
                      ✏️
                    </button>
                    <button type="button" onclick="deleteNcfSequence('${typeKey}')" style="background: rgba(239, 68, 68, 0.12); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 50%; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.85rem; transition: transform 0.15s;" title="Eliminar secuencia">
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function seedDefaultDgiiSequences() {
  console.log('Secuencias modelo desactivadas.');
}
window.seedDefaultDgiiSequences = seedDefaultDgiiSequences;

function saveNcfSequenceFromForm(activeTab = 'facturas') {
  const editingId = (document.getElementById('ncf-form-editing-id')?.value || '').trim();
  const serie = (document.getElementById('ncf-form-serie')?.value || 'B').trim();
  const tipo = (document.getElementById('ncf-form-tipo')?.value || '').trim();
  const from = parseInt(document.getElementById('ncf-form-from')?.value, 10);
  const to = parseInt(document.getElementById('ncf-form-to')?.value, 10);
  const current = parseInt(document.getElementById('ncf-form-current')?.value, 10) || from;
  const dueDate = (document.getElementById('ncf-form-due-date')?.value || '').trim();
  const alertThreshold = parseInt(document.getElementById('ncf-form-alert')?.value, 10) || 10;

  if (serie === 'E') {
    showToast('La Serie Electrónica (E) no está disponible por ahora (Próximamente en ReciminsaApp)', 'warning');
    return;
  }

  if (!tipo) {
    showToast('Seleccione un tipo de comprobante', 'warning');
    return;
  }
  if (isNaN(from) || from < 1) {
    showToast('Ingrese una secuencia inicial válida (mínimo 1)', 'warning');
    return;
  }
  if (isNaN(to) || to < from) {
    showToast('La secuencia final debe ser mayor o igual a la inicial', 'warning');
    return;
  }
  if (current < from || current > to) {
    showToast('El valor siguiente a emitir debe estar dentro del rango [Desde, Hasta]', 'warning');
    return;
  }

  const seqs = getNcfSequences();

  // Si estamos editando y cambió el tipo, eliminar la clave previa
  if (editingId && editingId !== tipo && seqs[editingId]) {
    delete seqs[editingId];
  }

  const prevActive = seqs[tipo]?.active !== undefined ? seqs[tipo].active : true;

  seqs[tipo] = {
    id: tipo,
    serie,
    tipo,
    name: getNcfTypeName(tipo),
    prefix: tipo,
    from,
    to,
    current,
    dueDate,
    alertThreshold,
    active: prevActive,
    updatedAt: new Date().toISOString()
  };

  saveNcfSequences(seqs);
  const msgAction = editingId ? 'actualizada' : 'guardada';
  showToast(`✅ Secuencia para ${tipo} ${msgAction} exitosamente`, 'success');

  // Limpiar modo edición y volver a la vista de Ver Secuencia
  if (document.getElementById('ncf-form-editing-id')) {
    document.getElementById('ncf-form-editing-id').value = '';
  }
  showVerSecuenciaView();

  // Refrescar select de comprobantes y formularios de la vista activa
  if (typeof refreshAllNcfTypeSelects === 'function') refreshAllNcfTypeSelects(tipo);
  if (typeof handleUnifiedNcfChange === 'function') handleUnifiedNcfChange();
  if (typeof initCreditNoteForm === 'function' && activeTab === 'nota_credito') initCreditNoteForm();
  if (typeof initDebitNoteForm === 'function' && activeTab === 'nota_debito') initDebitNoteForm();
}

function toggleNcfSequenceActive(tipo, isActive) {
  const seqs = getNcfSequences();
  if (seqs[tipo]) {
    seqs[tipo].active = !!isActive;
    saveNcfSequences(seqs);
    renderNcfSequencesList();
    if (typeof refreshAllNcfTypeSelects === 'function') refreshAllNcfTypeSelects();
    if (typeof handleUnifiedNcfChange === 'function') handleUnifiedNcfChange();
  }
}

function deleteNcfSequence(tipo) {
  if (!confirm(`¿Deseas eliminar la secuencia para ${tipo}?`)) return;
  const seqs = getNcfSequences();
  delete seqs[tipo];
  saveNcfSequences(seqs);
  showToast(`Secuencia ${tipo} eliminada`, 'info');
  renderNcfSequencesList();
  if (typeof refreshAllNcfTypeSelects === 'function') refreshAllNcfTypeSelects();
  if (typeof handleUnifiedNcfChange === 'function') handleUnifiedNcfChange();
}

function clearAllNcfSequences() {
  if (!confirm('¿Deseas eliminar TODAS las secuencias del inventario de NCF para configurarlas desde cero?')) return;
  saveNcfSequences({});
  showToast('Inventario de NCF vaciado', 'info');
  renderNcfSequencesList();
  if (typeof refreshAllNcfTypeSelects === 'function') refreshAllNcfTypeSelects('');
  if (typeof handleUnifiedNcfChange === 'function') handleUnifiedNcfChange();
}

function closeParametrizacionesModal() {
  const modal = document.getElementById('parametrizaciones-modal');
  if (modal) {
    modal.remove();
  }
}

window.editNcfSequence = editNcfSequence;
window.deleteNcfSequence = deleteNcfSequence;
window.toggleNcfSequenceActive = toggleNcfSequenceActive;
window.clearAllNcfSequences = clearAllNcfSequences;
window.showCrearSecuenciaView = showCrearSecuenciaView;
window.showVerSecuenciaView = showVerSecuenciaView;
window.saveNcfSequenceFromForm = saveNcfSequenceFromForm;

function getModuleLabel(tabKey) {
  switch (tabKey) {
    case 'cotizaciones': return 'Cotizaciones';
    case 'facturas': return 'Facturas de Venta';
    case 'despachos': return 'Despachos / Conduces';
    case 'devoluciones': return 'Devoluciones';
    case 'nota_credito': return 'Notas de Crédito (B04)';
    case 'nota_debito': return 'Notas de Débito (B03)';
    default: return 'Facturación';
  }
}

// =============================================
// 3. NAVEGACIÓN ENTRE SUB-MÓDULOS DE FACTURACIÓN
// =============================================

function switchFacturacionTab(tabName) {
  document.querySelectorAll('.fac-tab').forEach(t_ => t_.classList.remove('active'));
  document.querySelectorAll('.fac-tab-content').forEach(c => c.classList.remove('active'));

  const btn = document.getElementById(`fac-tab-btn-${tabName}`);
  const content = document.getElementById(`fac-tab-${tabName}`);

  if (btn) btn.classList.add('active');
  if (content) content.classList.add('active');

  // Inicializar o refrescar el contenido de la pestaña seleccionada
  switch (tabName) {
    case 'cotizaciones': initQuotesView(); break;
    case 'facturas': initUnifiedFacturaForm(); break;
    case 'despachos': initDispatchesView(); break;
    case 'devoluciones': initReturnsView(); break;
    case 'nota_credito': initCreditNotesView(); break;
    case 'nota_debito': initDebitNotesView(); break;
  }
}

// =============================================
// 4. FACTURA DE VENTA UNIFICADA (Sin Local vs Crédito Fiscal)
// =============================================

function renderUnifiedFacturaForm() {
  const materials = typeof getCustomCodes === 'function' ? getCustomCodes() : [];
  let datalistHtml = `<datalist id="material-codes-datalist-unified">`;
  materials.forEach(m => {
    datalistHtml += `<option value="${m.code} - ${m.name}">${m.name} (${m.code})</option>`;
  });
  datalistHtml += `</datalist>`;

  const clients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
  let clientsDatalistHtml = `<datalist id="clients-datalist-unified">`;
  clients.forEach(c => {
    clientsDatalistHtml += `<option value="${c.name}">${c.nit ? c.nit : ''}</option>`;
  });
  clientsDatalistHtml += `</datalist>`;

  return `
    ${datalistHtml}
    ${clientsDatalistHtml}
    <div class="card" style="max-width: 960px; margin: 0 auto;">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <h3 class="card-title">🧾 Nueva Factura de Venta</h3>
          <p class="card-subtitle">Emisión unificada de comprobantes y facturas comerciales</p>
        </div>
        <button class="btn-secondary" onclick="openParametrizacionesModal('facturas')" style="margin: 0; padding: 7px 14px; font-size: 0.85rem;" type="button">
          ⚙️ Parametrizaciones NCF
        </button>
      </div>

      <!-- Banner de Alerta Dinámico NCF (DGII) -->
      <div id="unified-ncf-alert-box"></div>

      <!-- Fila 1: Selección de Cliente Rápido -->
      <div class="form-row" style="margin-bottom: 15px;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">${t('inv.select_client')}</label>
          <select id="fac-client-select-unified" class="form-select" onchange="autofillClientUnified(this.value)">
            <option value="">${t('inv.manual_entry')}</option>
          </select>
        </div>
      </div>

      <!-- Fila 2: Nombre y RNC/Cédula -->
      <div class="form-row" style="grid-template-columns: 1.2fr 1fr;">
        <div class="form-group">
          <label class="form-label">Cliente / Razón Social <span style="color: #ef4444; font-weight: bold;">*</span></label>
          <div style="display:flex; gap: 8px;">
            <input id="fac-name-unified" type="text" class="form-input" list="clients-datalist-unified" placeholder="${t('inv.full_name_ph')}" style="flex:1;" onkeydown="if(event.key==='Enter'){event.preventDefault();autoFillInvoiceByNameDGIIUnified();}" />
            <button class="btn-secondary" onclick="autoFillInvoiceByNameDGIIUnified()" style="margin:0; padding: 0 15px;" title="Buscar RNC por Nombre en DGII" type="button">🔍</button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">${t('inv.rnc_label')} <span class="text-muted" style="font-size:0.85em; font-weight:normal;">(${t('lbl.optional', 'Opcional')})</span></label>
          <div style="display:flex; gap: 8px;">
            <input id="fac-nit-unified" type="text" class="form-input" placeholder="${t('inv.rnc_ph')}" maxlength="11" onkeydown="if(event.key==='Enter'){event.preventDefault();autoFillInvoiceDGIIUnified();}" />
            <button class="btn-secondary" onclick="autoFillInvoiceDGIIUnified()" style="margin:0; padding: 0 15px;" title="${t('inv.rnc_search')}" type="button">🔍</button>
          </div>
        </div>
      </div>

      <!-- Fila 3: Comprobante y NCF -->
      <div class="form-row" style="grid-template-columns: 1fr 1fr;">
        <div class="form-group">
          <label class="form-label">${t('inv.voucher_type')}</label>
          <select id="fac-ncf-type-unified" class="form-select" onchange="handleUnifiedNcfChange()">
            ${getNcfTypeSelectOptionsHtml()}
          </select>
        </div>
        <div class="form-group" id="fac-ncf-group-unified" style="display: none;">
          <label class="form-label">${t('inv.ncf_full')} <span class="text-muted" style="font-size:0.85em; font-weight:normal;">(${t('lbl.optional', 'Opcional')})</span></label>
          <input id="fac-ncf-unified" type="text" class="form-input" placeholder="${t('inv.ncf_ph')}" maxlength="13" onchange="padNcfUnified(this)" onkeyup="if(event.key==='Enter') padNcfUnified(this)" />
        </div>
      </div>

      <!-- Fila 4: Dirección -->
      <div class="form-row" style="grid-template-columns: 1fr;">
        <div class="form-group">
          <label class="form-label">${t('inv.address')}</label>
          <input id="fac-address-unified" type="text" class="form-input" placeholder="${t('inv.address_ph')}" />
        </div>
      </div>

      <!-- Fila 5: Fecha, Contacto, Colaborador, Forma de Pago -->
      <div class="form-row" style="grid-template-columns: repeat(4, 1fr);">
        <div class="form-group">
          <label class="form-label">${t('lbl.invoice_date')} <span style="color: #ef4444; font-weight: bold;">*</span></label>
          <input id="fac-date-unified" type="date" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('inv.contact')}</label>
          <input id="fac-contact-unified" type="text" class="form-input" placeholder="${t('inv.contact_ph')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Forma de Pago</label>
          <select id="fac-pay-method-unified" class="form-select">
            <option value="Efectivo">💵 Efectivo</option>
            <option value="Transferencia">🏦 Transferencia Bancaria</option>
            <option value="Cheque">📜 Cheque</option>
            <option value="Crédito">⏳ Crédito</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">${t('inv.collaborator')}</label>
          <select id="fac-colab-unified" class="form-select">
            ${(function() {
              let sessionUser = '';
              try {
                const s = JSON.parse(localStorage.getItem('recim_session') || '{}');
                sessionUser = s.name || (s.email ? s.email.split('@')[0] : '');
              } catch(e) {}
              const colabs = JSON.parse(localStorage.getItem(userKey('recim_collaborators')) || '[]');
              let options = `<option value="">${t('inv.no_collaborator', '-- Sin colaborador --')}</option>`;
              if (sessionUser) {
                options += `<option value="${sessionUser}">${sessionUser} (Usuario actual)</option>`;
              }
              colabs.forEach(c => {
                if (c.name !== sessionUser) {
                  options += `<option value="${c.name}">${c.name} (${c.role || 'Colaborador'})</option>`;
                }
              });
              return options;
            })()}
          </select>
        </div>
      </div>

      <!-- Ítems de la Factura -->
      <div style="margin-top:20px;">
        <h4 style="margin-bottom: 10px; color: var(--clr-text-muted);">${t('inv.items_title')}</h4>
        <div id="fac-items-unified" style="display:flex; flex-direction:column; gap:10px;">
          <!-- Filas dinámicas -->
        </div>
      </div>

      <div style="margin-top:10px; display:flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
         <button class="btn-secondary" onclick="addFacEntryRowUnified()" style="margin-bottom:0;" type="button">
           ➕ ${t('inv.add_item')}
         </button>
         <div id="fac-totals-unified" style="text-align:right;">
            <div class="subtotal-label" style="font-size:0.9rem; color:var(--clr-text-muted);">Subtotal: ${formatMoney(0)}</div>
            <div class="total-label" style="font-size:1.15rem; font-weight:700; color:var(--clr-primary-light);">Total: ${formatMoney(0)}</div>
         </div>
      </div>

      <!-- Impuestos y Retenciones -->
      <div class="form-row" style="margin-top:20px; grid-template-columns: repeat(4, 1fr);">
        <div class="form-group">
          <label class="form-label">ISC (%)</label>
          <input id="fac-isc-unified" type="number" class="form-input" value="0" min="0" oninput="calcFacTotalsUnified()" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('inv.itbis_label') || 'ITBIS (%)'}</label>
          <input id="fac-tax-unified" type="number" class="form-input" value="0" min="0" oninput="calcFacTotalsUnified()" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('inv.ret_isr')}</label>
          <input id="fac-ret-isr-unified" type="number" class="form-input" value="0" min="0" oninput="calcFacTotalsUnified()" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('inv.ret_itbis')}</label>
          <input id="fac-ret-itbis-unified" type="number" class="form-input" value="0" min="0" oninput="calcFacTotalsUnified()" />
        </div>
      </div>

      <div class="form-row" style="grid-template-columns: 1fr;">
        <div class="form-group">
          <label class="form-label">${t('inv.pay_notes')}</label>
          <input id="fac-notes-unified" type="text" class="form-input" placeholder="${t('inv.pay_notes_ph')}" />
        </div>
      </div>

      <div style="display:flex; gap:10px; margin-top:30px;">
        <button class="btn-primary" onclick="saveFacturaUnified()" style="flex:2;" type="button">💾 ${t('inv.save_invoice')}</button>
        <button class="btn-outline" onclick="initUnifiedFacturaForm()" style="flex:1;" type="button">${t('inv.clear_form')}</button>
      </div>
    </div>

    <!-- Historial de Facturas Emitidas con conversión rápida a Despacho o Devolución -->
    <div class="card" style="max-width: 960px; margin: 30px auto 0;">
      <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <h3 class="card-title">📜 Facturas de Venta Emitidas</h3>
          <p class="card-subtitle">Convierte facturas en despachos o devoluciones con los botones rápidos</p>
        </div>
        <span class="badge" style="background:var(--clr-surface-2); font-weight:600; padding:6px 12px;">${(typeof getAllInvoices === 'function' ? getAllInvoices() : []).length} facturas</span>
      </div>

      <div style="overflow-x: auto;">
        <table class="table" style="width: 100%;">
          <thead>
            <tr>
              <th>ID / Factura</th>
              <th>Fecha</th>
              <th>NCF</th>
              <th>Cliente / Razón Social</th>
              <th>Total</th>
              <th style="text-align:center;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${(function() {
              const invoices = typeof getAllInvoices === 'function' ? getAllInvoices() : [];
              if (invoices.length === 0) {
                return `<tr><td colspan="6" style="text-align: center; color: var(--clr-text-muted); padding: 25px;">No hay facturas registradas aún.</td></tr>`;
              }
              return invoices.map(inv => `
                <tr>
                  <td><b>${inv.id}</b></td>
                  <td>${inv.date || '—'}</td>
                  <td><span class="badge" style="background:var(--clr-surface-2); color:var(--clr-text-muted); border:1px solid var(--clr-border);">${inv.ncf ? inv.ncf : 'Interna (Sin NCF)'}</span></td>
                  <td><b>${inv.company || inv.client || '—'}</b> ${inv.nit ? `<span style="font-size:0.8rem; color:var(--clr-text-muted);">(${inv.nit})</span>` : ''}</td>
                  <td style="font-weight:700; color:var(--clr-primary);">${formatMoney(inv.total !== undefined ? inv.total : (inv.totalVenta || 0))}</td>
                  <td style="text-align:center;">
                    <div style="display:inline-flex; gap:6px; align-items:center; justify-content:center;">
                      <button class="btn-secondary" onclick="showInvoiceDetailsModal('${inv.id}')" title="Ver Detalles de la Factura" style="padding: 6px 10px; font-size: 1.05rem; line-height: 1; border-radius: var(--r-sm);" type="button">👁️</button>
                      <button class="btn-primary" onclick="convertInvoiceToDispatch('${inv.id}')" title="Convertir en Despacho (Conduce)" style="padding: 6px 10px; font-size: 1.05rem; line-height: 1; border-radius: var(--r-sm);" type="button">🚚</button>
                      <button class="btn-secondary" onclick="convertInvoiceToReturn('${inv.id}')" title="Convertir en Devolución de Mercancía" style="padding: 6px 10px; font-size: 1.05rem; line-height: 1; border-radius: var(--r-sm);" type="button">↩️</button>
                      <button class="btn-secondary" onclick="printInvoicePDF('${inv.id}')" title="Descargar / Imprimir Factura en PDF" style="padding: 6px 10px; font-size: 1.05rem; line-height: 1; border-radius: var(--r-sm);" type="button">📄</button>
                      <button class="btn-danger" onclick="deleteUnifiedInvoice('${inv.id}')" title="Eliminar Factura" style="padding: 6px 10px; font-size: 1.05rem; line-height: 1; border-radius: var(--r-sm); background:rgba(239,68,68,0.2); border:1px solid #ef4444; color:#ef4444;" type="button">🗑️</button>
                    </div>
                  </td>
                </tr>
              `).join('');
            })()}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function initUnifiedFacturaForm(prefillData = null) {
  const container = document.getElementById('fac-tab-facturas');
  if (!container) return;

  container.innerHTML = renderUnifiedFacturaForm();
  
  if (prefillData && Array.isArray(prefillData.items) && prefillData.items.length > 0) {
    prefillData.items.forEach(item => addFacEntryRowUnified(item));
  } else {
    addFacEntryRowUnified();
  }

  const today = new Date().toISOString().split('T')[0];
  const dateEl = document.getElementById('fac-date-unified');
  if (dateEl) dateEl.value = prefillData?.date || today;

  initClientSelectUnified();

  if (prefillData) {
    if (prefillData.company) document.getElementById('fac-name-unified').value = prefillData.company;
    if (prefillData.nit) document.getElementById('fac-nit-unified').value = prefillData.nit;
    if (prefillData.address) document.getElementById('fac-address-unified').value = prefillData.address;
    if (prefillData.contact) document.getElementById('fac-contact-unified').value = prefillData.contact;
    if (prefillData.notes) document.getElementById('fac-notes-unified').value = prefillData.notes;
    if (prefillData.taxRate !== undefined) document.getElementById('fac-tax-unified').value = prefillData.taxRate;
    if (prefillData.collaborator) {
      const colEl = document.getElementById('fac-colab-unified');
      if (colEl) colEl.value = prefillData.collaborator;
    }
    if (prefillData.payMethod) {
      const payEl = document.getElementById('fac-pay-method-unified');
      if (payEl) payEl.value = prefillData.payMethod;
    }
    if (prefillData.ncfType) {
      const ncfEl = document.getElementById('fac-ncf-type-unified');
      if (ncfEl) ncfEl.value = prefillData.ncfType;
    } else if (prefillData.nit) {
      const cleanNit = prefillData.nit.replace(/\D/g, '');
      const ncfEl = document.getElementById('fac-ncf-type-unified');
      if (ncfEl && !ncfEl.value) {
        ncfEl.value = (cleanNit.length === 9) ? 'B01' : 'B02';
      }
    }
  }

  handleUnifiedNcfChange();
  calcFacTotalsUnified();
}

async function deleteUnifiedInvoice(invoiceId) {
  let ok = false;
  if (window.AppDialog && typeof window.AppDialog.confirm === 'function') {
    ok = await window.AppDialog.confirm('¿Deseas eliminar esta factura permanentemente?', 'Eliminar Factura');
  } else {
    ok = confirm('¿Deseas eliminar esta factura permanentemente?');
  }
  if (!ok) return;

  const invoices = (typeof getAllInvoices === 'function' ? getAllInvoices() : []).filter(i => i.id !== invoiceId);
  localStorage.setItem(userKey('recim_invoices'), JSON.stringify(invoices));
  if (typeof window.forceSync === 'function') {
    try { window.forceSync(); } catch (_) {}
  }
  showToast('🗑️ Factura eliminada correctamente', 'success');
  initUnifiedFacturaForm();
}
window.deleteUnifiedInvoice = deleteUnifiedInvoice;

function initClientSelectUnified() {
  const select = document.getElementById('fac-client-select-unified');
  if (!select) return;

  const clients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
  let options = `<option value="">-- Escribir datos manualmente --</option>`;
  clients.forEach(c => {
    options += `<option value="${c.id}">${c.name} ${c.nit ? '('+c.nit+')' : ''}</option>`;
  });
  select.innerHTML = options;
}

function autofillClientUnified(clientId) {
  if (!clientId) return;
  const clients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
  const client = clients.find(c => c.id === clientId);
  if (client) {
    document.getElementById('fac-name-unified').value = client.name || '';
    document.getElementById('fac-nit-unified').value = client.nit || '';
    document.getElementById('fac-address-unified').value = client.address || '';
    document.getElementById('fac-contact-unified').value = client.contact || client.phone || '';
    
    // Asignar automáticamente la secuencia NCF del cliente para facturar rápido y fácil
    const typeSelect = document.getElementById('fac-ncf-type-unified');
    if (typeSelect) {
      let targetNcf = client.defaultNcf || '';
      if (!targetNcf) {
        if (client.type === 'empresa' || (client.nit && client.nit.replace(/\D/g, '').length === 9)) {
          targetNcf = 'B01';
        } else if (client.type === 'local' && (!client.nit || client.nit.replace(/\D/g, '').length === 11)) {
          targetNcf = 'B02';
        }
      }
      if (targetNcf) {
        if (!typeSelect.querySelector(`option[value="${targetNcf}"]`)) {
          const opt = document.createElement('option');
          opt.value = targetNcf;
          let desc = getNcfTypeName(targetNcf);
          desc = desc.replace(/^\d+\s*-\s*/, '').replace(/\s*\([BE]\d+\)$/, '').trim();
          opt.textContent = `${targetNcf} - ${desc}`;
          typeSelect.appendChild(opt);
        }
        typeSelect.value = targetNcf;
        handleUnifiedNcfChange();
      }
    }
  }
}

async function autoFillInvoiceDGIIUnified() {
  const nitInput = document.getElementById('fac-nit-unified');
  const nameInput = document.getElementById('fac-name-unified');
  if (!nitInput) return;
  const val = nitInput.value.trim();

  // Si no hay RNC pero hay nombre escrito, buscar por nombre automáticamente
  if (!val) {
    if (nameInput && nameInput.value.trim()) {
      autoFillInvoiceByNameDGIIUnified();
      return;
    }
    showToast(t('inv.rnc_enter_first'), 'warning');
    return;
  }

  const data = await fetchDGIIData(val);
  if (data) {
    if (data.rnc) nitInput.value = data.rnc;
    if (data.name) document.getElementById('fac-name-unified').value = data.name;
    if (data.address) document.getElementById('fac-address-unified').value = data.address;

    // Si es RNC de empresa de 9 dígitos, sugerir comprobante fiscal B01
    const cleanId = (data.rnc || val).replace(/\D/g, '');
    const typeSelect = document.getElementById('fac-ncf-type-unified');
    if (typeSelect && cleanId.length === 9 && (!typeSelect.value || typeSelect.value === 'B02')) {
      typeSelect.value = 'B01';
      handleUnifiedNcfChange();
    }

    showToast(t('inv.rnc_verified'), 'success');
  }
}

async function autoFillInvoiceByNameDGIIUnified() {
  const nameInput = document.getElementById('fac-name-unified');
  if (!nameInput) return;
  const val = nameInput.value.trim();
  if (!val) {
    showToast('Ingresa el nombre o razón social de la empresa para buscar su RNC', 'warning');
    return;
  }

  const results = await searchDGIICompanies(val);
  if (!results || results.length === 0) return;

  if (results.length === 1) {
    applyDGIICompanyToInvoice(results[0]);
  } else {
    openDGIICompanyPickerModal(results, (selected) => {
      applyDGIICompanyToInvoice(selected);
    });
  }
}

function applyDGIICompanyToInvoice(company) {
  const nameInput = document.getElementById('fac-name-unified');
  const nitInput = document.getElementById('fac-nit-unified');
  const typeSelect = document.getElementById('fac-ncf-type-unified');

  if (nameInput) nameInput.value = company.name;
  if (nitInput) nitInput.value = company.rnc;

  // Auto-seleccionar Factura con Crédito Fiscal (B01) para empresas
  if (typeSelect && (!typeSelect.value || typeSelect.value === 'B02')) {
    typeSelect.value = 'B01';
  }
  handleUnifiedNcfChange();

  showToast(`✅ RNC encontrado: ${company.rnc} (${company.name})`, 'success');
}

function handleUnifiedNcfChange() {
  const typeSelect = document.getElementById('fac-ncf-type-unified');
  const ncfType = typeSelect ? typeSelect.value : '';
  const ncfGroup = document.getElementById('fac-ncf-group-unified');
  const ncfInput = document.getElementById('fac-ncf-unified');
  const taxInput = document.getElementById('fac-tax-unified');
  const alertBox = document.getElementById('unified-ncf-alert-box');

  if (ncfGroup) {
    ncfGroup.style.display = ncfType ? 'block' : 'none';
  }

  if (alertBox) alertBox.innerHTML = '';

  if (!ncfType) {
    if (ncfInput) {
      ncfInput.value = '';
      ncfInput.disabled = true;
      ncfInput.placeholder = 'Sin comprobante';
    }
    if (taxInput && taxInput.value === '18') {
      taxInput.value = '0';
    }
  } else {
    if (ncfInput) {
      ncfInput.disabled = false;
      const ncfInfo = getNextNcfInfo(ncfType);

      if (!ncfInfo.isConfigured) {
        ncfInput.value = '';
        ncfInput.placeholder = `Sin secuencia configurada en Parametrizaciones (Opcional)`;
      } else if (ncfInfo.exhausted) {
        ncfInput.value = '';
        ncfInput.placeholder = '¡Secuencia agotada!';
        if (alertBox) {
          alertBox.innerHTML = `
            <div class="ncf-danger-banner">
              🚨 <b>Secuencia Agotada (DGII):</b> Se han emitido todos los comprobantes autorizados de tipo <b>${ncfType}</b>. Debes solicitar un nuevo lote en la DGII y configurarlo en <b>⚙️ Parametrizaciones</b>.
            </div>
          `;
        }
      } else if (ncfInfo.ncf) {
        ncfInput.value = ncfInfo.ncf;
        ncfInput.placeholder = `Ej: ${ncfInfo.ncf} (Opcional)`;

        if (ncfInfo.isExpired) {
          if (alertBox) {
            alertBox.innerHTML = `
              <div class="ncf-danger-banner">
                🚨 <b>Secuencia Vencida (DGII):</b> La autorización de la secuencia <b>${ncfType}</b> venció el <b>${ncfInfo.seq.dueDate}</b>. Se recomienda renovarla en la DGII.
              </div>
            `;
          }
        } else if (ncfInfo.remaining !== null && ncfInfo.remaining <= (ncfInfo.alertThreshold || 10)) {
          if (alertBox) {
            alertBox.innerHTML = `
              <div class="ncf-alert-banner">
                ⚠️ <b>Aviso DGII:</b> Solamente te quedan <b>${ncfInfo.remaining}</b> comprobante(s). Se recomienda ir a la DGII.
              </div>
            `;
          }
        }
      } else {
        ncfInput.placeholder = `Ej: ${ncfType}00000001 (Opcional)`;
      }
    }

    if (ncfType === 'B01' || ncfType === 'E31') {
      if (taxInput && (!taxInput.value || taxInput.value === '0')) taxInput.value = '18';
    } else if (ncfType === 'B14' || ncfType === 'E44') {
      if (taxInput) taxInput.value = '0';
    }
  }

  calcFacTotalsUnified();
}

function padNcfUnified(input) {
  let val = input.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!val) return;

  const ncfTypeSelect = document.getElementById('fac-ncf-type-unified');
  const selectedNcfType = ncfTypeSelect ? ncfTypeSelect.value : '';
  if (selectedNcfType && !val.startsWith(selectedNcfType)) {
    if (!/^[A-Z]\d{2}/.test(val)) {
      val = selectedNcfType + val;
    }
  }

  const match = val.match(/^([A-Z]\d{2})(\d+)$/);
  if (match) {
    const prefix = match[1];
    let seq = match[2];
    let totalLength = val.startsWith('E') ? 13 : 11;
    let seqLength = totalLength - prefix.length;
    seq = seq.padStart(seqLength, '0');
    input.value = prefix + seq;
  } else {
    input.value = val;
  }
}

function addFacEntryRowUnified(prefill = null) {
  const tbody = document.getElementById('fac-items-unified');
  if (!tbody) return;

  const rowId = `row-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const div = document.createElement('div');
  div.id = rowId;
  div.className = 'invoice-item-row';
  div.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; align-items: center; background: var(--clr-surface-2); padding: 10px; border-radius: var(--r-sm); border: 1px solid var(--clr-border);';

  div.innerHTML = `
    <div style="flex: 2 1 200px;">
      <input type="text" class="form-input row-desc" list="material-codes-datalist-unified" placeholder="${t('inv.desc_ph')}" value="${prefill?.desc || prefill?.name || ''}" style="margin:0;" />
    </div>
    <div style="flex: 1 1 80px;">
      <input type="number" class="form-input row-qty" placeholder="${t('inv.qty_ph')}" min="0.01" step="0.01" value="${prefill?.qty || ''}" oninput="calcFacTotalsUnified()" style="margin:0;" />
    </div>
    <div style="flex: 1 1 80px;">
      <select class="form-select row-unit" style="margin:0;">
        <option value="lb" ${prefill?.unit === 'lb' ? 'selected' : ''}>lb</option>
        <option value="kg" ${prefill?.unit === 'kg' ? 'selected' : ''}>kg</option>
        <option value="ton" ${prefill?.unit === 'ton' ? 'selected' : ''}>ton</option>
        <option value="ud" ${prefill?.unit === 'ud' ? 'selected' : ''}>ud</option>
      </select>
    </div>
    <div style="flex: 1 1 90px;">
      <input type="number" class="form-input row-uprice" placeholder="${t('inv.price_ph')}" min="0" step="0.01" value="${prefill?.uprice || prefill?.price || ''}" oninput="calcFacTotalsUnified()" style="margin:0;" />
    </div>
    <div style="flex: 1 1 90px; text-align: right; font-weight: 600; font-size: 0.95rem; color: var(--clr-text);" class="row-subtotal">
      ${formatMoney(prefill?.subtotal || 0)}
    </div>
    <div>
      <button class="btn-danger" onclick="document.getElementById('${rowId}').remove(); calcFacTotalsUnified();" style="padding: 6px 10px; margin:0;" type="button">✕</button>
    </div>
  `;

  tbody.appendChild(div);
  calcFacTotalsUnified();
}

function calcFacTotalsUnified() {
  const tbody = document.getElementById('fac-items-unified');
  if (!tbody) return;

  const rows = tbody.querySelectorAll('.invoice-item-row');
  let rawSubtotal = 0;

  rows.forEach(r => {
    const qty = parseFloat(r.querySelector('.row-qty')?.value) || 0;
    const price = parseFloat(r.querySelector('.row-uprice')?.value) || 0;
    const sub = qty * price;
    const subLabel = r.querySelector('.row-subtotal');
    if (subLabel) subLabel.textContent = formatMoney(sub);
    rawSubtotal += sub;
  });

  const iscRate = parseFloat(document.getElementById('fac-isc-unified')?.value) || 0;
  const taxRate = parseFloat(document.getElementById('fac-tax-unified')?.value) || 0;
  const retIsrRate = parseFloat(document.getElementById('fac-ret-isr-unified')?.value) || 0;
  const retItbisRate = parseFloat(document.getElementById('fac-ret-itbis-unified')?.value) || 0;

  const iscAmount = rawSubtotal * (iscRate / 100);
  const taxAmount = rawSubtotal * (taxRate / 100);
  const retIsrAmount = rawSubtotal * (retIsrRate / 100);
  const retItbisAmount = taxAmount * (retItbisRate / 100);
  const total = rawSubtotal + iscAmount + taxAmount - retIsrAmount - retItbisAmount;

  const container = document.getElementById('fac-totals-unified');
  if (container) {
    container.innerHTML = `
      <div style="font-size:0.85rem; color:var(--clr-text-muted);">Subtotal: ${formatMoney(rawSubtotal)}</div>
      ${taxAmount > 0 ? `<div style="font-size:0.85rem; color:var(--clr-text-muted);">ITBIS (${taxRate}%): ${formatMoney(taxAmount)}</div>` : ''}
      <div style="font-size:1.15rem; font-weight:700; color:var(--clr-primary-light);">Total: ${formatMoney(total)}</div>
    `;
  }
}

function saveFacturaUnified() {
  const company = document.getElementById('fac-name-unified')?.value.trim();
  const date = document.getElementById('fac-date-unified')?.value;

  if (!company) {
    showToast('❌ Ingresa el nombre o razón social del cliente', 'error');
    return;
  }
  if (!date) {
    showToast(t('inv.err_no_date'), 'error');
    return;
  }

  const tbody = document.getElementById('fac-items-unified');
  const rows = tbody ? tbody.querySelectorAll('.invoice-item-row') : [];
  const items = [];

  rows.forEach(r => {
    const desc = r.querySelector('.row-desc')?.value.trim();
    const qty = parseFloat(r.querySelector('.row-qty')?.value) || 0;
    const unit = r.querySelector('.row-unit')?.value || 'lb';
    const uprice = parseFloat(r.querySelector('.row-uprice')?.value) || 0;
    if (desc && qty > 0) {
      items.push({ id: Date.now() + Math.random(), desc, qty, unit, uprice, subtotal: qty * uprice });
    }
  });

  if (items.length === 0) {
    showToast(t('inv.err_no_items'), 'error');
    return;
  }

  const nit = document.getElementById('fac-nit-unified')?.value.trim() || '';
  const ncfType = document.getElementById('fac-ncf-type-unified')?.value || '';
  const ncfInput = document.getElementById('fac-ncf-unified');
  if (ncfInput && ncfInput.value.trim()) {
    padNcfUnified(ncfInput);
  }
  const ncf = ncfInput ? ncfInput.value.trim() : '';

  // Validación de ley DGII: Si se emite B01 (Crédito Fiscal), el RNC es mandatorio
  if (ncfType === 'B01' && !nit) {
    showToast('❌ Para Comprobantes de Crédito Fiscal (B01) el RNC del cliente es obligatorio según la DGII', 'error');
    return;
  }

  // Comprobar duplicado si se asigna un NCF
  if (ncf) {
    const existingInvoices = getAllInvoices();
    const isDuplicate = existingInvoices.some(inv => inv.ncf && inv.ncf.toUpperCase() === ncf.toUpperCase());
    if (isDuplicate) {
      showToast(t('inv.err_dup_ncf').replace('{ncf}', ncf), 'error');
      return;
    }
  }

  const address = document.getElementById('fac-address-unified')?.value.trim() || '';
  const contact = document.getElementById('fac-contact-unified')?.value.trim() || '';
  const collaborator = document.getElementById('fac-colab-unified')?.value || '';
  const payMethod = document.getElementById('fac-pay-method-unified')?.value || 'Efectivo';
  const notes = document.getElementById('fac-notes-unified')?.value.trim() || '';

  const iscRate = parseFloat(document.getElementById('fac-isc-unified')?.value) || 0;
  const taxRate = parseFloat(document.getElementById('fac-tax-unified')?.value) || 0;
  const retIsrRate = parseFloat(document.getElementById('fac-ret-isr-unified')?.value) || 0;
  const retItbisRate = parseFloat(document.getElementById('fac-ret-itbis-unified')?.value) || 0;

  const rawSubtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const iscAmount = rawSubtotal * (iscRate / 100);
  const taxAmount = rawSubtotal * (taxRate / 100);
  const retIsrAmount = rawSubtotal * (retIsrRate / 100);
  const retItbisAmount = taxAmount * (retItbisRate / 100);
  const total = rawSubtotal + iscAmount + taxAmount - retIsrAmount - retItbisAmount;

  const invoice = {
    id: `FAC-${Date.now()}`,
    type: ncfType === 'B01' ? 'empresa' : 'local',
    typeName: (function() {
      if (ncfType === 'B01') return 'Factura de Crédito Fiscal';
      if (ncfType === 'B02') return 'Factura de Consumo (Consumidor Final)';
      if (ncfType === 'B03') return 'Nota de Débito';
      if (ncfType === 'B04') return 'Nota de Crédito';
      if (ncfType === 'B14') return 'Regímenes Especiales de Tributación';
      if (ncfType === 'B15') return 'Comprobante Gubernamental';
      if (ncfType) {
        let name = getNcfTypeName(ncfType);
        return name.replace(/^\d+\s*-\s*/, '').replace(/\s*\([BE]\d+\)$/, '').trim();
      }
      return 'Factura Estándar';
    })(),
    company, nit, ncfType, ncf, address, contact, date, notes,
    payMethod,
    items, subtotal: rawSubtotal, taxRate, taxAmount,
    iscRate, iscAmount, retIsrRate, retIsrAmount, retItbisRate, retItbisAmount, total,
    collaborator,
    createdAt: new Date().toISOString()
  };

  saveInvoice(invoice);

  // Consumir número de la secuencia si se usó un NCF de lote configurado
  if (ncfType) {
    consumeNcfSequence(ncfType);
  }

  // Registrar movimiento financiero
  if (typeof addFinanceEntry === 'function') {
    addFinanceEntry('ingreso', {
      concept: `Venta Factura ${invoice.id} – ${company}${ncf ? ' (' + ncf + ')' : ''}`,
      amount: total, date, category: 'Ventas', ref: invoice.id
    });
  }

  showToast(`✅ Factura guardada: ${invoice.id}`, 'success');
  initUnifiedFacturaForm();
  showInvoicePostSaveModal(invoice);
}

function convertInvoiceToDispatch(invoiceId) {
  const invoices = typeof getAllInvoices === 'function' ? getAllInvoices() : [];
  const inv = invoices.find(i => i.id === invoiceId);
  if (!inv) {
    showToast('⚠️ No se encontró la factura seleccionada', 'warning');
    return;
  }

  switchFacturacionTab('despachos');
  setTimeout(() => {
    const invSelect = document.getElementById('disp-invoice-ref');
    if (invSelect) {
      invSelect.value = invoiceId;
      if (typeof autofillDispatchFromInvoice === 'function') {
        autofillDispatchFromInvoice(invoiceId);
      }
    }
    const destInput = document.getElementById('disp-dest');
    if (destInput && (inv.company || inv.client)) destInput.value = inv.company || inv.client;
    const addrInput = document.getElementById('disp-address');
    if (addrInput && inv.address) addrInput.value = inv.address;

    // Sincronizar dropdown de cliente si coincide
    const clientSelect = document.getElementById('disp-client-select');
    if (clientSelect && (inv.company || inv.client)) {
      const targetName = (inv.company || inv.client).trim().toLowerCase();
      const opt = Array.from(clientSelect.options).find(o => o.text.toLowerCase().includes(targetName));
      if (opt) clientSelect.value = opt.value;
    }

    // Cargar los ítems de la factura en los ítems del despacho
    if (Array.isArray(inv.items) && inv.items.length > 0) {
      const container = document.getElementById('disp-items-container');
      if (container) {
        container.innerHTML = '';
        inv.items.forEach(it => {
          if (typeof addDispatchItemRow === 'function') {
            addDispatchItemRow({
              desc: it.desc || it.name || '',
              qty: it.qty || 1,
              unit: it.unit || 'lb',
              packages: '1'
            });
          }
        });
      }
    }
    showToast(`🚚 Conduce preparado desde factura ${invoiceId}`, 'info');
  }, 60);
}
window.convertInvoiceToDispatch = convertInvoiceToDispatch;

function convertInvoiceToReturn(invoiceId) {
  const invoices = typeof getAllInvoices === 'function' ? getAllInvoices() : [];
  const inv = invoices.find(i => i.id === invoiceId);
  if (!inv) {
    showToast('⚠️ No se encontró la factura seleccionada', 'warning');
    return;
  }

  switchFacturacionTab('devoluciones');
  setTimeout(() => {
    const invSelect = document.getElementById('ret-invoice-ref');
    if (invSelect) {
      invSelect.value = invoiceId;
      if (typeof autofillReturnFromInvoice === 'function') {
        autofillReturnFromInvoice(invoiceId);
      }
    }
    const clientInput = document.getElementById('ret-client');
    if (clientInput && (inv.company || inv.client)) clientInput.value = inv.company || inv.client;

    // Sincronizar dropdown de cliente si coincide
    const clientSelect = document.getElementById('ret-client-select');
    if (clientSelect && (inv.company || inv.client)) {
      const targetName = (inv.company || inv.client).trim().toLowerCase();
      const opt = Array.from(clientSelect.options).find(o => o.text.toLowerCase().includes(targetName));
      if (opt) clientSelect.value = opt.value;
    }

    showToast(`↩️ Devolución preparada desde factura ${invoiceId}`, 'info');
  }, 60);
}
window.convertInvoiceToReturn = convertInvoiceToReturn;

function printInvoicePDF(invoiceId) {
  const invoices = typeof getAllInvoices === 'function' ? getAllInvoices() : [];
  const inv = invoices.find(i => i.id === invoiceId);
  if (inv && typeof generateInvoicePDF === 'function') {
    generateInvoicePDF(inv);
  } else {
    showToast('📄 Preparando factura PDF...', 'info');
  }
}
window.printInvoicePDF = printInvoicePDF;

// =============================================
// 5. BLOQUE DE COTIZACIONES
// =============================================

function getAllQuotes() {
  return JSON.parse(localStorage.getItem(userKey('recim_quotes')) || '[]');
}

function saveQuote(quote) {
  const list = getAllQuotes();
  list.unshift(quote);
  localStorage.setItem(userKey('recim_quotes'), JSON.stringify(list));
  if (typeof window.forceSync === 'function') {
    try { window.forceSync(); } catch (_) {}
  }
}

function initQuotesView() {
  const container = document.getElementById('fac-tab-cotizaciones');
  if (!container) return;

  const p = getModuleParams('cotizaciones');
  const quotes = getAllQuotes();
  const clients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');

  let clientOptions = `<option value="">-- Seleccionar cliente o ingresar manualmente --</option>`;
  clients.forEach(c => {
    clientOptions += `<option value="${c.id}">${c.name} ${c.nit ? '(' + c.nit + ')' : ''}</option>`;
  });

  const clientsDatalistHtml = `<datalist id="quote-clients-datalist">${clients.map(c => `<option value="${c.name}">${c.nit ? c.nit : ''}</option>`).join('')}</datalist>`;

  container.innerHTML = `
    ${clientsDatalistHtml}
    <div class="card" style="max-width: 960px; margin: 0 auto;">
      <div class="card-header">
        <div>
          <h3 class="card-title">📋 Cotizaciones y Presupuestos</h3>
          <p class="card-subtitle">Crea propuestas comerciales antes de emitir la factura final</p>
        </div>
      </div>

      <div style="background: var(--clr-surface-2); padding: 18px; border-radius: var(--r-md); border: 1px solid var(--clr-border); margin-bottom: 25px;">
        <h4 style="margin-top: 0; margin-bottom: 12px; color: var(--clr-text);">Nueva Cotización</h4>

        <!-- Selección de Cliente Rápido -->
        <div class="form-row" style="margin-bottom: 15px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">${t('inv.select_client', 'Seleccionar Cliente Registrado')}</label>
            <select id="quote-client-select" class="form-select" onchange="autofillQuoteClient(this.value)">
              ${clientOptions}
            </select>
          </div>
        </div>

        <div class="form-row" style="grid-template-columns: 2fr 1fr;">
          <div class="form-group">
            <label class="form-label">Cliente / Prospecto <span style="color: #ef4444;">*</span></label>
            <input id="quote-client" type="text" class="form-input" list="quote-clients-datalist" placeholder="Nombre de la empresa o cliente" />
          </div>
          <div class="form-group">
            <label class="form-label">RNC / Cédula</label>
            <input id="quote-nit" type="text" class="form-input" placeholder="Opcional" />
          </div>
        </div>

        <div class="form-row" style="grid-template-columns: repeat(3, 1fr);">
          <div class="form-group">
            <label class="form-label">Fecha de Emisión</label>
            <input id="quote-date" type="date" class="form-input" value="${new Date().toISOString().split('T')[0]}" />
          </div>
          <div class="form-group">
            <label class="form-label">Días de Validez</label>
            <input id="quote-validity" type="number" class="form-input" value="${p.validityDays || 15}" min="1" max="90" />
          </div>
          <div class="form-group">
            <label class="form-label">Teléfono / Contacto</label>
            <input id="quote-contact" type="text" class="form-input" placeholder="Ej: 809-000-0000" />
          </div>
        </div>

        <!-- Filas de ítems -->
        <div style="margin-top: 15px;">
          <h5 style="margin-bottom: 8px; color: var(--clr-text-muted);">Ítems de la Cotización</h5>
          <div id="quote-items-container" style="display:flex; flex-direction:column; gap:8px;"></div>
          <div style="display: flex; align-items: center; gap: 12px; margin-top: 10px; flex-wrap: wrap;">
            <button class="btn-secondary" onclick="addQuoteItemRow()" style="margin: 0; font-size: 0.85rem;" type="button">
              ➕ Agregar Ítem
            </button>
            <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--clr-text); cursor: pointer; user-select: none; font-weight: 500; margin: 0; background: var(--clr-surface-2); padding: 6px 12px; border-radius: var(--r-sm); border: 1px solid var(--clr-border);">
              <input type="checkbox" id="quote-is-service" onchange="toggleQuoteServiceMode(this.checked)" style="cursor: pointer; width: 16px; height: 16px; accent-color: var(--clr-primary);" />
              ¿Es servicio?
            </label>
          </div>
        </div>

        <div class="form-row" style="grid-template-columns: 1fr; margin-top: 15px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Términos Comerciales y Notas</label>
            <textarea id="quote-notes" class="form-input" rows="2">${p.defaultNotes || ''}</textarea>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; margin-top: 15px;">
          <button class="btn-primary" onclick="handleSaveQuote()" type="button">💾 Generar Cotización</button>
        </div>
      </div>

      <!-- Listado de Cotizaciones Emitidas -->
      <h4 style="margin-bottom: 12px; color: var(--clr-text);">Historial de Cotizaciones</h4>
      <div style="overflow-x: auto;">
        <table class="table" style="width: 100%;">
          <thead>
            <tr>
              <th>ID</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Total</th>
              <th>Validez</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${quotes.length === 0 ? `
              <tr><td colspan="6" style="text-align: center; color: var(--clr-text-muted); padding: 20px;">No hay cotizaciones registradas aún.</td></tr>
            ` : quotes.map(q => `
              <tr>
                <td><b>${q.id}</b></td>
                <td>${q.date}</td>
                <td>${q.client}</td>
                <td style="font-weight: 600; color: var(--clr-primary);">${formatMoney(q.total)}</td>
                <td><span class="badge">${q.validityDays} días</span></td>
                <td>
                  <div style="display: flex; gap: 6px;">
                    <button class="btn-primary" onclick="convertQuoteToInvoice('${q.id}')" title="Convertir en Factura" style="padding: 4px 8px; font-size: 0.8rem;">⚡ Facturar</button>
                    <button class="btn-secondary" onclick="printQuotePDF('${q.id}')" title="Descargar PDF" style="padding: 4px 8px; font-size: 0.8rem;">📄</button>
                    <button class="btn-danger" onclick="deleteQuote('${q.id}')" title="Eliminar" style="padding: 4px 8px; font-size: 0.8rem;">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  addQuoteItemRow();
}

function addQuoteItemRow(prefill = null) {
  const container = document.getElementById('quote-items-container');
  if (!container) return;

  const rowId = `qrow-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const serviceCheck = document.getElementById('quote-is-service');
  const isService = prefill?.isService !== undefined ? Boolean(prefill.isService) : Boolean(serviceCheck?.checked);

  const div = document.createElement('div');
  div.id = rowId;
  div.className = 'quote-item-row';
  div.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; align-items: center; background: var(--clr-surface); padding: 8px; border-radius: var(--r-sm); border: 1px solid var(--clr-border);';

  div.innerHTML = `
    <div style="flex: 2 1 200px;">
      <input type="text" class="form-input q-desc" placeholder="${isService ? 'Descripción del servicio' : 'Descripción del material o servicio'}" value="${prefill?.desc || ''}" style="margin:0;" />
    </div>
    <div class="q-qty-wrapper" style="flex: 1 1 80px; ${isService ? 'display: none;' : ''}">
      <input type="number" class="form-input q-qty" placeholder="Cantidad" min="0.01" step="0.01" value="${prefill?.qty || ''}" style="margin:0;" />
    </div>
    <div class="q-unit-wrapper" style="flex: 1 1 80px; ${isService ? 'display: none;' : ''}">
      <select class="form-select q-unit" style="margin:0;">
        <option value="lb" ${prefill?.unit === 'lb' ? 'selected' : ''}>lb</option>
        <option value="kg" ${prefill?.unit === 'kg' ? 'selected' : ''}>kg</option>
        <option value="ton" ${prefill?.unit === 'ton' ? 'selected' : ''}>ton</option>
        <option value="ud" ${prefill?.unit === 'ud' ? 'selected' : ''}>ud</option>
        <option value="servicio" ${prefill?.unit === 'servicio' || isService ? 'selected' : ''}>servicio</option>
      </select>
    </div>
    <div style="flex: 1 1 100px;">
      <input type="number" class="form-input q-uprice" placeholder="${isService ? 'Precio servicio' : 'Precio'}" min="0" step="0.01" value="${prefill?.uprice || ''}" style="margin:0;" />
    </div>
    <div>
      <button class="btn-danger" onclick="document.getElementById('${rowId}').remove();" style="padding: 5px 8px; margin:0;" type="button">✕</button>
    </div>
  `;
  container.appendChild(div);
}

function toggleQuoteServiceMode(isChecked) {
  const container = document.getElementById('quote-items-container');
  if (!container) return;

  const rows = container.querySelectorAll('.quote-item-row');
  rows.forEach(r => {
    const qtyWrapper = r.querySelector('.q-qty-wrapper');
    const unitWrapper = r.querySelector('.q-unit-wrapper');
    const qtyInput = r.querySelector('.q-qty');
    const unitSelect = r.querySelector('.q-unit');
    const descInput = r.querySelector('.q-desc');
    const priceInput = r.querySelector('.q-uprice');

    if (isChecked) {
      if (qtyWrapper) qtyWrapper.style.display = 'none';
      if (unitWrapper) unitWrapper.style.display = 'none';
      if (qtyInput) qtyInput.value = '1';
      if (unitSelect) unitSelect.value = 'servicio';
      if (descInput && !descInput.value) descInput.placeholder = 'Descripción del servicio';
      if (priceInput) priceInput.placeholder = 'Precio servicio';
    } else {
      if (qtyWrapper) qtyWrapper.style.display = '';
      if (unitWrapper) unitWrapper.style.display = '';
      if (qtyInput && qtyInput.value === '1') qtyInput.value = '';
      if (unitSelect && unitSelect.value === 'servicio') unitSelect.value = 'lb';
      if (descInput && descInput.placeholder === 'Descripción del servicio') descInput.placeholder = 'Descripción del material o servicio';
      if (priceInput) priceInput.placeholder = 'Precio';
    }
  });
}
window.toggleQuoteServiceMode = toggleQuoteServiceMode;

function handleSaveQuote() {
  const client = document.getElementById('quote-client')?.value.trim();
  const date = document.getElementById('quote-date')?.value;
  const validityDays = parseInt(document.getElementById('quote-validity')?.value, 10) || 15;
  const nit = document.getElementById('quote-nit')?.value.trim() || '';
  const contact = document.getElementById('quote-contact')?.value.trim() || '';
  const notes = document.getElementById('quote-notes')?.value.trim() || '';
  const isGlobalService = Boolean(document.getElementById('quote-is-service')?.checked);

  if (!client) {
    showToast('❌ Ingresa el nombre del cliente para la cotización', 'error');
    return;
  }

  const rows = document.querySelectorAll('.quote-item-row');
  const items = [];
  let total = 0;

  rows.forEach(r => {
    const desc = r.querySelector('.q-desc')?.value.trim();
    const uprice = parseFloat(r.querySelector('.q-uprice')?.value) || 0;
    const isRowService = isGlobalService || (r.querySelector('.q-unit')?.value === 'servicio');

    if (isRowService) {
      if (desc && uprice > 0) {
        const qty = 1;
        const unit = 'servicio';
        const subtotal = uprice;
        total += subtotal;
        items.push({ desc, qty, unit, uprice, subtotal, isService: true });
      }
    } else {
      const qty = parseFloat(r.querySelector('.q-qty')?.value) || 0;
      const unit = r.querySelector('.q-unit')?.value || 'lb';
      if (desc && qty > 0) {
        const subtotal = qty * uprice;
        total += subtotal;
        items.push({ desc, qty, unit, uprice, subtotal, isService: false });
      }
    }
  });

  if (items.length === 0) {
    showToast('❌ Agrega al menos un ítem a la cotización', 'error');
    return;
  }

  const p = getModuleParams('cotizaciones');
  const quote = {
    id: `${p.prefix || 'COT-'}${Date.now().toString().slice(-6)}`,
    client, nit, date, validityDays, contact, notes,
    isService: isGlobalService,
    items, total,
    createdAt: new Date().toISOString()
  };

  saveQuote(quote);
  showToast(`✅ Cotización ${quote.id} guardada con éxito`, 'success');
  initQuotesView();
}

function convertQuoteToInvoice(quoteId) {
  const quotes = getAllQuotes();
  const q = quotes.find(item => item.id === quoteId);
  if (!q) return;

  switchFacturacionTab('facturas');
  initUnifiedFacturaForm({
    company: q.client,
    nit: q.nit,
    contact: q.contact,
    notes: `Basado en cotización ${q.id}. ${q.notes || ''}`,
    items: q.items,
    collaborator: q.collaborator || '',
    payMethod: q.payMethod || 'Efectivo'
  });
  showToast(`⚡ Cotización ${q.id} convertida a borrador de factura`, 'info');
}

function printQuotePDF(quoteId) {
  const quotes = getAllQuotes();
  const q = quotes.find(item => item.id === quoteId);
  if (!q) return;
  if (typeof generateQuotePDF === 'function') {
    generateQuotePDF(q);
  } else {
    showToast('📄 Preparando vista de cotización...', 'info');
  }
}

function deleteQuote(quoteId) {
  if (!confirm(`¿Eliminar la cotización ${quoteId}?`)) return;
  const list = getAllQuotes().filter(q => q.id !== quoteId);
  localStorage.setItem(userKey('recim_quotes'), JSON.stringify(list));
  initQuotesView();
  showToast('Cotización eliminada', 'info');
}

function autofillQuoteClient(clientId) {
  const nameInput = document.getElementById('quote-client');
  const nitInput = document.getElementById('quote-nit');
  const contactInput = document.getElementById('quote-contact');
  if (!nameInput) return;
  if (!clientId) {
    nameInput.value = '';
    if (nitInput) nitInput.value = '';
    if (contactInput) contactInput.value = '';
    return;
  }
  const clients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
  const client = clients.find(c => c.id === clientId);
  if (client) {
    nameInput.value = client.name || '';
    if (nitInput) nitInput.value = client.nit || '';
    if (contactInput) contactInput.value = client.contact || client.phone || '';
  }
}
window.autofillQuoteClient = autofillQuoteClient;

// =============================================
// 6. BLOQUE DE DESPACHOS (Conduces de Entrega)
// =============================================

function getAllDispatches() {
  return JSON.parse(localStorage.getItem(userKey('recim_dispatches')) || '[]');
}

function saveDispatch(dispatch) {
  const list = getAllDispatches();
  list.unshift(dispatch);
  localStorage.setItem(userKey('recim_dispatches'), JSON.stringify(list));
  if (typeof window.forceSync === 'function') {
    try { window.forceSync(); } catch (_) {}
  }
}

function initDispatchesView() {
  const container = document.getElementById('fac-tab-despachos');
  if (!container) return;

  const p = getModuleParams('despachos');
  const dispatches = getAllDispatches();
  const invoices = getAllInvoices();
  const clients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');

  let clientOptions = `<option value="">-- Seleccionar cliente o ingresar manualmente --</option>`;
  clients.forEach(c => {
    clientOptions += `<option value="${c.id}">${c.name} ${c.nit ? '(' + c.nit + ')' : ''}</option>`;
  });

  const clientsDatalistHtml = `<datalist id="disp-clients-datalist">${clients.map(c => `<option value="${c.name}">${c.address ? c.address : ''}</option>`).join('')}</datalist>`;

  container.innerHTML = `
    ${clientsDatalistHtml}
    <div class="card" style="max-width: 960px; margin: 0 auto;">
      <div class="card-header">
        <div>
          <h3 class="card-title">🚚 Despachos y Conduces de Entrega</h3>
          <p class="card-subtitle">Documento legal de transporte de mercancías según la ley de tránsito y comercio</p>
        </div>
      </div>

      <div style="background: var(--clr-surface-2); padding: 18px; border-radius: var(--r-md); border: 1px solid var(--clr-border); margin-bottom: 25px;">
        <h4 style="margin-top: 0; margin-bottom: 12px; color: var(--clr-text);">Nuevo Conduce de Despacho</h4>

        <!-- Selección de Cliente Rápido -->
        <div class="form-row" style="margin-bottom: 15px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">${t('inv.select_client', 'Seleccionar Destinatario / Cliente Registrado')}</label>
            <select id="disp-client-select" class="form-select" onchange="autofillDispatchClient(this.value)">
              ${clientOptions}
            </select>
          </div>
        </div>

        <div class="form-row" style="grid-template-columns: 2fr 1fr;">
          <div class="form-group">
            <label class="form-label">Destinatario / Cliente <span style="color: #ef4444;">*</span></label>
            <input id="disp-dest" type="text" class="form-input" list="disp-clients-datalist" placeholder="Nombre o empresa destino" />
          </div>
          <div class="form-group">
            <label class="form-label">Factura Asociada (Opcional)</label>
            <select id="disp-invoice-ref" class="form-select" onchange="autofillDispatchFromInvoice(this.value)">
              <option value="">-- Sin factura asociada --</option>
              ${invoices.map(inv => `<option value="${inv.id}">${inv.id} – ${inv.company}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row" style="grid-template-columns: 1fr 1fr;">
          <div class="form-group">
            <label class="form-label">Dirección de Entrega <span style="color: #ef4444;">*</span></label>
            <input id="disp-address" type="text" class="form-input" placeholder="Punto de entrega de la carga" />
          </div>
          <div class="form-group">
            <label class="form-label">Fecha de Salida</label>
            <input id="disp-date" type="date" class="form-input" value="${new Date().toISOString().split('T')[0]}" />
          </div>
        </div>

        <div class="form-row" style="grid-template-columns: repeat(3, 1fr);">
          <div class="form-group">
            <label class="form-label">Chofer / Conductor</label>
            <input id="disp-driver" type="text" class="form-input" value="${p.defaultCarrier || ''}" placeholder="Nombre del chofer" />
          </div>
          <div class="form-group">
            <label class="form-label">Cédula del Chofer</label>
            <input id="disp-driver-id" type="text" class="form-input" placeholder="Ej: 001-0000000-0" />
          </div>
          <div class="form-group">
            <label class="form-label">Vehículo y Placa</label>
            <input id="disp-plate" type="text" class="form-input" placeholder="Ej: Camión Daihatsu - L123456" />
          </div>
        </div>

        <!-- Materiales despachados -->
        <div style="margin-top: 15px;">
          <h5 style="margin-bottom: 8px; color: var(--clr-text-muted);">Carga / Materiales Despachados</h5>
          <div id="disp-items-container" style="display:flex; flex-direction:column; gap:8px;"></div>
          <button class="btn-secondary" onclick="addDispatchItemRow()" style="margin-top: 8px; font-size: 0.85rem;" type="button">
            ➕ Agregar Material a la Carga
          </button>
        </div>

        <div class="form-row" style="grid-template-columns: 1fr; margin-top: 15px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Observaciones de Entrega</label>
            <input id="disp-notes" type="text" class="form-input" value="${p.defaultNotes || ''}" placeholder="Detalles de la entrega" />
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; margin-top: 15px;">
          <button class="btn-primary" onclick="handleSaveDispatch()" type="button">🚚 Generar Conduce de Despacho</button>
        </div>
      </div>

      <!-- Listado de Despachos -->
      <h4 style="margin-bottom: 12px; color: var(--clr-text);">Historial de Conduces Emitidos</h4>
      <div style="overflow-x: auto;">
        <table class="table" style="width: 100%;">
          <thead>
            <tr>
              <th>Conduce #</th>
              <th>Fecha</th>
              <th>Destinatario</th>
              <th>Chofer / Placa</th>
              <th>Bultos / Peso</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${dispatches.length === 0 ? `
              <tr><td colspan="6" style="text-align: center; color: var(--clr-text-muted); padding: 20px;">No hay despachos registrados.</td></tr>
            ` : dispatches.map(d => `
              <tr>
                <td><b>${d.id}</b></td>
                <td>${d.date}</td>
                <td>${d.destination}</td>
                <td>${d.driver || '—'} (${d.plate || '—'})</td>
                <td>${d.items.length} ítems</td>
                <td>
                  <div style="display: flex; gap: 6px;">
                    <button class="btn-secondary" onclick="printDispatchPDF('${d.id}')" title="Descargar Conduce PDF" style="padding: 4px 8px; font-size: 0.8rem;">📄 Conduce</button>
                    <button class="btn-danger" onclick="deleteDispatch('${d.id}')" title="Eliminar" style="padding: 4px 8px; font-size: 0.8rem;">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  addDispatchItemRow();
}

function addDispatchItemRow(prefill = null) {
  const container = document.getElementById('disp-items-container');
  if (!container) return;

  const rowId = `drow-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const div = document.createElement('div');
  div.id = rowId;
  div.className = 'disp-item-row';
  div.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; align-items: center; background: var(--clr-surface); padding: 8px; border-radius: var(--r-sm); border: 1px solid var(--clr-border);';

  div.innerHTML = `
    <div style="flex: 2 1 180px;">
      <input type="text" class="form-input d-desc" placeholder="Descripción de material reciclado" value="${prefill?.desc || ''}" style="margin:0;" />
    </div>
    <div style="flex: 1 1 80px;">
      <input type="number" class="form-input d-qty" placeholder="Peso / Cant" min="0.01" step="0.01" value="${prefill?.qty || ''}" style="margin:0;" />
    </div>
    <div style="flex: 1 1 80px;">
      <select class="form-select d-unit" style="margin:0;">
        <option value="lb">lb</option>
        <option value="kg">kg</option>
        <option value="ton">ton</option>
        <option value="fardo">fardo</option>
        <option value="saco">saco</option>
      </select>
    </div>
    <div style="flex: 1 1 100px;">
      <input type="text" class="form-input d-packages" placeholder="Bultos/Sacos" value="${prefill?.packages || ''}" style="margin:0;" />
    </div>
    <div>
      <button class="btn-danger" onclick="document.getElementById('${rowId}').remove();" style="padding: 5px 8px; margin:0;" type="button">✕</button>
    </div>
  `;
  container.appendChild(div);
}

function handleSaveDispatch() {
  const destination = document.getElementById('disp-dest')?.value.trim();
  const address = document.getElementById('disp-address')?.value.trim();
  const date = document.getElementById('disp-date')?.value;
  const invoiceRef = document.getElementById('disp-invoice-ref')?.value || '';
  const driver = document.getElementById('disp-driver')?.value.trim() || '';
  const driverId = document.getElementById('disp-driver-id')?.value.trim() || '';
  const plate = document.getElementById('disp-plate')?.value.trim() || '';
  const notes = document.getElementById('disp-notes')?.value.trim() || '';

  if (!destination || !address) {
    showToast('❌ Destinatario y dirección de entrega son obligatorios', 'error');
    return;
  }

  const rows = document.querySelectorAll('.disp-item-row');
  const items = [];
  rows.forEach(r => {
    const desc = r.querySelector('.d-desc')?.value.trim();
    const qty = parseFloat(r.querySelector('.d-qty')?.value) || 0;
    const unit = r.querySelector('.d-unit')?.value || 'lb';
    const packages = r.querySelector('.d-packages')?.value.trim() || '';
    if (desc && qty > 0) {
      items.push({ desc, qty, unit, packages });
    }
  });

  if (items.length === 0) {
    showToast('❌ Agrega los materiales a despachar', 'error');
    return;
  }

  const p = getModuleParams('despachos');
  const dispatch = {
    id: `${p.prefix || 'DESP-'}${Date.now().toString().slice(-6)}`,
    destination, address, date, invoiceRef,
    driver, driverId, plate, notes,
    items,
    createdAt: new Date().toISOString()
  };

  saveDispatch(dispatch);
  showToast(`✅ Conduce ${dispatch.id} registrado con éxito`, 'success');
  initDispatchesView();
}

function printDispatchPDF(dispatchId) {
  const dispatches = getAllDispatches();
  const d = dispatches.find(item => item.id === dispatchId);
  if (!d) return;
  if (typeof generateDispatchPDF === 'function') {
    generateDispatchPDF(d);
  } else {
    showToast('📄 Preparando conduce de entrega...', 'info');
  }
}

function deleteDispatch(dispatchId) {
  if (!confirm(`¿Eliminar el conduce ${dispatchId}?`)) return;
  const list = getAllDispatches().filter(d => d.id !== dispatchId);
  localStorage.setItem(userKey('recim_dispatches'), JSON.stringify(list));
  initDispatchesView();
  showToast('Conduce eliminado', 'info');
}

function autofillDispatchClient(clientId) {
  const destInput = document.getElementById('disp-dest');
  const addrInput = document.getElementById('disp-address');
  if (!destInput) return;
  if (!clientId) {
    destInput.value = '';
    if (addrInput) addrInput.value = '';
    return;
  }
  const clients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
  const client = clients.find(c => c.id === clientId);
  if (client) {
    destInput.value = client.name || '';
    if (addrInput && client.address) addrInput.value = client.address;
  }
}
window.autofillDispatchClient = autofillDispatchClient;

function autofillDispatchFromInvoice(invoiceId) {
  if (!invoiceId) return;
  const invoices = getAllInvoices();
  const inv = invoices.find(i => i.id === invoiceId);
  if (inv) {
    const dest = document.getElementById('disp-dest');
    const addr = document.getElementById('disp-address');
    if (dest) dest.value = inv.company || '';
    if (addr && inv.address) addr.value = inv.address;
    const sel = document.getElementById('disp-client-select');
    if (sel && inv.company) {
      const opt = Array.from(sel.options).find(o => o.text.startsWith(inv.company));
      if (opt) sel.value = opt.value;
    }
  }
}
window.autofillDispatchFromInvoice = autofillDispatchFromInvoice;

// =============================================
// 7. BLOQUE DE DEVOLUCIONES
// =============================================

function getAllReturns() {
  return JSON.parse(localStorage.getItem(userKey('recim_returns')) || '[]');
}

function saveReturn(retDoc) {
  const list = getAllReturns();
  list.unshift(retDoc);
  localStorage.setItem(userKey('recim_returns'), JSON.stringify(list));
  if (typeof window.forceSync === 'function') {
    try { window.forceSync(); } catch (_) {}
  }
}

function initReturnsView() {
  const container = document.getElementById('fac-tab-devoluciones');
  if (!container) return;

  const p = getModuleParams('devoluciones');
  const returns = getAllReturns();
  const invoices = getAllInvoices();
  const clients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');

  let clientOptions = `<option value="">-- Seleccionar cliente / proveedor o ingresar manualmente --</option>`;
  clients.forEach(c => {
    clientOptions += `<option value="${c.id}">${c.name} ${c.nit ? '(' + c.nit + ')' : ''}</option>`;
  });

  const clientsDatalistHtml = `<datalist id="ret-clients-datalist">${clients.map(c => `<option value="${c.name}"></option>`).join('')}</datalist>`;

  container.innerHTML = `
    ${clientsDatalistHtml}
    <div class="card" style="max-width: 960px; margin: 0 auto;">
      <div class="card-header">
        <div>
          <h3 class="card-title">↩️ Devoluciones de Mercancía</h3>
          <p class="card-subtitle">Control y registro de material devuelto con opción de Nota de Crédito</p>
        </div>
      </div>

      <div style="background: var(--clr-surface-2); padding: 18px; border-radius: var(--r-md); border: 1px solid var(--clr-border); margin-bottom: 25px;">
        <h4 style="margin-top: 0; margin-bottom: 12px; color: var(--clr-text);">Registrar Nueva Devolución</h4>

        <!-- Selección de Cliente Rápido -->
        <div class="form-row" style="margin-bottom: 15px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">${t('inv.select_client', 'Seleccionar Cliente / Proveedor Registrado')}</label>
            <select id="ret-client-select" class="form-select" onchange="autofillReturnClient(this.value)">
              ${clientOptions}
            </select>
          </div>
        </div>

        <div class="form-row" style="grid-template-columns: 2fr 1fr;">
          <div class="form-group">
            <label class="form-label">Cliente / Proveedor <span style="color: #ef4444;">*</span></label>
            <input id="ret-client" type="text" class="form-input" list="ret-clients-datalist" placeholder="Nombre de quien devuelve" />
          </div>
          <div class="form-group">
            <label class="form-label">Factura de Referencia</label>
            <select id="ret-invoice-ref" class="form-select" onchange="autofillReturnFromInvoice(this.value)">
              <option value="">-- Seleccionar Factura --</option>
              ${invoices.map(inv => `<option value="${inv.id}">${inv.id} – ${inv.company}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row" style="grid-template-columns: 1fr 1fr 1fr;">
          <div class="form-group">
            <label class="form-label">Fecha de Devolución</label>
            <input id="ret-date" type="date" class="form-input" value="${new Date().toISOString().split('T')[0]}" />
          </div>
          <div class="form-group">
            <label class="form-label">Motivo Legal</label>
            <select id="ret-reason" class="form-select">
              <option value="Material dañado o contaminado">Material dañado o contaminado</option>
              <option value="Diferencia de peso / merma excesiva">Diferencia de peso / merma</option>
              <option value="Error en pedido o despacho">Error en pedido o despacho</option>
              <option value="Calidad no conforme">Calidad no conforme</option>
              <option value="Otro">Otro motivo</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Disposición del Material</label>
            <select id="ret-disposition" class="form-select">
              <option value="Reingreso a Inventario">📥 Reingreso a Inventario</option>
              <option value="Baja / Merma Irrecuperable">🗑️ Baja / Merma</option>
              <option value="Reemplazo al Cliente">🔄 Reemplazo inmediato</option>
            </select>
          </div>
        </div>

        <div class="form-row" style="grid-template-columns: 2fr 1fr 1fr;">
          <div class="form-group">
            <label class="form-label">Material Devuelto</label>
            <input id="ret-material" type="text" class="form-input" placeholder="Descripción del material" />
          </div>
          <div class="form-group">
            <label class="form-label">Cantidad</label>
            <input id="ret-qty" type="number" class="form-input" min="0.01" step="0.01" placeholder="Ej: 50" />
          </div>
          <div class="form-group">
            <label class="form-label">Unidad</label>
            <select id="ret-unit" class="form-select">
              <option value="lb">lb</option>
              <option value="kg">kg</option>
              <option value="ton">ton</option>
              <option value="ud">ud</option>
            </select>
          </div>
        </div>

        <div class="form-row" style="grid-template-columns: 1fr;">
          <div class="form-group">
            <label class="form-label">Notas Adicionales</label>
            <input id="ret-notes" type="text" class="form-input" placeholder="Detalles de la inspección" />
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; flex-wrap: wrap; gap: 10px;">
          <label style="font-size: 0.85rem; color: var(--clr-text); cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <input type="checkbox" id="ret-gen-nc" checked style="cursor: pointer;" />
            Crear Nota de Crédito automática al guardar
          </label>
          <button class="btn-primary" onclick="handleSaveReturn()" type="button">↩️ Registrar Devolución</button>
        </div>
      </div>

      <!-- Listado de Devoluciones -->
      <h4 style="margin-bottom: 12px; color: var(--clr-text);">Historial de Devoluciones</h4>
      <div style="overflow-x: auto;">
        <table class="table" style="width: 100%;">
          <thead>
            <tr>
              <th>Devolución #</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Material</th>
              <th>Motivo</th>
              <th>Disposición</th>
            </tr>
          </thead>
          <tbody>
            ${returns.length === 0 ? `
              <tr><td colspan="6" style="text-align: center; color: var(--clr-text-muted); padding: 20px;">No hay devoluciones registradas.</td></tr>
            ` : returns.map(r => `
              <tr>
                <td><b>${r.id}</b></td>
                <td>${r.date}</td>
                <td>${r.client}</td>
                <td>${r.material} (${r.qty} ${r.unit})</td>
                <td>${r.reason}</td>
                <td><span class="badge">${r.disposition}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function autofillReturnClient(clientId) {
  const clientInput = document.getElementById('ret-client');
  if (!clientInput) return;
  if (!clientId) {
    clientInput.value = '';
    return;
  }
  const clients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
  const client = clients.find(c => c.id === clientId);
  if (client) {
    clientInput.value = client.name || '';
  }
}
window.autofillReturnClient = autofillReturnClient;

function autofillReturnFromInvoice(invoiceId) {
  if (!invoiceId) return;
  const invoices = getAllInvoices();
  const inv = invoices.find(i => i.id === invoiceId);
  if (inv) {
    document.getElementById('ret-client').value = inv.company || '';
    const sel = document.getElementById('ret-client-select');
    if (sel && inv.company) {
      const opt = Array.from(sel.options).find(o => o.text.startsWith(inv.company));
      if (opt) sel.value = opt.value;
    }
    if (inv.items && inv.items.length > 0) {
      document.getElementById('ret-material').value = inv.items[0].desc || '';
      document.getElementById('ret-qty').value = inv.items[0].qty || '';
      document.getElementById('ret-unit').value = inv.items[0].unit || 'lb';
    }
  }
}

function handleSaveReturn() {
  const client = document.getElementById('ret-client')?.value.trim();
  const date = document.getElementById('ret-date')?.value;
  const invoiceRef = document.getElementById('ret-invoice-ref')?.value || '';
  const reason = document.getElementById('ret-reason')?.value || '';
  const disposition = document.getElementById('ret-disposition')?.value || '';
  const material = document.getElementById('ret-material')?.value.trim();
  const qty = parseFloat(document.getElementById('ret-qty')?.value) || 0;
  const unit = document.getElementById('ret-unit')?.value || 'lb';
  const notes = document.getElementById('ret-notes')?.value.trim() || '';
  const genNc = document.getElementById('ret-gen-nc')?.checked;

  if (!client || !material || qty <= 0) {
    showToast('❌ Completa el cliente, material y cantidad devuelta', 'error');
    return;
  }

  const p = getModuleParams('devoluciones');
  const retDoc = {
    id: `${p.prefix || 'DEV-'}${Date.now().toString().slice(-6)}`,
    client, date, invoiceRef, reason, disposition,
    material, qty, unit, notes,
    createdAt: new Date().toISOString()
  };

  saveReturn(retDoc);
  showToast(`✅ Devolución ${retDoc.id} registrada`, 'success');

  if (genNc) {
    if (typeof navigate === 'function') {
      navigate('nota_credito');
      setTimeout(() => {
        renderCreditNotesPage(document.getElementById('page-nota_credito'), {
          client,
          invoiceRef,
          reason: '01: Devolución total de bienes',
          concept: `Devolución ${retDoc.id}: ${material} (${qty} ${unit})`
        });
      }, 50);
      showToast('📄 Formulario de Nota de Crédito precargado', 'info');
    }
  } else {
    initReturnsView();
  }
}

// =============================================
// 8. BLOQUE DE NOTAS DE CRÉDITO (NCF B04 - DGII)
// =============================================

function getAllCreditNotes() {
  return JSON.parse(localStorage.getItem(userKey('recim_credit_notes')) || '[]');
}

function saveCreditNote(cn) {
  const list = getAllCreditNotes();
  list.unshift(cn);
  localStorage.setItem(userKey('recim_credit_notes'), JSON.stringify(list));
  if (typeof window.forceSync === 'function') {
    try { window.forceSync(); } catch (_) {}
  }
}

function initCreditNotesView(prefill = null, targetContainer = null) {
  const container = targetContainer || document.getElementById('credit-notes-content') || document.getElementById('page-nota_credito') || document.getElementById('fac-tab-nota_credito');
  if (!container) return;

  const notes = getAllCreditNotes();
  const invoices = getAllInvoices();
  const ncfInfo = getNextNcfInfo('B04');
  const clients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');

  let clientOptions = `<option value="">-- Seleccionar cliente o ingresar manualmente --</option>`;
  clients.forEach(c => {
    clientOptions += `<option value="${c.id}">${c.name} ${c.nit ? '(' + c.nit + ')' : ''}</option>`;
  });

  const clientsDatalistHtml = `<datalist id="cn-clients-datalist">${clients.map(c => `<option value="${c.name}">${c.nit ? c.nit : ''}</option>`).join('')}</datalist>`;

  container.innerHTML = `
    ${clientsDatalistHtml}
    <div class="card" style="max-width: 960px; margin: 0 auto;">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <h3 class="card-title">📄 Notas de Crédito (NCF B04)</h3>
          <p class="card-subtitle">Modificación y reducción de valor de facturas según normativa DGII</p>
        </div>
        <button class="btn-secondary" onclick="openParametrizacionesModal('nota_credito')" style="margin: 0; padding: 7px 14px; font-size: 0.85rem;" type="button">
          ⚙️ Parametrizaciones B04
        </button>
      </div>

      <!-- Alerta si faltan comprobantes de la secuencia autorizada -->
      ${ncfInfo.exhausted ? `
        <div class="ncf-danger-banner">
          🚨 <b>Secuencia Agotada:</b> Se han terminado los NCF B04 autorizados. Configura un nuevo rango en <b>Parametrizaciones</b>.
        </div>
      ` : (ncfInfo.remaining !== null && ncfInfo.remaining <= 10 ? `
        <div class="ncf-alert-banner">
          ⚠️ <b>Aviso DGII:</b> Solo quedan <b>${ncfInfo.remaining}</b> comprobante(s) de Nota de Crédito (B04). Se recomienda solicitar un nuevo lote a la DGII.
        </div>
      ` : '')}

      <div style="background: var(--clr-surface-2); padding: 18px; border-radius: var(--r-md); border: 1px solid var(--clr-border); margin-bottom: 25px;">
        <h4 style="margin-top: 0; margin-bottom: 12px; color: var(--clr-text);">Emitir Nota de Crédito</h4>

        <div class="form-row" style="grid-template-columns: 1fr 1fr;">
          <div class="form-group">
            <label class="form-label">Factura Afectada / Modificada (Exigido por DGII) <span style="color: #ef4444;">*</span></label>
            <select id="cn-invoice-ref" class="form-select" onchange="autofillCreditNoteFromInvoice(this.value)">
              <option value="">-- Seleccionar Factura Original --</option>
              ${invoices.map(inv => `<option value="${inv.id}" ${prefill?.invoiceRef === inv.id ? 'selected' : ''}>${inv.id} – ${inv.company} ${inv.ncf ? '(' + inv.ncf + ')' : ''}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">NCF Modificado (Original)</label>
            <input id="cn-ncf-modified" type="text" class="form-input" placeholder="NCF de la factura original" />
          </div>
        </div>

        <!-- Selección de Cliente Rápido -->
        <div class="form-row" style="margin-bottom: 15px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">${t('inv.select_client', 'Seleccionar Cliente Registrado')}</label>
            <select id="cn-client-select" class="form-select" onchange="autofillCreditNoteClient(this.value)">
              ${clientOptions}
            </select>
          </div>
        </div>

        <div class="form-row" style="grid-template-columns: 2fr 1fr;">
          <div class="form-group">
            <label class="form-label">Cliente / Razón Social <span style="color: #ef4444;">*</span></label>
            <input id="cn-client" type="text" class="form-input" list="cn-clients-datalist" value="${prefill?.client || ''}" placeholder="Nombre del cliente" />
          </div>
          <div class="form-group">
            <label class="form-label">RNC / Cédula</label>
            <input id="cn-nit" type="text" class="form-input" placeholder="RNC del cliente" />
          </div>
        </div>

        <div class="form-row" style="grid-template-columns: 1fr 1fr 1fr;">
          <div class="form-group">
            <label class="form-label">NCF Nota de Crédito (B04)</label>
            <input id="cn-ncf" type="text" class="form-input" value="${ncfInfo.ncf || ''}" placeholder="Ej: B0400000001 (Opcional)" />
          </div>
          <div class="form-group">
            <label class="form-label">Fecha de Emisión</label>
            <input id="cn-date" type="date" class="form-input" value="${new Date().toISOString().split('T')[0]}" />
          </div>
          <div class="form-group">
            <label class="form-label">Motivo Legal DGII</label>
            <select id="cn-reason" class="form-select">
              <option value="01: Devolución total de bienes">01: Devolución total de bienes</option>
              <option value="02: Devolución parcial de bienes">02: Devolución parcial de bienes</option>
              <option value="03: Descuento o rebaja en precio">03: Descuento o rebaja en precio</option>
              <option value="04: Anulación de factura">04: Anulación de factura</option>
              <option value="05: Corrección de texto">05: Corrección de texto</option>
            </select>
          </div>
        </div>

        <div class="form-row" style="grid-template-columns: 2fr 1fr 1fr;">
          <div class="form-group">
            <label class="form-label">Concepto del Crédito <span style="color: #ef4444;">*</span></label>
            <input id="cn-concept" type="text" class="form-input" value="${prefill?.concept || ''}" placeholder="Motivo o detalle del ajuste" />
          </div>
          <div class="form-group">
            <label class="form-label">Subtotal a Acreditar <span style="color: #ef4444;">*</span></label>
            <input id="cn-subtotal" type="number" class="form-input" min="0" step="0.01" oninput="calcCreditNoteTotals()" placeholder="0.00" />
          </div>
          <div class="form-group">
            <label class="form-label">ITBIS (18%)</label>
            <input id="cn-itbis" type="number" class="form-input" min="0" step="0.01" value="0" placeholder="0.00" />
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px;">
          <div id="cn-total-display" style="font-size: 1.15rem; font-weight: 700; color: #ef4444;">Total a Acreditar: ${formatMoney(0)}</div>
          <button class="btn-primary" onclick="handleSaveCreditNote()" type="button">📄 Emitir Nota de Crédito</button>
        </div>
      </div>

      <!-- Listado de Notas de Crédito -->
      <h4 style="margin-bottom: 14px; color: var(--clr-text); font-weight: 700; font-size: 1.05rem;">Historial de Notas de Crédito</h4>
      <div class="table-responsive">
        <table class="table" style="width: 100%; min-width: 680px;">
          <thead>
            <tr>
              <th style="width: 15%;">NC #</th>
              <th style="width: 15%;">NCF</th>
              <th style="width: 25%;">Factura Modificada</th>
              <th style="width: 20%;">Cliente</th>
              <th style="width: 15%;">Monto Total</th>
              <th style="width: 10%; text-align: center;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${notes.length === 0 ? `
              <tr>
                <td colspan="6" class="table-empty-td">
                  <div class="table-empty-card">
                    <div class="empty-icon-bubble">📄</div>
                    <h4 class="empty-title">Sin Notas de Crédito Registradas</h4>
                    <p class="empty-desc">Las notas de crédito emitidas para anular o ajustar facturas comerciales aparecerán aquí con su NCF correspondiente.</p>
                  </div>
                </td>
              </tr>
            ` : notes.map(n => `
              <tr>
                <td><b>${n.id}</b></td>
                <td><span class="badge" style="background:#ef4444; color:white;">${n.ncf || 'Interna'}</span></td>
                <td>${n.invoiceRef || '—'} ${n.ncfModified ? '(' + n.ncfModified + ')' : ''}</td>
                <td>${n.client}</td>
                <td style="font-weight: 700; color: #ef4444;">-${formatMoney(n.total)}</td>
                <td style="text-align: center;">
                  <div style="display: flex; gap: 6px; justify-content: center;">
                    <button class="btn-secondary" onclick="printCreditNotePDF('${n.id}')" title="Descargar PDF" style="padding: 6px 10px; font-size: 0.85rem;">📄</button>
                    <button class="btn-danger" onclick="deleteCreditNote('${n.id}')" title="Eliminar" style="padding: 6px 10px; font-size: 0.85rem;">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  if (prefill?.invoiceRef) {
    autofillCreditNoteFromInvoice(prefill.invoiceRef);
  }
}

function autofillCreditNoteClient(clientId) {
  const clientInput = document.getElementById('cn-client');
  const nitInput = document.getElementById('cn-nit');
  if (!clientInput) return;
  if (!clientId) {
    clientInput.value = '';
    if (nitInput) nitInput.value = '';
    return;
  }
  const clients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
  const client = clients.find(c => c.id === clientId);
  if (client) {
    clientInput.value = client.name || '';
    if (nitInput) nitInput.value = client.nit || '';
  }
}
window.autofillCreditNoteClient = autofillCreditNoteClient;

function autofillCreditNoteFromInvoice(invoiceId) {
  if (!invoiceId) return;
  const invoices = getAllInvoices();
  const inv = invoices.find(i => i.id === invoiceId);
  if (inv) {
    document.getElementById('cn-client').value = inv.company || '';
    document.getElementById('cn-nit').value = inv.nit || '';
    document.getElementById('cn-ncf-modified').value = inv.ncf || inv.id;
    document.getElementById('cn-subtotal').value = inv.subtotal || inv.total || '';
    const sel = document.getElementById('cn-client-select');
    if (sel && inv.company) {
      const opt = Array.from(sel.options).find(o => o.text.startsWith(inv.company));
      if (opt) sel.value = opt.value;
    }
    calcCreditNoteTotals();
  }
}

function calcCreditNoteTotals() {
  const sub = parseFloat(document.getElementById('cn-subtotal')?.value) || 0;
  const itbisInput = document.getElementById('cn-itbis');
  const itbis = Math.round(sub * 0.18 * 100) / 100;
  if (itbisInput && !itbisInput.dataset.manual) {
    itbisInput.value = itbis;
  }
  const currentItbis = parseFloat(itbisInput?.value) || 0;
  const total = sub + currentItbis;
  const display = document.getElementById('cn-total-display');
  if (display) display.textContent = `Total a Acreditar: -${formatMoney(total)}`;
}

function handleSaveCreditNote() {
  const invoiceRef = document.getElementById('cn-invoice-ref')?.value;
  const ncfModified = document.getElementById('cn-ncf-modified')?.value.trim();
  const client = document.getElementById('cn-client')?.value.trim();
  const nit = document.getElementById('cn-nit')?.value.trim();
  const ncf = document.getElementById('cn-ncf')?.value.trim();
  const date = document.getElementById('cn-date')?.value;
  const reason = document.getElementById('cn-reason')?.value;
  const concept = document.getElementById('cn-concept')?.value.trim();
  const subtotal = parseFloat(document.getElementById('cn-subtotal')?.value) || 0;
  const itbis = parseFloat(document.getElementById('cn-itbis')?.value) || 0;
  const total = subtotal + itbis;

  if (!client || !concept || total <= 0) {
    showToast('❌ Completa el cliente, concepto y monto a acreditar', 'error');
    return;
  }

  const cn = {
    id: `NC-${Date.now().toString().slice(-6)}`,
    ncfType: 'B04',
    ncf,
    invoiceRef, ncfModified,
    client, nit, date, reason, concept,
    subtotal, itbis, total,
    createdAt: new Date().toISOString()
  };

  saveCreditNote(cn);

  // Consumir NCF de la secuencia autorizada
  if (ncf && ncf.startsWith('B04')) {
    consumeNcfSequence('B04');
  }

  // Registrar egreso / ajuste en finanzas
  if (typeof addFinanceEntry === 'function') {
    addFinanceEntry('egreso', {
      concept: `Nota de Crédito ${cn.id} a ${cn.invoiceRef || 'Factura'} (${cn.client})`,
      amount: total, date, category: 'Devoluciones / Descuentos', ref: cn.id
    });
  }

  showToast(`✅ Nota de Crédito ${cn.id} emitida exitosamente`, 'success');
  initCreditNotesView();
}

function printCreditNotePDF(cnId) {
  const notes = getAllCreditNotes();
  const cn = notes.find(n => n.id === cnId);
  if (!cn) return;
  if (typeof generateCreditNotePDF === 'function') {
    generateCreditNotePDF(cn);
  } else {
    showToast('📄 Preparando Nota de Crédito...', 'info');
  }
}

function deleteCreditNote(cnId) {
  if (!confirm(`¿Eliminar la Nota de Crédito ${cnId}?`)) return;
  const list = getAllCreditNotes().filter(n => n.id !== cnId);
  localStorage.setItem(userKey('recim_credit_notes'), JSON.stringify(list));
  initCreditNotesView();
  showToast('Nota de Crédito eliminada', 'info');
}

// =============================================
// 9. BLOQUE DE NOTAS DE DÉBITO (NCF B03 - DGII)
// =============================================

function getAllDebitNotes() {
  return JSON.parse(localStorage.getItem(userKey('recim_debit_notes')) || '[]');
}

function saveDebitNote(dn) {
  const list = getAllDebitNotes();
  list.unshift(dn);
  localStorage.setItem(userKey('recim_debit_notes'), JSON.stringify(list));
  if (typeof window.forceSync === 'function') {
    try { window.forceSync(); } catch (_) {}
  }
}

function initDebitNotesView(targetContainer = null) {
  const container = targetContainer || document.getElementById('debit-notes-content') || document.getElementById('page-nota_debito') || document.getElementById('fac-tab-nota_debito');
  if (!container) return;

  const notes = getAllDebitNotes();
  const invoices = getAllInvoices();
  const ncfInfo = getNextNcfInfo('B03');
  const clients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');

  let clientOptions = `<option value="">-- Seleccionar cliente o ingresar manualmente --</option>`;
  clients.forEach(c => {
    clientOptions += `<option value="${c.id}">${c.name} ${c.nit ? '(' + c.nit + ')' : ''}</option>`;
  });

  const clientsDatalistHtml = `<datalist id="dn-clients-datalist">${clients.map(c => `<option value="${c.name}">${c.nit ? c.nit : ''}</option>`).join('')}</datalist>`;

  container.innerHTML = `
    ${clientsDatalistHtml}
    <div class="card" style="max-width: 960px; margin: 0 auto;">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <h3 class="card-title">📑 Notas de Débito (NCF B03)</h3>
          <p class="card-subtitle">Recargos, intereses o aumentos de valor sobre facturas según normativa DGII</p>
        </div>
        <button class="btn-secondary" onclick="openParametrizacionesModal('nota_debito')" style="margin: 0; padding: 7px 14px; font-size: 0.85rem;" type="button">
          ⚙️ Parametrizaciones B03
        </button>
      </div>

      <!-- Alerta si faltan comprobantes de la secuencia autorizada -->
      ${ncfInfo.exhausted ? `
        <div class="ncf-danger-banner">
          🚨 <b>Secuencia Agotada:</b> Se han terminado los NCF B03 autorizados. Configura un nuevo rango en <b>Parametrizaciones</b>.
        </div>
      ` : (ncfInfo.remaining !== null && ncfInfo.remaining <= 10 ? `
        <div class="ncf-alert-banner">
          ⚠️ <b>Aviso DGII:</b> Solo quedan <b>${ncfInfo.remaining}</b> comprobante(s) de Nota de Débito (B03). Se recomienda solicitar un nuevo lote a la DGII.
        </div>
      ` : '')}

      <div style="background: var(--clr-surface-2); padding: 18px; border-radius: var(--r-md); border: 1px solid var(--clr-border); margin-bottom: 25px;">
        <h4 style="margin-top: 0; margin-bottom: 12px; color: var(--clr-text);">Emitir Nota de Débito</h4>

        <div class="form-row" style="grid-template-columns: 1fr 1fr;">
          <div class="form-group">
            <label class="form-label">Factura Afectada / Modificada (Exigido por DGII) <span style="color: #ef4444;">*</span></label>
            <select id="dn-invoice-ref" class="form-select" onchange="autofillDebitNoteFromInvoice(this.value)">
              <option value="">-- Seleccionar Factura Original --</option>
              ${invoices.map(inv => `<option value="${inv.id}">${inv.id} – ${inv.company} ${inv.ncf ? '(' + inv.ncf + ')' : ''}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">NCF Modificado (Original)</label>
            <input id="dn-ncf-modified" type="text" class="form-input" placeholder="NCF de la factura original" />
          </div>
        </div>

        <!-- Selección de Cliente Rápido -->
        <div class="form-row" style="margin-bottom: 15px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">${t('inv.select_client', 'Seleccionar Cliente Registrado')}</label>
            <select id="dn-client-select" class="form-select" onchange="autofillDebitNoteClient(this.value)">
              ${clientOptions}
            </select>
          </div>
        </div>

        <div class="form-row" style="grid-template-columns: 2fr 1fr;">
          <div class="form-group">
            <label class="form-label">Cliente / Razón Social <span style="color: #ef4444;">*</span></label>
            <input id="dn-client" type="text" class="form-input" list="dn-clients-datalist" placeholder="Nombre del cliente" />
          </div>
          <div class="form-group">
            <label class="form-label">RNC / Cédula</label>
            <input id="dn-nit" type="text" class="form-input" placeholder="RNC del cliente" />
          </div>
        </div>

        <div class="form-row" style="grid-template-columns: 1fr 1fr 1fr;">
          <div class="form-group">
            <label class="form-label">NCF Nota de Débito (B03)</label>
            <input id="dn-ncf" type="text" class="form-input" value="${ncfInfo.ncf || ''}" placeholder="Ej: B0300000001 (Opcional)" />
          </div>
          <div class="form-group">
            <label class="form-label">Fecha de Emisión</label>
            <input id="dn-date" type="date" class="form-input" value="${new Date().toISOString().split('T')[0]}" />
          </div>
          <div class="form-group">
            <label class="form-label">Motivo Legal</label>
            <select id="dn-reason" class="form-select">
              <option value="01: Intereses por mora">01: Intereses por mora</option>
              <option value="02: Aumento en precio de bienes">02: Aumento en precio de bienes</option>
              <option value="03: Fletes o transporte no incluidos">03: Fletes o transporte no incluidos</option>
              <option value="04: Otros cargos y ajustes">04: Otros cargos y ajustes</option>
            </select>
          </div>
        </div>

        <div class="form-row" style="grid-template-columns: 2fr 1fr 1fr;">
          <div class="form-group">
            <label class="form-label">Concepto del Cargo Adicional <span style="color: #ef4444;">*</span></label>
            <input id="dn-concept" type="text" class="form-input" placeholder="Ej: Interés mensual por retraso en pago" />
          </div>
          <div class="form-group">
            <label class="form-label">Subtotal <span style="color: #ef4444;">*</span></label>
            <input id="dn-subtotal" type="number" class="form-input" min="0" step="0.01" oninput="calcDebitNoteTotals()" placeholder="0.00" />
          </div>
          <div class="form-group">
            <label class="form-label">ITBIS (18%)</label>
            <input id="dn-itbis" type="number" class="form-input" min="0" step="0.01" value="0" placeholder="0.00" />
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px;">
          <div id="dn-total-display" style="font-size: 1.15rem; font-weight: 700; color: var(--clr-primary-light);">Total Débito Adicional: ${formatMoney(0)}</div>
          <button class="btn-primary" onclick="handleSaveDebitNote()" type="button">📑 Emitir Nota de Débito</button>
        </div>
      </div>

      <!-- Listado de Notas de Débito -->
      <h4 style="margin-bottom: 14px; color: var(--clr-text); font-weight: 700; font-size: 1.05rem;">Historial de Notas de Débito</h4>
      <div class="table-responsive">
        <table class="table" style="width: 100%; min-width: 680px;">
          <thead>
            <tr>
              <th style="width: 15%;">ND #</th>
              <th style="width: 15%;">NCF</th>
              <th style="width: 25%;">Factura Modificada</th>
              <th style="width: 20%;">Cliente</th>
              <th style="width: 15%;">Monto Total</th>
              <th style="width: 10%; text-align: center;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${notes.length === 0 ? `
              <tr>
                <td colspan="6" class="table-empty-td">
                  <div class="table-empty-card">
                    <div class="empty-icon-bubble">📑</div>
                    <h4 class="empty-title">Sin Notas de Débito Registradas</h4>
                    <p class="empty-desc">Las notas de débito emitidas para registrar cargos o ajustes positivos aparecerán aquí con su NCF correspondiente.</p>
                  </div>
                </td>
              </tr>
            ` : notes.map(n => `
              <tr>
                <td><b>${n.id}</b></td>
                <td><span class="badge" style="background:var(--clr-primary); color:white;">${n.ncf || 'Interna'}</span></td>
                <td>${n.invoiceRef || '—'} ${n.ncfModified ? '(' + n.ncfModified + ')' : ''}</td>
                <td>${n.client}</td>
                <td style="font-weight: 700; color: var(--clr-primary);">+${formatMoney(n.total)}</td>
                <td style="text-align: center;">
                  <div style="display: flex; gap: 6px; justify-content: center;">
                    <button class="btn-secondary" onclick="printDebitNotePDF('${n.id}')" title="Descargar PDF" style="padding: 6px 10px; font-size: 0.85rem;">📄</button>
                    <button class="btn-danger" onclick="deleteDebitNote('${n.id}')" title="Eliminar" style="padding: 6px 10px; font-size: 0.85rem;">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function autofillDebitNoteClient(clientId) {
  const clientInput = document.getElementById('dn-client');
  const nitInput = document.getElementById('dn-nit');
  if (!clientInput) return;
  if (!clientId) {
    clientInput.value = '';
    if (nitInput) nitInput.value = '';
    return;
  }
  const clients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
  const client = clients.find(c => c.id === clientId);
  if (client) {
    clientInput.value = client.name || '';
    if (nitInput) nitInput.value = client.nit || '';
  }
}
window.autofillDebitNoteClient = autofillDebitNoteClient;

function autofillDebitNoteFromInvoice(invoiceId) {
  if (!invoiceId) return;
  const invoices = getAllInvoices();
  const inv = invoices.find(i => i.id === invoiceId);
  if (inv) {
    document.getElementById('dn-client').value = inv.company || '';
    document.getElementById('dn-nit').value = inv.nit || '';
    document.getElementById('dn-ncf-modified').value = inv.ncf || inv.id;
    const sel = document.getElementById('dn-client-select');
    if (sel && inv.company) {
      const opt = Array.from(sel.options).find(o => o.text.startsWith(inv.company));
      if (opt) sel.value = opt.value;
    }
  }
}

function calcDebitNoteTotals() {
  const sub = parseFloat(document.getElementById('dn-subtotal')?.value) || 0;
  const itbisInput = document.getElementById('dn-itbis');
  const itbis = Math.round(sub * 0.18 * 100) / 100;
  if (itbisInput && !itbisInput.dataset.manual) {
    itbisInput.value = itbis;
  }
  const currentItbis = parseFloat(itbisInput?.value) || 0;
  const total = sub + currentItbis;
  const display = document.getElementById('dn-total-display');
  if (display) display.textContent = `Total Débito Adicional: +${formatMoney(total)}`;
}

function handleSaveDebitNote() {
  const invoiceRef = document.getElementById('dn-invoice-ref')?.value;
  const ncfModified = document.getElementById('dn-ncf-modified')?.value.trim();
  const client = document.getElementById('dn-client')?.value.trim();
  const nit = document.getElementById('dn-nit')?.value.trim();
  const ncf = document.getElementById('dn-ncf')?.value.trim();
  const date = document.getElementById('dn-date')?.value;
  const reason = document.getElementById('dn-reason')?.value;
  const concept = document.getElementById('dn-concept')?.value.trim();
  const subtotal = parseFloat(document.getElementById('dn-subtotal')?.value) || 0;
  const itbis = parseFloat(document.getElementById('dn-itbis')?.value) || 0;
  const total = subtotal + itbis;

  if (!client || !concept || total <= 0) {
    showToast('❌ Completa el cliente, concepto y monto a debitar', 'error');
    return;
  }

  const dn = {
    id: `ND-${Date.now().toString().slice(-6)}`,
    ncfType: 'B03',
    ncf,
    invoiceRef, ncfModified,
    client, nit, date, reason, concept,
    subtotal, itbis, total,
    createdAt: new Date().toISOString()
  };

  saveDebitNote(dn);

  if (ncf && ncf.startsWith('B03')) {
    consumeNcfSequence('B03');
  }

  if (typeof addFinanceEntry === 'function') {
    addFinanceEntry('ingreso', {
      concept: `Nota de Débito ${dn.id} a ${dn.invoiceRef || 'Factura'} (${dn.client})`,
      amount: total, date, category: 'Cargos e Intereses', ref: dn.id
    });
  }

  showToast(`✅ Nota de Débito ${dn.id} emitida exitosamente`, 'success');
  initDebitNotesView();
}

function printDebitNotePDF(dnId) {
  const notes = getAllDebitNotes();
  const dn = notes.find(n => n.id === dnId);
  if (!dn) return;
  if (typeof generateDebitNotePDF === 'function') {
    generateDebitNotePDF(dn);
  } else {
    showToast('📄 Preparando Nota de Débito...', 'info');
  }
}

function deleteDebitNote(dnId) {
  if (!confirm(`¿Eliminar la Nota de Débito ${dnId}?`)) return;
  const list = getAllDebitNotes().filter(n => n.id !== dnId);
  localStorage.setItem(userKey('recim_debit_notes'), JSON.stringify(list));
  initDebitNotesView();
  showToast('Nota de Débito eliminada', 'info');
}

// =============================================
// 10. ALMACENAMIENTO DE FACTURAS Y PÁGINA PRINCIPAL
// =============================================

function saveInvoice(invoice) {
  const invoices = getAllInvoices();
  invoices.unshift(invoice);
  localStorage.setItem(userKey('recim_invoices'), JSON.stringify(invoices));
  if (typeof window.forceSync === 'function') {
    try { window.forceSync(); } catch (_) {}
  }
}

function getAllInvoices() {
  return JSON.parse(localStorage.getItem(userKey('recim_invoices')) || '[]');
}

function getCompanyInfoForInvoices() {
  let settings = {};
  try {
    if (typeof getSettings === 'function') {
      settings = getSettings() || {};
    } else {
      settings = JSON.parse(localStorage.getItem('recim_settings') || '{}');
    }
  } catch (_) {}

  let rnc = settings.companyRNC || settings.rnc || settings.companyRnc || '';
  let name = settings.companyName || '';

  try {
    const sharedKey = typeof userKey === 'function' ? userKey('recim_company_shared_settings') : 'recim_company_shared_settings';
    const shared = JSON.parse(localStorage.getItem(sharedKey) || localStorage.getItem('recim_shared_company_settings') || '{}');
    if (shared.companyRNC) rnc = shared.companyRNC;
    if (shared.companyName) name = shared.companyName;
  } catch (_) {}

  if (!name) name = 'Reciminsa SRL';
  if (!rnc) rnc = '133250233';

  const clean = String(rnc).replace(/\D/g, '');
  let formattedRnc = clean;
  if (clean.length === 9) {
    formattedRnc = `${clean.slice(0, 3)}-${clean.slice(3, 8)}-${clean.slice(8)}`;
  } else if (clean.length === 11) {
    formattedRnc = `${clean.slice(0, 3)}-${clean.slice(3, 10)}-${clean.slice(10)}`;
  }

  return { rnc: clean, formattedRnc: formattedRnc || clean, name };
}

/**
 * Renderizador principal del Módulo de Facturación (6 Bloques)
 */
function renderInvoicesPage(container, initialTab = 'facturas') {
  const comp = getCompanyInfoForInvoices();

  container.innerHTML = `
    <div class="page-header" style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 12px;">
      <div>
        <h2 class="section-title">Facturación y Gestión Comercial</h2>
        <p class="section-subtitle">Cotizaciones, facturación unificada de venta, conduces y devoluciones</p>
      </div>
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="background: var(--clr-surface-2, #172017); border: 1px solid var(--clr-border, rgba(34, 197, 94, 0.2)); padding: 6px 14px; border-radius: 8px; display: flex; align-items: center; gap: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.25);">
          <span style="font-size: 1.15rem; line-height: 1;">🏢</span>
          <div style="text-align: right;">
            <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--clr-text-muted, #9ca3af); font-weight: 700; letter-spacing: 0.03em;">${comp.name}</div>
            <div style="display: flex; align-items: center; gap: 6px; justify-content: flex-end;">
              <span style="font-size: 0.72rem; color: var(--clr-text-secondary, #9ca3af); font-weight: 600;">RNC:</span>
              <code style="font-weight: 800; color: var(--clr-primary, #22c55e); font-size: 0.92rem; letter-spacing: 0.5px;">${comp.formattedRnc}</code>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Navegación de 4 Bloques -->
    <div class="invoice-tabs">
      <button class="invoice-tab fac-tab ${initialTab === 'cotizaciones' ? 'active' : ''}" id="fac-tab-btn-cotizaciones" onclick="switchFacturacionTab('cotizaciones')">
        <span class="invoice-tab-icon">📋</span> Cotizaciones
      </button>
      <button class="invoice-tab fac-tab ${initialTab === 'facturas' ? 'active' : ''}" id="fac-tab-btn-facturas" onclick="switchFacturacionTab('facturas')">
        <span class="invoice-tab-icon">🧾</span> Facturas
      </button>
      <button class="invoice-tab fac-tab ${initialTab === 'despachos' ? 'active' : ''}" id="fac-tab-btn-despachos" onclick="switchFacturacionTab('despachos')">
        <span class="invoice-tab-icon">🚚</span> Despachos
      </button>
      <button class="invoice-tab fac-tab ${initialTab === 'devoluciones' ? 'active' : ''}" id="fac-tab-btn-devoluciones" onclick="switchFacturacionTab('devoluciones')">
        <span class="invoice-tab-icon">↩️</span> Devoluciones
      </button>
    </div>

    <!-- Contenedores de cada Bloque -->
    <div id="fac-tab-cotizaciones" class="invoice-tab-content fac-tab-content ${initialTab === 'cotizaciones' ? 'active' : ''}"></div>
    <div id="fac-tab-facturas" class="invoice-tab-content fac-tab-content ${initialTab === 'facturas' ? 'active' : ''}"></div>
    <div id="fac-tab-despachos" class="invoice-tab-content fac-tab-content ${initialTab === 'despachos' ? 'active' : ''}"></div>
    <div id="fac-tab-devoluciones" class="invoice-tab-content fac-tab-content ${initialTab === 'devoluciones' ? 'active' : ''}"></div>
  `;

  // Cargar el tab inicial (si es nota de credito/debito, abrir facturas)
  const safeTab = (initialTab === 'nota_credito' || initialTab === 'nota_debito') ? 'facturas' : initialTab;
  switchFacturacionTab(safeTab);
}

// =============================================
// RENDERIZADO INDEPENDIENTE: NOTA DE CRÉDITO Y DÉBITO
// =============================================

function renderCreditNotesPage(container, prefill = null) {
  if (!container) container = document.getElementById('page-nota_credito');
  if (!container) return;

  container.innerHTML = `
    <div class="page-header" style="margin-bottom: 16px;">
      <div>
        <h2 class="section-title">Notas de Crédito (NCF B04)</h2>
        <p class="section-subtitle">Modificación y reducción de valor de facturas según normativa DGII</p>
      </div>
    </div>
    <div id="credit-notes-content"></div>
  `;

  initCreditNotesView(prefill, document.getElementById('credit-notes-content'));
}

function renderDebitNotesPage(container) {
  if (!container) container = document.getElementById('page-nota_debito');
  if (!container) return;

  container.innerHTML = `
    <div class="page-header" style="margin-bottom: 16px;">
      <div>
        <h2 class="section-title">Notas de Débito (NCF B03)</h2>
        <p class="section-subtitle">Recargos, intereses o aumentos de valor sobre facturas según normativa DGII</p>
      </div>
    </div>
    <div id="debit-notes-content"></div>
  `;

  initDebitNotesView(document.getElementById('debit-notes-content'));
}

// =============================================
// 11. MODAL POST-GUARDADO DE FACTURA
// =============================================

function showInvoicePostSaveModal(invoice) {
  let modal = document.getElementById('invoice-post-save-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'invoice-post-save-modal';
    modal.style = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.65); display:flex; align-items:center; justify-content:center; z-index:9999; backdrop-filter:blur(4px);';
    document.body.appendChild(modal);
  }

  modal.style.display = 'flex';
  const clientName = invoice.company || invoice.client || 'Consumidor Final';

  modal.innerHTML = `
    <div class="card" style="width:90%; max-width:420px; padding:24px; border-radius:12px; background:var(--clr-surface); border:1px solid var(--clr-border); box-shadow:0 10px 25px rgba(0,0,0,0.3); text-align:center; display:flex; flex-direction:column; gap:16px;">
      <div style="font-size:3rem; margin-bottom:4px;">🎉</div>
      <h3 style="margin:0; font-size:1.25rem; font-weight:700; color:var(--clr-text);">¡Factura Creada con Éxito!</h3>
      <p style="margin:0; font-size:0.85rem; color:var(--clr-text-muted);">
        Factura <b>${invoice.id}</b> para <b>${clientName}</b> ${invoice.ncf ? '<br><span class="badge" style="background:var(--clr-primary); color:white; margin-top:4px;">NCF: ' + invoice.ncf + '</span>' : ''}
      </p>
      
      <div style="display:flex; flex-direction:column; gap:10px; margin-top:8px;">
        <button class="btn-primary" onclick="window.closeInvoicePostSaveModal(); generateInvoicePDF(JSON.parse(decodeURIComponent('${encodeURIComponent(JSON.stringify(invoice))}')));" style="justify-content:center; padding:10px; font-weight:600; cursor:pointer;" type="button">
          📄 Descargar Factura en PDF
        </button>
        <button class="btn-secondary" onclick="window.closeInvoicePostSaveModal(); shareInvoiceViaWhatsApp('${invoice.id}');" style="justify-content:center; padding:10px; font-weight:600; background:#25d366; color:white; border-color:#25d366; cursor:pointer;" type="button">
          💬 Enviar por WhatsApp
        </button>
        <button class="btn-secondary" onclick="window.closeInvoicePostSaveModal();" style="justify-content:center; padding:10px; font-weight:600; color:var(--clr-text-secondary); cursor:pointer;" type="button">
          ✕ Cerrar
        </button>
      </div>
    </div>
  `;
}

window.closeInvoicePostSaveModal = function () {
  const modal = document.getElementById('invoice-post-save-modal');
  if (modal) modal.style.display = 'none';
};
window.showInvoicePostSaveModal = showInvoicePostSaveModal;

function showInvoiceDetailsModal(invoiceId) {
  const invoices = typeof getAllInvoices === 'function' ? getAllInvoices() : [];
  const inv = invoices.find(i => i.id === invoiceId);
  if (!inv) {
    showToast('Factura no encontrada', 'warning');
    return;
  }

  let ncfCode = inv.ncfType || '';
  if (!ncfCode && inv.ncf && typeof inv.ncf === 'string') {
    const match = inv.ncf.match(/^([BE]\d{2})/);
    if (match) ncfCode = match[1];
  }

  const ncfLabels = {
    'B01': 'B01 - Factura de Crédito Fiscal',
    'B02': 'B02 - Factura de Consumo (Consumidor Final)',
    'B03': 'B03 - Nota de Débito',
    'B04': 'B04 - Nota de Crédito',
    'B11': 'B11 - Registro de Proveedores Informales',
    'B12': 'B12 - Registro Único de Ingresos',
    'B13': 'B13 - Gastos Menores',
    'B14': 'B14 - Regímenes Especiales de Tributación',
    'B15': 'B15 - Comprobante Gubernamental',
    'B16': 'B16 - Comprobante para Exportaciones',
    'E31': 'E31 - Factura de Crédito Fiscal Electrónica',
    'E32': 'E32 - Factura de Consumo Electrónica',
    'E33': 'E33 - Nota de Débito Electrónica',
    'E34': 'E34 - Nota de Crédito Electrónica',
    'E41': 'E41 - Proveedores Informales Electrónico',
    'E44': 'E44 - Regímenes Especiales Electrónico',
    'E45': 'E45 - Comprobante Gubernamental Electrónico'
  };

  const voucherTypeLabel = ncfLabels[ncfCode] || inv.typeName || (inv.ncf ? `Comprobante ${inv.ncf}` : 'Factura Estándar (Sin Comprobante Fiscal)');

  let modal = document.getElementById('invoice-detail-quick-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'invoice-detail-quick-modal';
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal" style="max-width: 650px; width: 95%; background: linear-gradient(160deg, #101c13 0%, #0a110c 100%) !important; border: 1px solid rgba(34, 197, 94, 0.3) !important; border-radius: 14px; padding: 22px; color: var(--clr-text, #f0fdf0); box-shadow: 0 20px 50px rgba(0,0,0,0.85);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom: 1px solid rgba(34, 197, 94, 0.2); padding-bottom: 12px;">
        <h3 style="margin:0; font-size:1.2rem; color:var(--clr-text, #f0fdf0);">Detalles de Factura: <b>${inv.id}</b></h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="background:rgba(255,255,255,0.08); border:none; border-radius:50%; width:32px; height:32px; color:var(--clr-text-muted); font-size:1.1rem; cursor:pointer;" type="button">✕</button>
      </div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:16px; font-size:0.88rem; background: rgba(0,0,0,0.3); padding: 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
        <div><b style="color:var(--clr-text-muted);">Fecha:</b> ${inv.date || '—'}</div>
        <div><b style="color:var(--clr-text-muted);">Cliente / Razón Social:</b> <b>${inv.company || inv.client || '—'}</b></div>
        <div><b style="color:var(--clr-text-muted);">RNC / Cédula:</b> ${inv.nit || '—'}</div>
        <div><b style="color:var(--clr-text-muted);">Tipo de Comprobante:</b> <span class="badge badge--blue" style="font-weight:700;">${voucherTypeLabel}</span></div>
        <div><b style="color:var(--clr-text-muted);">NCF Asignado:</b> <code style="font-weight:800; color:var(--clr-primary-light, #4ade80); font-size:0.95rem;">${inv.ncf || '(Sin NCF)'}</code></div>
        <div><b style="color:var(--clr-text-muted);">Método de Pago:</b> ${inv.payMethod || 'Efectivo'}</div>
        <div><b style="color:var(--clr-text-muted);">Colaborador:</b> ${inv.collaborator || '—'}</div>
        <div><b style="color:var(--clr-text-muted);">Total Facturado:</b> <strong style="color:var(--clr-primary-light, #4ade80); font-size:1.05rem;">${formatMoney(inv.total || 0)}</strong></div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button class="btn-secondary" onclick="printInvoicePDF('${inv.id}')" type="button" style="padding:8px 16px;">📄 Imprimir PDF</button>
        <button class="btn-primary" onclick="this.closest('.modal-overlay').remove()" type="button" style="padding:8px 18px;">Cerrar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}
window.showInvoiceDetailsModal = showInvoiceDetailsModal;

// Compatibilidad retroactiva para cualquier llamada legacy
window.renderInvoicesPage = renderInvoicesPage;
window.saveInvoice = saveInvoice;
window.getAllInvoices = getAllInvoices;
window.openParametrizacionesModal = openParametrizacionesModal;
window.closeParametrizacionesModal = closeParametrizacionesModal;
window.showCrearSecuenciaView = showCrearSecuenciaView;
window.showVerSecuenciaView = showVerSecuenciaView;
window.onNcfFormSerieChange = onNcfFormSerieChange;
window.onNcfFormFromChange = onNcfFormFromChange;
window.saveNcfSequenceFromForm = saveNcfSequenceFromForm;
window.toggleNcfSequenceActive = toggleNcfSequenceActive;
window.deleteNcfSequence = deleteNcfSequence;
window.autoFillInvoiceByNameDGIIUnified = autoFillInvoiceByNameDGIIUnified;
window.switchFacturacionTab = switchFacturacionTab;
window.initUnifiedFacturaForm = initUnifiedFacturaForm;
window.getModuleParams = getModuleParams;
window.saveModuleParams = saveModuleParams;
window.renderCreditNotesPage = renderCreditNotesPage;
window.renderDebitNotesPage = renderDebitNotesPage;
window.initCreditNotesView = initCreditNotesView;
window.initDebitNotesView = initDebitNotesView;
