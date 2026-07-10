/* =============================================
   CLIENTS.JS – Gestión de Clientes / Empresas
   ============================================= */

function getClients() {
  return JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
}

function saveClients(clients) {
  localStorage.setItem(userKey('recim_clients'), JSON.stringify(clients));
}

function addClient(name, nit, address, contact, type = 'local', isRst = false) {
  const clients = getClients();
  const id = `cli-${Date.now()}`;
  clients.push({ id, name, nit, address, contact, type, isRst });
  saveClients(clients);
  showToast(type === 'empresa' ? t('toast.biz_created') : t('toast.cli_add'), 'success');
  return true;
}

function deleteClient(id) {
  const clients = getClients();
  const client = clients.find(c => c.id === id);
  const isEmp = client && client.type === 'empresa';
  const filtered = clients.filter(c => c.id !== id);
  saveClients(filtered);
  showToast(isEmp ? t('toast.biz_deleted') : t('toast.cli_del'), 'success');
}

function updateClient(id, name, nit, address, contact, isRst = false) {
  const clients = getClients();
  const idx = clients.findIndex(c => c.id === id);
  if (idx === -1) return;
  clients[idx] = { ...clients[idx], name, nit, address, contact, isRst };
  saveClients(clients);
  showToast(t('toast.cli_upd'), 'success');
}

// =============================================
// RENDER CLIENTES PAGE
// =============================================

