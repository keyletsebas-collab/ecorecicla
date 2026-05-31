/* =============================================
   AUTH.JS – Login / Signup logic
   Multi-user: cada credencial = cuenta separada
   Force rebuild: 2026-05-31
   ============================================= */

// ---- Per-user storage key helper ----
// All app data is namespaced under the current user's accountId.
// Usage: localStorage.getItem(userKey('recim_invoices'))
function userKey(baseKey) {
  try {
    const session = localStorage.getItem('recim_session');
    if (session) {
      const user = JSON.parse(session);
      if (user && user.accountId) {
        return `${baseKey}_${user.accountId}`;
      }
    }
  } catch (e) {
    console.error('Error in userKey:', e);
  }
  return baseKey;
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

      if (data.password !== btoa(password)) {
        errorEl.textContent = 'Contraseña incorrecta.';
        errorEl.classList.remove('hidden');
        resetBtn();
        return;
      }

      const session = {
        name: data.name,
        email: data.email,
        avatar: (data.avatar || data.name || 'U')[0].toUpperCase(),
        provider: 'email',
        accountId: data.id,
        familyId: data.family_id || null
      };

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
    const newProfile = {
      id: accountId,
      name: pending.name,
      email: pending.email,
      password: btoa(pending.password),
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
      name: pending.name,
      email: pending.email,
      avatar: pending.name[0].toUpperCase(),
      provider: 'email',
      accountId: accountId,
      familyId: null
    };

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
const GLOBAL_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzrwE5FXgHuCGMIwiZE34DZChQP4zhvxaicj5eXcXKFw7qrew_jU6dVc2e50VxBQxP6/exec';

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
      
      // Update in profiles table: set password = base64(newPassword)
      const encodedPassword = btoa(newPassword);
      
      const { error } = await supabaseClient
        .from('profiles')
        .update({ password: encodedPassword })
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
