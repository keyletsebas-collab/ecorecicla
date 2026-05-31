/* =============================================
   AUTH.JS – Login / Signup logic
   Multi-user: cada credencial = cuenta separada
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
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    tabLogin.classList.add('auth-tab--active');
    tabSignup.classList.remove('auth-tab--active');
  } else {
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    tabSignup.classList.add('auth-tab--active');
    tabLogin.classList.remove('auth-tab--active');
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

// =============================================
// SIGNUP
// =============================================

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

      const accountId = `ACC-${Date.now()}`;
      const newProfile = {
        id: accountId,
        name: name,
        email: identity,
        password: btoa(password),
        avatar: name[0].toUpperCase(),
        family_id: null,
        created_at: new Date().toISOString()
      };

      // Insert new profile into Supabase
      const { error: insertError } = await supabaseClient
        .from('profiles')
        .insert([newProfile]);

      if (insertError) {
        throw insertError;
      }

      const session = {
        name: name,
        email: identity,
        avatar: name[0].toUpperCase(),
        provider: 'email',
        accountId: accountId,
        familyId: null
      };

      // Guardar sesión localmente
      localStorage.setItem('recim_session', JSON.stringify(session));
      showToast('🎉 Cuenta creada exitosamente', 'success');

      resetBtn();
      initApp(session);
    } catch (err) {
      console.error('Signup error:', err);
      resetBtn();
      errorEl.textContent = 'Error al crear cuenta: ' + (err.message || err);
      errorEl.classList.remove('hidden');
    }
  }, 900);
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
