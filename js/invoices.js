/* =============================================
   INVOICES.JS – Invoice creation (Batch Entry)
   Depends on: materials.js, i18n.js, excel-utils.js
   ============================================= */

let basicItems = []; // Still used for internal logic if needed, but the UI is now row-driven
let compItems = [];

// Helper to detect if device is likely a phone/tablet
function isMobileDevice() {
  return window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function switchInvoiceTab(tabName) {
  document.querySelectorAll('.invoice-tab').forEach(t_ => t_.classList.remove('active'));
  document.querySelectorAll('.invoice-tab-content').forEach(c => c.classList.remove('active'));
  const btn = document.getElementById(`inv-tab-btn-${tabName}`);
  const content = document.getElementById(`inv-tab-${tabName}`);
  if (btn) btn.classList.add('active');
  if (content) content.classList.add('active');
}

// =============================================
// TAB 1: CONTEO DE FACTURAS
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
      materialTotals[item.matId].subtotal += (item.totalCompra || 0); // Lo que invertimos en comprarlo
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
        <div class="stat-label">${t('inv.total_facts')}</div>
        <div class="stat-value stat-value--blue">${invoices.length}</div>
        <div class="stat-sub">${t('inv.all_facts')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${t('inv.basic_facts')}</div>
        <div class="stat-value stat-value--green">${basicInvoices.length}</div>
        <div class="stat-sub">${t('inv.recycle_mat')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${t('inv.biz_facts')}</div>
        <div class="stat-value stat-value--yellow">${invoices.filter(i => i.type === 'empresa').length}</div>
        <div class="stat-sub">${t('inv.for_biz')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Facturado (B)</div>
        <div class="stat-value stat-value--green">${formatMoney(grandTotal)}</div>
        <div class="stat-sub">Venta bruta de materiales</div>
      </div>
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
      <p class="empty-state-text">${t('inv.no_basic')}<br>Crea una nueva factura en <b>${t('inv.tab_basic')}</b>.</p>
    </div>`}
  `;
}

// =============================================
// TAB 2: FACTURAS BÁSICAS (Batch Entry)
// =============================================

function renderBasicForm() {
  return `
    <div class="card" style="max-width: 950px; margin: 0 auto;">
      <div class="card-header">
        <h3 class="card-title">${t('inv.basic_title')}</h3>
        <p class="card-subtitle">${t('inv.basic_sub')}</p>
      </div>

      <div class="form-row" style="grid-template-columns: 1fr 1fr;">
        <div class="form-group">
          <label class="form-label">${t('lbl.client')}</label>
          <input id="basic-client" type="text" class="form-input" placeholder="Nombre completo" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('lbl.invoice_date')}</label>
          <input id="basic-date" type="date" class="form-input" />
        </div>
      </div>

      <div style="margin-top:20px; overflow-x:auto;">
        <table class="data-table" style="min-width: 850px;">
          <thead>
            <tr>
              <th style="width:200px;">${t('lbl.material')}</th>
              <th style="width:100px;">${t('lbl.code')}</th>
              <th>${t('lbl.quantity')}</th>
              <th>${t('lbl.unit')}</th>
              <th>${t('lbl.weight')} (kg)</th>
              <th>Comp. (${getCurrency().symbol})</th>
              <th>Vent. (${getCurrency().symbol})</th>
              <th style="width:40px;"></th>
            </tr>
          </thead>
          <tbody id="basic-items-entry-rows">
            <!-- Row will be added here -->
          </tbody>
        </table>
      </div>

      <div style="margin-top:10px; display:flex; justify-content: space-between; align-items: center;">
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
        <button class="btn-primary" onclick="saveBasicInvoiceBatch()" style="flex:2;">${t('inv.save_invoice')}</button>
        <button class="btn-outline" onclick="initBasicForm()" style="flex:1;">${t('inv.clear_form')}</button>
      </div>
    </div>
  `;
}

function initBasicForm() {
  const container = document.getElementById('inv-tab-basica');
  if (container) {
    container.innerHTML = renderBasicForm();
    addBasicEntryRow();
    const today = new Date().toISOString().split('T')[0];
    const el = document.getElementById('basic-date');
    if (el) el.value = today;
  }
}

function addBasicEntryRow() {
  const tbody = document.getElementById('basic-items-entry-rows');
  if (!tbody) return;

  const mats = getMaterialCodes();
  const options = mats.map(m => `<option value="${m.id}">${m.icon} ${m.name}</option>`).join('');

  const rowId = `row-${Date.now()}`;
  const tr = document.createElement('tr');
  tr.id = rowId;
  tr.innerHTML = `
    <td>
      <select class="form-select row-mat" onchange="const m = getMaterialCodes().find(x=>x.id===this.value); this.closest('tr').querySelector('.row-code').value = m?m.code:''; calculateBatchTotals()">
        <option value="" disabled selected>${t('lbl.select_mat') || 'Seleccionar...'}</option>
        ${options}
      </select>
    </td>
    <td><input type="text" class="form-input row-code" readonly style="background:var(--clr-surface-2); font-family:monospace; font-size:0.8rem;" /></td>
    <td><input type="number" class="form-input row-qty" placeholder="0" min="0" step="1" oninput="calculateBatchTotals()" /></td>
    <td><input type="text" class="form-input row-unit" value="lb" style="width:50px;" /></td>
    <td><input type="number" class="form-input row-peso" placeholder="0" min="0" step="0.1" oninput="calculateBatchTotals()" /></td>
    <td><input type="number" class="form-input row-pbuy" placeholder="0" min="0" step="0.1" oninput="calculateBatchTotals()" /></td>
    <td><input type="number" class="form-input row-psell" placeholder="0" min="0" step="0.1" oninput="calculateBatchTotals()" /></td>
    <td><button class="btn-icon" onclick="removeBasicEntryRow('${rowId}')" title="Eliminar fila">✕</button></td>
  `;
  tbody.appendChild(tr);
  calculateBatchTotals();
}

function removeBasicEntryRow(id) {
  const row = document.getElementById(id);
  if (row) row.remove();
  calculateBatchTotals();
}

function calculateBatchTotals() {
  let totalB = 0;
  document.querySelectorAll('#basic-items-entry-rows tr').forEach(tr => {
    const qty = parseFloat(tr.querySelector('.row-qty').value) || 0;
    const pbuy = parseFloat(tr.querySelector('.row-pbuy').value) || 0;
    const psell = parseFloat(tr.querySelector('.row-psell').value) || 0;

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
  const rows = document.querySelectorAll('#basic-items-entry-rows tr');
  const items = [];
  const mats = getMaterialCodes();

  rows.forEach(tr => {
    const matId = tr.querySelector('.row-mat').value;
    const qty = parseFloat(tr.querySelector('.row-qty').value) || 0;
    const peso = parseFloat(tr.querySelector('.row-peso').value) || 0;
    const unit = tr.querySelector('.row-unit').value || 'lb';
    const pbuy = parseFloat(tr.querySelector('.row-pbuy').value) || 0;
    const psell = parseFloat(tr.querySelector('.row-psell').value) || 0;

    if (qty > 0 && pbuy > 0) {
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
    showToast('❌ Agrega al menos un material con cantidad y precio', 'error');
    return;
  }

  const client = document.getElementById('basic-client').value.trim() || 'Cliente General';
  const date = document.getElementById('basic-date').value || new Date().toISOString().split('T')[0];
  const notes = document.getElementById('basic-notes').value.trim();

  const totalC = items.reduce((s, i) => s + i.totalCompra, 0);
  const totalV = items.reduce((s, i) => s + i.totalVenta, 0);
  const balanceTotal = totalV - totalC;

  const invoice = {
    id: `FAC-B-${Date.now()}`,
    type: 'basica', typeName: 'Básica',
    client, date, notes,
    items,
    totalCompra: totalC,
    totalVenta: totalV,
    balance: balanceTotal,
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

  showToast(`${t('toast.inv_saved')} ${invoice.id}`, 'success');
  initBasicForm();

  setTimeout(() => {
    if (confirm("¿Deseas descargar el Excel de este registro?")) {
      exportarExcelResiduos(invoice);
    }
  }, 800);
}

// =============================================
// TAB 3: FACTURAS EMPRESARIALES (Batch Entry)
// =============================================

function renderCompanyForm() {
  return `
    <div class="card" style="max-width: 950px; margin: 0 auto;">
      <div class="card-header">
        <h3 class="card-title">${t('inv.biz_title')}</h3>
        <p class="card-subtitle">${t('inv.biz_sub')}</p>
      </div>

      <div class="form-row" style="grid-template-columns: 1fr 1fr;">
        <div class="form-group">
          <label class="form-label">${t('inv.company_name')}</label>
          <input id="comp-name" type="text" class="form-input" placeholder="Nombre completo" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('inv.nit')}</label>
          <input id="comp-nit" type="text" class="form-input" placeholder="ID Fiscal" />
        </div>
      </div>

      <div class="form-row" style="grid-template-columns: 1fr 1fr;">
        <div class="form-group">
          <label class="form-label">${t('inv.contact')}</label>
          <input id="comp-contact" type="text" class="form-input" placeholder="Nombre de contacto" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('inv.address')}</label>
          <input id="comp-address" type="text" class="form-input" placeholder="Dirección / Email" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">${t('lbl.invoice_date')}</label>
          <input id="comp-date" type="date" class="form-input" />
        </div>
      </div>

      <div style="margin-top:20px; overflow-x:auto;">
        <table class="data-table" style="min-width: 800px;">
          <thead>
            <tr>
              <th style="width:40%;">${t('inv.item_desc')}</th>
              <th>${t('lbl.quantity')}</th>
              <th>${t('inv.unit_price')}</th>
              <th>Total</th>
              <th style="width:40px;"></th>
            </tr>
          </thead>
          <tbody id="comp-items-entry-rows">
            <!-- Row will be added here -->
          </tbody>
        </table>
      </div>

      <div style="margin-top:10px; display:flex; justify-content: space-between; align-items: center;">
         <button class="btn-secondary" onclick="addCompEntryRow()" style="margin-bottom:0;">
           ➕ ${t('inv.add_item')}
         </button>
         <div id="comp-live-totals" style="text-align:right;">
            <div style="font-size:0.9rem; color:var(--clr-text-muted);">Subtotal: RD$0.00</div>
            <div style="font-size:1.1rem; font-weight:700; color:var(--clr-primary-light);">Total: RD$0.00</div>
         </div>
      </div>

      <div class="form-row" style="margin-top:20px; grid-template-columns: 1fr 1fr;">
        <div class="form-group">
          <label class="form-label">ITBIS (%)</label>
          <input id="comp-tax-rate" type="number" class="form-input" value="18" oninput="calculateCompBatchTotals()" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('inv.pay_notes')}</label>
          <input id="comp-notes" type="text" class="form-input" placeholder="${t('inv.pay_notes_ph')}" />
        </div>
      </div>

      <div style="display:flex; gap:10px; margin-top:30px;">
        <button class="btn-primary" onclick="saveCompanyInvoiceBatch()" style="flex:2;">${t('inv.save_invoice')}</button>
        <button class="btn-outline" onclick="initCompanyForm()" style="flex:1;">${t('inv.clear_form')}</button>
      </div>
    </div>
  `;
}

function initCompanyForm() {
  const container = document.getElementById('inv-tab-empresa');
  if (container) {
    container.innerHTML = renderCompanyForm();
    addCompEntryRow();
    const today = new Date().toISOString().split('T')[0];
    const el = document.getElementById('comp-date');
    if (el) el.value = today;
  }
}

function addCompEntryRow() {
  const tbody = document.getElementById('comp-items-entry-rows');
  if (!tbody) return;

  const rowId = `bizrow-${Date.now()}`;
  const tr = document.createElement('tr');
  tr.id = rowId;
  tr.innerHTML = `
    <td><input type="text" class="form-input row-desc" placeholder="Descripción del producto/servicio" /></td>
    <td><input type="number" class="form-input row-qty" placeholder="0" min="1" oninput="calculateCompBatchTotals()" /></td>
    <td><input type="number" class="form-input row-uprice" placeholder="0.00" min="0" step="0.01" oninput="calculateCompBatchTotals()" /></td>
    <td class="row-total" style="font-weight:600; text-align:right;">RD$0.00</td>
    <td><button class="btn-icon" onclick="removeCompEntryRow('${rowId}')">✕</button></td>
  `;
  tbody.appendChild(tr);
  calculateCompBatchTotals();
}

function removeCompEntryRow(id) {
  const row = document.getElementById(id);
  if (row) row.remove();
  calculateCompBatchTotals();
}

function calculateCompBatchTotals() {
  let subtotal = 0;
  document.querySelectorAll('#comp-items-entry-rows tr').forEach(tr => {
    const qty = parseFloat(tr.querySelector('.row-qty').value) || 0;
    const uprice = parseFloat(tr.querySelector('.row-uprice').value) || 0;
    const rowTotal = qty * uprice;
    subtotal += rowTotal;
    tr.querySelector('.row-total').textContent = formatMoney(rowTotal);
  });

  const taxRate = parseFloat(document.getElementById('comp-tax-rate').value) || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const label = document.getElementById('comp-live-totals');
  if (label) {
    label.innerHTML = `
      <div style="font-size:0.9rem; color:var(--clr-text-muted);">Subtotal: ${formatMoney(subtotal)}</div>
      <div style="font-size:0.9rem; color:var(--clr-text-muted);">ITBIS: ${formatMoney(taxAmount)}</div>
      <div style="font-size:1.1rem; font-weight:700; color:var(--clr-primary-light);">Total: ${formatMoney(total)}</div>
    `;
  }
}

async function saveCompanyInvoiceBatch() {
  const rows = document.querySelectorAll('#comp-items-entry-rows tr');
  const items = [];

  rows.forEach(tr => {
    const desc = tr.querySelector('.row-desc').value.trim();
    const qty = parseFloat(tr.querySelector('.row-qty').value) || 0;
    const uprice = parseFloat(tr.querySelector('.row-uprice').value) || 0;

    if (desc && qty > 0 && uprice > 0) {
      items.push({
        id: Date.now() + Math.random(),
        desc, qty, uprice, subtotal: qty * uprice
      });
    }
  });

  if (items.length === 0) {
    showToast('❌ Agrega al menos un artículo con descripción y precio', 'error');
    return;
  }

  const company = document.getElementById('comp-name').value.trim() || 'Empresa General';
  const nit = document.getElementById('comp-nit').value.trim();
  const contact = document.getElementById('comp-contact').value.trim();
  const address = document.getElementById('comp-address').value.trim();
  const date = document.getElementById('comp-date').value || new Date().toISOString().split('T')[0];
  const notes = document.getElementById('comp-notes').value.trim();
  const taxRate = parseFloat(document.getElementById('comp-tax-rate').value) || 0;

  const rawSubtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const taxAmount = rawSubtotal * (taxRate / 100);
  const total = rawSubtotal + taxAmount;

  const invoice = {
    id: `FAC-E-${Date.now()}`,
    type: 'empresa', typeName: 'Empresarial',
    company, nit, contact, address, date, notes,
    items,
    subtotal: rawSubtotal,
    taxRate, taxAmount, total,
    createdAt: new Date().toISOString()
  };

  saveInvoice(invoice);

  addFinanceEntry('ingreso', {
    concept: `${invoice.id} – ${company}`,
    amount: total, date, category: 'Ventas Empresariales', ref: invoice.id
  });

  showToast(`${t('toast.inv_saved')} ${invoice.id}`, 'success');
  initCompanyForm();

  setTimeout(() => {
    if (confirm("¿Deseas descargar el Excel de este registro?")) {
      exportarExcelResiduos(invoice);
    }
  }, 800);
}

// =============================================
// SHARED: Invoice storage
// =============================================

function saveInvoice(invoice) {
  const invoices = getAllInvoices();
  invoices.unshift(invoice);
  localStorage.setItem(userKey('recim_invoices'), JSON.stringify(invoices));

  if (isFirebaseActive && db) {
    db.ref('recim_invoices').set(invoices).catch(err => console.error("Firebase invoice sync error:", err));
  }
}

if (isFirebaseActive && db) {
  db.ref('recim_invoices').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      localStorage.setItem(userKey('recim_invoices'), JSON.stringify(data));
      if (typeof rerenderCurrentPage === 'function') rerenderCurrentPage();
    }
  });
}

function getAllInvoices() {
  return JSON.parse(localStorage.getItem(userKey('recim_invoices')) || '[]');
}

// =============================================
// RENDER INVOICES PAGE
// =============================================

function renderInvoicesPage(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="section-title">${t('inv.title')}</h2>
        <p class="section-subtitle">${t('inv.subtitle')}</p>
      </div>
    </div>

    <div class="invoice-tabs" style="${isMobileDevice() ? 'display:none;' : ''}">
      <button class="invoice-tab active" id="inv-tab-btn-conteo" onclick="switchInvoiceTab('conteo'); refreshCountTab()">
        ${t('inv.tab_count')}
      </button>
      <button class="invoice-tab" id="inv-tab-btn-basica" onclick="switchInvoiceTab('basica')">
        ${t('inv.tab_basic')}
      </button>
      <button class="invoice-tab" id="inv-tab-btn-empresa" onclick="switchInvoiceTab('empresa')">
        ${t('inv.tab_biz')}
      </button>
    </div>

    <div id="inv-tab-conteo" class="invoice-tab-content ${isMobileDevice() ? '' : 'active'}">
      <div id="count-tab-inner"></div>
    </div>

    <div id="inv-tab-basica" class="invoice-tab-content ${isMobileDevice() ? 'active' : ''}">
      <!-- Initialized by initBasicForm -->
    </div>

    <div id="inv-tab-empresa" class="invoice-tab-content">
      <!-- Initialized by initCompanyForm -->
    </div>
  `;

  refreshCountTab();

  // Pre-initialize forms
  initBasicForm();
  initCompanyForm();
}

function refreshCountTab() {
  const inner = document.getElementById('count-tab-inner');
  if (inner) inner.innerHTML = renderCountTab();
}
