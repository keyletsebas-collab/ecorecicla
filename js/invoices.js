/* =============================================
   INVOICES.JS – Facturación (Local & Empresarial) con PDF
   Depends on: materials.js, i18n.js, html2pdf
   ============================================= */

// =============================================
// TAB NAVIGATION
// =============================================
function switchFacturacionTab(tabName) {
  document.querySelectorAll('.fac-tab').forEach(t_ => t_.classList.remove('active'));
  document.querySelectorAll('.fac-tab-content').forEach(c => c.classList.remove('active'));
  const btn = document.getElementById(`fac-tab-btn-${tabName}`);
  const content = document.getElementById(`fac-tab-${tabName}`);
  if (btn) btn.classList.add('active');
  if (content) content.classList.add('active');
}

// =============================================
// FACTURA LOCAL / EMPRESARIAL (Unified Form)
// =============================================
function renderFacturaForm(type) {
  const isEmpresa = type === 'empresa';
  return `
    <div class="card" style="max-width: 950px; margin: 0 auto;">
      <div class="card-header">
        <h3 class="card-title">${isEmpresa ? t('inv.biz_title') : 'Factura Local'}</h3>
        <p class="card-subtitle">${isEmpresa ? t('inv.biz_sub') : 'Para consumidores finales (Sin RNC)'}</p>
      </div>

      <div class="form-row" style="margin-bottom: 15px;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Seleccionar Cliente Guardado (Opcional)</label>
          <select id="fac-client-select-${type}" class="form-select" onchange="autofillClient('${type}', this.value)">
            <option value="">-- Escribir datos manualmente --</option>
          </select>
        </div>
      </div>

      <div class="form-row" style="grid-template-columns: 1fr 1fr;">
        <div class="form-group">
          <label class="form-label">${isEmpresa ? t('inv.company_name') : 'Nombre del Cliente'}</label>
          <input id="fac-name-${type}" type="text" class="form-input" placeholder="Nombre completo" />
        </div>
        ${isEmpresa ? `
        <div class="form-group">
          <label class="form-label">${t('inv.nit')}</label>
          <input id="fac-nit-${type}" type="text" class="form-input" placeholder="ID Fiscal (RNC)" />
        </div>
        ` : `
        <div class="form-group">
          <label class="form-label">Cédula / Identificación (Opcional)</label>
          <input id="fac-nit-${type}" type="text" class="form-input" placeholder="000-0000000-0" />
        </div>
        `}
      </div>

      ${isEmpresa ? `
      <div class="form-row" style="grid-template-columns: 1fr 1fr;">
        <div class="form-group">
          <label class="form-label">NCF (Número de Comprobante Fiscal)</label>
          <input id="fac-ncf-${type}" type="text" class="form-input" placeholder="Ej: B0100000001" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('inv.address')}</label>
          <input id="fac-address-${type}" type="text" class="form-input" placeholder="Dirección / Email" />
        </div>
      </div>
      ` : `
        <input type="hidden" id="fac-ncf-${type}" value="" />
        <input type="hidden" id="fac-address-${type}" value="" />
      `}

      <div class="form-row" style="grid-template-columns: 1fr 1fr;">
        <div class="form-group">
          <label class="form-label">${t('lbl.invoice_date')}</label>
          <input id="fac-date-${type}" type="date" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('inv.contact')}</label>
          <input id="fac-contact-${type}" type="text" class="form-input" placeholder="Teléfono o Contacto" />
        </div>
      </div>

      <div style="margin-top:20px; overflow-x:auto;">
        <table class="data-table" style="min-width: 800px;">
          <thead>
            <tr>
              <th style="width:40%;">${t('inv.item_desc')}</th>
              <th>${t('lbl.quantity')}</th>
              <th>Unidad</th>
              <th>${t('inv.unit_price')}</th>
              <th>Total</th>
              <th style="width:40px;"></th>
            </tr>
          </thead>
          <tbody id="fac-items-${type}">
            <!-- Rows added dynamically -->
          </tbody>
        </table>
      </div>

      <div style="margin-top:10px; display:flex; justify-content: space-between; align-items: center;">
         <button class="btn-secondary" onclick="addFacEntryRow('${type}')" style="margin-bottom:0;">
           ➕ ${t('inv.add_item')}
         </button>
         <div id="fac-totals-${type}" style="text-align:right;">
            <div style="font-size:0.9rem; color:var(--clr-text-muted);">Subtotal: RD$0.00</div>
            ${isEmpresa ? `<div style="font-size:0.9rem; color:var(--clr-text-muted);">ITBIS: RD$0.00</div>` : ''}
            <div style="font-size:1.1rem; font-weight:700; color:var(--clr-primary-light);">Total: RD$0.00</div>
         </div>
      </div>

      <div class="form-row" style="margin-top:20px; grid-template-columns: 1fr 1fr;">
        <div class="form-group">
          <label class="form-label">ITBIS (%)</label>
          <input id="fac-tax-${type}" type="number" class="form-input" value="${isEmpresa ? '18' : '0'}" oninput="calcFacTotals('${type}')" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('inv.pay_notes')}</label>
          <input id="fac-notes-${type}" type="text" class="form-input" placeholder="${t('inv.pay_notes_ph')}" />
        </div>
      </div>

      <div style="display:flex; gap:10px; margin-top:30px;">
        <button class="btn-primary" onclick="saveFactura('${type}')" style="flex:2;">${t('inv.save_invoice')}</button>
        <button class="btn-outline" onclick="initFacturaForm('${type}')" style="flex:1;">${t('inv.clear_form')}</button>
      </div>
    </div>
  `;
}

