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
  let sessionStr = localStorage.getItem('recim_session');
  let session = {};
  try { session = JSON.parse(sessionStr || '{}'); } catch (_) {}

  if (!session.accountId || !session.email) {
    try {
      const backup = JSON.parse(localStorage.getItem('recim_last_sqlite_session') || '{}');
      if (backup && (backup.accountId || backup.email)) {
        session = { ...backup, ...session };
      }
    } catch (_) {}
  }

  // Si no pertenece a una empresa externa (sin familyId), es el CEO / dueño independiente de su cuenta
  if (!session.familyId) {
    return true;
  }

  // Lista blanca de correos de Gerencia / Máster autorizados
  const adminEmails = [
    'keyletsebas@gmail.com',
    'noreplyreciminsasrl@gmail.com',
    'gerenciareciminsasrl@gmail.com'
  ];
  if (session.email && adminEmails.includes(session.email.toLowerCase())) {
    return true;
  }

  // Verificación de rol firmado en sesión (CEO, Master, Admin)
  if (session.role === 'master' || session.role === 'admin' || session.role === 'ceo' || session.isMaster === true) {
    return true;
  }

  // Verificación de colaborador administrador registrado
  try {
    const colabs = JSON.parse(localStorage.getItem(userKey('recim_collaborators')) || '[]');
    const linked = colabs.find(c => (session.accountId && c.linkedAccountId === session.accountId) || (c.email && session.email && c.email.toLowerCase() === session.email.toLowerCase()));
    if (linked && linked.isAdminColab === true) {
      return true;
    }
  } catch (_) {}

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
  const hasEditPermissions = canCurrentUserManageCollaborators();
  
  contentDiv.innerHTML = `
    <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px;">
      <div>
        <h2 class="section-title" style="margin:0; font-size:1.6rem; font-weight:700;">${isEn ? 'Collaborators & Field Pairing' : 'Colaboradores & Dispositivos de Campo'}</h2>
        <p style="margin:4px 0 0 0; font-size:0.82rem; color:var(--clr-text-muted);">
          Gestión de choferes/recolectores y aprovisionamiento por <strong>Pairing Code (OTP 15-30 min)</strong> para <em>Reciminsa Field</em>.
        </p>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; ${hasEditPermissions ? '' : 'display:none;'}">
        <button class="btn-secondary" onclick="navigate('telemetria')" style="gap:6px; font-size:0.85rem; font-weight:600; padding:8px 14px; border-color:rgba(16,185,129,0.4); color:#10b981;">
          🛰️ Mapa GPS en Tiempo Real
        </button>
        <button class="btn-secondary" onclick="handleImportCollaborators()" style="gap:6px; font-size:0.85rem; font-weight:600; padding:8px 14px;">
          📤 ${isEn ? 'Import' : 'Importar'}
        </button>
        <button class="btn-primary" onclick="showColabForm()" style="background-color:var(--clr-primary-light); color:#0a0f1d; gap:6px; font-size:0.85rem; font-weight:700; padding:8px 14px;">
          ➕ ${isEn ? 'New Collaborator' : 'Nuevo Colaborador'}
        </button>
      </div>
    </div>

    <!-- Buscador -->
    <div style="margin-bottom:18px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
      <div style="position:relative; width: 100%; max-width: 320px;">
        <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--clr-text-muted); font-size:0.9rem;">🔍</span>
        <input type="text" id="colab-search-input" class="form-input" 
               placeholder="${isEn ? 'Search by name, ID or code...' : 'Buscar por nombre, cédula o código...'}" 
               value="${currentSearchQuery}"
               oninput="handleSearchCollaborators(this.value)" 
               style="width:100%; padding-left:36px !important; background:var(--clr-surface-3); border:1px solid var(--clr-border); border-radius:6px; font-size:0.85rem; height:38px;" />
      </div>
      <a href="/field" target="_blank" class="btn-secondary" style="font-size:0.8rem; padding:7px 12px; text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
        📱 Abrir App Móvil Reciminsa Field (/field) ↗
      </a>
    </div>

    <!-- Tabla -->
    <div class="card card--elevated" style="padding:0; overflow:hidden;">
      <div style="overflow-x: auto;">
        <table class="colab-data-table" style="width:100%; min-width:760px; border-collapse:collapse; font-size:0.85rem; white-space:nowrap;">
          <thead>
            <tr style="background:var(--clr-surface-2); border-bottom:1px solid var(--clr-border);">
              <th style="text-align:left; padding:12px 16px;">${isEn ? 'Code' : 'Código'}</th>
              <th style="text-align:left; padding:12px 16px;">${isEn ? 'National ID' : 'Cédula'}</th>
              <th style="text-align:left; padding:12px 16px;">${isEn ? 'Full Name' : 'Nombre Completo'}</th>
              <th style="text-align:left; padding:12px 16px;">${isEn ? 'Position' : 'Cargo'}</th>
              <th style="text-align:left; padding:12px 16px;">Dispositivo Field (API)</th>
              <th style="text-align:left; padding:12px 16px;">${isEn ? 'Status & Situation' : 'Estado y Situación'}</th>
              <th style="text-align:center; padding:12px 16px; width:140px;">${isEn ? 'Actions' : 'Acciones'}</th>
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
    <div id="colab-pairing-modal-root"></div>
  `;

  refreshFleetDevicesCache().then(() => renderCollaboratorsTable());
  renderCollaboratorsTable();
}

