/* =============================================
   SETTINGS.JS – Página de Ajustes de la App
   ============================================= */

const APP_VERSION = 'v1.0.5';

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
  return JSON.parse(localStorage.getItem('recim_settings') || '{}');
}

function saveSetting(key, value) {
  const s = getSettings();
  s[key] = value;
  localStorage.setItem('recim_settings', JSON.stringify(s));
}

// ---- Apply stored settings on boot ----
function applySettings() {
  const s = getSettings();
  if (s.colorTheme) applyColorTheme(s.colorTheme, false);
  if (s.darkMode === false) document.documentElement.setAttribute('data-theme', 'light');
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
              <div class="settings-profile-name" id="settings-display-name">${session.name || 'Usuario'}</div>
              <button class="btn-secondary" style="padding:3px 8px;font-size:0.75rem;" onclick="showNameEditor()">✏️</button>
            </div>
            <div id="settings-name-editor" style="display:none;margin-top:8px;">
              <div style="display:flex;gap:8px;align-items:center;">
                <input id="settings-name-input" type="text" class="form-input"
                       value="${session.name || ''}"
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
        <div class="settings-item" style="margin-top:12px;">
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

      <!-- ===== COMPARTIR EN FAMILIA ===== -->
      <div class="card card--elevated settings-section">
        <h3 class="settings-section-title">👪 Compartir en Familia</h3>
        <div id="settings-family-container">
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
        <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;">
          <button class="btn-secondary" onclick="handleClearCache('facturas')" style="flex:1;font-size:0.8rem;">🧹 Facturas</button>
          <button class="btn-secondary" onclick="handleClearCache('finanzas')" style="flex:1;font-size:0.8rem;">🧹 Finanzas</button>
          <button class="btn-danger" onclick="handleClearCache('todo')" style="flex:1;justify-content:center;font-size:0.8rem;">⚠️ Limpiar Todo</button>
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

      <!-- ===== CONFIGURACIÓN DE BASE DE DATOS ===== -->
      <div class="card card--elevated settings-section">
        <h3 class="settings-section-title">${t('set.db_title')}</h3>
        <div id="settings-db-container" style="display:flex; flex-direction:column; gap:12px;">
          <!-- Content will be rendered dynamically by renderDatabaseConfigSection() -->
        </div>
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
            <span class="settings-item-label">${t('set.version')}</span>
            <span class="settings-item-value"><span style="background: linear-gradient(90deg, #007fff, #00d2ff, #007fff); background-size: 200% auto; color: white; font-weight: 800; padding: 4px 10px; border-radius: 8px; animation: textShine 3s linear infinite;">🚀 v1.0.5</span></span>
          </div>
          <div class="settings-item" style="grid-column: span 2; padding-top: 0; margin-top: -8px;">
            <p style="font-size: 0.8rem; color: var(--clr-text-muted); font-style: italic;">
              ℹ️ ${t('set.version_msg')}
            </p>
          </div>
          <div class="settings-item">
            <span class="settings-item-label">${t('set.platform')}</span>
            <span class="settings-item-value">${isElectron() ? 'PC (Escritorio)' : 'Web (PWA)'}</span>
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

  // Update Google Drive status badge
  setTimeout(() => updateGDriveStatusDOM(), 0);

  // Render Database Config Section
  setTimeout(() => renderDatabaseConfigSection(), 0);
}

// ---- Google Drive Backup Handlers ----

