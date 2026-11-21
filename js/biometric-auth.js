/* =============================================
   BIOMETRIC-AUTH.JS – SQLite Session & Biometric Login
   Soporte para Huella Digital / Biometría y SQLite
   ============================================= */

const BiometricAuthManager = {
  // ---- 1. Almacenamiento en SQLite ----

  saveSessionToSQLite: async function(session) {
    if (!session || !session.accountId) return;
    session.quickLoginEnabled = localStorage.getItem('recim_quick_login_enabled') === 'true';
    const sessionJson = JSON.stringify(session);
    localStorage.setItem('recim_last_sqlite_session', sessionJson);

    try {
      // Android MAUI Native Bridge
      if (window.AndroidNative && typeof window.AndroidNative.SaveUserSessionSQLite === 'function') {
        window.AndroidNative.SaveUserSessionSQLite(session.accountId, session.email || '', session.name || '', sessionJson);
        console.log("💾 Sesión guardada en SQLite (Android Native)");
      }

      // Windows WebView2 Bridge
      if (window.chrome && window.chrome.webview && typeof window.chrome.webview.postMessage === 'function') {
        NativeBridge.post({
          Action: 'save_user_session',
          AccountId: session.accountId,
          Email: session.email || '',
          Name: session.name || '',
          Data: sessionJson
        });
        console.log("💾 Sesión guardada en SQLite (Windows Native)");
      }

      // Fallback para Web / PWA usando IndexedDB SQLite Store
      await BiometricAuthManager._saveSessionToIndexedDB(session);
      console.log("💾 Sesión guardada en SQLite Store local (Web)");
    } catch (err) {
      console.warn("⚠️ Error guardando sesión en SQLite:", err);
    }
  },

  getLatestSessionFromSQLite: function() {
    return new Promise(async (resolve) => {
      // Android Native Bridge
      if (window.AndroidNative && typeof window.AndroidNative.GetLatestUserSessionSQLite === 'function') {
        try {
          const raw = window.AndroidNative.GetLatestUserSessionSQLite();
          if (raw) {
            resolve(JSON.parse(raw));
            return;
          }
        } catch (e) {
          console.warn("Error leyendo SQLite Android:", e);
        }
      }

      // Windows Native Bridge
      if (window.chrome && window.chrome.webview && typeof window.chrome.webview.postMessage === 'function') {
        window.onSQLiteSessionLoaded = function(sessionJson) {
          try {
            resolve(sessionJson ? JSON.parse(sessionJson) : null);
          } catch (e) {
            resolve(null);
          }
        };
        NativeBridge.post({ Action: 'get_user_session' });
        setTimeout(async () => {
          const fallback = await BiometricAuthManager._getFallbackSession();
          resolve(fallback);
        }, 800);
        return;
      }

      // Web & Fallback
      const fallback = await BiometricAuthManager._getFallbackSession();
      resolve(fallback);
    });
  },

  _getFallbackSession: async function() {
    try {
      const webSession = await BiometricAuthManager._getSessionFromIndexedDB();
      if (webSession) return webSession;

      const lastSqlite = localStorage.getItem('recim_last_sqlite_session');
      if (lastSqlite) return JSON.parse(lastSqlite);

      const activeSession = localStorage.getItem('recim_session');
      if (activeSession) return JSON.parse(activeSession);
    } catch (e) {}
    return null;
  },

  deleteSessionFromSQLite: async function(accountId) {
    try {
      if (window.AndroidNative && typeof window.AndroidNative.DeleteUserSessionSQLite === 'function') {
        window.AndroidNative.DeleteUserSessionSQLite(accountId);
      } else if (window.chrome && window.chrome.webview) {
        NativeBridge.post({ Action: 'delete_user_session', AccountId: accountId });
      }
      await BiometricAuthManager._deleteSessionFromIndexedDB(accountId);
    } catch (e) {
      console.warn("Error borrando SQLite:", e);
    }
  },

  // ---- 2. Autenticación Biométrica / Huella Digital ----

  isBiometricAvailable: async function() {
    if (window.AndroidNative && typeof window.AndroidNative.AuthenticateBiometric === 'function') {
      return true;
    }
    if (window.chrome && window.chrome.webview) {
      return true;
    }
    if (window.PublicKeyCredential) {
      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return available;
      } catch (e) {
        return false;
      }
    }
    return false;
  },

  authenticateWithBiometrics: function() {
    return new Promise(async (resolve) => {
      const errorEl = document.getElementById('login-error');
      
      // Android Native Biometric Prompt
      if (window.AndroidNative && typeof window.AndroidNative.AuthenticateBiometric === 'function') {
        window.onBiometricAuthResult = function(success, errorMsg) {
          if (success) {
            resolve(true);
          } else {
            if (errorEl && errorMsg) {
              errorEl.textContent = 'Autenticación fallida: ' + errorMsg;
              errorEl.classList.remove('hidden');
            }
            resolve(false);
          }
        };
        window.AndroidNative.AuthenticateBiometric("Confirmar Identidad", "Usa huella, rostro, PIN o patrón para continuar");
        return;
      }

      // Windows Native Hello Prompt
      if (window.chrome && window.chrome.webview) {
        window.onBiometricAuthResult = function(success, errorMsg) {
          if (success) {
            resolve(true);
          } else {
            if (errorEl && errorMsg) {
              errorEl.textContent = 'Verificación cancelada o fallida: ' + errorMsg;
              errorEl.classList.remove('hidden');
            }
            resolve(false);
          }
        };
        NativeBridge.post({ Action: 'authenticate_biometric' });
        return;
      }

      // WebAuthn Browser Standard Biometrics
      if (window.PublicKeyCredential) {
        try {
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);

          const options = {
            publicKey: {
              challenge: challenge,
              timeout: 60000,
              userVerification: 'required',
              rpId: window.location.hostname
            }
          };

          // Intentar obtener credencial existente o solicitar verificación local
          const assertion = await navigator.credentials.get(options);
          if (assertion) {
            resolve(true);
            return;
          }
        } catch (webAuthErr) {
          console.warn("WebAuthn verificación no disponible o cancelada:", webAuthErr);
          resolve(false);
          return;
        }
      }

      resolve(false);
    });
  },

  handleBiometricLoginButtonClick: async function() {
    const isEnabled = localStorage.getItem('recim_quick_login_enabled') === 'true';
    const errorEl = document.getElementById('login-error');

    if (!isEnabled) {
      if (errorEl) {
        errorEl.textContent = 'El inicio de sesión rápido está desactivado. Actívalo en Ajustes > Opciones Avanzadas.';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    if (errorEl) errorEl.classList.add('hidden');

    const btn = document.getElementById('biometric-login-btn');
    if (btn) {
      btn.disabled = true;
      btn.classList.add('btn-loading');
    }

    try {
      // 1. Obtener la última sesión guardada en SQLite
      const savedSession = await BiometricAuthManager.getLatestSessionFromSQLite();
      const localSessionStr = localStorage.getItem('recim_session');
      let targetSession = savedSession;

      if (!targetSession && localSessionStr) {
        try {
          targetSession = JSON.parse(localSessionStr);
        } catch (e) {}
      }

      if (!targetSession || !targetSession.accountId) {
        if (errorEl) {
          errorEl.textContent = 'No hay una sesión guardada. Inicia sesión con correo y contraseña primero.';
          errorEl.classList.remove('hidden');
        }
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('btn-loading');
        }
        return;
      }

      // 2. Invocar huella dactilar / método de seguridad del dispositivo
      const authenticated = await BiometricAuthManager.authenticateWithBiometrics();

      if (authenticated) {
        showToast(`🔐 Autenticación exitosa.`, 'success');
        
        // Guardar/refrescar en localStorage y SQLite
        localStorage.setItem('recim_session', JSON.stringify(targetSession));
        await BiometricAuthManager.saveSessionToSQLite(targetSession);

        if (typeof initApp === 'function') {
          initApp(targetSession);
        } else {
          window.location.reload();
        }
      }
    } catch (err) {
      console.error("Error en inicio biométrico:", err);
      if (errorEl) {
        errorEl.textContent = 'Error durante la verificación de seguridad.';
        errorEl.classList.remove('hidden');
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('btn-loading');
      }
    }
  },

  // ---- 3. Auxiliares IndexedDB (SQLite Fallback para Web) ----

  _getDB: function() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ReciminsaSQLiteStore', 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('user_sessions')) {
          db.createObjectStore('user_sessions', { keyPath: 'accountId' });
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  _saveSessionToIndexedDB: async function(session) {
    const db = await BiometricAuthManager._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('user_sessions', 'readwrite');
      const store = tx.objectStore('user_sessions');
      store.put({
        accountId: session.accountId,
        email: session.email,
        name: session.name,
        sessionData: session,
        lastLogin: Date.now()
      });
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  _getSessionFromIndexedDB: async function() {
    try {
      const db = await BiometricAuthManager._getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('user_sessions', 'readonly');
        const store = tx.objectStore('user_sessions');
        const request = store.getAll();
        request.onsuccess = () => {
          const records = request.result;
          if (records && records.length > 0) {
            records.sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0));
            resolve(records[0].sessionData);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  },

  _deleteSessionFromIndexedDB: async function(accountId) {
    try {
      const db = await BiometricAuthManager._getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('user_sessions', 'readwrite');
        const store = tx.objectStore('user_sessions');
        store.delete(accountId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch (e) {}
  },

  // ---- 4. Sincronización y Visibilidad de Botón por Configuración ----

  syncQuickLoginStateFromSQLiteOrDB: async function() {
    try {
      const savedSession = await BiometricAuthManager.getLatestSessionFromSQLite();
      if (savedSession && savedSession.accountId) {
        if (savedSession.quickLoginEnabled === true || savedSession.quickLoginEnabled === 'true' || savedSession.BiometricEnabled === true) {
          localStorage.setItem('recim_quick_login_enabled', 'true');
        } else if (savedSession.quickLoginEnabled === false || savedSession.quickLoginEnabled === 'false') {
          localStorage.setItem('recim_quick_login_enabled', 'false');
        }
      }

      if (typeof supabaseClient !== 'undefined' && supabaseClient && savedSession && savedSession.accountId) {
        try {
          const { data } = await supabaseClient
            .from('profiles')
            .select('biometric_enabled')
            .eq('id', savedSession.accountId)
            .maybeSingle();

          if (data && typeof data.biometric_enabled === 'boolean') {
            localStorage.setItem('recim_quick_login_enabled', data.biometric_enabled ? 'true' : 'false');
          }
        } catch (dbErr) {
          console.warn("⚠️ No se pudo consultar estado biométrico de Supabase:", dbErr);
        }
      }
    } catch (e) {
      console.warn("⚠️ Error sincronizando estado de inicio rápido:", e);
    } finally {
      BiometricAuthManager.updateBiometricButtonVisibility();
    }
  },

  updateBiometricButtonVisibility: function() {
    const bioBtn = document.getElementById('biometric-login-btn');
    const quickCodeBtn = document.getElementById('quick-code-login-btn');
    const divider = document.querySelector('.auth-divider');

    const isMobilePlatform = (function() {
      try {
        if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
          return true;
        }
        if (window.AndroidNative && typeof window.AndroidNative.AuthenticateBiometric === 'function') {
          return true;
        }
        const ua = (navigator.userAgent || '').toLowerCase();
        return /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
      } catch (e) {
        return false;
      }
    })();

    if (isMobilePlatform) {
      if (quickCodeBtn) quickCodeBtn.style.display = 'none';
      const isEnabled = localStorage.getItem('recim_quick_login_enabled') === 'true';
      if (bioBtn) {
        if (isEnabled) {
          bioBtn.style.display = 'flex';
          if (divider) divider.style.display = 'block';
        } else {
          bioBtn.style.display = 'none';
          if (divider) divider.style.display = 'none';
        }
      }
    } else {
      // Web y Windows: Ocultar biometría móvil y mostrar Inicio de Sesión Rápido por Código
      if (bioBtn) bioBtn.style.display = 'none';
      if (quickCodeBtn) {
        quickCodeBtn.style.display = 'flex';
        if (divider) divider.style.display = 'block';
      }
    }
  }
};

// --- Funciones para Código de Acceso Rápido (6 dígitos CSPRNG de un solo uso) ---
function generateSecureQuickCode() {
  try {
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      return (arr[0] % 1000000).toString().padStart(6, '0');
    }
  } catch (_) {}
  return Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
}

// Alias de compatibilidad sin fórmula determinista offline
function calculate6DigitQuickCode() {
  return generateSecureQuickCode();
}

function openQuickCodeLoginModal() {
  let savedEmail = '';
  try {
    const savedAcc = JSON.parse(localStorage.getItem('recim_saved_account') || '{}');
    savedEmail = savedAcc.email || '';
    if (!savedEmail) {
      const lastSql = JSON.parse(localStorage.getItem('recim_last_sqlite_session') || '{}');
      savedEmail = lastSql.email || '';
    }
  } catch (_) {}

  let modalOverlay = document.getElementById('quick-code-login-modal');
  if (!modalOverlay) {
    modalOverlay = document.createElement('div');
    modalOverlay.id = 'quick-code-login-modal';
    modalOverlay.className = 'modal-overlay';
    modalOverlay.onclick = (e) => { if (e.target === modalOverlay) closeQuickCodeLoginModal(); };

    modalOverlay.innerHTML = `
      <div class="modal" style="max-width: 440px; width: 90%; border-radius: var(--r-lg, 16px);">
        <div class="modal-header">
          <h3 class="modal-title">⚡ Inicio de Sesión Rápido</h3>
          <button class="modal-close" onclick="closeQuickCodeLoginModal()">✕</button>
        </div>
        <div class="modal-body" style="padding: 20px;">
          <p style="font-size: 0.88rem; color: var(--clr-text-muted, #94a3b8); margin-bottom: 16px; line-height: 1.4;">
            Ingresa tu correo y el código temporal de 6 dígitos (de un solo uso) generado en Opciones Avanzadas.
          </p>

          <form onsubmit="handleQuickCodeLoginSubmit(event)" style="display: flex; flex-direction: column; gap: 14px;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label" for="quick-code-email" style="font-size: 0.82rem; margin-bottom: 6px; display: block;">Correo electrónico</label>
              <input id="quick-code-email" type="email" class="form-input" placeholder="correo@ejemplo.com" required autocomplete="email" style="width: 100%; box-sizing: border-box;" />
            </div>

            <div class="form-group" style="margin: 0; text-align: center;">
              <label class="form-label" for="quick-code-input" style="font-size: 0.82rem; margin-bottom: 8px; display: block;">Código de 6 dígitos</label>
              <input id="quick-code-input" type="text" class="form-input" placeholder="000000" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code" required style="font-size: 2rem; font-weight: 800; letter-spacing: 8px; text-align: center; font-family: monospace; padding: 12px; border-radius: 12px; border: 2px solid #10b981;" autofocus />
            </div>

            <p id="quick-code-error" class="auth-error hidden" style="font-size: 0.82rem; margin: 0; text-align: center; color: #ef4444;"></p>

            <div style="display: flex; gap: 10px; margin-top: 6px;">
              <button type="button" class="btn-secondary" style="flex: 1; justify-content: center;" onclick="closeQuickCodeLoginModal()">Cancelar</button>
              <button type="submit" id="quick-code-submit-btn" class="btn-primary" style="flex: 1; justify-content: center; background: linear-gradient(135deg, #10b981, #059669); font-weight: 600;">
                <span>Iniciar Sesión</span>
                <div class="btn-spinner hidden"></div>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modalOverlay);
  } else {
    modalOverlay.style.display = 'flex';
  }

  const emailEl = document.getElementById('quick-code-email');
  if (emailEl && savedEmail) {
    emailEl.value = savedEmail;
  }
  const inputEl = document.getElementById('quick-code-input');
  if (inputEl) {
    inputEl.value = '';
    setTimeout(() => (emailEl && !emailEl.value ? emailEl.focus() : inputEl.focus()), 100);
  }
  const errEl = document.getElementById('quick-code-error');
  if (errEl) errEl.classList.add('hidden');
}

function closeQuickCodeLoginModal() {
  const modal = document.getElementById('quick-code-login-modal');
  if (modal) modal.remove();
}

async function handleQuickCodeLoginSubmit(evt) {
  evt.preventDefault();
  const emailEl = document.getElementById('quick-code-email');
  const inputEl = document.getElementById('quick-code-input');
  const email = emailEl ? emailEl.value.trim().toLowerCase() : '';
  const code = inputEl ? inputEl.value.trim() : '';
  const errEl = document.getElementById('quick-code-error');
  const btn = document.getElementById('quick-code-submit-btn');

  if (!email || !email.includes('@')) {
    if (errEl) {
      errEl.textContent = "Ingresa el correo electrónico de tu cuenta.";
      errEl.classList.remove('hidden');
    }
    return;
  }

  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
    if (errEl) {
      errEl.textContent = "El código debe contener exactamente 6 números.";
      errEl.classList.remove('hidden');
    }
    return;
  }

  if (errEl) errEl.classList.add('hidden');
  if (btn) {
    btn.disabled = true;
    btn.querySelector('span')?.classList.add('hidden');
    btn.querySelector('.btn-spinner')?.classList.remove('hidden');
  }

  try {
    let matchedProfile = null;

    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
      throw new Error("Se requiere conexión activa a internet para verificar códigos de un solo uso.");
    }

    // 1. Intentar validación atómica en servidor vía RPC
    try {
      const { data: rpcRes, error: rpcErr } = await supabaseClient.rpc('verify_quick_code_login', {
        p_email: email,
        p_code: code
      });
      if (!rpcErr && rpcRes && typeof rpcRes === 'object') {
        if (!rpcRes.ok) {
          throw new Error("Código inválido o expirado. Genera uno nuevo en Opciones Avanzadas.");
        }
        matchedProfile = rpcRes.profile;
      }
    } catch (rpcCatch) {
      if (rpcCatch && rpcCatch.message && rpcCatch.message.includes('Código inválido')) {
        throw rpcCatch;
      }
    }

    // 2. Fallback acotado si el RPC aún no está desplegado en Supabase (nunca SELECT * de todos los usuarios)
    if (!matchedProfile) {
      const { data: dbMatch, error: dbErr } = await supabaseClient
        .from('profiles')
        .select('id, email, name, family_id, role, quick_code, quick_code_expires_at')
        .ilike('email', email)
        .eq('quick_code', code)
        .maybeSingle();

      if (dbErr) throw dbErr;

      if (dbMatch) {
        if (dbMatch.family_id === 'BLOCKED') {
          throw new Error("Acceso denegado: esta cuenta ha sido bloqueada.");
        }
        const expMs = dbMatch.quick_code_expires_at ? new Date(dbMatch.quick_code_expires_at).getTime() : 0;
        if (!expMs || Date.now() > expMs) {
          // Limpiar código expirado
          await supabaseClient.from('profiles').update({ quick_code: null, quick_code_expires_at: null }).eq('id', dbMatch.id);
          throw new Error("El código de 6 dígitos ha expirado. Genera uno nuevo.");
        }

        // Invalidar código inmediatamente (un solo uso)
        await supabaseClient
          .from('profiles')
          .update({ quick_code: null, quick_code_expires_at: null })
          .eq('id', dbMatch.id);

        matchedProfile = dbMatch;
      }
    }

    if (!matchedProfile) {
      throw new Error("Correo o código de 6 dígitos inválido o expirado. Genera uno nuevo en Opciones Avanzadas.");
    }

    // Iniciar sesión exitosamente con la cuenta identificada por correo + código de un solo uso
    const session = {
      name: matchedProfile.name || matchedProfile.email,
      email: matchedProfile.email,
      avatar: (matchedProfile.avatar || matchedProfile.name || 'U')[0].toUpperCase(),
      provider: 'quick_code',
      accountId: matchedProfile.id,
      familyId: matchedProfile.family_id || null,
      role: matchedProfile.role || null,
      lastOnlineValidation: Date.now()
    };

    if (typeof calculateSecureChecksum === 'function') {
      session.signature = calculateSecureChecksum(session.accountId, session.email, session.familyId);
    }

    localStorage.setItem('recim_session', JSON.stringify(session));
    if (typeof BiometricAuthManager !== 'undefined') {
      await BiometricAuthManager.saveSessionToSQLite(session);
    }

    closeQuickCodeLoginModal();

    if (typeof initApp === 'function') {
      initApp(session);
    } else {
      window.location.reload();
    }
  } catch (err) {
    if (errEl) {
      errEl.textContent = err.message || "Error al verificar código.";
      errEl.classList.remove('hidden');
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.querySelector('span')?.classList.remove('hidden');
      btn.querySelector('.btn-spinner')?.classList.add('hidden');
    }
  }
}

window.generateSecureQuickCode = generateSecureQuickCode;
window.calculate6DigitQuickCode = calculate6DigitQuickCode;
window.openQuickCodeLoginModal = openQuickCodeLoginModal;
window.closeQuickCodeLoginModal = closeQuickCodeLoginModal;
window.handleQuickCodeLoginSubmit = handleQuickCodeLoginSubmit;

// Inicializar y vincular eventos al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  BiometricAuthManager.syncQuickLoginStateFromSQLiteOrDB();
  BiometricAuthManager.isBiometricAvailable().then((available) => {
    const bioBtn = document.getElementById('biometric-login-btn');
    if (bioBtn && !available) {
      console.log("ℹ️ Autenticación biométrica lista.");
    }
  });
});