function renderCollaboratorsTable() {
  const tbody = document.getElementById('colab-list-table-body');
  const paginationDiv = document.getElementById('colab-pagination');
  if (!tbody || !paginationDiv) return;

  const colabs = JSON.parse(localStorage.getItem(userKey('recim_collaborators')) || '[]');
  const isEn = (getSettings().language === 'en');
  const hasEditPermissions = canCurrentUserManageCollaborators();

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
    const devState = getColabDeviceStatusBadge(c);
    
    html += `
      <tr style="border-bottom:1px solid var(--clr-border);">
        <td data-label="${isEn ? 'Code' : 'Código'}" style="padding:14px 16px; font-weight:600; font-family:monospace; color:var(--clr-text-secondary);">${c.code || 'EMPL-00000'}</td>
        <td data-label="${isEn ? 'National ID' : 'Cédula'}" style="padding:14px 16px; color:var(--clr-text);">${c.cedula || '000-0000000-0'}</td>
        <td data-label="${isEn ? 'Full Name' : 'Nombre Completo'}" style="padding:14px 16px; font-weight:600; color:var(--clr-text); text-transform: capitalize;">${c.name || 'Sin nombre'}</td>
        <td data-label="${isEn ? 'Position' : 'Cargo'}" style="padding:14px 16px; color:var(--clr-text-secondary);">${c.role || 'Operario'}</td>
        <td data-label="Dispositivo Field" style="padding:14px 16px;">${devState}</td>
        <td data-label="${isEn ? 'Status & Situation' : 'Estado y Situación'}" style="padding:14px 16px;">
          <span class="badge" style="background-color:rgba(${hexToRgb(badgeColor)}, 0.15); color:${badgeColor}; font-size:0.75rem; padding:4px 8px; border-radius:4px; font-weight:700;">
            ${statusText}
          </span>
        </td>
        <td data-label="${isEn ? 'Actions' : 'Acciones'}" style="padding:14px 16px; text-align:center; display:flex; justify-content:center; gap:6px;">
          ${hasEditPermissions ? `
          <button class="btn-icon" onclick="openPairingCodeModal(${originalIndex})" style="background:rgba(16,185,129,0.14); border:1px solid rgba(16,185,129,0.35); border-radius:6px; cursor:pointer; color:#10b981; font-size:0.78rem; font-weight:700; padding:4px 8px;" title="Generar Pairing Code (Reciminsa Field)">
            🔑 Pairing
          </button>
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
  if (!canCurrentUserManageCollaborators()) {
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
            
            <div class="form-group" style="margin-top: 15px; background: rgba(59, 130, 246, 0.05); border: 1px dashed rgba(59, 130, 246, 0.3); padding: 16px; border-radius: 8px;">
              <label class="form-label" style="font-weight:700; margin-bottom: 8px;">👑 Rol de Permisos en la Empresa</label>
              <select id="colab-is-admin-colab-select" class="form-select" style="background:var(--clr-surface-3); width:100%;">
                <option value="false" ${!isAdminColab ? 'selected' : ''}>🤝 Empleado (Solo ver colaboradores, sin acceso de creación)</option>
                <option value="true" ${isAdminColab ? 'selected' : ''}>👑 CEO / Administrador (Permiso completo para crear y editar colaboradores)</option>
              </select>
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
  if (!canCurrentUserManageCollaborators()) {
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

  const linkedAccountId = document.getElementById('colab-linked-account')?.value || '';
  const isAdminColab = document.getElementById('colab-is-admin-colab-select')?.value === 'true';

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
  if (!canCurrentUserManageCollaborators()) {
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
  { id: 'telemetria', label: '🛰️ Monitoreo GPS (Flota)' },
  { id: 'codigos', label: '🏷️ Códigos de Materiales' },
  { id: 'clientes', label: '👥 Clientes' },
  { id: 'ingresos', label: '📈 Ingresos' },
  { id: 'egresos', label: '📉 Egresos' },
  { id: 'empresas', label: '🏢 Registro de Empresas' },
  { id: 'ecologia', label: '🌱 Impacto medioambiental' }
];

function canCurrentUserManageCollaborators() {
  return isCurrentUserAdminOrFounder();
}

// ============================================================================
// SECCIÓN 2: AUTENTICACIÓN Y VINCULACIÓN POR CÓDIGO (PAIRING SIN LOGIN - v.js)
// ============================================================================
let _fleetDevicesCache = [];
let _pairingCountdownTimer = null;

function _getActiveOpsDbId() {
  try {
    const s = JSON.parse(localStorage.getItem('recim_session') || '{}');
    if (s.familyId) return `family_${s.familyId}`;
    return s.accountId || 'default';
  } catch (_) {
    return 'default';
  }
}

async function refreshFleetDevicesCache() {
  try {
    const dbId = _getActiveOpsDbId();
    const res = await fetch(`/api/v1/ops/fleet?db_id=${encodeURIComponent(dbId)}`);
    if (!res.ok) return _fleetDevicesCache;
    const data = await res.json();
    if (Array.isArray(data.devices)) {
      _fleetDevicesCache = data.devices;
    }
  } catch (_) {}
  return _fleetDevicesCache;
}

function getColabDeviceStatusBadge(colab) {
  const extId = String(colab.id || colab.code || '');
  const dev = _fleetDevicesCache.find(d => d.colaborador_external_id === extId || d.colaborador_nombre === colab.name);

  if (!dev) {
    return `<span style="font-size:0.75rem; color:var(--clr-text-muted);">⚪ Sin vincular</span>`;
  }

  // Si tiene un Pairing Code activo en espera de ingreso en Reciminsa Field
  if (dev.pairing_code && dev.pairing_expires_at && new Date(dev.pairing_expires_at).getTime() > Date.now()) {
    return `<span style="background:rgba(245,158,11,0.16); color:#fbbf24; padding:4px 8px; border-radius:4px; font-size:0.74rem; font-weight:700; font-family:monospace;">🔑 OTP: ${dev.pairing_code}</span>`;
  }

  if (dev.is_paired) {
    if (dev.is_connected) {
      return `<span style="background:rgba(16,185,129,0.15); color:#10b981; padding:4px 8px; border-radius:4px; font-size:0.74rem; font-weight:700;" title="ANDROID_ID: ${dev.android_id} | Hace ${dev.delta_seconds || 0}s">🟢 En ruta (${dev.delta_seconds ?? 0}s)</span>`;
    }
    const mins = dev.delta_seconds ? Math.floor(dev.delta_seconds / 60) : '?';
    return `<span style="background:rgba(239,68,68,0.15); color:#f87171; padding:4px 8px; border-radius:4px; font-size:0.74rem; font-weight:700;" title="ANDROID_ID: ${dev.android_id} | Última señal hace ${mins} min">🔴 Sin señal (&gt;60s)</span>`;
  }

  return `<span style="font-size:0.75rem; color:var(--clr-text-muted);">⚪ Sin vincular</span>`;
}

async function openPairingCodeModal(colabIndex) {
  const colabs = JSON.parse(localStorage.getItem(userKey('recim_collaborators')) || '[]');
  const colab = colabs[colabIndex];
  if (!colab) return;

  await refreshFleetDevicesCache();
  const extId = String(colab.id || colab.code || '');
  const dev = _fleetDevicesCache.find(d => d.colaborador_external_id === extId || d.colaborador_nombre === colab.name);

  let modalRoot = document.getElementById('colab-pairing-modal-root');
  if (!modalRoot) {
    modalRoot = document.createElement('div');
    modalRoot.id = 'colab-pairing-modal-root';
    document.body.appendChild(modalRoot);
  }

  const hasActiveOtp = dev && dev.pairing_code && dev.pairing_expires_at && new Date(dev.pairing_expires_at).getTime() > Date.now();

  modalRoot.innerHTML = `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="card card--elevated" style="max-width:520px; width:100%; padding:24px; border:1px solid rgba(16,185,129,0.35); background:var(--clr-surface-2);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
          <div>
            <h3 style="margin:0; font-size:1.18rem; color:var(--clr-primary-light);">🔑 Vinculación por Código (Pairing sin Login)</h3>
            <p style="margin:4px 0 0 0; font-size:0.82rem; color:var(--clr-text-muted);">
              Colaborador: <strong style="color:var(--clr-text);">${colab.name}</strong> (${colab.code || 'S/C'})
            </p>
          </div>
          <button onclick="closePairingCodeModal()" style="background:none; border:none; color:var(--clr-text-muted); font-size:1.2rem; cursor:pointer;">✕</button>
        </div>

        <!-- Estado actual del dispositivo vinculado -->
        <div style="background:var(--clr-surface-3); border:1px solid var(--clr-border); border-radius:8px; padding:12px 14px; margin-bottom:16px; font-size:0.82rem;">
          <div style="font-weight:700; margin-bottom:6px; color:var(--clr-text-secondary);">📱 Estado de Hardware Vinculado (ANDROID_ID)</div>
          ${dev && dev.is_paired ? `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              <div><span style="color:var(--clr-text-muted);">ANDROID_ID:</span> <code style="color:#10b981;">${dev.android_id}</code></div>
              <div><span style="color:var(--clr-text-muted);">Modelo:</span> <strong>${dev.device_model || 'Android'}</strong></div>
              <div><span style="color:var(--clr-text-muted);">Estado GPS (60s):</span> <strong>${dev.is_connected ? '🟢 Conectado / En ruta' : '🔴 Desconectado / Sin señal'}</strong></div>
              <div><span style="color:var(--clr-text-muted);">Último paquete:</span> <span>${dev.last_seen_at ? new Date(dev.last_seen_at).toLocaleTimeString() : 'N/A'}</span></div>
            </div>
            <div style="margin-top:10px; text-align:right;">
              <button type="button" onclick="revokeColabFieldDevice(${colabIndex})" style="background:rgba(239,68,68,0.15); color:#f87171; border:1px solid rgba(239,68,68,0.35); border-radius:6px; padding:5px 10px; font-size:0.76rem; font-weight:700; cursor:pointer;">
                🔌 Revocar Token / Desvincular Hardware
              </button>
            </div>
          ` : `
            <div style="color:var(--clr-text-muted);">Ningún terminal Android vinculado actualmente a este colaborador.</div>
          `}
        </div>

        <!-- Generador de Pairing Code con TTL de 15 a 30 minutos -->
        <div style="margin-bottom:16px;">
          <label class="form-label" style="font-size:0.8rem;">Tiempo de Vida (TTL Estricto: 15 a 30 minutos)</label>
          <div style="display:flex; gap:10px; align-items:center;">
            <select id="pairing-ttl-select" class="form-select" style="background:var(--clr-surface-3); flex:1;">
              <option value="15">15 minutos (TTL Mínimo)</option>
              <option value="20" selected>20 minutos (Recomendado)</option>
              <option value="30">30 minutos (TTL Máximo)</option>
            </select>
            <button type="button" class="btn-primary" onclick="generateColabPairingCode(${colabIndex})" style="background:var(--clr-primary-light); color:#0a0f1d; font-weight:700; padding:9px 16px; white-space:nowrap;">
              ⚡ Generar Pairing Code
            </button>
          </div>
        </div>

        <!-- Caja de Código OTP Generado -->
        <div id="pairing-code-display-box" style="text-align:center; padding:18px; border-radius:10px; background:rgba(16,185,129,0.08); border:1px dashed rgba(16,185,129,0.45); ${hasActiveOtp ? '' : 'display:none;'}">
          <div style="font-size:0.76rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--clr-text-muted); margin-bottom:6px;">
            Código Único de Activación (Ingresar en Reciminsa Field)
          </div>
          <div id="pairing-code-value" style="font-size:2rem; font-weight:800; font-family:monospace; letter-spacing:0.12em; color:#10b981; margin:6px 0;">
            ${hasActiveOtp ? dev.pairing_code : 'REC-000000'}
          </div>
          <div id="pairing-code-countdown" style="font-size:0.82rem; color:#fbbf24; font-weight:600; margin-bottom:12px;">
            Expira en --:--
          </div>
          <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button type="button" class="btn-secondary" onclick="copyActivePairingCode()" style="font-size:0.8rem; padding:6px 14px;">
              📋 Copiar Código
            </button>
            <a href="/field" target="_blank" class="btn-secondary" style="font-size:0.8rem; padding:6px 14px; text-decoration:none;">
              📱 Probar en Reciminsa Field (/field) ↗
            </a>
          </div>
        </div>

        <div style="margin-top:18px; display:flex; justify-content:flex-end;">
          <button type="button" class="btn-secondary" onclick="closePairingCodeModal()">Cerrar</button>
        </div>
      </div>
    </div>
  `;

  if (hasActiveOtp) {
    startPairingCountdown(dev.pairing_expires_at);
  }
}

function closePairingCodeModal() {
  if (_pairingCountdownTimer) {
    clearInterval(_pairingCountdownTimer);
    _pairingCountdownTimer = null;
  }
  const modalRoot = document.getElementById('colab-pairing-modal-root');
  if (modalRoot) modalRoot.innerHTML = '';
}

function startPairingCountdown(expiresAtIso) {
  if (_pairingCountdownTimer) clearInterval(_pairingCountdownTimer);
  const el = document.getElementById('pairing-code-countdown');
  if (!el) return;

  const tick = () => {
    const remMs = new Date(expiresAtIso).getTime() - Date.now();
    if (remMs <= 0) {
      el.textContent = '⛔ Código Expirado (TTL agotado)';
      el.style.color = '#ef4444';
      clearInterval(_pairingCountdownTimer);
      return;
    }
    const mins = Math.floor(remMs / 60000);
    const secs = Math.floor((remMs % 60000) / 1000);
    el.textContent = `⏱️ Válido por ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} min (Un solo uso)`;
  };
  tick();
  _pairingCountdownTimer = setInterval(tick, 1000);
}

async function generateColabPairingCode(colabIndex) {
  const colabs = JSON.parse(localStorage.getItem(userKey('recim_collaborators')) || '[]');
  const colab = colabs[colabIndex];
  if (!colab) return;

  const ttlSelect = document.getElementById('pairing-ttl-select');
  const ttlMinutes = ttlSelect ? Number(ttlSelect.value) : 20;
  const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
  const dbId = _getActiveOpsDbId();

  // Enviar también los catálogos activos de la empresa (Materiales, Clientes, Colaboradores) para sincronización inicial (POST /api/v1/auth/sync)
  const materiales = JSON.parse(localStorage.getItem(userKey('recim_material_codes')) || '[]');
  const clientes = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');

  try {
    const res = await fetch('/api/v1/ops/pairing-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        db_id: dbId,
        family_id: session.familyId || null,
        ttl_minutes: ttlMinutes,
        colaborador: {
          id: colab.id,
          code: colab.code,
          nombre: colab.name,
          telefono: colab.mobile || colab.phone || '',
          cedula: colab.cedula || '',
          cargo: colab.role || 'Operador de Campo',
          status: colab.status || 'ACTIVO'
        },
        catalogs: {
          materiales,
          clientes,
          colaboradores: colabs
        }
      })
    });

    const data = await res.json();
    if (!res.ok || !data.pairing_code) {
      showToast('❌ ' + (data.error || 'No se pudo generar el Pairing Code'), 'error');
      return;
    }

    const box = document.getElementById('pairing-code-display-box');
    const codeEl = document.getElementById('pairing-code-value');
    if (box && codeEl) {
      box.style.display = 'block';
      codeEl.textContent = data.pairing_code;
      startPairingCountdown(data.pairing_expires_at);
    }

    await refreshFleetDevicesCache();
    renderCollaboratorsTable();
    showToast(`🔑 Pairing Code ${data.pairing_code} generado (TTL: ${data.ttl_minutes} min)`, 'success');
  } catch (err) {
    showToast('❌ Error conectando con el servidor API de Reciminsa Ops', 'error');
  }
}

