/* =============================================
   CLIENTS.JS – Gestión de Clientes / Empresas
   ============================================= */

function getClients() {
  return JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
}

function saveClients(clients) {
  localStorage.setItem(userKey('recim_clients'), JSON.stringify(clients));
  if (window.syncPushData) {
    window.syncPushData(true);
  }
}

function addClient(name, nit, address, contact, type = 'local', isRst = false, email = '', defaultVoucherProfile = 'CREDITO_FISCAL') {
  const clients = getClients();
  const id = `cli-${Date.now()}`;
  clients.push({ id, name, nit, address, contact, email, type, isRst, defaultVoucherProfile });
  saveClients(clients);
  showToast(type === 'empresa' ? '✅ Empresa creada' : (t('toast.cli_add') || '✅ Cliente creado'), 'success');
  return true;
}

function deleteClient(id) {
  const clients = getClients();
  const client = clients.find(c => c.id === id);
  const isEmp = client && client.type === 'empresa';
  const filtered = clients.filter(c => c.id !== id);
  saveClients(filtered);
  showToast(isEmp ? '🗑 Empresa eliminada' : (t('toast.cli_del') || '🗑 Cliente eliminado'), 'success');
}

function updateClient(id, name, nit, address, contact, isRst = false, email = '', defaultVoucherProfile = 'CREDITO_FISCAL') {
  const clients = getClients();
  const idx = clients.findIndex(c => c.id === id);
  if (idx === -1) return;
  clients[idx] = { ...clients[idx], name, nit, address, contact, email, isRst, defaultVoucherProfile };
  saveClients(clients);
  showToast(t('toast.cli_upd') || '✅ Registro actualizado', 'success');
}

// =============================================
// RENDER CLIENTES PAGE
// =============================================