const GDRIVE_SCRIPT_CODE = `/**
 * Script de Google Apps para enviar correos y realizar respaldos en Google Drive de forma segura.
 * Desplegar desde tu cuenta de Google personal.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // CASO A: Respaldo en Google Drive
    if (data.action === 'backup') {
      var folderId = data.folderId;
      var fileName = data.fileName;
      var content = data.content; // contenido del JSON de respaldo
      
      var folder;
      if (folderId) {
        folder = DriveApp.getFolderById(folderId);
      } else {
        folder = DriveApp.getRootFolder();
      }
      
      // Buscar si ya existe un archivo con ese nombre para actualizarlo y evitar duplicados
      var files = folder.getFilesByName(fileName);
      var file;
      if (files.hasNext()) {
        file = files.next();
        file.setContent(content);
      } else {
        file = folder.createFile(fileName, content, MimeType.PLAIN_TEXT);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        message: "Respaldo guardado exitosamente en Google Drive.",
        fileUrl: file.getUrl() 
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }
    
    // CASO B: Envío de Correo (Verificación y Recuperación)
    var to = data.to;
    var subject = data.subject;
    var htmlBody = data.htmlBody;
    var textBody = data.textBody;
    
    // Envío del correo usando la API oficial de Gmail
    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: textBody,
      htmlBody: htmlBody
    });
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
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

  const scriptUrl = 'https://script.google.com/macros/s/AKfycbzrwE5FXgHuCGMIwiZE34DZChQP4zhvxaicj5eXcXKFw7qrew_jU6dVc2e50VxBQxP6/exec';
  
  const payload = {
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

  const renderList = (members) => {
    if (members.length === 0) {
      listContainer.innerHTML = `<div style="font-size:0.8rem; color:var(--clr-text-muted);">No hay otros miembros.</div>`;
      return;
    }
    listContainer.innerHTML = members.map(m => {
      const isMe = m.accountId === myAccountId;
      const initial = (m.avatar || m.name || 'U')[0].toUpperCase();
      return `
        <div style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:var(--clr-surface-2); border:1px solid var(--clr-border); border-radius:var(--r-md);">
          <div style="width:32px; height:32px; border-radius:50%; background:var(--clr-primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.85rem; flex-shrink:0; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
            ${initial}
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:0.84rem; font-weight:600; color:var(--clr-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:6px;">
              <span>${m.name}</span>
              ${isMe ? `<span class="badge badge--green" style="padding:2px 6px; font-size:0.65rem; font-weight:normal; border-radius:4px;">Tú</span>` : ''}
            </div>
            <div style="font-size:0.74rem; color:var(--clr-text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${m.email || '—'}
            </div>
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
      console.warn("Error actualizando lista de miembros familiares desde Supabase:", err);
      listContainer.innerHTML = `<div style="font-size:0.8rem; color:var(--clr-danger);">Error al cargar miembros familiares.</div>`;
    }
  } else {
    listContainer.innerHTML = `<div style="font-size:0.8rem; color:var(--clr-text-muted);">Sin conexión con el servidor.</div>`;
  }
}

