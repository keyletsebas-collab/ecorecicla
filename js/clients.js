/* =============================================
   CLIENTS.JS – Gestión de Clientes / Empresas
   ============================================= */

function _cliEscapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _clientNormBranchId(branchId) {
  if (typeof normalizeBranchId === 'function') return normalizeBranchId(branchId);
  const clean = branchId == null ? '' : String(branchId).trim();
  return clean || 'SUC-PRINCIPAL';
}

function _clientResolveBranchName(branchId) {
  const id = _clientNormBranchId(branchId);
  if (typeof resolveBranchNameById === 'function') return resolveBranchNameById(id);
  return id === 'SUC-PRINCIPAL' ? 'Sucursal Principal' : id;
}

function _clientResolveBranchLocation(branchId) {
  const id = _clientNormBranchId(branchId);
  try {
    if (typeof getCompanyBranches === 'function') {
      const b = getCompanyBranches().find(x => x && _clientNormBranchId(x.id) === id);
      if (b && b.location) return b.location;
    }
  } catch (_) {}
  return '';
}

function _resolveClientTargetBranchId(branchIdOverride = null) {
  if (branchIdOverride) return _clientNormBranchId(branchIdOverride);
  if (typeof getActiveBranchId === 'function') return _clientNormBranchId(getActiveBranchId());
  return 'SUC-PRINCIPAL';
}

