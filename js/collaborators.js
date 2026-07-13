/* =============================================
   COLLABORATORS.JS – Gestión de Colaboradores
   ============================================= */

// Variable para llevar control del colaborador en edición y la pestaña activa
let currentEditingIndex = null;
let activeFormTab = 'identidad';
let currentSearchQuery = '';
let currentColabsPage = 1;
const ITEMS_PER_PAGE = 5;

function isCurrentUserAdminOrFounder() {
  const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
  if (!session.accountId) return false;

  const adminEmails = [
    'keyletsebas@gmail.com',
    'gerenciareciminsasrl@gmail.com',
    'noreplyreciminsasrl@gmail.com'
  ];
  if (adminEmails.includes(session.email)) {
    return true;
  }

  // 1. ¿Es el creador / fundador original de la empresa?
  let companyAdminId = localStorage.getItem(userKey('recim_company_admin'));
  if (companyAdminId && companyAdminId.startsWith('"') && companyAdminId.endsWith('"')) {
    try { companyAdminId = JSON.parse(companyAdminId); } catch (_) {}
  }

  // Auto-detectar si el usuario actual es keyletsebas@gmail.com como creador por defecto
  // Solo si no hay empresa creada aún (no familyId)
  if ((!companyAdminId || companyAdminId === 'Desconocido') && !session.familyId) {
    if (session.email === 'keyletsebas@gmail.com') {
      companyAdminId = session.accountId;
      localStorage.setItem(userKey('recim_company_admin'), JSON.stringify(companyAdminId));
      if (window.syncPushData) window.syncPushData(true);
    }
  }

  if (session.accountId === companyAdminId) {
    return true;
  }

  // 2. ¿Es un colaborador con rol de Administrador asignado o en la lista de admins de la empresa?
  try {
    const sharedKey = typeof userKey === 'function' ? userKey('recim_company_shared_settings') : 'recim_company_shared_settings';
    const shared = JSON.parse(localStorage.getItem(sharedKey) || '{}');
    const sharedAdmins = shared.companyAdmins || [];
    if (sharedAdmins.includes(session.accountId)) {
      return true;
    }
  } catch(e){}

  const colabs = JSON.parse(localStorage.getItem(userKey('recim_collaborators')) || '[]');
  const linked = colabs.find(c => c.linkedAccountId === session.accountId);
  if (linked && linked.isAdminColab === true) {
    return true;
  }

  return false;
}

// Inyección de estilos CSS específicos para la vista de colaboradores
const colabStyles = `
<style id="colab-custom-styles">
  .colab-tabs-container {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--clr-border, rgba(255,255,255,0.1));
    margin-bottom: 24px;
    overflow-x: auto;
  }
  .colab-tab-btn {
    background: transparent;
    border: none;
    border-bottom: 3px solid transparent;
    color: var(--clr-text-muted, #888);
    padding: 10px 20px;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    white-space: nowrap;
  }
  .colab-tab-btn:hover {
    color: var(--clr-text, #fff);
    background: rgba(255,255,255,0.02);
  }
  .colab-tab-btn.active {
    color: var(--clr-primary-light, #10b981);
    border-bottom: 3px solid var(--clr-primary-light, #10b981);
  }
  .colab-form-section {
    display: none;
  }
  .colab-form-section.active {
    display: block;
    animation: colabFadeIn 0.3s ease;
  }
  @keyframes colabFadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .colab-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .colab-form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 30px;
    border-top: 1px solid var(--clr-border);
    padding-top: 20px;
  }
  @media (max-width: 768px) {
    .colab-grid-2 {
      grid-template-columns: 1fr;
      gap: 12px;
    }
    .colab-card-wrapper {
      padding: 14px 12px !important;
    }
    .colab-tabs-container {
      flex-wrap: wrap !important;
      gap: 6px !important;
      margin-bottom: 18px !important;
      border-bottom: none !important;
    }
    .colab-tab-btn {
      padding: 6px 10px !important;
      font-size: 0.76rem !important;
      border-radius: 4px !important;
      border: 1px solid var(--clr-border) !important;
      background: rgba(255,255,255,0.03) !important;
    }
    .colab-tab-btn.active {
      background: rgba(16, 185, 129, 0.1) !important;
      border-color: var(--clr-primary-light) !important;
    }
    .colab-form-actions {
      justify-content: space-between !important;
      gap: 8px !important;
      margin-top: 20px !important;
      padding-top: 15px !important;
    }
    .colab-form-actions button {
      flex: 1 !important;
      padding: 8px 10px !important;
      font-size: 0.78rem !important;
      justify-content: center !important;
      white-space: nowrap !important;
    }
    
    /* Responsive table to block cards */
    .colab-data-table, .colab-data-table thead, .colab-data-table tbody, .colab-data-table th, .colab-data-table td, .colab-data-table tr {
      display: block !important;
      width: 100% !important;
      min-width: 100% !important;
    }
    .colab-data-table thead {
      display: none !important;
    }
    .colab-data-table tr {
      border: 1px solid var(--clr-border) !important;
      border-radius: var(--r-md, 8px) !important;
      margin-bottom: 14px !important;
      background: var(--clr-surface-3) !important;
      padding: 10px 14px !important;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }
    .colab-data-table td {
      border: none !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
      position: relative !important;
      padding: 12px 10px 12px 45% !important;
      text-align: right !important;
      white-space: normal !important;
      min-height: 44px;
      display: flex !important;
      align-items: center;
      justify-content: flex-end;
    }
    .colab-data-table td:last-child {
      border-bottom: 0 !important;
      justify-content: center !important;
      padding-left: 10px !important;
    }
    .colab-data-table td::before {
      content: attr(data-label);
      position: absolute;
      left: 12px;
      width: 40%;
      text-align: left;
      font-weight: 600;
      color: var(--clr-text-muted);
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  }
</style>
`;

