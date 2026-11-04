/* =============================================
   BITACORAS.JS – Bitácoras de Recogida (Facturas Básicas)
   Depends on: materials.js, i18n.js, excel-utils.js, invoices.js (for saveInvoice/getAllInvoices)
   ============================================= */

function switchBitacoraTab(tabName) {
  document.querySelectorAll('.bitacora-tab').forEach(t_ => t_.classList.remove('active'));
  document.querySelectorAll('.bitacora-tab-content').forEach(c => c.classList.remove('active'));
  const btn = document.getElementById(`bit-tab-btn-${tabName}`);
  const content = document.getElementById(`bit-tab-${tabName}`);
  if (btn) btn.classList.add('active');
  if (content) content.classList.add('active');
}

// =============================================
// TAB 1: CONTEO DE BITÁCORAS
// =============================================
function renderCountTab() {
  const invoices = getAllInvoices();
  const basicInvoices = invoices.filter(i => i.type === 'basica');

  const materialTotals = {};
  basicInvoices.forEach(inv => {
    (inv.items || []).forEach(item => {
      if (!materialTotals[item.matId]) {
        materialTotals[item.matId] = { name: item.name, icon: item.icon, qty: 0, peso: 0, subtotal: 0, count: 0 };
      }
      materialTotals[item.matId].qty += item.qty;
      materialTotals[item.matId].peso += (item.peso || 0);
      materialTotals[item.matId].subtotal += (item.totalCompra || 0);
      materialTotals[item.matId].count += 1;
    });
  });

  const rows = Object.entries(materialTotals).map(([id, m]) => `
    <tr>
      <td>${m.icon} ${m.name}</td>
      <td>${m.qty.toFixed(2)} [unidades/lb]</td>
      <td>${m.peso.toFixed(2)} kg</td>
      <td><span class="badge badge--green">${formatMoney(m.subtotal)}</span></td>
    </tr>
  `).join('');

  const grandTotal = basicInvoices.reduce((sum, i) => sum + (i.totalVenta || 0), 0);

  return `
    <div class="stats-grid" style="margin-bottom:24px;">
      <div class="stat-card">
        <div class="stat-label">Total Registros</div>
        <div class="stat-value stat-value--green">${basicInvoices.length}</div>
        <div class="stat-sub">Bitácoras creadas</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Invertido</div>
        <div class="stat-value stat-value--blue">${formatMoney(basicInvoices.reduce((s,i) => s + (i.totalCompra||0), 0))}</div>
        <div class="stat-sub">Costo de compra</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Proyectado (Venta)</div>
        <div class="stat-value stat-value--green">${formatMoney(grandTotal)}</div>
        <div class="stat-sub">Venta bruta estimada</div>
      </div>
    </div>

    <div style="display:flex; justify-content:flex-end; margin-bottom:16px;">
      <button class="btn-secondary" onclick="exportBitacorasListToExcel(getAllInvoices().filter(i => i.type === 'basica'))">
        📊 Exportar Bitácora a Excel
      </button>
    </div>

    ${rows.length > 0 ? `
    <div class="card">
      <h3 class="section-title" style="margin-bottom:16px;">${t('inv.count_by_mat')}</h3>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>${t('inv.col_mat')}</th>
              <th>Cant. Acumulada</th>
              <th>${t('inv.col_weight')}</th>
              <th>Costo Compra (Inversión)</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>` : `
    <div class="empty-state">
      <div class="empty-state-icon">📊</div>
      <p class="empty-state-text">No hay bitácoras registradas.<br>Crea un nuevo registro en <b>Crear Bitácora</b>.</p>
    </div>`}
  `;
}

