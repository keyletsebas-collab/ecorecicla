/* =============================================
   AUTH.JS – Login / Signup logic
   Multi-user: cada credencial = cuenta separada
   Force rebuild: 2026-05-31
   ============================================= */

// ---- Logout on App Close ----
// (Desactivado para mantener la sesión abierta en Android y PWA)
/*
if (!sessionStorage.getItem('app_has_been_opened')) {
    localStorage.removeItem('recim_session');
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
            localStorage.removeItem(key);
        }
    }
    sessionStorage.setItem('app_has_been_opened', 'true');
}
*/

// ---- Per-user storage key helper ----
// All app data is namespaced under the current user's accountId.
// Usage: localStorage.getItem(userKey('recim_invoices'))
function userKey(baseKey) {
  try {
    const session = localStorage.getItem('recim_session');
    if (session) {
      const user = JSON.parse(session);
      if (user && user.accountId) {
        if (typeof calculateSecureChecksum === 'function') {
          const expectedSig = calculateSecureChecksum(user.accountId, user.email, user.familyId);
          if (user.signature !== expectedSig) {
            // Auto-heal signature smoothly without logging the user out
            user.signature = expectedSig;
            try {
              localStorage.setItem('recim_session', JSON.stringify(user));
            } catch (_) {}
          }
        }
        const scope = user.familyId ? `family_${user.familyId}` : user.accountId;
        return `${baseKey}_${scope}`;
      }
    }
  } catch (e) {
    console.error('Error in userKey:', e);
  }
  return baseKey;
}

// Helper to safely update session properties and keep the cryptographic signature in sync
function updateCurrentSession(updates) {
  try {
    const raw = localStorage.getItem('recim_session');
    if (!raw) return null;
    const session = JSON.parse(raw);
    Object.assign(session, updates);
    if (session.accountId && typeof calculateSecureChecksum === 'function') {
      session.signature = calculateSecureChecksum(session.accountId, session.email, session.familyId);
    }
    localStorage.setItem('recim_session', JSON.stringify(session));
    return session;
  } catch (e) {
    console.error('Error updating session:', e);
    return null;
  }
}
window.updateCurrentSession = updateCurrentSession;

// ---- Secure password hashing (SHA-256) ----
async function hashPasswordSHA256(password) {
  try {
    if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
      const msgBuffer = new TextEncoder().encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } else {
      throw new Error("crypto.subtle is not available");
    }
  } catch (e) {
    console.warn('Fallo en crypto nativo, usando SHA-256 fallback:', e);
    return fallbackSHA256(password);
  }
}

// Pure JS SHA-256 para entornos HTTP locales (cuando crypto.subtle falla)
function fallbackSHA256(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  let mathPow = Math.pow;
  let maxWord = mathPow(2, 32);
  let result = '';
  let words = [];
  let asciiBitLength = ascii.length * 8;
  
  let hash = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
  let k = [1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298];
  
  ascii += '\x80';
  while (ascii.length % 64 - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    let j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words.length] = ((asciiBitLength / maxWord) | 0);
  words[words.length] = (asciiBitLength);
  
  for (let j = 0; j < words.length;) {
    let w = words.slice(j, j += 16);
    let oldHash = hash;
    hash = hash.slice(0, 8);
    for (let i = 0; i < 64; i++) {
      let w15 = w[i - 15], w2 = w[i - 2];
      let a = hash[0], e = hash[4];
      let temp1 = hash[7] + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] + (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0);
      let temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      let b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? 0 : '') + b.toString(16);
    }
  }
  return result;
}

// ---- Tab switching ----
function switchAuthTab(tab) {
  const loginForm = document.getElementById('form-login');
  const signupForm = document.getElementById('form-signup');
  const forgotForm = document.getElementById('form-forgot');
  const signupVerifyForm = document.getElementById('signup-step-verify');
  const signupOnboardingForm = document.getElementById('signup-step-onboarding');
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');

  if (forgotForm) forgotForm.classList.add('hidden');
  if (signupVerifyForm) signupVerifyForm.classList.add('hidden');
  if (signupOnboardingForm) signupOnboardingForm.classList.add('hidden');

  // Make sure tabs are visible
  const tabsContainer = document.querySelector('.auth-tabs');
  if (tabsContainer) tabsContainer.classList.remove('hidden');

  if (tab === 'login') {
    if (loginForm) loginForm.classList.remove('hidden');
    if (signupForm) signupForm.classList.add('hidden');
    if (tabLogin) tabLogin.classList.add('auth-tab--active');
    if (tabSignup) tabSignup.classList.remove('auth-tab--active');
    if (typeof checkShowSavedAccountModal === 'function') {
      setTimeout(checkShowSavedAccountModal, 150);
    }
  } else {
    if (signupForm) signupForm.classList.remove('hidden');
    if (loginForm) loginForm.classList.add('hidden');
    if (tabSignup) tabSignup.classList.add('auth-tab--active');
    if (tabLogin) tabLogin.classList.remove('auth-tab--active');
  }
}

// ---- Password toggle ----
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

// =============================================
// EMAIL / PHONE LOGIN
// =============================================

async function handleLogin(evt) {
  evt.preventDefault();
  const identifier = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  const resetBtn = () => {
    btn.querySelector('span')?.classList.remove('hidden');
    btn.querySelector('.btn-spinner')?.classList.add('hidden');
    btn.disabled = false;
  };

  errorEl.classList.add('hidden');

  btn.querySelector('span').classList.add('hidden');
  btn.querySelector('.btn-spinner').classList.remove('hidden');
  btn.disabled = true;

  setTimeout(async () => {
    try {
      if (!isSupabaseActive || !supabaseClient) {
        throw new Error("Supabase no está inicializado o no hay conexión de red.");
      }

      const secureHash = await hashPasswordSHA256(password);
      const legacyB64 = btoa(password);
      let data = null;

      // 1. Intentar validación blindada en servidor vía RPC (oculta hashes de contraseñas de la red)
      const { data: rpcRes, error: rpcErr } = await supabaseClient.rpc('verify_user_login', {
        p_email: identifier,
        p_password_hash: secureHash,
        p_legacy_b64: legacyB64
      });

      if (!rpcErr && rpcRes && typeof rpcRes === 'object') {
        if (!rpcRes.ok) {
          if (rpcRes.reason === 'not_found') {
            errorEl.textContent = 'No existe una cuenta con ese correo.';
          } else if (rpcRes.reason === 'blocked') {
            errorEl.textContent = 'Acceso denegado: tu cuenta ha sido bloqueada por el administrador.';
          } else {
            errorEl.textContent = 'Contraseña incorrecta.';
          }
          errorEl.classList.remove('hidden');
          resetBtn();
          return;
        }
        data = rpcRes.profile;
      } else {
        // 2. Fallback compatible mientras se aplica supabase_security_hardening.sql en el editor SQL
        const { data: rowData, error } = await supabaseClient
          .from('profiles')
          .select('*')
          .eq('email', identifier)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!rowData) {
          errorEl.textContent = 'No existe una cuenta con ese correo.';
          errorEl.classList.remove('hidden');
          resetBtn();
          return;
        }

        if (rowData.family_id === 'BLOCKED') {
          errorEl.textContent = 'Acceso denegado: tu cuenta ha sido bloqueada por el administrador.';
          errorEl.classList.remove('hidden');
          resetBtn();
          return;
        }

        let isValid = false;
        let needsMigration = false;

        if (rowData.password === secureHash) {
          isValid = true;
        } else if (rowData.password === legacyB64) {
          isValid = true;
          needsMigration = true;
        }

        if (!isValid) {
          errorEl.textContent = 'Contraseña incorrecta.';
          errorEl.classList.remove('hidden');
          resetBtn();
          return;
        }

        if (needsMigration) {
          try {
            await supabaseClient
              .from('profiles')
              .update({ password: secureHash })
              .eq('id', rowData.id);
          } catch (_) {}
        }
        data = rowData;
      }

      const session = {
        name: data.name,
        email: data.email,
        avatar: (data.avatar || data.name || 'U')[0].toUpperCase(),
        provider: 'email',
        accountId: data.id,
        familyId: data.family_id || null,
        role: data.role || null,
        lastOnlineValidation: Date.now()
      };

      if (typeof calculateSecureChecksum === 'function') {
        session.signature = calculateSecureChecksum(session.accountId, session.email, session.familyId);
      }

      // Guardar sesión en localStorage y SQLite
      localStorage.setItem('recim_session', JSON.stringify(session));
      try {
        localStorage.setItem('recim_saved_account', JSON.stringify({
          name: data.name,
          email: data.email,
          avatar: session.avatar,
          role: data.role || 'Usuario'
        }));
      } catch (_) {}
      if (typeof BiometricAuthManager !== 'undefined') {
        BiometricAuthManager.saveSessionToSQLite(session);
      }
      showToast(`✅ Bienvenido de nuevo, ${data.name}`, 'success');
      
      resetBtn();
      initApp(session);
    } catch (err) {
      console.error('Login error:', err);
      resetBtn();
      errorEl.textContent = 'Error al iniciar sesión: ' + (err.message || err);
      errorEl.classList.remove('hidden');
    }
  }, 800);
}

function _generateSecure6DigitCode() {
  try {
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      return (100000 + (arr[0] % 900000)).toString();
    }
  } catch (_) {}
  return Math.floor(100000 + Math.random() * 900000).toString();
}

let _signupLegalAccepted = false;
let _signupLegalAcceptedAt = null;
let _signupLegalAutoSubmit = false;

function _updateSignupLegalBadge(accepted) {
  const cb = document.getElementById('signup-accept-legal');
  const badge = document.getElementById('signup-legal-status-badge');
  if (cb) cb.checked = !!accepted;
  if (badge) {
    if (accepted) {
      badge.textContent = '✅ Leído y aceptado';
      badge.style.background = 'rgba(16, 185, 129, 0.18)';
      badge.style.borderColor = 'rgba(16, 185, 129, 0.5)';
      badge.style.color = '#6ee7b7';
    } else {
      badge.textContent = 'Pendiente de lectura';
      badge.style.background = 'rgba(245, 158, 11, 0.16)';
      badge.style.borderColor = 'rgba(245, 158, 11, 0.45)';
      badge.style.color = '#fcd34d';
    }
  }
}