async function renderCollaboratorsPage(container) {
  // Asegurar que los estilos estén cargados y actualizados
  const existingStyles = document.getElementById('colab-custom-styles');
  if (existingStyles) {
    existingStyles.remove();
  }
  document.head.insertAdjacentHTML('beforeend', colabStyles);

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

  container.innerHTML = `
    <div id="colab-page-content" style="max-width: 980px; margin: 0 auto; padding-bottom: 40px;">
      <!-- El contenido dinámico de Lista o Formulario se renderiza aquí -->
    </div>
  `;

  // Mostrar la lista por defecto al cargar la página
  showColabsList();
}

// ---- MÓDULO VISTA DE LISTA ----
function showColabsList() {
  const contentDiv = document.getElementById('colab-page-content');
  if (!contentDiv) return;

  const isEn = (getSettings().language === 'en');
  const hasEditPermissions = isCurrentUserAdminOrFounder();
  
  contentDiv.innerHTML = `
    <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <div>
        <h2 class="section-title" style="margin:0; font-size:1.6rem; font-weight:700;">${isEn ? 'Collaborators' : 'Colaboradores'}</h2>
      </div>
      <div style="display:flex; gap:10px; ${hasEditPermissions ? '' : 'display:none;'}">
        <button class="btn-secondary" onclick="handleImportCollaborators()" style="gap:6px; font-size:0.85rem; font-weight:600; padding:8px 14px;">
          📤 ${isEn ? 'Import' : 'Importar'}
        </button>
        <button class="btn-primary" onclick="showColabForm()" style="background-color:var(--clr-primary-light); color:#0a0f1d; gap:6px; font-size:0.85rem; font-weight:700; padding:8px 14px;">
          ➕ ${isEn ? 'New Collaborator' : 'Nuevo Colaborador'}
        </button>
      </div>
    </div>

    <!-- Buscador -->
    <div style="margin-bottom:18px; display:flex; align-items:center;">
      <div style="position:relative; width: 100%; max-width: 320px;">
        <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--clr-text-muted); font-size:0.9rem;">🔍</span>
        <input type="text" id="colab-search-input" class="form-input" 
               placeholder="${isEn ? 'Search by name, ID or code...' : 'Buscar por nombre, cédula o código...'}" 
               value="${currentSearchQuery}"
               oninput="handleSearchCollaborators(this.value)" 
               style="width:100%; padding-left:36px !important; background:var(--clr-surface-3); border:1px solid var(--clr-border); border-radius:6px; font-size:0.85rem; height:38px;" />
      </div>
    </div>

    <!-- Tabla -->
    <div class="card card--elevated" style="padding:0; overflow:hidden;">
      <div style="overflow-x: auto;">
        <table class="colab-data-table" style="width:100%; min-width:650px; border-collapse:collapse; font-size:0.85rem; white-space:nowrap;">
          <thead>
            <tr style="background:var(--clr-surface-2); border-bottom:1px solid var(--clr-border);">
              <th style="text-align:left; padding:12px 16px;">${isEn ? 'Code' : 'Código'}</th>
              <th style="text-align:left; padding:12px 16px;">${isEn ? 'National ID' : 'Cédula'}</th>
              <th style="text-align:left; padding:12px 16px;">${isEn ? 'Full Name' : 'Nombre Completo'}</th>
              <th style="text-align:left; padding:12px 16px;">${isEn ? 'Position' : 'Cargo'}</th>
              <th style="text-align:left; padding:12px 16px;">${isEn ? 'Status & Situation' : 'Estado y Situación'}</th>
              <th style="text-align:center; padding:12px 16px; width:100px;">${isEn ? 'Actions' : 'Acciones'}</th>
            </tr>
          </thead>
          <tbody id="colab-list-table-body">
            <!-- Filas dinámicas -->
          </tbody>
        </table>
      </div>
      
      <!-- Paginación -->
      <div id="colab-pagination" style="display:flex; justify-content:center; align-items:center; gap:8px; padding:14px; background:var(--clr-surface-2); border-top:1px solid var(--clr-border);">
        <!-- Paginación dinámica -->
      </div>
    </div>
  `;

  renderCollaboratorsTable();
}