function renderClientesPage(container) {
  const allClients = getClients();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="section-title">👥 Directorio de Clientes y Empresas</h2>
        <p class="section-subtitle">Gestiona y organiza las personas y empresas registradas para facturación.</p>
      </div>
    </div>

    <div class="finance-grid">
      <!-- Form -->
      <div class="card card--elevated">
        <h3 class="section-title" style="margin-bottom:16px;"><span>➕ Nuevo Registro</span></h3>
        <div style="display:flex;flex-direction:column;gap:14px;">
          
          <div class="form-group">
            <label class="form-label">Tipo de Registro</label>
            <select id="cli-type" class="form-input" onchange="handleClientTypeChange(this.value)" style="background-color: var(--clr-surface-3); font-weight: 500;">
              <option value="local">👤 Persona (Local)</option>
              <option value="empresa">🏢 Empresa (Crédito Fiscal)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" id="lbl-cli-name">Nombre / Razón Social</label>
            <div style="display:flex; gap: 8px;">
              <input id="cli-name" type="text" class="form-input" placeholder="Nombre completo o Razón Social" style="flex:1;" />
              <button class="btn-secondary" onclick="autoFillClientDGII()" style="margin:0; padding: 0 15px;" title="Buscar en DGII por Razón Social o RNC" type="button">🔍</button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" id="lbl-cli-nit">RNC o Cédula</label>
            <div style="display:flex; gap: 8px;">
              <input id="cli-nit" type="text" class="form-input" placeholder="Ej: RNC o Cédula" style="flex:1;" />
              <button class="btn-secondary" onclick="autoFillClientDGII()" style="margin:0; padding: 0 15px;" title="Buscar en DGII por RNC o Razón Social" type="button">🔍</button>
            </div>
          </div>


          <div class="form-group">
            <label class="form-label">Correo Electrónico</label>
            <input id="cli-email" type="email" class="form-input" placeholder="ejemplo@correo.com" />
          </div>

          <div class="form-group" id="cli-rst-container" style="display:none; flex-direction:column; align-items:center; gap:8px; margin: 4px 0;">
            <input id="cli-rst" type="checkbox" style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--clr-primary);" />
            <label for="cli-rst" style="font-size: 0.85rem; color: var(--clr-text-secondary); cursor: pointer; text-align: center; font-weight: 500;">Acogido al RST (Régimen Simplificado)</label>
          </div>

          <div class="form-group">
            <label class="form-label">${t('hist.address')}</label>
            <input id="cli-address" type="text" class="form-input" placeholder="Dirección física" />
          </div>

          <div class="form-group">
            <label class="form-label">${t('hist.contact')}</label>
            <input id="cli-contact" type="text" class="form-input" placeholder="Teléfono o persona de contacto" />
          </div>

          <button class="btn-primary" onclick="handleAddClient()">
            💾 Guardar Registro
          </button>
        </div>
      </div>

      <!-- Lists -->
      <div>
        <div class="card card--elevated" style="margin-bottom:16px;">
          <h3 class="section-title" style="margin-bottom:12px;font-size:1rem;">
            Registros Guardados
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
    return `<p style="color:var(--clr-text-muted);font-size:0.85rem;">Sin clientes ni empresas registradas aún.</p>`;
  }

  return clients.map(c => {
    const isEmp = c.type === 'empresa';
    return `
    <div class="material-item" id="cli-row-${c.id}" style="gap:10px;flex-wrap:wrap; align-items: flex-start; padding: 15px;">
      <div style="flex:1;">
        <div style="font-weight: 600; font-size: 1rem; color: var(--clr-text); display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <span>${c.name}</span>
          ${isEmp 
            ? '<span class="badge badge--blue" style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; background:#3b82f6; color:#fff; text-transform:none;">🏢 Empresa</span>' 
            : '<span class="badge" style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; background:#64748b; color:#fff; text-transform:none;">👤 Persona</span>'}
          ${c.isRst ? '<span class="badge badge--green" style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; text-transform:none;">RST</span>' : ''}
        </div>
        <div style="font-size: 0.8rem; color: var(--clr-text-muted); margin-top: 4px;">
          ${c.nit ? `<span style="margin-right: 10px;"><b>ID:</b> ${c.nit}</span>` : ''}
          ${c.contact ? `<span style="margin-right: 10px;"><b>Contacto:</b> ${c.contact}</span>` : ''}
          ${c.email ? `<span><b>Email:</b> ${c.email}</span>` : ''}
        </div>
        ${c.address ? `<div style="font-size: 0.8rem; color: var(--clr-text-muted); margin-top: 2px;"><b>Dir:</b> ${c.address}</div>` : ''}
        ${c.portalCode 
          ? `<div style="margin-top:6px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span style="font-size:0.75rem; color:var(--clr-primary-light); font-weight:700; background:rgba(0,255,255,0.08); padding:3px 10px; border-radius:6px; border:1px solid rgba(0,255,255,0.2); letter-spacing:1px; font-family:monospace;">🔑 ${c.portalCode}</span>
              <button class="btn-secondary" style="padding:2px 8px; font-size:0.7rem;" onclick="navigator.clipboard.writeText('${c.portalCode}'); showToast('📋 Código copiado','success');">📋 Copiar</button>
              <button class="btn-secondary" style="padding:2px 8px; font-size:0.7rem;" onclick="refreshPortalData('${c.id}')">🔄 Actualizar</button>
              <button class="btn-secondary" style="padding:2px 8px; font-size:0.7rem; background:rgba(239,68,68,0.15); border-color:rgba(239,68,68,0.3); color:#fca5a5;" onclick="regenerateClientPortalCode('${c.id}')">🔁 Regenerar</button>
            </div>`
          : `<div style="margin-top:6px;"><button class="btn-secondary" style="padding:4px 12px; font-size:0.75rem; background:linear-gradient(135deg,#06b6d4,#0891b2); color:#fff; border:none;" onclick="generateClientPortalCode('${c.id}')">🔑 Generar Código de Cliente</button></div>`
        }
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn-secondary" style="padding:5px 10px;font-size:0.8rem;"
                onclick="showEditClientRow('${c.id}', '${c.name.replace(/'/g, "\\'")}', '${(c.nit || '').replace(/'/g, "\\'")}', '${(c.address || '').replace(/'/g, "\\'")}', '${(c.contact || '').replace(/'/g, "\\'")}', '${c.type || 'local'}', ${c.isRst || false}, '${(c.email || '').replace(/'/g, "\\'")}', '${c.defaultVoucherProfile || 'CREDITO_FISCAL'}')">
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
function showEditClientRow(id, currentName, currentNit, currentAddress, currentContact, currentType = 'local', isRst = false, currentEmail = '', currentProf = 'CREDITO_FISCAL') {
  const row = document.getElementById(`cli-row-${id}`);
  if (!row) return;

  row.innerHTML = `
    <div style="width: 100%; display: flex; flex-direction: column; gap: 8px;">
      <div class="form-group" style="margin-bottom:0;">
        <select id="edit-cli-type-${id}" class="form-input" onchange="document.getElementById('edit-cli-rst-container-${id}').style.display = (this.value === 'empresa' ? 'flex' : 'none')" style="background-color: var(--clr-surface-3); font-weight: 500;">
          <option value="local" ${currentType === 'local' ? 'selected' : ''}>👤 Persona (Local)</option>
          <option value="empresa" ${currentType === 'empresa' ? 'selected' : ''}>🏢 Empresa (Crédito Fiscal)</option>
        </select>
      </div>

      <input id="edit-cli-name-${id}" type="text" class="form-input" value="${currentName}" placeholder="Nombre / Razón Social" />
      
      <div style="display:flex; gap: 8px;">
        <input id="edit-cli-nit-${id}" type="text" class="form-input" value="${currentNit}" placeholder="RNC / Cédula" style="flex:1;" />
        <button class="btn-secondary" onclick="autoFillEditClientDGII('${id}')" style="margin:0; padding: 0 15px;" title="Buscar en DGII" type="button">🔍</button>
      </div>

      <div class="form-group" style="margin-bottom:0;">
        <select id="edit-cli-voucher-profile-${id}" class="form-select">
          <option value="CREDITO_FISCAL" ${currentProf === 'CREDITO_FISCAL' ? 'selected' : ''}>🧾 Crédito Fiscal (B01)</option>
          <option value="CONSUMO" ${currentProf === 'CONSUMO' ? 'selected' : ''}>🛍️ Consumidor Final (B02)</option>
          <option value="REGIMEN_ESPECIAL" ${currentProf === 'REGIMEN_ESPECIAL' ? 'selected' : ''}>🛡️ Régimen Especial (B14)</option>
          <option value="GUBERNAMENTAL" ${currentProf === 'GUBERNAMENTAL' ? 'selected' : ''}>🏛️ Gubernamental (B15)</option>
        </select>
      </div>

      <input id="edit-cli-email-${id}" type="email" class="form-input" value="${currentEmail}" placeholder="Correo Electrónico (ejemplo@correo.com)" />
      
      <div id="edit-cli-rst-container-${id}" style="display:${currentType === 'empresa' ? 'flex' : 'none'}; align-items:center; gap:8px; margin: 4px 0;">
        <input id="edit-cli-rst-${id}" type="checkbox" ${isRst ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--clr-primary);" />
        <label for="edit-cli-rst-${id}" style="font-size: 0.85rem; color: var(--clr-text-secondary); cursor: pointer; font-weight: 500;">Acogido al RST</label>
      </div>
      
      <input id="edit-cli-address-${id}" type="text" class="form-input" value="${currentAddress}" placeholder="Dirección física" />
      <input id="edit-cli-contact-${id}" type="text" class="form-input" value="${currentContact}" placeholder="Contacto" />
      
      <div style="display:flex;gap:6px;margin-top:4px;">
        <button class="btn-primary" style="padding:6px 14px;font-size:0.82rem;"
                onclick="saveEditClientRow('${id}')">✓ Guardar</button>
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
  const emailEl = document.getElementById(`edit-cli-email-${id}`);
  const addressEl = document.getElementById(`edit-cli-address-${id}`);
  const contactEl = document.getElementById(`edit-cli-contact-${id}`);
  const rstEl = document.getElementById(`edit-cli-rst-${id}`);
  const profEl = document.getElementById(`edit-cli-voucher-profile-${id}`);
  
  const type = typeEl?.value || 'local';
  const name = nameEl?.value.trim() || '';
  const nit = nitEl?.value.trim() || '';
  const email = emailEl?.value.trim() || '';
  const address = addressEl?.value.trim() || '';
  const contact = contactEl?.value.trim() || '';
  const isRst = rstEl ? rstEl.checked : false;
  const defaultVoucherProfile = profEl ? profEl.value : 'CREDITO_FISCAL';

  if (!name) { showToast(t('err.fill_fields') || '❌ Completa los campos requeridos', 'error'); return; }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('❌ Ingresa un correo electrónico válido (ejemplo@correo.com)', 'error');
    return;
  }

  const clients = getClients();
  const idx = clients.findIndex(c => c.id === id);
  if (idx !== -1) {
    clients[idx] = { ...clients[idx], name, nit, address, contact, email, type, isRst, defaultVoucherProfile };
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
  const email = document.getElementById('cli-email').value.trim();
  const address = document.getElementById('cli-address').value.trim();
  const contact = document.getElementById('cli-contact').value.trim();
  const rstEl = document.getElementById('cli-rst');
  const isRst = rstEl ? rstEl.checked : false;
  const defaultVoucherProfile = document.getElementById('cli-voucher-profile').value;

  if (!name) { showToast(t('err.fill_fields') || '❌ Completa los campos requeridos', 'error'); return; }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('❌ Ingresa un correo electrónico válido (ejemplo@correo.com)', 'error');
    return;
  }
  
  if (addClient(name, nit, address, contact, type, isRst, email, defaultVoucherProfile)) {
    document.getElementById('cli-name').value = '';
    document.getElementById('cli-nit').value = '';
    document.getElementById('cli-email').value = '';
    document.getElementById('cli-address').value = '';
    document.getElementById('cli-contact').value = '';
    if (rstEl) rstEl.checked = false;
    document.getElementById('cli-type').value = 'local';
    document.getElementById('cli-voucher-profile').value = 'CREDITO_FISCAL';
    handleClientTypeChange('local');
    refreshClientsList();
  }
}