// =============================================
// TAB 2: CREACIÓN DE BITÁCORAS
// =============================================
function renderBasicForm() {
  return `
    <div class="card" style="max-width: 950px; margin: 0 auto;">
      <div class="card-header">
        <h3 class="card-title">${t('inv.basic_title')}</h3>
        <p class="card-subtitle">${t('inv.basic_sub')}</p>
      </div>

      <div class="form-row" style="margin-bottom: 15px;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">${t('inv.select_client')}</label>
          <select id="basic-client-select" class="form-select" onchange="autofillBasicClient(this.value)">
            <option value="">-- Escribir datos manualmente --</option>
          </select>
        </div>
      </div>

      <div class="form-row" style="grid-template-columns: repeat(3, 1fr);">
        <div class="form-group">
          <label class="form-label">${t('lbl.client')}</label>
          <input id="basic-client" type="text" class="form-input" list="basic-clients-datalist" placeholder="Nombre completo" />
          <datalist id="basic-clients-datalist">
            ${(function() {
              const clients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
              return clients.map(c => `<option value="${c.name}">${c.nit ? c.nit : ''}</option>`).join('');
            })()}
          </datalist>
        </div>
        <div class="form-group">
          <label class="form-label">${t('lbl.invoice_date')}</label>
          <input id="basic-date" type="date" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('inv.collaborator')}</label>
          <select id="basic-colab" class="form-select">
            ${(function() {
              const colabs = JSON.parse(localStorage.getItem(userKey('recim_collaborators')) || '[]');
              let options = `<option value="">${t('inv.no_collaborator')}</option>`;
              colabs.forEach(c => {
                options += `<option value="${c.name}">${c.name} (${c.role})</option>`;
              });
              return options;
            })()}
          </select>
        </div>
      </div>

      <div class="bitacora-items-container" id="basic-items-entry-container" style="margin-top:20px;">
        <!-- Rows will be added here -->
      </div>

      <div style="margin-top:10px; display:flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
         <button class="btn-secondary" onclick="addBasicEntryRow()" style="margin-bottom:0;">
           ➕ ${t('lbl.add_material')}
         </button>
         <div id="basic-live-totals" style="text-align:right; font-weight:700; color:var(--clr-primary-light);">
           Total Estimado: RD$0.00
         </div>
      </div>

      <div class="form-group" style="margin-top:24px;">
        <label class="form-label">${t('lbl.extra_notes')}</label>
        <textarea id="basic-notes" class="form-input" style="height:80px;" placeholder="${t('lbl.notes')}..."></textarea>
      </div>

      <div style="display:flex; gap:10px; margin-top:30px;">
        <button class="btn-primary" onclick="saveBasicInvoiceBatch()" style="flex:2;">💾 Guardar Bitácora</button>
        <button class="btn-outline" onclick="initBasicForm()" style="flex:1;">${t('inv.clear_form')}</button>
      </div>
    </div>
  `;
}

function populateBasicClientSelect() {
  const select = document.getElementById('basic-client-select');
  if (!select) return;
  
  const clients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
  
  let options = `<option value="">-- Escribir datos manualmente --</option>`;
  clients.forEach(c => {
    const typeLabel = c.type === 'empresa' ? 'Empresa' : 'Persona';
    options += `<option value="${c.id}">${c.name} (${typeLabel}${c.nit ? ' - ' + c.nit : ''})</option>`;
  });
  
  select.innerHTML = options;
}

function autofillBasicClient(clientId) {
  const input = document.getElementById('basic-client');
  if (!input) return;
  
  if (!clientId) {
    input.value = '';
    return;
  }
  
  const clients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
  const client = clients.find(c => c.id === clientId);
  if (client) {
    input.value = client.name;
  }
}
window.autofillBasicClient = autofillBasicClient;

function initBasicForm() {
  const container = document.getElementById('bit-tab-crear');
  if (container) {
    container.innerHTML = renderBasicForm();
    addBasicEntryRow();
    const today = new Date().toISOString().split('T')[0];
    const el = document.getElementById('basic-date');
    if (el) el.value = today;
    populateBasicClientSelect();
  }
}