function closeSignupLegalConsentModal() {
  const existing = document.getElementById('signup-legal-consent-modal');
  if (existing) existing.remove();
}

function openSignupLegalConsentModal(options = {}) {
  _signupLegalAutoSubmit = !!(options && options.autoSubmitOnAccept);
  closeSignupLegalConsentModal();

  const overlay = document.createElement('div');
  overlay.id = 'signup-legal-consent-modal';
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; z-index:100001; background:rgba(2, 6, 4, 0.84); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; padding:14px;';

  overlay.innerHTML = `
    <div style="width:100%; max-width:620px; max-height:90dvh; display:flex; flex-direction:column; background:linear-gradient(165deg, #101f17 0%, #07110c 100%); border:1px solid rgba(52, 211, 153, 0.4); border-radius:20px; box-shadow:0 24px 60px rgba(0,0,0,0.85); overflow:hidden; color:#e2e8f0; font-family:'Inter',system-ui,sans-serif;">
      <div style="padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:space-between; gap:10px; flex-shrink:0;">
        <div>
          <h3 style="margin:0; font-size:1.05rem; font-weight:700; color:#ffffff;">📜 Términos, Condiciones y Política de Privacidad</h3>
          <p style="margin:3px 0 0 0; font-size:0.76rem; color:#94a3b8;">Lee el documento completo antes de crear tu cuenta en Reciminsaap.</p>
        </div>
        <button type="button" onclick="closeSignupLegalConsentModal()" aria-label="Cerrar" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#cbd5e1; width:32px; height:32px; border-radius:8px; cursor:pointer; font-size:1rem;">✕</button>
      </div>

      <div style="padding:10px 20px; background:rgba(16, 185, 129, 0.06); border-bottom:1px solid rgba(255,255,255,0.06); display:flex; gap:8px; flex-wrap:wrap; flex-shrink:0;">
        <button type="button" id="legal-jump-terms" style="padding:5px 11px; border-radius:8px; border:1px solid rgba(52,211,153,0.35); background:rgba(16,185,129,0.14); color:#6ee7b7; font-size:0.74rem; font-weight:600; cursor:pointer;">⚖️ Términos y Condiciones (EULA)</button>
        <button type="button" id="legal-jump-privacy" style="padding:5px 11px; border-radius:8px; border:1px solid rgba(52,211,153,0.35); background:rgba(16,185,129,0.14); color:#6ee7b7; font-size:0.74rem; font-weight:600; cursor:pointer;">🔒 Política de Privacidad (Ley 172-13)</button>
      </div>

      <div id="signup-legal-scroll-box" style="padding:16px 20px; overflow-y:auto; flex:1; max-height:48vh; font-size:0.83rem; line-height:1.6; color:#cbd5e1; display:flex; flex-direction:column; gap:12px;">
        <section id="legal-sec-terms" style="display:flex; flex-direction:column; gap:8px;">
          <h4 style="margin:0; color:#6ee7b7; font-size:0.95rem; border-left:3px solid #10b981; padding-left:8px;">I. Términos y Condiciones de Uso (EULA – Versión 2026-11)</h4>
          <p style="margin:0;">Al crear una cuenta o usar <b>Reciminsaap</b> (Web, PWA, Android o Windows), usted acepta quedar vinculado por este Contrato de Licencia de Usuario Final (EULA) con <b>Reciminsa S.R.L.</b> (República Dominicana).</p>
          <p style="margin:0;"><b>1. Licencia Limitada y Prohibiciones:</b> Se otorga una licencia limitada, no exclusiva, revocable e intransferible para uso comercial/operativo autorizado. Queda prohibido copiar, descompilar, realizar ingeniería inversa, revender sin autorización, suplantar la identidad de otras empresas o intentar eludir controles de licencia y seguridad.</p>
          <p style="margin:0;"><b>2. Exclusión de Asesoría Fiscal, Contable y Legal (DGII):</b> Reciminsaap es una herramienta informática auxiliar y <b>no presta asesoría contable, tributaria ni jurídica</b>. El usuario y su empresa son los <b>únicos y exclusivos responsables</b> de configurar correctamente su propio RNC, razón social, domicilio fiscal y secuencias NCF autorizadas antes de emitir facturas, cotizaciones, conduces, notas de crédito/débito o borradores 606, 607 y 608, debiendo validarlos con un Contador Público Autorizado (CPA) antes de presentar declaraciones ante la DGII.</p>
          <p style="margin:0;"><b>3. Carácter Estimativo de Constancias Ambientales y ReciBot:</b> Los cálculos de CO₂ evitado, árboles, energía, agua y las constancias PDF emitidas son <b>estimaciones informativas basadas en factores promedio</b> sobre pesos introducidos por el usuario; <b>no constituyen certificaciones oficiales gubernamentales, auditorías ISO ni créditos de carbono negociables</b>. Asimismo, las respuestas del asistente ReciBot son orientativas y deben verificarse manualmente.</p>
          <p style="margin:0;"><b>4. Uso Corporativo y Sucursales:</b> El administrador (CEO) de cada empresa es responsable de custodiar los códigos de empresa y de sucursal y gestionar los accesos de su equipo.</p>
          <p style="margin:0;"><b>5. Software "TAL CUAL" (AS IS), Responsabilidad e Indemnidad:</b> Conforme a la legislación vigente (incluyendo la Ley No. 358-05), la aplicación se provee "tal cual" y "según disponibilidad", sin garantías implícitas de disponibilidad ininterrumpida. El proveedor no será responsable por daños indirectos, lucro cesante o pérdida de datos; cualquier responsabilidad directa queda limitada al monto efectivamente pagado por la licencia en los últimos 12 meses. El usuario mantendrá indemne al proveedor ante reclamos de terceros derivados de facturación o datos emitidos por el usuario. Rigen las leyes de la República Dominicana y los tribunales de Santo Domingo.</p>
        </section>

        <hr style="border:none; border-top:1px solid rgba(255,255,255,0.1); margin:4px 0;" />

        <section id="legal-sec-privacy" style="display:flex; flex-direction:column; gap:8px;">
          <h4 style="margin:0; color:#6ee7b7; font-size:0.95rem; border-left:3px solid #10b981; padding-left:8px;">II. Política de Privacidad y Protección de Datos (Ley 172-13 / Google Play / Microsoft Store)</h4>
          <p style="margin:0;"><b>1. Responsable y Contacto:</b> Reciminsa S.R.L. (Santo Domingo, R.D.) · Correo de privacidad y soporte: <a href="mailto:soporte@reciminsa.com" style="color:#34d399;">soporte@reciminsa.com</a>. Servicio dirigido a mayores de 18 años y empresas.</p>
          <p style="margin:0;"><b>2. Datos Recopilados y Uso de Identificador de Dispositivo:</b> Recopilamos nombre, correo, contraseña protegida mediante hash, rol corporativo, datos operativos/fiscales que registre su empresa, fecha/versión de aceptación legal e identificadores técnicos de dispositivo (<code>ANDROID_ID</code> en Android, identificador técnico local en Windows/PC o huella de navegador) usados <b>exclusivamente</b> para auditoría corporativa de accesos, prevención de fraude y control de licencias. <b>Nunca se utilizan para publicidad ni rastreo entre aplicaciones.</b></p>
          <p style="margin:0;"><b>3. Encargados y Seguridad:</b> La sincronización se realiza mediante Supabase y hosting seguro bajo cifrado HTTPS/TLS. No vendemos ni alquilamos datos personales a terceros.</p>
          <p style="margin:0;"><b>4. Derechos ARCO y Eliminación de Cuenta:</b> Puede ejercer sus derechos de Acceso, Rectificación, Cancelación y Oposición o eliminar permanentemente su cuenta en cualquier momento desde <b>Ajustes → Cuenta → Eliminar Cuenta</b> o escribiendo a <a href="mailto:soporte@reciminsa.com" style="color:#34d399;">soporte@reciminsa.com</a>.</p>
        </section>

        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:10px 12px; font-size:0.78rem; display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;">
          <span>Documentos completos:</span>
          <span>
            <a href="terminos.html" target="_blank" rel="noopener noreferrer" style="color:#34d399; text-decoration:underline; margin-right:10px;">Abrir Términos</a>
            <a href="privacidad.html" target="_blank" rel="noopener noreferrer" style="color:#34d399; text-decoration:underline;">Abrir Privacidad</a>
          </span>
        </div>
      </div>

      <div style="padding:14px 20px; border-top:1px solid rgba(255,255,255,0.08); background:rgba(4, 10, 7, 0.9); display:flex; flex-direction:column; gap:10px; flex-shrink:0;">
        <div id="signup-legal-scroll-hint" style="font-size:0.76rem; font-weight:600; color:#fcd34d; display:flex; align-items:center; gap:6px;">
          ⬇️ Desliza hasta el final del documento para habilitar la aceptación
        </div>

        <label style="display:flex; align-items:flex-start; gap:9px; cursor:pointer; font-size:0.8rem; color:#e2e8f0; line-height:1.4; margin:0;">
          <input type="checkbox" id="modal-confirm-legal-read" disabled style="margin-top:2px; width:17px; height:17px; accent-color:#10b981; flex-shrink:0;" />
          <span>He leído en su totalidad y acepto los <b>Términos y Condiciones (EULA)</b> y la <b>Política de Privacidad</b>.</span>
        </label>

        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button type="button" onclick="closeSignupLegalConsentModal()" style="flex:1; min-width:120px; padding:10px 14px; border-radius:11px; border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.05); color:#cbd5e1; font-weight:600; font-size:0.84rem; cursor:pointer;">
            No acepto / Cancelar
          </button>
          <button type="button" id="signup-legal-accept-btn" disabled style="flex:1.4; min-width:160px; padding:10px 14px; border-radius:11px; border:1px solid rgba(52,211,153,0.4); background:linear-gradient(135deg,#10b981,#059669); color:#ffffff; font-weight:700; font-size:0.86rem; cursor:not-allowed; opacity:0.45;">
            ✅ Aceptar y Continuar
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const scrollBox = document.getElementById('signup-legal-scroll-box');
  const hintEl = document.getElementById('signup-legal-scroll-hint');
  const readCb = document.getElementById('modal-confirm-legal-read');
  const acceptBtn = document.getElementById('signup-legal-accept-btn');
  const jumpTermsBtn = document.getElementById('legal-jump-terms');
  const jumpPrivacyBtn = document.getElementById('legal-jump-privacy');

  let hasReachedBottom = false;

  const syncAcceptButton = () => {
    const canAccept = hasReachedBottom && !!(readCb && readCb.checked);
    if (acceptBtn) {
      acceptBtn.disabled = !canAccept;
      acceptBtn.style.opacity = canAccept ? '1' : '0.45';
      acceptBtn.style.cursor = canAccept ? 'pointer' : 'not-allowed';
    }
  };

  const checkScrollReachedBottom = () => {
    if (!scrollBox || hasReachedBottom) return;
    if (scrollBox.scrollTop + scrollBox.clientHeight >= scrollBox.scrollHeight - 24) {
      hasReachedBottom = true;
      if (hintEl) {
        hintEl.textContent = '✅ Has llegado al final del documento. Marca la casilla para aceptar.';
        hintEl.style.color = '#6ee7b7';
      }
      if (readCb) {
        readCb.disabled = false;
      }
      syncAcceptButton();
    }
  };

  if (scrollBox) {
    scrollBox.addEventListener('scroll', checkScrollReachedBottom, { passive: true });
    setTimeout(checkScrollReachedBottom, 60);
  }

  if (readCb) {
    if (_signupLegalAccepted) {
      hasReachedBottom = true;
      readCb.disabled = false;
      readCb.checked = true;
      if (hintEl) {
        hintEl.textContent = '✅ Documento revisado y aceptado.';
        hintEl.style.color = '#6ee7b7';
      }
      syncAcceptButton();
    }
    readCb.addEventListener('change', syncAcceptButton);
  }

  if (jumpTermsBtn) {
    jumpTermsBtn.onclick = () => {
      document.getElementById('legal-sec-terms')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }
  if (jumpPrivacyBtn) {
    jumpPrivacyBtn.onclick = () => {
      document.getElementById('legal-sec-privacy')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }

  if (acceptBtn) {
    acceptBtn.onclick = () => {
      if (!hasReachedBottom || !readCb || !readCb.checked) return;
      _signupLegalAccepted = true;
      _signupLegalAcceptedAt = new Date().toISOString();
      _updateSignupLegalBadge(true);

      const errEl = document.getElementById('signup-error');
      if (errEl) errEl.classList.add('hidden');

      const shouldAutoSubmit = _signupLegalAutoSubmit;
      closeSignupLegalConsentModal();

      if (shouldAutoSubmit) {
        const signupForm = document.getElementById('form-signup');
        if (signupForm) {
          handleSignup({ preventDefault: () => {} });
        }
      }
    };
  }
}

window.openSignupLegalConsentModal = openSignupLegalConsentModal;
window.closeSignupLegalConsentModal = closeSignupLegalConsentModal;

async function handleSignup(evt) {
  if (evt && typeof evt.preventDefault === 'function') evt.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const identity = document.getElementById('signup-email').value.trim().toLowerCase();
  const password = document.getElementById('signup-password').value;
  const legalCb = document.getElementById('signup-accept-legal');
  const errorEl = document.getElementById('signup-error');
  const btn = document.getElementById('signup-btn');

  const resetBtn = () => {
    btn.querySelector('span')?.classList.remove('hidden');
    btn.querySelector('.btn-spinner')?.classList.add('hidden');
    btn.disabled = false;
  };

  errorEl.classList.add('hidden');

  if (!name || !identity || !password) {
    errorEl.textContent = 'Por favor completa todos los campos.';
    errorEl.classList.remove('hidden');
    return;
  }

  if (password.length < 6) {
    errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
    errorEl.classList.remove('hidden');
    return;
  }

  if (!_signupLegalAccepted || (legalCb && !legalCb.checked)) {
    errorEl.textContent = 'Debes leer hasta el final y aceptar los Términos y Condiciones y la Política de Privacidad.';
    errorEl.classList.remove('hidden');
    openSignupLegalConsentModal({ autoSubmitOnAccept: true });
    return;
  }

  btn.querySelector('span').classList.add('hidden');
  btn.querySelector('.btn-spinner').classList.remove('hidden');
  btn.disabled = true;

  setTimeout(async () => {
    try {
      if (!isSupabaseActive || !supabaseClient) {
        throw new Error("Supabase no está inicializado o no hay conexión de red.");
      }

      // Check if email already exists in Supabase profiles
      const { data: exists, error: checkError } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('email', identity)
        .maybeSingle();

      if (checkError) {
        throw checkError;
      }

      if (exists) {
        errorEl.textContent = 'Ya existe una cuenta con ese correo. Inicia sesión.';
        errorEl.classList.remove('hidden');
        resetBtn();
        return;
      }

      // Generate CSPRNG 6 digit activation code
      const verificationCode = _generateSecure6DigitCode();

      // Store signup details temporarily in localStorage
      const signupData = {
        name,
        email: identity,
        password,
        code: verificationCode,
        attempts: 0,
        termsAcceptedAt: _signupLegalAcceptedAt || new Date().toISOString(),
        privacyVersion: '2026-11',
        expiresAt: Date.now() + 15 * 60 * 1000
      };
      localStorage.setItem('recim_signup_pending', JSON.stringify(signupData));

      // Send Gmail verification (fail-closed: nunca exponer el código OTP en consola o toast)
      const emailSent = await sendSignupVerificationEmail(identity, verificationCode, name);

      if (!emailSent) {
        localStorage.removeItem('recim_signup_pending');
        throw new Error('No se pudo enviar el código de activación por correo. Verifica tu conexión e inténtalo de nuevo.');
      }

      showToast('✉️ Código de activación enviado a tu correo.', 'success');

      // Go to verification step
      document.getElementById('form-signup').classList.add('hidden');
      
      const authTabs = document.querySelector('.auth-tabs');
      if (authTabs) authTabs.classList.add('hidden');
      
      const stepVerify = document.getElementById('signup-step-verify');
      if (stepVerify) {
        stepVerify.classList.remove('hidden');
        document.getElementById('signup-verification-code').value = '';
        document.getElementById('signup-verify-error').classList.add('hidden');
        document.getElementById('signup-verification-code').focus();
      }

      resetBtn();
    } catch (err) {
      console.error('Signup error:', err);
      resetBtn();
      errorEl.textContent = 'Error al registrar cuenta: ' + (err.message || err);
      errorEl.classList.remove('hidden');
    }
  }, 900);
}

// =============================================
// SIGNUP EMAIL VERIFICATION HANDLERS
// =============================================

async function sendSignupVerificationEmail(email, code, userName) {
  const scriptUrl = getAppsScriptUrl();
  if (!scriptUrl) return false;

  const htmlBody = `
    <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: #0c0f0a; color: #e2e8f0; padding: 40px 20px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #1f2937; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #22c55e; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.04em;">Reciminsa App</h1>
        <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 14px; letter-spacing: 0.05em;">GESTIÓN INTELIGENTE DE RECICLAJE</p>
      </div>
      <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 30px; margin-bottom: 25px;">
        <h2 style="color: #ffffff; margin-top: 0; font-size: 20px; font-weight: 600; text-align: center;">Activación de Cuenta</h2>
        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; text-align: center;">
          ¡Bienvenido a Reciminsa App, <strong>${window.escapeHtml ? window.escapeHtml(userName) : userName}</strong>! Estamos encantados de tenerte con nosotros.
        </p>
        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; text-align: center; margin-bottom: 25px;">
          Para completar tu registro y activar tu cuenta, utiliza el siguiente código de activación de 6 dígitos. Este código es válido por <strong>15 minutos</strong>.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="display: inline-block; background-color: rgba(34, 197, 94, 0.1); border: 2px dashed #22c55e; border-radius: 8px; padding: 15px 40px; font-size: 32px; font-weight: 800; color: #4ade80; letter-spacing: 0.25em; text-align: center;">
            ${code}
          </div>
        </div>
        <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; text-align: center; margin-top: 25px;">
          Si no solicitaste la creación de esta cuenta, puedes ignorar este correo de forma segura.
        </p>
      </div>
      <div style="text-align: center; color: #64748b; font-size: 12px;">
        <p style="margin: 0;">© ${new Date().getFullYear()} RECIMINSA S.R.L. Todos los derechos reservados.</p>
        <p style="margin: 5px 0 0 0;">Este es un correo automático de seguridad, por favor no respondas a este mensaje.</p>
      </div>
    </div>
  `;

  const textBody = `¡Hola, ${userName}! Bienvenido a Reciminsa App. Tu código de activación de cuenta es: ${code}. Este código expira en 15 minutos.`;

  try {
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        appToken: APP_SECURITY_TOKEN,
        to: email,
        subject: 'Activa tu Cuenta en Reciminsa App',
        textBody: textBody,
        htmlBody: htmlBody
      })
    });
    console.log("🚀 Petición de correo de activación enviada (modo no-cors).");
    return true;
  } catch (err) {
    console.error("❌ Error de red enviando correo de activación:", err);
    return false;
  }
}

// Handle confirmation and insert into Supabase profiles
async function handleVerifySignup(evt) {
  if (evt) evt.preventDefault();

  const codeInput = document.getElementById('signup-verification-code').value.trim();
  const errorEl = document.getElementById('signup-verify-error');
  const btn = document.getElementById('signup-verify-btn');

  errorEl.classList.add('hidden');

  const pendingStr = localStorage.getItem('recim_signup_pending');
  if (!pendingStr) {
    errorEl.textContent = 'Registro no válido o expirado. Vuelve a intentarlo.';
    errorEl.classList.remove('hidden');
    return;
  }

  const pending = JSON.parse(pendingStr);

  if (Date.now() > pending.expiresAt) {
    errorEl.textContent = 'El código ha expirado (límite 15 mins). Regresa al registro.';
    errorEl.classList.remove('hidden');
    return;
  }

  const cleanInput = codeInput.replace(/\D/g, '');
  const cleanStored = pending.code.replace(/\D/g, '');

  if (!cleanInput || cleanInput !== cleanStored) {
    pending.attempts = (pending.attempts || 0) + 1;
    if (pending.attempts >= 5) {
      localStorage.removeItem('recim_signup_pending');
      errorEl.textContent = 'Demasiados intentos fallidos. Solicita un nuevo código.';
    } else {
      localStorage.setItem('recim_signup_pending', JSON.stringify(pending));
      errorEl.textContent = `Código incorrecto (${5 - pending.attempts} intento(s) restante(s)). Verifica tu correo e inténtalo de nuevo.`;
    }
    errorEl.classList.remove('hidden');
    return;
  }

  // Code verified! Proceed to insert profile into Supabase profiles table
  const resetBtn = () => {
    btn.querySelector('span')?.classList.remove('hidden');
    btn.querySelector('.btn-spinner')?.classList.add('hidden');
    btn.disabled = false;
  };

  btn.querySelector('span').classList.add('hidden');
  btn.querySelector('.btn-spinner').classList.remove('hidden');
  btn.disabled = true;

  try {
    const accountId = `ACC-${Date.now()}`;
    const securePassword = await hashPasswordSHA256(pending.password);
    const newProfile = {
      id: accountId,
      name: pending.name,
      email: pending.email,
      password: securePassword,
      avatar: pending.name[0].toUpperCase(),
      family_id: null,
      created_at: new Date().toISOString()
    };

    // Insert new profile into Supabase
    const { error: insertError } = await supabaseClient
      .from('profiles')
      .insert([newProfile]);

    if (insertError) throw insertError;

    // Registrar consentimiento legal en columnas opcionales (si ya fueron migradas en Supabase)
    try {
      await supabaseClient
        .from('profiles')
        .update({
          terms_accepted_at: pending.termsAcceptedAt || new Date().toISOString(),
          privacy_version: pending.privacyVersion || '2026-11'
        })
        .eq('id', accountId);
    } catch (_) {}

    const session = {
      name: pending.name,
      email: pending.email,
      avatar: pending.name[0].toUpperCase(),
      provider: 'email',
      accountId: accountId,
      familyId: null,
      termsAcceptedAt: pending.termsAcceptedAt || new Date().toISOString(),
      privacyVersion: pending.privacyVersion || '2026-11',
      onboardingPending: true,
      lastOnlineValidation: Date.now()
    };

    if (typeof calculateSecureChecksum === 'function') {
      session.signature = calculateSecureChecksum(session.accountId, session.email, session.familyId);
    }

    // Save session in localStorage and SQLite
    localStorage.setItem('recim_session', JSON.stringify(session));
    if (typeof BiometricAuthManager !== 'undefined') {
      BiometricAuthManager.saveSessionToSQLite(session);
    }
    localStorage.removeItem('recim_signup_pending');

    showToast('🎉 ¡Cuenta creada! Ahora configura tu empresa.', 'success');

    resetBtn();

    document.getElementById('signup-step-verify').classList.add('hidden');
    openPostSignupOnboardingForm(session);
  } catch (err) {
    console.error('Error finalizando el registro:', err);
    errorEl.textContent = 'Error al crear cuenta: ' + (err.message || err);
    errorEl.classList.remove('hidden');
    resetBtn();
  }
}

// Cancel verification and go back to registration
function cancelSignupVerification(evt) {
  if (evt) evt.preventDefault();
  
  localStorage.removeItem('recim_signup_pending');
  
  document.getElementById('signup-step-verify').classList.add('hidden');
  document.getElementById('form-signup').classList.remove('hidden');
  
  const authTabs = document.querySelector('.auth-tabs');
  if (authTabs) authTabs.classList.remove('hidden');
}

// ---- Logout ----
async function handleLogout() {
  const confirmed = await window.AppDialog.confirm('¿Seguro que deseas cerrar sesión?', 'Cerrar Sesión');
  if (!confirmed) return;

  
  // Mantener la sesión guardada en SQLite para permitir el inicio rápido con Huella / Biometría
  const keysToRemove = [
    'recim_session'
  ];
  keysToRemove.forEach(k => localStorage.removeItem(k));

  document.getElementById('app-screen').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  
  if (typeof _superAdminCheckNavLink === 'function') {
    _superAdminCheckNavLink();
  }
  
  // Reset BOTH login and signup form button states (Resolves Bug 1!)
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) {
    loginBtn.querySelector('span')?.classList.remove('hidden');
    loginBtn.querySelector('.btn-spinner')?.classList.add('hidden');
    loginBtn.disabled = false;
  }
  const signupBtn = document.getElementById('signup-btn');
  if (signupBtn) {
    signupBtn.querySelector('span')?.classList.remove('hidden');
    signupBtn.querySelector('.btn-spinner')?.classList.add('hidden');
    signupBtn.disabled = false;
  }

  showToast('👋 Sesión cerrada', 'success');

  if (typeof BiometricAuthManager !== 'undefined' && typeof BiometricAuthManager.updateBiometricButtonVisibility === 'function') {
    BiometricAuthManager.updateBiometricButtonVisibility();
  }

  if (typeof checkShowSavedAccountModal === 'function') {
    setTimeout(checkShowSavedAccountModal, 350);
  }
}

// =============================================
// PASSWORD RECOVERY FLOW (FORGOT PASSWORD)
// =============================================

// Default Sender Email Configuration
const GMAIL_SENDER = 'Noreplyreciminsasrl@gmail.com';

// Global Google Apps Script Web App URL resuelto desde la bóveda en memoria
function getAppsScriptUrl() {
  return (typeof _unlockVaultSecret === 'function' && _unlockVaultSecret('GAS_URL')) || '';
}
window.getAppsScriptUrl = getAppsScriptUrl;

// 1. Show Recovery Form
function showForgotPasswordForm(evt) {
  if (evt) evt.preventDefault();
  
  const loginForm = document.getElementById('form-login');
  const signupForm = document.getElementById('form-signup');
  const forgotForm = document.getElementById('form-forgot');
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  
  if (loginForm) loginForm.classList.add('hidden');
  if (signupForm) signupForm.classList.add('hidden');
  if (forgotForm) forgotForm.classList.remove('hidden');
  
  if (tabLogin) tabLogin.classList.remove('auth-tab--active');
  if (tabSignup) tabSignup.classList.remove('auth-tab--active');
  
  // Reset steps
  const stepEmail = document.getElementById('forgot-step-email');
  const stepCode = document.getElementById('forgot-step-code');
  const stepReset = document.getElementById('forgot-step-reset');
  
  if (stepEmail) stepEmail.classList.remove('hidden');
  if (stepCode) stepCode.classList.add('hidden');
  if (stepReset) stepReset.classList.add('hidden');
  
  // Clear inputs and errors
  document.getElementById('forgot-email').value = '';
  document.getElementById('forgot-code').value = '';
  document.getElementById('forgot-new-password').value = '';
  
  document.getElementById('forgot-email-error').classList.add('hidden');
  document.getElementById('forgot-code-error').classList.add('hidden');
  document.getElementById('forgot-reset-error').classList.add('hidden');
}

// 2. Back to Login
function backToLogin(evt) {
  if (evt) evt.preventDefault();
  switchAuthTab('login');
}

// 3. Step 1: Handle request verification code
async function handleForgotPassword(evt) {
  evt.preventDefault();
  const emailInput = document.getElementById('forgot-email').value.trim().toLowerCase();
  const errorEl = document.getElementById('forgot-email-error');
  const btn = document.getElementById('forgot-send-btn');
  
  errorEl.classList.add('hidden');
  
  const resetBtn = () => {
    btn.querySelector('span')?.classList.remove('hidden');
    btn.querySelector('.btn-spinner')?.classList.add('hidden');
    btn.disabled = false;
  };
  
  btn.querySelector('span').classList.add('hidden');
  btn.querySelector('.btn-spinner').classList.remove('hidden');
  btn.disabled = true;
  
  setTimeout(async () => {
    try {
      if (!isSupabaseActive || !supabaseClient) {
        throw new Error("Supabase no está inicializado o no hay conexión de red.");
      }
      
      // Query profile (solo columnas mínimas)
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('id, name, email, family_id')
        .eq('email', emailInput)
        .maybeSingle();
        
      if (error) throw error;
      
      if (!data) {
        errorEl.textContent = 'No existe una cuenta registrada con ese correo.';
        errorEl.classList.remove('hidden');
        resetBtn();
        return;
      }

      if (data.family_id === 'BLOCKED') {
        errorEl.textContent = 'Esta cuenta se encuentra suspendida. Contacta al administrador.';
        errorEl.classList.remove('hidden');
        resetBtn();
        return;
      }
      
      // Generate CSPRNG 6 digit code
      const verificationCode = _generateSecure6DigitCode();
      
      // Save code in memory/storage with 10 mins expiration
      const recoverySession = {
        email: emailInput,
        code: verificationCode,
        attempts: 0,
        expiresAt: Date.now() + 10 * 60 * 1000,
        userName: data.name
      };
      
      localStorage.setItem('recim_recovery_session', JSON.stringify(recoverySession));
      
      // Try to send the real Gmail email (fail-closed: nunca exponer el código en pantalla/consola)
      const emailSent = await sendResetEmail(emailInput, verificationCode, data.name);
      
      if (!emailSent) {
        localStorage.removeItem('recim_recovery_session');
        throw new Error('No se pudo contactar el servidor de correo para enviar el código. Inténtalo nuevamente.');
      }

      showToast('✉️ Código enviado con éxito a tu correo.', 'success');
      
      // Go to Step 2
      document.getElementById('forgot-step-email').classList.add('hidden');
      document.getElementById('forgot-step-code').classList.remove('hidden');
      document.getElementById('forgot-code').focus();
      
      resetBtn();
    } catch (err) {
      console.error('Forgot password error:', err);
      errorEl.textContent = 'Error al enviar código: ' + (err.message || err);
      errorEl.classList.remove('hidden');
      resetBtn();
    }
  }, 800);
}

// 4. Send Gmail using Google Apps Script Web App
async function sendResetEmail(email, code, userName) {
  const scriptUrl = getAppsScriptUrl();
  
  // Construct premium HTML body for Gmail
  const htmlBody = `
    <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: #0c0f0a; color: #e2e8f0; padding: 40px 20px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #1f2937; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #22c55e; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.04em;">Reciminsa App</h1>
        <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 14px; letter-spacing: 0.05em;">GESTIÓN INTELIGENTE DE RECICLAJE</p>
      </div>
      <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 30px; margin-bottom: 25px;">
        <h2 style="color: #ffffff; margin-top: 0; font-size: 20px; font-weight: 600; text-align: center;">Recuperación de Contraseña</h2>
        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; text-align: center;">
          Hola, <strong>${window.escapeHtml ? window.escapeHtml(userName) : userName}</strong>. Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en Reciminsa App.
        </p>
        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; text-align: center; margin-bottom: 25px;">
          Utiliza el siguiente código de verificación de un solo uso para continuar. Este código es válido por <strong>10 minutos</strong>.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="display: inline-block; background-color: rgba(34, 197, 94, 0.1); border: 2px dashed #22c55e; border-radius: 8px; padding: 15px 40px; font-size: 32px; font-weight: 800; color: #4ade80; letter-spacing: 0.25em; text-align: center;">
            ${code}
          </div>
        </div>
        <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; text-align: center; margin-top: 25px;">
          Si no solicitaste este cambio, puedes ignorar este correo de forma segura. Tu contraseña seguirá siendo la misma.
        </p>
      </div>
      <div style="text-align: center; color: #64748b; font-size: 12px;">
        <p style="margin: 0;">© ${new Date().getFullYear()} RECIMINSA S.R.L. Todos los derechos reservados.</p>
        <p style="margin: 5px 0 0 0;">Este es un correo automático de seguridad, por favor no respondas a este mensaje.</p>
      </div>
    </div>
  `;
  
  const textBody = `Hola, ${userName}. Tu código de verificación de contraseña para Reciminsa App es: ${code}. Este código expira en 10 minutos.`;
  
  if (!scriptUrl) {
    console.warn("⚠️ No se ha configurado la URL de Google Apps Script.");
    return false;
  }
  
  try {
    // We use mode: 'no-cors' to completely bypass CORS preflight and redirect blocks in browsers/Electron.
    // This ensures the email is always successfully triggered and sent behind the scenes!
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        appToken: APP_SECURITY_TOKEN,
        to: email,
        subject: 'Recuperación de Contraseña - Reciminsa App',
        textBody: textBody,
        htmlBody: htmlBody
      })
    });
    
    console.log("🚀 Petición de correo enviada con éxito (modo no-cors).");
    return true;
  } catch (err) {
    console.error("❌ Error de red conectando con el servicio de correo:", err);
    return false;
  }
}

// 5. Step 2: Handle code verification
function handleVerifyCode(evt) {
  if (evt) evt.preventDefault();
  
  const codeInput = document.getElementById('forgot-code').value.trim();
  const errorEl = document.getElementById('forgot-code-error');
  
  errorEl.classList.add('hidden');
  
  const sessionStr = localStorage.getItem('recim_recovery_session');
  if (!sessionStr) {
    errorEl.textContent = 'Sesión de recuperación no válida. Inténtalo de nuevo.';
    errorEl.classList.remove('hidden');
    return;
  }
  
  const session = JSON.parse(sessionStr);
  
  if (Date.now() > session.expiresAt) {
    errorEl.textContent = 'El código ha expirado (límite 10 mins). Solicita uno nuevo.';
    errorEl.classList.remove('hidden');
    return;
  }
  
  const cleanInput = codeInput.replace(/\D/g, '');
  const cleanStored = session.code.replace(/\D/g, '');

  if (!cleanInput || cleanInput !== cleanStored) {
    session.attempts = (session.attempts || 0) + 1;
    if (session.attempts >= 5) {
      localStorage.removeItem('recim_recovery_session');
      errorEl.textContent = 'Demasiados intentos fallidos. Solicita un nuevo código de recuperación.';
    } else {
      localStorage.setItem('recim_recovery_session', JSON.stringify(session));
      errorEl.textContent = `Código incorrecto (${5 - session.attempts} intento(s) restante(s)). Verifica tu correo e inténtalo de nuevo.`;
    }
    errorEl.classList.remove('hidden');
    return;
  }
  
  // Successful verification
  showToast('✅ Código verificado con éxito', 'success');
  
  // Go to Step 3
  document.getElementById('forgot-step-code').classList.add('hidden');
  document.getElementById('forgot-step-reset').classList.remove('hidden');
  document.getElementById('forgot-new-password').focus();
}

// 6. Step 3: Handle password reset in Supabase profiles
async function handleResetPassword(evt) {
  if (evt) evt.preventDefault();
  
  const newPassword = document.getElementById('forgot-new-password').value;
  const errorEl = document.getElementById('forgot-reset-error');
  const btn = document.getElementById('forgot-reset-btn');
  
  errorEl.classList.add('hidden');
  
  if (!newPassword || newPassword.length < 6) {
    errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
    errorEl.classList.remove('hidden');
    return;
  }
  
  const sessionStr = localStorage.getItem('recim_recovery_session');
  if (!sessionStr) {
    errorEl.textContent = 'Sesión no válida. Vuelve al primer paso.';
    errorEl.classList.remove('hidden');
    return;
  }
  
  const session = JSON.parse(sessionStr);
  
  const resetBtn = () => {
    btn.querySelector('span')?.classList.remove('hidden');
    btn.querySelector('.btn-spinner')?.classList.add('hidden');
    btn.disabled = false;
  };
  
  btn.querySelector('span').classList.add('hidden');
  btn.querySelector('.btn-spinner').classList.remove('hidden');
  btn.disabled = true;
  
  setTimeout(async () => {
    try {
      if (!isSupabaseActive || !supabaseClient) {
        throw new Error("Supabase no está inicializado o no hay conexión de red.");
      }
      
      // Update in profiles table via RPC (or fallback update): set password = sha256(newPassword)
      const securePassword = await hashPasswordSHA256(newPassword);
      
      const { error: rpcErr } = await supabaseClient.rpc('change_user_password', {
        p_email: session.email,
        p_new_password_hash: securePassword
      });

      if (rpcErr) {
        const { error } = await supabaseClient
          .from('profiles')
          .update({ password: securePassword })
          .eq('email', session.email);
        if (error) throw error;
      }
      
      // Success!
      showToast('🎉 Contraseña restablecida con éxito. Inicia sesión.', 'success');
      
      // Clear recovery session
      localStorage.removeItem('recim_recovery_session');
      
      resetBtn();
      backToLogin();
    } catch (err) {
      console.error('Password reset error:', err);
      errorEl.textContent = 'Error al cambiar contraseña: ' + (err.message || err);
      errorEl.classList.remove('hidden');
      resetBtn();
    }
  }, 900);
}

// =============================================
// MODAL DE CUENTA GUARDADA (AUTOLOGIN ELEGANTE)
// =============================================
function checkShowSavedAccountModal() {
  try {
    const authScreen = document.getElementById('auth-screen');
    if (!authScreen || authScreen.classList.contains('hidden')) {
      return;
    }

    if (localStorage.getItem('recim_dont_show_saved_account') === 'true') {
      return;
    }

    let account = null;
    const saved = localStorage.getItem('recim_saved_account');
    if (saved) {
      account = JSON.parse(saved);
    } else {
      const prevSession = localStorage.getItem('recim_session');
      if (prevSession) {
        const parsed = JSON.parse(prevSession);
        if (parsed && parsed.email) {
          account = {
            name: parsed.name || 'Usuario',
            email: parsed.email,
            avatar: parsed.avatar || 'U',
            role: 'Cuenta Principal'
          };
        }
      }
    }

    if (!account || !account.email) return;

    const modal = document.getElementById('saved-account-modal');
    if (!modal) return;

    const nameEl = document.getElementById('saved-acc-name');
    const emailEl = document.getElementById('saved-acc-email');
    const initialsEl = document.getElementById('saved-acc-initials');
    const roleEl = document.getElementById('saved-acc-role');

    if (nameEl) nameEl.textContent = account.name || 'Usuario';
    if (emailEl) emailEl.textContent = account.email;
    if (initialsEl) initialsEl.textContent = (account.avatar || account.name || account.email || 'U')[0].toUpperCase();
    if (roleEl) roleEl.textContent = account.role || 'Acceso Rápido';

    modal.classList.remove('hidden');
  } catch (e) {
    console.warn('Error mostrando modal de cuenta guardada:', e);
  }
}

function closeSavedAccountModal() {
  const modal = document.getElementById('saved-account-modal');
  if (modal) modal.classList.add('hidden');
  const checkbox = document.getElementById('saved-acc-dont-show');
  if (checkbox && checkbox.checked) {
    localStorage.setItem('recim_dont_show_saved_account', 'true');
  }
}

function confirmSavedAccountLogin() {
  try {
    let email = '';
    const saved = localStorage.getItem('recim_saved_account');
    if (saved) {
      const account = JSON.parse(saved);
      email = account.email || '';
    }
    if (!email) {
      const prevSession = localStorage.getItem('recim_session');
      if (prevSession) {
        const parsed = JSON.parse(prevSession);
        email = parsed.email || '';
      }
    }

    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    if (emailInput && email) {
      emailInput.value = email;
    }
    closeSavedAccountModal();
    if (passInput) {
      passInput.focus();
    }
  } catch (_) {
    closeSavedAccountModal();
  }
}

window.checkShowSavedAccountModal = checkShowSavedAccountModal;
window.closeSavedAccountModal = closeSavedAccountModal;
window.confirmSavedAccountLogin = confirmSavedAccountLogin;

// =============================================
// POST-SIGNUP COMPANY & BRANCH ONBOARDING FLOW
// =============================================

let _onboardValidatedDGII = null;
let _onboardValidatedCompanyCode = null;
let _onboardValidatedRawInput = null;
let _onboardCompanyBranches = [];
let _onboardLookupInProgress = false;

function openPostSignupOnboardingForm(session) {
  const loginForm = document.getElementById('form-login');
  const signupForm = document.getElementById('form-signup');
  const verifyForm = document.getElementById('signup-step-verify');
  const forgotForm = document.getElementById('form-forgot');
  const onboardForm = document.getElementById('signup-step-onboarding');
  const authTabs = document.querySelector('.auth-tabs');

  if (loginForm) loginForm.classList.add('hidden');
  if (signupForm) signupForm.classList.add('hidden');
  if (verifyForm) verifyForm.classList.add('hidden');
  if (forgotForm) forgotForm.classList.add('hidden');
  if (authTabs) authTabs.classList.add('hidden');

  document.getElementById('app-screen')?.classList.add('hidden');
  document.getElementById('auth-screen')?.classList.remove('hidden');

  _onboardValidatedDGII = null;
  _onboardValidatedCompanyCode = null;
  _onboardValidatedRawInput = null;
  _onboardCompanyBranches = [];

  if (onboardForm) {
    onboardForm.classList.remove('hidden');
    const createCb = document.getElementById('onboard-create-company-cb');
    if (createCb) createCb.checked = true;

    const rncEl = document.getElementById('onboard-company-rnc');
    const nameEl = document.getElementById('onboard-company-name');
    const codeEl = document.getElementById('onboard-company-code');
    const bNameEl = document.getElementById('onboard-branch-name');
    const bCodeEl = document.getElementById('onboard-branch-code');
    const bLocEl = document.getElementById('onboard-branch-location');
    const bPhoneEl = document.getElementById('onboard-branch-phone');
    const existingBranchCodeEl = document.getElementById('onboard-existing-branch-code');
    const errEl = document.getElementById('onboard-error');

    if (rncEl) rncEl.value = '';
    if (nameEl) nameEl.value = '';
    if (codeEl) codeEl.value = '';
    if (bNameEl) bNameEl.value = '';
    if (bCodeEl) bCodeEl.value = '';
    if (bLocEl) bLocEl.value = '';
    if (bPhoneEl) bPhoneEl.value = '';
    if (existingBranchCodeEl) existingBranchCodeEl.value = '';
    if (errEl) errEl.classList.add('hidden');

    document.getElementById('onboard-dgii-status')?.classList.add('hidden');
    document.getElementById('onboard-code-status')?.classList.add('hidden');
    document.getElementById('onboard-branch-section')?.classList.add('hidden');

    toggleOnboardingCompanyMode();
  }
}

function toggleOnboardingCompanyMode() {
  const createCb = document.getElementById('onboard-create-company-cb');
  const newSec = document.getElementById('onboard-new-company-section');
  const joinSec = document.getElementById('onboard-join-company-section');
  const errEl = document.getElementById('onboard-error');

  if (errEl) errEl.classList.add('hidden');

  if (createCb && createCb.checked) {
    newSec?.classList.remove('hidden');
    joinSec?.classList.add('hidden');
  } else {
    newSec?.classList.add('hidden');
    joinSec?.classList.remove('hidden');
  }
}

function _setOnboardingDGIIStatus(type, htmlMsg) {
  const statusEl = document.getElementById('onboard-dgii-status');
  if (!statusEl) return;
  statusEl.classList.remove('hidden');
  if (type === 'success') {
    statusEl.style.background = 'rgba(16, 185, 129, 0.12)';
    statusEl.style.border = '1px solid rgba(16, 185, 129, 0.4)';
    statusEl.style.color = '#6ee7b7';
  } else if (type === 'warning') {
    statusEl.style.background = 'rgba(245, 158, 11, 0.12)';
    statusEl.style.border = '1px solid rgba(245, 158, 11, 0.4)';
    statusEl.style.color = '#fcd34d';
  } else {
    statusEl.style.background = 'rgba(59, 130, 246, 0.12)';
    statusEl.style.border = '1px solid rgba(59, 130, 246, 0.4)';
    statusEl.style.color = '#93c5fd';
  }
  statusEl.innerHTML = htmlMsg;
}

function onOnboardingRncInput(val) {
  const clean = (val || '').replace(/\D/g, '');
  if (_onboardValidatedDGII && _onboardValidatedDGII.rnc !== clean) {
    _onboardValidatedDGII = null;
  }
  if (clean.length === 9 || clean.length === 11) {
    lookupOnboardingDGIIByRNC();
  }
}

function onOnboardingNameInput(val) {
  const trimmed = (val || '').trim();
  if (_onboardValidatedDGII && _onboardValidatedDGII.name.toLowerCase() !== trimmed.toLowerCase()) {
    _onboardValidatedDGII = null;
  }
}

async function lookupOnboardingDGIIByRNC() {
  if (_onboardLookupInProgress) return _onboardValidatedDGII;
  const rncEl = document.getElementById('onboard-company-rnc');
  const nameEl = document.getElementById('onboard-company-name');
  if (!rncEl) return null;

  const cleanId = (rncEl.value || '').replace(/\D/g, '');
  if (!cleanId) return null;

  if (_onboardValidatedDGII && _onboardValidatedDGII.rnc === cleanId && nameEl?.value.trim()) {
    return _onboardValidatedDGII;
  }

  _onboardLookupInProgress = true;
  _setOnboardingDGIIStatus('info', '🔍 Consultando RNC en la API de la DGII...');

  try {
    if (typeof fetchDGIIData !== 'function') {
      throw new Error('Módulo DGII no disponible.');
    }
    const data = await fetchDGIIData(cleanId);
    if (data && data.name) {
      const finalRnc = (data.rnc || cleanId).replace(/\D/g, '');
      const finalName = data.name.trim();
      rncEl.value = finalRnc;
      if (nameEl) nameEl.value = finalName;
      _onboardValidatedDGII = { rnc: finalRnc, name: finalName, status: data.status || 'ACTIVO' };
      const esc = window.escapeHtml || (v => String(v || ''));
      _setOnboardingDGIIStatus('success', `✅ <b>Empresa verificada en DGII:</b> ${esc(finalName)} <br/><span>RNC: <b>${esc(finalRnc)}</b> • Estado: ${esc(data.status || 'ACTIVO')}</span>`);
      return _onboardValidatedDGII;
    } else {
      _onboardValidatedDGII = null;
      _setOnboardingDGIIStatus('warning', '⚠️ No se encontró una empresa con ese RNC en la DGII. Verifica el número.');
      return null;
    }
  } catch (err) {
    console.warn('Error consultando RNC en DGII:', err);
    _setOnboardingDGIIStatus('warning', '⚠️ No fue posible validar el RNC con la DGII.');
    return null;
  } finally {
    _onboardLookupInProgress = false;
  }
}

async function lookupOnboardingDGIIByName() {
  if (_onboardLookupInProgress) return _onboardValidatedDGII;
  const rncEl = document.getElementById('onboard-company-rnc');
  const nameEl = document.getElementById('onboard-company-name');
  if (!nameEl) return null;

  const query = (nameEl.value || '').trim();
  if (!query || query.length < 3) return null;

  if (_onboardValidatedDGII && _onboardValidatedDGII.name.toLowerCase() === query.toLowerCase() && rncEl?.value.trim()) {
    return _onboardValidatedDGII;
  }

  _onboardLookupInProgress = true;
  const escQuery = window.escapeHtml ? window.escapeHtml(query) : query;
  _setOnboardingDGIIStatus('info', `🔍 Buscando RNC de "<b>${escQuery}</b>" en la API de la DGII...`);

  try {
    let results = [];
    if (typeof searchDGIICompanies === 'function') {
      results = await searchDGIICompanies(query);
    } else if (typeof fetchDGIIData === 'function') {
      const single = await fetchDGIIData(query);
      if (single) results = [single];
    }

    if (results && results.length > 0) {
      const normalizedQuery = query.toLowerCase().replace(/[.,]/g, '').trim();
      const exactMatch = results.find(c => (c.name || '').toLowerCase().replace(/[.,]/g, '').trim() === normalizedQuery);
      const applySelection = (chosen) => {
        const finalRnc = (chosen.rnc || '').replace(/\D/g, '');
        const finalName = (chosen.name || query).trim();
        if (rncEl) rncEl.value = finalRnc;
        if (nameEl) nameEl.value = finalName;
        _onboardValidatedDGII = { rnc: finalRnc, name: finalName, status: chosen.status || 'ACTIVO' };
        const esc = window.escapeHtml || (v => String(v || ''));
        _setOnboardingDGIIStatus('success', `✅ <b>RNC obtenido de DGII:</b> ${esc(finalName)} <br/><span>RNC: <b>${esc(finalRnc)}</b> • Estado: ${esc(chosen.status || 'ACTIVO')}</span>`);
      };

      if (exactMatch || results.length === 1) {
        const picked = exactMatch || results[0];
        applySelection(picked);
        return _onboardValidatedDGII;
      } else {
        // Auto-apply first best match immediately and also offer picker modal if multiple exist
        applySelection(results[0]);
        if (typeof openDGIICompanyPickerModal === 'function') {
          openDGIICompanyPickerModal(results, (selectedCompany) => {
            applySelection(selectedCompany);
          });
        }
        return _onboardValidatedDGII;
      }
    } else {
      _onboardValidatedDGII = null;
      _setOnboardingDGIIStatus('warning', '⚠️ No se encontró ninguna empresa con ese nombre en la DGII.');
      return null;
    }
  } catch (err) {
    console.warn('Error buscando empresa por nombre en DGII:', err);
    _setOnboardingDGIIStatus('warning', '⚠️ Error al consultar el nombre en la API de la DGII.');
    return null;
  } finally {
    _onboardLookupInProgress = false;
  }
}

function onOnboardingCompanyCodeInput(val) {
  const trimmed = (val || '').trim();
  if (_onboardValidatedRawInput !== trimmed.toUpperCase()) {
    _onboardValidatedCompanyCode = null;
    _onboardValidatedRawInput = null;
    document.getElementById('onboard-branch-section')?.classList.add('hidden');
  }
  if (/^\d{10}$/.test(trimmed)) {
    validateOnboardingCompanyCode();
  }
}

async function validateOnboardingCompanyCode() {
  const codeEl = document.getElementById('onboard-company-code');
  const statusEl = document.getElementById('onboard-code-status');
  const branchSec = document.getElementById('onboard-branch-section');
  if (!codeEl || !statusEl) return false;

  const rawCode = (codeEl.value || '').trim();
  if (rawCode.length < 3) {
    statusEl.classList.remove('hidden');
    statusEl.style.background = 'rgba(245, 158, 11, 0.12)';
    statusEl.style.border = '1px solid rgba(245, 158, 11, 0.4)';
    statusEl.style.color = '#fcd34d';
    statusEl.textContent = '⚠️ Ingresa el código numérico (10 dígitos) o el código personalizado de la empresa.';
    branchSec?.classList.add('hidden');
    return false;
  }

  statusEl.classList.remove('hidden');
  statusEl.style.background = 'rgba(59, 130, 246, 0.12)';
  statusEl.style.border = '1px solid rgba(59, 130, 246, 0.4)';
  statusEl.style.color = '#93c5fd';
  statusEl.textContent = '📡 Validando código de empresa...';

  try {
    if (!isSupabaseActive || !supabaseClient) {
      throw new Error('Sin conexión a Supabase.');
    }

    let resolved = null;
    if (typeof resolveCompanyByCode === 'function') {
      resolved = await resolveCompanyByCode(rawCode);
    } else {
      const { data: cloudUsers, error: checkError } = await supabaseClient
        .from('profiles')
        .select('id, name')
        .eq('family_id', rawCode);
      if (checkError) throw checkError;
      const { data: familyRow } = await supabaseClient
        .from('user_data')
        .select('data')
        .eq('id', `family_${rawCode}`)
        .maybeSingle();
      if ((cloudUsers && cloudUsers.length > 0) || (familyRow && familyRow.data)) {
        const remoteData = (familyRow && familyRow.data) || {};
        const sharedSettings = remoteData.recim_company_shared_settings || {};
        resolved = {
          found: true,
          familyId: rawCode,
          remoteData,
          sharedSettings,
          branches: remoteData.recim_branches || sharedSettings.branches || [],
          companyName: sharedSettings.companyName || `Empresa #${rawCode}`,
          companyRNC: sharedSettings.companyRNC || ''
        };
      }
    }

    if (!resolved || !resolved.found) {
      _onboardValidatedCompanyCode = null;
      _onboardValidatedRawInput = null;
      statusEl.style.background = 'rgba(239, 68, 68, 0.12)';
      statusEl.style.border = '1px solid rgba(239, 68, 68, 0.4)';
      statusEl.style.color = '#fca5a5';
      statusEl.textContent = '❌ El código de empresa no existe o no es válido.';
      branchSec?.classList.add('hidden');
      return false;
    }

    const resolvedFamilyId = resolved.familyId;
    _onboardValidatedCompanyCode = resolvedFamilyId;
    _onboardValidatedRawInput = rawCode.toUpperCase();

    const sharedSettings = resolved.sharedSettings || {};
    const companyTitle = resolved.companyName || sharedSettings.companyName || `Empresa #${resolvedFamilyId}`;
    const companyRnc = (resolved.companyRNC || sharedSettings.companyRNC) ? ` (RNC: ${resolved.companyRNC || sharedSettings.companyRNC})` : '';

    // Extraer sucursales existentes de la empresa (nunca mostrar su código/contraseña en el selector)
    let branches = Array.isArray(resolved.branches) ? resolved.branches : [];
    if (branches.length === 0) {
      branches = [
        {
          id: 'SUC-PRINCIPAL',
          name: 'Sucursal Principal (Sede Central)',
          location: sharedSettings.companyAddress || 'Sede Principal',
          phone: sharedSettings.companyPhone || '',
          isMain: true,
          active: true
        }
      ];
    }
    _onboardCompanyBranches = branches;

    const esc = window.escapeHtml || (v => String(v || ''));
    statusEl.style.background = 'rgba(16, 185, 129, 0.12)';
    statusEl.style.border = '1px solid rgba(16, 185, 129, 0.4)';
    statusEl.style.color = '#6ee7b7';
    statusEl.innerHTML = `✅ <b>Empresa encontrada:</b> ${esc(companyTitle)}${esc(companyRnc)}`;

    populateOnboardingBranchesDropdown(branches.filter(b => b && b.active !== false));
    branchSec?.classList.remove('hidden');
    toggleOnboardingBranchMode();
    return true;
  } catch (err) {
    console.error('Error validando código de empresa:', err);
    statusEl.style.background = 'rgba(239, 68, 68, 0.12)';
    statusEl.style.border = '1px solid rgba(239, 68, 68, 0.4)';
    statusEl.style.color = '#fca5a5';
    statusEl.textContent = '❌ Error al validar código de empresa: ' + (err.message || err);
    return false;
  }
}

