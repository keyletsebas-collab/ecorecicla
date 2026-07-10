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
  const materials = typeof getCustomCodes === 'function' ? getCustomCodes() : [];
  let datalistHtml = `<datalist id="material-codes-datalist-${type}">`;
  materials.forEach(m => {
    datalistHtml += `<option value="${m.code} - ${m.name}">${m.name} (${m.code})</option>`;
  });
  datalistHtml += `</datalist>`;

  return `
    ${datalistHtml}
    <div class="card" style="max-width: 950px; margin: 0 auto;">
      <div class="card-header">
        <h3 class="card-title">${isEmpresa ? t('inv.biz_title') : t('inv.local_title')}</h3>
        <p class="card-subtitle">${isEmpresa ? t('inv.biz_sub') : t('inv.local_sub')}</p>
      </div>

      <div class="form-row" style="margin-bottom: 15px;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">${t('inv.select_client')}</label>
          <select id="fac-client-select-${type}" class="form-select" onchange="autofillClient('${type}', this.value)">
            <option value="">${t('inv.manual_entry')}</option>
          </select>
        </div>
      </div>

      <div class="form-row" style="grid-template-columns: 1fr 1fr;">
        <div class="form-group">
          <label class="form-label">${isEmpresa ? t('inv.company_name') : t('inv.client_name')} <span style="color: #ef4444; font-weight: bold;">*</span></label>
          <input id="fac-name-${type}" type="text" class="form-input" placeholder="${t('inv.full_name_ph')}" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('inv.rnc_label')} ${isEmpresa ? '<span style="color: #ef4444; font-weight: bold;">*</span>' : ''}</label>
          <div style="display:flex; gap: 8px;">
            <input id="fac-nit-${type}" type="text" class="form-input" placeholder="${t('inv.rnc_ph')}" maxlength="11" />
            <button class="btn-secondary" onclick="autoFillInvoiceDGII('${type}')" style="margin:0; padding: 0 15px;" title="${t('inv.rnc_search')}" type="button">🔍</button>
          </div>
        </div>
      </div>

      <div class="form-row" style="grid-template-columns: 1fr 1fr;">
        <div class="form-group">
          <label class="form-label">${t('inv.voucher_type')} <span style="color: #ef4444; font-weight: bold;">*</span></label>
          <select id="fac-ncf-type-${type}" class="form-select" onchange="handleNcfTypeChange('${type}')">
            ${isEmpresa ? `
              <option value="B01">${t('inv.b01_label')}</option>
              <option value="B02">${t('inv.b02_label')}</option>
              <option value="B14">${t('inv.b14_label')}</option>
              <option value="B15">${t('inv.b15_label')}</option>
            ` : `
              <option value="B02">${t('inv.b02_label')}</option>
              <option value="">${t('inv.no_voucher')}</option>
            `}
          </select>
        </div>
        <div class="form-group" id="fac-ncf-group-${type}">
          <label class="form-label">${t('inv.ncf_full')} <span style="color: #ef4444; font-weight: bold;">*</span></label>
          <input id="fac-ncf-${type}" type="text" class="form-input" placeholder="${t('inv.ncf_ph')}" maxlength="13" onchange="padNcf(this, '${type}')" onkeyup="if(event.key==='Enter') padNcf(this, '${type}')" />
        </div>
      </div>
      <div class="form-row" style="grid-template-columns: 1fr;">
        <div class="form-group">
          <label class="form-label">${t('inv.address')}</label>
          <input id="fac-address-${type}" type="text" class="form-input" placeholder="${t('inv.address_ph')}" />
        </div>
      </div>

      <div class="form-row" style="grid-template-columns: repeat(3, 1fr);">
        <div class="form-group">
          <label class="form-label">${t('lbl.invoice_date')} <span style="color: #ef4444; font-weight: bold;">*</span></label>
          <input id="fac-date-${type}" type="date" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('inv.contact')}</label>
          <input id="fac-contact-${type}" type="text" class="form-input" placeholder="${t('inv.contact_ph')}" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('inv.collaborator')}</label>
          <select id="fac-colab-${type}" class="form-select">
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

      <div style="margin-top:20px;">
        <h4 style="margin-bottom: 10px; color: var(--clr-text-muted);">${t('inv.items_title')}</h4>
        <div id="fac-items-${type}" style="display:flex; flex-direction:column; gap:10px;">
          <!-- Rows added dynamically -->
        </div>
      </div>

      <div style="margin-top:10px; display:flex; justify-content: space-between; align-items: center;">
         <button class="btn-secondary" onclick="addFacEntryRow('${type}')" style="margin-bottom:0;">
           ➕ ${t('inv.add_item')}
         </button>
         <div id="fac-totals-${type}" style="text-align:right;">
            <div class="subtotal-label" style="font-size:0.9rem; color:var(--clr-text-muted);">Subtotal: ${formatMoney(0)}</div>
            <div class="total-label" style="font-size:1.1rem; font-weight:700; color:var(--clr-primary-light);">Total: ${formatMoney(0)}</div>
         </div>
      </div>

      <div class="form-row" style="margin-top:20px; grid-template-columns: repeat(4, 1fr);">
        <div class="form-group">
          <label class="form-label" title="${t('inv.isc_label') || 'Impuesto Selectivo al Consumo'}">ISC (%)</label>
          <input id="fac-isc-${type}" type="number" class="form-input" value="0" min="0" oninput="calcFacTotals('${type}')" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('inv.itbis_label') || 'ITBIS (%)'}</label>
          <input id="fac-tax-${type}" type="number" class="form-input" value="${isEmpresa ? '18' : '0'}" min="0" oninput="calcFacTotals('${type}')" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('inv.ret_isr')}</label>
          <input id="fac-ret-isr-${type}" type="number" class="form-input" value="0" min="0" oninput="calcFacTotals('${type}')" />
        </div>
        <div class="form-group">
          <label class="form-label">${t('inv.ret_itbis')}</label>
          <input id="fac-ret-itbis-${type}" type="number" class="form-input" value="0" min="0" oninput="calcFacTotals('${type}')" />
        </div>
      </div>
      
      <div class="form-row" style="grid-template-columns: 1fr;">
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
    handleNcfTypeChange(type);
  }
}

function initClientSelect(type) {
  const select = document.getElementById(`fac-client-select-${type}`);
  if (!select) return;

  const clients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
  
  // Filter clients by invoice type (empresa or local)
  const filtered = clients.filter(c => c.type === type);
  
  let options = `<option value="">-- Escribir datos manualmente --</option>`;
  filtered.forEach(c => {
    options += `<option value="${c.id}">${c.name} ${c.nit ? '('+c.nit+')' : ''}</option>`;
  });
  
  select.innerHTML = options;
}

function autofillClient(type, clientId) {
  if (!clientId) {
    document.getElementById(`fac-name-${type}`).value = '';
    const nitEl = document.getElementById(`fac-nit-${type}`);
    if(nitEl) nitEl.value = '';
    const addrEl = document.getElementById(`fac-address-${type}`);
    if(addrEl) addrEl.value = '';
    const contactEl = document.getElementById(`fac-contact-${type}`);
    if(contactEl) contactEl.value = '';
    return;
  }
  
  const clients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
  const client = clients.find(c => c.id === clientId);
  if (client) {
    document.getElementById(`fac-name-${type}`).value = client.name;
    const nitEl = document.getElementById(`fac-nit-${type}`);
    if(nitEl) nitEl.value = client.nit || '';
    const addrEl = document.getElementById(`fac-address-${type}`);
    if(addrEl) addrEl.value = client.address || '';
    const contactEl = document.getElementById(`fac-contact-${type}`);
    if(contactEl) contactEl.value = client.contact || client.phone || '';
  }
}

function padNcf(input, type = null) {
  let val = input.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!val) return;
  
  if (type) {
    const ncfTypeSelect = document.getElementById(`fac-ncf-type-${type}`);
    const selectedNcfType = ncfTypeSelect ? ncfTypeSelect.value : '';
    if (selectedNcfType && !val.startsWith(selectedNcfType)) {
      if (!/^[A-Z]\d{2}/.test(val)) {
        val = selectedNcfType + val;
      }
    }
  }

  const match = val.match(/^([A-Z]\d{2})(\d+)$/);
  if (match) {
    const prefix = match[1];
    let seq = match[2];
    let totalLength = val.startsWith('E') ? 13 : 11;
    let seqLength = totalLength - 3;
    seq = seq.padStart(seqLength, '0');
    input.value = prefix + seq;
  } else {
    input.value = val;
  }
}

function addFacEntryRow(type) {
  const tbody = document.getElementById(`fac-items-${type}`);
  if (!tbody) return;

  const rowId = `row-${Date.now()}`;
  const div = document.createElement('div');
  div.id = rowId;
  div.className = 'invoice-item-row';
  div.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; align-items: center; background: var(--bg-card); padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);';
  div.innerHTML = `
    <div style="flex: 1 1 100%; min-width: 200px;">
      <input type="text" class="form-input row-desc" list="material-codes-datalist-${type}" placeholder="${t('inv.desc_ph')}" style="margin:0;" />
    </div>
    <div style="flex: 1 1 80px;">
      <input type="number" class="form-input row-qty" placeholder="${t('inv.qty_ph')}" min="0.01" step="0.01" oninput="calcFacTotals('${type}')" style="margin:0;" />
    </div>
    <div style="flex: 1 1 100px;">
      <select class="form-select row-unit" style="margin:0;">
        <option value="lb" selected>${t('inv.unit_lb') || 'libra'}</option>
        <option value="kg">kg</option>
        <option value="unidad">${t('inv.unit_each') || 'unidad'}</option>
        <option value="litros">litros</option>
        <option value="kilos">kilos</option>
      </select>
    </div>
    <div style="flex: 1 1 100px;">
      <input type="number" class="form-input row-uprice" placeholder="${t('inv.price_ph')}" min="0" step="0.01" oninput="calcFacTotals('${type}')" style="margin:0;" />
    </div>
    <div style="flex: 1 1 120px; display:flex; align-items:center; justify-content:space-between;">
      <span class="row-total" style="font-weight:600; font-size:1rem; color: var(--clr-primary-light);">${formatMoney(0)}</span>
      <button class="btn-icon" onclick="removeFacEntryRow('${rowId}', '${type}')" style="color:#ff4d4d; margin:0; padding:4px 8px;">✕</button>
    </div>
  `;
  tbody.appendChild(div);
  calcFacTotals(type);
}

function removeFacEntryRow(id, type) {
  const row = document.getElementById(id);
  if (row) row.remove();
  calcFacTotals(type);
}

function calcFacTotals(type) {
  let subtotal = 0;
  document.querySelectorAll(`#fac-items-${type} .invoice-item-row`).forEach(row => {
    const qty = parseFloat(row.querySelector('.row-qty').value) || 0;
    const uprice = parseFloat(row.querySelector('.row-uprice').value) || 0;
    const rowTotal = qty * uprice;
    subtotal += rowTotal;
    row.querySelector('.row-total').textContent = formatMoney(rowTotal);
  });

  const taxRate = parseFloat(document.getElementById(`fac-tax-${type}`).value) || 0;
  const iscRate = parseFloat(document.getElementById(`fac-isc-${type}`).value) || 0;
  const retIsrRate = parseFloat(document.getElementById(`fac-ret-isr-${type}`).value) || 0;
  const retItbisRate = parseFloat(document.getElementById(`fac-ret-itbis-${type}`).value) || 0;

  const iscAmount = subtotal * (iscRate / 100);
  const taxAmount = subtotal * (taxRate / 100);
  const retIsrAmount = subtotal * (retIsrRate / 100);
  const retItbisAmount = taxAmount * (retItbisRate / 100);
  
  const total = subtotal + iscAmount + taxAmount - retIsrAmount - retItbisAmount;

  const label = document.getElementById(`fac-totals-${type}`);
  if (label) {
    let html = `<div style="font-size:0.9rem; color:var(--clr-text-muted);">Subtotal: ${formatMoney(subtotal)}</div>`;
    if (iscAmount > 0) html += `<div style="font-size:0.85rem; color:var(--clr-text-muted);">ISC (${iscRate}%): +${formatMoney(iscAmount)}</div>`;
    if (taxAmount > 0) html += `<div style="font-size:0.85rem; color:var(--clr-text-muted);">ITBIS (${taxRate}%): +${formatMoney(taxAmount)}</div>`;
    if (retIsrAmount > 0) html += `<div style="font-size:0.85rem; color:var(--clr-danger);">Ret ISR (${retIsrRate}%): -${formatMoney(retIsrAmount)}</div>`;
    if (retItbisAmount > 0) html += `<div style="font-size:0.85rem; color:var(--clr-danger);">Ret ITBIS (${retItbisRate}%): -${formatMoney(retItbisAmount)}</div>`;
    html += `<div style="font-size:1.1rem; font-weight:700; color:var(--clr-primary-light); margin-top:4px;">Total: ${formatMoney(total)}</div>`;
    label.innerHTML = html;
  }
}