async function handleDeleteClient(id) {
  const ok = await window.AppDialog.confirm('¿Eliminar este registro?', 'Eliminar Cliente');
  if (!ok) return;
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
  const nameEl = document.getElementById('cli-name');

  const nitVal = nitEl ? nitEl.value.trim() : '';
  const nameVal = nameEl ? nameEl.value.trim() : '';

  const query = nitVal || nameVal;

  if (!query) {
    showToast('Ingresa un RNC, Cédula o Razón Social primero', 'warning');
    return;
  }

  const data = await fetchDGIIData(query);
  if (data) {
    if (data.rnc && nitEl) {
      nitEl.value = data.rnc;
    }
    if (data.name && nameEl) {
      nameEl.value = data.name;
    }
    const rstEl = document.getElementById('cli-rst');
    if (rstEl) rstEl.checked = !!data.isRST;
    
    const addrEl = document.getElementById('cli-address');
    const contactEl = document.getElementById('cli-contact');
    
    const clients = getClients();
    const rncToFind = (data.rnc || query).replace(/\D/g, '');
    const localClient = clients.find(c => c.nit && c.nit.replace(/\D/g, '') === rncToFind);
    
    if (localClient) {
      if (addrEl) addrEl.value = localClient.address || '';
      if (contactEl) contactEl.value = localClient.contact || localClient.phone || '';
      showToast('✅ Datos de dirección y teléfono cargados de la base de datos local.', 'success');
    } else {
      if (addrEl && data.address) addrEl.value = data.address;
    }
  }
}