function addBasicEntryRow() {
  const container = document.getElementById('basic-items-entry-container');
  if (!container) return;

  const mats = getMaterialCodes();
  const options = mats.map(m => `<option value="${m.id}">${m.icon} ${m.name}</option>`).join('');

  const rowId = `row-${Date.now()}`;
  const isMobile = window.innerWidth < 768;
  
  const html = document.createElement('div');
  html.id = rowId;
  html.className = 'bitacora-row card';
  html.style.padding = '15px';
  html.style.marginBottom = '10px';
  html.style.background = 'var(--clr-surface-2)';
  html.style.border = '1px solid var(--clr-border)';
  
  html.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <h4 style="margin:0; font-size:14px; color:var(--clr-text-muted);">Ítem</h4>
      <button class="btn-icon" onclick="removeBasicEntryRow('${rowId}')" title="Eliminar" style="color:#ef4444;">✕</button>
    </div>
    <div class="form-row" style="grid-template-columns: ${isMobile ? '1fr' : '2fr 1fr'}; margin-bottom:10px;">
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label" style="font-size:12px;">Material</label>
        <select class="form-select row-mat" onchange="const m = getMaterialCodes().find(x=>x.id===this.value); const row = this.closest('.bitacora-row'); row.querySelector('.row-code').value = m?m.code:''; const prices = (typeof getMarketPrices === 'function') ? getMarketPrices() : {}; const mPrice = m ? (prices[m.code] || { purchase: 0, sell: 0 }) : { purchase: 0, sell: 0 }; row.querySelector('.row-pbuy').value = mPrice.purchase; row.querySelector('.row-psell').value = mPrice.sell; calculateBatchTotals()">
          <option value="" disabled selected>Seleccionar...</option>
          ${options}
        </select>
      </div>
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label" style="font-size:12px;">Código</label>
        <input type="text" class="form-input row-code" readonly style="background:var(--clr-surface); font-family:monospace; font-size:0.8rem;" />
      </div>
    </div>
    
    <div class="form-row" style="grid-template-columns: 1fr 1fr; margin-bottom:10px;">
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label" style="font-size:12px;">Cantidad / Peso</label>
        <input type="number" class="form-input row-qty" placeholder="0" min="0" step="0.01" oninput="calculateBatchTotals()" />
      </div>
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label" style="font-size:12px;">Unidad</label>
        <select class="form-select row-unit">
          <option value="lb" selected>libra</option>
          <option value="kg">kg</option>
          <option value="unidad">unidad</option>
          <option value="litros">litros</option>
          <option value="kilos">kilos</option>
        </select>
      </div>
    </div>

    <div class="form-row" style="grid-template-columns: 1fr 1fr;">
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label" style="font-size:12px;">Costo Compra (${getCurrency().symbol})</label>
        <input type="number" class="form-input row-pbuy" placeholder="0" min="0" step="0.1" oninput="calculateBatchTotals()" />
      </div>
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label" style="font-size:12px;">Prec. Venta (${getCurrency().symbol})</label>
        <input type="number" class="form-input row-psell" placeholder="0" min="0" step="0.1" oninput="calculateBatchTotals()" />
      </div>
    </div>
  `;
  
  container.appendChild(html);
  calculateBatchTotals();
}

function removeBasicEntryRow(id) {
  const row = document.getElementById(id);
  if (row) row.remove();
  calculateBatchTotals();
}

function calculateBatchTotals() {
  let totalB = 0;
  document.querySelectorAll('.bitacora-row').forEach(row => {
    const qty = parseFloat(row.querySelector('.row-qty').value) || 0;
    const pbuy = parseFloat(row.querySelector('.row-pbuy').value) || 0;
    const psell = parseFloat(row.querySelector('.row-psell').value) || 0;

    const subVenta = qty * psell;
    const subCompra = qty * pbuy;
    totalB += (subVenta - subCompra);
  });

  const label = document.getElementById('basic-live-totals');
  if (label) {
    label.textContent = `Balance Neto Estimado: ${formatMoney(totalB)}`;
    label.style.color = totalB >= 0 ? 'var(--clr-primary-light)' : '#f87171';
  }
}

async function saveBasicInvoiceBatch() {
  const rows = document.querySelectorAll('.bitacora-row');
  const items = [];
  const mats = getMaterialCodes();

  rows.forEach(tr => {
    const matId = tr.querySelector('.row-mat').value;
    const qty = parseFloat(tr.querySelector('.row-qty').value) || 0;
    const unit = tr.querySelector('.row-unit').value || 'lb';
    const pesoInput = tr.querySelector('.row-peso');
    let peso = 0;
    if (pesoInput) {
      peso = parseFloat(pesoInput.value) || 0;
    } else {
      if (unit === 'kg') peso = qty;
      else if (unit === 'lb') peso = qty * 0.453592;
    }
    const pbuy = parseFloat(tr.querySelector('.row-pbuy').value) || 0;
    const psell = parseFloat(tr.querySelector('.row-psell').value) || 0;

    if (qty > 0 && pbuy >= 0) {
      const mat = mats.find(m => m.id === matId) || { name: 'Desconocido', icon: '♻️' };
      const totalCompra = qty * pbuy;
      const totalVenta = qty * psell;
      items.push({
        id: Date.now() + Math.random(),
        matId, name: mat.name, icon: mat.icon,
        qty, peso, unit,
        priceBuy: pbuy, priceSell: psell,
        totalCompra, totalVenta, balance: totalVenta - totalCompra
      });
    }
  });

  if (items.length === 0) {
    showToast('❌ Agrega al menos un material con cantidad', 'error');
    return;
  }

  const clientSelect = document.getElementById('basic-client-select');
  const clientId = clientSelect ? clientSelect.value : '';
  const client = document.getElementById('basic-client').value.trim() || 'Cliente General';
  const date = document.getElementById('basic-date').value || new Date().toISOString().split('T')[0];
  const notes = document.getElementById('basic-notes').value.trim();
  const collaborator = document.getElementById('basic-colab')?.value || '';

  const totalC = items.reduce((s, i) => s + i.totalCompra, 0);
  const totalV = items.reduce((s, i) => s + i.totalVenta, 0);
  const balanceTotal = totalV - totalC;

  const invoice = {
    id: `BIT-${Date.now()}`,
    type: 'basica', typeName: 'Bitácora',
    client, clientId, date, notes,
    items,
    totalCompra: totalC,
    totalVenta: totalV,
    balance: balanceTotal,
    collaborator,
    createdAt: new Date().toISOString()
  };

  saveInvoice(invoice);

  // Finance entries: Las bitácoras representan compras/recogidas de materiales,
  // por lo que SOLO afectan egresos (costo de compra) y NO ingresos.
  if (totalC > 0) {
    addFinanceEntry('egreso', {
      concept: `Compra Bitácora: ${invoice.id} – ${client}`,
      amount: totalC, date, category: 'Materiales', ref: invoice.id
    });
  }

  showToast(`✅ Bitácora guardada ${invoice.id}`, 'success');
  initBasicForm();

  setTimeout(() => {
    if (confirm("¿Deseas descargar el Excel de este registro?")) {
      exportarExcelResiduos(invoice);
    }
  }, 800);
}


// =============================================
// RENDER BITACORAS PAGE (Reciminsa Ops v.js)
// Incluye Panel de Aprobación de Bitácoras enviadas por API desde Reciminsa Field
// =============================================
let _pendingFieldBitacoras = [];
let _fieldBitacorasPollInterval = null;

function renderBitacorasPage(container) {
  container.innerHTML = `
    <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div>
        <h2 class="section-title">${t('inv.bit_title')}</h2>
        <p class="section-subtitle">${t('inv.bit_subtitle')} — Recepción API Reciminsa Field & Control Supabase</p>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        <button class="btn-secondary" onclick="fetchFieldBitacorasForOpsPanel(true)" style="font-size:0.82rem; padding:8px 14px;">
          🔄 Sincronizar Bandeja API
        </button>
        <button class="btn-secondary" onclick="navigate('telemetria')" style="font-size:0.82rem; padding:8px 14px; border-color:rgba(16,185,129,0.4); color:#10b981;">
          🛰️ Ver Mapa GPS
        </button>
      </div>
    </div>

    <!-- PANEL DE BITÁCORAS ENVIADAS POR API DESDE RECIMINSA FIELD (PENDIENTES DE GUARDAR EN SUPABASE) -->
    <div id="ops-field-bitacoras-panel" class="card card--elevated" style="margin-bottom:24px; border:1px solid rgba(16,185,129,0.35); background:linear-gradient(180deg, rgba(16,185,129,0.06) 0%, rgba(15,23,42,0.4) 100%);">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:1.4rem;">📥</span>
          <div>
            <h3 style="margin:0; font-size:1.05rem; font-weight:700; color:var(--clr-text);">
              Panel de Bitácoras Recibidas por API (Reciminsa Field)
              <span id="ops-field-pending-badge" style="margin-left:8px; background:#f59e0b; color:#0a0f1d; font-size:0.75rem; padding:2px 8px; border-radius:999px; font-weight:800;">0 pendientes</span>
            </h3>
            <p style="margin:3px 0 0 0; font-size:0.78rem; color:var(--clr-text-muted);">
              🔒 Regla de seguridad v.js: Las bitácoras enviadas desde dispositivos de campo <strong>solo se guardan en Supabase</strong> cuando son revisadas y <strong>Aceptadas</strong> en este panel.
            </p>
          </div>
        </div>
      </div>

      <div id="ops-field-bitacoras-table-wrap">
        <div style="padding:18px; text-align:center; color:var(--clr-text-muted); font-size:0.85rem;">
          Cargando bitácoras recibidas desde la API de campo...
        </div>
      </div>
    </div>

    <div class="invoice-tabs">
      <button class="invoice-tab bitacora-tab active" id="bit-tab-btn-crear" onclick="switchBitacoraTab('crear')">
        ➕ Crear Bitácora Manual
      </button>
      <button class="invoice-tab bitacora-tab" id="bit-tab-btn-conteo" onclick="switchBitacoraTab('conteo'); refreshBitacoraCountTab()">
        📊 Conteo (Guardadas en Supabase)
      </button>
    </div>

    <div id="bit-tab-crear" class="invoice-tab-content bitacora-tab-content active">
      <!-- Initialized by initBasicForm -->
    </div>

    <div id="bit-tab-conteo" class="invoice-tab-content bitacora-tab-content">
      <div id="bitacora-count-inner"></div>
    </div>

    <div id="ops-field-bitacora-edit-modal-root"></div>
  `;

  initBasicForm();
  fetchFieldBitacorasForOpsPanel();

  if (_fieldBitacorasPollInterval) clearInterval(_fieldBitacorasPollInterval);
  _fieldBitacorasPollInterval = setInterval(() => {
    if (typeof getCurrentPage === 'function' && getCurrentPage() === 'bitacoras') {
      fetchFieldBitacorasForOpsPanel(false);
    }
  }, 5000);
}

function refreshBitacoraCountTab() {
  const inner = document.getElementById('bitacora-count-inner');
  if (inner) inner.innerHTML = renderCountTab();
}

function _getBitacorasOpsDbId() {
  try {
    const s = JSON.parse(localStorage.getItem('recim_session') || '{}');
    if (s.familyId) return `family_${s.familyId}`;
    return s.accountId || 'default';
  } catch (_) {
    return 'default';
  }
}

async function fetchFieldBitacorasForOpsPanel(showToastFeedback = false) {
  const wrap = document.getElementById('ops-field-bitacoras-table-wrap');
  const badge = document.getElementById('ops-field-pending-badge');
  if (!wrap) return;

  try {
    const dbId = _getBitacorasOpsDbId();
    const res = await fetch(`/api/v1/ops/fleet?db_id=${encodeURIComponent(dbId)}`);
    if (!res.ok) throw new Error('Error HTTP ' + res.status);
    const data = await res.json();
    const allBits = Array.isArray(data.bitacoras) ? data.bitacoras : [];

    // Mostrar las pendientes de aprobación (aún no guardadas en Supabase)
    _pendingFieldBitacoras = allBits.filter(b => b.estado_aprobacion !== 'ACEPTADA' && !b.guardado_en_supabase);

    if (badge) {
      badge.textContent = `${_pendingFieldBitacoras.length} pendiente${_pendingFieldBitacoras.length === 1 ? '' : 's'}`;
      badge.style.background = _pendingFieldBitacoras.length > 0 ? '#f59e0b' : 'rgba(16,185,129,0.2)';
      badge.style.color = _pendingFieldBitacoras.length > 0 ? '#0a0f1d' : '#10b981';
    }

    if (showToastFeedback) {
      showToast(`🔄 Bandeja API actualizada (${_pendingFieldBitacoras.length} pendientes)`, 'info');
    }

    renderOpsFieldBitacorasPanelTable();
  } catch (err) {
    wrap.innerHTML = `
      <div style="padding:16px; text-align:center; color:var(--clr-text-muted); font-size:0.84rem;">
        ⚠️ Servidor API local no detectado o sin bitácoras pendientes en cola.
      </div>
    `;
  }
}

function renderOpsFieldBitacorasPanelTable() {
  const wrap = document.getElementById('ops-field-bitacoras-table-wrap');
  if (!wrap) return;

  if (_pendingFieldBitacoras.length === 0) {
    wrap.innerHTML = `
      <div style="padding:20px; text-align:center; background:var(--clr-surface-2); border-radius:8px; border:1px dashed var(--clr-border); color:var(--clr-text-muted); font-size:0.85rem;">
        ✅ No hay bitácoras de campo pendientes de aprobación. Cuando un chofer envíe una bitácora desde <strong>Reciminsa Field</strong> aparecerá aquí para editarla, aceptarla (guardar en Supabase) o eliminarla.
      </div>
    `;
    return;
  }

  const rowsHtml = _pendingFieldBitacoras.map(b => {
    const fechaStr = b.timestamp_captura ? new Date(b.timestamp_captura).toLocaleString() : 'N/A';
    const peso = Number(b.peso_kg || 0).toFixed(2);
    const precio = Number(b.precio_referencia || 0).toFixed(2);
    const subtotal = (Number(b.peso_kg || 0) * Number(b.precio_referencia || 0)).toFixed(2);
    const gpsText = (b.latitud && b.longitud)
      ? `${Number(b.latitud).toFixed(4)}, ${Number(b.longitud).toFixed(4)}`
      : 'Sin GPS';

    return `
      <tr style="border-bottom:1px solid var(--clr-border);">
        <td style="padding:10px 12px; font-family:monospace; font-size:0.78rem; color:var(--clr-text-muted);">
          #${b.id}<br><span style="font-size:0.72rem;">${fechaStr}</span>
        </td>
        <td style="padding:10px 12px; font-weight:600;">
          👷 ${b.colaborador_nombre || 'Colaborador'}<br>
          <span style="font-size:0.72rem; color:var(--clr-text-muted);">📍 ${gpsText}</span>
        </td>
        <td style="padding:10px 12px;">
          🏢 ${b.cliente_nombre || 'Cliente General'}
        </td>
        <td style="padding:10px 12px; font-weight:700; color:var(--clr-primary-light);">
          ♻️ ${b.material_nombre || 'Material'}
        </td>
        <td style="padding:10px 12px; font-weight:700;">
          ${peso} ${b.unidad_medida || 'kg'}
        </td>
        <td style="padding:10px 12px; font-size:0.8rem;">
          RD$${precio}/${b.unidad_medida || 'kg'}<br>
          <strong style="color:#10b981;">Total: RD$${subtotal}</strong>
        </td>
        <td style="padding:10px 12px; font-size:0.78rem; color:var(--clr-text-secondary); max-width:180px; white-space:normal;">
          ${b.notas || '<span style="color:var(--clr-text-muted);">Sin notas</span>'}
        </td>
        <td style="padding:10px 12px; text-align:center;">
          <div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
            <button type="button" onclick="acceptFieldBitacora(${b.id})" style="background:#10b981; color:#06130d; border:none; border-radius:6px; padding:6px 10px; font-size:0.76rem; font-weight:800; cursor:pointer;" title="Aceptar y Guardar en Supabase">
              ✅ Aceptar
            </button>
            <button type="button" onclick="openEditFieldBitacoraModal(${b.id})" style="background:rgba(59,130,246,0.16); color:#60a5fa; border:1px solid rgba(59,130,246,0.35); border-radius:6px; padding:6px 10px; font-size:0.76rem; font-weight:700; cursor:pointer;" title="Editar antes de guardar en Supabase">
              ✏️ Editar
            </button>
            <button type="button" onclick="deleteFieldBitacora(${b.id})" style="background:rgba(239,68,68,0.16); color:#f87171; border:1px solid rgba(239,68,68,0.35); border-radius:6px; padding:6px 10px; font-size:0.76rem; font-weight:700; cursor:pointer;" title="Eliminar / Rechazar bitácora">
              🗑️ Eliminar
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  wrap.innerHTML = `
    <div style="overflow-x:auto; background:var(--clr-surface-2); border-radius:8px; border:1px solid var(--clr-border);">
      <table class="data-table" style="width:100%; min-width:780px; border-collapse:collapse; font-size:0.83rem;">
        <thead>
          <tr style="background:var(--clr-surface-3); border-bottom:1px solid var(--clr-border);">
            <th style="padding:10px 12px; text-align:left;">ID / Captura</th>
            <th style="padding:10px 12px; text-align:left;">Chofer / GPS</th>
            <th style="padding:10px 12px; text-align:left;">Cliente Origen</th>
            <th style="padding:10px 12px; text-align:left;">Material</th>
            <th style="padding:10px 12px; text-align:left;">Peso</th>
            <th style="padding:10px 12px; text-align:left;">Precio / Total</th>
            <th style="padding:10px 12px; text-align:left;">Notas</th>
            <th style="padding:10px 12px; text-align:center;">Acciones (Supabase)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

// Aceptar bitácora de campo -> Ahora sí se guarda en Supabase y en el registro oficial de Reciminsa Ops
async function acceptFieldBitacora(entryId, editedPayload = null) {
  const b = _pendingFieldBitacoras.find(x => x.id === Number(entryId));
  if (!b && !editedPayload) return;

  try {
    const dbId = _getBitacorasOpsDbId();
    const res = await fetch('/api/v1/ops/bitacora/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: Number(entryId),
        db_id: dbId,
        ...(editedPayload || {})
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast('❌ ' + (data.error || 'No se pudo aceptar la bitácora'), 'error');
      return;
    }

    const accepted = data.entry || b;
    const pesoKg = Number(accepted.peso_kg || 0);
    const precioCompra = Number(accepted.precio_referencia || 0);
    const totalCompra = +(pesoKg * precioCompra).toFixed(2);
    const fecha = (accepted.timestamp_captura || new Date().toISOString()).substring(0, 10);

    // Registrar también como Bitácora oficial en Reciminsa Ops (lo que dispara syncPushData a Supabase)
    const invoice = {
      id: `BIT-FIELD-${accepted.id}`,
      type: 'basica',
      typeName: 'Bitácora (Campo API)',
      source: 'RECIMINSA_FIELD_API',
      client: accepted.cliente_nombre || 'Cliente de Campo',
      clientId: accepted.cliente_origen_id ? String(accepted.cliente_origen_id) : '',
      date: fecha,
      notes: `${accepted.notas || ''} [GPS: ${accepted.latitud || 'N/A'}, ${accepted.longitud || 'N/A'}]`.trim(),
      items: [
        {
          id: Date.now() + Math.random(),
          matId: String(accepted.material_id || ''),
          name: accepted.material_nombre || 'Material Reciclable',
          icon: '♻️',
          qty: pesoKg,
          peso: pesoKg,
          unit: accepted.unidad_medida || 'kg',
          priceBuy: precioCompra,
          priceSell: precioCompra,
          totalCompra: totalCompra,
          totalVenta: totalCompra,
          balance: 0
        }
      ],
      totalCompra: totalCompra,
      totalVenta: totalCompra,
      balance: 0,
      collaborator: accepted.colaborador_nombre || '',
      createdAt: accepted.timestamp_captura || new Date().toISOString(),
      approvedAt: new Date().toISOString()
    };

    if (typeof saveInvoice === 'function') {
      saveInvoice(invoice);
    }

    if (totalCompra > 0 && typeof addFinanceEntry === 'function') {
      addFinanceEntry('egreso', {
        concept: `Compra Bitácora Campo #${accepted.id} – ${invoice.client} (${accepted.colaborador_nombre || 'Chofer'})`,
        amount: totalCompra,
        date: fecha,
        category: 'Materiales',
        ref: invoice.id
      });
    }

    closeEditFieldBitacoraModal();
    await fetchFieldBitacorasForOpsPanel(false);
    refreshBitacoraCountTab();
    showToast(`✅ Bitácora #${accepted.id} aceptada y guardada en Supabase`, 'success');
  } catch (err) {
    showToast('❌ Error al guardar bitácora en Supabase: ' + err.message, 'error');
  }
}