async function saveFactura(type) {
  const rows = document.querySelectorAll(`#fac-items-${type} .invoice-item-row`);
  const items = [];

  rows.forEach(row => {
    const desc = row.querySelector('.row-desc').value.trim();
    const qty = parseFloat(row.querySelector('.row-qty').value) || 0;
    const unit = row.querySelector('.row-unit').value || '';
    const uprice = parseFloat(row.querySelector('.row-uprice').value) || 0;

    if (desc && qty > 0 && uprice > 0) {
      items.push({ id: Date.now() + Math.random(), desc, qty, unit, uprice, subtotal: qty * uprice });
    }
  });

  if (items.length === 0) {
    showToast(t('inv.err_no_items'), 'error');
    return;
  }

  // Validar correspondencia de tipo de cliente y tipo de factura
  const clientSelect = document.getElementById(`fac-client-select-${type}`);
  const selectedClientId = clientSelect ? clientSelect.value : '';
  if (selectedClientId) {
    const clients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
    const found = clients.find(c => c.id === selectedClientId);
    if (found) {
      if (type === 'empresa' && found.type !== 'empresa') {
        showToast(t('inv.err_wrong_client_biz'), 'error');
        return;
      }
      if (type === 'local' && found.type === 'empresa') {
        showToast(t('inv.err_wrong_client_local'), 'error');
        return;
      }
    }
  }

  const company = document.getElementById(`fac-name-${type}`).value.trim();
  const date = document.getElementById(`fac-date-${type}`).value;

  if (!company) {
    showToast(t(type === 'empresa' ? 'inv.err_no_company' : 'inv.err_no_client'), 'error');
    return;
  }

  if (!date) {
    showToast(t('inv.err_no_date'), 'error');
    return;
  }

  const isEmpresa = type === 'empresa';
  const nit = document.getElementById(`fac-nit-${type}`).value.trim();
  const ncfType = document.getElementById(`fac-ncf-type-${type}`)?.value || '';
  const ncfInput = document.getElementById(`fac-ncf-${type}`);
  if (ncfInput) {
    padNcf(ncfInput, type);
  }
  const ncf = ncfInput ? ncfInput.value.trim() : '';

  if (ncfType) {
    if (!ncf) {
      showToast(t('inv.err_no_ncf'), 'error');
      return;
    }
  }

  if (isEmpresa) {
    if (!nit && ncfType !== 'B02') {
      showToast(t('inv.err_no_rnc'), 'error');
      return;
    }
    if (!ncfType) {
      showToast(t('inv.err_no_voucher'), 'error');
      return;
    }
  }
  
  if (ncf) {
    const existingInvoices = getAllInvoices();
    const isDuplicate = existingInvoices.some(inv => inv.ncf && inv.ncf.toUpperCase() === ncf.toUpperCase());
    if (isDuplicate) {
      showToast(t('inv.err_dup_ncf').replace('{ncf}', ncf), 'error');
      return;
    }
  }

  const address = document.getElementById(`fac-address-${type}`).value.trim();
  const contact = document.getElementById(`fac-contact-${type}`).value.trim();
  const collaborator = document.getElementById(`fac-colab-${type}`)?.value || '';
  const notes = document.getElementById(`fac-notes-${type}`).value.trim();
  const taxRate = parseFloat(document.getElementById(`fac-tax-${type}`).value) || 0;
  const iscRate = parseFloat(document.getElementById(`fac-isc-${type}`).value) || 0;
  const retIsrRate = parseFloat(document.getElementById(`fac-ret-isr-${type}`).value) || 0;
  const retItbisRate = parseFloat(document.getElementById(`fac-ret-itbis-${type}`).value) || 0;

  const rawSubtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const iscAmount = rawSubtotal * (iscRate / 100);
  const taxAmount = rawSubtotal * (taxRate / 100);
  const retIsrAmount = rawSubtotal * (retIsrRate / 100);
  const retItbisAmount = taxAmount * (retItbisRate / 100);
  const total = rawSubtotal + iscAmount + taxAmount - retIsrAmount - retItbisAmount;

  const invType = isEmpresa ? 'empresa' : 'local';
  const typeName = isEmpresa ? 'Empresarial' : 'Local';

  const invoice = {
    id: `FAC-${isEmpresa?'E':'L'}-${Date.now()}`,
    type: invType, typeName: typeName,
    company, nit, ncfType, ncf, address, contact, date, notes,
    items, subtotal: rawSubtotal, taxRate, taxAmount, 
    iscRate, iscAmount, retIsrRate, retIsrAmount, retItbisRate, retItbisAmount, total,
    collaborator,
    createdAt: new Date().toISOString()
  };

  saveInvoice(invoice);

  addFinanceEntry('ingreso', {
    concept: `${t('inv.sale_label')} ${typeName}: ${invoice.id} – ${company}`,
    amount: total, date, category: 'Ventas', ref: invoice.id
  });

  showToast(`${t('toast.inv_saved')} ${invoice.id}`, 'success');
  initFacturaForm(type);

  showInvoicePostSaveModal(invoice);
}