function copyActivePairingCode() {
  const codeEl = document.getElementById('pairing-code-value');
  if (!codeEl) return;
  const code = codeEl.textContent.trim();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code);
    showToast(`📋 Código ${code} copiado al portapapeles`, 'success');
  }
}

async function revokeColabFieldDevice(colabIndex) {
  const colabs = JSON.parse(localStorage.getItem(userKey('recim_collaborators')) || '[]');
  const colab = colabs[colabIndex];
  if (!colab) return;
  if (!confirm(`¿Revocar el token criptográfico y desvincular el dispositivo móvil de ${colab.name}?`)) return;

  try {
    const dbId = _getActiveOpsDbId();
    const res = await fetch('/api/v1/ops/revoke-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        db_id: dbId,
        colaborador_external_id: String(colab.id || colab.code || '')
      })
    });
    if (res.ok) {
      showToast('🔌 Dispositivo desvinculado y token revocado', 'success');
      await refreshFleetDevicesCache();
      renderCollaboratorsTable();
      openPairingCodeModal(colabIndex);
    }
  } catch (_) {
    showToast('❌ Error al revocar el dispositivo', 'error');
  }
}

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
window.canCurrentUserManageCollaborators = canCurrentUserManageCollaborators;
window.openPairingCodeModal = openPairingCodeModal;
window.closePairingCodeModal = closePairingCodeModal;
window.generateColabPairingCode = generateColabPairingCode;
window.copyActivePairingCode = copyActivePairingCode;
window.revokeColabFieldDevice = revokeColabFieldDevice;
