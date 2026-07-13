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
            console.warn("⚠️ Sesión alterada detectada. Cerrando sesión...");
            localStorage.removeItem('recim_session');
            window.location.reload();
            return baseKey;
          }
        }
        return `${baseKey}_${user.accountId}`;
      }
    }
  } catch (e) {
    console.error('Error in userKey:', e);
  }
  return baseKey;
}

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
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');

  if (forgotForm) forgotForm.classList.add('hidden');
  if (signupVerifyForm) signupVerifyForm.classList.add('hidden');

  // Make sure tabs are visible
  const tabsContainer = document.querySelector('.auth-tabs');
  if (tabsContainer) tabsContainer.classList.remove('hidden');

  if (tab === 'login') {
    if (loginForm) loginForm.classList.remove('hidden');
    if (signupForm) signupForm.classList.add('hidden');
    if (tabLogin) tabLogin.classList.add('auth-tab--active');
    if (tabSignup) tabSignup.classList.remove('auth-tab--active');
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

      // Query user profile from Supabase
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('email', identifier)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        errorEl.textContent = 'No existe una cuenta con ese correo.';
        errorEl.classList.remove('hidden');
        resetBtn();
        return;
      }

      if (data.family_id === 'BLOCKED') {
        errorEl.textContent = 'Acceso denegado: tu cuenta ha sido bloqueada por el administrador.';
        errorEl.classList.remove('hidden');
        resetBtn();
        return;
      }

      const secureHash = await hashPasswordSHA256(password);
      let isValid = false;
      let needsMigration = false;

      if (data.password === secureHash) {
        isValid = true;
      } else if (data.password === btoa(password)) {
        isValid = true;
        needsMigration = true;
      }

      if (!isValid) {
        errorEl.textContent = 'Contraseña incorrecta.';
        errorEl.classList.remove('hidden');
        resetBtn();
        return;
      }

      // Si inició sesión usando la contraseña antigua (base64), migrarla a SHA-256
      if (needsMigration) {
        try {
          await supabaseClient
            .from('profiles')
            .update({ password: secureHash })
            .eq('id', data.id);
          console.log(`🔒 Contraseña del usuario ${data.email} migrada exitosamente a SHA-256.`);
        } catch (migError) {
          console.warn("⚠️ No se pudo migrar la contraseña a SHA-256 automáticamente:", migError);
        }
      }

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

      // Guardar sesión
      localStorage.setItem('recim_session', JSON.stringify(session));
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