function initFacturaForm(type) {
  const container = document.getElementById(`fac-tab-${type}`);
  if (container) {
    container.innerHTML = renderFacturaForm(type);
    addFacEntryRow(type);
    const today = new Date().toISOString().split('T')[0];
    const el = document.getElementById(`fac-date-${type}`);
    if (el) el.value = today;
    initClientSelect(type);
  }
}

function initClientSelect(type) {
  const select = document.getElementById(`fac-client-select-${type}`);
  if (!select) return;
  const clients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
  clients.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} ${c.nit ? `(${c.nit})` : ''}`;
    select.appendChild(opt);
  });
}

function autofillClient(type, id) {
  if (!id) {
    document.getElementById(`fac-name-${type}`).value = '';
    const nitEl = document.getElementById(`fac-nit-${type}`);
    const addrEl = document.getElementById(`fac-address-${type}`);
    const contactEl = document.getElementById(`fac-contact-${type}`);
    if (nitEl && nitEl.type !== 'hidden') nitEl.value = '';
    if (addrEl && addrEl.type !== 'hidden') addrEl.value = '';
    if (contactEl && contactEl.type !== 'hidden') contactEl.value = '';
    return;
  }
  const clients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
  const client = clients.find(c => c.id === id);
  if (client) {
    document.getElementById(`fac-name-${type}`).value = client.name || '';
    const nitEl = document.getElementById(`fac-nit-${type}`);
    const addrEl = document.getElementById(`fac-address-${type}`);
    const contactEl = document.getElementById(`fac-contact-${type}`);
    if (nitEl && nitEl.type !== 'hidden') nitEl.value = client.nit || '';
    if (addrEl && addrEl.type !== 'hidden') addrEl.value = client.address || '';
    if (contactEl && contactEl.type !== 'hidden') contactEl.value = client.contact || '';
  }
}

function addFacEntryRow(type) {
  const tbody = document.getElementById(`fac-items-${type}`);
  if (!tbody) return;

  const rowId = `row-${Date.now()}`;
  const tr = document.createElement('tr');
  tr.id = rowId;
  tr.innerHTML = `
    <td><input type="text" class="form-input row-desc" placeholder="Descripción del producto/servicio" /></td>
    <td><input type="number" class="form-input row-qty" placeholder="0" min="0.01" step="0.01" oninput="calcFacTotals('${type}')" /></td>
    <td>
      <select class="form-select row-unit">
        <option value="lb" selected>libra</option>
        <option value="kg">kg</option>
        <option value="unidad">unidad</option>
      </select>
    </td>
    <td><input type="number" class="form-input row-uprice" placeholder="0.00" min="0" step="0.01" oninput="calcFacTotals('${type}')" /></td>
    <td class="row-total" style="font-weight:600; text-align:right;">RD$0.00</td>
    <td><button class="btn-icon" onclick="removeFacEntryRow('${rowId}', '${type}')">✕</button></td>
  `;
  tbody.appendChild(tr);
  calcFacTotals(type);
}

function removeFacEntryRow(id, type) {
  const row = document.getElementById(id);
  if (row) row.remove();
  calcFacTotals(type);
}

function calcFacTotals(type) {
  let subtotal = 0;
  document.querySelectorAll(`#fac-items-${type} tr`).forEach(tr => {
    const qty = parseFloat(tr.querySelector('.row-qty').value) || 0;
    const uprice = parseFloat(tr.querySelector('.row-uprice').value) || 0;
    const rowTotal = qty * uprice;
    subtotal += rowTotal;
    tr.querySelector('.row-total').textContent = formatMoney(rowTotal);
  });

  const taxRate = parseFloat(document.getElementById(`fac-tax-${type}`).value) || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const label = document.getElementById(`fac-totals-${type}`);
  if (label) {
    if (taxRate > 0) {
      label.innerHTML = `
        <div style="font-size:0.9rem; color:var(--clr-text-muted);">Subtotal: ${formatMoney(subtotal)}</div>
        <div style="font-size:0.9rem; color:var(--clr-text-muted);">ITBIS: ${formatMoney(taxAmount)}</div>
        <div style="font-size:1.1rem; font-weight:700; color:var(--clr-primary-light);">Total: ${formatMoney(total)}</div>
      `;
    } else {
      label.innerHTML = `
        <div style="font-size:0.9rem; color:var(--clr-text-muted);">Subtotal: ${formatMoney(subtotal)}</div>
        <div style="font-size:1.1rem; font-weight:700; color:var(--clr-primary-light);">Total: ${formatMoney(total)}</div>
      `;
    }
  }
}