function renderCollaboratorsTable() {
  const tbody = document.getElementById('colab-list-table-body');
  const paginationDiv = document.getElementById('colab-pagination');
  if (!tbody || !paginationDiv) return;

  const colabs = JSON.parse(localStorage.getItem(userKey('recim_collaborators')) || '[]');
  const isEn = (getSettings().language === 'en');
  const hasEditPermissions = isCurrentUserAdminOrFounder();

  // Filtrado
  let filtered = colabs;
  if (currentSearchQuery.trim() !== '') {
    const q = currentSearchQuery.toLowerCase().trim();
    filtered = colabs.filter(c => 
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.cedula && c.cedula.toLowerCase().includes(q)) ||
      (c.code && c.code.toLowerCase().includes(q)) ||
      (c.role && c.role.toLowerCase().includes(q))
    );
  }

  // Paginación
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  if (currentColabsPage > totalPages) currentColabsPage = totalPages;

  const startIndex = (currentColabsPage - 1) * ITEMS_PER_PAGE;
  const pageItems = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  if (totalItems === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; color:var(--clr-text-muted); padding:30px;">
          ${isEn ? 'No collaborators found matching the search.' : 'No se encontraron colaboradores que coincidan con la búsqueda.'}
        </td>
      </tr>
    `;
    paginationDiv.innerHTML = '';
    return;
  }

  // Generar filas
  let html = '';
  pageItems.forEach((c, indexInPage) => {
    const originalIndex = colabs.findIndex(x => x.id === c.id);
    const statusText = c.status || 'ACTIVO';
    const badgeColor = statusText === 'ACTIVO' ? '#10b981' : (statusText === 'INACTIVO' ? '#ef4444' : '#f59e0b');
    
    html += `
      <tr style="border-bottom:1px solid var(--clr-border);">
        <td data-label="${isEn ? 'Code' : 'Código'}" style="padding:14px 16px; font-weight:600; font-family:monospace; color:var(--clr-text-secondary);">${c.code || 'EMPL-00000'}</td>
        <td data-label="${isEn ? 'National ID' : 'Cédula'}" style="padding:14px 16px; color:var(--clr-text);">${c.cedula || '000-0000000-0'}</td>
        <td data-label="${isEn ? 'Full Name' : 'Nombre Completo'}" style="padding:14px 16px; font-weight:600; color:var(--clr-text); text-transform: capitalize;">${c.name || 'Sin nombre'}</td>
        <td data-label="${isEn ? 'Position' : 'Cargo'}" style="padding:14px 16px; color:var(--clr-text-secondary);">${c.role || 'Operario'}</td>
        <td data-label="${isEn ? 'Status & Situation' : 'Estado y Situación'}" style="padding:14px 16px;">
          <span class="badge" style="background-color:rgba(${hexToRgb(badgeColor)}, 0.15); color:${badgeColor}; font-size:0.75rem; padding:4px 8px; border-radius:4px; font-weight:700;">
            ${statusText}
          </span>
        </td>
        <td data-label="${isEn ? 'Actions' : 'Acciones'}" style="padding:14px 16px; text-align:center; display:flex; justify-content:center; gap:8px;">
          ${hasEditPermissions ? `
          <button class="btn-icon" onclick="showColabForm(${originalIndex})" style="background:transparent; border:none; cursor:pointer; color:var(--clr-primary-light); font-size:1.1rem; padding:4px;" title="Editar">
            ✏️
          </button>
          <button class="btn-icon" onclick="deleteCollaborator(${originalIndex})" style="background:transparent; border:none; cursor:pointer; color:var(--clr-danger); font-size:1.1rem; padding:4px;" title="Dar de Baja">
            🗑️
          </button>
          ` : '<span style="color:var(--clr-text-muted);">—</span>'}
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;

  // Renderizar paginador
  let pagHtml = `
    <button onclick="changeColabsPage(1)" ${currentColabsPage === 1 ? 'disabled style="opacity:0.4; cursor:default;"' : ''} style="background:none; border:none; color:var(--clr-text); font-weight:bold; cursor:pointer;">&lt;&lt;</button>
    <button onclick="changeColabsPage(${currentColabsPage - 1})" ${currentColabsPage === 1 ? 'disabled style="opacity:0.4; cursor:default;"' : ''} style="background:none; border:none; color:var(--clr-text); font-weight:bold; cursor:pointer;">&lt;</button>
  `;

  for (let i = 1; i <= totalPages; i++) {
    if (i === currentColabsPage) {
      pagHtml += `<span style="background:var(--clr-primary-light); color:#0a0f1d; width:26px; height:26px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; font-weight:700; font-size:0.85rem;">${i}</span>`;
    } else {
      pagHtml += `<button onclick="changeColabsPage(${i})" style="background:none; border:none; color:var(--clr-text-muted); cursor:pointer; font-size:0.85rem; width:26px; height:26px;">${i}</button>`;
    }
  }

  pagHtml += `
    <button onclick="changeColabsPage(${currentColabsPage + 1})" ${currentColabsPage === totalPages ? 'disabled style="opacity:0.4; cursor:default;"' : ''} style="background:none; border:none; color:var(--clr-text); font-weight:bold; cursor:pointer;">&gt;</button>
    <button onclick="changeColabsPage(${totalPages})" ${currentColabsPage === totalPages ? 'disabled style="opacity:0.4; cursor:default;"' : ''} style="background:none; border:none; color:var(--clr-text); font-weight:bold; cursor:pointer;">&gt;&gt;</button>
  `;
  paginationDiv.innerHTML = pagHtml;
}