async function autoFillEditClientDGII(id) {
  const nitEl = document.getElementById(`edit-cli-nit-${id}`);
  const nameEl = document.getElementById(`edit-cli-name-${id}`);

  const nitVal = nitEl ? nitEl.value.trim() : '';
  const nameVal = nameEl ? nameEl.value.trim() : '';

  const query = nitVal || nameVal;

  if (!query) {
    showToast('Ingresa un RNC, Cédula o Razón Social primero', 'warning');
    return;
  }

  const data = await fetchDGIIData(query);
  if (data) {
    if (data.rnc && nitEl) {
      nitEl.value = data.rnc;
    }
    if (data.name && nameEl) {
      nameEl.value = data.name;
    }
    const rstEl = document.getElementById(`edit-cli-rst-${id}`);
    if (rstEl) rstEl.checked = !!data.isRST;
    
    const addrEl = document.getElementById(`edit-cli-address-${id}`);
    const contactEl = document.getElementById(`edit-cli-contact-${id}`);
    
    const clients = getClients();
    const rncToFind = (data.rnc || query).replace(/\D/g, '');
    const localClient = clients.find(c => c.nit && c.nit.replace(/\D/g, '') === rncToFind);
    
    if (localClient) {
      if (addrEl) addrEl.value = localClient.address || '';
      if (contactEl) contactEl.value = localClient.contact || localClient.phone || '';
      showToast('✅ Datos de dirección y teléfono cargados de la base de datos local.', 'success');
    } else {
      if (addrEl && data.address) addrEl.value = data.address;
    }
  }
}

// =============================================
// CLIENT PORTAL CODE - Generation & Data
// =============================================

function _generateUniquePortalCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const block = () => Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return 'RC-' + block() + '-' + block();
}

