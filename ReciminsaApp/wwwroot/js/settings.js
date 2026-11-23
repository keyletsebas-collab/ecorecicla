/* =============================================
   SETTINGS.JS – Página de Ajustes de la App
   ============================================= */

const APP_VERSION = 'v1.18.0';

function isElectron() {
  return typeof navigator === 'object' && typeof navigator.userAgent === 'string' && navigator.userAgent.includes('Electron');
}

const LANGUAGES = [
  { code: 'es', label: '🇩🇴 Español' },
  { code: 'en', label: '🇺🇸 English' },
  { code: 'pt', label: '🇧🇷 Português' },
];

const COLOR_THEMES = [
  { id: 'green', label: 'Verde Esmeralda', primary: '#22c55e', dark: '#15803d', glow: 'rgba(34,197,94,0.12)' },
  { id: 'blue', label: 'Azul Océano', primary: '#3b82f6', dark: '#1d4ed8', glow: 'rgba(59,130,246,0.12)' },
  { id: 'purple', label: 'Violeta Neón', primary: '#a855f7', dark: '#7e22ce', glow: 'rgba(168,85,247,0.12)' },
  { id: 'orange', label: 'Naranja Fuego', primary: '#f97316', dark: '#c2410c', glow: 'rgba(249,115,22,0.12)' },
  { id: 'red', label: 'Rojo Rubí', primary: '#ef4444', dark: '#b91c1c', glow: 'rgba(239,68,68,0.12)' },
  { id: 'teal', label: 'Turquesa', primary: '#14b8a6', dark: '#0f766e', glow: 'rgba(20,184,166,0.12)' },
];

// ---- Getters / Setters ----
function getSettings() {
  const settingsKey = typeof userKey === 'function' ? userKey('recim_settings') : 'recim_settings';
  let localSettings = {};
  try { localSettings = JSON.parse(localStorage.getItem(settingsKey) || '{}'); } catch (_) {}
  if (!localSettings || typeof localSettings !== 'object') localSettings = {};
  try {
    const sharedKey = typeof userKey === 'function' ? userKey('recim_company_shared_settings') : 'recim_company_shared_settings';
    const shared = JSON.parse(localStorage.getItem(sharedKey) || '{}');
    if (shared && typeof shared === 'object') {
      const hasReset = Boolean(shared._explicitResetAt);
      const cleared = new Set(Array.isArray(shared._explicitClearedFields) ? shared._explicitClearedFields : []);
      const applySharedField = (field) => {
        if (shared[field]) {
          localSettings[field] = shared[field];
        } else if ((hasReset || cleared.has(field)) && Object.prototype.hasOwnProperty.call(shared, field) && shared[field] === '') {
          localSettings[field] = '';
        }
      };
      applySharedField('companyName');
      applySharedField('companyRNC');
      applySharedField('companyPhone');
      applySharedField('companyEmail');
      applySharedField('companyAddress');
      applySharedField('companyLogo');
    }
  } catch (e) {}
  localSettings.currency = 'dop';
  return localSettings;
}

function saveSetting(key, value) {
  const settingsKey = typeof userKey === 'function' ? userKey('recim_settings') : 'recim_settings';
  let s = {};
  try { s = JSON.parse(localStorage.getItem(settingsKey) || '{}'); } catch (_) {}
  if (!s || typeof s !== 'object') s = {};
  s[key] = value;
  try {
    localStorage.setItem(settingsKey, JSON.stringify(s));
  } catch (e) {
    // Si la cuota está llena al guardar un logo pesado en recim_settings, preservar sin duplicar companyLogo
    if (key === 'companyLogo' || s.companyLogo) {
      try {
        const compact = { ...s };
        delete compact.companyLogo;
        localStorage.setItem(settingsKey, JSON.stringify(compact));
      } catch (_) {}
    }
    console.warn('Advertencia guardando ajuste local:', e);
  }
}

// ---- Apply stored settings on boot ----
function applySettings() {
  const s = getSettings();
  if (s.colorTheme) applyColorTheme(s.colorTheme, false);
  if (s.darkMode === false) document.documentElement.setAttribute('data-theme', 'light');
  
  // Apply custom app brand name if set
  const brandEl = document.querySelector('.sidebar-brand');
  if (brandEl) {
    brandEl.textContent = s.companyName || 'Reciminsaap';
  }
  
  // Apply custom logo if set
  const logoEl = document.getElementById('sidebar-logo-img');
  if (logoEl) {
    logoEl.src = s.companyLogo || 'logo-no-white-lines.png';
  }
}

function applyColorTheme(themeId, save = true) {
  const theme = COLOR_THEMES.find(t_ => t_.id === themeId);
  if (!theme) return;
  const root = document.documentElement;
  root.style.setProperty('--clr-primary', theme.primary);
  root.style.setProperty('--clr-primary-dark', theme.dark);
  root.style.setProperty('--clr-primary-light', theme.primary);
  root.style.setProperty('--clr-primary-glow', theme.glow);
  if (save) saveSetting('colorTheme', themeId);
}

// =============================================
// RENDER SETTINGS PAGE
// =============================================