async function saveFactura(type) {
  const rows = document.querySelectorAll(`#fac-items-${type} tr`);
  const items = [];

  rows.forEach(tr => {
    const desc = tr.querySelector('.row-desc').value.trim();
    const qty = parseFloat(tr.querySelector('.row-qty').value) || 0;
    const unit = tr.querySelector('.row-unit').value || '';
    const uprice = parseFloat(tr.querySelector('.row-uprice').value) || 0;

    if (desc && qty > 0 && uprice > 0) {
      items.push({ id: Date.now() + Math.random(), desc, qty, unit, uprice, subtotal: qty * uprice });
    }
  });

  if (items.length === 0) {
    showToast('❌ Agrega al menos un artículo con descripción y precio', 'error');
    return;
  }

  const company = document.getElementById(`fac-name-${type}`).value.trim() || 'Cliente General';
  const nit = document.getElementById(`fac-nit-${type}`).value.trim();
  const ncf = document.getElementById(`fac-ncf-${type}`).value.trim();
  const address = document.getElementById(`fac-address-${type}`).value.trim();
  const contact = document.getElementById(`fac-contact-${type}`).value.trim();
  const date = document.getElementById(`fac-date-${type}`).value || new Date().toISOString().split('T')[0];
  const notes = document.getElementById(`fac-notes-${type}`).value.trim();
  const taxRate = parseFloat(document.getElementById(`fac-tax-${type}`).value) || 0;

  const rawSubtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const taxAmount = rawSubtotal * (taxRate / 100);
  const total = rawSubtotal + taxAmount;

  const isEmpresa = type === 'empresa';
  const invType = isEmpresa ? 'empresa' : 'local';
  const typeName = isEmpresa ? 'Empresarial' : 'Local';

  const invoice = {
    id: `FAC-${isEmpresa?'E':'L'}-${Date.now()}`,
    type: invType, typeName: typeName,
    company, nit, ncf, address, contact, date, notes,
    items, subtotal: rawSubtotal, taxRate, taxAmount, total,
    createdAt: new Date().toISOString()
  };

  saveInvoice(invoice);

  addFinanceEntry('ingreso', {
    concept: `Venta ${typeName}: ${invoice.id} – ${company}`,
    amount: total, date, category: 'Ventas', ref: invoice.id
  });

  showToast(`${t('toast.inv_saved')} ${invoice.id}`, 'success');
  initFacturaForm(type);

  if (confirm("¿Deseas descargar la factura en PDF?")) {
    generatePDFInvoice(invoice);
  }
}

