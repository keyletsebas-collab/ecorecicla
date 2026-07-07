/* =============================================
   SETTINGS.JS – Página de Ajustes de la App
   ============================================= */

const APP_VERSION = 'v1.0.14';

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
  const localSettings = JSON.parse(localStorage.getItem('recim_settings') || '{}');
  try {
    const sharedKey = typeof userKey === 'function' ? userKey('recim_company_shared_settings') : 'recim_company_shared_settings';
    const shared = JSON.parse(localStorage.getItem(sharedKey) || '{}');
    if (shared.companyName) localSettings.companyName = shared.companyName;
    if (shared.companyRNC) localSettings.companyRNC = shared.companyRNC;
    if (shared.companyPhone) {
      localSettings.companyPhone = shared.companyPhone;
      localSettings.userPhone = shared.companyPhone;
    }
    if (shared.companyEmail) {
      localSettings.companyEmail = shared.companyEmail;
      localSettings.userEmail = shared.companyEmail;
    }
    if (shared.companyAddress) localSettings.companyAddress = shared.companyAddress;
    if (shared.companyLogo) localSettings.companyLogo = shared.companyLogo;
  } catch(e){}
  return localSettings;
}

function saveSetting(key, value) {
  const s = JSON.parse(localStorage.getItem('recim_settings') || '{}');
  s[key] = value;
  localStorage.setItem('recim_settings', JSON.stringify(s));
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
  const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
  const settings = getSettings();
  const currentLang = settings.language || 'es';
  const currentTheme = settings.colorTheme || 'green';
  const darkMode = settings.darkMode !== false;
  const currentCur = settings.currency || 'usd';
  const gdriveFolderVal = localStorage.getItem(userKey('recim_gdrive_folder')) || '';

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
          <button class="btn-primary" style="display:none; width:100%; justify-content:center; background:linear-gradient(135deg, var(--clr-primary), #10b981);" onclick="if(window.forceOpenPaywall) forceOpenPaywall()">💎 Cambiar Suscripción / Canjear Código</button>
          <button class="btn-danger" style="width:100%;justify-content:center;" onclick="handleLogout()">🚪 Cerrar sesión</button>
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

      <!-- ===== IDIOMA ===== -->
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

      <!-- ===== DIVISA ===== -->
      <div class="card card--elevated settings-section">
        <h3 class="settings-section-title">${t('set.currency')}</h3>
        <div class="settings-item" style="flex-direction:column;align-items:flex-start;gap:10px;">
          <span class="settings-item-label">${t('set.currency_desc')}</span>
          <div class="lang-options">
            ${CURRENCIES.map(c => `
              <button class="lang-btn ${c.id === currentCur ? 'active' : ''}"
                      onclick="handleCurrencyChange('${c.id}')">
                ${c.label}
              </button>`).join('')}
          </div>
          <div class="settings-item" style="padding-top:8px;border-top:1px solid var(--clr-border);width:100%;">
            <span class="settings-item-label">${t('set.currency')} activa</span>
            <span class="settings-item-value">
              <strong>${getCurrency().symbol}</strong> &nbsp; ${getCurrency().code}
            </span>
          </div>
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

      <!-- ===== COMPARTIR EN EMPRESA ===== -->
      <div class="card card--elevated settings-section">
        <h3 class="settings-section-title">🏢 Compartir en Empresa</h3>
        <div id="settings-family-container">
          <div style="font-size:0.85rem;color:var(--clr-text-muted);">Cargando...</div>
        </div>
      </div>

      <!-- ===== SUSCRIPCIÓN Y LICENCIA (ANTI-CLONACIÓN) ===== -->
      <!-- Oculto temporalmente porque el sistema de cobro está archivado -->
      <div class="card card--elevated settings-section" style="display: none;">
        <h3 class="settings-section-title">💳 Suscripción y Licencia</h3>
        <div id="settings-subscription-container">
          <div style="font-size:0.85rem;color:var(--clr-text-muted);">Cargando...</div>
        </div>
      </div>

      <!-- ===== RESPALDO EN GOOGLE DRIVE ===== -->
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
        </div>
      </div>

      <!-- ===== CACHÉ Y DATOS ===== -->
      <div class="card card--elevated settings-section">
        <h3 class="settings-section-title">🗂 Almacenamiento y Caché</h3>
        <div id="cache-breakdown">Calculando...</div>
        <div class="cache-btn-group">
          <button class="btn-secondary" onclick="handleClearCache('facturas')">🧹 Facturas</button>
          <button class="btn-secondary" onclick="handleClearCache('finanzas')">🧹 Finanzas</button>
          <button class="btn-danger" onclick="handleClearCache('todo')">⚠️ Limpiar Todo</button>
        </div>
      </div>

      <!-- ===== HERRAMIENTAS DE DATOS ===== -->
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


      <!-- ===== REGISTRO DE EMPRESA ===== -->
      <div class="card card--elevated settings-section" style="grid-column: span 2;">
        <h3 class="settings-section-title">🏢 Registro de Empresa</h3>
        
        ${!(typeof isCurrentUserAdminOrFounder === 'function' ? isCurrentUserAdminOrFounder() : true) 
          ? `<div style="background: rgba(234, 179, 8, 0.1); border: 1px solid #eab308; border-radius: var(--r-md); padding: 12px; margin-bottom: 16px; font-size: 0.85rem; color: #eab308; display: flex; align-items: center; gap: 8px;"><span>⚠️</span> <span>Estos datos son compartidos por toda la empresa. Solo el <b>Administrador</b> puede modificarlos.</span></div>` 
          : ''
        }

        <div class="form-row" style="grid-template-columns: 1fr 1fr; gap: var(--sp-lg); align-items: start;">
          <!-- Columna Izquierda: Formulario -->
          <div style="display:flex; flex-direction:column; gap:14px;">
            <div class="form-group">
              <label class="form-label" for="set-company-name">Nombre de la Empresa</label>
              <input id="set-company-name" type="text" class="form-input" placeholder="Ej: Mi Recicladora" value="${settings.companyName || ''}" onchange="saveCompanyNameSetting(this.value)" ${!(typeof isCurrentUserAdminOrFounder === 'function' ? isCurrentUserAdminOrFounder() : true) ? 'disabled' : ''} />
              <p style="font-size:0.75rem; color:var(--clr-text-muted); margin-top:4px;">Aparecerá en el menú lateral y como nombre de la empresa emisora en facturas.</p>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="set-company-rnc">RNC de tu Compañía</label>
              <div style="display:flex; gap: 8px;">
                <input id="set-company-rnc" type="text" class="form-input" placeholder="9 u 11 dígitos" value="${settings.companyRNC || ''}" onchange="saveCompanyRNCSetting(this.value)" style="flex:1;" ${!(typeof isCurrentUserAdminOrFounder === 'function' ? isCurrentUserAdminOrFounder() : true) ? 'disabled' : ''} />
                <button class="btn-secondary" onclick="autoFillSettingsCompanyDGII()" style="margin:0; padding: 0 15px;" title="Buscar en DGII" type="button" ${!(typeof isCurrentUserAdminOrFounder === 'function' ? isCurrentUserAdminOrFounder() : true) ? 'disabled style="opacity:0.6; cursor:not-allowed;"' : ''}>🔍</button>
                <button class="btn-danger" onclick="clearSettingsCompanyRNC()" style="margin:0; padding: 0 12px; display:flex; align-items:center; justify-content:center; background: var(--clr-danger-soft); border-color: var(--clr-danger);" title="Eliminar RNC" type="button" ${!(typeof isCurrentUserAdminOrFounder === 'function' ? isCurrentUserAdminOrFounder() : true) ? 'disabled style="opacity:0.6; cursor:not-allowed;"' : ''}>🗑</button>
              </div>
              <p style="font-size:0.75rem; color:var(--clr-text-muted); margin-top:4px;">Se usará en la generación de facturas (PDF).</p>
            </div>

            <div class="form-group">
              <label class="form-label" for="set-company-phone">Teléfono de la Empresa</label>
              <input id="set-company-phone" type="text" class="form-input" placeholder="Ej: +1 (849) 585-0386" value="${settings.companyPhone || settings.userPhone || ''}" onchange="saveCompanyPhoneSetting(this.value)" ${!(typeof isCurrentUserAdminOrFounder === 'function' ? isCurrentUserAdminOrFounder() : true) ? 'disabled' : ''} />
              <p style="font-size:0.75rem; color:var(--clr-text-muted); margin-top:4px;">Se usará en la generación de facturas (PDF).</p>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="set-company-email">Correo Electrónico</label>
              <input id="set-company-email" type="email" class="form-input" placeholder="Ej: contacto@empresa.com" value="${settings.companyEmail || settings.userEmail || ''}" onchange="saveCompanyEmailSetting(this.value)" ${!(typeof isCurrentUserAdminOrFounder === 'function' ? isCurrentUserAdminOrFounder() : true) ? 'disabled' : ''} />
              <p style="font-size:0.75rem; color:var(--clr-text-muted); margin-top:4px;">Se usará en la generación de facturas (PDF).</p>
            </div>

            <div class="form-group">
              <label class="form-label" for="set-company-address">Dirección de la Empresa</label>
              <input id="set-company-address" type="text" class="form-input" placeholder="Ej: Calle Duarte #12, Santo Domingo" value="${settings.companyAddress || ''}" onchange="saveCompanyAddressSetting(this.value)" ${!(typeof isCurrentUserAdminOrFounder === 'function' ? isCurrentUserAdminOrFounder() : true) ? 'disabled' : ''} />
              <p style="font-size:0.75rem; color:var(--clr-text-muted); margin-top:4px;">Se usará en la generación de facturas (PDF).</p>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="set-company-logo">Logo de la App / Membrete (Opcional)</label>
              <input id="set-company-logo" type="file" accept="image/*" class="form-input" onchange="handleSettingsLogoUpload(this)" ${!(typeof isCurrentUserAdminOrFounder === 'function' ? isCurrentUserAdminOrFounder() : true) ? 'disabled' : ''} />
              <p style="font-size:0.75rem; color:var(--clr-text-muted); margin-top:4px;">Aparecerá en el panel lateral y en la cabecera de las facturas (PDF). Formato recomendado: PNG transparente.</p>
            </div>
          </div>
          
          <!-- Columna Derecha: Vista Previa del Logo -->
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; min-height: 180px; border: 1px dashed var(--clr-primary); border-radius: var(--r-md); background: var(--clr-surface-2); padding: 20px; position:relative;">
            <div style="font-size:0.8rem; color:var(--clr-text-muted); font-weight:600; text-transform:uppercase; margin-bottom:12px; position:absolute; top:12px;">Vista Previa del Logo</div>
            <div id="set-logo-preview-container" style="display:flex; align-items:center; justify-content:center; width:100%; height:120px; margin-top:20px;">
              ${settings.companyLogo 
                ? `<img src="${settings.companyLogo}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />` 
                : `<span style="font-size: 0.9rem; color: var(--clr-text-muted);">Sin Logo</span>`}
            </div>
          </div>
        </div>
        
        <!-- Botón Restaurar Todo -->
        ${(typeof isCurrentUserAdminOrFounder === 'function' ? isCurrentUserAdminOrFounder() : true) 
          ? `<div style="display:flex; justify-content:flex-end; margin-top:20px; padding-top:15px; border-top:1px solid var(--clr-border);">
              <button class="btn-secondary" onclick="restoreWhiteLabelToOriginal()" style="color: #ef4444; border-color: #ef4444; background: rgba(239, 68, 68, 0.05); font-weight:600; display:flex; align-items:center; gap:6px;">
                🔄 Restaurar Todo al Original
              </button>
            </div>`
          : ''
        }
      </div>

      <!-- ===== SOPORTE IT ===== -->
      <div class="card card--elevated settings-section" style="grid-column: span 2;">
        <h3 class="settings-section-title">🛠️ Soporte IT</h3>
        <p style="font-size:0.8rem; color:var(--clr-text-muted); margin-bottom:12px;">¿Tienes algún problema con la aplicación? Contáctanos para recibir ayuda.</p>
        <button class="btn-primary" style="width:100%;justify-content:center;background:linear-gradient(135deg, #10b981, #059669);" onclick="window.location.href='soporte-it/index.html'">
          Acceder a Soporte IT
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

  // Render family section
  setTimeout(() => renderFamilySection(), 0);

  // Render subscription section
  setTimeout(() => renderSubscriptionSettings(), 0);

  // Update Google Drive status badge
  setTimeout(() => updateGDriveStatusDOM(), 0);

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

    // Validar token de seguridad de la aplicación
    if (data.appToken !== 'c2JfcHVibGlzaGFibGVfTXE2bUV4NXFTSXh2Nm12dF9ETmFFd19OVGVVSUZQdg==') {
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
    showToast(t('toast.gdrive_copied'), 'success');
  }).catch(() => {
    showToast('❌ No se pudo copiar automáticamente', 'error');
  });
}

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
  
  const scriptInput = document.getElementById('settings-gdrive-script');
  const scriptVal = scriptInput ? scriptInput.value.trim() : '';

  const btn = document.getElementById('btn-test-gdrive');
  const spinner = document.getElementById('gdrive-spinner');

  if (!folderVal) {
    localStorage.removeItem(userKey('recim_gdrive_folder'));
    localStorage.removeItem(userKey('recim_gdrive_script_url'));
    localStorage.removeItem(userKey('recim_gdrive_status'));
    updateGDriveStatusDOM();
    showToast('⚠️ Dirección de Google Drive eliminada', 'warning');
    if (window.syncPushGDriveSettings) {
      window.syncPushGDriveSettings(session.accountId);
    }
    return;
  }

  // 1. Guardar ajustes locales temporalmente de forma aislada
  localStorage.setItem(userKey('recim_gdrive_folder'), folderVal);
  localStorage.setItem(userKey('recim_gdrive_script_url'), scriptVal);
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
      'recim_clients',
      'recim_ingresos',
      'recim_egresos'
    ];
    let hasData = false;
    
    WATCHED_KEYS.forEach(k => {
      const val = localStorage.getItem(userKey(k));
      if (val) {
        dataToSync[k] = JSON.parse(val);
        hasData = true;
      }
    });

    // 4. Intentar enviar el respaldo
    if (typeof window.syncPushGDrive === 'function') {
      const success = await window.syncPushGDrive(dataToSync);
      
      if (success) {
        if (typeof window.sendGDriveWelcomeDoc === 'function') {
          window.sendGDriveWelcomeDoc();
        }
        if (typeof window.syncPushGDriveExcel === 'function') {
          window.syncPushGDriveExcel(true);
        }
        localStorage.setItem(userKey('recim_gdrive_status'), 'success');
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
      } else {
        localStorage.setItem(userKey('recim_gdrive_status'), 'error');
        showToast(t('toast.gdrive_error') + 'Verifica Apps Script', 'error');

        // Push status to Supabase
        if (window.syncPushGDriveSettings) {
          window.syncPushGDriveSettings(session.accountId);
        }
      }
    } else {
      throw new Error('Módulo de sincronización de Google Drive no cargado aún.');
    }
  } catch (err) {
    console.error('Error saving Google Drive settings:', err);
    localStorage.setItem(userKey('recim_gdrive_status'), 'error');
    showToast(t('toast.gdrive_error') + err.message, 'error');

    // Push status to Supabase
    if (window.syncPushGDriveSettings) {
      window.syncPushGDriveSettings(session.accountId);
    }
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

  const scriptUrl = 'https://script.google.com/macros/s/AKfycbxYHnE-4KnXCqd-l3MWNKtQ3_HU-Fz6GNsNhf05loH0pfvJTXxbwujAC21OvLZddvSI/exec';
  
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

function handleLangChange(code) {
  saveSetting('language', code);
  // Update sidebar labels immediately
  updateSidebarLabels();
  // Re-render current page in new language
  rerenderCurrentPage();
  showToast(t('toast.lang'), 'success');
}

function handleCurrencyChange(curId) {
  saveSetting('currency', curId);
  rerenderCurrentPage();
  showToast(t('toast.currency'), 'success');
}

// ---- Cache breakdown renderer ----
function renderCacheBreakdown() {
  const el = document.getElementById('cache-breakdown');
  if (!el) return;

  const CACHE_GROUPS = [
    { key: 'facturas', label: '🧾 Facturas', baseKeys: ['recim_invoices'] },
    { key: 'finanzas', label: '💰 Finanzas', baseKeys: ['recim_ingresos', 'recim_egresos'] },
    { key: 'materiales', label: '🏷️ Materiales', baseKeys: ['recim_material_codes'] },
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
    facturas: { baseKeys: ['recim_invoices'], label: 'facturas' },
    finanzas: { baseKeys: ['recim_ingresos', 'recim_egresos'], label: 'ingresos y egresos' },
    materiales: { baseKeys: ['recim_material_codes'], label: 'materiales' },
    todo: { baseKeys: ['recim_invoices', 'recim_ingresos', 'recim_egresos', 'recim_material_codes'], label: 'todos los datos' },
  };
  const group = CACHE_MAP[category];
  if (!group) return;
  if (!confirm(`¿Eliminar ${group.label}? Esta acción no se puede deshacer.`)) return;
  
  group.baseKeys.forEach(k => localStorage.removeItem(userKey(k)));
  
  // Force cloud sync in the background without blocking the UI (Resolves Bug 1!)
  if (window.forceSync) {
    window.forceSync();
  }
  
  showToast('🗑 Datos eliminados de local y nube', 'success');
  renderSettingsPage(document.getElementById('page-ajustes'));
}

function handleClearData() {
  handleClearCache('todo');
}

// ---- Update sidebar nav labels on language change ----
function updateSidebarLabels() {
  const labels = {
    historial: t('nav.historial'),
    facturas: t('nav.facturas'),
    codigos: t('nav.codigos'),
    ingresos: t('nav.ingresos'),
    egresos: t('nav.egresos'),
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
    
    // Load companyAdmins list from shared settings
    let sharedAdmins = [];
    try {
      const sharedKey = typeof userKey === 'function' ? userKey('recim_company_shared_settings') : 'recim_company_shared_settings';
      const shared = JSON.parse(localStorage.getItem(sharedKey) || '{}');
      sharedAdmins = shared.companyAdmins || [];
    } catch(e){}

    const myIsAdmin = typeof isCurrentUserAdminOrFounder === 'function' && isCurrentUserAdminOrFounder();
    listContainer.innerHTML = members.map(m => {
      const isMe = m.accountId === myAccountId;
      const cName = m.name ? m.name.split(' | ')[0].trim() : 'Usuario';
      const initial = (m.avatar || cName || 'U')[0].toUpperCase();
      const isFounder = m.accountId === companyAdminId;
      const isMemberAdmin = isFounder || sharedAdmins.includes(m.accountId);
      const canManageAdmin = !isMe && myIsAdmin && !isFounder;
      const showKick = !isMe && myIsAdmin && !isFounder; // only admins can kick, cannot kick founder or self
      
      return `
        <div style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:var(--clr-surface-2); border:1px solid var(--clr-border); border-radius:var(--r-md);">
          <div style="width:32px; height:32px; border-radius:50%; background:var(--clr-primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.85rem; flex-shrink:0; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
            ${initial}
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:0.84rem; font-weight:600; color:var(--clr-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:6px;">
              <span>${cName}</span>
              ${isFounder ? `<span class="badge badge--blue" style="padding:2px 6px; font-size:0.65rem; font-weight:normal; border-radius:4px; background:#2563eb; color:#fff;">Fundador</span>` : ''}
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
        familyId: m.family_id
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

  if (familyId) {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <p style="font-size:0.8rem; color:var(--clr-text-muted);">
          Actualmente estás en una empresa compartida. Tu base de datos está sincronizada y compartida en tiempo real con todos los miembros de este grupo.
        </p>
        <div style="padding:12px; background:var(--clr-surface-2); border:1px solid var(--clr-border); border-radius:var(--r-md); display:flex; flex-direction:column; gap:8px;">
          <div style="font-size:0.75rem; color:var(--clr-text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">Código de tu Empresa</div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span id="family-code-text" style="font-family:monospace; font-size:1.25rem; font-weight:700; color:var(--clr-primary); letter-spacing:0.1em;">${familyId}</span>
            <button class="btn-secondary" style="padding:4px 8px; font-size:0.75rem;" onclick="copyFamilyCode()">📋 Copiar</button>
          </div>
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
          Crea una empresa para compartir tu base de datos con otros miembros, o únete a una empresa existente usando su código de 10 dígitos.
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
            <label class="form-label" style="font-size:0.75rem;">Código de Empresa (10 dígitos)</label>
            <input id="join-family-code-input" type="text" class="form-input" placeholder="Ej: 1234567890" maxlength="10" 
                   oninput="this.value = this.value.replace(/[^0-9]/g, '')" />
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
  session.familyId = code;
  localStorage.setItem('recim_session', JSON.stringify(session));
  localStorage.setItem(userKey('recim_company_id'), code);

  // Sincronizar en la nube (Supabase)
  if (isSupabaseActive && supabaseClient) {
    try {
      showToast('📡 Registrando empresa en el servidor...', 'info');
      
      // 1. Guardar family_id en tabla profiles del usuario
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .update({ family_id: code })
        .eq('id', session.accountId);

      if (profileError) throw profileError;
      
      // 2. Copiar los datos actuales a la ruta de la familia en Supabase user_data
      const { data: currentData, error: dataError } = await supabaseClient
        .from('user_data')
        .select('data')
        .eq('id', session.accountId)
        .maybeSingle();

      if (dataError) throw dataError;

      if (currentData && currentData.data) {
        const { error: upsertError } = await supabaseClient
          .from('user_data')
          .upsert({
            id: `family_${code}`,
            data: currentData.data,
            updated_at: new Date().toISOString()
          });
        if (upsertError) throw upsertError;
      }
      
      console.log('Empresa creada y datos migrados.');
    } catch (err) {
      console.error("Error al crear empresa en Supabase:", err);
      showToast('❌ Error de conexión al crear empresa', 'error');
      return;
    }
  }

  showToast('🏢 ¡Empresa creada exitosamente!', 'success');
  renderFamilySection();
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
  const code = input?.value.trim();
  if (!code || code.length !== 10) {
    showToast('⚠️ El código debe tener exactamente 10 dígitos', 'warning');
    return;
  }

  if (isSupabaseActive && supabaseClient) {
    try {
      showToast('📡 Validando código de empresa...', 'info');
      
      // Fetch users with this family ID
      const { data: cloudUsers, error: checkError } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('family_id', code);

      if (checkError) throw checkError;
      
      // Find if anyone belongs to this family
      const familyExists = cloudUsers && cloudUsers.length > 0;
      if (!familyExists) {
        showToast('❌ El código de empresa no es válido o no existe.', 'error');
        return;
      }

      // Valid: Join! Update profiles table
      const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
      
      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({ family_id: code })
        .eq('id', session.accountId);

      if (updateError) throw updateError;

      session.familyId = code;
      localStorage.setItem('recim_session', JSON.stringify(session));
      localStorage.setItem(userKey('recim_company_id'), code);
      
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
        await window.syncPullData(`family_${code}`);
      }

      showToast('🏢 ¡Te has unido a la empresa exitosamente!', 'success');
      renderFamilySection();
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
  localStorage.setItem('recim_session', JSON.stringify(session));
  localStorage.removeItem(userKey('recim_company_id'));

  // Update in Supabase
  if (isSupabaseActive && supabaseClient) {
    try {
      showToast('📡 Saliendo de la empresa...', 'info');
      const { error } = await supabaseClient
        .from('profiles')
        .update({ family_id: null })
        .eq('id', session.accountId);
      
      if (error) throw error;
    } catch (err) {
      console.error("Error al actualizar usuario en Supabase:", err);
    }
  }

  // Clear local database
  const keysToRemove = [
    'recim_invoices',
    'recim_material_codes',
    'recim_clients',
    'recim_ingresos',
    'recim_egresos'
  ];
  keysToRemove.forEach(k => localStorage.removeItem(userKey(k)));

  // Pull user's private data from Supabase
  if (window.syncPullData) {
    await window.syncPullData(session.accountId);
  }

  showToast('👋 Has salido de la empresa', 'success');
  renderFamilySection();
}

// ---- White Label settings handlers ----
function saveSharedCompanySetting(key, value) {
  try {
    const sharedKey = typeof userKey === 'function' ? userKey('recim_company_shared_settings') : 'recim_company_shared_settings';
    const shared = JSON.parse(localStorage.getItem(sharedKey) || '{}');
    shared[key] = value;
    localStorage.setItem(sharedKey, JSON.stringify(shared));
    
    // Dispatch standard storage event to trigger sync
    window.dispatchEvent(new StorageEvent('storage', {
      key: sharedKey,
      newValue: JSON.stringify(shared)
    }));
  } catch(e) {
    console.error("Error saving shared company setting:", e);
  }
}

function saveCompanyNameSetting(val) {
  const name = val.trim();
  saveSetting('companyName', name);
  saveSharedCompanySetting('companyName', name);
  
  // Update sidebar brand title immediately
  const brandEl = document.querySelector('.sidebar-brand');
  if (brandEl) {
    brandEl.textContent = name || 'Reciminsaap';
  }
  
  showToast('✅ Nombre de la App actualizado', 'success');
}

function saveCompanyRNCSetting(val) {
  const rnc = val.trim();
  saveSetting('companyRNC', rnc);
  saveSharedCompanySetting('companyRNC', rnc);
  showToast('✅ RNC de la Compañía actualizado', 'success');
}

function saveCompanyPhoneSetting(val) {
  const phone = val.trim();
  saveSetting('companyPhone', phone);
  saveSetting('userPhone', phone);
  saveSharedCompanySetting('companyPhone', phone);
  showToast('✅ Teléfono de la Empresa actualizado', 'success');
}

function saveCompanyEmailSetting(val) {
  const email = val.trim();
  saveSetting('companyEmail', email);
  saveSetting('userEmail', email);
  saveSharedCompanySetting('companyEmail', email);
  showToast('✅ Correo Electrónico actualizado', 'success');
}

function saveCompanyAddressSetting(val) {
  const addr = val.trim();
  saveSetting('companyAddress', addr);
  saveSharedCompanySetting('companyAddress', addr);
  showToast('✅ Dirección de la Empresa actualizada', 'success');
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
      saveCompanyNameSetting(data.name);
    }
    rncEl.value = val;
    saveCompanyRNCSetting(val);
  }
}

function clearSettingsCompanyRNC() {
  const rncEl = document.getElementById('set-company-rnc');
  if (rncEl) rncEl.value = '';
  saveSetting('companyRNC', '');
  saveSharedCompanySetting('companyRNC', '');
  showToast('🗑 RNC eliminado de la configuración', 'success');
}

function handleSettingsLogoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const base64Data = e.target.result;
    saveSetting('companyLogo', base64Data);
    saveSharedCompanySetting('companyLogo', base64Data);
    
    // Update preview container
    const previewContainer = document.getElementById('set-logo-preview-container');
    if (previewContainer) {
      previewContainer.innerHTML = `<img src="${base64Data}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />`;
    }
    
    // Update sidebar logo image immediately
    const sidebarLogoImg = document.getElementById('sidebar-logo-img');
    if (sidebarLogoImg) {
      sidebarLogoImg.src = base64Data;
    }
    
    showToast('✅ Logo de la App actualizado', 'success');
  };
  reader.readAsDataURL(file);
}

function restoreWhiteLabelToOriginal() {
  if (!confirm('¿Restaurar todas las configuraciones de marca blanca al original?')) return;
  
  saveSetting('companyName', '');
  saveSetting('companyRNC', '');
  saveSetting('companyLogo', '');
  
  saveSharedCompanySetting('companyName', '');
  saveSharedCompanySetting('companyRNC', '');
  saveSharedCompanySetting('companyPhone', '');
  saveSharedCompanySetting('companyEmail', '');
  saveSharedCompanySetting('companyAddress', '');
  saveSharedCompanySetting('companyLogo', '');
  
  // Reset form fields
  const nameEl = document.getElementById('set-company-name');
  if (nameEl) nameEl.value = '';
  
  const rncEl = document.getElementById('set-company-rnc');
  if (rncEl) rncEl.value = '';
  
  const fileEl = document.getElementById('set-company-logo');
  if (fileEl) fileEl.value = '';
  
  const previewContainer = document.getElementById('set-logo-preview-container');
  if (previewContainer) {
    previewContainer.innerHTML = `<span style="font-size: 0.9rem; color: var(--clr-text-muted);">Sin Logo</span>`;
  }
  
  // Reset sidebar brand name and logo image
  const brandEl = document.querySelector('.sidebar-brand');
  if (brandEl) brandEl.textContent = 'Reciminsaap';
  
  const sidebarLogoImg = document.getElementById('sidebar-logo-img');
  if (sidebarLogoImg) {
    sidebarLogoImg.src = 'logo-no-white-lines.png';
  }
  
  showToast('🔄 Marca blanca restaurada al original', 'success');
}

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

  const state = getSubscriptionState();
  const deviceUuid = getDeviceUUID();

  const planNames = {
    mensual: 'Plan Mensual (30 Días)',
    anual: 'Plan Anual (1 Año)',
    lifetime: 'Plan De Por Vida (Lifetime)'
  };

  const planName = state.plan ? (planNames[state.plan] || state.plan) : 'Sin Suscripción Activa';
  
  let expiresLabel = 'Expirado';
  let daysRemainingLabel = '';
  
  if (state.expiresAt === 'lifetime') {
    expiresLabel = 'De por vida (Acceso Ilimitado)';
  } else if (state.expiresAt > 0) {
    const date = new Date(state.expiresAt);
    expiresLabel = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const diff = state.expiresAt - Date.now();
    const days = Math.ceil(diff / (24 * 3600 * 1000));
    if (days > 0) {
      daysRemainingLabel = `<span class="badge badge--green" style="font-size:0.7rem; padding: 2px 6px;">${days} días restantes</span>`;
    } else {
      daysRemainingLabel = `<span class="badge badge--red" style="font-size:0.7rem; padding: 2px 6px;">Expirado</span>`;
    }
  }

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px; font-size:0.8rem;">
      <div class="settings-item" style="padding:4px 0;">
        <span class="settings-item-label">Plan Activo</span>
        <span class="settings-item-value" style="font-weight:700; color:#22c55e;">
          ${planName}
        </span>
      </div>
      
      <div class="settings-item" style="padding:4px 0;">
        <span class="settings-item-label">Fecha de Vencimiento</span>
        <span class="settings-item-value" style="font-weight:600; display:flex; align-items:center; gap:8px;">
          <span>${expiresLabel}</span>
          ${daysRemainingLabel}
        </span>
      </div>

      <div class="settings-item" style="padding:4px 0;">
        <span class="settings-item-label">Centro de Costos</span>
        <span class="settings-item-value" style="font-family:monospace; font-weight:700;">
          ${state.costCenter || 'No Configurado'}
        </span>
      </div>

      <div class="settings-item" style="padding:4px 0;">
        <span class="settings-item-label">Código Aplicado</span>
        <span class="settings-item-value" style="font-family:monospace; font-weight:700; color:#fbbf24;">
          ${state.promoCode || 'Ninguno'}
        </span>
      </div>

      <div class="settings-item" style="padding:4px 0; border-top:1px solid var(--clr-border); padding-top:8px; flex-direction:column; align-items:flex-start; gap:4px;">
        <span class="settings-item-label" style="font-size:0.7rem; color:var(--clr-text-muted);">ID de Dispositivo (Firma de Seguridad)</span>
        <span class="settings-item-value" style="font-family:monospace; font-size:0.7rem; overflow-wrap:break-word; width:100%; color:#cbd5e1;">
          ${deviceUuid}
        </span>
      </div>

      <div style="display:flex; gap:8px; margin-top:8px;">
        <button class="btn-primary" onclick="triggerSubscriptionRenewal()" style="flex:1; justify-content:center; padding:8px; font-size:0.75rem; font-weight:700; margin:0;">
          🔄 Renovar / Cambiar
        </button>
        <button class="btn-secondary" onclick="triggerDeviceUnlink()" style="flex:1; justify-content:center; padding:8px; font-size:0.75rem; font-weight:700; border-color:#ef4444; color:#ef4444; background:rgba(239,68,68,0.05); margin:0;">
          🔓 Desvincular Cuenta
        </button>
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
  { id: 'facturas', label: '🧾 Facturación' },
  { id: 'codigos', label: '🏷️ Códigos de Materiales' },
  { id: 'clientes', label: '👥 Clientes' },
  { id: 'ingresos', label: '📈 Ingresos' },
  { id: 'egresos', label: '📉 Egresos' },
  { id: 'ecologia', label: '🌱 Impacto medioambiental' }
];

function getModuleConfig() {
  const sessionStr = localStorage.getItem('recim_session');
  let accountId = 'default';
  if (sessionStr) {
    try { accountId = JSON.parse(sessionStr).accountId || 'default'; } catch(e){}
  }
  const key = `recim_modules_${accountId}`;
  const saved = localStorage.getItem(key);
  if (saved) {
    try { return JSON.parse(saved); } catch(e){}
  }
  
  // Default: all enabled
  const config = {};
  TOGGLEABLE_MODULES.forEach(m => config[m.id] = true);
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
  const config = getModuleConfig();
  config[moduleId] = isEnabled;
  saveModuleConfig(config);
}

function renderModulesChecklist() {
  const config = getModuleConfig();
  return TOGGLEABLE_MODULES.map(m => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.05);">
      <span style="font-size:0.9rem; font-weight:600;">${m.label}</span>
      <label class="toggle-switch">
        <input type="checkbox" ${config[m.id] ? 'checked' : ''} onchange="toggleModule('${m.id}', this.checked)" />
        <span class="toggle-slider"></span>
      </label>
    </div>
  `).join('');
}

function applyModuleVisibility() {
  const config = getModuleConfig();
  
  // Apply to sidebar links
  document.querySelectorAll('.sidebar-link').forEach(link => {
    const pageId = link.dataset.page;
    if (!pageId) return;
    // Keep historial and ajustes always visible
    if (pageId === 'historial' || pageId === 'ajustes') return;
    
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


