/* =============================================
   CLIENTS.JS – Gestión de Clientes / Empresas
   ============================================= */

function getClients() {
  return JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
}

function saveClients(clients) {
  localStorage.setItem(userKey('recim_clients'), JSON.stringify(clients));
}

function addClient(name, nit, address, contact) {
  const clients = getClients();
  const id = `cli-${Date.now()}`;
  clients.push({ id, name, nit, address, contact });
  saveClients(clients);
  showToast(t('toast.cli_add') || '✅ Cliente creado', 'success');
  return true;
}

function deleteClient(id) {
  const clients = getClients().filter(c => c.id !== id);
  saveClients(clients);
  showToast(t('toast.cli_del') || '🗑 Cliente eliminado', 'success');
}

function updateClient(id, name, nit, address, contact) {
  const clients = getClients();
  const idx = clients.findIndex(c => c.id === id);
  if (idx === -1) return;
  clients[idx] = { ...clients[idx], name, nit, address, contact };
  saveClients(clients);
  showToast(t('toast.cli_upd') || '✅ Cliente actualizado', 'success');
}

// =============================================
// RENDER CLIENTES PAGE
// =============================================

function renderClientesPage(container) {
  const clients = getClients();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="section-title">${t('cli.title') || '👥 Clientes y Empresas'}</h2>
        <p class="section-subtitle">${t('cli.subtitle') || 'Gestiona la información de tus clientes frecuentes'}</p>
      </div>
    </div>

    <div class="finance-grid">
      <!-- Form -->
      <div class="card card--elevated">
        <h3 class="section-title" style="margin-bottom:16px;">${t('cli.new_client') || 'Nuevo Cliente'}</h3>
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div class="form-group">
            <label class="form-label">${t('lbl.name') || 'Nombre / Razón Social'}</label>
            <input id="cli-name" type="text" class="form-input" placeholder="Ej: Recicladora Nacional" />
          </div>
          <div class="form-group">
            <label class="form-label">${t('hist.nit') || 'RNC / Identificación'}</label>
            <input id="cli-nit" type="text" class="form-input" placeholder="Opcional" />
          </div>
          <div class="form-group">
            <label class="form-label">${t('hist.address') || 'Dirección / Ubicación'}</label>
            <input id="cli-address" type="text" class="form-input" placeholder="Opcional" />
          </div>
          <div class="form-group">
            <label class="form-label">${t('hist.contact') || 'Contacto (Tel/Email)'}</label>
            <input id="cli-contact" type="text" class="form-input" placeholder="Opcional" />
          </div>
          <button class="btn-primary" onclick="handleAddClient()">${t('cli.btn') || '👥 Crear Cliente'}</button>
        </div>
      </div>

      <!-- Lists -->
      <div>
        <div class="card card--elevated" style="margin-bottom:16px;">
          <h3 class="section-title" style="margin-bottom:12px;font-size:1rem;">
            ${t('cli.my_clients') || 'Mis Clientes'}
            <span class="badge badge--green" style="margin-left:8px;">${clients.length}</span>
          </h3>
          <div id="clients-list">
            ${renderClientsList(clients)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderClientsList(clients) {
  if (clients.length === 0) {
    return `<p style="color:var(--clr-text-muted);font-size:0.85rem;">${t('cli.no_clients') || 'Sin clientes registrados aún.'}</p>`;
  }

  return clients.map(c => `
    <div class="material-item" id="cli-row-${c.id}" style="gap:10px;flex-wrap:wrap; align-items: flex-start; padding: 15px;">
      <div style="flex:1;">
        <div style="font-weight: 600; font-size: 1rem; color: var(--clr-text);">${c.name}</div>
        <div style="font-size: 0.8rem; color: var(--clr-text-muted); margin-top: 4px;">
          ${c.nit ? `<span style="margin-right: 10px;"><b>ID:</b> ${c.nit}</span>` : ''}
          ${c.contact ? `<span><b>Contacto:</b> ${c.contact}</span>` : ''}
        </div>
        ${c.address ? `<div style="font-size: 0.8rem; color: var(--clr-text-muted); margin-top: 2px;"><b>Dir:</b> ${c.address}</div>` : ''}
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn-secondary" style="padding:5px 10px;font-size:0.8rem;"
                onclick="showEditClientRow('${c.id}', '${c.name.replace(/'/g, "\\'")}', '${(c.nit || '').replace(/'/g, "\\'")}', '${(c.address || '').replace(/'/g, "\\'")}', '${(c.contact || '').replace(/'/g, "\\'")}')">
          ✏️
        </button>
        <button class="btn-danger" style="padding:5px 10px;font-size:0.8rem;"
                onclick="handleDeleteClient('${c.id}')">
          🗑
        </button>
      </div>
    </div>`).join('');
}

// ---- Inline edit row ----
function showEditClientRow(id, currentName, currentNit, currentAddress, currentContact) {
  const row = document.getElementById(`cli-row-${id}`);
  if (!row) return;

  row.innerHTML = `
    <div style="width: 100%; display: flex; flex-direction: column; gap: 8px;">
      <input id="edit-cli-name-${id}" type="text" class="form-input" value="${currentName}" placeholder="Nombre" />
      <input id="edit-cli-nit-${id}" type="text" class="form-input" value="${currentNit}" placeholder="RNC/ID" />
      <input id="edit-cli-address-${id}" type="text" class="form-input" value="${currentAddress}" placeholder="Dirección" />
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
  const nameEl = document.getElementById(`edit-cli-name-${id}`);
  const nitEl = document.getElementById(`edit-cli-nit-${id}`);
  const addressEl = document.getElementById(`edit-cli-address-${id}`);
  const contactEl = document.getElementById(`edit-cli-contact-${id}`);
  
  const name = nameEl?.value.trim() || '';
  const nit = nitEl?.value.trim() || '';
  const address = addressEl?.value.trim() || '';
  const contact = contactEl?.value.trim() || '';

  if (!name) { showToast(t('err.fill_fields') || '❌ Completa los campos requeridos', 'error'); return; }

  updateClient(id, name, nit, address, contact);
  refreshClientsList();
}

function cancelEditClientRow() {
  refreshClientsList();
}

// ---- Handlers ----
function handleAddClient() {
  const name = document.getElementById('cli-name').value.trim();
  const nit = document.getElementById('cli-nit').value.trim();
  const address = document.getElementById('cli-address').value.trim();
  const contact = document.getElementById('cli-contact').value.trim();

  if (!name) { showToast(t('err.fill_fields') || '❌ Completa los campos requeridos', 'error'); return; }
  
  if (addClient(name, nit, address, contact)) {
    document.getElementById('cli-name').value = '';
    document.getElementById('cli-nit').value = '';
    document.getElementById('cli-address').value = '';
    document.getElementById('cli-contact').value = '';
    refreshClientsList();
  }
}

function handleDeleteClient(id) {
  if (!confirm('¿Eliminar este cliente?')) return;
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
