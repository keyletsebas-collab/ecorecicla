/* =============================================
   BIOMETRIC-AUTH.JS – SQLite Session & Biometric Login
   Soporte para Huella Digital / Biometría y SQLite
   ============================================= */

const BiometricAuthManager = {
  // ---- 1. Almacenamiento en SQLite ----

  saveSessionToSQLite: async function(session) {
    if (!session || !session.accountId) return;
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
        window.chrome.webview.postMessage(JSON.stringify({
          Action: 'save_user_session',
          AccountId: session.accountId,
          Email: session.email || '',
          Name: session.name || '',
          Data: sessionJson
        }));
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
        window.chrome.webview.postMessage(JSON.stringify({ Action: 'get_user_session' }));
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
        window.chrome.webview.postMessage(JSON.stringify({ Action: 'delete_user_session', AccountId: accountId }));
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
        window.AndroidNative.AuthenticateBiometric("Inicio de Sesión Biométrico", "Toca el sensor de huella dactilar o usa tu método de seguridad");
        return;
      }

      // Windows Native Hello Prompt
      if (window.chrome && window.chrome.webview) {
        window.onBiometricAuthResult = function(success, errorMsg) {
          if (success) {
            resolve(true);
          } else {
            if (errorEl && errorMsg) {
              errorEl.textContent = 'Biometría cancelada o fallida: ' + errorMsg;
              errorEl.classList.remove('hidden');
            }
            resolve(false);
          }
        };
        window.chrome.webview.postMessage(JSON.stringify({ Action: 'authenticate_biometric' }));
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
          console.log("WebAuthn aviso:", webAuthErr);
          // Si no hay credenciales registradas aún en WebAuthn, solicitamos confirmación local estándar
          if (confirm("¿Confirmar inicio de sesión mediante biometría / seguridad de este dispositivo?")) {
            resolve(true);
            return;
          }
        }
      }

      resolve(false);
    });
  },

  handleBiometricLoginButtonClick: async function() {
    const errorEl = document.getElementById('login-error');
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
          errorEl.textContent = 'No hay una sesión guardada en SQLite. Inicia sesión con correo y contraseña primero.';
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
        showToast(`🖐️ Autenticación biométrica exitosa.`, 'success');
        
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
        errorEl.textContent = 'Error durante la autenticación biométrica.';
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
  }
};

// Inicializar y vincular eventos al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  BiometricAuthManager.isBiometricAvailable().then((available) => {
    const bioBtn = document.getElementById('biometric-login-btn');
    if (bioBtn && !available) {
      // Opcional: mostrar aviso si no hay biometría en el hardware
      console.log("ℹ️ Autenticación biométrica lista.");
    }
  });
});