function changeColabsPage(page) {
  currentColabsPage = page;
  renderCollaboratorsTable();
}

function handleSearchCollaborators(val) {
  currentSearchQuery = val;
  currentColabsPage = 1;
  renderCollaboratorsTable();
}

// ---- MÓDULO FORMULARIO CON PESTAÑAS ----
async function showColabForm(colabIndex = null) {
  if (!isCurrentUserAdminOrFounder()) {
    showToast('❌ No tienes permisos para realizar esta acción', 'error');
    return;
  }
  currentEditingIndex = colabIndex;
  activeFormTab = 'identidad';

  const contentDiv = document.getElementById('colab-page-content');
  if (!contentDiv) return;

  const colabs = JSON.parse(localStorage.getItem(userKey('recim_collaborators')) || '[]');
  const isEdit = colabIndex !== null;
  const colab = isEdit ? colabs[colabIndex] : {};
  const isEn = (getSettings().language === 'en');

  // Valores predeterminados
  const nextCode = isEdit ? colab.code : generateNextEmployeeCode(colabs);
  const firstName = colab.firstName || '';
  const lastName = colab.lastName || '';
  const cedula = colab.cedula || '001-0000000-1';
  const nationality = colab.nationality || 'Dominicana';
  const birthDate = colab.birthDate ? colab.birthDate.substring(0, 10) : '';
  const gender = colab.gender || 'M';
  const civilStatus = colab.civilStatus || 'SOLTERO';

  const phone = colab.phone || '';
  const mobile = colab.mobile || '';
  const email = colab.email || '';
  const address = colab.address || '';

  const role = colab.role || '';
  const department = colab.department || 'Operaciones';
  const hireDate = colab.hireDate ? colab.hireDate.substring(0, 10) : '';
  const statusText = colab.status || 'ACTIVO';

  const paymentType = colab.paymentType || 'Efectivo';
  const bankName = colab.bankName || '';
  const bankAccount = colab.bankAccount || '';
  const salary = colab.salary || 0;

  const linkedAccountId = colab.linkedAccountId || '';
  const isAdminColab = colab.isAdminColab === true;
  const modules = colab.modules || {};

  contentDiv.innerHTML = `
    <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <div>
        <h2 class="section-title" style="margin:0; font-size:1.6rem; font-weight:700;">
          ${isEdit ? (isEn ? 'Edit Collaborator' : 'Editar Colaborador') : (isEn ? 'New Collaborator' : 'Nuevo Colaborador')}
        </h2>
      </div>
      <div>
        <button class="btn-secondary" onclick="showColabsList()" style="gap:6px; font-size:0.85rem; font-weight:600;">
          ← ${isEn ? 'Back' : 'Volver'}
        </button>
      </div>
    </div>

    <!-- Contenedor del Formulario con Pestañas -->
    <div class="card card--elevated colab-card-wrapper" style="padding:24px;">
      
      <!-- Pestañas -->
      <div class="colab-tabs-container">
        <button id="tab-btn-identidad" class="colab-tab-btn active" onclick="switchColabTab('identidad')">Identidad</button>
        <button id="tab-btn-contacto" class="colab-tab-btn" onclick="switchColabTab('contacto')">Contacto</button>
        <button id="tab-btn-laboral" class="colab-tab-btn" onclick="switchColabTab('laboral')">Laboral</button>
        <button id="tab-btn-logistica" class="colab-tab-btn" onclick="switchColabTab('logistica')">Logística</button>
      </div>

      <form id="colab-details-form" onsubmit="event.preventDefault();">
        
        <!-- PESTAÑA 1: IDENTIDAD -->
        <div id="tab-sec-identidad" class="colab-form-section active">
          <div style="border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:10px; margin-bottom:20px;">
            <h4 style="margin:0; font-size:0.95rem; color:var(--clr-primary-light); font-weight:700;">🪪 Información Personal</h4>
          </div>
          <div class="colab-grid-2" style="margin-bottom:20px;">
            <div class="form-group">
              <label class="form-label">${isEn ? 'First Name' : 'Nombres'} <span style="color:#ef4444;">*</span></label>
              <input type="text" id="colab-first-name" class="form-input" style="background:var(--clr-surface-3);" value="${firstName}" placeholder="Ingresa nombres" required />
            </div>
            <div class="form-group">
              <label class="form-label">${isEn ? 'Last Name' : 'Apellidos'} <span style="color:#ef4444;">*</span></label>
              <input type="text" id="colab-last-name" class="form-input" style="background:var(--clr-surface-3);" value="${lastName}" placeholder="Ingresa apellidos" required />
            </div>
          </div>
          <div class="colab-grid-2" style="margin-bottom:20px;">
            <div class="form-group">
              <label class="form-label">${isEn ? 'National ID (Cédula)' : 'Cédula'} <span style="color:#ef4444;">*</span></label>
              <input type="text" id="colab-cedula" class="form-input" style="background:var(--clr-surface-3);" value="${cedula}" placeholder="001-0000000-1" required />
            </div>
            <div class="form-group">
              <label class="form-label">${isEn ? 'Internal Code' : 'Código Interno'}</label>
              <input type="text" id="colab-code" class="form-input" style="background:var(--clr-surface-2); opacity:0.7; pointer-events:none;" value="${nextCode}" readonly />
            </div>
          </div>

          <div style="border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:10px; margin-bottom:20px; margin-top:30px;">
            <h4 style="margin:0; font-size:0.95rem; color:var(--clr-primary-light); font-weight:700;">🌍 Datos Demográficos</h4>
          </div>
          <div class="colab-grid-2" style="margin-bottom:10px;">
            <div class="form-group">
              <label class="form-label">${isEn ? 'Nationality' : 'Nacionalidad'}</label>
              <select id="colab-nationality" class="form-select" style="background:var(--clr-surface-3);">
                <option value="Dominicana" ${nationality === 'Dominicana' ? 'selected' : ''}>Dominicana</option>
                <option value="Haitiana" ${nationality === 'Haitiana' ? 'selected' : ''}>Haitiana</option>
                <option value="Estadounidense" ${nationality === 'Estadounidense' ? 'selected' : ''}>Estadounidense</option>
                <option value="Venezolana" ${nationality === 'Venezolana' ? 'selected' : ''}>Venezolana</option>
                <option value="Colombiana" ${nationality === 'Colombiana' ? 'selected' : ''}>Colombiana</option>
                <option value="Española" ${nationality === 'Española' ? 'selected' : ''}>Española</option>
                <option value="Otra" ${nationality === 'Otra' ? 'selected' : ''}>Otra</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">${isEn ? 'Birth Date' : 'Fecha Nacimiento'}</label>
              <div style="position:relative;">
                <input type="date" id="colab-birthdate" class="form-input" style="background:var(--clr-surface-3); width:100%;" value="${birthDate}" />
              </div>
            </div>
          </div>
          <div class="colab-grid-2" style="margin-bottom:10px;">
            <div class="form-group">
              <label class="form-label">${isEn ? 'Gender' : 'Sexo'}</label>
              <select id="colab-gender" class="form-select" style="background:var(--clr-surface-3);">
                <option value="M" ${gender === 'M' ? 'selected' : ''}>M</option>
                <option value="F" ${gender === 'F' ? 'selected' : ''}>F</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">${isEn ? 'Civil Status' : 'Estado Civil'}</label>
              <select id="colab-civilstatus" class="form-select" style="background:var(--clr-surface-3);">
                <option value="SOLTERO" ${civilStatus === 'SOLTERO' ? 'selected' : ''}>SOLTERO</option>
                <option value="CASADO" ${civilStatus === 'CASADO' ? 'selected' : ''}>CASADO</option>
                <option value="DIVORCIADO" ${civilStatus === 'DIVORCIADO' ? 'selected' : ''}>DIVORCIADO</option>
                <option value="UNIÓN LIBRE" ${civilStatus === 'UNIÓN LIBRE' ? 'selected' : ''}>UNIÓN LIBRE</option>
                <option value="VIUDO" ${civilStatus === 'VIUDO' ? 'selected' : ''}>VIUDO</option>
              </select>
            </div>
          </div>
        </div>

        <!-- PESTAÑA 2: CONTACTO -->
        <div id="tab-sec-contacto" class="colab-form-section">
          <div style="border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:10px; margin-bottom:20px;">
            <h4 style="margin:0; font-size:0.95rem; color:var(--clr-primary-light); font-weight:700;">📞 Información de Contacto</h4>
          </div>
          <div class="colab-grid-2" style="margin-bottom:20px;">
            <div class="form-group">
              <label class="form-label">${isEn ? 'Telephone' : 'Teléfono'}</label>
              <input type="text" id="colab-phone" class="form-input" style="background:var(--clr-surface-3);" value="${phone}" placeholder="Ej: 809-555-0199" />
            </div>
            <div class="form-group">
              <label class="form-label">${isEn ? 'Mobile' : 'Celular'}</label>
              <input type="text" id="colab-mobile" class="form-input" style="background:var(--clr-surface-3);" value="${mobile}" placeholder="Ej: 829-555-0200" />
            </div>
          </div>
          <div class="form-group" style="margin-bottom:20px;">
            <label class="form-label">${isEn ? 'Email Address' : 'Correo Electrónico'}</label>
            <input type="email" id="colab-email" class="form-input" style="background:var(--clr-surface-3);" value="${email}" placeholder="colaborador@empresa.com" />
          </div>
          <div class="form-group">
            <label class="form-label">${isEn ? 'Home Address' : 'Dirección'}</label>
            <textarea id="colab-address" class="form-input" style="background:var(--clr-surface-3); height:80px; resize:none; padding:10px;" placeholder="Dirección residencial completa">${address}</textarea>
          </div>
        </div>

        <!-- PESTAÑA 3: LABORAL -->
        <div id="tab-sec-laboral" class="colab-form-section">
          <div style="border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:10px; margin-bottom:20px;">
            <h4 style="margin:0; font-size:0.95rem; color:var(--clr-primary-light); font-weight:700;">💼 Datos Laborales</h4>
          </div>
          <div class="colab-grid-2" style="margin-bottom:20px;">
            <div class="form-group">
              <label class="form-label">${isEn ? 'Position / Cargo' : 'Cargo / Puesto'} <span style="color:#ef4444;">*</span></label>
              <input type="text" id="colab-role" class="form-input" style="background:var(--clr-surface-3);" value="${role}" placeholder="Ej: Pesador, Operario, Caja, Administrador" required />
            </div>
            <div class="form-group">
              <label class="form-label">${isEn ? 'Department' : 'Departamento'}</label>
              <input type="text" id="colab-department" class="form-input" style="background:var(--clr-surface-3);" value="${department}" placeholder="Ej: Pesaje, Logística, Contabilidad" />
            </div>
          </div>
          <div class="colab-grid-2">
            <div class="form-group">
              <label class="form-label">${isEn ? 'Hire Date' : 'Fecha de Contratación'}</label>
              <input type="date" id="colab-hiredate" class="form-input" style="background:var(--clr-surface-3);" value="${hireDate}" />
            </div>
            <div class="form-group">
              <label class="form-label">${isEn ? 'Status & Situation' : 'Estado y Situación'}</label>
              <select id="colab-status" class="form-select" style="background:var(--clr-surface-3);">
                <option value="ACTIVO" ${statusText === 'ACTIVO' ? 'selected' : ''}>ACTIVO</option>
                <option value="INACTIVO" ${statusText === 'INACTIVO' ? 'selected' : ''}>INACTIVO</option>
                <option value="LICENCIA" ${statusText === 'LICENCIA' ? 'selected' : ''}>LICENCIA</option>
              </select>
            </div>
          </div>
        </div>



        <!-- PESTAÑA 5: LOGÍSTICA (ASIGNACIÓN DE USUARIO Y PERMISOS) -->
        <div id="tab-sec-logistica" class="colab-form-section">
          <div style="border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:10px; margin-bottom:20px;">
            <h4 style="margin:0; font-size:0.95rem; color:var(--clr-primary-light); font-weight:700;">⚙️ Enlace de Usuario y Permisos</h4>
          </div>
          <div class="form-group" style="margin-bottom:24px;">
            <label class="form-label" style="font-weight:700;">🔗 ${isEn ? 'Link to Company Member Account (Extra)' : 'Vincular a Cuenta de Miembro de Empresa (Extra)'}</label>
            <select id="colab-linked-account" class="form-select" style="background:var(--clr-surface-3); width:100%;">
              <option value="">${isEn ? '-- Select user to link --' : '-- Seleccionar cuenta para vincular --'}</option>
            </select>
            
            <div style="margin-top: 15px; display: flex; align-items: center; gap: 10px; background: rgba(59, 130, 246, 0.1); border: 1px dashed rgba(59, 130, 246, 0.3); padding: 12px; border-radius: 6px;">
              <input type="checkbox" id="colab-is-admin-colab" style="width:18px; height:18px; cursor:pointer;" ${isAdminColab ? 'checked' : ''} />
              <label for="colab-is-admin-colab" style="font-size:0.82rem; font-weight:600; cursor:pointer; color:var(--clr-text); margin: 0;">
                🛡️ Asignar rol de Administrador de la Empresa (Permite crear y editar colaboradores)
              </label>
            </div>
          </div>

          <div style="border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:10px; margin-bottom:14px; margin-top:20px;">
            <h4 style="margin:0; font-size:0.88rem; color:var(--clr-text-secondary); font-weight:600;">🔒 Módulos y Permisos Habilitados</h4>
          </div>
          <p style="font-size:0.78rem; color:var(--clr-text-muted); margin-bottom:14px;">
            Habilita o deshabilita los módulos específicos a los que este colaborador tendrá acceso directo en su menú.
          </p>
          <div id="colab-modules-container" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:10px; padding:12px; background:var(--clr-surface-3); border:1px solid var(--clr-border); border-radius:6px; max-height:180px; overflow-y:auto;">
            <!-- Checkboxes generados dinámicamente -->
          </div>
        </div>

        <!-- Botones de Acción Formulario -->
        <div class="colab-form-actions">
          <button type="button" class="btn-secondary" onclick="showColabsList()" style="gap:6px; font-weight:600;">
            ❌ ${isEn ? 'Cancel' : 'Cancelar'}
          </button>
          <button type="button" class="btn-primary" onclick="saveCollaborator()" style="background-color:var(--clr-primary-light); color:#0a0f1d; gap:6px; font-weight:700;">
            💾 ${isEn ? 'Save' : 'Guardar'}
          </button>
        </div>

      </form>
    </div>
  `;

  // Cargar módulos y checkboxes
  renderColabModulesCheckboxes(modules);

  // Cargar lista de miembros de Supabase para vincular
  const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
  await populateLinkedAccountsDropdown(session.familyId, linkedAccountId);
}