function getNextNcf(ncfType) {
  if (!ncfType) return '';
  const invoices = getAllInvoices();
  let maxSeq = 0;
  invoices.forEach(inv => {
    if (inv.ncf && inv.ncf.toUpperCase().startsWith(ncfType.toUpperCase())) {
      const seqStr = inv.ncf.substring(ncfType.length);
      const seqNum = parseInt(seqStr, 10);
      if (!isNaN(seqNum) && seqNum > maxSeq) {
        maxSeq = seqNum;
      }
    }
  });
  const nextSeq = maxSeq + 1;
  let totalLength = ncfType.toUpperCase().startsWith('E') ? 13 : 11;
  let seqLength = totalLength - ncfType.length;
  const paddedSeq = String(nextSeq).padStart(seqLength, '0');
  return ncfType + paddedSeq;
}

function handleNcfTypeChange(type) {
  const ncfType = document.getElementById(`fac-ncf-type-${type}`).value;
  const taxInput = document.getElementById(`fac-tax-${type}`);
  const ncfInput = document.getElementById(`fac-ncf-${type}`);
  const ncfGroup = document.getElementById(`fac-ncf-group-${type}`);
  
  if (ncfGroup) {
    if (!ncfType) {
      ncfGroup.style.display = 'none';
    } else {
      ncfGroup.style.display = 'block';
    }
  }
  
  if (!ncfType) {
    ncfInput.value = '';
    ncfInput.placeholder = 'Sin comprobante';
    ncfInput.disabled = true;
  } else {
    ncfInput.disabled = false;
    ncfInput.placeholder = `Ej: ${ncfType}00000001`;
    ncfInput.value = getNextNcf(ncfType);
  }

  if (ncfType === 'B01') {
    taxInput.value = '18';
  } else if (ncfType === 'B14') {
    taxInput.value = '0';
  }
  
  calcFacTotals(type);
}

