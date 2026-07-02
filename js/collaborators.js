/* =============================================
   COLLABORATORS.JS – Gestión de Colaboradores
   ============================================= */

async function renderCollaboratorsPage(container) {
  const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
  const familyId = session.familyId;

  if (!familyId) {
    container.innerHTML = `
      <div class="card card--elevated" style="max-width: 800px; margin: 20px auto; padding: 30px; text-align: center;">
        <span style="font-size: 3rem; display: block; margin-bottom: 15px;">⚠️</span>
        <h3 style="margin-bottom: 10px; color: var(--clr-danger);">Sección Restringida</h3>
        <p style="color: var(--clr-text-muted); font-size: 0.9rem; max-width: 500px; margin: 0 auto 20px auto;">
          Para gestionar colaboradores, primero debes estar registrado y activo dentro de una Empresa.
        </p>
        <button class="btn-primary" style="margin:0 auto; justify-content:center;" onclick="navigate('ajustes')">🏢 Ir a Ajustes de Empresa</button>
      </div>
    `;
    return;
  }

  // Load collaborators and admin key
  const colabs = JSON.parse(localStorage.getItem(userKey('recim_collaborators')) || '[]');
  let companyAdmin = localStorage.getItem(userKey('recim_company_admin'));
  if (companyAdmin && companyAdmin.startsWith('"') && companyAdmin.endsWith('"')) {
    try { companyAdmin = JSON.parse(companyAdmin); } catch (_) {}
  }
  const isAdmin = companyAdmin === session.accountId;

  const isEn = (getSettings().language === 'en');

  // Render main card structures
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="section-title">${isEn ? '👥 Collaborator Management' : '👥 Gestión de Colaboradores'}</h2>
        <p class="section-subtitle">${isEn ? 'Administration, roles and control of activities of your company collaborators.' : 'Administración, roles y control de actividades de los colaboradores de tu empresa.'}</p>
      </div>
    </div>

    <div style="max-width: 950px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; padding-bottom: 40px;">
      
      <!-- SECCIÓN 1: GESTIÓN DE COLABORADORES -->
      <div class="card card--elevated">
        <h3 class="settings-section-title" style="margin-bottom: 6px; border-bottom: 2px solid var(--clr-primary); padding-bottom: 8px;">
          ${isEn ? '👥 Section 1: Collaborator Management' : '👥 Sección 1: Gestión de Colaboradores'}
        </h3>
        <p style="font-size:0.8rem; color:var(--clr-text-muted); margin-bottom: 20px;">
          ${isEn ? 'Register new company collaborators and link them to their respective user accounts.' : 'Registra nuevos colaboradores de la empresa y asócialos con sus respectivas cuentas de usuario.'}
        </p>
        
        <!-- Subsección 1.1: Registro de Colaborador -->
        <div style="background: var(--clr-surface-3, #f5f5f5); border-radius: var(--r-md, 8px); padding: 18px; margin-bottom: 20px; border: 1px solid var(--clr-border);">
          <h4 style="margin-top:0; margin-bottom: 14px; font-size: 0.92rem; color: var(--clr-primary-light); font-weight:700; display: flex; align-items: center; gap: 6px;">
            <span>${isEn ? '➕ Subsection 1.1: Register New Collaborator' : '➕ Subsección 1.1: Registrar Nuevo Colaborador'}</span>
          </h4>
          <div id="colab-creation-container">
            ${isAdmin ? `
              <div class="form-row" style="grid-template-columns: 1fr 1fr; margin-bottom: 12px;">
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label" style="font-size:0.75rem;">${isEn ? 'Full Name' : 'Nombre Completo'} <span style="color:#ef4444;">*</span></label>
                  <input type="text" id="colab-reg-name" class="form-input" placeholder="${isEn ? 'Collaborator name' : 'Nombre del colaborador'}" />
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label" style="font-size:0.75rem;">${isEn ? 'Role / Position' : 'Rol / Puesto'} <span style="color:#ef4444;">*</span></label>
                  <input type="text" id="colab-reg-role" class="form-input" placeholder="${isEn ? 'Ej: Weigher, Operator, Cashier' : 'Ej: Pesador, Operario, Caja'}" />
                </div>
              </div>
              <div class="form-row" style="grid-template-columns: 1fr 1fr; margin-bottom: 12px;">
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label" style="font-size:0.75rem;">${isEn ? 'Contact Phone' : 'Teléfono de Contacto'}</label>
                  <input type="text" id="colab-reg-phone" class="form-input" placeholder="Ej: 809-555-0199" />
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label" style="font-size:0.75rem;">${isEn ? 'Email Address' : 'Correo Electrónico'}</label>
                  <input type="email" id="colab-reg-email" class="form-input" placeholder="Ej: colaborador@empresa.com" />
                </div>
              </div>
              <div class="form-row" style="grid-template-columns: 1fr; margin-bottom: 18px;">
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label" style="font-size:0.75rem;">${isEn ? 'Link to Company Member Account' : 'Vincular a Cuenta de Miembro de Empresa'}</label>
                  <select id="colab-reg-account" class="form-select">
                    <option value="">${isEn ? '-- Load company members --' : '-- Cargar miembros de empresa --'}</option>
                  </select>
                </div>
              </div>
              <button class="btn-primary" style="width: 100%; justify-content: center; height: 42px;" onclick="handleCreateCollaborator()">
                ${isEn ? '💾 Register Collaborator' : '💾 Registrar Colaborador'}
              </button>
            ` : `
              <div style="text-align:center; padding: 12px; color: var(--clr-danger); font-size: 0.85rem; font-weight: 500;">
                ${isEn ? '🔒 Only the Company Administrator (group creator) has permissions to register or discharge collaborators.' : '🔒 Solo el Administrador de la Empresa (quien creó el grupo) tiene permisos para registrar o dar de baja colaboradores.'}
              </div>
            `}
          </div>
        </div>

        <!-- Subsección 1.2: Colaboradores Registrados -->
        <div style="background: var(--clr-surface-3, #f5f5f5); border-radius: var(--r-md, 8px); padding: 18px; border: 1px solid var(--clr-border);">
          <h4 style="margin-top:0; margin-bottom: 14px; font-size: 0.92rem; color: var(--clr-primary-light); font-weight:700; display: flex; align-items: center; gap: 6px;">
            <span>${isEn ? '📋 Subsection 1.2: Active Collaborators' : '📋 Subsección 1.2: Colaboradores Activos'}</span>
          </h4>
          <div style="overflow-x: auto;">
            <table class="data-table" style="width: 100%; font-size: 0.85rem;">
              <thead>
                <tr>
                  <th style="text-align:left;">${isEn ? 'Name' : 'Nombre'}</th>
                  <th style="text-align:left;">${isEn ? 'Role' : 'Rol'}</th>
                  <th style="text-align:left;">${isEn ? 'Phone / Email' : 'Teléfono / Email'}</th>
                  <th style="text-align:left;">${isEn ? 'Linked Account' : 'Cuenta Vinculada'}</th>
                  <th style="text-align:left; width: 220px;">${isEn ? 'Enabled Modules' : 'Módulos Habilitados'}</th>
                  <th style="text-align:center; width: 80px;">${isEn ? 'Actions' : 'Acciones'}</th>
                </tr>
              </thead>
              <tbody id="colab-list-table-body">
                <tr><td colspan="6" style="text-align:center; color:var(--clr-text-muted);">${isEn ? 'Loading list...' : 'Cargando lista...'}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- SECCIÓN 2: CONTROL DE ACTIVIDADES -->
      <div class="card card--elevated">
        <h3 class="settings-section-title" style="margin-bottom: 6px; border-bottom: 2px solid var(--clr-primary); padding-bottom: 8px;">
          ${isEn ? '📊 Section 2: Activity Control' : '📊 Sección 2: Control de Actividades'}
        </h3>
        <p style="font-size:0.8rem; color:var(--clr-text-muted); margin-bottom: 20px;">
          ${isEn ? 'Monitor the number of records and incidents entered by your collaborators.' : 'Monitorea la cantidad de registros e incidencias ingresados por tus colaboradores.'}
        </p>
        
        <!-- Subsección 2.1: Actividad de Registros -->
        <div style="background: var(--clr-surface-3, #f5f5f5); border-radius: var(--r-md, 8px); padding: 18px; margin-bottom: 20px; border: 1px solid var(--clr-border);">
          <h4 style="margin-top:0; margin-bottom: 14px; font-size: 0.92rem; color: var(--clr-primary-light); font-weight:700;">
            ${isEn ? '📈 Subsection 2.1: Records per Collaborator' : '📈 Subsección 2.1: Registros por Colaborador'}
          </h4>
          <div style="overflow-x: auto;">
            <table class="data-table" style="width: 100%; font-size: 0.85rem;">
              <thead>
                <tr>
                  <th style="text-align:left;">${isEn ? 'Collaborator' : 'Colaborador'}</th>
                  <th style="text-align:left;">${isEn ? 'Role' : 'Rol'}</th>
                  <th style="text-align:center;">${isEn ? 'Invoices Created' : 'Facturas Creadas'}</th>
                  <th style="text-align:center;">${isEn ? 'Total Billed' : 'Monto Total Facturado'}</th>
                </tr>
              </thead>
              <tbody id="colab-activity-table-body">
                <tr><td colspan="4" style="text-align:center; color:var(--clr-text-muted);">${isEn ? 'Loading stats...' : 'Cargando estadísticas...'}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Subsección 2.2: Logs / Asignaciones -->
        <div style="background: var(--clr-surface-3, #f5f5f5); border-radius: var(--r-md, 8px); padding: 18px; border: 1px solid var(--clr-border);">
          <h4 style="margin-top:0; margin-bottom: 14px; font-size: 0.92rem; color: var(--clr-primary-light); font-weight:700;">
            ${isEn ? '🛠️ Subsection 2.2: IT Support Logs' : '🛠️ Subsección 2.2: Registros de Soporte IT'}
          </h4>
          <div style="overflow-x: auto;">
            <table class="data-table" style="width: 100%; font-size: 0.85rem;">
              <thead>
                <tr>
                  <th style="text-align:left;">${isEn ? 'Ticket ID' : 'Ticket ID'}</th>
                  <th style="text-align:left;">${isEn ? 'Reporting Collaborator' : 'Colaborador Reportante'}</th>
                  <th style="text-align:left;">${isEn ? 'Report Title' : 'Título del Reporte'}</th>
                  <th style="text-align:center;">${isEn ? 'Status' : 'Estado'}</th>
                </tr>
              </thead>
              <tbody id="colab-support-table-body">
                <tr><td colspan="4" style="text-align:center; color:var(--clr-text-muted);">${isEn ? 'Loading IT tickets...' : 'Cargando tickets de soporte...'}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  `;

  // Asynchronously populate member select & list to optimize page rendering speed
  if (isAdmin) {
    loadCompanyMembersDropdown(familyId);
  }
  renderCollaboratorsTable(colabs, isAdmin);
  renderCollaboratorsActivity(colabs);
  renderCollaboratorsSupport(colabs);
}

async function loadCompanyMembersDropdown(familyId) {
  const select = document.getElementById('colab-reg-account');
  if (!select) return;

  try {
    if (!isSupabaseActive || !supabaseClient) {
      select.innerHTML = '<option value="">-- Supabase inactivo (No se pueden vincular cuentas) --</option>';
      return;
    }

    const { data: members, error } = await supabaseClient
      .from('profiles')
      .select('id, name, email')
      .eq('family_id', familyId);

    if (error) throw error;

    let html = '<option value="">-- No vincular a ninguna cuenta --</option>';
    if (members && members.length > 0) {
      members.forEach(m => {
        const cleanName = (m.name || 'Sin nombre').split(' | ')[0].trim();
        html += `<option value="${m.id}">${cleanName} (${m.email || 'sin email'})</option>`;
      });
    } else {
      html = '<option value="">-- No hay otros miembros registrados --</option>';
    }
    select.innerHTML = html;
  } catch (err) {
    console.error('Error cargando miembros:', err);
    select.innerHTML = '<option value="">-- Error cargando miembros --</option>';
  }
}

const COLLAB_TOGGLEABLE_MODULES = [
  { id: 'bitacoras', label: '🚛 Bitácoras de Recogida' },
  { id: 'facturas', label: '🧾 Facturación' },
  { id: 'codigos', label: '🏷️ Códigos de Materiales' },
  { id: 'clientes', label: '👥 Clientes' },
  { id: 'ingresos', label: '📈 Ingresos' },
  { id: 'egresos', label: '📉 Egresos' },
  { id: 'empresas', label: '🏢 Registro de Empresas' },
  { id: 'ecologia', label: '🌱 Impacto medioambiental' }
];

function renderCollaboratorsTable(colabs, isAdmin) {
  const tbody = document.getElementById('colab-list-table-body');
  if (!tbody) return;

  if (colabs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--clr-text-muted); padding:15px;">No hay colaboradores registrados.</td></tr>`;
    return;
  }

  let html = '';
  colabs.forEach((c, index) => {
    if (!c.modules) {
      c.modules = {};
      COLLAB_TOGGLEABLE_MODULES.forEach(m => c.modules[m.id] = true);
    }

    let modulesHtml = '';
    if (isAdmin) {
      modulesHtml = `<div style="display:flex; flex-direction:column; gap:4px; max-height:120px; overflow-y:auto; padding:6px; background:var(--clr-surface-3); border:1px solid var(--clr-border); border-radius:4px;">` + 
        COLLAB_TOGGLEABLE_MODULES.map(m => `
          <label style="display:flex; align-items:center; gap:6px; font-size:0.75rem; cursor:pointer; user-select:none; margin:0;">
            <input type="checkbox" ${c.modules[m.id] !== false ? 'checked' : ''} onchange="toggleCollaboratorModule(${index}, '${m.id}', this.checked)" style="width:13px; height:13px; cursor:pointer; margin:0;" />
            <span>${m.label}</span>
          </label>
        `).join('') + `</div>`;
    } else {
      modulesHtml = `<div style="display:flex; flex-wrap:wrap; gap:4px;">` + 
        COLLAB_TOGGLEABLE_MODULES.map(m => {
          if (c.modules[m.id] !== false) {
            return `<span class="badge badge--blue" style="font-size:0.65rem; padding: 2px 6px; border-radius: 4px;">${m.label.split(' ')[0]} ${m.label.substring(m.label.indexOf(' ') + 1)}</span>`;
          }
          return '';
        }).join('') + `</div>`;
    }

    html += `
      <tr>
        <td style="font-weight:600; color:var(--clr-text);">${c.name}</td>
        <td><span class="badge badge--green">${c.role}</span></td>
        <td>
          <div style="font-size:0.8rem; color:var(--clr-text-secondary);">${c.phone || '—'}</div>
          <div style="font-size:0.75rem; color:var(--clr-text-muted);">${c.email || '—'}</div>
        </td>
        <td>
          <span style="font-size:0.78rem; font-family:monospace; color:var(--clr-text-muted);">${c.linkedAccountId ? c.linkedAccountId.substring(0, 8) + '...' : 'Ninguna'}</span>
        </td>
        <td>${modulesHtml}</td>
        <td style="text-align:center;">
          ${isAdmin ? `
            <button class="btn-danger" style="padding: 4px 8px; font-size:0.75rem; min-width:unset; margin:0;" onclick="handleDeleteCollaborator(${index})">
              🗑 Baja
            </button>
          ` : '—'}
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function toggleCollaboratorModule(colabIndex, moduleId, isEnabled) {
  const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
  let companyAdmin = localStorage.getItem(userKey('recim_company_admin'));
  if (companyAdmin && companyAdmin.startsWith('"') && companyAdmin.endsWith('"')) {
    try { companyAdmin = JSON.parse(companyAdmin); } catch (_) {}
  }
  if (companyAdmin !== session.accountId) {
    showToast('❌ Solo el creador de la empresa tiene permisos para editar la sección de colaboradores', 'error');
    return;
  }

  const colabs = JSON.parse(localStorage.getItem(userKey('recim_collaborators')) || '[]');
  if (colabs[colabIndex]) {
    if (!colabs[colabIndex].modules) {
      colabs[colabIndex].modules = {};
      COLLAB_TOGGLEABLE_MODULES.forEach(m => colabs[colabIndex].modules[m.id] = true);
    }
    colabs[colabIndex].modules[moduleId] = isEnabled;
    localStorage.setItem(userKey('recim_collaborators'), JSON.stringify(colabs));
    showToast('✅ Permiso de módulo actualizado con éxito', 'success');
    
    // Rerender table
    renderCollaboratorsTable(colabs, true);
    
    // Apply module visibility changes immediately
    if (typeof applyModuleVisibility === 'function') {
      applyModuleVisibility();
    }
  }
}

window.toggleCollaboratorModule = toggleCollaboratorModule;

function renderCollaboratorsActivity(colabs) {
  const tbody = document.getElementById('colab-activity-table-body');
  if (!tbody) return;

  if (colabs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--clr-text-muted); padding:15px;">No hay colaboradores para medir actividad.</td></tr>`;
    return;
  }

  // Load invoices to count activity locally (super fast!)
  const invoices = JSON.parse(localStorage.getItem(userKey('recim_invoices')) || '[]');

  let html = '';
  colabs.forEach(c => {
    // Count invoices where collaborator name matches
    const colabInvoices = invoices.filter(i => i.collaborator === c.name);
    const invoiceCount = colabInvoices.length;
    const totalAmount = colabInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

    html += `
      <tr>
        <td style="font-weight:600;">${c.name}</td>
        <td><span class="badge badge--blue">${c.role}</span></td>
        <td style="text-align:center; font-weight:700;">${invoiceCount}</td>
        <td style="text-align:right; font-family:monospace; font-weight:700; color:var(--clr-primary-light);">${formatMoney(totalAmount)}</td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

async function renderCollaboratorsSupport(colabs) {
  const tbody = document.getElementById('colab-support-table-body');
  if (!tbody) return;

  if (!isSupabaseActive || !supabaseClient) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--clr-text-muted); padding:15px;">Supabase fuera de línea. No se puede cargar soporte IT.</td></tr>`;
    return;
  }

  try {
    const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
    const { data: tickets, error } = await supabaseClient
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Filter tickets that belong to our company (parsed from user_name)
    const companyId = session.familyId;
    const companyTickets = (tickets || []).filter(t => {
      // user_name is in format: "Name | Empresa: ID | Colaborador: Name"
      return t.user_name && t.user_name.includes(`Empresa: ${companyId}`);
    });

    if (companyTickets.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--clr-text-muted); padding:15px;">No hay reportes de soporte registrados por esta empresa.</td></tr>`;
      return;
    }

    let html = '';
    companyTickets.forEach(t => {
      // Parse collaborator name out of user_name
      let colabName = '—';
      const parts = t.user_name.split(' | ');
      const colabPart = parts.find(p => p.startsWith('Colaborador:'));
      if (colabPart) {
        colabName = colabPart.replace('Colaborador:', '').trim();
      }

      html += `
        <tr>
          <td style="font-family:monospace; font-size:0.8rem; font-weight:bold;">${t.id.substring(0, 8)}...</td>
          <td style="font-weight:600;">${colabName}</td>
          <td>${t.subject}</td>
          <td style="text-align:center;">
            <span class="badge ${t.status === 'open' ? 'badge--blue' : 'badge--green'}">${t.status === 'open' ? 'Abierto' : 'Resuelto'}</span>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;

  } catch (err) {
    console.error('Error loading support logs for colabs:', err);
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--clr-danger); padding:15px;">Error al conectar con la base de datos de soporte.</td></tr>`;
  }
}

function handleCreateCollaborator() {
  const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
  let companyAdmin = localStorage.getItem(userKey('recim_company_admin'));
  if (companyAdmin && companyAdmin.startsWith('"') && companyAdmin.endsWith('"')) {
    try { companyAdmin = JSON.parse(companyAdmin); } catch (_) {}
  }
  if (companyAdmin !== session.accountId) {
    showToast('❌ Solo el creador de la empresa tiene permisos para registrar colaboradores', 'error');
    return;
  }

  const nameEl = document.getElementById('colab-reg-name');
  const roleEl = document.getElementById('colab-reg-role');
  const phoneEl = document.getElementById('colab-reg-phone');
  const emailEl = document.getElementById('colab-reg-email');
  const accountEl = document.getElementById('colab-reg-account');

  if (!nameEl || !roleEl) return;

  const name = nameEl.value.trim();
  const role = roleEl.value.trim();
  const phone = phoneEl.value.trim();
  const email = emailEl.value.trim();
  const linkedAccountId = accountEl ? accountEl.value : '';

  if (!name) {
    showToast('❌ El nombre completo es obligatorio', 'error');
    return;
  }
  if (!role) {
    showToast('❌ El rol o puesto es obligatorio', 'error');
    return;
  }

  const colabs = JSON.parse(localStorage.getItem(userKey('recim_collaborators')) || '[]');
  
  // Prevent duplicate names
  if (colabs.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    showToast('❌ Ya existe un colaborador con este nombre', 'error');
    return;
  }

  const newColab = {
    id: `COLAB-${Date.now()}`,
    name,
    role,
    phone,
    email,
    linkedAccountId,
    createdAt: new Date().toISOString()
  };

  colabs.push(newColab);
  localStorage.setItem(userKey('recim_collaborators'), JSON.stringify(colabs));
  showToast('👥 Colaborador registrado y sincronizado con éxito', 'success');

  // Reload page content
  const target = document.getElementById('page-colaboradores');
  if (target) renderCollaboratorsPage(target);
}

function handleDeleteCollaborator(index) {
  const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
  let companyAdmin = localStorage.getItem(userKey('recim_company_admin'));
  if (companyAdmin && companyAdmin.startsWith('"') && companyAdmin.endsWith('"')) {
    try { companyAdmin = JSON.parse(companyAdmin); } catch (_) {}
  }
  if (companyAdmin !== session.accountId) {
    showToast('❌ Solo el creador de la empresa tiene permisos para dar de baja colaboradores', 'error');
    return;
  }

  if (!confirm('¿Estás seguro de que deseas dar de baja a este colaborador?')) return;

  const colabs = JSON.parse(localStorage.getItem(userKey('recim_collaborators')) || '[]');
  colabs.splice(index, 1);
  localStorage.setItem(userKey('recim_collaborators'), JSON.stringify(colabs));
  showToast('🗑 Colaborador dado de baja con éxito', 'success');

  // Reload page content
  const target = document.getElementById('page-colaboradores');
  if (target) renderCollaboratorsPage(target);
}

// Export functions to global scope
window.renderCollaboratorsPage = renderCollaboratorsPage;
window.handleCreateCollaborator = handleCreateCollaborator;
window.handleDeleteCollaborator = handleDeleteCollaborator;