function populateOnboardingBranchesDropdown(branches) {
  const selectEl = document.getElementById('onboard-existing-branch-select');
  if (!selectEl) return;

  const esc = window.escapeHtml || (v => String(v || ''));
  selectEl.innerHTML = branches.map(b => {
    const loc = b.location ? ` — ${b.location}` : '';
    return `<option value="${esc(b.id)}">${esc(b.name)}${esc(loc)}</option>`;
  }).join('');
}

function toggleOnboardingBranchMode() {
  const isNewBranch = document.getElementById('onboard-new-branch-cb')?.checked;
  const newFields = document.getElementById('onboard-new-branch-fields');
  const existingFields = document.getElementById('onboard-existing-branch-fields');

  if (isNewBranch) {
    newFields?.classList.remove('hidden');
    existingFields?.classList.add('hidden');
  } else {
    newFields?.classList.add('hidden');
    existingFields?.classList.remove('hidden');
  }
}

async function handleCompleteOnboarding(evt) {
  if (evt) evt.preventDefault();

  const createCb = document.getElementById('onboard-create-company-cb');
  const errEl = document.getElementById('onboard-error');
  const btn = document.getElementById('onboard-submit-btn');

  if (errEl) errEl.classList.add('hidden');

  const showError = (msg) => {
    if (errEl) {
      errEl.textContent = msg;
      errEl.classList.remove('hidden');
    } else {
      showToast(msg, 'error');
    }
  };

  const setBtnLoading = (loading) => {
    if (!btn) return;
    if (loading) {
      btn.querySelector('span')?.classList.add('hidden');
      btn.querySelector('.btn-spinner')?.classList.remove('hidden');
      btn.disabled = true;
    } else {
      btn.querySelector('span')?.classList.remove('hidden');
      btn.querySelector('.btn-spinner')?.classList.add('hidden');
      btn.disabled = false;
    }
  };

  let session = {};
  try {
    session = JSON.parse(localStorage.getItem('recim_session') || '{}');
  } catch (_) {}

  if (!session.accountId) {
    showError('Sesión no encontrada. Por favor inicia sesión nuevamente.');
    return;
  }

  setBtnLoading(true);

  try {
    const wantsNewCompany = createCb ? createCb.checked : true;

    if (wantsNewCompany) {
      // MODO 1: CREAR EMPRESA NUEVA (RNC + Nombre obligatorios vía DGII)
      const rncEl = document.getElementById('onboard-company-rnc');
      const nameEl = document.getElementById('onboard-company-name');
      let rncVal = (rncEl?.value || '').replace(/\D/g, '');
      let nameVal = (nameEl?.value || '').trim();

      if (!rncVal && !nameVal) {
        showError('Debes ingresar el RNC o el Nombre de la empresa para validarla con la DGII.');
        setBtnLoading(false);
        return;
      }

      // Si puso primero el Nombre / Razón Social o aún no tiene RNC, jalar el RNC de la API de la DGII
      if (nameVal && (!rncVal || !_onboardValidatedDGII)) {
        const res = await lookupOnboardingDGIIByName();
        if (res) {
          rncVal = res.rnc;
          nameVal = res.name;
        }
      }
      // Si puso el RNC o aún no se ha validado con DGII, jalar el nombre de la API de la DGII
      if (rncVal && (!nameVal || !_onboardValidatedDGII)) {
        const res = await lookupOnboardingDGIIByRNC();
        if (res) {
          rncVal = res.rnc;
          nameVal = res.name;
        }
      }

      rncVal = (rncEl?.value || '').replace(/\D/g, '');
      nameVal = (nameEl?.value || '').trim();

      if (!rncVal || !nameVal || !_onboardValidatedDGII) {
        showError('La empresa debe tener tanto su Nombre como su RNC validados mediante la API de la DGII.');
        setBtnLoading(false);
        return;
      }

      // Generar código de empresa de 10 dígitos
      let code = '';
      for (let i = 0; i < 10; i++) {
        code += Math.floor(Math.random() * 10);
      }

      session.familyId = code;
      session.role = 'ceo';
      session.isFounder = true;
      session.companyName = nameVal;
      session.companyRNC = rncVal;
      session.branchId = 'SUC-PRINCIPAL';
      session.branchName = 'Sucursal Principal';
      delete session.onboardingPending;

      if (typeof calculateSecureChecksum === 'function') {
        session.signature = calculateSecureChecksum(session.accountId, session.email, code);
      }
      localStorage.setItem('recim_session', JSON.stringify(session));
      if (typeof BiometricAuthManager !== 'undefined' && typeof BiometricAuthManager.saveSessionToSQLite === 'function') {
        BiometricAuthManager.saveSessionToSQLite(session);
      }

      const nowIso = new Date().toISOString();
      const defaultBranchCode = (typeof generateDefaultBranchCode === 'function')
        ? generateDefaultBranchCode()
        : ('SUC-' + Math.floor(1000 + Math.random() * 9000));

      const defaultBranch = {
        id: 'SUC-PRINCIPAL',
        name: 'Sucursal Principal',
        location: 'Sede Central',
        phone: '',
        email: session.email || '',
        code: defaultBranchCode,
        isMain: true,
        active: true,
        createdBy: session.accountId,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      const founderMember = {
        id: session.accountId,
        accountId: session.accountId,
        name: (session.name || 'Usuario').split(' | ')[0].trim(),
        email: session.email || '',
        role: 'ceo',
        branchId: defaultBranch.id,
        branchName: defaultBranch.name,
        updatedAt: nowIso
      };

      const shared = {
        companyName: nameVal,
        companyRNC: rncVal,
        founderId: session.accountId,
        companyAdmins: [session.accountId],
        branches: [defaultBranch]
      };

      localStorage.setItem(userKey('recim_company_id'), code);
      localStorage.setItem(userKey('recim_company_admin'), session.accountId);
      localStorage.setItem(userKey('recim_company_shared_settings'), JSON.stringify(shared));
      localStorage.setItem(userKey('recim_branches'), JSON.stringify([defaultBranch]));
      localStorage.setItem(userKey('recim_branch_members'), JSON.stringify([founderMember]));

      if (typeof saveSetting === 'function') {
        saveSetting('companyName', nameVal);
        saveSetting('companyRNC', rncVal);
        saveSetting('branchId', defaultBranch.id);
        saveSetting('branchName', defaultBranch.name);
      }

      if (isSupabaseActive && supabaseClient) {
        let { error: profileError } = await supabaseClient
          .from('profiles')
          .update({ family_id: code, role: 'ceo' })
          .eq('id', session.accountId);

        if (profileError && (profileError.code === 'PGRST204' || (profileError.message && profileError.message.includes('role')))) {
          await supabaseClient
            .from('profiles')
            .update({ family_id: code })
            .eq('id', session.accountId);
        }

        const familyPayload = {
          recim_company_id: code,
          recim_company_admin: session.accountId,
          recim_company_shared_settings: shared,
          recim_branches: [defaultBranch],
          recim_branch_members: [founderMember]
        };

        await supabaseClient
          .from('user_data')
          .upsert({
            id: `family_${code}`,
            data: familyPayload,
            updated_at: nowIso
          });
      }

      if (typeof applySettings === 'function') {
        applySettings();
      }

      showToast(`🏢 ¡Empresa ${nameVal} (RNC: ${rncVal}) creada con éxito!`, 'success');
    } else {
      // MODO 2: NO CREAR EMPRESA -> UNIRSE CON CÓDIGO DE EMPRESA Y SUCURSAL
      const codeEl = document.getElementById('onboard-company-code');
      const rawCode = (codeEl?.value || '').trim();

      if (rawCode.length < 3) {
        showError('Ingresa un código de empresa válido (numérico o personalizado).');
        setBtnLoading(false);
        return;
      }

      if (!_onboardValidatedCompanyCode || _onboardValidatedRawInput !== rawCode.toUpperCase()) {
        const ok = await validateOnboardingCompanyCode();
        if (!ok) {
          setBtnLoading(false);
          return;
        }
      }

      const targetFamilyId = _onboardValidatedCompanyCode;
      if (!targetFamilyId) {
        showError('No se pudo validar el código de empresa.');
        setBtnLoading(false);
        return;
      }

      const isNewBranch = document.getElementById('onboard-new-branch-cb')?.checked;
      let chosenBranch = null;

      if (isNewBranch) {
        const bName = (document.getElementById('onboard-branch-name')?.value || '').trim();
        const bCode = (document.getElementById('onboard-branch-code')?.value || '').trim().toUpperCase();
        const bLoc = (document.getElementById('onboard-branch-location')?.value || '').trim();
        const bPhone = (document.getElementById('onboard-branch-phone')?.value || '').trim();

        if (!bName || !bCode || !bLoc || !bPhone) {
          showError('Por favor completa nombre, código de acceso, ubicación y teléfono de la nueva sucursal.');
          setBtnLoading(false);
          return;
        }

        if (bCode.length < 3) {
          showError('El código de acceso de la sucursal debe tener al menos 3 caracteres.');
          setBtnLoading(false);
          return;
        }

        const duplicateBranch = _onboardCompanyBranches.find(b => b && b.code && b.code.trim().toUpperCase() === bCode);
        if (duplicateBranch) {
          showError(`El código "${bCode}" ya está en uso en la sucursal "${duplicateBranch.name}". Elige otro código.`);
          setBtnLoading(false);
          return;
        }

        const nowIso = new Date().toISOString();
        chosenBranch = {
          id: `SUC-${Date.now()}`,
          name: bName,
          code: bCode,
          location: bLoc,
          phone: bPhone,
          isMain: false,
          active: true,
          createdBy: session.accountId,
          createdAt: nowIso,
          updatedAt: nowIso
        };
      } else {
        const activeBranches = _onboardCompanyBranches.filter(b => b && b.active !== false);
        const selectEl = document.getElementById('onboard-existing-branch-select');
        const selectedId = selectEl?.value;
        chosenBranch = activeBranches.find(b => b.id === selectedId) || activeBranches[0];
        if (!chosenBranch) {
          showError('Selecciona una sucursal existente o marca la opción para crear una nueva.');
          setBtnLoading(false);
          return;
        }

        const enteredBranchCode = (document.getElementById('onboard-existing-branch-code')?.value || '').trim().toUpperCase();
        if (chosenBranch.code && chosenBranch.code.trim()) {
          if (!enteredBranchCode || enteredBranchCode !== chosenBranch.code.trim().toUpperCase()) {
            showError('❌ Código de sucursal incorrecto. Verifica la contraseña con el administrador o CEO de la empresa.');
            setBtnLoading(false);
            return;
          }
        } else {
          showToast('ℹ️ Esta sucursal aún no tiene código configurado. Acceso permitido.', 'warning');
        }
      }

      if (isSupabaseActive && supabaseClient) {
        const { error: updateError } = await supabaseClient
          .from('profiles')
          .update({ family_id: targetFamilyId })
          .eq('id', session.accountId);

        if (updateError) throw updateError;
      }

      session.familyId = targetFamilyId;
      if (session.role !== 'master') {
        session.role = 'colaborador';
        session.isFounder = false;
      }
      session.branchId = chosenBranch.id;
      session.branchName = chosenBranch.name;
      session.branchLocation = chosenBranch.location || '';
      session.branchPhone = chosenBranch.phone || '';
      delete session.onboardingPending;

      if (typeof calculateSecureChecksum === 'function') {
        session.signature = calculateSecureChecksum(session.accountId, session.email, targetFamilyId);
      }
      localStorage.setItem('recim_session', JSON.stringify(session));
      if (typeof BiometricAuthManager !== 'undefined' && typeof BiometricAuthManager.saveSessionToSQLite === 'function') {
        BiometricAuthManager.saveSessionToSQLite(session);
      }

      localStorage.setItem(userKey('recim_company_id'), targetFamilyId);

      if (window.syncPullData) {
        await window.syncPullData(`family_${targetFamilyId}`);
      }

      // Actualizar lista compartida de sucursales y registrar miembro en la sucursal
      const sharedKey = userKey('recim_company_shared_settings');
      const branchesKey = userKey('recim_branches');
      let shared = {};
      let branchesList = [..._onboardCompanyBranches];
      try { shared = JSON.parse(localStorage.getItem(sharedKey) || '{}'); } catch (_) {}
      try {
        const localBranches = JSON.parse(localStorage.getItem(branchesKey) || '[]');
        if (Array.isArray(localBranches) && localBranches.length > 0) {
          branchesList = localBranches;
        }
      } catch (_) {}

      if (isNewBranch && chosenBranch) {
        if (!branchesList.some(b => b.id === chosenBranch.id)) {
          branchesList.push(chosenBranch);
        }
      }
      shared.branches = branchesList;
      localStorage.setItem(sharedKey, JSON.stringify(shared));
      localStorage.setItem(branchesKey, JSON.stringify(branchesList));

      if (typeof upsertBranchMember === 'function') {
        upsertBranchMember({
          accountId: session.accountId,
          name: session.name,
          email: session.email,
          role: session.role,
          branchId: chosenBranch.id,
          branchName: chosenBranch.name,
          updatedAt: new Date().toISOString()
        });
      }

      if (typeof saveSetting === 'function') {
        saveSetting('branchId', chosenBranch.id);
        saveSetting('branchName', chosenBranch.name);
        saveSetting('branchLocation', chosenBranch.location || '');
        saveSetting('branchPhone', chosenBranch.phone || '');
      }

      if (typeof window.syncPushData === 'function') {
        await window.syncPushData(true);
      }

      if (typeof applySettings === 'function') {
        applySettings();
      }

      showToast(`🏢 ¡Unido a la empresa en ${chosenBranch.name}!`, 'success');
    }

    // Mostrar pestañas normales para futuros inicios de sesión y entrar a la aplicación
    const authTabs = document.querySelector('.auth-tabs');
    if (authTabs) authTabs.classList.remove('hidden');
    document.getElementById('signup-step-onboarding')?.classList.add('hidden');

    setBtnLoading(false);
    initApp(session);
  } catch (err) {
    console.error('Error completando configuración de empresa:', err);
    showError('Error al guardar la configuración: ' + (err.message || err));
    setBtnLoading(false);
  }
}

window.openPostSignupOnboardingForm = openPostSignupOnboardingForm;
window.toggleOnboardingCompanyMode = toggleOnboardingCompanyMode;
window.onOnboardingRncInput = onOnboardingRncInput;
window.onOnboardingNameInput = onOnboardingNameInput;
window.lookupOnboardingDGIIByRNC = lookupOnboardingDGIIByRNC;
window.lookupOnboardingDGIIByName = lookupOnboardingDGIIByName;
window.onOnboardingCompanyCodeInput = onOnboardingCompanyCodeInput;
window.validateOnboardingCompanyCode = validateOnboardingCompanyCode;
window.toggleOnboardingBranchMode = toggleOnboardingBranchMode;
window.handleCompleteOnboarding = handleCompleteOnboarding;
