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
          <input id="basic-client" type="text" class="form-input" placeholder="Nombre completo" />
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

  // Finance entries
  if (totalC > 0) {
    addFinanceEntry('egreso', {
      concept: `Compra: ${invoice.id} – ${client}`,
      amount: totalC, date, category: 'Materiales', ref: invoice.id
    });
  }
  if (balanceTotal > 0) {
    addFinanceEntry('ingreso', {
      concept: `Ganancia: ${invoice.id} – ${client}`,
      amount: balanceTotal, date, category: 'Materiales', ref: invoice.id
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
// RENDER BITACORAS PAGE
// =============================================
function renderBitacorasPage(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="section-title">${t('inv.bit_title')}</h2>
        <p class="section-subtitle">${t('inv.bit_subtitle')}</p>
      </div>
    </div>

    <div class="invoice-tabs">
      <button class="invoice-tab bitacora-tab active" id="bit-tab-btn-crear" onclick="switchBitacoraTab('crear')">
        ➕ Crear Bitácora
      </button>
      <button class="invoice-tab bitacora-tab" id="bit-tab-btn-conteo" onclick="switchBitacoraTab('conteo'); refreshBitacoraCountTab()">
        📊 Conteo
      </button>
    </div>

    <div id="bit-tab-crear" class="invoice-tab-content bitacora-tab-content active">
      <!-- Initialized by initBasicForm -->
    </div>

    <div id="bit-tab-conteo" class="invoice-tab-content bitacora-tab-content">
      <div id="bitacora-count-inner"></div>
    </div>
  `;

  initBasicForm();
}

function refreshBitacoraCountTab() {
  const inner = document.getElementById('bitacora-count-inner');
  if (inner) inner.innerHTML = renderCountTab();
}