function renderFamilySection() {
  const container = document.getElementById('settings-family-container');
  if (!container) return;

  const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
  const familyId = session.familyId;

  if (familyId) {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <p style="font-size:0.8rem; color:var(--clr-text-muted);">
          Actualmente estás en una familia. Tu base de datos está sincronizada y compartida en tiempo real con todos los miembros de este grupo.
        </p>
        <div style="padding:12px; background:var(--clr-surface-2); border:1px solid var(--clr-border); border-radius:var(--r-md); display:flex; flex-direction:column; gap:8px;">
          <div style="font-size:0.75rem; color:var(--clr-text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">Código de tu Familia</div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span id="family-code-text" style="font-family:monospace; font-size:1.25rem; font-weight:700; color:var(--clr-primary); letter-spacing:0.1em;">${familyId}</span>
            <button class="btn-secondary" style="padding:4px 8px; font-size:0.75rem;" onclick="copyFamilyCode()">📋 Copiar</button>
          </div>
        </div>

        <div style="margin-top:8px; border-top:1px solid var(--clr-border); padding-top:12px;">
          <div style="font-size:0.75rem; color:var(--clr-text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px;">Miembros de la Familia</div>
          <div id="family-members-list" style="display:flex; flex-direction:column; gap:8px;">
            <div style="font-size:0.8rem; color:var(--clr-text-muted);">Cargando miembros...</div>
          </div>
        </div>
        
        <button class="btn-danger" style="width:100%; justify-content:center; margin-top:8px;" onclick="handleLeaveFamily()">
          🚪 Salir de la Familia
        </button>
      </div>
    `;

    setTimeout(() => updateFamilyMembersDOM(familyId, session.accountId), 0);
  } else {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <p style="font-size:0.8rem; color:var(--clr-text-muted);">
          Crea una familia para compartir tu base de datos con otros miembros, o únete a una familia existente usando su código de 10 dígitos.
        </p>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:4px;">
          <button class="btn-primary" style="justify-content:center; font-size:0.85rem;" onclick="handleCreateFamily()">
            ➕ Crear Familia
          </button>
          <button class="btn-secondary" style="justify-content:center; font-size:0.85rem;" onclick="showJoinFamilyInput()">
            🔑 Unirse a Familia
          </button>
        </div>
        
        <div id="join-family-box" style="display:none; margin-top:8px; padding-top:12px; border-top:1px solid var(--clr-border);">
          <div class="form-group" style="margin-bottom:8px;">
            <label class="form-label" style="font-size:0.75rem;">Código de Familia (10 dígitos)</label>
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
  if (!confirm('¿Estás seguro de que quieres crear una familia? Compartirás tu base de datos actual.')) return;

  let code = '';
  // Generate random 10 digit code
  for (let i = 0; i < 10; i++) {
    code += Math.floor(Math.random() * 10);
  }

  const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
  session.familyId = code;
  localStorage.setItem('recim_session', JSON.stringify(session));

  // Sincronizar en la nube (Supabase)
  if (isSupabaseActive && supabaseClient) {
    try {
      showToast('📡 Registrando familia en el servidor...', 'info');
      
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
      
      console.log('Familia creada y datos migrados.');
    } catch (err) {
      console.error("Error al crear familia en Supabase:", err);
      showToast('❌ Error de conexión al crear familia', 'error');
      return;
    }
  }

  showToast('👪 ¡Familia creada exitosamente!', 'success');
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
      showToast('📡 Validando código de familia...', 'info');
      
      // Fetch users with this family ID
      const { data: cloudUsers, error: checkError } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('family_id', code);

      if (checkError) throw checkError;
      
      // Find if anyone belongs to this family
      const familyExists = cloudUsers && cloudUsers.length > 0;
      if (!familyExists) {
        showToast('❌ El código de familia no es válido o no existe.', 'error');
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

      showToast('👪 ¡Te has unido a la familia exitosamente!', 'success');
      renderFamilySection();
    } catch (err) {
      console.error("Error al unirse a la familia:", err);
      showToast('❌ Error al conectar con el servidor', 'error');
    }
  } else {
    showToast('⚠️ Conexión de red no disponible', 'warning');
  }
}

async function handleLeaveFamily() {
  if (!confirm('¿Estás seguro de que deseas salir de la familia? Perderás acceso a la base de datos compartida y volverás a tu base de datos privada.')) return;

  const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
  const oldFamilyId = session.familyId;
  session.familyId = null;
  localStorage.setItem('recim_session', JSON.stringify(session));

  // Update in Supabase
  if (isSupabaseActive && supabaseClient) {
    try {
      showToast('📡 Saliendo de la familia...', 'info');
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

  showToast('👋 Has salido de la familia', 'success');
  renderFamilySection();
}

// =============================================
// DATABASE CONNECTION CONFIGURATION (SUPABASE)
// =============================================

window.dbConfigUnlocked = false;

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString();
}

function renderDatabaseConfigSection() {
  const container = document.getElementById('settings-db-container');
  if (!container) return;

  const savedPinHash = localStorage.getItem('recim_admin_pin');
  const customUrl = localStorage.getItem('recim_db_url') || '';
  const customKey = localStorage.getItem('recim_db_key') || '';

  const displayUrl = customUrl || (typeof DEFAULT_URL !== 'undefined' ? DEFAULT_URL : 'https://qcudymexssvfdeppkhjs.supabase.co');
  const displayKey = customKey || (typeof DEFAULT_KEY !== 'undefined' ? DEFAULT_KEY : 'sb_publishable_y1Wj-5PSHOIN-_pIvX5Xeg_6SjpvjpF');

  if (!savedPinHash) {
    container.innerHTML = `
      <p style="font-size:0.8rem; color:var(--clr-text-muted);">
        Para proteger la configuración de la base de datos de accesos no autorizados, debes establecer un PIN de administrador.
      </p>
      <button class="btn-primary" style="width:100%; justify-content:center; gap:8px;" onclick="setupAdminPin()">
        🔑 Configurar PIN de Administrador
      </button>
    `;
  } else if (!window.dbConfigUnlocked) {
    container.innerHTML = `
      <div style="text-align:center; padding:16px 0;">
        <span style="font-size:3rem; display:block; margin-bottom:8px;">🔒</span>
        <p style="font-size:0.82rem; color:var(--clr-text-secondary); margin-bottom:12px;">
          ${t('set.db_desc')}
        </p>
        <button class="btn-primary" style="margin: 0 auto; justify-content:center; padding: 10px 20px;" onclick="unlockDatabaseConfig()">
          ${t('set.db_unlock')}
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <p style="font-size:0.8rem; color:var(--clr-text-muted);">
          Modifica estos campos solo si deseas conectar la app a tu propia base de datos de Supabase.
        </p>
        
        <div class="form-group">
          <label class="form-label" style="font-size:0.75rem; font-weight:600; margin-bottom:4px;">${t('set.db_url')}</label>
          <div class="input-password-wrap" style="position:relative; display:flex;">
            <input id="db-config-url" type="password" class="form-input" value="${displayUrl}" style="flex:1; font-family:monospace; font-size:0.82rem;" />
            <button type="button" class="password-toggle" onclick="toggleDbFieldVisibility('db-config-url', this)" style="background:none; border:none; padding:0 8px; color:var(--clr-text-muted); cursor:pointer;">👁</button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" style="font-size:0.75rem; font-weight:600; margin-bottom:4px;">${t('set.db_key')}</label>
          <div class="input-password-wrap" style="position:relative; display:flex;">
            <input id="db-config-key" type="password" class="form-input" value="${displayKey}" style="flex:1; font-family:monospace; font-size:0.82rem;" />
            <button type="button" class="password-toggle" onclick="toggleDbFieldVisibility('db-config-key', this)" style="background:none; border:none; padding:0 8px; color:var(--clr-text-muted); cursor:pointer;">👁</button>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
          <button class="btn-primary" style="width:100%; justify-content:center; padding:10px; font-weight:600;" onclick="saveDatabaseConfig()">
            ${t('set.db_save')}
          </button>
          <div style="display:flex; gap:8px;">
            <button class="btn-secondary" style="flex:1; justify-content:center; font-size:0.8rem; padding:8px;" onclick="resetDatabaseConfig()">
              ${t('set.db_reset')}
            </button>
            <button class="btn-secondary" style="flex:1; justify-content:center; font-size:0.8rem; padding:8px;" onclick="lockDatabaseConfig()">
              ${t('set.db_lock')}
            </button>
          </div>
          <button class="btn-danger" style="width:100%; justify-content:center; font-size:0.8rem; padding:8px; margin-top:4px;" onclick="changeAdminPin()">
            🔑 Cambiar PIN de Seguridad
          </button>
        </div>
      </div>
    `;
  }
}

function setupAdminPin() {
  const pin = prompt(t('set.db_pin_create_prompt'));
  if (pin === null) return;
  if (pin.length !== 4 || isNaN(pin)) {
    showToast('⚠️ El PIN debe ser de exactamente 4 números.', 'error');
    return;
  }
  localStorage.setItem('recim_admin_pin', simpleHash(pin));
  showToast(t('toast.db_pin_set'), 'success');
  renderDatabaseConfigSection();
}

function changeAdminPin() {
  const oldPin = prompt('Introduce tu PIN actual:');
  if (oldPin === null) return;
  const oldHash = simpleHash(oldPin);
  const currentHash = localStorage.getItem('recim_admin_pin');
  
  if (oldHash !== currentHash) {
    showToast(t('toast.db_pin_error'), 'error');
    return;
  }

  const newPin = prompt('Introduce el nuevo PIN (4 dígitos):');
  if (newPin === null) return;
  if (newPin.length !== 4 || isNaN(newPin)) {
    showToast('⚠️ El PIN debe ser de exactamente 4 números.', 'error');
    return;
  }
  localStorage.setItem('recim_admin_pin', simpleHash(newPin));
  showToast('✅ PIN de administrador actualizado con éxito', 'success');
}

function unlockDatabaseConfig() {
  const pin = prompt(t('set.db_pin_prompt'));
  if (pin === null) return;
  const currentHash = localStorage.getItem('recim_admin_pin');
  if (simpleHash(pin) === currentHash) {
    window.dbConfigUnlocked = true;
    showToast('🔓 Acceso concedido', 'success');
    renderDatabaseConfigSection();
  } else {
    showToast(t('toast.db_pin_error'), 'error');
  }
}

function lockDatabaseConfig() {
  window.dbConfigUnlocked = false;
  renderDatabaseConfigSection();
}

function toggleDbFieldVisibility(id, btn) {
  const input = document.getElementById(id);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

function saveDatabaseConfig() {
  const urlInput = document.getElementById('db-config-url');
  const keyInput = document.getElementById('db-config-key');
  if (!urlInput || !keyInput) return;

  const urlVal = urlInput.value.trim();
  const keyVal = keyInput.value.trim();

  if (!urlVal || !keyVal) {
    showToast('⚠️ Ambos campos son obligatorios.', 'error');
    return;
  }

  if (confirm('¿Estás seguro de que deseas guardar las nuevas credenciales de base de datos? La aplicación se reiniciará para conectarse con la nueva base de datos.')) {
    localStorage.setItem('recim_db_url', urlVal);
    localStorage.setItem('recim_db_key', keyVal);
    
    localStorage.removeItem('recim_session');
    
    showToast(t('toast.db_saved'), 'success');
    
    setTimeout(() => {
      location.reload();
    }, 1500);
  }
}

function resetDatabaseConfig() {
  if (confirm('¿Restaurar las credenciales por defecto de Supabase? La aplicación se reiniciará.')) {
    localStorage.removeItem('recim_db_url');
    localStorage.removeItem('recim_db_key');
    
    localStorage.removeItem('recim_session');
    
    showToast(t('toast.db_reset'), 'success');
    
    setTimeout(() => {
      location.reload();
    }, 1500);
  }
}