// Abrir modal para Editar una bitácora enviada por API antes de aceptarla
function openEditFieldBitacoraModal(entryId) {
  const b = _pendingFieldBitacoras.find(x => x.id === Number(entryId));
  if (!b) return;

  let modalRoot = document.getElementById('ops-field-bitacora-edit-modal-root');
  if (!modalRoot) {
    modalRoot = document.createElement('div');
    modalRoot.id = 'ops-field-bitacora-edit-modal-root';
    document.body.appendChild(modalRoot);
  }

  modalRoot.innerHTML = `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="card card--elevated" style="max-width:520px; width:100%; padding:24px; background:var(--clr-surface-2); border:1px solid rgba(59,130,246,0.4);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h3 style="margin:0; font-size:1.12rem; color:#60a5fa;">✏️ Editar Bitácora de Campo #${b.id}</h3>
          <button type="button" onclick="closeEditFieldBitacoraModal()" style="background:none; border:none; color:var(--clr-text-muted); font-size:1.2rem; cursor:pointer;">✕</button>
        </div>

        <div class="form-row" style="grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div class="form-group" style="margin:0;">
            <label class="form-label" style="font-size:0.78rem;">Chofer / Colaborador</label>
            <input id="edit-fb-colab" type="text" class="form-input" value="${(b.colaborador_nombre || '').replace(/"/g, '&quot;')}" />
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label" style="font-size:0.78rem;">Cliente / Punto de Recogida</label>
            <input id="edit-fb-cliente" type="text" class="form-input" value="${(b.cliente_nombre || '').replace(/"/g, '&quot;')}" />
          </div>
        </div>

        <div class="form-row" style="grid-template-columns:2fr 1fr 1fr; gap:12px; margin-bottom:12px;">
          <div class="form-group" style="margin:0;">
            <label class="form-label" style="font-size:0.78rem;">Material</label>
            <input id="edit-fb-material" type="text" class="form-input" value="${(b.material_nombre || '').replace(/"/g, '&quot;')}" />
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label" style="font-size:0.78rem;">Peso (kg)</label>
            <input id="edit-fb-peso" type="number" step="0.01" min="0.01" class="form-input" value="${Number(b.peso_kg || 0)}" />
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label" style="font-size:0.78rem;">Precio Ref. (RD$)</label>
            <input id="edit-fb-precio" type="number" step="0.01" min="0" class="form-input" value="${Number(b.precio_referencia || 0)}" />
          </div>
        </div>

        <div class="form-group" style="margin-bottom:18px;">
          <label class="form-label" style="font-size:0.78rem;">Notas / Observaciones</label>
          <textarea id="edit-fb-notas" class="form-input" style="height:70px;">${b.notas || ''}</textarea>
        </div>

        <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <button type="button" class="btn-secondary" onclick="closeEditFieldBitacoraModal()">Cancelar</button>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn-secondary" onclick="saveEditedFieldBitacoraOnly(${b.id})" style="border-color:rgba(59,130,246,0.45); color:#60a5fa;">
              💾 Guardar Edición
            </button>
            <button type="button" class="btn-primary" onclick="saveAndAcceptFieldBitacora(${b.id})" style="background:#10b981; color:#06130d; font-weight:800;">
              ✅ Guardar y Aceptar en Supabase
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function closeEditFieldBitacoraModal() {
  const modalRoot = document.getElementById('ops-field-bitacora-edit-modal-root');
  if (modalRoot) modalRoot.innerHTML = '';
}

function _collectEditedFieldBitacoraInputs() {
  return {
    colaborador_nombre: document.getElementById('edit-fb-colab')?.value.trim() || 'Colaborador',
    cliente_nombre: document.getElementById('edit-fb-cliente')?.value.trim() || 'Cliente General',
    material_nombre: document.getElementById('edit-fb-material')?.value.trim() || 'Material',
    peso_kg: parseFloat(document.getElementById('edit-fb-peso')?.value) || 0,
    precio_referencia: parseFloat(document.getElementById('edit-fb-precio')?.value) || 0,
    notas: document.getElementById('edit-fb-notas')?.value.trim() || ''
  };
}

async function saveEditedFieldBitacoraOnly(entryId) {
  const payload = _collectEditedFieldBitacoraInputs();
  if (payload.peso_kg <= 0) {
    showToast('❌ El peso debe ser mayor a 0 kg', 'error');
    return;
  }

  try {
    const res = await fetch('/api/v1/ops/bitacora/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: Number(entryId), ...payload })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('❌ ' + (data.error || 'Error al editar bitácora'), 'error');
      return;
    }
    closeEditFieldBitacoraModal();
    await fetchFieldBitacorasForOpsPanel(false);
    showToast(`✏️ Bitácora #${entryId} actualizada en la bandeja`, 'success');
  } catch (err) {
    showToast('❌ Error de red al actualizar la bitácora', 'error');
  }
}