function renderClientesPage(container) {
  const allClients = getClients();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="section-title">${t('cli.title')}</h2>
        <p class="section-subtitle">${t('cli.subtitle')}</p>
      </div>
    </div>

    <div class="finance-grid">
      <!-- Form -->
      <div class="card card--elevated">
        <h3 class="section-title" style="margin-bottom:16px;"><span>${t('cli.new_record')}</span></h3>
        <div style="display:flex;flex-direction:column;gap:14px;">
          
          <div class="form-group">
            <label class="form-label">${t('cli.record_type')}</label>
            <select id="cli-type" class="form-input" onchange="handleClientTypeChange(this.value)" style="background-color: var(--clr-surface-3); font-weight: 500;">
              <option value="local">${t('cli.type_person')}</option>
              <option value="empresa">${t('cli.type_company')}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" id="lbl-cli-name">${t('cli.name_lbl')}</label>
            <input id="cli-name" type="text" class="form-input" placeholder="${t('cli.name_ph')}" />
          </div>

          <div class="form-group">
            <label class="form-label" id="lbl-cli-nit">${t('cli.doc_lbl')}</label>
            <div style="display:flex; gap: 8px;">
              <input id="cli-nit" type="text" class="form-input" placeholder="${t('cli.doc_ph')}" style="flex:1;" />
              <button class="btn-secondary" onclick="autoFillClientDGII()" style="margin:0; padding: 0 15px;" title="${t('inv.rnc_search')}" type="button">🔍</button>
            </div>
          </div>

          <div class="form-group" id="cli-rst-container" style="display:none; flex-direction:column; align-items:center; gap:8px; margin: 4px 0;">
            <input id="cli-rst" type="checkbox" style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--clr-primary);" />
            <label for="cli-rst" style="font-size: 0.85rem; color: var(--clr-text-secondary); cursor: pointer; text-align: center; font-weight: 500;">${t('cli.rst_lbl')}</label>
          </div>

          <div class="form-group">
            <label class="form-label">${t('hist.address')}</label>
            <input id="cli-address" type="text" class="form-input" placeholder="${t('cli.address_ph')}" />
          </div>

          <div class="form-group">
            <label class="form-label">${t('hist.contact')}</label>
            <input id="cli-contact" type="text" class="form-input" placeholder="${t('cli.contact_ph')}" />
          </div>

          <button class="btn-primary" onclick="handleAddClient()">
            ${t('cli.save_record')}
          </button>
        </div>
      </div>

      <!-- Lists -->
      <div>
        <div class="card card--elevated" style="margin-bottom:16px;">
          <h3 class="section-title" style="margin-bottom:12px;font-size:1rem;">
            ${t('cli.saved_records')}
            <span class="badge badge--green" style="margin-left:8px;">${allClients.length}</span>
          </h3>
          <div id="clients-list">
            ${renderClientsList(allClients)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function handleClientTypeChange(type) {
  const rstContainer = document.getElementById('cli-rst-container');
  if (rstContainer) {
    rstContainer.style.display = (type === 'empresa') ? 'flex' : 'none';
  }
}
window.handleClientTypeChange = handleClientTypeChange;

function renderClientsList(clients) {
  if (clients.length === 0) {
    return `<p style="color:var(--clr-text-muted);font-size:0.85rem;">${t('cli.no_records')}</p>`;
  }

  return clients.map(c => {
    const isEmp = c.type === 'empresa';
    return `
    <div class="material-item" id="cli-row-${c.id}" style="gap:10px;flex-wrap:wrap; align-items: flex-start; padding: 15px;">
      <div style="flex:1;">
        <div style="font-weight: 600; font-size: 1rem; color: var(--clr-text); display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <span>${c.name}</span>
          ${isEmp 
            ? `<span class="badge badge--blue" style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; background:#3b82f6; color:#fff; text-transform:none;">${t('cli.badge_company')}</span>` 
            : `<span class="badge" style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; background:#64748b; color:#fff; text-transform:none;">${t('cli.badge_person')}</span>`}
          ${c.isRst ? `<span class="badge badge--green" style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; text-transform:none;">${t('cli.rst_short_lbl')}</span>` : ''}
        </div>
        <div style="font-size: 0.8rem; color: var(--clr-text-muted); margin-top: 4px;">
          ${c.nit ? `<span style="margin-right: 10px;"><b>${t('cli.id_label')}:</b> ${c.nit}</span>` : ''}
          ${c.contact ? `<span><b>${t('cli.contact_label')}:</b> ${c.contact}</span>` : ''}
        </div>
        ${c.address ? `<div style="font-size: 0.8rem; color: var(--clr-text-muted); margin-top: 2px;"><b>${t('cli.address_label')}:</b> ${c.address}</div>` : ''}
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn-secondary" style="padding:5px 10px;font-size:0.8rem;"
                onclick="showEditClientRow('${c.id}', '${c.name.replace(/'/g, "\\'")}', '${(c.nit || '').replace(/'/g, "\\'")}', '${(c.address || '').replace(/'/g, "\\'")}', '${(c.contact || '').replace(/'/g, "\\'")}', '${c.type || 'local'}', ${c.isRst || false})">
          ✏️
        </button>
        <button class="btn-danger" style="padding:5px 10px;font-size:0.8rem;"
                onclick="handleDeleteClient('${c.id}')">
          🗑
        </button>
      </div>
    </div>`;
  }).join('');
}

// ---- Inline edit row ----
function showEditClientRow(id, currentName, currentNit, currentAddress, currentContact, currentType = 'local', isRst = false) {
  const row = document.getElementById(`cli-row-${id}`);
  if (!row) return;

  row.innerHTML = `
    <div style="width: 100%; display: flex; flex-direction: column; gap: 8px;">
      <div class="form-group" style="margin-bottom:0;">
        <select id="edit-cli-type-${id}" class="form-input" onchange="document.getElementById('edit-cli-rst-container-${id}').style.display = (this.value === 'empresa' ? 'flex' : 'none')" style="background-color: var(--clr-surface-3); font-weight: 500;">
          <option value="local" ${currentType === 'local' ? 'selected' : ''}>${t('cli.type_person')}</option>
          <option value="empresa" ${currentType === 'empresa' ? 'selected' : ''}>${t('cli.type_company')}</option>
        </select>
      </div>

      <input id="edit-cli-name-${id}" type="text" class="form-input" value="${currentName}" placeholder="${t('cli.name_lbl')}" />
      
      <div style="display:flex; gap: 8px;">
        <input id="edit-cli-nit-${id}" type="text" class="form-input" value="${currentNit}" placeholder="${t('cli.doc_lbl')}" style="flex:1;" />
        <button class="btn-secondary" onclick="autoFillEditClientDGII('${id}')" style="margin:0; padding: 0 15px;" title="${t('inv.rnc_search')}" type="button">🔍</button>
      </div>
      
      <div id="edit-cli-rst-container-${id}" style="display:${currentType === 'empresa' ? 'flex' : 'none'}; align-items:center; gap:8px; margin: 4px 0;">
        <input id="edit-cli-rst-${id}" type="checkbox" ${isRst ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--clr-primary);" />
        <label for="edit-cli-rst-${id}" style="font-size: 0.85rem; color: var(--clr-text-secondary); cursor: pointer; font-weight: 500;">${t('cli.rst_short_lbl')}</label>
      </div>
      
      <input id="edit-cli-address-${id}" type="text" class="form-input" value="${currentAddress}" placeholder="${t('cli.address_ph')}" />
      <input id="edit-cli-contact-${id}" type="text" class="form-input" value="${currentContact}" placeholder="${t('cli.contact_ph')}" />
      
      <div style="display:flex;gap:6px;margin-top:4px;">
        <button class="btn-primary" style="padding:6px 14px;font-size:0.82rem;"
                onclick="saveEditClientRow('${id}')">✓ ${t('btn.save')}</button>
        <button class="btn-secondary" style="padding:6px 10px;font-size:0.82rem;"
                onclick="cancelEditClientRow()">✕</button>
      </div>
    </div>
  `;
}

function saveEditClientRow(id) {
  const typeEl = document.getElementById(`edit-cli-type-${id}`);
  const nameEl = document.getElementById(`edit-cli-name-${id}`);
  const nitEl = document.getElementById(`edit-cli-nit-${id}`);
  const addressEl = document.getElementById(`edit-cli-address-${id}`);
  const contactEl = document.getElementById(`edit-cli-contact-${id}`);
  const rstEl = document.getElementById(`edit-cli-rst-${id}`);
  
  const type = typeEl?.value || 'local';
  const name = nameEl?.value.trim() || '';
  const nit = nitEl?.value.trim() || '';
  const address = addressEl?.value.trim() || '';
  const contact = contactEl?.value.trim() || '';
  const isRst = rstEl ? rstEl.checked : false;

  if (!name) { showToast(t('err.fill_fields') || '❌ Completa los campos requeridos', 'error'); return; }

  const clients = getClients();
  const idx = clients.findIndex(c => c.id === id);
  if (idx !== -1) {
    clients[idx] = { ...clients[idx], name, nit, address, contact, type, isRst };
    saveClients(clients);
    showToast(t('toast.cli_upd') || '✅ Registro actualizado', 'success');
  }
  refreshClientsList();
}

function cancelEditClientRow() {
  refreshClientsList();
}

// ---- Handlers ----
function handleAddClient() {
  const type = document.getElementById('cli-type').value;
  const name = document.getElementById('cli-name').value.trim();
  const nit = document.getElementById('cli-nit').value.trim();
  const address = document.getElementById('cli-address').value.trim();
  const contact = document.getElementById('cli-contact').value.trim();
  const rstEl = document.getElementById('cli-rst');
  const isRst = rstEl ? rstEl.checked : false;

  if (!name) { showToast(t('err.fill_fields') || '❌ Completa los campos requeridos', 'error'); return; }
  
  if (addClient(name, nit, address, contact, type, isRst)) {
    document.getElementById('cli-name').value = '';
    document.getElementById('cli-nit').value = '';
    document.getElementById('cli-address').value = '';
    document.getElementById('cli-contact').value = '';
    if (rstEl) rstEl.checked = false;
    document.getElementById('cli-type').value = 'local';
    handleClientTypeChange('local');
    refreshClientsList();
  }
}

function handleDeleteClient(id) {
  if (!confirm(t('confirm.del_cli'))) return;
  deleteClient(id);
  refreshClientsList();
}

function refreshClientsList() {
  const listEl = document.getElementById('clients-list');
  if (listEl) {
    const clients = getClients();
    const header = listEl.closest('.card')?.querySelector('h3 .badge');
    if (header) header.textContent = clients.length;
    listEl.innerHTML = renderClientsList(clients);
  }
}

// ---- DGII Lookup Helpers ----
async function autoFillClientDGII() {
  const nitEl = document.getElementById('cli-nit');
  if (!nitEl) return;
  const val = nitEl.value.trim();
  if (!val) {
    showToast(t('inv.rnc_enter_first'), 'warning');
    return;
  }
  const data = await fetchDGIIData(val);
  if (data) {
    if (data.rnc) {
      nitEl.value = data.rnc;
    }
    const nameEl = document.getElementById('cli-name');
    if (nameEl) nameEl.value = data.name;
    const rstEl = document.getElementById('cli-rst');
    if (rstEl) rstEl.checked = !!data.isRST;
    
    const addrEl = document.getElementById('cli-address');
    const contactEl = document.getElementById('cli-contact');
    
    const clients = getClients();
    const rncToFind = (data.rnc || val).replace(/\D/g, '');
    const localClient = clients.find(c => c.nit && c.nit.replace(/\D/g, '') === rncToFind);
    
    if (localClient) {
      if (addrEl) addrEl.value = localClient.address || '';
      if (contactEl) contactEl.value = localClient.contact || localClient.phone || '';
      showToast(t('toast.cli_local_data_loaded'), 'success');
    } else {
      if (addrEl) addrEl.value = data.address || '';
    }
  }
}

async function autoFillEditClientDGII(id) {
  const nitEl = document.getElementById(`edit-cli-nit-${id}`);
  if (!nitEl) return;
  const val = nitEl.value.trim();
  if (!val) {
    showToast(t('inv.rnc_enter_first'), 'warning');
    return;
  }
  const data = await fetchDGIIData(val);
  if (data) {
    if (data.rnc) {
      nitEl.value = data.rnc;
    }
    const nameEl = document.getElementById(`edit-cli-name-${id}`);
    if (nameEl) nameEl.value = data.name;
    const rstEl = document.getElementById(`edit-cli-rst-${id}`);
    if (rstEl) rstEl.checked = !!data.isRST;
    
    const addrEl = document.getElementById(`edit-cli-address-${id}`);
    const contactEl = document.getElementById(`edit-cli-contact-${id}`);
    
    const clients = getClients();
    const rncToFind = (data.rnc || val).replace(/\D/g, '');
    const localClient = clients.find(c => c.nit && c.nit.replace(/\D/g, '') === rncToFind);
    
    if (localClient) {
      if (addrEl) addrEl.value = localClient.address || '';
      if (contactEl) contactEl.value = localClient.contact || localClient.phone || '';
      showToast(t('toast.cli_local_data_loaded'), 'success');
    } else {
      if (addrEl) addrEl.value = data.address || '';
    }
  }
}