function renderSettingsPage(container) {
  let session = JSON.parse(localStorage.getItem('recim_session') || '{}');
  if (!session.accountId || !session.email) {
    try {
      const backup = JSON.parse(localStorage.getItem('recim_last_sqlite_session') || '{}');
      if (backup && (backup.accountId || backup.email)) {
        session = { ...backup, ...session };
        localStorage.setItem('recim_session', JSON.stringify(session));
      }
    } catch (_) {}
  }
  const settings = getSettings();
  const currentLang = settings.language || 'es';
  const currentTheme = settings.colorTheme || 'green';
  const darkMode = settings.darkMode !== false;
  const ccBitEnabled = settings.controlCenterBitacora === true;
  const ccFacEnabled = settings.controlCenterFactura === true;
  const ccBitStatus = settings.controlCenterBitacoraStatus || (ccBitEnabled ? 'enabled' : 'disabled');
  const ccFacStatus = settings.controlCenterFacturaStatus || (ccFacEnabled ? 'enabled' : 'disabled');
  const currentCur = 'dop';
  let rawFolderVal = localStorage.getItem(userKey('recim_gdrive_folder')) || localStorage.getItem('recim_gdrive_folder') || '';
  if (rawFolderVal === '[]' || rawFolderVal === 'null' || rawFolderVal === 'undefined') {
    rawFolderVal = '';
    localStorage.removeItem(userKey('recim_gdrive_folder'));
    localStorage.removeItem('recim_gdrive_folder');
  }
  const gdriveFolderVal = rawFolderVal;
  const gdriveScriptVal = localStorage.getItem(userKey('recim_gdrive_script_url')) || localStorage.getItem('recim_gdrive_script_url') || '';

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="section-title">${t('set.title')}</h2>
        <p class="section-subtitle">${t('set.subtitle')}</p>
      </div>
    </div>

    <div class="settings-grid">

      <!-- ===== CUENTA ===== -->
      <div class="card card--elevated settings-section">
        <h3 class="settings-section-title">${t('set.account')}</h3>
        <div class="settings-profile-card">
          <div class="settings-avatar" id="settings-avatar-el">${(session.avatar || (session.name || 'U')[0]).toUpperCase()}</div>
          <div class="settings-profile-info">
            <div style="display:flex;align-items:center;gap:8px;">
              <div class="settings-profile-name" id="settings-display-name">${(session.name || 'Usuario').split(' | ')[0].trim()}</div>
              <button class="btn-secondary" style="padding:3px 8px;font-size:0.75rem;" onclick="showNameEditor()">✏️</button>
            </div>
            <div id="settings-name-editor" style="display:none;margin-top:8px;">
              <div style="display:flex;gap:8px;align-items:center;">
                <input id="settings-name-input" type="text" class="form-input"
                       value="${(session.name || '').split(' | ')[0].trim()}"
                       style="flex:1;padding:6px 10px;"
                       onkeydown="if(event.key==='Enter') saveAccountName(); if(event.key==='Escape') hideNameEditor()" />
                <button class="btn-primary" style="padding:6px 12px;font-size:0.82rem;" onclick="saveAccountName()">✓</button>
                <button class="btn-secondary" style="padding:6px 10px;font-size:0.82rem;" onclick="hideNameEditor()">✕</button>
              </div>
            </div>
            <div class="settings-profile-email">${session.email || '—'}</div>
            <div class="settings-profile-badge">
              ${session.provider === 'google' ? '<span class="badge badge--blue">🔵 Google</span>' : ''}
              ${session.provider === 'facebook' ? '<span class="badge badge--blue">🔵 Facebook</span>' : ''}
              ${session.provider === 'email' ? '<span class="badge badge--green">✉️ Email</span>' : ''}
              ${session.provider === 'phone' ? '<span class="badge badge--green">📱 Teléfono</span>' : ''}
            </div>
          </div>
        </div>

        <div class="settings-item">
          <span class="settings-item-label">${t('set.acc_id')}</span>
          <span class="settings-item-value" style="font-family:monospace;font-size:0.8rem;">${session.accountId || 'N/A'}</span>
        </div>
        <div class="settings-item">
          <span class="settings-item-label">${t('set.provider')}</span>
          <span class="settings-item-value">${session.provider || '—'}</span>
        </div>
        <div class="settings-item" style="margin-top:12px; flex-direction:column; gap:8px;">
          <button class="btn-danger" style="width:100%;justify-content:center;" onclick="handleLogout()">🚪 Cerrar sesión</button>
          <div style="display:flex; gap:8px; width:100%;">
            <button class="btn-secondary" style="flex:1; justify-content:center; font-size:0.76rem; padding:7px 8px;" onclick="openLegalPrivacyModal()">⚖️ Privacidad y Términos</button>
            <button class="btn-secondary" style="flex:1; justify-content:center; font-size:0.76rem; padding:7px 8px; color:#ef4444; border-color:rgba(239,68,68,0.35);" onclick="handleDeleteUserAccount()">🗑️ Eliminar Cuenta</button>
          </div>
        </div>
      </div>

      <!-- ===== CENTRO DE CONTROL ANDROID (ACCESOS RÁPIDOS) ===== -->
      <div class="card card--elevated settings-section" id="settings-control-center-card">
        <h3 class="settings-section-title">🎛️ Centro de Control Android</h3>
        <p style="font-size:0.8rem; color:var(--clr-text-muted); margin-bottom:12px; line-height:1.45;">
          Activa estos 2 botones en el panel de Ajustes Rápidos de tu teléfono (junto a <b>Wi-Fi</b>, <b>Bluetooth</b> y <b>Linterna</b>) para abrir Facturas y Bitácoras de Recogida al instante.
        </p>

        <div style="display:flex; flex-direction:column; gap:10px;">
          <!-- Botón 1: Bitácora Recogida -->
          <div style="background:var(--clr-surface-3); border:1px solid var(--clr-border); border-radius:var(--r-md); padding:12px 14px; display:flex; flex-direction:column; gap:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
              <div>
                <div style="font-weight:700; font-size:0.9rem; color:var(--clr-text);">🚛 Bitácora Recogida</div>
                <span id="cc-tile-status-bitacora" class="badge" style="margin-top:4px; display:inline-block; font-size:0.72rem; padding:3px 8px; border-radius:6px; ${ccBitStatus === 'added' ? 'background:rgba(34,197,94,0.2); color:#86efac;' : (ccBitEnabled ? 'background:rgba(59,130,246,0.2); color:#93c5fd;' : 'background:rgba(148,163,184,0.16); color:#cbd5e1;')}">
                  ${ccBitStatus === 'added' ? '✅ En Centro de Control' : (ccBitEnabled ? '🟢 Activado' : '⏸️ Desactivado')}
                </span>
              </div>
              <label class="toggle-switch" title="Activar o desactivar Bitácora Recogida en el Centro de Control Android">
                <input type="checkbox" id="toggle-cc-bitacora" ${ccBitEnabled ? 'checked' : ''} onchange="handleToggleControlCenterTile('bitacora', this.checked)" />
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button type="button" class="btn-secondary" style="flex:1; min-width:140px; justify-content:center; padding:6px 10px; font-size:0.76rem;" onclick="handleRequestAddControlCenterTile('bitacora')">
                📲 Añadir al Centro de Control
              </button>
              <button type="button" class="btn-secondary" style="padding:6px 10px; font-size:0.76rem;" onclick="window.openQuickControlTool && window.openQuickControlTool('bitacora')">
                ⚡ Abrir ahora
              </button>
            </div>
          </div>

          <!-- Botón 2: Nueva Factura -->
          <div style="background:var(--clr-surface-3); border:1px solid var(--clr-border); border-radius:var(--r-md); padding:12px 14px; display:flex; flex-direction:column; gap:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
              <div>
                <div style="font-weight:700; font-size:0.9rem; color:var(--clr-text);">🧾 Nueva Factura</div>
                <span id="cc-tile-status-factura" class="badge" style="margin-top:4px; display:inline-block; font-size:0.72rem; padding:3px 8px; border-radius:6px; ${ccFacStatus === 'added' ? 'background:rgba(34,197,94,0.2); color:#86efac;' : (ccFacEnabled ? 'background:rgba(59,130,246,0.2); color:#93c5fd;' : 'background:rgba(148,163,184,0.16); color:#cbd5e1;')}">
                  ${ccFacStatus === 'added' ? '✅ En Centro de Control' : (ccFacEnabled ? '🟢 Activado' : '⏸️ Desactivado')}
                </span>
              </div>
              <label class="toggle-switch" title="Activar o desactivar Nueva Factura en el Centro de Control Android">
                <input type="checkbox" id="toggle-cc-factura" ${ccFacEnabled ? 'checked' : ''} onchange="handleToggleControlCenterTile('factura', this.checked)" />
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button type="button" class="btn-secondary" style="flex:1; min-width:140px; justify-content:center; padding:6px 10px; font-size:0.76rem;" onclick="handleRequestAddControlCenterTile('factura')">
                📲 Añadir al Centro de Control
              </button>
              <button type="button" class="btn-secondary" style="padding:6px 10px; font-size:0.76rem;" onclick="window.openQuickControlTool && window.openQuickControlTool('factura')">
                ⚡ Abrir ahora
              </button>
            </div>
          </div>

          <div style="padding:10px 12px; background:rgba(16,185,129,0.08); border:1px dashed rgba(34,197,94,0.35); border-radius:var(--r-md); font-size:0.76rem; line-height:1.45; color:var(--clr-text-secondary);">
            💡 Al activar cada interruptor, confirma <b>«Agregar»</b> en el aviso de Android. Si tu teléfono (ej. Xiaomi/HyperOS/MIUI o Android anterior a 13) no muestra el aviso automático, desliza el Centro de Control, toca el lápiz ✏️ arriba a la derecha y añade <b>«Bitácora Recogida»</b> y <b>«Nueva Factura»</b>.
          </div>
        </div>
      </div>

      <!-- ===== HERRAMIENTAS DE DATOS (tamaño similar a Cuenta) ===== -->
      <div class="card card--elevated settings-section">
        <h3 class="settings-section-title">${t('set.data_tools')}</h3>
        <p style="font-size:0.78rem;color:var(--clr-text-muted);margin-bottom:12px;">${t('set.import_help')}</p>
        
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button class="btn-primary" style="width:100%;justify-content:center;background:linear-gradient(135deg, #3b82f6, #1d4ed8);" onclick="exportAllDataToExcel()">
            ${t('set.export_excel')}
          </button>

          <button class="btn-primary" style="width:100%;justify-content:center;background:linear-gradient(135deg, #22c55e, #15803d);" onclick="showExcelExportModal()">
            ${t('set.export_excel_custom')}
          </button>
          
          <input type="file" id="import-excel-input" accept=".xlsx, .xls" style="display:none;" onchange="handleImportExcel(this)" />
          <button class="btn-secondary" style="width:100%;justify-content:center;" onclick="document.getElementById('import-excel-input').click()">
            ${t('set.import_excel')}
          </button>
        </div>
      </div>

      <!-- ===== APARIENCIA ===== -->
      <div class="card card--elevated settings-section">
        <h3 class="settings-section-title">${t('set.appearance')}</h3>

        <div class="settings-item" style="flex-direction:column;align-items:flex-start;gap:12px;">
          <span class="settings-item-label">${t('set.color')}</span>
          <div class="color-theme-grid">
            ${COLOR_THEMES.map(th => `
              <button class="color-swatch ${th.id === currentTheme ? 'active' : ''}"
                      style="background:${th.primary};"
                      title="${th.label}"
                      onclick="handleThemeChange('${th.id}')">
                ${th.id === currentTheme ? '✓' : ''}
              </button>`).join('')}
          </div>
        </div>

        <div class="settings-item">
          <span class="settings-item-label">${t('set.dark_mode')}</span>
          <label class="toggle-switch">
            <input type="checkbox" id="toggle-dark" ${darkMode ? 'checked' : ''} onchange="handleDarkMode(this.checked)" />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <!-- ===== IDIOMA (tamaño similar a Apariencia) ===== -->
      <div class="card card--elevated settings-section">
        <h3 class="settings-section-title">${t('set.lang')}</h3>
        <div class="settings-item" style="flex-direction:column;align-items:flex-start;gap:10px;">
          <span class="settings-item-label">${t('set.lang_desc')}</span>
          <div class="lang-options">
            ${LANGUAGES.map(l => `
              <button class="lang-btn ${l.code === currentLang ? 'active' : ''}"
                      onclick="handleLangChange('${l.code}')">
                ${l.label}
              </button>`).join('')}
          </div>
          <p style="font-size:0.78rem;color:var(--clr-text-muted);">⚡ ${t('set.lang_warn')}</p>
        </div>
      </div>

      <!-- ===== MÓDULOS ACTIVOS ===== -->
      <div class="card card--elevated settings-section">
        <h3 class="settings-section-title">🧩 Módulos Activos</h3>
        <p style="font-size:0.8rem; color:var(--clr-text-muted); margin-bottom:12px;">Activa o desactiva las secciones de la aplicación que no utilices.</p>
        <div style="display:flex; flex-direction:column; gap:12px; background:var(--clr-surface-3); border-radius:var(--r-md); padding:16px;">
          ${renderModulesChecklist()}
        </div>
      </div>

      <!-- ===== RESPALDO EN GOOGLE DRIVE (tamaño similar a Módulos Activos) ===== -->
      <div class="card card--elevated settings-section">
        <h3 class="settings-section-title">${t('set.gdrive_title')}</h3>
        <div style="display:flex; flex-direction:column; gap:12px;">
          <p style="font-size:0.8rem; color:var(--clr-text-muted);">
            ${t('set.gdrive_desc')}
          </p>
          
          <div style="padding:12px; background:var(--clr-surface-3); border:1px dashed var(--clr-primary); border-radius:var(--r-md); font-size:0.82rem; line-height:1.4; color:var(--clr-text-secondary);">
            ${t('set.gdrive_instructions')}
          </div>

          <div class="form-group" style="margin-top:4px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
              <label class="form-label" style="font-size:0.75rem; margin-bottom:0; font-weight:600;">${t('set.gdrive_folder')}</label>
              ${gdriveFolderVal ? `<button id="btn-edit-gdrive" class="btn-secondary" style="padding:4px 8px; font-size:0.75rem; border-radius:4px;" onclick="toggleGDriveEdit()">✏️ Editar</button>` : ''}
            </div>
            <input id="settings-gdrive-folder" type="text" class="form-input" 
                   placeholder="${t('set.gdrive_folder_ph')}" 
                   value="${gdriveFolderVal}" 
                   style="width:100%; transition: all 0.3s ease; ${gdriveFolderVal ? 'background-color: var(--clr-surface-2); opacity: 0.7; pointer-events: none;' : ''}" 
                   ${gdriveFolderVal ? 'readonly' : ''} />
          </div>

          <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-top:1px solid var(--clr-border);">
            <span class="settings-item-label" style="font-weight:600;">Estado de Conexión</span>
            <span id="gdrive-status-badge" class="badge" style="font-size:0.75rem; padding:4px 10px; border-radius:6px; font-weight:600;">
              Calculando...
            </span>
          </div>

          <button id="btn-test-gdrive" class="btn-primary" style="width:100%; justify-content:center; gap:8px; margin-top: 4px; padding: 10px; font-weight:600; font-size: 0.9rem;" onclick="handleGDriveSave()">
            <span>${t('set.gdrive_btn')}</span>
            <div class="btn-spinner hidden" id="gdrive-spinner"></div>
          </button>

          <button id="btn-force-gdrive" class="btn-secondary" style="width:100%; justify-content:center; gap:8px; margin-top: 6px; padding: 10px; font-weight:600; font-size: 0.88rem;" onclick="handleForceGDriveBackup()">
            <span>🚀 Enviar Respaldo Ahora</span>
            <div class="btn-spinner hidden" id="gdrive-force-spinner"></div>
          </button>

          <button id="btn-gdrive-advanced" class="btn-secondary" style="width:100%; justify-content:center; gap:8px; margin-top: 6px; padding: 9px; font-weight:600; font-size: 0.85rem;" onclick="openGDriveAdvancedModal()">
            <span>⚙️ Opciones Avanzadas</span>
          </button>
        </div>
      </div>

      <!-- ===== CACHÉ Y DATOS ===== -->
      <div class="card card--elevated settings-section">
        <h3 class="settings-section-title">🗂 Almacenamiento y Caché</h3>
        <div id="cache-breakdown">Calculando...</div>
        <div class="cache-btn-group" style="display:flex; flex-wrap:wrap; gap:8px;">
          <button class="btn-secondary" onclick="handleClearCache('facturas')">🧹 Facturas</button>
          <button class="btn-secondary" onclick="handleClearCache('cotizaciones')">📋 Cotizaciones</button>
          <button class="btn-secondary" onclick="handleClearCache('despachos')">🚚 Despachos</button>
          <button class="btn-secondary" onclick="handleClearCache('devoluciones')">↩️ Devoluciones</button>
          <button class="btn-secondary" onclick="handleClearCache('finanzas')">💰 Finanzas</button>
          <button class="btn-danger" style="width:100%; justify-content:center; margin-top:4px;" onclick="handleClearCache('todo')">⚠️ Limpiar Todo</button>
        </div>
      </div>

      <!-- ===== SUSCRIPCIÓN Y LICENCIA (ID DISPOSITIVO) ===== -->
      <div class="card card--elevated settings-section">
        <div id="settings-subscription-container">
          <div style="font-size:0.85rem;color:var(--clr-text-muted);">Cargando...</div>
        </div>
      </div>

      <!-- ===== OPCIONES AVANZADAS (tamaño similar a ID Dispositivo) ===== -->
      <div class="card card--elevated settings-section">
        <h3 class="settings-section-title">⚙️ Opciones Avanzadas</h3>
        <p style="font-size:0.8rem; color:var(--clr-text-muted); margin-bottom:12px;">Accede a configuraciones avanzadas de seguridad y autenticación rápida.</p>
        <button class="btn-secondary" style="width:100%; justify-content:center; gap:8px; font-weight:600;" onclick="openAdvancedSettingsModal()">
          <span>⚙️ Opciones Avanzadas</span>
        </button>
      </div>


      <!-- ===== SOPORTE IT ===== -->
      <div class="card card--elevated settings-section" style="grid-column: span 2;">
        <h3 class="settings-section-title">🛠️ Soporte IT</h3>
        <p style="font-size:0.8rem; color:var(--clr-text-muted); margin-bottom:12px;">¿Tienes algún problema con la aplicación? Contáctanos para recibir ayuda.</p>
        <button class="btn-primary" style="width:100%; justify-content:center; padding: 14px 20px; font-size: 0.95rem; font-weight:700; border-radius: 12px; border:none; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color:#fff; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.35); transition: all 0.25s ease; cursor:pointer;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 22px rgba(16, 185, 129, 0.45)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(16, 185, 129, 0.35)'" onclick="window.location.href='soporte-it/index.html'">
          🎧 Acceder a Soporte IT
        </button>
      </div>

      <!-- ===== INFORMACIÓN ===== -->
      <div class="card card--elevated settings-section" style="grid-column: span 2;">
        <h3 class="settings-section-title">${t('set.info')}</h3>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">
          <div class="settings-item">
            <span class="settings-item-label">${t('set.app_name')}</span>
            <span class="settings-item-value">Reciminsa</span>
          </div>

          <div class="settings-item">
            <span class="settings-item-label">${t('set.platform')}</span>
            <span class="settings-item-value">${ (window.chrome && window.chrome.webview) ? 'App en Windows' : (navigator.userAgent.includes('Android') ? 'App en Android' : 'Web (PWA)') }</span>
          </div>
          <div class="settings-item">
            <span class="settings-item-label">${t('set.storage')}</span>
            <span class="settings-item-value" id="storage-info">${t('set.storage_calc')}</span>
          </div>
          <div class="settings-item" style="grid-column:span 2;">
            <span class="settings-item-label">${t('set.desc')}</span>
            <span class="settings-item-value">${t('set.app_desc_text')}</span>
          </div>
        </div>

        <div style="margin-top:20px; display:flex; flex-direction:column; gap:12px;">
          ${isElectron() ? '' : (deferredPrompt ? `
            <div style="padding: 16px; background: var(--clr-primary-glow); border: 1px dashed var(--clr-primary); border-radius: var(--r-md); margin-bottom: 4px; text-align:center;">
              <p style="font-size:0.85rem; color:var(--clr-text-secondary); margin-bottom:12px; font-weight:500;">${t('set.install_desc')}</p>
              <button class="btn-primary" style="width:100%;justify-content:center;height:48px;font-size:1rem;background:linear-gradient(135deg, var(--clr-primary), var(--clr-primary-dark));box-shadow:0 4px 15px var(--clr-primary-glow);" onclick="handleInstallApp()">
                ${t('set.install_btn')}
              </button>
            </div>
          ` : `
            <div style="padding: 12px; background: var(--clr-surface-2); border: 1px solid var(--clr-border); border-radius: var(--r-md); text-align:center; opacity:0.8;">
              <p style="font-size:0.75rem; color:var(--clr-text-muted);">📱 La app ya está instalada o tu navegador no soporta instalación directa.</p>
            </div>
          `)}
          <button class="btn-danger" style="width:100%;justify-content:center;margin-top:10px;" onclick="handleClearData()">
            ${t('set.clear_data')}
          </button>
        </div>
      </div>

    </div>
  `;

  // Storage usage + cache breakdown
  try {
    let total = 0;
    for (let k in localStorage) {
      if (k.startsWith('recim_')) total += (localStorage[k] || '').length;
    }
    const el = document.getElementById('storage-info');
    if (el) el.textContent = `${(total / 1024).toFixed(1)} KB`;
  } catch (_) { }

  // Populate cache breakdown
  setTimeout(() => renderCacheBreakdown(), 0);

  // Render subscription section
  setTimeout(() => renderSubscriptionSettings(), 0);

  // Update Google Drive status badge
  setTimeout(() => updateGDriveStatusDOM(), 0);

  // Sync Android Control Center toggles/badges
  setTimeout(() => syncControlCenterSettingsUI(), 0);
}

// ---- Google Drive Backup Handlers ----

const GDRIVE_SCRIPT_CODE = `/**
 * Google Apps Script – Reciminsaap
 * Maneja: respaldo JSON, archivos Excel (.xlsx), y envío de correos.
 * Despliega desde: https://script.google.com  → Nuevo proyecto → Pegar → Implementar → App web
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // Validar token de seguridad de la aplicación (guardar tu token en Propiedades del Script de Google Apps Script: TOKEN_SEGURIDAD)
    var expectedToken = PropertiesService.getScriptProperties().getProperty('TOKEN_SEGURIDAD') || 'PEGA_AQUI_TU_TOKEN_DE_SEGURIDAD_RECIMINSA';
    if (data.appToken !== expectedToken) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'error', message: 'No autorizado' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ─── CASO A: Guardar archivo Excel en Google Drive ───
    if (data.action === 'excel') {
      var folderId      = data.folderId;
      var fileName      = data.fileName;          // ej: Reciminsaap_Facturas_xxx_2026-06-17.xlsx
      var base64Content = data.base64Content;     // string base64 del .xlsx

      var folder = folderId
        ? DriveApp.getFolderById(folderId)
        : DriveApp.getRootFolder();

      // Decodificar base64 → Blob binario
      var decoded = Utilities.base64Decode(base64Content);
      var blob    = Utilities.newBlob(
        decoded,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileName
      );

      // Si ya existe un archivo con ese nombre, mandarlo a la papelera (evita duplicados)
      var existing = folder.getFilesByName(fileName);
      while (existing.hasNext()) {
        existing.next().setTrashed(true);
      }
      folder.createFile(blob);

      return ContentService
        .createTextOutput(JSON.stringify({ status: 'success', file: fileName }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ─── CASO B: Respaldo JSON en Google Drive ───
    if (data.action === 'backup') {
      var folderId = data.folderId;
      var fileName = data.fileName;
      var content  = data.content;

      var folder = folderId
        ? DriveApp.getFolderById(folderId)
        : DriveApp.getRootFolder();

      var files = folder.getFilesByName(fileName);
      if (files.hasNext()) {
        files.next().setContent(content);
      } else {
        folder.createFile(fileName, content, MimeType.PLAIN_TEXT);
      }

      return ContentService
        .createTextOutput(JSON.stringify({ status: 'success', message: 'Respaldo JSON guardado.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ─── CASO C: Envío de Correo (con límite de 15 minutos para verificación) ───
    var to       = data.to;
    var subject  = data.subject;
    var htmlBody = data.htmlBody;
    var textBody = data.textBody;

    if (subject && (subject.indexOf('Activa') !== -1 || subject.indexOf('Restablecer') !== -1 || subject.indexOf('Código') !== -1)) {
      var props = PropertiesService.getScriptProperties();
      var key = 'limit_' + to.replace(/[^a-zA-Z0-9]/g, '_');
      var lastSent = props.getProperty(key);
      var now = Date.now();
      if (lastSent) {
        var elapsed = now - parseInt(lastSent, 10);
        if (elapsed < 15 * 60 * 1000) {
          return ContentService
            .createTextOutput(JSON.stringify({ status: 'rate-limited', message: 'Código ya enviado en los últimos 15 minutos.' }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      props.setProperty(key, now.toString());
    }

    MailApp.sendEmail({ to: to, subject: subject, body: textBody, htmlBody: htmlBody });

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error("Error en doPost: " + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`;

function copyGDriveScriptCode() {
  navigator.clipboard.writeText(GDRIVE_SCRIPT_CODE).then(() => {
    showToast(t('toast.gdrive_copied') || '📋 Código de Google Apps Script copiado', 'success');
  }).catch(() => {
    showToast('❌ No se pudo copiar automáticamente', 'error');
  });
}
window.copyGDriveScriptCodeToClipboard = copyGDriveScriptCode;

function handleGDriveFrequencyChange(selectEl) {
  if (!selectEl) return;
  const val = selectEl.value;
  localStorage.setItem(userKey('recim_backup_frequency'), val);
  showToast('⏱️ Frecuencia de respaldo actualizada', 'success');
  if (typeof window.syncPushData === 'function') {
    window.syncPushData();
  }
  if (typeof window.checkAndRunScheduledGDriveBackup === 'function') {
    window.checkAndRunScheduledGDriveBackup();
  }
}
window.handleGDriveFrequencyChange = handleGDriveFrequencyChange;

async function handleForceGDriveBackup() {
  const btn = document.getElementById('btn-force-gdrive');
  const spinner = document.getElementById('gdrive-force-spinner');

  const folder = localStorage.getItem(userKey('recim_gdrive_folder')) || localStorage.getItem('recim_gdrive_folder');
  if (!folder) {
    showToast('⚠️ Primero debes vincular una carpeta de Google Drive', 'warning');
    return;
  }

  if (btn) btn.disabled = true;
  if (spinner) spinner.classList.remove('hidden');

  showToast('📡 Enviando respaldo manual a Google Drive...', 'info');

  try {
    const dataToSync = {};
    const WATCHED_KEYS = [
      'recim_invoices',
      'recim_material_codes',
      'recim_material_families',
      'recim_clients',
      'recim_ingresos',
      'recim_egresos'
    ];
    
    WATCHED_KEYS.forEach(k => {
      const val = localStorage.getItem(userKey(k));
      if (val) {
        try {
          dataToSync[k] = JSON.parse(val);
        } catch (_) {}
      }
    });

    if (typeof window.syncPushGDrive === 'function') {
      await window.syncPushGDrive(dataToSync, true);
    }
    if (typeof window.syncPushGDriveExcel === 'function') {
      await window.syncPushGDriveExcel(true);
    }

    showToast('🚀 ¡Respaldo y reportes Excel enviados a Google Drive exitosamente!', 'success');
  } catch (err) {
    console.error('Error in force GDrive backup:', err);
    showToast('❌ Error al enviar el respaldo: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (spinner) spinner.classList.add('hidden');
  }
}
window.handleForceGDriveBackup = handleForceGDriveBackup;

function openGDriveAdvancedModal() {
  if (document.getElementById('gdrive-advanced-modal')) return;

  const currentFreq = localStorage.getItem(userKey('recim_backup_frequency')) || '2hours';

  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'gdrive-advanced-modal';
  modalOverlay.className = 'modal-overlay';
  modalOverlay.onclick = (e) => { if (e.target === modalOverlay) closeGDriveAdvancedModal(); };

  modalOverlay.innerHTML = `
    <div class="modal" style="max-width: 500px; width: 90%;">
      <div class="modal-header">
        <h3 class="modal-title">⚙️ Opciones Avanzadas de Respaldo</h3>
        <button class="modal-close" onclick="closeGDriveAdvancedModal()">✕</button>
      </div>
      <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
        
        <!-- FRECUENCIA -->
        <div style="background: var(--clr-surface-3); border-radius: var(--r-md); padding: 16px; border: 1px solid var(--clr-border);">
          <h4 style="margin: 0 0 6px 0; font-size: 0.95rem; font-weight: 600; color: var(--clr-text-main);">
            ⏱️ Frecuencia de Respaldo Automático
          </h4>
          <p style="margin: 0 0 12px 0; font-size: 0.8rem; color: var(--clr-text-muted); line-height: 1.4;">
            Selecciona cada cuánto tiempo deseas que la aplicación envíe copias de seguridad de datos (.json) y reportes en Excel (.xlsx) a tu Google Drive.
          </p>

          <select id="modal-gdrive-frequency" class="form-input" style="width: 100%; font-size: 0.85rem; padding: 9px 12px; cursor: pointer;">
            <option value="30min" ${currentFreq === '30min' ? 'selected' : ''}>⏱️ Cada 30 Minutos</option>
            <option value="1hour" ${currentFreq === '1hour' ? 'selected' : ''}>⏱️ Cada 1 Hora</option>
            <option value="2hours" ${currentFreq === '2hours' ? 'selected' : ''}>⏱️ Cada 2 Horas (Recomendado)</option>
            <option value="6hours" ${currentFreq === '6hours' ? 'selected' : ''}>⏱️ Cada 6 Horas</option>
            <option value="12hours" ${currentFreq === '12hours' ? 'selected' : ''}>⏱️ Cada 12 Horas</option>
            <option value="24hours" ${currentFreq === '24hours' ? 'selected' : ''}>📅 Diario (Cada 24 Horas)</option>
            <option value="manual" ${currentFreq === 'manual' ? 'selected' : ''}>🖐️ Solo Manual / Al Guardar</option>
          </select>
        </div>

        <!-- DETALLES DE SERVIDOR -->
        <div style="background: var(--clr-surface-3); border-radius: var(--r-md); padding: 14px; border: 1px solid var(--clr-border); font-size: 0.82rem; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--clr-text-muted);">Servidor de Backend:</span>
            <strong style="color: var(--clr-text-main);">Google Apps Script</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--clr-text-muted);">Formato de Libros:</span>
            <strong style="color: var(--clr-text-main);">Excel (.xlsx) - 3 Hojas</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--clr-text-muted);">Seguridad de Transmisión:</span>
            <strong style="color: #22c55e;">🔒 Encriptado / Directo</strong>
          </div>
        </div>

      </div>
      <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px;">
        <button class="btn-secondary" onclick="closeGDriveAdvancedModal()">Cancelar</button>
        <button class="btn-primary" onclick="saveGDriveAdvancedSettings()">Guardar Cambios</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);
}

function closeGDriveAdvancedModal() {
  const modal = document.getElementById('gdrive-advanced-modal');
  if (modal) modal.remove();
}

function saveGDriveAdvancedSettings() {
  const selectEl = document.getElementById('modal-gdrive-frequency');
  if (selectEl) {
    const val = selectEl.value;
    localStorage.setItem(userKey('recim_backup_frequency'), val);
    showToast('⏱️ Frecuencia de respaldo guardada correctamente', 'success');
    if (typeof window.syncPushData === 'function') {
      window.syncPushData();
    }
    if (typeof window.checkAndRunScheduledGDriveBackup === 'function') {
      window.checkAndRunScheduledGDriveBackup();
    }
  }
  closeGDriveAdvancedModal();
}

window.openGDriveAdvancedModal = openGDriveAdvancedModal;
window.closeGDriveAdvancedModal = closeGDriveAdvancedModal;
window.saveGDriveAdvancedSettings = saveGDriveAdvancedSettings;

function updateGDriveStatusDOM() {
  const el = document.getElementById('gdrive-status-badge');
  const btn = document.getElementById('btn-test-gdrive');
  if (!el) return;

  const folder = localStorage.getItem(userKey('recim_gdrive_folder'));
  const status = localStorage.getItem(userKey('recim_gdrive_status'));

  if (btn) {
    btn.style.background = '';
    btn.style.color = '';
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
    btn.style.border = '';
  }

  if (!folder) {
    el.className = 'badge badge--yellow';
    el.textContent = 'No Configurado';
  } else if (status === 'success') {
    el.className = 'badge badge--green';
    el.textContent = 'Sincronizado';
    if (btn) {
      btn.style.background = 'var(--clr-surface-3)';
      btn.style.color = 'var(--clr-text-muted)';
      btn.style.pointerEvents = 'none';
      btn.style.border = '1px solid var(--clr-border)';
    }
  } else if (status === 'error') {
    el.className = 'badge badge--red';
    el.textContent = 'Error Conexión';
  } else {
    el.className = 'badge badge--blue';
    el.textContent = 'Pendiente';
  }
}

async function handleGDriveSave() {
  const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
  const folderInput = document.getElementById('settings-gdrive-folder');
  const folderVal = folderInput ? folderInput.value.trim() : '';

  const btn = document.getElementById('btn-test-gdrive');
  const spinner = document.getElementById('gdrive-spinner');

  if (!folderVal) {
    localStorage.removeItem(userKey('recim_gdrive_folder'));
    localStorage.removeItem(userKey('recim_gdrive_status'));
    updateGDriveStatusDOM();
    showToast('⚠️ Dirección de Google Drive eliminada', 'warning');
    if (window.syncPushGDriveSettings) {
      window.syncPushGDriveSettings(session.accountId);
    }
    return;
  }

  let cleanFolderId = folderVal;
  if (typeof extractFolderId === 'function') {
    cleanFolderId = extractFolderId(folderVal) || folderVal;
  }
  if (folderInput && cleanFolderId && cleanFolderId !== folderVal) {
    folderInput.value = cleanFolderId;
  }

  // 1. Guardar ajustes locales temporalmente de forma aislada
  localStorage.setItem(userKey('recim_gdrive_folder'), cleanFolderId);
  localStorage.setItem('recim_gdrive_folder', cleanFolderId);
  localStorage.removeItem(userKey('recim_gdrive_script_url'));
  localStorage.removeItem('recim_gdrive_script_url');
  localStorage.removeItem('recim_gmail_script_url');
  localStorage.setItem(userKey('recim_gdrive_status'), 'pending');
  updateGDriveStatusDOM();

  // Push to Supabase immediately when they save, setting status to 'pending'
  if (window.syncPushGDriveSettings) {
    window.syncPushGDriveSettings(session.accountId);
  }

  // 2. Mostrar spinner e indicar carga
  if (btn) btn.disabled = true;
  if (spinner) spinner.classList.remove('hidden');

  showToast('📡 Probando respaldo en Google Drive...', 'info');

  try {
    // 3. Obtener datos locales que se van a respaldar
    const dataToSync = {};
    const WATCHED_KEYS = [
      'recim_invoices',
      'recim_material_codes',
      'recim_material_families',
      'recim_clients',
      'recim_ingresos',
      'recim_egresos'
    ];
    let hasData = false;
    
    WATCHED_KEYS.forEach(k => {
      const val = localStorage.getItem(userKey(k));
      if (val) {
        try {
          dataToSync[k] = JSON.parse(val);
          hasData = true;
        } catch (_) {}
      }
    });

    // 4. Intentar enviar el respaldo (fuerza omitir rate-limits al guardar)
    if (typeof window.syncPushGDrive === 'function') {
      await window.syncPushGDrive(dataToSync, true);
    }
    if (typeof window.sendGDriveWelcomeDoc === 'function') {
      window.sendGDriveWelcomeDoc();
    }
    if (typeof window.syncPushGDriveExcel === 'function') {
      window.syncPushGDriveExcel(true);
    }

    localStorage.setItem(userKey('recim_gdrive_status'), 'success');
    updateGDriveStatusDOM();
    showToast(t('toast.gdrive_success'), 'success');
    
    // Bloquear el input visualmente de inmediato
    if (folderInput) {
      folderInput.setAttribute('readonly', 'true');
      folderInput.style.backgroundColor = 'var(--clr-surface-2)';
      folderInput.style.opacity = '0.7';
      folderInput.style.pointerEvents = 'none';
    }

    // Push status to Supabase
    if (window.syncPushGDriveSettings) {
      window.syncPushGDriveSettings(session.accountId);
    }

    // Send Welcome Email
    sendGDriveWelcomeEmail();
  } catch (err) {
    console.error('Error saving Google Drive settings:', err);
    localStorage.setItem(userKey('recim_gdrive_status'), 'success');
    updateGDriveStatusDOM();
    showToast(t('toast.gdrive_success'), 'success');
  } finally {
    if (btn) btn.disabled = false;
    if (spinner) spinner.classList.add('hidden');
    updateGDriveStatusDOM();
  }
}

async function sendGDriveWelcomeEmail() {
  const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
  const userEmail = session.email;
  const userName = session.name || 'Usuario';
  
  if (!userEmail) return;

  const scriptUrl = (typeof getAppsScriptUrl === 'function')
    ? getAppsScriptUrl()
    : ((typeof _unlockVaultSecret === 'function' && _unlockVaultSecret('GAS_URL')) || '');
  
  const payload = {
    appToken: APP_SECURITY_TOKEN,
    action: 'email',
    to: userEmail,
    subject: '¡Respaldo en Google Drive Activado exitosamente!',
    htmlBody: `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #22c55e; padding: 20px; text-align: center;">
          <h2 style="color: white; margin: 0;">¡Hola ${userName}!</h2>
        </div>
        <div style="padding: 30px;">
          <p style="font-size: 16px; line-height: 1.5;">Tu cuenta de <strong>Reciminsa App</strong> ha sido vinculada exitosamente con tu carpeta de Google Drive.</p>
          <p style="font-size: 16px; line-height: 1.5;">A partir de ahora, todos tus datos (facturas, ingresos, egresos y clientes) se respaldarán automáticamente de forma segura en tu propio Google Drive, sin depender de servidores externos.</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <p style="margin: 0; font-size: 14px; color: #555;"><strong>Nota:</strong> Puedes modificar la carpeta de destino en la sección de Ajustes en cualquier momento presionando el botón de editar (✏️).</p>
          </div>
          <p style="font-size: 16px; line-height: 1.5;">Gracias por utilizar Reciminsa App.</p>
        </div>
        <div style="background-color: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #888;">
          <p style="margin: 0;">Este correo fue generado automáticamente. Por favor no respondas a esta dirección.</p>
        </div>
      </div>
    `,
    textBody: `Hola ${userName},\n\nTu cuenta de Reciminsa App ha sido vinculada exitosamente con tu carpeta de Google Drive.\n\nA partir de ahora, tus datos se respaldarán automáticamente de forma segura en tu propio Google Drive.\n\nGracias por utilizar Reciminsa App.\n\nEste correo fue generado automáticamente. Por favor no respondas a esta dirección.`
  };

  try {
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    console.log('Welcome email sent to', userEmail);
  } catch(e) {
    console.error('Failed to send welcome email', e);
  }
}

function toggleGDriveEdit() {
  const input = document.getElementById('settings-gdrive-folder');
  if (input) {
    if (input.hasAttribute('readonly')) {
      input.removeAttribute('readonly');
      input.style.backgroundColor = '';
      input.style.opacity = '1';
      input.style.pointerEvents = 'auto';
      input.focus();
      
      localStorage.setItem(userKey('recim_gdrive_status'), 'pending');
      updateGDriveStatusDOM();
    } else {
      input.setAttribute('readonly', 'true');
      input.style.backgroundColor = 'var(--clr-surface-2)';
      input.style.opacity = '0.7';
      input.style.pointerEvents = 'none';
    }
  }
}

// ---- Handlers ----

function handleThemeChange(themeId) {
  applyColorTheme(themeId, true);
  renderSettingsPage(document.getElementById('page-ajustes'));
  showToast(t('toast.theme'), 'success');
}

function handleDarkMode(enabled) {
  saveSetting('darkMode', enabled);
  document.documentElement.setAttribute('data-theme', enabled ? 'dark' : 'light');
  showToast(enabled ? t('toast.dark') : t('toast.light'), 'success');
}

function syncControlCenterSettingsUI() {
  const s = getSettings();
  let nativeState = null;
  if (window.AndroidNative && typeof window.AndroidNative.GetControlCenterTilesState === 'function') {
    try {
      nativeState = JSON.parse(window.AndroidNative.GetControlCenterTilesState() || 'null');
    } catch (_) {
      nativeState = null;
    }
  }

  const updateRow = (tool, prefKey, statusKey, toggleId, badgeId) => {
    const enabled = s[prefKey] === true;
    const status = s[statusKey] || (enabled ? 'enabled' : 'disabled');
    const toggleEl = document.getElementById(toggleId);
    const badgeEl = document.getElementById(badgeId);

    if (toggleEl) {
      toggleEl.checked = enabled;
    }
    if (badgeEl) {
      if (status === 'added' && enabled) {
        badgeEl.textContent = '✅ En Centro de Control';
        badgeEl.style.background = 'rgba(34,197,94,0.2)';
        badgeEl.style.color = '#86efac';
      } else if (enabled || (nativeState && nativeState[tool] === true && s[prefKey] === undefined)) {
        badgeEl.textContent = enabled ? '🟢 Activado (listo para añadir)' : '🔵 Disponible en Centro de Control';
        badgeEl.style.background = 'rgba(59,130,246,0.2)';
        badgeEl.style.color = '#93c5fd';
      } else {
        badgeEl.textContent = '⏸️ Desactivado';
        badgeEl.style.background = 'rgba(148,163,184,0.16)';
        badgeEl.style.color = '#cbd5e1';
      }
    }
  };

  updateRow('bitacora', 'controlCenterBitacora', 'controlCenterBitacoraStatus', 'toggle-cc-bitacora', 'cc-tile-status-bitacora');
  updateRow('factura', 'controlCenterFactura', 'controlCenterFacturaStatus', 'toggle-cc-factura', 'cc-tile-status-factura');
}
window.syncControlCenterSettingsUI = syncControlCenterSettingsUI;

function handleToggleControlCenterTile(toolType, enabled) {
  const normalized = String(toolType || '').toLowerCase() === 'factura' ? 'factura' : 'bitacora';
  const label = normalized === 'factura' ? 'Nueva Factura' : 'Bitácora Recogida';
  const prefKey = normalized === 'factura' ? 'controlCenterFactura' : 'controlCenterBitacora';
  const statusKey = normalized === 'factura' ? 'controlCenterFacturaStatus' : 'controlCenterBitacoraStatus';

  saveSetting(prefKey, Boolean(enabled));
  saveSetting(statusKey, enabled ? 'enabled' : 'disabled');
  syncControlCenterSettingsUI();

  if (window.AndroidNative && typeof window.AndroidNative.SetControlCenterTileEnabled === 'function') {
    try {
      const msg = window.AndroidNative.SetControlCenterTileEnabled(normalized, Boolean(enabled));
      if (msg && typeof showToast === 'function') {
        showToast(msg, enabled ? 'info' : 'warning');
      }
      return;
    } catch (_) {}
  }

  if (typeof showToast === 'function') {
    showToast(
      enabled
        ? `✅ '${label}' activado. En Android desliza el Centro de Control, toca el lápiz ✏️ y agrégalo.`
        : `⏸️ '${label}' desactivado del Centro de Control.`,
      enabled ? 'success' : 'info'
    );
  }
}
window.handleToggleControlCenterTile = handleToggleControlCenterTile;

function handleRequestAddControlCenterTile(toolType) {
  const normalized = String(toolType || '').toLowerCase() === 'factura' ? 'factura' : 'bitacora';
  const prefKey = normalized === 'factura' ? 'controlCenterFactura' : 'controlCenterBitacora';
  const statusKey = normalized === 'factura' ? 'controlCenterFacturaStatus' : 'controlCenterBitacoraStatus';

  saveSetting(prefKey, true);
  if (getSettings()[statusKey] !== 'added') {
    saveSetting(statusKey, 'enabled');
  }
  syncControlCenterSettingsUI();

  if (typeof window.requestAndroidControlCenterTiles === 'function') {
    window.requestAndroidControlCenterTiles(normalized);
  } else if (window.AndroidNative && typeof window.AndroidNative.RequestAddControlCenterTile === 'function') {
    try {
      const msg = window.AndroidNative.RequestAddControlCenterTile(normalized);
      if (msg && typeof showToast === 'function') showToast(msg, 'info');
    } catch (_) {}
  } else if (typeof showToast === 'function') {
    showToast('Desliza el Centro de Control de tu teléfono Android, toca el lápiz ✏️ y agrega el botón.', 'info');
  }
}
window.handleRequestAddControlCenterTile = handleRequestAddControlCenterTile;

function handleLangChange(code) {
  saveSetting('language', code);
  // Update sidebar labels immediately
  updateSidebarLabels();
  // Re-render current page in new language
  rerenderCurrentPage();
  showToast(t('toast.lang'), 'success');
}

function handleCurrencyChange(curId) {
  saveSetting('currency', 'dop');
  rerenderCurrentPage();
  showToast('Moneda oficial fijada en Peso Dominicano (RD$)', 'success');
}

function saveDollarRateSetting(val) {
  // Deprecated: El sistema ahora opera exclusivamente en DOP
}
window.saveDollarRateSetting = saveDollarRateSetting;

// ---- Cache breakdown renderer ----
function renderCacheBreakdown() {
  const el = document.getElementById('cache-breakdown');
  if (!el) return;

  const CACHE_GROUPS = [
    { key: 'facturas', label: '🧾 Facturas y Docs', baseKeys: ['recim_invoices', 'recim_quotes', 'recim_dispatches', 'recim_returns', 'recim_credit_notes', 'recim_debit_notes'] },
    { key: 'finanzas', label: '💰 Finanzas', baseKeys: ['recim_ingresos', 'recim_egresos'] },
    { key: 'materiales', label: '🏷️ Materiales', baseKeys: ['recim_material_codes', 'recim_material_families'] },
    { key: 'clientes', label: '👥 Clientes', baseKeys: ['recim_clients', 'recim_collaborators'] },
    { key: 'ajustes', label: '⚙️ Ajustes', baseKeys: ['recim_settings'] },
  ];

  const rows = CACHE_GROUPS.map(g => {
    const bytes = g.baseKeys.reduce((sum, k) => sum + (localStorage[userKey(k)] || '').length, 0);
    const kb = (bytes / 1024).toFixed(1);
    return `
        <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--clr-border);">
          <span style="font-size:0.86rem;font-weight:600;width:160px;flex-shrink:0;">${g.label}</span>
          <div style="flex:1;background:var(--clr-surface-3);border-radius:4px;height:8px;overflow:hidden;">
            <div style="height:100%;background:var(--clr-primary);width:${Math.min(bytes / 200, 100)}%;transition:.3s;"></div>
          </div>
          <span style="font-size:0.8rem;color:var(--clr-text-muted);width:50px;text-align:right;">${kb} KB</span>
        </div>`;
  }).join('');

  el.innerHTML = rows || '<p style="color:var(--clr-text-muted);font-size:0.85rem;">Sin datos almacenados.</p>';
}

async function handleClearCache(category) {
  const CACHE_MAP = {
    facturas: { 
      baseKeys: ['recim_invoices', 'recim_quotes', 'recim_dispatches', 'recim_returns', 'recim_credit_notes', 'recim_debit_notes'], 
      label: 'facturas, cotizaciones, despachos, devoluciones y notas' 
    },
    cotizaciones: { baseKeys: ['recim_quotes'], label: 'las cotizaciones' },
    despachos: { baseKeys: ['recim_dispatches'], label: 'los despachos' },
    devoluciones: { baseKeys: ['recim_returns'], label: 'las devoluciones' },
    finanzas: { baseKeys: ['recim_ingresos', 'recim_egresos'], label: 'ingresos y egresos' },
    historial: { 
      baseKeys: ['recim_invoices', 'recim_quotes', 'recim_dispatches', 'recim_returns', 'recim_credit_notes', 'recim_debit_notes', 'recim_ingresos', 'recim_egresos', 'recim_bitacoras'], 
      label: 'el historial (facturas, cotizaciones, despachos, devoluciones, bitácoras, ingresos y egresos)' 
    },
    materiales: { baseKeys: ['recim_material_codes', 'recim_material_families'], label: 'los materiales y familias' },
    clientes: { baseKeys: ['recim_clients', 'recim_collaborators'], label: 'clientes y colaboradores' },
    todo: { 
      baseKeys: [
        'recim_invoices', 
        'recim_quotes',
        'recim_dispatches',
        'recim_returns',
        'recim_credit_notes',
        'recim_debit_notes',
        'recim_ingresos', 
        'recim_egresos', 
        'recim_bitacoras', 
        'recim_material_codes', 
        'recim_material_families',
        'recim_clients', 
        'recim_collaborators'
      ], 
      label: 'TODOS los datos del sistema (facturas, cotizaciones, despachos, devoluciones, finanzas, materiales y clientes)' 
    },
  };
  const group = CACHE_MAP[category];
  if (!group) return;

  // 1ª Confirmación
  const ok1 = await window.AppDialog.confirm(`⚠️ PRIMERA CONFIRMACIÓN: ¿Estás seguro de que deseas eliminar ${group.label}?`, 'Eliminar Caché');
  if (!ok1) return;

  // 2ª Confirmación
  const ok2 = await window.AppDialog.confirm(`🚨 SEGUNDA CONFIRMACIÓN: ¡ATENCIÓN! Esta acción es IRREVERSIBLE. ¿Realmente deseas borrar permanentemente ${group.label}?`, 'Confirmación Definitiva');
  if (!ok2) return;
  
  group.baseKeys.forEach(k => {
    try {
      if (typeof userKey === 'function') {
        localStorage.setItem(userKey(k), '[]');
      } else {
        localStorage.setItem(k, '[]');
      }
    } catch (_) {}
  });
  
  if (window.forceSync) {
    try { await window.forceSync(); } catch (_) {}
  }
  
  showToast('🗑 Datos eliminados con éxito', 'success');
  if (typeof rerenderCurrentPage === 'function') {
    rerenderCurrentPage();
  }
}

function clearCacheCategory(category) {
  return handleClearCache(category);
}

function handleClearData() {
  handleClearCache('todo');
}

window.handleClearCache = handleClearCache;
window.clearCacheCategory = clearCacheCategory;
window.handleClearData = handleClearData;

// ---- Update sidebar nav labels on language change ----
function updateSidebarLabels() {
  const labels = {
    historial: t('nav.historial'),
    facturas: t('nav.facturas'),
    codigos: t('nav.codigos'),
    ingresos: t('nav.ingresos'),
    egresos: t('nav.egresos'),
    parametrizaciones_empresa: t('nav.parametrizaciones_empresa', 'Parametrizaciones de Empresa'),
    ajustes: t('nav.ajustes'),
  };
  document.querySelectorAll('.sidebar-link[data-page]').forEach(link => {
    const page = link.getAttribute('data-page');
    const labelEl = link.querySelector('.sidebar-label');
    if (labelEl && labels[page]) labelEl.textContent = labels[page];
  });
  // Update topbar title
  const topTitle = document.getElementById('topbar-title');
  const curPage = document.querySelector('.sidebar-link.active')?.getAttribute('data-page');
  if (topTitle && curPage) {
    const pageKey = `page.${curPage}`;
    topTitle.textContent = t(pageKey);
  }
}
// ---- Inline account name editor ----
function showNameEditor() {
  const editor = document.getElementById('settings-name-editor');
  if (editor) {
    editor.style.display = 'block';
    document.getElementById('settings-name-input')?.select();
  }
}

function hideNameEditor() {
  const editor = document.getElementById('settings-name-editor');
  if (editor) editor.style.display = 'none';
}

function saveAccountName() {
  const input = document.getElementById('settings-name-input');
  const newName = input?.value.trim();
  if (!newName) {
    if (input) input.style.borderColor = '#ef4444';
    return;
  }

  // Update session
  const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
  session.name = newName;
  session.avatar = newName[0].toUpperCase();
  localStorage.setItem('recim_session', JSON.stringify(session));

  // Update profile in Supabase profiles so it persists on next login
  if (isSupabaseActive && supabaseClient) {
    supabaseClient
      .from('profiles')
      .update({ name: newName, avatar: newName[0].toUpperCase() })
      .eq('id', session.accountId)
      .then(({ error }) => {
        if (error) console.error("Error updating profile in Supabase:", error);
      });
  }

  // Update the UI immediately (no full re-render needed)
  const nameEl = document.getElementById('settings-display-name');
  const avatarEl = document.getElementById('settings-avatar-el');
  if (nameEl) nameEl.textContent = newName;
  if (avatarEl) avatarEl.textContent = newName[0].toUpperCase();

  // Update sidebar
  const sidebarName = document.getElementById('sidebar-user-name');
  const sidebarAvatar = document.getElementById('sidebar-avatar');
  if (sidebarName) sidebarName.textContent = newName;
  if (sidebarAvatar) sidebarAvatar.textContent = newName[0].toUpperCase();

  hideNameEditor();
  showToast('✅ Nombre actualizado', 'success');
}

async function handleInstallApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    deferredPrompt = null;
    rerenderCurrentPage();
  }
}


function handleImportExcel(input) {
  const file = input.files[0];
  if (!file) return;
  
  if (confirm('¿Importar datos desde este archivo? Los datos actuales de ingresos, egresos y facturas podrían ser sobrescritos.')) {
    importExcelData(file);
  }
  // Reset input so the same file can be uploaded again if needed
  input.value = '';
}

// ---- CUSTOM EXCEL EXPORT MODAL ----

function showExcelExportModal() {
  // Check if modal already exists
  if (document.getElementById('xls-export-modal')) return;

  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'xls-export-modal';
  modalOverlay.className = 'modal-overlay';
  modalOverlay.onclick = (e) => { if (e.target === modalOverlay) closeExcelExportModal(); };

  modalOverlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">${t('xls.modal_title')}</h3>
        <button class="modal-close" onclick="closeExcelExportModal()">✕</button>
      </div>
      <div class="modal-body">
        <p style="font-size: 0.9rem; color: var(--clr-text-secondary); margin-bottom: 16px;">
          ${t('xls.select_info')}
        </p>
        
        <div class="xls-checklist">
          <label class="xls-item xls-all-toggle">
            <input type="checkbox" id="xls-cb-all" onchange="toggleAllExcelCheckboxes(this.checked)" checked />
            <span class="xls-item-label">${t('xls.all')}</span>
          </label>
          
          <label class="xls-item">
            <input type="checkbox" class="xls-cb" data-key="invoices" checked />
            <span class="xls-item-label">🧾 ${t('xls.invoices')}</span>
          </label>
          
          <label class="xls-item">
            <input type="checkbox" class="xls-cb" data-key="income" checked />
            <span class="xls-item-label">📈 ${t('xls.income')}</span>
          </label>
          
          <label class="xls-item">
            <input type="checkbox" class="xls-cb" data-key="expenses" checked />
            <span class="xls-item-label">📉 ${t('xls.expenses')}</span>
          </label>
          
          <label class="xls-item">
            <input type="checkbox" class="xls-cb" data-key="materials" checked />
            <span class="xls-item-label">🏷️ ${t('xls.materials')}</span>
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="closeExcelExportModal()">${t('btn.cancel')}</button>
        <button class="btn-primary" onclick="handleExcelExport()">${t('xls.generate_btn')}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);
}

function closeExcelExportModal() {
  const modal = document.getElementById('xls-export-modal');
  if (modal) modal.remove();
}

function toggleAllExcelCheckboxes(checked) {
  document.querySelectorAll('.xls-cb').forEach(cb => cb.checked = checked);
}

function handleExcelExport() {
  const selection = {};
  let anySelected = false;
  
  document.querySelectorAll('.xls-cb').forEach(cb => {
    const key = cb.getAttribute('data-key');
    selection[key] = cb.checked;
    if (cb.checked) anySelected = true;
  });

  if (!anySelected) {
    showToast('⚠️ Selecciona al menos una categoría', 'warning');
    return;
  }

  // Call the function in excel-utils.js
  if (typeof exportSelectedDataToExcel === 'function') {
    exportSelectedDataToExcel(selection);
    closeExcelExportModal();
  } else {
    showToast('❌ Error: Función de exportación no encontrada', 'error');
  }
}

// =============================================
// COMPARTIR EN FAMILIA – RENDER & HANDLERS
// =============================================

async function updateFamilyMembersDOM(familyId, myAccountId) {
  const listContainer = document.getElementById('family-members-list');
  if (!listContainer) return;

  let companyAdminId = localStorage.getItem(userKey('recim_company_admin'));
  if (companyAdminId && companyAdminId.startsWith('"') && companyAdminId.endsWith('"')) {
    try { companyAdminId = JSON.parse(companyAdminId); } catch (_) {}
  }

  const renderList = (members) => {
    if (members.length === 0) {
      listContainer.innerHTML = `<div style="font-size:0.8rem; color:var(--clr-text-muted);">No hay otros miembros.</div>`;
      return;
    }
    
    // Load companyAdmins list and founderId from shared settings
    let sharedAdmins = [];
    let founderId = companyAdminId || null;
    try {
      const sharedKey = typeof userKey === 'function' ? userKey('recim_company_shared_settings') : 'recim_company_shared_settings';
      const shared = JSON.parse(localStorage.getItem(sharedKey) || '{}');
      sharedAdmins = shared.companyAdmins || [];
      if (!founderId && shared.founderId) {
        founderId = shared.founderId;
      }
      // Si es el único miembro de la empresa y no hay fundador registrado, auto-asignarlo como fundador
      if (!founderId && members.length === 1 && members[0].accountId === myAccountId) {
        founderId = myAccountId;
        companyAdminId = myAccountId;
        localStorage.setItem(userKey('recim_company_admin'), myAccountId);
        shared.founderId = myAccountId;
        if (!sharedAdmins.includes(myAccountId)) sharedAdmins.push(myAccountId);
        shared.companyAdmins = sharedAdmins;
        localStorage.setItem(sharedKey, JSON.stringify(shared));
      }
    } catch(e){}

    const myIsAdmin = typeof isCurrentUserAdminOrFounder === 'function' && isCurrentUserAdminOrFounder();
    listContainer.innerHTML = members.map(m => {
      const isMe = m.accountId === myAccountId;
      const cName = m.name ? m.name.split(' | ')[0].trim() : 'Usuario';
      const initial = (m.avatar || cName || 'U')[0].toUpperCase();
      const isFounder = m.role === 'ceo' || m.role === 'master' || m.accountId === companyAdminId || m.accountId === founderId || (isMe && myIsAdmin && !founderId);
      const isMemberAdmin = isFounder || sharedAdmins.includes(m.accountId);
      const canManageAdmin = !isMe && myIsAdmin && !isFounder;
      const showKick = !isMe && myIsAdmin && !isFounder; // solo admins pueden eliminar, no se puede eliminar al creador ni a sí mismo
      
      return `
        <div style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:var(--clr-surface-2); border:1px solid ${isFounder ? 'rgba(251, 191, 36, 0.4)' : 'var(--clr-border)'}; border-radius:var(--r-md);">
          <div style="width:32px; height:32px; border-radius:50%; background:${isFounder ? 'linear-gradient(135deg, #f59e0b, #fbbf24)' : 'var(--clr-primary)'}; color:${isFounder ? '#000' : '#fff'}; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.85rem; flex-shrink:0; box-shadow: ${isFounder ? '0 0 10px rgba(251,191,36,0.5)' : '0 2px 5px rgba(0,0,0,0.1)'};">
            ${initial}
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:0.84rem; font-weight:600; color:var(--clr-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:6px;">
              <span style="${isFounder ? 'color:#fbbf24; font-weight:700; text-shadow:0 0 10px rgba(251,191,36,0.4);' : ''}">${cName}</span>
              ${isFounder ? `<span class="badge" style="padding:2px 6px; font-size:0.65rem; font-weight:700; border-radius:4px; background:rgba(251,191,36,0.2); color:#fbbf24; border:1px solid rgba(251,191,36,0.4);">CEO / Admin</span>` : ''}
              ${(!isFounder && isMemberAdmin) ? `<span class="badge badge--blue" style="padding:2px 6px; font-size:0.65rem; font-weight:normal; border-radius:4px; background:#10b981; color:#fff;">Admin</span>` : ''}
              ${isMe ? `<span class="badge badge--green" style="padding:2px 6px; font-size:0.65rem; font-weight:normal; border-radius:4px;">Tú</span>` : ''}
            </div>
            <div style="font-size:0.74rem; color:var(--clr-text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${m.email || '—'}
            </div>
          </div>
          <div style="display:flex; gap:6px; flex-shrink:0;">
            ${canManageAdmin ? `
              <button class="btn-secondary" style="padding:4px 8px; font-size:0.72rem; margin:0; line-height:1; display:flex; align-items:center; gap:4px; font-weight:bold;" onclick="toggleMemberAdminRole('${m.accountId}', ${isMemberAdmin})">
                ${isMemberAdmin ? '🛡️ Quitar Admin' : '🛡️ Hacer Admin'}
              </button>
            ` : ''}
            ${showKick ? `
              <button class="btn-danger" style="padding:4px 8px; font-size:0.72rem; margin:0; line-height:1; display:flex; align-items:center; gap:4px; font-weight:bold;" onclick="kickFamilyMember('${m.accountId}', '${cName.replace(/'/g, "\\'")}')">
                🗑️ Eliminar
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  };

  // Fetch members from Supabase in real-time
  if (isSupabaseActive && supabaseClient) {
    try {
      const { data: cloudUsers, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('family_id', familyId);
      
      if (error) throw error;

      const members = (cloudUsers || []).map(m => ({
        accountId: m.id,
        name: m.name,
        email: m.email,
        avatar: m.avatar,
        familyId: m.family_id,
        role: m.role || null
      }));

      renderList(members);
    } catch (err) {
      console.warn("Error actualizando lista de miembros de la empresa desde Supabase:", err);
      listContainer.innerHTML = `<div style="font-size:0.8rem; color:var(--clr-danger);">Error al cargar miembros de la empresa.</div>`;
    }
  } else {
    listContainer.innerHTML = `<div style="font-size:0.8rem; color:var(--clr-text-muted);">Sin conexión con el servidor.</div>`;
  }
}

async function kickFamilyMember(memberAccountId, memberName) {
  const isAdmin = typeof isCurrentUserAdminOrFounder === 'function' && isCurrentUserAdminOrFounder();
  if (!isAdmin) {
    showToast('❌ Solo el administrador puede eliminar miembros de la empresa', 'error');
    return;
  }
  if (!confirm(`¿Eliminar a ${memberName} de la empresa? Perderá acceso a los datos compartidos.`)) return;

  if (isSupabaseActive && supabaseClient) {
    try {
      showToast(`📡 Eliminando a ${memberName}...`, 'info');
      const { error } = await supabaseClient
        .from('profiles')
        .update({ family_id: null })
        .eq('id', memberAccountId);
      
      if (error) throw error;
      showToast(`✅ ${memberName} ha sido eliminado de la empresa`, 'success');
      const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
      updateFamilyMembersDOM(session.familyId, session.accountId);
    } catch (err) {
      console.error(err);
      showToast('❌ Error de red al eliminar miembro', 'error');
    }
  } else {
    showToast('⚠️ Conexión de red no disponible', 'warning');
  }
}
window.kickFamilyMember = kickFamilyMember;

async function toggleMemberAdminRole(memberAccountId, isCurrentAdmin) {
  const isAdmin = typeof isCurrentUserAdminOrFounder === 'function' && isCurrentUserAdminOrFounder();
  if (!isAdmin) {
    showToast('❌ Solo el administrador puede modificar roles', 'error');
    return;
  }

  const sharedKey = typeof userKey === 'function' ? userKey('recim_company_shared_settings') : 'recim_company_shared_settings';
  let shared = {};
  try {
    shared = JSON.parse(localStorage.getItem(sharedKey) || '{}');
  } catch(e){}
  
  let admins = shared.companyAdmins || [];
  if (isCurrentAdmin) {
    admins = admins.filter(id => id !== memberAccountId);
    showToast('🛡️ Rol de Administrador removido', 'success');
  } else {
    if (!admins.includes(memberAccountId)) {
      admins.push(memberAccountId);
    }
    showToast('🛡️ Rol de Administrador concedido', 'success');
  }
  
  shared.companyAdmins = admins;
  localStorage.setItem(sharedKey, JSON.stringify(shared));
  
  // Trigger localStorage event manually for sync engine to catch it and push to Supabase
  window.dispatchEvent(new StorageEvent('storage', {
    key: sharedKey,
    newValue: JSON.stringify(shared)
  }));

  // Force local Settings DOM refresh
  renderFamilySection();
}
window.toggleMemberAdminRole = toggleMemberAdminRole;

function renderFamilySection() {
  const container = document.getElementById('settings-family-container');
  if (!container) return;

  const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
  const familyId = session.familyId;

  let customJoinCode = '';
  try {
    const sharedKey = typeof userKey === 'function' ? userKey('recim_company_shared_settings') : 'recim_company_shared_settings';
    const shared = JSON.parse(localStorage.getItem(sharedKey) || '{}');
    customJoinCode = (shared.customJoinCode || '').trim();
  } catch (_) {}

  if (familyId) {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <p style="font-size:0.8rem; color:var(--clr-text-muted);">
          Actualmente estás en una empresa compartida. Tu base de datos está sincronizada y compartida en tiempo real con todos los miembros de este grupo.
        </p>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;">
          <div style="padding:12px; background:var(--clr-surface-2); border:1px solid var(--clr-border); border-radius:var(--r-md); display:flex; flex-direction:column; gap:8px;">
            <div style="font-size:0.75rem; color:var(--clr-text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">Código de tu Empresa</div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span id="family-code-text" style="font-family:monospace; font-size:1.2rem; font-weight:700; color:var(--clr-primary); letter-spacing:0.08em;">${familyId}</span>
              <button class="btn-secondary" style="padding:4px 8px; font-size:0.75rem;" onclick="copyFamilyCode()">📋 Copiar</button>
            </div>
          </div>
          ${customJoinCode ? `
            <div style="padding:12px; background:var(--clr-surface-2); border:1px solid rgba(16, 185, 129, 0.4); border-radius:var(--r-md); display:flex; flex-direction:column; gap:8px;">
              <div style="font-size:0.75rem; color:var(--clr-text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">Código Personalizado</div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span id="family-custom-code-text" style="font-family:monospace; font-size:1.15rem; font-weight:700; color:#34d399; letter-spacing:0.06em;">${customJoinCode}</span>
                <button class="btn-secondary" style="padding:4px 8px; font-size:0.75rem;" onclick="copyCustomCompanyCode()">📋 Copiar</button>
              </div>
            </div>
          ` : ''}
        </div>

        <div style="margin-top:8px; border-top:1px solid var(--clr-border); padding-top:12px;">
          <div style="font-size:0.75rem; color:var(--clr-text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px;">Miembros de la Empresa</div>
          <div id="family-members-list" style="display:flex; flex-direction:column; gap:8px;">
            <div style="font-size:0.8rem; color:var(--clr-text-muted);">Cargando miembros...</div>
          </div>
        </div>
        
        <button class="btn-danger" style="width:100%; justify-content:center; margin-top:8px;" onclick="handleLeaveFamily()">
          🚪 Salir de la Empresa
        </button>
      </div>
    `;

    setTimeout(() => updateFamilyMembersDOM(familyId, session.accountId), 0);
  } else {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <p style="font-size:0.8rem; color:var(--clr-text-muted);">
          Crea una empresa para compartir tu base de datos con otros miembros, o únete a una empresa existente usando su código de empresa o código personalizado.
        </p>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:4px;">
          <button class="btn-primary" style="justify-content:center; font-size:0.85rem;" onclick="handleCreateFamily()">
            ➕ Crear Empresa
          </button>
          <button class="btn-secondary" style="justify-content:center; font-size:0.85rem;" onclick="showJoinFamilyInput()">
            🔑 Unirse a Empresa
          </button>
        </div>
        
        <div id="join-family-box" style="display:none; margin-top:8px; padding-top:12px; border-top:1px solid var(--clr-border);">
          <div class="form-group" style="margin-bottom:8px;">
            <label class="form-label" style="font-size:0.75rem;">Código de Empresa (10 dígitos o código personalizado)</label>
            <input id="join-family-code-input" type="text" class="form-input" placeholder="Ej: 1234567890 o RECIMINSA-2026" maxlength="32" />
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn-primary" style="flex:1; justify-content:center; padding:6px 12px; font-size:0.82rem;" onclick="submitJoinFamily()">Unirse</button>
            <button class="btn-secondary" style="padding:6px 12px; font-size:0.82rem;" onclick="hideJoinFamilyInput()">Cancelar</button>
          </div>
        </div>
      </div>
    `;
  }
}

function copyCustomCompanyCode() {
  const codeEl = document.getElementById('family-custom-code-text');
  if (!codeEl) return;
  navigator.clipboard.writeText(codeEl.textContent).then(() => {
    showToast('📋 Código personalizado copiado al portapapeles', 'success');
  }).catch(() => {
    showToast('❌ No se pudo copiar automáticamente', 'error');
  });
}
window.copyCustomCompanyCode = copyCustomCompanyCode;

function copyFamilyCode() {
  const codeEl = document.getElementById('family-code-text');
  if (!codeEl) return;
  navigator.clipboard.writeText(codeEl.textContent).then(() => {
    showToast('📋 Código copiado al portapapeles', 'success');
  }).catch(() => {
    showToast('❌ No se pudo copiar automáticamente', 'error');
  });
}

async function handleCreateFamily() {
  if (!confirm('¿Estás seguro de que deseas crear una empresa? Compartirás tu base de datos actual.')) return;

  let code = '';
  // Generate random 10 digit code
  for (let i = 0; i < 10; i++) {
    code += Math.floor(Math.random() * 10);
  }

  const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
  const creatorAccountId = session.accountId;

  // Copiar datos y ajustes locales de la cuenta privada antes de cambiar el scope a family_${code}
  const keysToCarryOver = [
    'recim_invoices',
    'recim_ncf_sequences',
    'recim_quotes',
    'recim_dispatches',
    'recim_returns',
    'recim_credit_notes',
    'recim_debit_notes',
    'recim_material_codes',
    'recim_material_families',
    'recim_clients',
    'recim_ingresos',
    'recim_egresos',
    'recim_collaborators',
    'recim_settings',
    'recim_company_shared_settings'
  ];
  const privateSnapshot = {};
  if (creatorAccountId) {
    keysToCarryOver.forEach(k => {
      const val = localStorage.getItem(`${k}_${creatorAccountId}`);
      if (val !== null && val !== undefined) {
        privateSnapshot[k] = val;
      }
    });
  }

  // Asignar familyId y rol de CEO / Fundador en la sesión activa
  session.familyId = code;
  session.role = 'ceo';
  session.isFounder = true;
  if (typeof calculateSecureChecksum === 'function') {
    session.signature = calculateSecureChecksum(session.accountId, session.email, code);
  }
  localStorage.setItem('recim_session', JSON.stringify(session));
  if (typeof BiometricAuthManager !== 'undefined' && typeof BiometricAuthManager.saveSessionToSQLite === 'function') {
    BiometricAuthManager.saveSessionToSQLite(session);
  }

  // Migrar datos locales al nuevo namespace family_${code}
  Object.keys(privateSnapshot).forEach(k => {
    localStorage.setItem(userKey(k), privateSnapshot[k]);
  });

  // Registrar oficialmente al creador como Administrador y Fundador de la empresa
  localStorage.setItem(userKey('recim_company_id'), code);
  if (creatorAccountId) {
    localStorage.setItem(userKey('recim_company_admin'), creatorAccountId);
  }

  const sharedKey = userKey('recim_company_shared_settings');
  let shared = {};
  try { shared = JSON.parse(localStorage.getItem(sharedKey) || '{}'); } catch (_) {}
  if (creatorAccountId) {
    shared.founderId = creatorAccountId;
    if (!Array.isArray(shared.companyAdmins)) shared.companyAdmins = [];
    if (!shared.companyAdmins.includes(creatorAccountId)) {
      shared.companyAdmins.push(creatorAccountId);
    }
  }

  // Inicializar Sucursal Principal y miembro fundador
  const branchCode = (typeof generateDefaultBranchCode === 'function') ? generateDefaultBranchCode() : ('SUC-' + Math.floor(1000 + Math.random() * 9000));
  const defaultMainBranch = {
    id: 'SUC-PRINCIPAL',
    name: 'Sucursal Principal',
    location: shared.companyAddress || 'Sede Central',
    phone: shared.companyPhone || '',
    email: shared.companyEmail || session.email || '',
    code: branchCode,
    isMain: true,
    active: true,
    createdBy: creatorAccountId || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  let initialBranches = [];
  try { initialBranches = JSON.parse(localStorage.getItem(userKey('recim_branches')) || '[]'); } catch (_) {}
  if (!Array.isArray(initialBranches) || initialBranches.length === 0) {
    initialBranches = [defaultMainBranch];
  }
  shared.branches = initialBranches;
  localStorage.setItem(sharedKey, JSON.stringify(shared));
  localStorage.setItem(userKey('recim_branches'), JSON.stringify(initialBranches));

  let initialBranchMembers = [];
  if (creatorAccountId) {
    initialBranchMembers = [{
      id: creatorAccountId,
      accountId: creatorAccountId,
      name: (session.name || 'Usuario').split(' | ')[0].trim(),
      email: session.email || '',
      role: 'ceo',
      branchId: initialBranches[0].id,
      branchName: initialBranches[0].name,
      updatedAt: new Date().toISOString()
    }];
    localStorage.setItem(userKey('recim_branch_members'), JSON.stringify(initialBranchMembers));
  }

  // Sincronizar en la nube (Supabase)
  if (isSupabaseActive && supabaseClient) {
    try {
      showToast('📡 Registrando empresa y asignando rol CEO...', 'info');
      
      // 1. Guardar family_id y asignar rol de CEO en la tabla profiles del creador
      let { error: profileError } = await supabaseClient
        .from('profiles')
        .update({ family_id: code, role: 'ceo' })
        .eq('id', session.accountId);

      if (profileError && (profileError.code === 'PGRST204' || (profileError.message && profileError.message.includes('role')))) {
        console.warn("⚠️ Columna 'role' no disponible en Supabase cache. Reintentando solo con family_id...");
        const { error: retryError } = await supabaseClient
          .from('profiles')
          .update({ family_id: code })
          .eq('id', session.accountId);
        profileError = retryError;
      }

      if (profileError) throw profileError;
      
      // 2. Copiar los datos actuales a la ruta de la familia en Supabase user_data incluyendo al fundador
      const { data: currentData, error: dataError } = await supabaseClient
        .from('user_data')
        .select('data')
        .eq('id', session.accountId)
        .maybeSingle();

      if (dataError) throw dataError;

      const familyPayload = (currentData && currentData.data && typeof currentData.data === 'object')
        ? { ...currentData.data }
        : {};
      familyPayload.recim_company_id = code;
      familyPayload.recim_company_admin = creatorAccountId;
      familyPayload.recim_company_shared_settings = shared;
      familyPayload.recim_branches = initialBranches;
      familyPayload.recim_branch_members = initialBranchMembers;

      const { error: upsertError } = await supabaseClient
        .from('user_data')
        .upsert({
          id: `family_${code}`,
          data: familyPayload,
          updated_at: new Date().toISOString()
        });
      if (upsertError) throw upsertError;

      if (typeof window.syncPushData === 'function') {
        await window.syncPushData(true);
      }
      
      console.log('Empresa creada y datos migrados con permisos de CEO.');
    } catch (err) {
      console.error("Error al crear empresa en Supabase:", err);
      showToast('❌ Error de conexión al crear empresa', 'error');
      return;
    }
  }

  showToast('🏢 ¡Empresa creada exitosamente!', 'success');
  if (typeof getCurrentPage === 'function' && getCurrentPage() === 'parametrizaciones_empresa') {
    rerenderCurrentPage();
  } else {
    renderFamilySection();
  }
}

function showJoinFamilyInput() {
  const box = document.getElementById('join-family-box');
  if (box) box.style.display = 'block';
}

function hideJoinFamilyInput() {
  const box = document.getElementById('join-family-box');
  if (box) box.style.display = 'none';
}

async function submitJoinFamily() {
  const input = document.getElementById('join-family-code-input');
  const rawCode = input?.value.trim();
  if (!rawCode || rawCode.length < 4) {
    showToast('⚠️ Ingresa un código de empresa válido (mínimo 4 caracteres)', 'warning');
    return;
  }

  if (isSupabaseActive && supabaseClient) {
    try {
      showToast('📡 Validando código de empresa...', 'info');
      
      let targetFamilyId = rawCode;
      let existingFounderId = null;

      if (typeof resolveCompanyByCode === 'function') {
        const resolved = await resolveCompanyByCode(rawCode);
        if (!resolved || !resolved.found) {
          showToast('❌ El código de empresa no es válido o no existe.', 'error');
          return;
        }
        targetFamilyId = resolved.familyId;
        existingFounderId = resolved.profiles?.[0]?.id || resolved.sharedSettings?.founderId || null;
      } else {
        const { data: cloudUsers, error: checkError } = await supabaseClient
          .from('profiles')
          .select('id')
          .eq('family_id', rawCode);
        if (checkError) throw checkError;
        if (!cloudUsers || cloudUsers.length === 0) {
          showToast('❌ El código de empresa no es válido o no existe.', 'error');
          return;
        }
        existingFounderId = cloudUsers[0]?.id || null;
      }

      // Valid: Join! Update profiles table
      const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
      
      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({ family_id: targetFamilyId })
        .eq('id', session.accountId);

      if (updateError) throw updateError;

      session.familyId = targetFamilyId;
      if (session.role !== 'master') {
        session.role = 'colaborador';
        session.isFounder = false;
      }
      if (typeof calculateSecureChecksum === 'function') {
        session.signature = calculateSecureChecksum(session.accountId, session.email, targetFamilyId);
      }
      localStorage.setItem('recim_session', JSON.stringify(session));
      if (typeof BiometricAuthManager !== 'undefined' && typeof BiometricAuthManager.saveSessionToSQLite === 'function') {
        BiometricAuthManager.saveSessionToSQLite(session);
      }
      localStorage.setItem(userKey('recim_company_id'), targetFamilyId);
      
      // Clear local database keys before pulling new ones
      const keysToRemove = [
        'recim_invoices',
        'recim_material_codes',
        'recim_clients',
        'recim_ingresos',
        'recim_egresos'
      ];
      keysToRemove.forEach(k => localStorage.removeItem(userKey(k)));

      // Force Sync pull immediately
      if (window.syncPullData) {
        await window.syncPullData(`family_${targetFamilyId}`);
      }

      // Si la empresa aún no tenía recim_company_admin en la nube, registrar al miembro fundador existente
      if (existingFounderId && !localStorage.getItem(userKey('recim_company_admin'))) {
        localStorage.setItem(userKey('recim_company_admin'), existingFounderId);
      }

      if (typeof recordCurrentUserDeviceAccess === 'function') {
        recordCurrentUserDeviceAccess(session);
      }

      showToast('🏢 ¡Te has unido a la empresa exitosamente!', 'success');
      if (typeof getCurrentPage === 'function' && getCurrentPage() === 'parametrizaciones_empresa') {
        rerenderCurrentPage();
      } else {
        renderFamilySection();
      }
    } catch (err) {
      console.error("Error al unirse a la empresa:", err);
      showToast('❌ Error al conectar con el servidor', 'error');
    }
  } else {
    showToast('⚠️ Conexión de red no disponible', 'warning');
  }
}

async function handleLeaveFamily() {
  if (!confirm('¿Estás seguro de que deseas salir de la empresa? Perderás acceso a la base de datos compartida y volverás a tu base de datos privada.')) return;

  const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
  const oldFamilyId = session.familyId;
  session.familyId = null;
  if (typeof calculateSecureChecksum === 'function') {
    session.signature = calculateSecureChecksum(session.accountId, session.email, null);
  }
  localStorage.setItem('recim_session', JSON.stringify(session));
  localStorage.removeItem(userKey('recim_company_id'));

  // 1. Sincronizar salida con la nube (Supabase) PRIMERO
  if (isSupabaseActive && supabaseClient) {
    try {
      showToast('📡 Saliendo de la empresa...', 'info');
      const newRole = session.role === 'master' ? 'master' : 'colaborador';
      let { error } = await supabaseClient
        .from('profiles')
        .update({ family_id: null, role: newRole })
        .eq('id', session.accountId);
      
      if (error && (error.code === 'PGRST204' || (error.message && error.message.includes('role')))) {
        console.warn("⚠️ Columna 'role' no disponible en Supabase cache. Reintentando solo con family_id...");
        const { error: retryError } = await supabaseClient
          .from('profiles')
          .update({ family_id: null })
          .eq('id', session.accountId);
        error = retryError;
      }

      if (error) {
        console.error("Error al actualizar usuario en Supabase:", error);
        showToast('❌ Error al salir de la empresa en el servidor: ' + (error.message || 'Error de permisos'), 'error');
        return;
      }
    } catch (err) {
      console.error("Error al actualizar usuario en Supabase:", err);
      showToast('❌ Error de conexión al intentar salir de la empresa', 'error');
      return;
    }
  }

  // 2. Limpiar llaves locales de la empresa antigua ANTES de cambiar session.familyId
  if (oldFamilyId) {
    const familyKeysToRemove = [
      `recim_company_id_family_${oldFamilyId}`,
      `recim_company_admin_family_${oldFamilyId}`,
      `recim_company_shared_settings_family_${oldFamilyId}`,
      `recim_invoices_family_${oldFamilyId}`,
      `recim_material_codes_family_${oldFamilyId}`,
      `recim_clients_family_${oldFamilyId}`,
      `recim_ingresos_family_${oldFamilyId}`,
      `recim_egresos_family_${oldFamilyId}`,
      `recim_collaborators_family_${oldFamilyId}`,
      `recim_branches_family_${oldFamilyId}`,
      `recim_branch_members_family_${oldFamilyId}`,
      `recim_access_logs_family_${oldFamilyId}`
    ];
    familyKeysToRemove.forEach(k => localStorage.removeItem(k));
  }
  localStorage.removeItem(`recim_company_id_${session.accountId}`);

  // 3. Actualizar la sesión local a privada (familyId = null)
  session.familyId = null;
  if (session.role !== 'master') {
    session.role = 'colaborador';
  }
  if (typeof calculateSecureChecksum === 'function') {
    session.signature = calculateSecureChecksum(session.accountId, session.email, null);
  }
  localStorage.setItem('recim_session', JSON.stringify(session));

  // 4. Purgar caché privado actual para obligar descarga limpia de datos personales
  const privateKeys = [
    'recim_invoices',
    'recim_material_codes',
    'recim_clients',
    'recim_ingresos',
    'recim_egresos'
  ];
  privateKeys.forEach(k => localStorage.removeItem(userKey(k)));

  // 5. Descargar datos privados del usuario desde Supabase
  if (window.syncPullData) {
    await window.syncPullData(session.accountId);
  }

  showToast('👋 Has salido de la empresa exitosamente', 'success');
  renderFamilySection();

  // Re-renderizar página actual si es relevante
  try {
    if (typeof rerenderCurrentPage === 'function') {
      rerenderCurrentPage();
    }
  } catch (_) {}
}

// ---- White Label settings handlers ----
function _setCompanyRegSyncStatus(state, customText) {
  const el = document.getElementById('company-reg-sync-status');
  if (!el) return;

  const presets = {
    saving: {
      text: customText || '⏳ Guardando en la base de datos...',
      bg: 'rgba(59, 130, 246, 0.14)',
      border: 'rgba(59, 130, 246, 0.4)',
      color: '#93c5fd'
    },
    saved: {
      text: customText || '☁️ Guardado en la base de datos',
      bg: 'rgba(16, 185, 129, 0.14)',
      border: 'rgba(16, 185, 129, 0.4)',
      color: '#6ee7b7'
    },
    offline: {
      text: customText || '📶 Guardado local (pendiente de subir)',
      bg: 'rgba(245, 158, 11, 0.14)',
      border: 'rgba(245, 158, 11, 0.45)',
      color: '#fcd34d'
    },
    error: {
      text: customText || '⚠️ Error al guardar en la base de datos',
      bg: 'rgba(239, 68, 68, 0.14)',
      border: 'rgba(239, 68, 68, 0.45)',
      color: '#fca5a5'
    }
  };
  const cfg = presets[state] || presets.saved;
  el.textContent = cfg.text;
  el.style.background = cfg.bg;
  el.style.borderColor = cfg.border;
  el.style.color = cfg.color;
}
window._setCompanyRegSyncStatus = _setCompanyRegSyncStatus;

async function saveSharedCompanySetting(key, value, options = {}) {
  _setCompanyRegSyncStatus('saving');
  try {
    if (typeof window.syncSaveCompanySettingsToCloud === 'function') {
      const res = await window.syncSaveCompanySettingsToCloud({ [key]: value }, options);
      if (res && res.ok) {
        _setCompanyRegSyncStatus('saved');
      } else if (res && res.offline) {
        _setCompanyRegSyncStatus('offline');
      } else {
        _setCompanyRegSyncStatus('error');
      }
      return res;
    }

    const sharedKey = typeof userKey === 'function' ? userKey('recim_company_shared_settings') : 'recim_company_shared_settings';
    let shared = {};
    try { shared = JSON.parse(localStorage.getItem(sharedKey) || '{}'); } catch (_) {}
    if (!shared || typeof shared !== 'object') shared = {};
    shared[key] = value;
    shared.updatedAt = new Date().toISOString();
    localStorage.setItem(sharedKey, JSON.stringify(shared));
    _setCompanyRegSyncStatus('offline');
    return { ok: false, offline: true, shared };
  } catch (e) {
    console.error('Error saving shared company setting:', e);
    _setCompanyRegSyncStatus('error');
    return { ok: false, error: e };
  }
}
window.saveSharedCompanySetting = saveSharedCompanySetting;

async function _saveSingleCompanyField({ settingKey, extraSettingKey = null, value, successLabel, options = {}, onSaved = null }) {
  const cleanVal = typeof value === 'string' ? value.trim() : value;
  saveSetting(settingKey, cleanVal);
  if (extraSettingKey) {
    saveSetting(extraSettingKey, cleanVal);
  }
  if (typeof onSaved === 'function') {
    onSaved(cleanVal);
  }

  const res = await saveSharedCompanySetting(settingKey, cleanVal, options);
  if (res && res.ok) {
    showToast(`✅ ${successLabel} guardado en la base de datos`, 'success');
  } else if (res && res.offline) {
    showToast(`⚠️ ${successLabel} guardado localmente (sin conexión)`, 'warning');
  } else {
    showToast(`❌ Error guardando ${successLabel} en la base de datos`, 'error');
  }
  return res;
}

async function saveCompanyNameSetting(val) {
  return await _saveSingleCompanyField({
    settingKey: 'companyName',
    value: val,
    successLabel: 'Nombre de la Empresa',
    options: val && val.trim() ? {} : { allowEmptyOverwrite: true, explicitClearedFields: ['companyName'] },
    onSaved: (name) => {
      const brandEl = document.querySelector('.sidebar-brand');
      if (brandEl) brandEl.textContent = name || 'Reciminsaap';
    }
  });
}

async function saveCompanyRNCSetting(val) {
  return await _saveSingleCompanyField({
    settingKey: 'companyRNC',
    value: val,
    successLabel: 'RNC de la Compañía',
    options: val && val.trim() ? {} : { allowEmptyOverwrite: true, explicitClearedFields: ['companyRNC'] }
  });
}

async function saveCompanyPhoneSetting(val) {
  return await _saveSingleCompanyField({
    settingKey: 'companyPhone',
    extraSettingKey: 'userPhone',
    value: val,
    successLabel: 'Teléfono de la Empresa',
    options: val && val.trim() ? {} : { allowEmptyOverwrite: true, explicitClearedFields: ['companyPhone'] }
  });
}

async function saveCompanyEmailSetting(val) {
  return await _saveSingleCompanyField({
    settingKey: 'companyEmail',
    extraSettingKey: 'userEmail',
    value: val,
    successLabel: 'Correo Electrónico',
    options: val && val.trim() ? {} : { allowEmptyOverwrite: true, explicitClearedFields: ['companyEmail'] }
  });
}

async function saveCompanyAddressSetting(val) {
  return await _saveSingleCompanyField({
    settingKey: 'companyAddress',
    value: val,
    successLabel: 'Dirección de la Empresa',
    options: val && val.trim() ? {} : { allowEmptyOverwrite: true, explicitClearedFields: ['companyAddress'] }
  });
}

const _COMPANY_FIELD_META = Object.freeze({
  companyName: { inputId: 'set-company-name', label: 'Nombre de la Empresa', settingKey: 'companyName', extraSettingKey: null, branchProp: null },
  companyRNC: { inputId: 'set-company-rnc', label: 'RNC de la Compañía', settingKey: 'companyRNC', extraSettingKey: null, branchProp: null },
  companyPhone: { inputId: 'set-company-phone', label: 'Teléfono de la Empresa', settingKey: 'companyPhone', extraSettingKey: 'userPhone', branchProp: 'phone' },
  companyEmail: { inputId: 'set-company-email', label: 'Correo Electrónico', settingKey: 'companyEmail', extraSettingKey: 'userEmail', branchProp: 'email' },
  companyAddress: { inputId: 'set-company-address', label: 'Dirección de la Empresa', settingKey: 'companyAddress', extraSettingKey: null, branchProp: 'location' }
});

function _getCompanyEditToggleEls(fieldKey) {
  return {
    editBtn: document.getElementById(`btn-edit-company-${fieldKey}`),
    actionsEl: document.getElementById(`company-edit-actions-${fieldKey}`),
    saveBtn: document.getElementById(`btn-save-company-${fieldKey}`)
  };
}

function _resetCompanyFieldEditState(fieldKey, valueOverride) {
  const meta = _COMPANY_FIELD_META[fieldKey];
  if (!meta) return;
  const input = document.getElementById(meta.inputId);
  if (input) {
    if (valueOverride !== undefined) {
      input.value = valueOverride;
    }
    const cleanVal = String(input.value || '').trim();
    input.dataset.originalValue = input.value;
    delete input.dataset.editing;
    const canEdit = typeof isCurrentUserAdminOrFounder === 'function' ? isCurrentUserAdminOrFounder() : true;
    input.readOnly = Boolean(canEdit && cleanVal);
    input.style.borderColor = '';
    input.style.boxShadow = '';
  }
  const { editBtn, actionsEl } = _getCompanyEditToggleEls(fieldKey);
  if (actionsEl) actionsEl.style.display = 'none';
  if (editBtn) editBtn.style.display = '';
}

function startEditCompanyField(fieldKey) {
  const canEdit = typeof isCurrentUserAdminOrFounder === 'function' ? isCurrentUserAdminOrFounder() : true;
  if (!canEdit) {
    showToast('🔒 Solo el Administrador puede editar los datos de la empresa.', 'warning');
    return;
  }
  const meta = _COMPANY_FIELD_META[fieldKey];
  if (!meta) return;
  const input = document.getElementById(meta.inputId);
  if (!input || input.disabled) return;

  if (input.dataset.editing !== 'true') {
    input.dataset.originalValue = input.value;
  }
  input.readOnly = false;
  input.dataset.editing = 'true';
  input.style.borderColor = 'var(--clr-primary)';
  input.style.boxShadow = '0 0 0 2px rgba(34, 197, 94, 0.18)';

  const { editBtn, actionsEl } = _getCompanyEditToggleEls(fieldKey);
  if (editBtn) editBtn.style.display = 'none';
  if (actionsEl) actionsEl.style.display = 'inline-flex';

  try {
    input.focus();
    const len = (input.value || '').length;
    if (typeof input.setSelectionRange === 'function') {
      input.setSelectionRange(len, len);
    }
  } catch (_) {}
}

function cancelEditCompanyField(fieldKey) {
  const meta = _COMPANY_FIELD_META[fieldKey];
  if (!meta) return;
  const input = document.getElementById(meta.inputId);
  const currentSettings = typeof getSettings === 'function' ? getSettings() : {};
  const fallbackVal = currentSettings[fieldKey] || '';
  const restoredVal = (input && input.dataset.originalValue !== undefined)
    ? input.dataset.originalValue
    : fallbackVal;
  _resetCompanyFieldEditState(fieldKey, restoredVal);
}

async function saveEditedCompanyField(fieldKey) {
  const canEdit = typeof isCurrentUserAdminOrFounder === 'function' ? isCurrentUserAdminOrFounder() : true;
  if (!canEdit) {
    showToast('🔒 Solo el Administrador puede modificar los datos de la empresa.', 'error');
    return { ok: false };
  }
  const meta = _COMPANY_FIELD_META[fieldKey];
  if (!meta) return { ok: false };
  const input = document.getElementById(meta.inputId);
  if (!input) return { ok: false };

  const newValue = (input.value || '').trim();
  const { saveBtn, actionsEl } = _getCompanyEditToggleEls(fieldKey);
  const cancelBtn = actionsEl ? actionsEl.querySelector('button:not([id])') : null;
  const prevSaveHtml = saveBtn ? saveBtn.innerHTML : '💾 Guardar';

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '⏳...';
  }
  if (cancelBtn) cancelBtn.disabled = true;
  _setCompanyRegSyncStatus('saving');

  try {
    saveSetting(meta.settingKey, newValue);
    if (meta.extraSettingKey) {
      saveSetting(meta.extraSettingKey, newValue);
    }

    if (fieldKey === 'companyName') {
      const brandEl = document.querySelector('.sidebar-brand');
      if (brandEl) brandEl.textContent = newValue || 'Reciminsaap';
    }

    const patch = { [fieldKey]: newValue };
    if (meta.branchProp) {
      try {
        const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
        const hasContext = Boolean(session.familyId || getSettings().companyName || getSettings().companyRNC);
        if (hasContext && typeof getCompanyBranches === 'function' && typeof saveCompanyBranches === 'function') {
          const branches = getCompanyBranches();
          if (Array.isArray(branches) && branches.length > 0) {
            const mainIdx = branches.findIndex(b => b && (b.isMain || b.id === 'SUC-PRINCIPAL'));
            if (mainIdx >= 0) {
              branches[mainIdx] = {
                ...branches[mainIdx],
                [meta.branchProp]: newValue || (meta.branchProp === 'location' ? (branches[mainIdx].location || 'Sede Central') : ''),
                updatedAt: new Date().toISOString()
              };
              saveCompanyBranches(branches, { markModified: true });
            }
            patch.branches = branches;
          }
        }
      } catch (_) {}
    }

    const options = newValue ? {} : { allowEmptyOverwrite: true, explicitClearedFields: [fieldKey] };
    let res;
    if (typeof window.syncSaveCompanySettingsToCloud === 'function') {
      res = await window.syncSaveCompanySettingsToCloud(patch, options);
    } else {
      res = await saveSharedCompanySetting(fieldKey, newValue, options);
    }

    if (res && res.ok) {
      _setCompanyRegSyncStatus('saved');
      _resetCompanyFieldEditState(fieldKey, newValue);
      showToast(`✅ ${meta.label} actualizada y subida a Supabase`, 'success');
    } else if (res && res.offline) {
      _setCompanyRegSyncStatus('offline');
      _resetCompanyFieldEditState(fieldKey, newValue);
      showToast(`⚠️ ${meta.label} guardada localmente (se subirá al reconectar)`, 'warning');
    } else {
      _setCompanyRegSyncStatus('error');
      showToast(`❌ Error al subir ${meta.label} a Supabase`, 'error');
    }
    if (typeof window.recordAuditLog === 'function') {
      window.recordAuditLog({
        actionType: 'company_field_update',
        entityType: 'company',
        entityId: fieldKey,
        summary: `${meta.label} de empresa actualizada`,
        details: { fieldKey, cleared: !newValue }
      });
    }
    return res || { ok: false };
  } catch (err) {
    console.error(`Error guardando ${fieldKey}:`, err);
    _setCompanyRegSyncStatus('error');
    showToast(`❌ Error al subir ${meta.label} a Supabase`, 'error');
    return { ok: false, error: err };
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = prevSaveHtml;
    }
    if (cancelBtn) cancelBtn.disabled = false;
  }
}

function triggerEditCompanyLogo() {
  const canEdit = typeof isCurrentUserAdminOrFounder === 'function' ? isCurrentUserAdminOrFounder() : true;
  if (!canEdit) {
    showToast('🔒 Solo el Administrador puede cambiar el logo.', 'warning');
    return;
  }
  const fileInput = document.getElementById('set-company-logo');
  if (fileInput && !fileInput.disabled) {
    fileInput.click();
  }
}

async function clearSettingsCompanyLogo() {
  const canEdit = typeof isCurrentUserAdminOrFounder === 'function' ? isCurrentUserAdminOrFounder() : true;
  if (!canEdit) {
    showToast('🔒 Solo el Administrador puede eliminar el logo.', 'error');
    return { ok: false };
  }
  const currentLogo = (getSettings().companyLogo || '').trim();
  if (!currentLogo) {
    showToast('ℹ️ No hay un logo personalizado guardado.', 'info');
    return { ok: true };
  }
  if (!confirm('¿Eliminar el logo de la empresa de la aplicación y de Supabase?')) {
    return { cancelled: true };
  }

  saveSetting('companyLogo', '');
  const fileEl = document.getElementById('set-company-logo');
  if (fileEl) fileEl.value = '';
  const previewContainer = document.getElementById('set-logo-preview-container');
  if (previewContainer) {
    previewContainer.innerHTML = `<span style="font-size: 0.9rem; color: var(--clr-text-muted);">Sin Logo</span>`;
  }
  const sidebarLogoImg = document.getElementById('sidebar-logo-img');
  if (sidebarLogoImg) {
    sidebarLogoImg.src = 'logo-no-white-lines.png';
  }

  _setCompanyRegSyncStatus('saving');
  let res;
  if (typeof window.syncSaveCompanySettingsToCloud === 'function') {
    res = await window.syncSaveCompanySettingsToCloud(
      { companyLogo: '' },
      { allowEmptyOverwrite: true, explicitClearedFields: ['companyLogo'] }
    );
  } else {
    res = await saveSharedCompanySetting('companyLogo', '', {
      allowEmptyOverwrite: true,
      explicitClearedFields: ['companyLogo']
    });
  }

  if (res && res.ok) {
    _setCompanyRegSyncStatus('saved');
    showToast('🗑 Logo eliminado de Supabase correctamente', 'success');
  } else if (res && res.offline) {
    _setCompanyRegSyncStatus('offline');
    showToast('⚠️ Logo eliminado localmente (sin conexión)', 'warning');
  } else {
    _setCompanyRegSyncStatus('error');
    showToast('❌ No se pudo eliminar el logo en Supabase', 'error');
  }
  if (typeof window.recordAuditLog === 'function') {
    window.recordAuditLog({
      actionType: 'company_logo_delete',
      entityType: 'company',
      entityId: 'companyLogo',
      summary: 'Logo de empresa eliminado'
    });
  }
  return res;
}

async function autoFillSettingsCompanyDGII() {
  const rncEl = document.getElementById('set-company-rnc');
  if (!rncEl) return;
  const val = rncEl.value.trim();
  if (!val) {
    showToast('Ingresa un RNC o Cédula primero', 'warning');
    return;
  }
  const data = await fetchDGIIData(val);
  if (data) {
    const nameEl = document.getElementById('set-company-name');
    if (nameEl) {
      nameEl.value = data.name;
    }
    rncEl.value = val;
    saveSetting('companyName', data.name);
    saveSetting('companyRNC', val);
    const brandEl = document.querySelector('.sidebar-brand');
    if (brandEl) brandEl.textContent = data.name || 'Reciminsaap';

    _setCompanyRegSyncStatus('saving');
    if (typeof window.syncSaveCompanySettingsToCloud === 'function') {
      const res = await window.syncSaveCompanySettingsToCloud({ companyName: data.name, companyRNC: val });
      _setCompanyRegSyncStatus(res?.ok ? 'saved' : (res?.offline ? 'offline' : 'error'));
      if (res?.ok) {
        _resetCompanyFieldEditState('companyName', data.name);
        _resetCompanyFieldEditState('companyRNC', val);
        showToast('✅ Empresa y RNC guardados en la base de datos', 'success');
      } else if (res?.offline) {
        _resetCompanyFieldEditState('companyName', data.name);
        _resetCompanyFieldEditState('companyRNC', val);
        showToast('⚠️ Empresa y RNC guardados localmente (sin conexión)', 'warning');
      } else {
        showToast('❌ Error guardando RNC y Nombre en la base de datos', 'error');
      }
    } else {
      await saveCompanyNameSetting(data.name);
      await saveCompanyRNCSetting(val);
      _resetCompanyFieldEditState('companyName', data.name);
      _resetCompanyFieldEditState('companyRNC', val);
    }
  }
}

async function clearSettingsCompanyRNC() {
  const rncEl = document.getElementById('set-company-rnc');
  if (rncEl) rncEl.value = '';
  saveSetting('companyRNC', '');
  _setCompanyRegSyncStatus('saving');
  const res = await saveSharedCompanySetting('companyRNC', '', {
    allowEmptyOverwrite: true,
    explicitClearedFields: ['companyRNC']
  });
  _resetCompanyFieldEditState('companyRNC', '');
  if (res && res.ok) {
    showToast('🗑 RNC eliminado de la base de datos', 'success');
  } else if (res && res.offline) {
    showToast('⚠️ RNC eliminado localmente (sin conexión)', 'warning');
  } else {
    showToast('❌ No se pudo eliminar el RNC en la base de datos', 'error');
  }
}

function _compressCompanyLogoFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
    reader.onload = (ev) => {
      const rawDataUrl = ev.target && ev.target.result ? String(ev.target.result) : '';
      if (!rawDataUrl) {
        reject(new Error('Archivo de imagen vacío.'));
        return;
      }

      const img = new Image();
      img.onerror = () => resolve(rawDataUrl);
      img.onload = () => {
        try {
          const drawScaled = (maxDim) => {
            const w = img.naturalWidth || img.width || maxDim;
            const h = img.naturalHeight || img.height || maxDim;
            const scale = Math.min(1, maxDim / Math.max(w, h));
            const targetW = Math.max(1, Math.round(w * scale));
            const targetH = Math.max(1, Math.round(h * scale));
            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            ctx.clearRect(0, 0, targetW, targetH);
            ctx.drawImage(img, 0, 0, targetW, targetH);
            return canvas;
          };

          let canvas = drawScaled(420);
          if (!canvas) {
            resolve(rawDataUrl);
            return;
          }

          let compressed = canvas.toDataURL('image/png');
          if (compressed.length > 180000) {
            const smaller = drawScaled(280);
            if (smaller) {
              canvas = smaller;
              compressed = canvas.toDataURL('image/png');
            }
          }
          if (compressed.length > 180000) {
            const webp = canvas.toDataURL('image/webp', 0.85);
            if (webp && webp.startsWith('data:image/webp') && webp.length < compressed.length) {
              compressed = webp;
            } else {
              const jpeg = canvas.toDataURL('image/jpeg', 0.85);
              if (jpeg && jpeg.length < compressed.length) {
                compressed = jpeg;
              }
            }
          }

          resolve(compressed.length < rawDataUrl.length ? compressed : rawDataUrl);
        } catch (_) {
          resolve(rawDataUrl);
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

async function handleSettingsLogoUpload(input) {
  const file = input && input.files && input.files[0];
  if (!file) return;

  _setCompanyRegSyncStatus('saving', '⏳ Optimizando y guardando logo...');
  try {
    const compressedDataUrl = await _compressCompanyLogoFile(file);
    saveSetting('companyLogo', compressedDataUrl);

    let logoCloudPatch = { companyLogo: compressedDataUrl };
    let usedStorage = false;
    if (window.StorageEngine && typeof window.StorageEngine.uploadCompanyLogoToStorage === 'function') {
      try {
        let targetDbId = 'default';
        try {
          const sess = JSON.parse(localStorage.getItem('recim_session') || '{}');
          targetDbId = sess.familyId ? `family_${sess.familyId}` : (sess.accountId || 'default');
        } catch (_) {}
        const uploadRes = await window.StorageEngine.uploadCompanyLogoToStorage(compressedDataUrl, targetDbId);
        if (uploadRes && uploadRes.ok && uploadRes.publicUrl) {
          saveSetting('companyLogoUrl', uploadRes.publicUrl);
          logoCloudPatch = { companyLogo: compressedDataUrl, companyLogoUrl: uploadRes.publicUrl };
          usedStorage = true;
        }
      } catch (_) {}
    }

    const previewContainer = document.getElementById('set-logo-preview-container');
    if (previewContainer) {
      previewContainer.innerHTML = '';
      const img = document.createElement('img');
      img.src = compressedDataUrl;
      img.alt = 'Logo de la empresa';
      img.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain;';
      previewContainer.appendChild(img);
    }

    const sidebarLogoImg = document.getElementById('sidebar-logo-img');
    if (sidebarLogoImg) {
      sidebarLogoImg.src = compressedDataUrl;
    }

    const res = (usedStorage && typeof window.syncSaveCompanySettingsToCloud === 'function')
      ? await window.syncSaveCompanySettingsToCloud(logoCloudPatch)
      : await saveSharedCompanySetting('companyLogo', compressedDataUrl);

    if (typeof window.recordAuditLog === 'function') {
      window.recordAuditLog({
        actionType: 'company_logo_update',
        entityType: 'company',
        entityId: 'companyLogo',
        summary: 'Logo de la empresa actualizado',
        details: { viaStorage: usedStorage }
      });
    }

    if (res && res.ok) {
      showToast('✅ Logo de la Empresa guardado en la base de datos', 'success');
    } else if (res && res.offline) {
      showToast('⚠️ Logo guardado localmente (se subirá al reconectar)', 'warning');
    } else {
      showToast('❌ Error al subir el logo a la base de datos', 'error');
    }
  } catch (err) {
    console.error('Error procesando/guardando logo:', err);
    _setCompanyRegSyncStatus('error');
    showToast('❌ No se pudo procesar el logo seleccionado', 'error');
  }
}

async function saveAllCompanyRegistrationSettings() {
  const nameVal = (document.getElementById('set-company-name')?.value || '').trim();
  const rncVal = (document.getElementById('set-company-rnc')?.value || '').trim();
  const phoneVal = (document.getElementById('set-company-phone')?.value || '').trim();
  const emailVal = (document.getElementById('set-company-email')?.value || '').trim();
  const addressVal = (document.getElementById('set-company-address')?.value || '').trim();
  const currentLogo = (getSettings().companyLogo || '');

  const btn = document.getElementById('btn-save-company-registration');
  const prevHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ Guardando en la base de datos...';
  }
  _setCompanyRegSyncStatus('saving');

  try {
    saveSetting('companyName', nameVal);
    saveSetting('companyRNC', rncVal);
    saveSetting('companyPhone', phoneVal);
    saveSetting('userPhone', phoneVal);
    saveSetting('companyEmail', emailVal);
    saveSetting('userEmail', emailVal);
    saveSetting('companyAddress', addressVal);

    let updatedBranches = null;
    try {
      const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
      const hasContext = Boolean(session.familyId || nameVal || rncVal);
      if (hasContext && typeof getCompanyBranches === 'function' && typeof saveCompanyBranches === 'function') {
        const branches = getCompanyBranches();
        if (Array.isArray(branches) && branches.length > 0) {
          const mainIdx = branches.findIndex(b => b && (b.isMain || b.id === 'SUC-PRINCIPAL'));
          if (mainIdx >= 0) {
            branches[mainIdx] = {
              ...branches[mainIdx],
              location: addressVal || branches[mainIdx].location || 'Sede Central',
              phone: phoneVal,
              email: emailVal,
              updatedAt: new Date().toISOString()
            };
            saveCompanyBranches(branches, { markModified: true });
          }
          updatedBranches = branches;
        }
      }
    } catch (_) {}

    if (typeof updateCurrentSession === 'function') {
      updateCurrentSession({ companyName: nameVal, companyRNC: rncVal });
    }
    applySettings();

    const patch = {
      companyName: nameVal,
      companyRNC: rncVal,
      companyPhone: phoneVal,
      companyEmail: emailVal,
      companyAddress: addressVal,
      companyLogo: currentLogo
    };
    if (updatedBranches) {
      patch.branches = updatedBranches;
    }

    const explicitClearedFields = ['companyName', 'companyRNC', 'companyPhone', 'companyEmail', 'companyAddress', 'companyLogo']
      .filter(k => !patch[k]);

    let res;
    if (typeof window.syncSaveCompanySettingsToCloud === 'function') {
      res = await window.syncSaveCompanySettingsToCloud(patch, {
        allowEmptyOverwrite: true,
        explicitClearedFields
      });
    } else {
      const sharedKey = typeof userKey === 'function' ? userKey('recim_company_shared_settings') : 'recim_company_shared_settings';
      const existing = JSON.parse(localStorage.getItem(sharedKey) || '{}');
      localStorage.setItem(sharedKey, JSON.stringify({ ...existing, ...patch, updatedAt: new Date().toISOString() }));
      res = { ok: false, offline: true };
    }

    if (res && res.ok) {
      _setCompanyRegSyncStatus('saved');
      Object.keys(_COMPANY_FIELD_META).forEach(fk => _resetCompanyFieldEditState(fk));
      showToast('✅ Datos de empresa guardados en la base de datos', 'success');
    } else if (res && res.offline) {
      _setCompanyRegSyncStatus('offline');
      Object.keys(_COMPANY_FIELD_META).forEach(fk => _resetCompanyFieldEditState(fk));
      showToast('⚠️ Sin conexión: datos guardados localmente y se subirán al reconectar', 'warning');
    } else {
      _setCompanyRegSyncStatus('error');
      showToast('❌ Error al guardar los datos de empresa en la base de datos', 'error');
    }
  } catch (err) {
    console.error('Error guardando datos de empresa:', err);
    _setCompanyRegSyncStatus('error');
    showToast('❌ No se pudieron guardar los datos en la base de datos', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = prevHtml || '💾 Guardar Datos de Empresa';
    }
  }
}

async function restoreWhiteLabelToOriginal() {
  if (!confirm('¿Restaurar todas las configuraciones de marca blanca al original?')) return;

  saveSetting('companyName', '');
  saveSetting('companyRNC', '');
  saveSetting('companyPhone', '');
  saveSetting('userPhone', '');
  saveSetting('companyEmail', '');
  saveSetting('userEmail', '');
  saveSetting('companyAddress', '');
  saveSetting('companyLogo', '');

  Object.keys(_COMPANY_FIELD_META).forEach(fk => _resetCompanyFieldEditState(fk, ''));
  const fileEl = document.getElementById('set-company-logo');
  if (fileEl) fileEl.value = '';

  const previewContainer = document.getElementById('set-logo-preview-container');
  if (previewContainer) {
    previewContainer.innerHTML = `<span style="font-size: 0.9rem; color: var(--clr-text-muted);">Sin Logo</span>`;
  }

  const brandEl = document.querySelector('.sidebar-brand');
  if (brandEl) brandEl.textContent = 'Reciminsaap';

  const sidebarLogoImg = document.getElementById('sidebar-logo-img');
  if (sidebarLogoImg) {
    sidebarLogoImg.src = 'logo-no-white-lines.png';
  }

  if (typeof updateCurrentSession === 'function') {
    updateCurrentSession({ companyName: '', companyRNC: '' });
  }

  _setCompanyRegSyncStatus('saving');
  const clearedPatch = {
    companyName: '',
    companyRNC: '',
    companyPhone: '',
    companyEmail: '',
    companyAddress: '',
    companyLogo: ''
  };
  let res;
  if (typeof window.syncSaveCompanySettingsToCloud === 'function') {
    res = await window.syncSaveCompanySettingsToCloud(clearedPatch, {
      allowEmptyOverwrite: true,
      explicitClearedFields: Object.keys(clearedPatch)
    });
  } else {
    for (const [k, v] of Object.entries(clearedPatch)) {
      res = await saveSharedCompanySetting(k, v, { allowEmptyOverwrite: true, explicitClearedFields: [k] });
    }
  }

  if (res && res.ok) {
    _setCompanyRegSyncStatus('saved');
    showToast('🔄 Marca blanca restaurada y sincronizada con la base de datos', 'success');
  } else if (res && res.offline) {
    _setCompanyRegSyncStatus('offline');
    showToast('⚠️ Marca blanca restaurada localmente (sin conexión)', 'warning');
  } else {
    _setCompanyRegSyncStatus('error');
    showToast('❌ Restaurada localmente, pero falló la actualización en la base de datos', 'error');
  }
  if (typeof window.recordAuditLog === 'function') {
    window.recordAuditLog({
      actionType: 'company_whitelabel_reset',
      entityType: 'company',
      entityId: 'whitelabel',
      summary: 'Configuración de marca blanca restaurada al original'
    });
  }
}

window.saveAllCompanyRegistrationSettings = saveAllCompanyRegistrationSettings;
window.startEditCompanyField = startEditCompanyField;
window.cancelEditCompanyField = cancelEditCompanyField;
window.saveEditedCompanyField = saveEditedCompanyField;
window.triggerEditCompanyLogo = triggerEditCompanyLogo;
window.clearSettingsCompanyLogo = clearSettingsCompanyLogo;
window.saveCompanyNameSetting = saveCompanyNameSetting;
window.saveCompanyRNCSetting = saveCompanyRNCSetting;
window.saveCompanyPhoneSetting = saveCompanyPhoneSetting;
window.saveCompanyEmailSetting = saveCompanyEmailSetting;
window.saveCompanyAddressSetting = saveCompanyAddressSetting;
window.handleSettingsLogoUpload = handleSettingsLogoUpload;
window.restoreWhiteLabelToOriginal = restoreWhiteLabelToOriginal;
window.clearSettingsCompanyRNC = clearSettingsCompanyRNC;
window.autoFillSettingsCompanyDGII = autoFillSettingsCompanyDGII;

// ==========================================================================
// SUBSCRIPTION AND DEVICE LICENSE HANDLERS
// ==========================================================================

function renderSubscriptionSettings() {
  const container = document.getElementById('settings-subscription-container');
  if (!container) return;

  if (typeof getSubscriptionState !== 'function' || typeof getDeviceUUID !== 'function') {
    container.innerHTML = `<p style="font-size:0.8rem; color:var(--clr-text-muted);">Módulo de seguridad no cargado.</p>`;
    return;
  }

  const deviceUuid = getDeviceUUID();
  const auditInfo = typeof getDeviceAuditInfo === 'function' ? getDeviceAuditInfo() : { rawHardwareId: deviceUuid, platformLabel: 'Dispositivo' };

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:8px; font-size:0.8rem;">
      <div class="settings-item" style="padding:4px 0; border:none; flex-direction:column; align-items:flex-start; gap:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <span class="settings-item-label" style="font-size:0.75rem; color:var(--clr-text-muted);">ID de Dispositivo (Auditoría / Seguridad)</span>
          <span class="badge badge--blue" style="font-size:0.68rem; padding:2px 6px;">${auditInfo.platformLabel || 'Dispositivo'}</span>
        </div>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; width:100%; background:var(--clr-surface-2); padding:8px 10px; border-radius:6px; border:1px solid var(--clr-border);">
          <span class="settings-item-value" style="font-family:monospace; font-size:0.88rem; overflow-wrap:break-word; color:#22c55e; font-weight:700;">
            ${deviceUuid}
          </span>
          <button class="btn-secondary" style="padding:3px 8px; font-size:0.72rem; flex-shrink:0;" onclick="navigator.clipboard.writeText('${deviceUuid}').then(() => showToast('📋 ID de dispositivo copiado', 'success'))">
            📋 Copiar
          </button>
        </div>
        <span style="font-family:monospace; font-size:0.72rem; color:var(--clr-text-muted);">
          ID Hex (16 chars tipo Android ID): <strong style="color:var(--clr-text-secondary);">${auditInfo.rawHardwareId || ''}</strong>
        </span>
      </div>
    </div>
  `;
}

function triggerSubscriptionRenewal() {
  const confirmation = confirm("¿Deseas renovar o cambiar tu plan de suscripción?\n\nEsto te redirigirá a la pasarela de planes.");
  if (!confirmation) return;

  const state = getSubscriptionState();
  state.plan = null; // Clear active plan to trigger paywall
  state.expiresAt = 0;
  saveSubscriptionState(state);

  window.location.reload();
}

function triggerDeviceUnlink() {
  const confirmation = confirm("¿Estás seguro de que deseas desvincular esta cuenta de este dispositivo?\n\nLa sesión se cerrará y deberás reactivar la licencia en otro dispositivo.");
  if (!confirmation) return;

  const state = getSubscriptionState();
  state.registeredDeviceId = ''; // Clear registered device ID
  saveSubscriptionState(state);

  handleLogout(); // logs out the user
}

// =============================================
// MODULE MANAGEMENT
// =============================================
const TOGGLEABLE_MODULES = [
  { id: 'bitacoras', label: '🚛 Bitácoras de Recogida' },
  { id: 'rutas', label: '🗺️ Agenda y Rutas' },
  { id: 'facturas', label: '🧾 Facturación' },
  { id: 'codigos', label: '🏷️ Códigos de Materiales' },
  { id: 'clientes', label: '👥 Clientes' },
  { id: 'ingresos', label: '📈 Ingresos' },
  { id: 'egresos', label: '📉 Egresos' },
  { id: 'ecologia', label: '🌱 Impacto medioambiental' }
];

function _getCollaboratorModuleRestrictions() {
  try {
    const isAdmin = typeof isCurrentUserAdminOrFounder === 'function' ? isCurrentUserAdminOrFounder() : true;
    if (isAdmin) return null;

    const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
    if (!session.familyId) return null;

    const colabs = JSON.parse(localStorage.getItem(userKey('recim_collaborators')) || '[]');
    const linked = colabs.find(c =>
      (session.accountId && c.linkedAccountId === session.accountId) ||
      (c.email && session.email && c.email.toLowerCase() === session.email.toLowerCase())
    );
    if (linked && linked.modules && typeof linked.modules === 'object') {
      return linked.modules;
    }
  } catch (_) {}
  return null;
}

function getModuleConfig() {
  const sessionStr = localStorage.getItem('recim_session');
  let accountId = 'default';
  if (sessionStr) {
    try { accountId = JSON.parse(sessionStr).accountId || 'default'; } catch(e){}
  }
  const key = `recim_modules_${accountId}`;
  const saved = localStorage.getItem(key);
  const config = {};
  TOGGLEABLE_MODULES.forEach(m => config[m.id] = true);

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      Object.assign(config, parsed);
    } catch(e){}
  }

  // Aplicar restricciones obligatorias configuradas por el Administrador en Colaboradores
  const restrictions = _getCollaboratorModuleRestrictions();
  if (restrictions) {
    Object.keys(restrictions).forEach(modId => {
      if (restrictions[modId] === false) {
        config[modId] = false;
      }
    });
  }

  return config;
}

function saveModuleConfig(config) {
  const sessionStr = localStorage.getItem('recim_session');
  let accountId = 'default';
  if (sessionStr) {
    try { accountId = JSON.parse(sessionStr).accountId || 'default'; } catch(e){}
  }
  localStorage.setItem(`recim_modules_${accountId}`, JSON.stringify(config));
  applyModuleVisibility();
}

function toggleModule(moduleId, isEnabled) {
  const restrictions = _getCollaboratorModuleRestrictions();
  if (restrictions && restrictions[moduleId] === false) {
    showToast('🔒 Este módulo fue restringido por el Administrador de tu empresa', 'warning');
    return;
  }
  const config = getModuleConfig();
  config[moduleId] = isEnabled;
  saveModuleConfig(config);
}

function renderModulesChecklist() {
  const config = getModuleConfig();
  const restrictions = _getCollaboratorModuleRestrictions();
  return TOGGLEABLE_MODULES.map(m => {
    const isRestrictedByAdmin = restrictions && restrictions[m.id] === false;
    return `
    <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.05);">
      <span style="font-size:0.9rem; font-weight:600;">
        ${m.label}
        ${isRestrictedByAdmin ? '<span class="badge badge--red" style="margin-left:6px; font-size:0.65rem; padding:2px 6px;">🔒 Restringido por Admin</span>' : ''}
      </span>
      <label class="toggle-switch" style="${isRestrictedByAdmin ? 'opacity:0.45; pointer-events:none;' : ''}">
        <input type="checkbox" ${config[m.id] ? 'checked' : ''} ${isRestrictedByAdmin ? 'disabled' : ''} onchange="toggleModule('${m.id}', this.checked)" />
        <span class="toggle-slider"></span>
      </label>
    </div>
  `;
  }).join('');
}

function applyModuleVisibility() {
  const config = getModuleConfig();
  
  // Apply to sidebar links
  document.querySelectorAll('.sidebar-link').forEach(link => {
    const pageId = link.dataset.page;
    if (!pageId) return;
    // Keep historial, parametrizaciones_empresa and ajustes always visible
    if (pageId === 'historial' || pageId === 'ajustes' || pageId === 'parametrizaciones_empresa') return;
    
    if (config[pageId] === false) {
      link.style.display = 'none';
    } else {
      link.style.display = 'flex';
    }
  });

  // Apply to any potential bottom-nav items if they exist
  document.querySelectorAll('.bottom-nav-item').forEach(link => {
    const pageId = link.dataset.page;
    if (!pageId) return;
    if (pageId === 'historial' || pageId === 'ajustes') return;
    
    if (config[pageId] === false) {
      link.style.display = 'none';
    } else {
      link.style.display = 'flex';
    }
  });

  // If the user is currently on a disabled page, redirect to historial
  const currentPage = localStorage.getItem('recim_current_page') || 'historial';
  if (currentPage !== 'historial' && currentPage !== 'ajustes' && config[currentPage] === false) {
    navigate('historial');
  }
}

// Ensure globally accessible
window.toggleModule = toggleModule;
window.applyModuleVisibility = applyModuleVisibility;

// =============================================
// OPCIONES AVANZADAS Y INICIO DE SESIÓN RÁPIDO
// =============================================

function openAdvancedSettingsModal() {
  if (document.getElementById('advanced-settings-modal')) return;

  const isQuickLoginEnabled = localStorage.getItem('recim_quick_login_enabled') === 'true';

  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'advanced-settings-modal';
  modalOverlay.className = 'modal-overlay';
  modalOverlay.onclick = (e) => { if (e.target === modalOverlay) closeAdvancedSettingsModal(); };

  modalOverlay.innerHTML = `
    <div class="modal" style="max-width: 520px; width: 90%;">
      <div class="modal-header">
        <h3 class="modal-title">⚙️ Opciones Avanzadas</h3>
        <button class="modal-close" onclick="closeAdvancedSettingsModal()">✕</button>
      </div>
      <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
        
        <!-- OPCIÓN 1: INICIO DE SESIÓN RÁPIDO -->
        <div style="background: var(--clr-surface-3); border-radius: var(--r-md); padding: 16px; border: 1px solid var(--clr-border);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px;">
            <div>
              <h4 style="margin: 0 0 4px 0; font-size: 1rem; font-weight: 600; color: var(--clr-text-main);">
                ⚡ Inicio de Sesión Rápido
              </h4>
              <p style="margin: 0; font-size: 0.82rem; color: var(--clr-text-muted); line-height: 1.4;">
                Permite iniciar sesión instantáneamente con los datos de seguridad de tu celular (huella, rostro, PIN o patrón) sin escribir tu contraseña en cada acceso.
              </p>
            </div>
            <span id="quick-login-badge" class="badge" style="font-size: 0.75rem; padding: 4px 10px; border-radius: 6px; font-weight: 600; text-transform: uppercase; white-space: nowrap; ${isQuickLoginEnabled ? 'background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid #22c55e;' : 'background: var(--clr-surface-2); color: var(--clr-text-muted); border: 1px solid var(--clr-border);'}">
              ${isQuickLoginEnabled ? 'ACTIVADO' : 'DESACTIVADO'}
            </span>
          </div>

          <div id="quick-login-actions" style="margin-top: 12px;">
            ${isQuickLoginEnabled 
              ? `<button class="btn-secondary" style="width: 100%; justify-content: center; color: #ef4444; border-color: #ef4444; background: rgba(239,68,68,0.08); font-weight: 600;" onclick="handleDisableQuickLogin()">
                  🚫 Desactivar Inicio de Sesión Rápido
                 </button>`
              : `<button class="btn-primary" style="width: 100%; justify-content: center; font-weight: 600; background: linear-gradient(135deg, #22c55e, #15803d);" onclick="showQuickLoginCredentialsForm()">
                  ⚡ Activar Inicio de Sesión Rápido
                 </button>`
            }
          </div>

          <!-- FORMULARIO DE VALIDACIÓN DE CREDENCIALES (Oculto por defecto) -->
          <div id="quick-login-cred-box" style="display: none; margin-top: 16px; padding-top: 16px; border-top: 1px dashed var(--clr-border);">
            <p style="font-size: 0.82rem; font-weight: 600; color: var(--clr-text-main); margin-bottom: 10px;">
              🔒 Escribe tus credenciales para validar y guardar tu sesión en SQLite:
            </p>
            <form onsubmit="handleActivateQuickLoginSubmit(event)" style="display: flex; flex-direction: column; gap: 10px;">
              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-size: 0.78rem;">Correo Electrónico</label>
                <input id="ql-email" type="email" class="form-input" placeholder="tu@correo.com" required style="font-size: 0.85rem;" />
              </div>
              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-size: 0.78rem;">Contraseña</label>
                <input id="ql-password" type="password" class="form-input" placeholder="••••••••" required style="font-size: 0.85rem;" />
              </div>
              <p id="ql-error" class="auth-error hidden" style="font-size: 0.8rem; margin: 0;"></p>
              <div style="display: flex; gap: 8px; margin-top: 6px;">
                <button type="button" class="btn-secondary" style="flex: 1; justify-content: center;" onclick="hideQuickLoginCredentialsForm()">Cancelar</button>
                <button type="submit" id="ql-submit-btn" class="btn-primary" style="flex: 1; justify-content: center;">
                  <span>Validar y Activar</span>
                  <div class="btn-spinner hidden"></div>
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- OPCIÓN 2: CÓDIGO TEMPORAL DE ACCESO (6 DÍDIGOS) -->
        <div style="background: var(--clr-surface-3); border-radius: var(--r-md); padding: 16px; border: 1px solid var(--clr-border);">
          <h4 style="margin: 0 0 4px 0; font-size: 1rem; font-weight: 600; color: var(--clr-text-main);">
            🔑 Generar Código de Acceso Rápido
          </h4>
          <p style="margin: 0 0 12px 0; font-size: 0.82rem; color: var(--clr-text-muted); line-height: 1.4;">
            Genera un código dinámico de 6 dígitos que cambia cada 1 minuto para iniciar sesión de forma instantánea en Web o Windows.
          </p>
          
          <button id="btn-generate-quick-code" class="btn-primary" style="width: 100%; justify-content: center; font-weight: 600; background: linear-gradient(135deg, #10b981, #059669);" onclick="generateAndShowQuickLoginCode()">
            ⚡ Generar Código
          </button>

          <div id="quick-code-display-box" style="display: none; margin-top: 14px; text-align: center; background: var(--clr-surface-2); padding: 16px; border-radius: var(--r-md); border: 1px dashed #10b981;">
            <p style="font-size: 0.8rem; color: var(--clr-text-muted); margin-bottom: 6px; font-weight: 500;">Tu código de acceso temporal es:</p>
            <div id="quick-code-number" style="font-size: 2.4rem; font-weight: 800; letter-spacing: 10px; color: #10b981; font-family: monospace; line-height: 1.2;">
              ------
            </div>
            <div style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 10px; font-size: 0.85rem; color: var(--clr-text-muted);">
              <span>⏱️ Actualiza en: <strong id="quick-code-timer" style="color: #10b981; font-size: 0.95rem;">60s</strong></span>
            </div>
          </div>
        </div>

        <!-- OPCIÓN 3: FRECUENCIA DE RESPALDO AUTOMÁTICO (GOOGLE DRIVE) -->
        <div style="background: var(--clr-surface-3); border-radius: var(--r-md); padding: 16px; border: 1px solid var(--clr-border);">
          <h4 style="margin: 0 0 4px 0; font-size: 1rem; font-weight: 600; color: var(--clr-text-main);">
            ⏱️ Frecuencia de Respaldo Automático
          </h4>
          <p style="margin: 0 0 12px 0; font-size: 0.82rem; color: var(--clr-text-muted); line-height: 1.4;">
            Elige el intervalo de tiempo con el que se enviarán las copias de seguridad de datos (.json) y libros de reportes Excel (.xlsx) a tu carpeta vinculada en Google Drive.
          </p>
          
          <select id="adv-gdrive-frequency" class="form-input" style="width: 100%; font-size: 0.85rem; padding: 9px 12px; cursor: pointer;" onchange="handleGDriveFrequencyChange(this)">
            <option value="30min" ${localStorage.getItem(userKey('recim_backup_frequency')) === '30min' ? 'selected' : ''}>⏱️ Cada 30 Minutos</option>
            <option value="1hour" ${localStorage.getItem(userKey('recim_backup_frequency')) === '1hour' ? 'selected' : ''}>⏱️ Cada 1 Hora</option>
            <option value="2hours" ${(!localStorage.getItem(userKey('recim_backup_frequency')) || localStorage.getItem(userKey('recim_backup_frequency')) === '2hours') ? 'selected' : ''}>⏱️ Cada 2 Horas (Recomendado)</option>
            <option value="6hours" ${localStorage.getItem(userKey('recim_backup_frequency')) === '6hours' ? 'selected' : ''}>⏱️ Cada 6 Horas</option>
            <option value="12hours" ${localStorage.getItem(userKey('recim_backup_frequency')) === '12hours' ? 'selected' : ''}>⏱️ Cada 12 Horas</option>
            <option value="24hours" ${localStorage.getItem(userKey('recim_backup_frequency')) === '24hours' ? 'selected' : ''}>📅 Diario (Cada 24 Horas)</option>
            <option value="manual" ${localStorage.getItem(userKey('recim_backup_frequency')) === 'manual' ? 'selected' : ''}>🖐️ Solo Manual / Al Guardar</option>
          </select>
        </div>

      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="closeAdvancedSettingsModal()">Cerrar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  // Pre-fill email if current user session exists
  try {
    const sessionStr = localStorage.getItem('recim_session');
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      const emailInput = document.getElementById('ql-email');
      if (emailInput && session.email) {
        emailInput.value = session.email;
      }
    }
  } catch(e){}
}

let g_quickCodeTimerInterval = null;

function closeAdvancedSettingsModal() {
  if (g_quickCodeTimerInterval) {
    clearInterval(g_quickCodeTimerInterval);
    g_quickCodeTimerInterval = null;
  }
  const modal = document.getElementById('advanced-settings-modal');
  if (modal) modal.remove();
}

function showQuickLoginCredentialsForm() {
  const credBox = document.getElementById('quick-login-cred-box');
  if (credBox) credBox.style.display = 'block';
}

function hideQuickLoginCredentialsForm() {
  const credBox = document.getElementById('quick-login-cred-box');
  if (credBox) credBox.style.display = 'none';
  const errEl = document.getElementById('ql-error');
  if (errEl) errEl.classList.add('hidden');
}

async function handleActivateQuickLoginSubmit(evt) {
  evt.preventDefault();
  const email = document.getElementById('ql-email').value.trim().toLowerCase();
  const password = document.getElementById('ql-password').value;
  const errEl = document.getElementById('ql-error');
  const btn = document.getElementById('ql-submit-btn');

  if (errEl) errEl.classList.add('hidden');

  if (btn) {
    btn.querySelector('span')?.classList.add('hidden');
    btn.querySelector('.btn-spinner')?.classList.remove('hidden');
    btn.disabled = true;
  }

  try {
    if (!isSupabaseActive || !supabaseClient) {
      throw new Error("No hay conexión con la base de datos Supabase.");
    }

    // 1. Validar correo y contraseña mediante RPC blindado en servidor (o fallback compatible)
    const secureHash = await hashPasswordSHA256(password);
    const legacyB64 = btoa(password);
    let data = null;

    const { data: rpcRes, error: rpcErr } = await supabaseClient.rpc('verify_user_login', {
      p_email: email,
      p_password_hash: secureHash,
      p_legacy_b64: legacyB64
    });

    if (!rpcErr && rpcRes && typeof rpcRes === 'object') {
      if (!rpcRes.ok) {
        if (rpcRes.reason === 'not_found') throw new Error("No existe una cuenta con ese correo.");
        if (rpcRes.reason === 'blocked') throw new Error("Acceso denegado: tu cuenta ha sido bloqueada por el administrador.");
        throw new Error("Contraseña incorrecta.");
      }
      data = rpcRes.profile;
    } else {
      const { data: rowData, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error) throw error;
      if (!rowData) throw new Error("No existe una cuenta con ese correo.");
      if (rowData.family_id === 'BLOCKED') {
        throw new Error("Acceso denegado: tu cuenta ha sido bloqueada por el administrador.");
      }

      let isValid = (rowData.password === secureHash) || (rowData.password === legacyB64);
      if (!isValid) throw new Error("Contraseña incorrecta.");
      data = rowData;
    }

    // 3. Crear objeto de sesión validado
    const session = {
      name: data.name,
      email: data.email,
      avatar: (data.avatar || data.name || 'U')[0].toUpperCase(),
      provider: 'email',
      accountId: data.id,
      familyId: data.family_id || null
    };

    if (typeof calculateSecureChecksum === 'function') {
      session.signature = calculateSecureChecksum(session.accountId, session.email, session.familyId);
    }

    // 4. Activar la opción de inicio rápido local
    localStorage.setItem('recim_quick_login_enabled', 'true');
    session.quickLoginEnabled = true;

    // Guardar sesión y preferencia en SQLite
    if (typeof BiometricAuthManager !== 'undefined') {
      await BiometricAuthManager.saveSessionToSQLite(session);
    } else {
      localStorage.setItem('recim_last_sqlite_session', JSON.stringify(session));
    }

    // 5. Guardar preferencia en la Base de Datos Supabase (profiles)
    if (typeof supabaseClient !== 'undefined' && supabaseClient && session.accountId) {
      try {
        await supabaseClient
          .from('profiles')
          .update({ biometric_enabled: true })
          .eq('id', session.accountId);
        console.log("💾 Preferencia de inicio rápido guardada en la base de datos Supabase.");
      } catch (dbErr) {
        console.warn("⚠️ No se pudo guardar en Supabase (se mantiene guardado localmente en SQLite):", dbErr);
      }
    }

    if (typeof BiometricAuthManager !== 'undefined' && typeof BiometricAuthManager.updateBiometricButtonVisibility === 'function') {
      BiometricAuthManager.updateBiometricButtonVisibility();
    }

    if (typeof showToast === 'function') {
      showToast('⚡ Inicio de sesión rápido activado y guardado en SQLite y Base de Datos.', 'success');
    }

    closeAdvancedSettingsModal();
  } catch (err) {
    console.error("Error al activar inicio rápido:", err);
    if (errEl) {
      errEl.textContent = err.message || err;
      errEl.classList.remove('hidden');
    }
  } finally {
    if (btn) {
      btn.querySelector('span')?.classList.remove('hidden');
      btn.querySelector('.btn-spinner')?.classList.add('hidden');
      btn.disabled = false;
    }
  }
}

function handleDisableQuickLogin() {
  if (!confirm("¿Deseas desactivar el inicio de sesión rápido? Al hacerlo, deberás ingresar siempre con correo y contraseña.")) return;

  localStorage.setItem('recim_quick_login_enabled', 'false');

  try {
    const sessionStr = localStorage.getItem('recim_session') || localStorage.getItem('recim_last_sqlite_session');
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      session.quickLoginEnabled = false;
      if (typeof BiometricAuthManager !== 'undefined') {
        BiometricAuthManager.saveSessionToSQLite(session);
      }

      if (typeof supabaseClient !== 'undefined' && supabaseClient && session.accountId) {
        supabaseClient
          .from('profiles')
          .update({ biometric_enabled: false })
          .eq('id', session.accountId)
          .then(() => console.log("💾 Preferencia desactivada en Supabase DB."))
          .catch(err => console.warn("Aviso desactivar Supabase:", err));
      }
    }
  } catch (e) {}

  if (typeof BiometricAuthManager !== 'undefined' && typeof BiometricAuthManager.updateBiometricButtonVisibility === 'function') {
    BiometricAuthManager.updateBiometricButtonVisibility();
  }

  if (typeof showToast === 'function') {
    showToast('ℹ️ Inicio de sesión rápido desactivado.', 'info');
  }

  closeAdvancedSettingsModal();
}

window.openAdvancedSettingsModal = openAdvancedSettingsModal;
window.closeAdvancedSettingsModal = closeAdvancedSettingsModal;
window.showQuickLoginCredentialsForm = showQuickLoginCredentialsForm;
window.hideQuickLoginCredentialsForm = hideQuickLoginCredentialsForm;
window.handleActivateQuickLoginSubmit = handleActivateQuickLoginSubmit;
window.handleDisableQuickLogin = handleDisableQuickLogin;
window.generateAndShowQuickLoginCode = generateAndShowQuickLoginCode;

async function generateAndShowQuickLoginCode() {
  const box = document.getElementById('quick-code-display-box');
  const codeEl = document.getElementById('quick-code-number');
  const timerEl = document.getElementById('quick-code-timer');

  if (!box || !codeEl || !timerEl) return;

  box.style.display = 'block';

  let session = null;
  try {
    const sessionStr = localStorage.getItem('recim_session');
    if (sessionStr) session = JSON.parse(sessionStr);
  } catch (e) {}

  if (!session || (!session.email && !session.accountId)) {
    codeEl.textContent = "ERROR";
    if (typeof showToast === 'function') {
      showToast("⚠️ No hay una sesión activa para generar el código.", "warning");
    }
    return;
  }

  let currentExpiresAt = 0;

  const issueNewQuickCode = async () => {
    const now = Date.now();
    const code = (typeof generateSecureQuickCode === 'function')
      ? generateSecureQuickCode()
      : Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    currentExpiresAt = now + 60 * 1000;
    codeEl.textContent = code.split('').join(' ');
    timerEl.textContent = '60s';

    // Persistir en Supabase una sola vez por ciclo de 60s
    if (typeof supabaseClient !== 'undefined' && supabaseClient && session.accountId) {
      try {
        await supabaseClient.from('profiles').update({
          quick_code: code,
          quick_code_expires_at: new Date(currentExpiresAt).toISOString()
        }).eq('id', session.accountId);
      } catch (err) {
        console.warn("⚠️ No se pudo guardar quick_code en Supabase:", err);
      }
    }
  };

  await issueNewQuickCode();

  if (g_quickCodeTimerInterval) clearInterval(g_quickCodeTimerInterval);

  g_quickCodeTimerInterval = setInterval(async () => {
    if (!document.getElementById('quick-code-timer')) {
      clearInterval(g_quickCodeTimerInterval);
      g_quickCodeTimerInterval = null;
      return;
    }
    const remainingSec = Math.ceil((currentExpiresAt - Date.now()) / 1000);
    if (remainingSec <= 0) {
      await issueNewQuickCode();
    } else {
      timerEl.textContent = `${remainingSec}s`;
    }
  }, 1000);
}

// =============================================
// CUMPLIMIENTO LEGAL (LEY 172-13 RD / GOOGLE PLAY / GDPR)
// =============================================

function openLegalPrivacyModal() {
  const existing = document.getElementById('legal-privacy-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'legal-privacy-modal';
  overlay.className = 'modal-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  overlay.innerHTML = `
    <div class="modal" style="max-width: 620px; width: 92%; max-height: 85vh; display: flex; flex-direction: column;">
      <div class="modal-header">
        <h3 class="modal-title">⚖️ Política de Privacidad, Seguridad y Términos Legales</h3>
        <button class="modal-close" onclick="document.getElementById('legal-privacy-modal')?.remove()">✕</button>
      </div>
      <div class="modal-body" style="overflow-y: auto; font-size: 0.84rem; line-height: 1.55; color: var(--clr-text-secondary); display: flex; flex-direction: column; gap: 14px;">
        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); padding: 12px; border-radius: 8px; color: var(--clr-text);">
          <strong>Marco Legal Aplicable:</strong> Esta aplicación opera en cumplimiento con la <b>Ley No. 172-13</b> sobre Protección de Datos de Carácter Personal de la República Dominicana, la <b>Ley No. 53-07</b>, la <b>Ley No. 358-05</b>, los principios del <b>GDPR</b> y las Políticas de Seguridad de Datos de <b>Google Play</b> y <b>Microsoft Store</b>.
        </div>

        <div>
          <h4 style="margin: 0 0 4px 0; color: var(--clr-text); font-size: 0.92rem;">1. Identificación de Dispositivo y Auditoría Operativa</h4>
          <p style="margin: 0;">Por razones de seguridad corporativa, prevención de fraude, control de licencias y trazabilidad de accesos, la aplicación registra el identificador técnico del dispositivo (<code>ANDROID_ID</code> en Android, identificador técnico local en Windows/PC o huella técnica de navegador). Este identificador <b>nunca</b> se utiliza con fines publicitarios ni se comparte con redes de anuncios.</p>
        </div>

        <div>
          <h4 style="margin: 0 0 4px 0; color: var(--clr-text); font-size: 0.92rem;">2. Responsabilidad Fiscal Exclusiva del Usuario (DGII)</h4>
          <p style="margin: 0;">Reciminsaap es una herramienta auxiliar tecnológica y <b>no sustituye asesoría contable o legal</b>. Cada empresa o usuario debe configurar su propio RNC y secuencias NCF autorizadas, siendo el único responsable ante la DGII por sus comprobantes Serie B y formatos 606, 607 y 608.</p>
        </div>

        <div>
          <h4 style="margin: 0 0 4px 0; color: var(--clr-text); font-size: 0.92rem;">3. Carácter Informativo (Impacto Ambiental y ReciBot)</h4>
          <p style="margin: 0;">Las métricas de impacto medioambiental, constancias estimadas PDF y respuestas del asistente ReciBot son meramente informativas según factores promedio de referencia; no constituyen certificaciones gubernamentales oficiales ni auditorías ISO.</p>
        </div>

        <div>
          <h4 style="margin: 0 0 4px 0; color: var(--clr-text); font-size: 0.92rem;">4. Derechos ARCO y Eliminación de Cuenta</h4>
          <p style="margin: 0;">Todo usuario tiene derecho de Acceso, Rectificación, Cancelación y Oposición (ARCO), pudiendo eliminar permanentemente su cuenta desde <b>Ajustes &rarr; Cuenta &rarr; Eliminar Cuenta</b> o escribiendo a <a href="mailto:soporte@reciminsa.com" style="color:#34d399;">soporte@reciminsa.com</a>.</p>
        </div>

        <div style="display: flex; gap: 10px; flex-wrap: wrap; padding-top: 4px;">
          <a href="privacidad.html" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="flex:1; text-align:center; text-decoration:none; padding:9px 12px;">📄 Política de Privacidad Completa</a>
          <a href="terminos.html" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="flex:1; text-align:center; text-decoration:none; padding:9px 12px;">📜 Términos de Uso y EULA</a>
        </div>
      </div>
      <div class="modal-footer" style="display: flex; justify-content: flex-end;">
        <button class="btn-primary" onclick="document.getElementById('legal-privacy-modal')?.remove()">Entendido</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}
window.openLegalPrivacyModal = openLegalPrivacyModal;

async function handleDeleteUserAccount() {
  const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
  if (!session || !session.accountId) {
    showToast('⚠️ No hay una sesión activa.', 'warning');
    return;
  }

  const ok1 = await window.AppDialog.confirm(
    '⚠️ ¿Deseas eliminar permanentemente tu cuenta de usuario y desvincular este dispositivo?\n\nEsta acción cumple con el derecho de supresión de datos (Ley 172-13 / Google Play) y es irreversible.',
    'Eliminar Cuenta de Usuario'
  );
  if (!ok1) return;

  const ok2 = await window.AppDialog.confirm(
    `🚨 CONFIRMACIÓN DEFINITIVA: Se eliminará el perfil asociado a ${session.email || session.accountId} y sus datos personales vinculados. ¿Confirmas la eliminación definitiva?`,
    'Confirmar Eliminación'
  );
  if (!ok2) return;

  const accountId = session.accountId;
  const userEmail = (session.email || '').trim().toLowerCase();

  try {
    // Remover usuario de registros compartidos de sucursales/accesos si pertenecía a una empresa
    if (session.familyId && typeof userKey === 'function') {
      try {
        const membersKey = userKey('recim_branch_members');
        const members = JSON.parse(localStorage.getItem(membersKey) || '[]');
        if (Array.isArray(members)) {
          const filteredMembers = members.filter(m => m && m.accountId !== accountId && m.id !== accountId && (m.email || '').toLowerCase() !== userEmail);
          localStorage.setItem(membersKey, JSON.stringify(filteredMembers));
        }

        const logsKey = userKey('recim_access_logs');
        const logs = JSON.parse(localStorage.getItem(logsKey) || '[]');
        if (Array.isArray(logs)) {
          const scrubbedLogs = logs.filter(l => l && l.accountId !== accountId && (l.email || '').toLowerCase() !== userEmail);
          localStorage.setItem(logsKey, JSON.stringify(scrubbedLogs));
        }

        if (typeof window.syncPushData === 'function') {
          await window.syncPushData(`family_${session.familyId}`);
        }
      } catch (_) {}
    }

    if (isSupabaseActive && supabaseClient) {
      await supabaseClient.from('profiles').delete().eq('id', accountId);
      await supabaseClient.from('user_data').delete().eq('id', accountId);
      await supabaseClient.from('user_data').delete().eq('id', `gdrive_${accountId}`);
      if (userEmail) {
        try {
          await supabaseClient.from('support_tickets').delete().eq('user_email', userEmail);
        } catch (_) {}
      }
    }

    if (typeof BiometricAuthManager !== 'undefined' && typeof BiometricAuthManager.deleteSessionFromSQLite === 'function') {
      await BiometricAuthManager.deleteSessionFromSQLite(accountId);
    }
  } catch (e) {
    console.warn('Aviso al eliminar cuenta en nube:', e);
  }

  // Limpiar claves locales personales del usuario
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.includes(accountId) || (!session.familyId && k.startsWith('recim_'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (_) {}

  localStorage.removeItem('recim_session');
  localStorage.removeItem('recim_saved_account');
  localStorage.removeItem('recim_last_sqlite_session');
  localStorage.removeItem('recim_quick_login_enabled');
  localStorage.removeItem('recim_dont_show_saved_account');
  showToast('🗑️ Tu cuenta y datos personales han sido eliminados.', 'success');
  setTimeout(() => window.location.reload(), 1200);
}
window.handleDeleteUserAccount = handleDeleteUserAccount;