async function autoFillInvoiceDGII(type) {
  const nitInput = document.getElementById(`fac-nit-${type}`);
  if (!nitInput) return;
  const val = nitInput.value.trim();
  if (!val) {
    showToast(t('inv.rnc_enter_first'), 'warning');
    return;
  }
  const data = await fetchDGIIData(val);
  if (data) {
    // Si se buscó por nombre y la API devolvió el RNC resolved, lo actualizamos
    if (data.rnc) {
      nitInput.value = data.rnc;
    }
    
    document.getElementById(`fac-name-${type}`).value = data.name;
    const addrEl = document.getElementById(`fac-address-${type}`);
    const contactEl = document.getElementById(`fac-contact-${type}`);
    
    // Intentar buscar localmente en clientes guardados para halar dirección y teléfono/contacto
    const clients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
    const rncToFind = (data.rnc || val).replace(/\D/g, '');
    const localClient = clients.find(c => c.nit && c.nit.replace(/\D/g, '') === rncToFind);
    
    if (localClient) {
      if (addrEl) addrEl.value = localClient.address || '';
      if (contactEl) contactEl.value = localClient.contact || localClient.phone || '';
      showToast(t('inv.rnc_verified'), 'success');
    } else {
      if (addrEl) addrEl.value = data.address || '';
      if (contactEl) contactEl.value = ''; // limpiar si no hay datos locales
    }
  }
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
function renderInvoicesPage(container, initialTab = 'local') {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="section-title">${t('inv.title')}</h2>
        <p class="section-subtitle">${t('inv.subtitle')}</p>
      </div>
    </div>

    <div class="invoice-tabs">
      <button class="invoice-tab fac-tab ${initialTab === 'local' ? 'active' : ''}" id="fac-tab-btn-local" onclick="switchFacturacionTab('local')">
        ${t('inv.tab_local')}
      </button>
      <button class="invoice-tab fac-tab ${initialTab === 'empresa' ? 'active' : ''}" id="fac-tab-btn-empresa" onclick="switchFacturacionTab('empresa')">
        ${t('inv.tab_biz')}
      </button>
    </div>

    <div id="fac-tab-local" class="invoice-tab-content fac-tab-content ${initialTab === 'local' ? 'active' : ''}"></div>
    <div id="fac-tab-empresa" class="invoice-tab-content fac-tab-content ${initialTab === 'empresa' ? 'active' : ''}"></div>
  `;

  initFacturaForm('local');
  initFacturaForm('empresa');
}

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
    <div class="card" style="width:90%; max-width:400px; padding:24px; border-radius:12px; background:var(--clr-surface); border:1px solid var(--clr-border); box-shadow:0 10px 25px rgba(0,0,0,0.3); text-align:center; display:flex; flex-direction:column; gap:16px;">
      <div style="font-size:3rem; margin-bottom:8px;">🎉</div>
      <h3 style="margin:0; font-size:1.25rem; font-weight:700; color:var(--clr-text);">¡Factura Creada con Éxito!</h3>
      <p style="margin:0; font-size:0.85rem; color:var(--clr-text-muted);">¿Qué acción deseas realizar con la factura <b>${invoice.id}</b> para <b>${clientName}</b>?</p>
      
      <div style="display:flex; flex-direction:column; gap:10px; margin-top:8px;">
        <button class="btn-primary" onclick="window.closeInvoicePostSaveModal(); generateInvoicePDF(JSON.parse(decodeURIComponent('${encodeURIComponent(JSON.stringify(invoice))}')));" style="justify-content:center; padding:10px; font-weight:600; cursor:pointer;">
          📄 Descargar Factura en PDF
        </button>
        <button class="btn-secondary" onclick="window.closeInvoicePostSaveModal(); shareInvoiceViaWhatsApp('${invoice.id}');" style="justify-content:center; padding:10px; font-weight:600; background:#25d366; color:white; border-color:#25d366; cursor:pointer;">
          💬 Enviar por WhatsApp
        </button>
        <button class="btn-secondary" onclick="window.closeInvoicePostSaveModal();" style="justify-content:center; padding:10px; font-weight:600; color:var(--clr-text-secondary); cursor:pointer;">
          ❌ Cerrar
        </button>
      </div>
    </div>
  `;
}

window.closeInvoicePostSaveModal = function() {
  const modal = document.getElementById('invoice-post-save-modal');
  if (modal) modal.style.display = 'none';
};
window.showInvoicePostSaveModal = showInvoicePostSaveModal;