function switchColabTab(tabName) {
  activeFormTab = tabName;
  
  // Actualizar botones de pestañas
  const tabButtons = document.querySelectorAll('.colab-tab-btn');
  tabButtons.forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(`tab-btn-${tabName}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Actualizar secciones
  const sections = document.querySelectorAll('.colab-form-section');
  sections.forEach(sec => {
    sec.classList.remove('active');
  });
  const activeSec = document.getElementById(`tab-sec-${tabName}`);
  if (activeSec) activeSec.classList.add('active');
}

function renderColabModulesCheckboxes(savedModules) {
  const container = document.getElementById('colab-modules-container');
  if (!container) return;

  container.innerHTML = COLLAB_TOGGLEABLE_MODULES.map(m => `
    <label style="display:flex; align-items:center; gap:8px; font-size:0.82rem; cursor:pointer; user-select:none; margin:0; padding:6px; background:var(--clr-surface-2); border-radius:4px; border:1px solid var(--clr-border);">
      <input type="checkbox" data-module-id="${m.id}" ${savedModules[m.id] !== false ? 'checked' : ''} style="width:15px; height:15px; cursor:pointer; margin:0;" />
      <span>${m.label}</span>
    </label>
  `).join('');
}

async function populateLinkedAccountsDropdown(familyId, preselectedId) {
  const select = document.getElementById('colab-linked-account');
  if (!select) return;

  try {
    if (!isSupabaseActive || !supabaseClient) {
      select.innerHTML = '<option value="">-- Supabase desconectado --</option>';
      return;
    }

    const { data: members, error } = await supabaseClient
      .from('profiles')
      .select('id, name, email')
      .eq('family_id', familyId);

    if (error) throw error;

    let html = `<option value="">-- No vincular a ninguna cuenta --</option>`;
    if (members && members.length > 0) {
      members.forEach(m => {
        const cleanName = (m.name || 'Sin nombre').split(' | ')[0].trim();
        const selected = m.id === preselectedId ? 'selected' : '';
        html += `<option value="${m.id}" ${selected}>${cleanName} (${m.email || 'sin correo'})</option>`;
      });
    }
    select.innerHTML = html;
  } catch (err) {
    console.error('Error al cargar miembros para formulario:', err);
    select.innerHTML = '<option value="">-- Error al cargar miembros --</option>';
  }
}

// Genera automáticamente el código correlativo de colaborador
function generateNextEmployeeCode(colabs) {
  let maxNum = 0;
  colabs.forEach(c => {
    if (c.code && c.code.startsWith('EMPL-')) {
      const numPart = c.code.substring(5);
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });
  const nextNum = maxNum + 1;
  return `EMPL-${String(nextNum).padStart(5, '0')}`;
}

// ---- MÓDULO GUARDAR Y VALIDAR ----
function saveCollaborator() {
  if (!isCurrentUserAdminOrFounder()) {
    showToast('❌ No tienes permisos para realizar esta acción', 'error');
    return;
  }
  const firstNameEl = document.getElementById('colab-first-name');
  const lastNameEl = document.getElementById('colab-last-name');
  const cedulaEl = document.getElementById('colab-cedula');
  const roleEl = document.getElementById('colab-role');

  if (!firstNameEl || !lastNameEl || !cedulaEl || !roleEl) return;

  const firstName = firstNameEl.value.trim();
  const lastName = lastNameEl.value.trim();
  const name = `${firstName} ${lastName}`;
  const cedula = cedulaEl.value.trim();
  const role = roleEl.value.trim();

  // Validaciones
  if (!firstName) {
    switchColabTab('identidad');
    showToast('❌ El nombre es obligatorio', 'error');
    firstNameEl.focus();
    return;
  }
  if (!lastName) {
    switchColabTab('identidad');
    showToast('❌ El apellido es obligatorio', 'error');
    lastNameEl.focus();
    return;
  }
  if (!cedula) {
    switchColabTab('identidad');
    showToast('❌ La cédula es obligatoria', 'error');
    cedulaEl.focus();
    return;
  }
  if (!role) {
    switchColabTab('laboral');
    showToast('❌ El cargo es obligatorio', 'error');
    roleEl.focus();
    return;
  }

  // Recopilar datos de todas las pestañas
  const nationality = document.getElementById('colab-nationality').value;
  const birthDate = document.getElementById('colab-birthdate').value;
  const gender = document.getElementById('colab-gender').value;
  const civilStatus = document.getElementById('colab-civilstatus').value;

  const phone = document.getElementById('colab-phone').value.trim();
  const mobile = document.getElementById('colab-mobile').value.trim();
  const email = document.getElementById('colab-email').value.trim();
  const address = document.getElementById('colab-address').value.trim();

  const department = document.getElementById('colab-department').value.trim();
  const hireDate = document.getElementById('colab-hiredate').value;
  const status = document.getElementById('colab-status').value;

  const paymentType = 'Efectivo';
  const bankName = '';
  const bankAccount = '';
  const salary = 0;

  const linkedAccountId = document.getElementById('colab-linked-account').value;
  const isAdminColab = document.getElementById('colab-is-admin-colab')?.checked === true;

  // Módulos
  const modules = {};
  const checkboxes = document.querySelectorAll('#colab-modules-container input[type="checkbox"]');
  checkboxes.forEach(cb => {
    const modId = cb.getAttribute('data-module-id');
    modules[modId] = cb.checked;
  });

  const colabs = JSON.parse(localStorage.getItem(userKey('recim_collaborators')) || '[]');

  if (currentEditingIndex === null) {
    // NUEVO
    const code = generateNextEmployeeCode(colabs);
    
    // Evitar nombres duplicados
    if (colabs.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      showToast('❌ Ya existe un colaborador con este nombre', 'error');
      return;
    }

    const newColab = {
      id: `COLAB-${Date.now()}`,
      code,
      firstName,
      lastName,
      name,
      cedula,
      nationality,
      birthDate,
      gender,
      civilStatus,
      phone,
      mobile,
      email,
      address,
      role,
      department,
      hireDate,
      status,
      paymentType,
      bankName,
      bankAccount,
      salary,
      linkedAccountId,
      isAdminColab,
      modules,
      createdAt: new Date().toISOString()
    };

    colabs.unshift(newColab);
    showToast('👥 Colaborador registrado con éxito', 'success');
  } else {
    // EDICIÓN
    const code = colabs[currentEditingIndex].code;
    const originalId = colabs[currentEditingIndex].id;

    colabs[currentEditingIndex] = {
      id: originalId,
      code,
      firstName,
      lastName,
      name,
      cedula,
      nationality,
      birthDate,
      gender,
      civilStatus,
      phone,
      mobile,
      email,
      address,
      role,
      department,
      hireDate,
      status,
      paymentType,
      bankName,
      bankAccount,
      salary,
      linkedAccountId,
      isAdminColab,
      modules,
      updatedAt: new Date().toISOString()
    };
    showToast('👥 Colaborador actualizado con éxito', 'success');
  }

  localStorage.setItem(userKey('recim_collaborators'), JSON.stringify(colabs));

  // Actualizar menús y vistas
  if (typeof applyModuleVisibility === 'function') {
    applyModuleVisibility();
  }

  showColabsList();
}

// ---- DAR DE BAJA ----
function deleteCollaborator(index) {
  if (!isCurrentUserAdminOrFounder()) {
    showToast('❌ No tienes permisos para realizar esta acción', 'error');
    return;
  }
  if (!confirm('¿Estás seguro de que deseas dar de baja a este colaborador?')) return;

  const colabs = JSON.parse(localStorage.getItem(userKey('recim_collaborators')) || '[]');
  colabs.splice(index, 1);
  localStorage.setItem(userKey('recim_collaborators'), JSON.stringify(colabs));
  
  showToast('🗑️ Colaborador dado de baja con éxito', 'success');
  
  if (typeof applyModuleVisibility === 'function') {
    applyModuleVisibility();
  }

  renderCollaboratorsTable();
}

// ---- IMPORTAR (MOCK) ----
function handleImportCollaborators() {
  showToast('📤 Función de Importación Excel/CSV para Colaboradores habilitada en el menú principal', 'info');
}

// Helpers útiles
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(x => x + x).join('');
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
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

// Exportación global de funciones
window.renderCollaboratorsPage = renderCollaboratorsPage;
window.showColabsList = showColabsList;
window.showColabForm = showColabForm;
window.switchColabTab = switchColabTab;
window.saveCollaborator = saveCollaborator;
window.deleteCollaborator = deleteCollaborator;
window.handleSearchCollaborators = handleSearchCollaborators;
window.handleImportCollaborators = handleImportCollaborators;
window.isCurrentUserAdminOrFounder = isCurrentUserAdminOrFounder;
window.changeColabsPage = changeColabsPage;
window.isCurrentUserAdminOrFounder = isCurrentUserAdminOrFounder;