function generateClientPortalCode(clientId) {
  const clients = getClients();
  const idx = clients.findIndex(c => c.id === clientId);
  if (idx === -1) return showToast('❌ Cliente no encontrado', 'error');

  if (clients[idx].portalCode) {
    return showToast('ℹ️ Este cliente ya tiene código: ' + clients[idx].portalCode, 'info');
  }

  // Generate unique code (ensure no duplicates)
  let code;
  const existingCodes = clients.map(c => c.portalCode).filter(Boolean);
  do {
    code = _generateUniquePortalCode();
  } while (existingCodes.includes(code));

  clients[idx].portalCode = code;
  clients[idx].portalDevices = []; // Reset authorized devices
  saveClients(clients);

  _savePortalDataForClient(clients[idx]);
  showToast('🔑 Código generado: ' + code, 'success');

  const listContainer = document.getElementById('clients-list');
  if (listContainer) listContainer.innerHTML = renderClientsList(getClients());
}

function regenerateClientPortalCode(clientId) {
  if (!confirm('⚠️ ¿Regenerar el código de este cliente?\n\nEl código anterior dejará de funcionar y los dispositivos autorizados se resetearán.')) return;

  const clients = getClients();
  const idx = clients.findIndex(c => c.id === clientId);
  if (idx === -1) return showToast('❌ Cliente no encontrado', 'error');

  const oldCode = clients[idx].portalCode;

  // Delete old portal data from API
  if (oldCode) {
    const PORTAL_API = 'http://localhost:3333';
    fetch(PORTAL_API + '/api/portal/' + encodeURIComponent(oldCode), { method: 'DELETE' }).catch(() => {});
  }

  // Generate new unique code
  let code;
  const existingCodes = clients.map(c => c.portalCode).filter(Boolean);
  do {
    code = _generateUniquePortalCode();
  } while (existingCodes.includes(code));

  clients[idx].portalCode = code;
  clients[idx].portalDevices = []; // Reset authorized devices
  saveClients(clients);

  _savePortalDataForClient(clients[idx]);
  showToast('🔁 Nuevo código generado: ' + code, 'success');

  const listContainer = document.getElementById('clients-list');
  if (listContainer) listContainer.innerHTML = renderClientsList(getClients());
}

function refreshPortalData(clientId) {
  const clients = getClients();
  const client = clients.find(c => c.id === clientId);
  if (!client || !client.portalCode) return showToast('❌ Cliente sin código', 'error');

  _savePortalDataForClient(client);
  showToast('🔄 Datos del portal actualizados para ' + client.name, 'success');
}

function _savePortalDataForClient(client) {
  if (!client.portalCode) return;

  const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
  const settings = typeof getSettings === 'function' ? getSettings() : {};
  const cur = typeof getCurrency === 'function' ? getCurrency() : { symbol: 'RD$', code: 'DOP' };

  // Get invoices for this client
  const allInvoices = typeof getAllInvoices === 'function' ? getAllInvoices() : [];
  const clientInvoices = allInvoices.filter(inv => {
    const invClient = (inv.clientName || inv.client || '').trim().toLowerCase();
    return invClient === client.name.trim().toLowerCase() || inv.clientId === client.id;
  });

  // Eco impact
  const ecoStats = typeof calculateEcoImpact === 'function'
    ? calculateEcoImpact(allInvoices, client.name)
    : { totalWeight: 0, treesSaved: 0, co2Avoided: 0, waterSaved: 0, energySaved: 0 };

  // Material breakdown
  const materialMap = {};
  clientInvoices.forEach(inv => {
    (inv.items || []).forEach(item => {
      const name = item.name || item.desc || 'Material';
      if (!materialMap[name]) materialMap[name] = { name, qty: 0, peso: 0, total: 0 };
      materialMap[name].qty += (item.qty || 0);
      materialMap[name].peso += (item.peso || item.weight || 0);
      materialMap[name].total += (item.totalCompra || item.total || 0);
    });
  });

  const portalData = {
    client: { name: client.name, nit: client.nit, type: client.type, email: client.email },
    company: {
      name: settings.companyName || session.companyName || 'Reciminsa',
      rnc: settings.companyRnc || ''
    },
    invoices: clientInvoices.slice(0, 50),
    materials: Object.values(materialMap).sort((a, b) => b.peso - a.peso),
    ecoStats,
    currency: cur,
    generatedDate: new Date().toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' })
  };

  // Send to Portal API
  const PORTAL_API = 'http://localhost:3333';
  fetch(PORTAL_API + '/api/portal/' + encodeURIComponent(client.portalCode), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(portalData)
  })
  .then(res => res.json())
  .then(resp => console.log('✅ Portal API:', resp.message))
  .catch(err => {
    console.warn('⚠️ Portal API no disponible, guardando localmente:', err.message);
    localStorage.setItem('recim_portal_' + client.portalCode, JSON.stringify(portalData));
  });
}

