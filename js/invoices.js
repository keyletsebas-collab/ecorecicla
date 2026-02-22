/* =============================================
   INVOICES.JS – Invoice creation (3 tabs)
   Depends on: materials.js, i18n.js
   ============================================= */

function switchInvoiceTab(tabName) {
  document.querySelectorAll('.invoice-tab').forEach(t_ => t_.classList.remove('active'));
  document.querySelectorAll('.invoice-tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`inv-tab-btn-${tabName}`).classList.add('active');
  document.getElementById(`inv-tab-${tabName}`).classList.add('active');
}

// =============================================
// TAB 1: CONTEO DE FACTURAS
// =============================================

function renderCountTab() {
  const invoices = getAllInvoices();
  const basicInvoices = invoices.filter(i => i.type === 'basica');

  const materialTotals = {};
  basicInvoices.forEach(inv => {
    inv.items.forEach(item => {
      if (!materialTotals[item.matId]) {
        materialTotals[item.matId] = { name: item.name, icon: item.icon, qty: 0, peso: 0, subtotal: 0, count: 0 };
      }
      materialTotals[item.matId].qty += item.qty;
      materialTotals[item.matId].peso += (item.peso || 0);
      materialTotals[item.matId].subtotal += item.subtotal;
      materialTotals[item.matId].count += 1;
    });
  });

  const rows = Object.entries(materialTotals).map(([id, m]) => `
    <tr>
      <td>${m.icon} ${m.name}</td>
      <td>${m.qty.toFixed(2)} kg (en ${m.count} facturas)</td>
      <td>${m.peso.toFixed(2)} kg</td>
      <td><span class="badge badge--green">${formatMoney(m.subtotal)}</span></td>
    </tr>
  `).join('');

  const grandTotal = basicInvoices.reduce((sum, i) => sum + i.total, 0);

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
        <div class="stat-label">${t('inv.total_basic')}</div>
        <div class="stat-value stat-value--green">${formatMoney(grandTotal)}</div>
        <div class="stat-sub">${t('inv.billed_mat')}</div>
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
              <th>${t('inv.col_qty')}</th>
              <th>${t('inv.col_weight')}</th>
              <th>${t('inv.col_val')}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>` : `
    <div class="empty-state">
      <div class="empty-state-icon">📊</div>
      <p class="empty-state-text">${t('inv.no_basic')}<br>${t('inv.go_basic')} <b>${t('inv.tab_basic')}</b>.</p>
    </div>`}
  `;
}

// =============================================
// TAB 2: FACTURAS BÁSICAS
// =============================================

let basicItems = [];

function renderBasicForm() {
  const mats = getMaterialCodes();
  const matOptions = mats.map(m =>
    `<option value="${m.id}">${m.icon} ${m.name} [${m.code}]</option>`
  ).join('');

  return `
    <div class="card card--elevated">
      <div class="page-header">
        <div>
          <h3 class="section-title">${t('inv.basic_title')}</h3>
          <p class="section-subtitle">${t('inv.basic_sub')}</p>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">${t('lbl.client')}</label>
          <input id="basic-client" type="text" class="form-input" placeholder="${t('lbl.client')}" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('lbl.invoice_date')}</label>
          <input id="basic-date" type="date" class="form-input" />
        </div>
      </div>

      <hr style="border-color:var(--clr-border);margin:20px 0;" />
      <p class="form-label" style="margin-bottom:10px;">${t('lbl.add_material')}</p>

      <div class="form-row" style="grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr auto; align-items:end; gap: 8px;">
        <div class="form-group">
          <label class="form-label">${t('lbl.material')}</label>
          <select id="basic-material" class="form-select">${matOptions}</select>
        </div>
        <div class="form-group">
          <label class="form-label">${t('lbl.quantity')}</label>
          <input id="basic-qty" type="number" class="form-input" placeholder="0" min="0" step="0.1" title="Cantidad/Unidad" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('lbl.weight')} (kg)</label>
          <input id="basic-peso" type="number" class="form-input" placeholder="0.00" min="0" step="0.01" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('lbl.price_buy')} (${getCurrency().symbol})</label>
          <input id="basic-price-buy" type="number" class="form-input" placeholder="0.00" min="0" step="0.01" title="Precio que pagas al recolector" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('lbl.price_sell')} (${getCurrency().symbol})</label>
          <input id="basic-price-sell" type="number" class="form-input" placeholder="0.00" min="0" step="0.01" title="Precio al que vendes" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('lbl.unit')}</label>
          <input id="basic-unit" type="text" class="form-input" value="lb" style="max-width:60px;" />
        </div>
        <button class="btn-secondary" onclick="addBasicItem()" style="margin-bottom:0;height:42px;align-self:flex-end;padding:0 15px;">${t('btn.add')}</button>
      </div>

      <div id="basic-items-list" class="material-items"></div>

      <div id="basic-summary" class="invoice-summary" style="display:none;">
        <div class="invoice-summary-row">
          <span class="invoice-summary-label">${t('inv.gain')}</span>
          <span class="invoice-summary-value" id="basic-ganancia" style="color:var(--clr-primary-light);">-</span>
        </div>
        <div class="invoice-summary-row">
          <span class="invoice-summary-label">${t('inv.loss')}</span>
          <span class="invoice-summary-value" id="basic-perdida" style="color:#f87171;">-</span>
        </div>
        <div class="invoice-summary-row total">
          <span class="invoice-summary-label">${t('inv.total_inv')}</span>
          <span class="invoice-summary-value" id="basic-total">-</span>
        </div>
      </div>

      <div class="form-group" style="margin-top:16px;">
        <label class="form-label">${t('lbl.extra_notes')}</label>
        <textarea id="basic-notes" class="form-textarea" placeholder="${t('lbl.notes')}..."></textarea>
      </div>

      <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end;">
        <button class="btn-secondary" onclick="clearBasicForm()">${t('inv.clear_form')}</button>
        <button class="btn-primary" style="width:auto;padding:12px 28px;" onclick="saveBasicInvoice()">
          <span>${t('inv.save_invoice')}</span>
          <div class="btn-spinner hidden"></div>
        </button>
      </div>
    </div>`;
}

function addBasicItem() {
  const mats = getMaterialCodes();
  const matId = document.getElementById('basic-material').value;
  const qty = parseFloat(document.getElementById('basic-qty').value) || 0;
  const peso = parseFloat(document.getElementById('basic-peso').value) || 0;
  const unit = document.getElementById('basic-unit').value.trim() || 'lb';
  const priceBuy = parseFloat(document.getElementById('basic-price-buy').value) || 0;
  const priceSell = parseFloat(document.getElementById('basic-price-sell').value) || 0;

  if (qty <= 0 || priceBuy <= 0) { showToast(t('err.add_mat'), 'error'); return; }

  const mat = mats.find(m => m.id === matId) || { name: matId, icon: '♻️' };

  // Fórmulas solicitadas:
  // 1. Total Compra = Cantidad * Precio Compra
  const totalCompra = qty * priceBuy;
  // 2. Total Venta = Cantidad * Precio Venta
  const totalVenta = qty * priceSell;
  // 3. Balance = Total Venta - Total Compra
  const balance = totalVenta - totalCompra;
  // 4. Porcentaje (Margen)
  const margin = totalVenta > 0 ? ((balance / totalVenta) * 100).toFixed(1) : 0;

  basicItems.push({
    id: Date.now(),
    matId, name: mat.name, icon: mat.icon,
    qty, peso, unit,
    priceBuy, priceSell,
    totalCompra, totalVenta, balance, margin
  });

  renderBasicItems();
  document.getElementById('basic-qty').value = '';
  document.getElementById('basic-peso').value = '';
  document.getElementById('basic-price-buy').value = '';
  document.getElementById('basic-price-sell').value = '';
}

function removeBasicItem(id) {
  basicItems = basicItems.filter(i => i.id !== id);
  renderBasicItems();
}

function renderBasicItems() {
  const list = document.getElementById('basic-items-list');
  const summary = document.getElementById('basic-summary');

  if (basicItems.length === 0) { list.innerHTML = ''; summary.style.display = 'none'; return; }

  list.innerHTML = basicItems.map(item => `
    <div class="material-item">
      <span style="font-size:1.2rem">${item.icon}</span>
      <div style="flex:1;">
        <div class="material-item-name">${item.name} <span class="badge" style="font-size:0.7rem;">${item.qty} ${item.unit}</span></div>
        <div style="font-size:0.75rem; color:var(--clr-text-muted);">
          Comp: ${formatMoney(item.priceBuy)} | Vent: ${formatMoney(item.priceSell)}
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:600; font-size:0.85rem; color:#f87171;">-${formatMoney(item.totalCompra)} (C)</div>
        <div style="font-weight:600; font-size:0.85rem; color:var(--clr-primary-light);">+${formatMoney(item.totalVenta)} (V)</div>
      </div>
      <div style="margin: 0 10px; padding: 4px 8px; background: var(--clr-surface-3); border-radius: 4px; text-align:center; min-width:80px;">
        <div style="font-size:0.7rem; color:var(--clr-text-muted);">Balance</div>
        <div style="font-weight:700; color:${item.balance >= 0 ? 'var(--clr-primary-light)' : '#f87171'}">${formatMoney(item.balance)}</div>
      </div>
      <button class="btn-danger" onclick="removeBasicItem(${item.id})">✕</button>
    </div>
  `).join('');

  const totalC = basicItems.reduce((s, i) => s + i.totalCompra, 0);
  const totalV = basicItems.reduce((s, i) => s + i.totalVenta, 0);
  const totalB = totalV - totalC;

  document.getElementById('basic-ganancia').textContent = formatMoney(totalV);
  document.getElementById('basic-ganancia').style.color = 'var(--clr-primary-light)';
  document.getElementById('basic-ganancia').previousElementSibling.textContent = 'Total Venta (Ingreso)';

  document.getElementById('basic-perdida').textContent = formatMoney(totalC);
  document.getElementById('basic-perdida').style.color = '#f87171';
  document.getElementById('basic-perdida').previousElementSibling.textContent = 'Total Compra (Egreso)';

  document.getElementById('basic-total').textContent = formatMoney(totalB);
  document.getElementById('basic-total').style.color = totalB >= 0 ? 'var(--clr-primary-light)' : '#f87171';
  document.getElementById('basic-total').previousElementSibling.textContent = 'Balance Neto';

  summary.style.display = 'block';
}

function clearBasicForm() {
  basicItems = [];
  renderBasicItems();
  document.getElementById('basic-client').value = '';
  document.getElementById('basic-notes').value = '';
}

function saveBasicInvoice() {
  if (basicItems.length === 0) { showToast(t('err.no_mat'), 'error'); return; }

  const client = document.getElementById('basic-client').value.trim() || 'Cliente General';
  const date = document.getElementById('basic-date').value || new Date().toISOString().split('T')[0];
  const notes = document.getElementById('basic-notes').value.trim();

  const totalC = basicItems.reduce((s, i) => s + i.totalCompra, 0);
  const totalV = basicItems.reduce((s, i) => s + i.totalVenta, 0);
  const balanceTotal = totalV - totalC;

  const invoice = {
    id: `FAC-B-${Date.now()}`,
    type: 'basica', typeName: 'Básica',
    client, date, notes,
    items: [...basicItems],
    totalCompra: totalC,
    totalVenta: totalV,
    total: totalV, // Mostramos el total de venta como ref principal
    balance: balanceTotal,
    createdAt: new Date().toISOString()
  };

  saveInvoice(invoice);
  clearBasicForm();

  // Registrar Egreso: Lo que pagamos por la compra
  if (totalC > 0) {
    addFinanceEntry('egreso', {
      concept: `Compra: ${invoice.id} – ${client}`,
      amount: totalC, date, category: 'Materiales', ref: invoice.id
    });
  }

  // Registrar Ingreso (Balance/Ganancia Bruta): 
  // Opcional: Podrías registrar el total de venta como ingreso, 
  // pero el usuario pidió ver el balance como ganancia bruta.
  if (balanceTotal > 0) {
    addFinanceEntry('ingreso', {
      concept: `Ganancia: ${invoice.id} – ${client}`,
      amount: balanceTotal, date, category: 'Materiales', ref: invoice.id
    });
  }

  showToast(`${t('toast.inv_saved')} ${invoice.id}`, 'success');
}

// =============================================
// TAB 3: FACTURA EMPRESARIAL
// =============================================

let compItems = [];

function renderCompanyForm() {
  return `
    <div class="card card--elevated">
      <div class="page-header">
        <div>
          <h3 class="section-title">${t('inv.biz_title')}</h3>
          <p class="section-subtitle">${t('inv.biz_sub')}</p>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">${t('inv.company_name')}</label>
          <input id="comp-company" type="text" class="form-input" placeholder="Empresa S.A.S." required />
        </div>
        <div class="form-group">
          <label class="form-label">${t('inv.nit')}</label>
          <input id="comp-nit" type="text" class="form-input" placeholder="900.123.456-7" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">${t('inv.contact')}</label>
          <input id="comp-contact" type="text" class="form-input" placeholder="${t('inv.contact')}" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('lbl.invoice_date')}</label>
          <input id="comp-date" type="date" class="form-input" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">${t('inv.address')}</label>
        <input id="comp-address" type="text" class="form-input" placeholder="Calle 123 / empresa@mail.com" />
      </div>

      <hr style="border-color:var(--clr-border);margin:20px 0;" />
      <p class="form-label" style="margin-bottom:10px;">${t('inv.add_item')}</p>

      <div class="form-row" style="grid-template-columns: 2fr 1fr 1fr auto; align-items:end;">
        <div class="form-group">
          <label class="form-label">${t('inv.item_desc')}</label>
          <input id="comp-desc" type="text" class="form-input" placeholder="${t('inv.item_desc')}" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('lbl.quantity')}</label>
          <input id="comp-qty" type="number" class="form-input" placeholder="1" min="1" step="1" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('inv.unit_price')} (${getCurrency().symbol})</label>
          <input id="comp-uprice" type="number" class="form-input" placeholder="0.00" min="0" step="0.01" />
        </div>
        <button class="btn-secondary" onclick="addCompItem()" style="height:42px;align-self:flex-end;">${t('btn.add')}</button>
      </div>

      <div id="comp-items-list" class="material-items"></div>

      <div id="comp-summary" class="invoice-summary" style="display:none;">
        <div class="invoice-summary-row">
          <span class="invoice-summary-label">${t('lbl.subtotal')}</span>
          <span class="invoice-summary-value" id="comp-subtotal">-</span>
        </div>
        <div class="invoice-summary-row">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="invoice-summary-label">${t('inv.iva')}</span>
            <input id="comp-tax" type="number" class="form-input" value="19" min="0" max="100" style="width:70px;padding:4px 8px;" oninput="updateCompTotals()" />
          </div>
          <span class="invoice-summary-value" id="comp-tax-amount">-</span>
        </div>
        <div class="invoice-summary-row total">
          <span class="invoice-summary-label">${t('inv.total_pay')}</span>
          <span class="invoice-summary-value" id="comp-total">-</span>
        </div>
      </div>

      <div class="form-group" style="margin-top:16px;">
        <label class="form-label">${t('inv.pay_notes')}</label>
        <textarea id="comp-notes" class="form-textarea" placeholder="${t('inv.pay_notes_ph')}"></textarea>
      </div>

      <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end;">
        <button class="btn-secondary" onclick="clearCompForm()">${t('inv.clear_form')}</button>
        <button class="btn-primary" style="width:auto;padding:12px 28px;" onclick="saveCompanyInvoice()">
          <span>${t('inv.save_invoice')}</span>
          <div class="btn-spinner hidden"></div>
        </button>
      </div>
    </div>`;
}

function addCompItem() {
  const desc = document.getElementById('comp-desc').value.trim();
  const qty = parseInt(document.getElementById('comp-qty').value) || 0;
  const uprice = parseFloat(document.getElementById('comp-uprice').value) || 0;

  if (!desc || qty <= 0 || uprice <= 0) { showToast(t('err.add_item'), 'error'); return; }

  compItems.push({ id: Date.now(), desc, qty, uprice, subtotal: qty * uprice });
  renderCompItems();
  document.getElementById('comp-desc').value = '';
  document.getElementById('comp-qty').value = '';
  document.getElementById('comp-uprice').value = '';
}

function removeCompItem(id) {
  compItems = compItems.filter(i => i.id !== id);
  renderCompItems();
}

function renderCompItems() {
  const list = document.getElementById('comp-items-list');
  const summary = document.getElementById('comp-summary');

  if (compItems.length === 0) { list.innerHTML = ''; summary.style.display = 'none'; return; }

  list.innerHTML = compItems.map(item => `
    <div class="material-item">
      <span class="material-item-name">${item.desc}</span>
      <span class="material-item-detail">${item.qty} × ${formatMoney(item.uprice)}</span>
      <span class="material-item-price">${formatMoney(item.subtotal)}</span>
      <button class="btn-danger" onclick="removeCompItem(${item.id})">✕</button>
    </div>
  `).join('');

  summary.style.display = 'block';
  updateCompTotals();
}

function updateCompTotals() {
  const subtotal = compItems.reduce((sum, i) => sum + i.subtotal, 0);
  const taxRate = parseFloat(document.getElementById('comp-tax')?.value || 0) / 100;
  const taxAmt = subtotal * taxRate;
  const total = subtotal + taxAmt;

  if (document.getElementById('comp-subtotal')) {
    document.getElementById('comp-subtotal').textContent = formatMoney(subtotal);
    document.getElementById('comp-tax-amount').textContent = formatMoney(taxAmt);
    document.getElementById('comp-total').textContent = formatMoney(total);
  }
}

function clearCompForm() {
  compItems = [];
  renderCompItems();
  ['comp-company', 'comp-nit', 'comp-contact', 'comp-address', 'comp-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function saveCompanyInvoice() {
  if (compItems.length === 0) { showToast(t('err.no_item'), 'error'); return; }

  const company = document.getElementById('comp-company').value.trim() || 'Empresa Sin Nombre';
  const nit = document.getElementById('comp-nit').value.trim();
  const contact = document.getElementById('comp-contact').value.trim();
  const address = document.getElementById('comp-address').value.trim();
  const date = document.getElementById('comp-date').value || new Date().toISOString().split('T')[0];
  const notes = document.getElementById('comp-notes').value.trim();
  const taxRate = parseFloat(document.getElementById('comp-tax').value || 0);

  const subtotal = compItems.reduce((s, i) => s + i.subtotal, 0);
  const taxAmt = subtotal * (taxRate / 100);
  const total = subtotal + taxAmt;

  const invoice = {
    id: `FAC-E-${Date.now()}`,
    type: 'empresa', typeName: 'Empresarial',
    company, nit, contact, address, client: company,
    date, notes,
    items: [...compItems],
    subtotal, taxRate, taxAmount: taxAmt, total,
    createdAt: new Date().toISOString()
  };

  saveInvoice(invoice);
  addFinanceEntry('ingreso', {
    concept: `${invoice.id} – ${company}`,
    amount: total, date, category: 'Empresarial', ref: invoice.id
  });
  clearCompForm();
  showToast(`${t('toast.inv_saved')} ${invoice.id}`, 'success');
}

// =============================================
// SHARED: Invoice storage
// =============================================

function saveInvoice(invoice) {
  const invoices = getAllInvoices();
  invoices.unshift(invoice);
  localStorage.setItem(userKey('recim_invoices'), JSON.stringify(invoices));

  // Sync to Firebase if active
  if (isFirebaseActive && db) {
    db.ref('recim_invoices').set(invoices).catch(err => console.error("Firebase invoice sync error:", err));
  }
}

// Global listener for Firebase changes (Invoices)
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

    <div class="invoice-tabs">
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

    <div id="inv-tab-conteo" class="invoice-tab-content active">
      <div id="count-tab-inner"></div>
    </div>

    <div id="inv-tab-basica" class="invoice-tab-content">
      ${renderBasicForm()}
    </div>

    <div id="inv-tab-empresa" class="invoice-tab-content">
      ${renderCompanyForm()}
    </div>
  `;

  const today = new Date().toISOString().split('T')[0];
  ['basic-date', 'comp-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });

  refreshCountTab();
}

function refreshCountTab() {
  const inner = document.getElementById('count-tab-inner');
  if (inner) inner.innerHTML = renderCountTab();
}