async function saveAndAcceptFieldBitacora(entryId) {
  const payload = _collectEditedFieldBitacoraInputs();
  if (payload.peso_kg <= 0) {
    showToast('❌ El peso debe ser mayor a 0 kg', 'error');
    return;
  }
  await acceptFieldBitacora(entryId, payload);
}

// Eliminar / Rechazar bitácora recibida por API (NO se guarda en Supabase)
async function deleteFieldBitacora(entryId) {
  if (!confirm(`¿Estás seguro de eliminar la bitácora de campo #${entryId}?\n\nEsta bitácora se descartará y NO se guardará en Supabase.`)) {
    return;
  }

  try {
    const res = await fetch('/api/v1/ops/bitacora/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: Number(entryId) })
    });
    if (!res.ok) {
      showToast('❌ No se pudo eliminar la bitácora', 'error');
      return;
    }
    await fetchFieldBitacorasForOpsPanel(false);
    showToast(`🗑️ Bitácora #${entryId} eliminada (no guardada en Supabase)`, 'info');
  } catch (err) {
    showToast('❌ Error al eliminar la bitácora', 'error');
  }
}

window.fetchFieldBitacorasForOpsPanel = fetchFieldBitacorasForOpsPanel;
window.acceptFieldBitacora = acceptFieldBitacora;
window.openEditFieldBitacoraModal = openEditFieldBitacoraModal;
window.closeEditFieldBitacoraModal = closeEditFieldBitacoraModal;
window.saveEditedFieldBitacoraOnly = saveEditedFieldBitacoraOnly;
window.saveAndAcceptFieldBitacora = saveAndAcceptFieldBitacora;
window.deleteFieldBitacora = deleteFieldBitacora;