function getAllClientsRaw() {
  try {
    const parsed = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}
window.getAllClientsRaw = getAllClientsRaw;

function getClients(branchIdOverride = null) {
  const targetBranchId = _resolveClientTargetBranchId(branchIdOverride);
  return getAllClientsRaw().filter(c => c && _clientNormBranchId(c.branchId) === targetBranchId);
}
window.getClients = getClients;

function saveClients(clients) {
  localStorage.setItem(userKey('recim_clients'), JSON.stringify(clients));
  if (window.syncPushData) {
    window.syncPushData(true);
  }
}

function addClient(name, nit, address, contact, type = 'local', isRst = false, defaultNcf = '', branchIdOverride = null) {
  const allClients = getAllClientsRaw();
  const targetBranchId = _resolveClientTargetBranchId(branchIdOverride);
  const targetBranchName = _clientResolveBranchName(targetBranchId);
  const id = `cli-${targetBranchId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  allClients.push({
    id,
    name,
    nit,
    address,
    contact,
    type,
    isRst,
    defaultNcf: defaultNcf || (type === 'empresa' ? 'B01' : ''),
    branchId: targetBranchId,
    branchName: targetBranchName,
    createdAt: new Date().toISOString()
  });
  saveClients(allClients);
  showToast(type === 'empresa' ? '✅ Empresa creada' : (t('toast.cli_add') || '✅ Cliente creado'), 'success');
  return true;
}

async function deleteClient(id) {
  const allClients = getAllClientsRaw();
  const client = allClients.find(c => c && c.id === id);
  if (!client) return;

  const canSwitch = typeof canCurrentUserSwitchBranches === 'function' ? canCurrentUserSwitchBranches() : true;
  if (!canSwitch && _clientNormBranchId(client.branchId) !== _resolveClientTargetBranchId(null)) {
    showToast('🔒 No puedes eliminar clientes de otra sucursal.', 'error');
    return;
  }

  const isEmp = client.type === 'empresa';
  const filtered = allClients.filter(c => c && c.id !== id);
  localStorage.setItem(userKey('recim_clients'), JSON.stringify(filtered));
  if (typeof window.recordAuditLog === 'function') {
    window.recordAuditLog({
      actionType: 'client_delete',
      entityType: 'client',
      entityId: id,
      summary: `${isEmp ? 'Empresa' : 'Cliente'} eliminado: ${client.name || id}`,
      branchId: client.branchId,
      branchName: client.branchName
    });
  }
  if (typeof window.syncDeleteEntityFromSupabase === 'function') {
    try { await window.syncDeleteEntityFromSupabase('clients', [id], { pattern: 'recim_clients' }); } catch (_) {}
  } else if (window.syncPushData) {
    try { await window.syncPushData(true); } catch (_) {}
  }
  showToast(isEmp ? '🗑 Empresa eliminada' : (t('toast.cli_del') || '🗑 Cliente eliminado'), 'success');
}

function updateClient(id, name, nit, address, contact, type = 'local', isRst = false, defaultNcf = '', branchIdOverride = null) {
  const allClients = getAllClientsRaw();
  const idx = allClients.findIndex(c => c && c.id === id);
  if (idx === -1) return;
  const branchId = _clientNormBranchId(branchIdOverride || allClients[idx].branchId);
  const resolvedBranchName = _clientResolveBranchName(branchId);
  allClients[idx] = {
    ...allClients[idx],
    name,
    nit,
    address,
    contact,
    type,
    isRst,
    defaultNcf,
    branchId,
    branchName: resolvedBranchName,
    updatedAt: new Date().toISOString()
  };
  saveClients(allClients);
  if (typeof window.recordAuditLog === 'function') {
    window.recordAuditLog({
      actionType: 'client_update',
      entityType: 'client',
      entityId: id,
      summary: `Cliente actualizado: ${name}`,
      branchId,
      branchName: allClients[idx].branchName
    });
  }
  showToast(t('toast.cli_upd') || '✅ Registro actualizado', 'success');
}

function _buildClientBranchOptionsHtml(selectedBranchId, restrictToAssigned = false) {
  const branches = typeof getCompanyBranches === 'function' ? getCompanyBranches() : [];
  const activeBranches = branches.filter(b => b && b.active !== false);
  const targetId = _clientNormBranchId(selectedBranchId);
  if (restrictToAssigned) {
    return `<option value="${_cliEscapeHtml(targetId)}" selected>📍 ${_cliEscapeHtml(_clientResolveBranchName(targetId))}</option>`;
  }
  const list = activeBranches.length > 0 ? [...activeBranches] : [{ id: 'SUC-PRINCIPAL', name: 'Sucursal Principal' }];
  if (!list.some(b => _clientNormBranchId(b.id) === targetId)) {
    list.push({ id: targetId, name: _clientResolveBranchName(targetId) });
  }
  return list.map(b => {
    const bid = _clientNormBranchId(b.id);
    const loc = b.location ? ` — ${b.location}` : '';
    return `<option value="${_cliEscapeHtml(bid)}" ${bid === targetId ? 'selected' : ''}>📍 ${_cliEscapeHtml((b.name || bid) + loc)}</option>`;
  }).join('');
}

function getFilteredClientsForView() {
  const canSwitch = typeof canCurrentUserSwitchBranches === 'function' ? canCurrentUserSwitchBranches() : true;
  if (window.currentClientsBranchFilter === undefined) {
    window.currentClientsBranchFilter = canSwitch ? _resolveClientTargetBranchId(null) : _resolveClientTargetBranchId(null);
  }
  const filterVal = canSwitch ? (window.currentClientsBranchFilter || 'all') : _resolveClientTargetBranchId(null);
  if (filterVal === 'all') {
    return getAllClientsRaw();
  }
  return getClients(filterVal);
}

function setClientsBranchFilter(branchId) {
  window.currentClientsBranchFilter = branchId || 'all';
  refreshClientsList();
}
window.setClientsBranchFilter = setClientsBranchFilter;

// =============================================
// RENDER CLIENTES PAGE
// =============================================

function renderClientesPage(container) {
  const canSwitch = typeof canCurrentUserSwitchBranches === 'function' ? canCurrentUserSwitchBranches() : true;
  const activeBranchId = _resolveClientTargetBranchId(null);
  if (window.currentClientsBranchFilter === undefined) {
    window.currentClientsBranchFilter = canSwitch ? 'all' : activeBranchId;
  }
  const currentFilter = canSwitch ? (window.currentClientsBranchFilter || 'all') : activeBranchId;
  const displayedClients = getFilteredClientsForView();
  const branches = typeof getCompanyBranches === 'function' ? getCompanyBranches().filter(b => b && b.active !== false) : [];
  const branchBarHtml = typeof renderBranchContextBar === 'function' ? renderBranchContextBar('clientes') : '';

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="section-title">👥 Directorio de Clientes y Empresas</h2>
        <p class="section-subtitle">Asigna cada cliente a la sucursal donde compra y administra su historial.</p>
      </div>
    </div>

    ${branchBarHtml}

    <div class="finance-grid">
      <!-- Form -->
      <div class="card card--elevated">
        <h3 class="section-title" style="margin-bottom:16px;"><span>➕ Nuevo Registro</span></h3>
        <div style="display:flex;flex-direction:column;gap:14px;">

          <div class="form-group">
            <label class="form-label" for="cli-branch-select">📍 Sucursal donde compra el cliente <span style="color:#ef4444;">*</span></label>
            <select id="cli-branch-select" class="form-select" ${!canSwitch ? 'disabled' : ''} style="background-color: var(--clr-surface-3); font-weight: 600;">
              ${_buildClientBranchOptionsHtml(activeBranchId, !canSwitch)}
            </select>
            <small style="display:block; margin-top:4px; font-size:0.75rem; color:var(--clr-text-muted);">
              El cliente quedará asignado a esta sucursal para compras, bitácoras y facturación.
            </small>
          </div>
          
          <div class="form-group">
            <label class="form-label">Tipo de Registro</label>
            <select id="cli-type" class="form-input" onchange="handleClientTypeChange(this.value)" style="background-color: var(--clr-surface-3); font-weight: 500;">
              <option value="local">👤 Persona (Local)</option>
              <option value="empresa">🏢 Empresa (Crédito Fiscal)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" id="lbl-cli-name">Nombre / Razón Social <span style="color:#ef4444;">*</span></label>
            <div style="display:flex; gap: 8px;">
              <input id="cli-name" type="text" class="form-input" placeholder="Nombre completo o Razón Social" style="flex:1;" onkeydown="if(event.key==='Enter'){event.preventDefault();autoFillClientByNameDGII();}" />
              <button class="btn-secondary" onclick="autoFillClientByNameDGII()" style="margin:0; padding: 0 15px;" title="Buscar RNC en DGII por Nombre" type="button">🔍</button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" id="lbl-cli-nit">RNC o Cédula</label>
            <div style="display:flex; gap: 8px;">
              <input id="cli-nit" type="text" class="form-input" placeholder="Ej: RNC o Cédula" style="flex:1;" onkeydown="if(event.key==='Enter'){event.preventDefault();autoFillClientDGII();}" />
              <button class="btn-secondary" onclick="autoFillClientDGII()" style="margin:0; padding: 0 15px;" title="Buscar en DGII" type="button">🔍</button>
            </div>
          </div>

          <!-- Secuencia NCF Asignada -->
          <div class="form-group">
            <label class="form-label">Secuencia NCF Predeterminada</label>
            <select id="cli-default-ncf" class="form-select" style="background-color: var(--clr-surface-3);">
              <option value="">-- Sin secuencia predeterminada --</option>
              <option value="B01">B01 - Factura de Crédito Fiscal</option>
              <option value="B02">B02 - Factura de Consumo</option>
              <option value="B14">B14 - Regímenes Especiales</option>
              <option value="B15">B15 - Comprobante Gubernamental</option>
            </select>
            <small style="display:block; margin-top:4px; font-size:0.75rem; color:var(--clr-text-muted);">
              ⚡ Se seleccionará automáticamente al crearle una factura para facturar rápido.
            </small>
          </div>

          <div class="form-group" id="cli-rst-container" style="display:none; flex-direction:column; align-items:center; gap:8px; margin: 4px 0;">
            <input id="cli-rst" type="checkbox" style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--clr-primary);" />
            <label for="cli-rst" style="font-size: 0.85rem; color: var(--clr-text-secondary); cursor: pointer; text-align: center; font-weight: 500;">Acogido al RST (Régimen Simplificado)</label>
          </div>

          <div class="form-group">
            <label class="form-label">${t('hist.address')}</label>
            <input id="cli-address" type="text" class="form-input" placeholder="Dirección física o Email" />
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
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
            <h3 class="section-title" style="margin:0;font-size:1rem;">
              Registros Guardados
              <span class="badge badge--green" id="clients-count-badge" style="margin-left:8px;">${displayedClients.length}</span>
            </h3>
            ${canSwitch ? `
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <select id="clients-branch-filter" class="form-select" style="width:auto; min-width:190px; font-size:0.82rem;" onchange="setClientsBranchFilter(this.value)">
                  <option value="all" ${currentFilter === 'all' ? 'selected' : ''}>🏢 Todas las sucursales</option>
                  ${branches.map(b => {
                    const bid = _clientNormBranchId(b.id);
                    return `<option value="${_cliEscapeHtml(bid)}" ${currentFilter === bid ? 'selected' : ''}>📍 ${_cliEscapeHtml(b.name || bid)}</option>`;
                  }).join('')}
                </select>
                <button type="button" class="btn-secondary" style="font-size:0.78rem; padding:6px 10px;" onclick="setClientsBranchFilter('all')">
                  🏢 Ver todas
                </button>
              </div>
            ` : ''}
          </div>
          <div id="clients-list">
            ${renderClientsList(displayedClients, currentFilter === 'all' ? 'Todas las sucursales' : _clientResolveBranchName(currentFilter))}
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
  const ncfSelect = document.getElementById('cli-default-ncf');
  if (ncfSelect) {
    if (type === 'empresa' && (!ncfSelect.value || ncfSelect.value === 'B02')) {
      ncfSelect.value = 'B01';
    } else if (type === 'local' && (!ncfSelect.value || ncfSelect.value === 'B01')) {
      ncfSelect.value = 'B02';
    }
  }
}
window.handleClientTypeChange = handleClientTypeChange;

function renderClientsList(clients, branchNameOverride = null) {
  const branchLabel = branchNameOverride || _clientResolveBranchName(_resolveClientTargetBranchId(null));
  if (clients.length === 0) {
    return `<p style="color:var(--clr-text-muted);font-size:0.85rem;">Sin clientes ni empresas registradas en <b>${_cliEscapeHtml(branchLabel)}</b> aún.</p>`;
  }

  return clients.map(c => {
    const isEmp = c.type === 'empresa';
    const cBranchId = _clientNormBranchId(c.branchId);
    const cBranchName = c.branchName || _clientResolveBranchName(cBranchId);
    const cBranchLocation = _clientResolveBranchLocation(cBranchId);
    return `
    <div class="material-item" id="cli-row-${_cliEscapeHtml(c.id)}" style="gap:10px;flex-wrap:wrap; align-items: flex-start; padding: 15px;">
      <div style="flex:1; cursor:pointer;" onclick="showClientDetailsModal('${_cliEscapeHtml(c.id)}')" title="Ver detalles completos y sucursal asignada">
        <div style="font-weight: 600; font-size: 1rem; color: var(--clr-text); display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <span>${_cliEscapeHtml(c.name)}</span>
          ${isEmp 
            ? '<span class="badge badge--blue" style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; background:#3b82f6; color:#fff; text-transform:none;">🏢 Empresa</span>' 
            : '<span class="badge" style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; background:#64748b; color:#fff; text-transform:none;">👤 Persona</span>'}
          <span class="badge badge--green" style="font-size: 0.7rem; padding: 3px 8px; border-radius: 6px; font-weight:700; text-transform:none;">📍 Sucursal: ${_cliEscapeHtml(cBranchName)}</span>
          ${c.defaultNcf ? `<span class="badge" style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; background:rgba(16,185,129,0.15); color:#10b981; border:1px solid #10b981; text-transform:none;">⚡ NCF: ${_cliEscapeHtml(c.defaultNcf)}</span>` : ''}
          ${c.isRst ? '<span class="badge badge--green" style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; text-transform:none;">RST</span>' : ''}
        </div>
        <div style="font-size: 0.8rem; color: var(--clr-text-muted); margin-top: 4px;">
          ${c.nit ? `<span style="margin-right: 10px;"><b>RNC/Cédula:</b> ${_cliEscapeHtml(c.nit)}</span>` : ''}
          ${c.contact ? `<span><b>Contacto:</b> ${_cliEscapeHtml(c.contact)}</span>` : ''}
        </div>
        ${c.address ? `<div style="font-size: 0.8rem; color: var(--clr-text-muted); margin-top: 2px;"><b>Dir:</b> ${_cliEscapeHtml(c.address)}</div>` : ''}
        ${cBranchLocation ? `<div style="font-size: 0.74rem; color: #6ee7b7; margin-top: 3px;">📌 Compra en sucursal ubicada en: ${_cliEscapeHtml(cBranchLocation)}</div>` : ''}
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn-secondary" style="padding:5px 10px;font-size:0.8rem;"
                title="Ver detalles del cliente y sucursal"
                onclick="showClientDetailsModal('${_cliEscapeHtml(c.id)}')">
          👁️
        </button>
        <button class="btn-secondary" style="padding:5px 10px;font-size:0.8rem;"
                onclick="showEditClientRow('${_cliEscapeHtml(c.id)}')">
          ✏️
        </button>
        <button class="btn-danger" style="padding:5px 10px;font-size:0.8rem;"
                onclick="handleDeleteClient('${_cliEscapeHtml(c.id)}')">
          🗑
        </button>
      </div>
    </div>`;
  }).join('');
}

function showClientDetailsModal(clientId) {
  const client = getAllClientsRaw().find(c => c && c.id === clientId);
  if (!client) {
    showToast('Cliente no encontrado', 'warning');
    return;
  }

  const branchId = _clientNormBranchId(client.branchId);
  const branchName = client.branchName || _clientResolveBranchName(branchId);
  const branchLocation = _clientResolveBranchLocation(branchId);
  const isEmp = client.type === 'empresa';

  let clientDocs = [];
  try {
    const allInvs = typeof getAllInvoices === 'function' ? getAllInvoices() : [];
    const targetName = (client.name || '').trim().toLowerCase();
    const targetNit = (client.nit || '').replace(/\D/g, '');
    clientDocs = allInvs.filter(inv => {
      if (!inv) return false;
      const invName = (inv.company || inv.client || '').trim().toLowerCase();
      const invNit = (inv.nit || '').replace(/\D/g, '');
      return (client.id && inv.clientId === client.id) ||
             (targetName && invName === targetName) ||
             (targetNit && invNit && targetNit === invNit);
    });
  } catch (_) {}

  const facturasCount = clientDocs.filter(d => d.type !== 'basica').length;
  const bitacorasCount = clientDocs.filter(d => d.type === 'basica').length;

  let modal = document.getElementById('client-detail-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'client-detail-modal';
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  modal.onclick = (ev) => { if (ev.target === modal) modal.remove(); };
  modal.innerHTML = `
    <div class="modal" style="max-width: 600px; width: 95%; background: linear-gradient(160deg, #101c13 0%, #0a110c 100%) !important; border: 1px solid rgba(34, 197, 94, 0.3) !important; border-radius: 14px; padding: 22px; color: var(--clr-text, #f0fdf0); box-shadow: 0 20px 50px rgba(0,0,0,0.85);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid rgba(34,197,94,0.2); padding-bottom:12px;">
        <h3 style="margin:0; font-size:1.18rem;">${isEmp ? '🏢' : '👤'} Detalles del Cliente</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="background:rgba(255,255,255,0.08); border:none; border-radius:50%; width:32px; height:32px; color:var(--clr-text-muted); font-size:1.1rem; cursor:pointer;" type="button">✕</button>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:16px; font-size:0.88rem; background:rgba(0,0,0,0.3); padding:14px; border-radius:10px; border:1px solid rgba(255,255,255,0.06);">
        <div style="grid-column:1 / -1;"><b style="color:var(--clr-text-muted);">Nombre / Razón Social:</b> <strong style="font-size:1rem;">${_cliEscapeHtml(client.name)}</strong></div>
        <div style="grid-column:1 / -1;">
          <b style="color:var(--clr-text-muted);">📍 Sucursal donde compra:</b>
          <span class="badge badge--green" style="font-size:0.82rem; font-weight:700; margin-left:4px;">📍 ${_cliEscapeHtml(branchName)}</span>
          ${branchLocation ? `<div style="font-size:0.78rem; color:#6ee7b7; margin-top:4px;">📌 Ubicación sucursal: ${_cliEscapeHtml(branchLocation)}</div>` : ''}
        </div>
        <div><b style="color:var(--clr-text-muted);">Tipo:</b> ${isEmp ? '🏢 Empresa (Crédito Fiscal)' : '👤 Persona (Local)'}</div>
        <div><b style="color:var(--clr-text-muted);">RNC / Cédula:</b> ${_cliEscapeHtml(client.nit || '—')}</div>
        <div><b style="color:var(--clr-text-muted);">NCF Predeterminado:</b> ${_cliEscapeHtml(client.defaultNcf || 'Sin asignar')}</div>
        <div><b style="color:var(--clr-text-muted);">Régimen RST:</b> ${client.isRst ? 'Sí (Acogido al RST)' : 'No'}</div>
        <div><b style="color:var(--clr-text-muted);">Contacto:</b> ${_cliEscapeHtml(client.contact || '—')}</div>
        <div><b style="color:var(--clr-text-muted);">Operaciones:</b> 🧾 ${facturasCount} fact. • 🚛 ${bitacorasCount} bit.</div>
        <div style="grid-column:1 / -1;"><b style="color:var(--clr-text-muted);">Dirección:</b> ${_cliEscapeHtml(client.address || '—')}</div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove(); showEditClientRow('${_cliEscapeHtml(client.id)}');" type="button" style="padding:8px 14px;">✏️ Editar / Cambiar Sucursal</button>
        <button class="btn-primary" onclick="this.closest('.modal-overlay').remove()" type="button" style="padding:8px 18px;">Cerrar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}
window.showClientDetailsModal = showClientDetailsModal;

// ---- Inline edit row ----
function showEditClientRow(id, currentName, currentNit, currentAddress, currentContact, currentType = 'local', isRst = false, currentDefaultNcf = '') {
  const row = document.getElementById(`cli-row-${id}`);
  if (!row) return;

  const existing = getAllClientsRaw().find(c => c && c.id === id);
  if (existing) {
    currentName = existing.name || '';
    currentNit = existing.nit || '';
    currentAddress = existing.address || '';
    currentContact = existing.contact || '';
    currentType = existing.type || 'local';
    isRst = Boolean(existing.isRst);
    currentDefaultNcf = existing.defaultNcf || '';
  }
  const canSwitch = typeof canCurrentUserSwitchBranches === 'function' ? canCurrentUserSwitchBranches() : true;
  const currentBranchId = _clientNormBranchId(existing?.branchId);

  row.innerHTML = `
    <div style="width: 100%; display: flex; flex-direction: column; gap: 8px;">
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label" style="font-size:0.78rem;">📍 Sucursal Asignada</label>
        <select id="edit-cli-branch-${_cliEscapeHtml(id)}" class="form-select" ${!canSwitch ? 'disabled' : ''} style="background-color: var(--clr-surface-3); font-weight: 600;">
          ${_buildClientBranchOptionsHtml(currentBranchId, !canSwitch)}
        </select>
      </div>

      <div class="form-group" style="margin-bottom:0;">
        <select id="edit-cli-type-${_cliEscapeHtml(id)}" class="form-input" onchange="document.getElementById('edit-cli-rst-container-${_cliEscapeHtml(id)}').style.display = (this.value === 'empresa' ? 'flex' : 'none')" style="background-color: var(--clr-surface-3); font-weight: 500;">
          <option value="local" ${currentType === 'local' ? 'selected' : ''}>👤 Persona (Local)</option>
          <option value="empresa" ${currentType === 'empresa' ? 'selected' : ''}>🏢 Empresa (Crédito Fiscal)</option>
        </select>
      </div>

      <div style="display:flex; gap: 8px;">
        <input id="edit-cli-name-${_cliEscapeHtml(id)}" type="text" class="form-input" value="${_cliEscapeHtml(currentName)}" placeholder="Nombre / Razón Social" style="flex:1;" />
        <button class="btn-secondary" onclick="autoFillEditClientByNameDGII('${_cliEscapeHtml(id)}')" style="margin:0; padding: 0 15px;" title="Buscar RNC por Nombre en DGII" type="button">🔍</button>
      </div>
      
      <div style="display:flex; gap: 8px;">
        <input id="edit-cli-nit-${_cliEscapeHtml(id)}" type="text" class="form-input" value="${_cliEscapeHtml(currentNit)}" placeholder="RNC / Cédula" style="flex:1;" />
        <button class="btn-secondary" onclick="autoFillEditClientDGII('${_cliEscapeHtml(id)}')" style="margin:0; padding: 0 15px;" title="Buscar en DGII por RNC" type="button">🔍</button>
      </div>

      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label" style="font-size:0.78rem;">Secuencia NCF Predeterminada</label>
        <select id="edit-cli-default-ncf-${_cliEscapeHtml(id)}" class="form-select" style="background-color: var(--clr-surface-3); font-size:0.85rem;">
          <option value="" ${!currentDefaultNcf ? 'selected' : ''}>-- Sin secuencia predeterminada --</option>
          <option value="B01" ${currentDefaultNcf === 'B01' ? 'selected' : ''}>B01 - Factura de Crédito Fiscal</option>
          <option value="B02" ${currentDefaultNcf === 'B02' ? 'selected' : ''}>B02 - Factura de Consumo</option>
          <option value="B14" ${currentDefaultNcf === 'B14' ? 'selected' : ''}>B14 - Regímenes Especiales</option>
          <option value="B15" ${currentDefaultNcf === 'B15' ? 'selected' : ''}>B15 - Comprobante Gubernamental</option>
        </select>
      </div>
      
      <div id="edit-cli-rst-container-${_cliEscapeHtml(id)}" style="display:${currentType === 'empresa' ? 'flex' : 'none'}; align-items:center; gap:8px; margin: 4px 0;">
        <input id="edit-cli-rst-${_cliEscapeHtml(id)}" type="checkbox" ${isRst ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--clr-primary);" />
        <label for="edit-cli-rst-${_cliEscapeHtml(id)}" style="font-size: 0.85rem; color: var(--clr-text-secondary); cursor: pointer; font-weight: 500;">Acogido al RST</label>
      </div>
      
      <input id="edit-cli-address-${_cliEscapeHtml(id)}" type="text" class="form-input" value="${_cliEscapeHtml(currentAddress)}" placeholder="Dirección / Email" />
      <input id="edit-cli-contact-${_cliEscapeHtml(id)}" type="text" class="form-input" value="${_cliEscapeHtml(currentContact)}" placeholder="Contacto" />
      
      <div style="display:flex;gap:6px;margin-top:4px;">
        <button class="btn-primary" style="padding:6px 14px;font-size:0.82rem;"
                onclick="saveEditClientRow('${_cliEscapeHtml(id)}')">✓ Guardar</button>
        <button class="btn-secondary" style="padding:6px 10px;font-size:0.82rem;"
                onclick="cancelEditClientRow()">✕</button>
      </div>
    </div>
  `;
}

function saveEditClientRow(id) {
  const branchEl = document.getElementById(`edit-cli-branch-${id}`);
  const typeEl = document.getElementById(`edit-cli-type-${id}`);
  const nameEl = document.getElementById(`edit-cli-name-${id}`);
  const nitEl = document.getElementById(`edit-cli-nit-${id}`);
  const addressEl = document.getElementById(`edit-cli-address-${id}`);
  const contactEl = document.getElementById(`edit-cli-contact-${id}`);
  const rstEl = document.getElementById(`edit-cli-rst-${id}`);
  const defaultNcfEl = document.getElementById(`edit-cli-default-ncf-${id}`);
  
  const type = typeEl?.value || 'local';
  const name = nameEl?.value.trim() || '';
  const nit = nitEl?.value.trim() || '';
  const address = addressEl?.value.trim() || '';
  const contact = contactEl?.value.trim() || '';
  const isRst = rstEl ? rstEl.checked : false;
  const defaultNcf = defaultNcfEl?.value || '';

  if (!name) { showToast(t('err.fill_fields') || '❌ Completa los campos requeridos', 'error'); return; }

  const allClients = getAllClientsRaw();
  const idx = allClients.findIndex(c => c && c.id === id);
  if (idx !== -1) {
    const branchId = _clientNormBranchId(branchEl?.value || allClients[idx].branchId);
    allClients[idx] = {
      ...allClients[idx],
      name,
      nit,
      address,
      contact,
      type,
      isRst,
      defaultNcf,
      branchId,
      branchName: _clientResolveBranchName(branchId),
      updatedAt: new Date().toISOString()
    };
    saveClients(allClients);
    showToast(t('toast.cli_upd') || '✅ Registro actualizado', 'success');
  }
  refreshClientsList();
}

function cancelEditClientRow() {
  refreshClientsList();
}

// ---- Handlers ----
function handleAddClient() {
  const branchSelect = document.getElementById('cli-branch-select');
  const selectedBranchId = branchSelect ? branchSelect.value : null;
  const type = document.getElementById('cli-type').value;
  const name = document.getElementById('cli-name').value.trim();
  const nit = document.getElementById('cli-nit').value.trim();
  const address = document.getElementById('cli-address').value.trim();
  const contact = document.getElementById('cli-contact').value.trim();
  const rstEl = document.getElementById('cli-rst');
  const isRst = rstEl ? rstEl.checked : false;
  const defaultNcf = document.getElementById('cli-default-ncf')?.value || '';

  if (!name) { showToast(t('err.fill_fields') || '❌ Completa los campos requeridos', 'error'); return; }
  
  if (addClient(name, nit, address, contact, type, isRst, defaultNcf, selectedBranchId)) {
    document.getElementById('cli-name').value = '';
    document.getElementById('cli-nit').value = '';
    document.getElementById('cli-address').value = '';
    document.getElementById('cli-contact').value = '';
    if (rstEl) rstEl.checked = false;
    document.getElementById('cli-type').value = 'local';
    document.getElementById('cli-default-ncf').value = '';
    handleClientTypeChange('local');
    if (selectedBranchId && window.currentClientsBranchFilter !== 'all') {
      window.currentClientsBranchFilter = _clientNormBranchId(selectedBranchId);
    }
    refreshClientsList();
  }
}

async function handleDeleteClient(id) {
  const ok = await window.AppDialog.confirm('¿Eliminar este registro?', 'Eliminar Cliente');
  if (!ok) return;
  await deleteClient(id);
  refreshClientsList();
}

function refreshClientsList() {
  const listEl = document.getElementById('clients-list');
  const filterSelect = document.getElementById('clients-branch-filter');
  const currentFilter = window.currentClientsBranchFilter || 'all';
  if (filterSelect && filterSelect.value !== currentFilter) {
    filterSelect.value = currentFilter;
  }
  if (listEl) {
    const clients = getFilteredClientsForView();
    const header = document.getElementById('clients-count-badge') || listEl.closest('.card')?.querySelector('h3 .badge');
    if (header) header.textContent = clients.length;
    const label = currentFilter === 'all' ? 'Todas las sucursales' : _clientResolveBranchName(currentFilter);
    listEl.innerHTML = renderClientsList(clients, label);
  }
}

// ---- DGII Lookup Helpers ----

/**
 * Busca el RNC de una empresa por su nombre o razón social en la DGII.
 */
async function autoFillClientByNameDGII() {
  const nameEl = document.getElementById('cli-name');
  if (!nameEl) return;
  const val = nameEl.value.trim();
  if (!val) {
    showToast('Ingresa un nombre o razón social para buscar en la DGII', 'warning');
    return;
  }

  const results = await searchDGIICompanies(val);
  if (!results || results.length === 0) return;

  if (results.length === 1) {
    applyDGIICompanyToClientForm(results[0]);
  } else {
    openDGIICompanyPickerModal(results, (selected) => {
      applyDGIICompanyToClientForm(selected);
    });
  }
}

function applyDGIICompanyToClientForm(data) {
  const nameEl = document.getElementById('cli-name');
  const nitEl = document.getElementById('cli-nit');
  const typeEl = document.getElementById('cli-type');
  const rstEl = document.getElementById('cli-rst');
  const ncfEl = document.getElementById('cli-default-ncf');

  if (nameEl) nameEl.value = data.name;
  if (nitEl) nitEl.value = data.rnc;
  if (typeEl) {
    typeEl.value = 'empresa';
    handleClientTypeChange('empresa');
  }
  if (rstEl) rstEl.checked = !!data.isRST;
  if (ncfEl) ncfEl.value = 'B01'; // Empresa Crédito Fiscal por defecto

  showToast(`✅ Empresa vinculada: ${data.rnc} (${data.name})`, 'success');
}

/**
 * Busca por nombre en modo edición
 */
async function autoFillEditClientByNameDGII(id) {
  const nameEl = document.getElementById(`edit-cli-name-${id}`);
  if (!nameEl) return;
  const val = nameEl.value.trim();
  if (!val) {
    showToast('Ingresa un nombre para buscar en la DGII', 'warning');
    return;
  }

  const results = await searchDGIICompanies(val);
  if (!results || results.length === 0) return;

  if (results.length === 1) {
    applyDGIICompanyToEditClientRow(id, results[0]);
  } else {
    openDGIICompanyPickerModal(results, (selected) => {
      applyDGIICompanyToEditClientRow(id, selected);
    });
  }
}

function applyDGIICompanyToEditClientRow(id, data) {
  const nameEl = document.getElementById(`edit-cli-name-${id}`);
  const nitEl = document.getElementById(`edit-cli-nit-${id}`);
  const typeEl = document.getElementById(`edit-cli-type-${id}`);
  const rstEl = document.getElementById(`edit-cli-rst-${id}`);
  const ncfEl = document.getElementById(`edit-cli-default-ncf-${id}`);
  const rstContainer = document.getElementById(`edit-cli-rst-container-${id}`);

  if (nameEl) nameEl.value = data.name;
  if (nitEl) nitEl.value = data.rnc;
  if (typeEl) {
    typeEl.value = 'empresa';
    if (rstContainer) rstContainer.style.display = 'flex';
  }
  if (rstEl) rstEl.checked = !!data.isRST;
  if (ncfEl) ncfEl.value = 'B01';

  showToast(`✅ Empresa vinculada: ${data.rnc} (${data.name})`, 'success');
}

async function autoFillClientDGII() {
  const nitEl = document.getElementById('cli-nit');
  const nameEl = document.getElementById('cli-name');
  if (!nitEl) return;
  const val = nitEl.value.trim();

  // Si no hay RNC pero hay nombre, buscar por nombre automáticamente
  if (!val) {
    if (nameEl && nameEl.value.trim()) {
      autoFillClientByNameDGII();
      return;
    }
    showToast('Ingresa un RNC o nombre de empresa primero', 'warning');
    return;
  }

  const data = await fetchDGIIData(val);
  if (data) {
    if (data.rnc) {
      nitEl.value = data.rnc;
    }
    if (nameEl) nameEl.value = data.name;
    const rstEl = document.getElementById('cli-rst');
    if (rstEl) rstEl.checked = !!data.isRST;
    
    // Autoasignar tipo empresa y secuencia B01 si es RNC de 9 dígitos
    const cleanId = (data.rnc || val).replace(/\D/g, '');
    if (cleanId.length === 9) {
      const typeEl = document.getElementById('cli-type');
      if (typeEl) {
        typeEl.value = 'empresa';
        handleClientTypeChange('empresa');
      }
      const ncfEl = document.getElementById('cli-default-ncf');
      if (ncfEl && !ncfEl.value) ncfEl.value = 'B01';
    }

    const addrEl = document.getElementById('cli-address');
    const contactEl = document.getElementById('cli-contact');
    
    const clients = getClients();
    const localClient = clients.find(c => c.nit && c.nit.replace(/\D/g, '') === cleanId);
    
    if (localClient) {
      if (addrEl) addrEl.value = localClient.address || '';
      if (contactEl) contactEl.value = localClient.contact || localClient.phone || '';
      showToast('✅ Datos de dirección y teléfono cargados de la base de datos local.', 'success');
    } else {
      if (addrEl) addrEl.value = data.address || '';
    }
  }
}

async function autoFillEditClientDGII(id) {
  const nitEl = document.getElementById(`edit-cli-nit-${id}`);
  const nameEl = document.getElementById(`edit-cli-name-${id}`);
  if (!nitEl) return;
  const val = nitEl.value.trim();

  if (!val) {
    if (nameEl && nameEl.value.trim()) {
      autoFillEditClientByNameDGII(id);
      return;
    }
    showToast('Ingresa un RNC o nombre de empresa primero', 'warning');
    return;
  }

  const data = await fetchDGIIData(val);
  if (data) {
    if (data.rnc) {
      nitEl.value = data.rnc;
    }
    if (nameEl) nameEl.value = data.name;
    const rstEl = document.getElementById(`edit-cli-rst-${id}`);
    if (rstEl) rstEl.checked = !!data.isRST;
    
    const cleanId = (data.rnc || val).replace(/\D/g, '');
    if (cleanId.length === 9) {
      const typeEl = document.getElementById(`edit-cli-type-${id}`);
      if (typeEl) {
        typeEl.value = 'empresa';
        const rstContainer = document.getElementById(`edit-cli-rst-container-${id}`);
        if (rstContainer) rstContainer.style.display = 'flex';
      }
      const ncfEl = document.getElementById(`edit-cli-default-ncf-${id}`);
      if (ncfEl && !ncfEl.value) ncfEl.value = 'B01';
    }

    const addrEl = document.getElementById(`edit-cli-address-${id}`);
    const contactEl = document.getElementById(`edit-cli-contact-${id}`);
    
    const clients = getClients();
    const rncToFind = (data.rnc || val).replace(/\D/g, '');
    const localClient = clients.find(c => c.nit && c.nit.replace(/\D/g, '') === rncToFind);
    
    if (localClient) {
      if (addrEl) addrEl.value = localClient.address || '';
      if (contactEl) contactEl.value = localClient.contact || localClient.phone || '';
      showToast('✅ Datos de dirección y teléfono cargados de la base de datos local.', 'success');
    } else {
      if (addrEl) addrEl.value = data.address || '';
    }
  }
}

window.autoFillClientByNameDGII = autoFillClientByNameDGII;
window.autoFillEditClientByNameDGII = autoFillEditClientByNameDGII;
window.autoFillClientDGII = autoFillClientDGII;
window.autoFillEditClientDGII = autoFillEditClientDGII;
window.renderClientesPage = renderClientesPage;
window.handleAddClient = handleAddClient;
window.handleDeleteClient = handleDeleteClient;
window.showEditClientRow = showEditClientRow;
window.saveEditClientRow = saveEditClientRow;
window.cancelEditClientRow = cancelEditClientRow;