// =============================================
// PDF GENERATION (html2pdf)
// =============================================
function generatePDFInvoice(invoice) {
  if (typeof html2pdf === 'undefined') {
    showToast('Error: html2pdf.js no está cargado', 'error');
    return;
  }

  const isEmpresa = invoice.type === 'empresa';
  const title = isEmpresa && invoice.ncf ? 'FACTURA DE CRÉDITO FISCAL' : 'FACTURA COMERCIAL';
  const c = getCurrency().symbol;

  const itemsHtml = invoice.items.map(item => `
    <tr style="border-bottom: 1px solid #ddd;">
      <td style="padding: 8px;">${item.qty} ${item.unit || ''}</td>
      <td style="padding: 8px;">${item.desc}</td>
      <td style="padding: 8px; text-align:right;">${formatMoney(item.uprice)}</td>
      <td style="padding: 8px; text-align:right;">${formatMoney(item.subtotal)}</td>
    </tr>
  `).join('');

  const htmlContent = `
    <div style="font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #333; background: #fff;">
      
      <div style="display:flex; justify-content: space-between; align-items:flex-start; margin-bottom: 30px; border-bottom: 2px solid #22c55e; padding-bottom: 20px;">
        <div>
          <h1 style="color: #15803d; margin:0; font-size: 28px;">RECIMINSA</h1>
          <p style="margin:5px 0 0 0; font-size: 14px; color: #666;">Gestión de Reciclaje</p>
          <p style="margin:2px 0; font-size: 14px; color: #666;">Tel: (809) 000-0000</p>
          <p style="margin:2px 0; font-size: 14px; color: #666;">Email: contacto@reciminsa.com</p>
        </div>
        <div style="text-align: right;">
          <h2 style="margin:0; font-size: 22px; color: #333;">${title}</h2>
          <p style="margin:5px 0; font-size: 16px;"><strong>Factura N°:</strong> ${invoice.id}</p>
          <p style="margin:2px 0; font-size: 14px;"><strong>Fecha:</strong> ${invoice.date}</p>
          ${invoice.ncf ? `<p style="margin:2px 0; font-size: 14px;"><strong>NCF:</strong> ${invoice.ncf}</p>` : ''}
        </div>
      </div>

      <div style="margin-bottom: 30px; background: #f9fafb; padding: 15px; border-radius: 5px;">
        <h3 style="margin:0 0 10px 0; font-size: 16px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">FACTURADO A:</h3>
        <p style="margin:3px 0; font-size: 14px;"><strong>Cliente:</strong> ${invoice.company}</p>
        ${invoice.nit ? `<p style="margin:3px 0; font-size: 14px;"><strong>${isEmpresa?'RNC':'Identificación'}:</strong> ${invoice.nit}</p>` : ''}
        ${invoice.address ? `<p style="margin:3px 0; font-size: 14px;"><strong>Dirección:</strong> ${invoice.address}</p>` : ''}
        ${invoice.contact ? `<p style="margin:3px 0; font-size: 14px;"><strong>Contacto:</strong> ${invoice.contact}</p>` : ''}
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background: #22c55e; color: #fff;">
            <th style="padding: 10px; text-align: left;">CANT</th>
            <th style="padding: 10px; text-align: left;">DESCRIPCIÓN</th>
            <th style="padding: 10px; text-align: right;">PRECIO UNIT.</th>
            <th style="padding: 10px; text-align: right;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div style="display:flex; justify-content: flex-end;">
        <div style="width: 300px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 5px; text-align: right;"><strong>Subtotal:</strong></td>
              <td style="padding: 5px; text-align: right;">${formatMoney(invoice.subtotal)}</td>
            </tr>
            ${invoice.taxRate > 0 ? `
            <tr>
              <td style="padding: 5px; text-align: right;"><strong>ITBIS (${invoice.taxRate}%):</strong></td>
              <td style="padding: 5px; text-align: right;">${formatMoney(invoice.taxAmount)}</td>
            </tr>
            ` : ''}
            <tr style="border-top: 2px solid #333;">
              <td style="padding: 10px 5px; text-align: right; font-size: 18px;"><strong>TOTAL:</strong></td>
              <td style="padding: 10px 5px; text-align: right; font-size: 18px; color: #15803d;"><strong>${formatMoney(invoice.total)}</strong></td>
            </tr>
          </table>
        </div>
      </div>

      ${invoice.notes ? `
      <div style="margin-top: 30px; font-size: 12px; color: #666; border-top: 1px solid #eee; padding-top: 10px;">
        <strong>Notas / Condiciones:</strong><br>
        ${invoice.notes}
      </div>
      ` : ''}
    </div>
  `;

  const opt = {
    margin:       0.5,
    filename:     `Factura_${invoice.id}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  const wrapper = document.createElement('div');
  wrapper.innerHTML = htmlContent;
  
  html2pdf().set(opt).from(wrapper).save().then(() => {
    showToast('📄 PDF generado correctamente', 'success');
  }).catch(err => {
    console.error('PDF error', err);
    showToast('❌ Error al generar PDF', 'error');
  });
}

// =============================================
// SHARED: Invoice storage
// =============================================
function saveInvoice(invoice) {
  const invoices = getAllInvoices();
  invoices.unshift(invoice);
  localStorage.setItem(userKey('recim_invoices'), JSON.stringify(invoices));
}

function getAllInvoices() {
  return JSON.parse(localStorage.getItem(userKey('recim_invoices')) || '[]');
}

// =============================================
// RENDER FACTURACIÓN PAGE
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
      <button class="invoice-tab fac-tab active" id="fac-tab-btn-local" onclick="switchFacturacionTab('local')">
        ${t('inv.tab_local')}
      </button>
      <button class="invoice-tab fac-tab" id="fac-tab-btn-empresa" onclick="switchFacturacionTab('empresa')">
        ${t('inv.tab_biz')}
      </button>
    </div>

    <div id="fac-tab-local" class="invoice-tab-content fac-tab-content active"></div>
    <div id="fac-tab-empresa" class="invoice-tab-content fac-tab-content"></div>
  `;

  initFacturaForm('local');
  initFacturaForm('empresa');
}