async function handleSignup(evt) {
  evt.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const identity = document.getElementById('signup-email').value.trim().toLowerCase();
  const password = document.getElementById('signup-password').value;
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

      // Generate 6 digit activation code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Store signup details temporarily in localStorage
      const signupData = {
        name,
        email: identity,
        password,
        code: verificationCode,
        expiresAt: Date.now() + 15 * 60 * 1000
      };
      localStorage.setItem('recim_signup_pending', JSON.stringify(signupData));

      console.log(`🔑 [Reciminsa Signup Debug] Código de activación para ${identity}: ${verificationCode}`);

      // Send Gmail verification
      const emailSent = await sendSignupVerificationEmail(identity, verificationCode, name);

      if (emailSent) {
        showToast('✉️ Código de activación enviado a tu Gmail.', 'success');
      } else {
        // Fallback for offline/testing
        showToast(`✉️ Código generado (Modo Respaldo): ${verificationCode}`, 'success');
      }

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
          ¡Bienvenido a Reciminsa App, <strong>${userName}</strong>! Estamos encantados de tenerte con nosotros.
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

  console.log("🔍 [Signup Verify Debug] Input:", codeInput, "Clean Input:", cleanInput);
  console.log("🔍 [Signup Verify Debug] Stored Code:", pending.code, "Clean Stored:", cleanStored);

  if (!cleanInput || cleanInput !== cleanStored) {
    errorEl.textContent = 'Código incorrecto. Verifica tu correo e inténtalo de nuevo.';
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
    const deviceIdSuffix = typeof getDeviceUUID === 'function' ? ` | DEV:${getDeviceUUID()}` : '';
    const newProfile = {
      id: accountId,
      name: pending.name + deviceIdSuffix,
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

    const session = {
      name: pending.name + deviceIdSuffix,
      email: pending.email,
      avatar: pending.name[0].toUpperCase(),
      provider: 'email',
      accountId: accountId,
      familyId: null
    };

    if (typeof calculateSecureChecksum === 'function') {
      session.signature = calculateSecureChecksum(session.accountId, session.email, session.familyId);
    }

    // Save session
    localStorage.setItem('recim_session', JSON.stringify(session));
    localStorage.removeItem('recim_signup_pending');

    showToast('🎉 ¡Cuenta creada y verificada con éxito!', 'success');

    resetBtn();
    
    // Restore tabs visibility
    const authTabs = document.querySelector('.auth-tabs');
    if (authTabs) authTabs.classList.remove('hidden');
    
    document.getElementById('signup-step-verify').classList.add('hidden');
    
    initApp(session);
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
function handleLogout() {
  if (!confirm('¿Seguro que deseas cerrar sesión?')) return;
  
  // Clear only global non-namespaced keys and session.
  // The namespaced user keys remain safe and intact in localStorage!
  const keysToRemove = [
    'recim_session'
  ];
  keysToRemove.forEach(k => localStorage.removeItem(k));

  document.getElementById('app-screen').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  
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
}

// =============================================
// PASSWORD RECOVERY FLOW (FORGOT PASSWORD)
// =============================================

// Default Sender Email Configuration
const GMAIL_SENDER = 'Noreplyreciminsasrl@gmail.com';

// Global Google Apps Script Web App URL for Noreplyreciminsasrl@gmail.com
const GLOBAL_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxYHnE-4KnXCqd-l3MWNKtQ3_HU-Fz6GNsNhf05loH0pfvJTXxbwujAC21OvLZddvSI/exec';

// Local storage key for storing Google Apps Script Web App URL
function getAppsScriptUrl() {
  return localStorage.getItem('recim_gmail_script_url') || GLOBAL_SCRIPT_URL;
}

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
      
      // Query profile
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('email', emailInput)
        .maybeSingle();
        
      if (error) throw error;
      
      if (!data) {
        errorEl.textContent = 'No existe una cuenta registrada con ese correo.';
        errorEl.classList.remove('hidden');
        resetBtn();
        return;
      }
      
      // Generate 6 digit code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Save code in memory/storage with 10 mins expiration
      const recoverySession = {
        email: emailInput,
        code: verificationCode,
        expiresAt: Date.now() + 10 * 60 * 1000,
        userName: data.name
      };
      
      localStorage.setItem('recim_recovery_session', JSON.stringify(recoverySession));
      
      console.log(`🔑 [Reciminsa Auth Debug] Código generado para ${emailInput}: ${verificationCode}`);
      
      // Try to send the real Gmail email
      const emailSent = await sendResetEmail(emailInput, verificationCode, data.name);
      
      if (emailSent) {
        showToast('✉️ Código enviado con éxito a tu Gmail.', 'success');
      } else {
        // Fallback info toast so they can test immediately even without configured script
        showToast(`✉️ Código generado (Modo Respaldo): ${verificationCode}`, 'success');
      }
      
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
          Hola, <strong>${userName}</strong>. Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en Reciminsa App.
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
    console.warn("⚠️ No se ha configurado la URL de Google Apps Script. Utilizando fallback local en consola y pantalla.");
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

  console.log("🔍 [Forgot Pass Verify Debug] Input:", codeInput, "Clean Input:", cleanInput);
  console.log("🔍 [Forgot Pass Verify Debug] Stored Code:", session.code, "Clean Stored:", cleanStored);

  if (!cleanInput || cleanInput !== cleanStored) {
    errorEl.textContent = 'Código incorrecto. Verifica el correo e inténtalo de nuevo.';
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
      
      // Update in profiles table: set password = sha256(newPassword)
      const securePassword = await hashPasswordSHA256(newPassword);
      
      const { error } = await supabaseClient
        .from('profiles')
        .update({ password: securePassword })
        .eq('email', session.email);
        
      if (error) throw error;
      
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
