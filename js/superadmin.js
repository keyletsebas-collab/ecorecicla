/* =============================================
   SUPERADMIN.JS – Panel de Control Global
   Solo visible para keyletsebas@gmail.com y
   usuarios a quienes keylet haya dado acceso.
   ============================================= */

let _saCountdownInterval = null;

// ─── Guard: verify current user has superadmin rights ───────────────────────
function isSuperAdminUser() {
  const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
  if (!session.accountId) return false;
  if (session.email === 'keyletsebas@gmail.com') return true;

  // Permanent access
  const granted = JSON.parse(localStorage.getItem('recim_superadmin_granted') || '[]');
  if (granted.includes(session.accountId)) return true;

  // Temporary access
  const tempList = JSON.parse(localStorage.getItem('recim_superadmin_temp') || '[]');
  const tempEntry = tempList.find(e => e.accountId === session.accountId);
  if (tempEntry && tempEntry.expiresAt > Date.now()) return true;

  return false;
}

// ─── Main render function ────────────────────────────────────────────────────
async function renderSuperAdminPage(container) {
  if (!isSuperAdminUser()) {
    container.innerHTML = `
      <div style="padding:40px; text-align:center; color:var(--clr-text-muted);">
        🚫 Acceso denegado.
      </div>`;
    return;
  }

  const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
  const isMasterAdmin = session.email === 'keyletsebas@gmail.com';

  // If user has temporary access, show countdown banner
  let tempBanner = '';
  if (!isMasterAdmin) {
    const tempList = JSON.parse(localStorage.getItem('recim_superadmin_temp') || '[]');
    const myTemp = tempList.find(e => e.accountId === session.accountId);
    if (myTemp && myTemp.expiresAt > Date.now()) {
      const ms = myTemp.expiresAt - Date.now();
      const mins = Math.floor(ms / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      tempBanner = `
        <div id="sa-temp-banner" style="padding:10px 16px; background:linear-gradient(90deg,#f59e0b,#ef4444);
             color:#fff; border-radius:10px; font-size:0.82rem; font-weight:600; margin-bottom:16px;
             display:flex; align-items:center; gap:10px;">
          ⏱️ Acceso temporal activo — expira en
          <span id="sa-temp-countdown" style="font-size:1rem; font-family:monospace;">${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}</span>
        </div>`;
    }
  }

  container.innerHTML = `
    <div style="padding:16px; max-width:900px; margin:0 auto;">

      <!-- Header -->
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
        <div>
          <h2 style="margin:0; font-size:1.3rem;">🛡️ Control Global</h2>
          <p style="margin:4px 0 0; font-size:0.78rem; color:var(--clr-text-muted);">Panel exclusivo de administración del sistema</p>
        </div>
        <!-- Botón Veriminsa -->
        <button onclick="window.open('https://veriminsa.vercel.app/', '_blank')"
          style="display:inline-flex; align-items:center; gap:8px; padding:10px 18px;
                 background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; border:none;
                 border-radius:10px; cursor:pointer; font-size:0.85rem; font-weight:600;
                 box-shadow:0 4px 12px rgba(99,102,241,.4);">
          🌐 Abrir Veriminsa
        </button>
      </div>

      ${tempBanner}

      <!-- Sección: Empresas registradas -->
      <div class="card card--elevated" style="margin-bottom:20px; border-radius:16px; overflow:hidden;">
        <div style="padding:16px 20px; border-bottom:1px solid var(--clr-border); display:flex; align-items:center; justify-content:space-between;">
          <h3 style="margin:0; font-size:1rem;">🏢 Empresas Registradas</h3>
          <button onclick="superAdminLoadCompanies()" id="sa-refresh-btn"
            style="padding:6px 14px; border-radius:8px; background:var(--clr-primary); color:#fff; border:none; cursor:pointer; font-size:0.78rem;">
            🔄 Actualizar
          </button>
        </div>
        <div id="sa-companies-list" style="padding:16px;">
          <div style="color:var(--clr-text-muted); font-size:0.85rem; text-align:center; padding:20px;">
            Cargando empresas...
          </div>
        </div>
      </div>

      ${isMasterAdmin ? `
      <!-- Sección: Acceso Permanente (solo keylet) -->
      <div class="card card--elevated" style="margin-bottom:20px; border-radius:16px; overflow:hidden;">
        <div style="padding:16px 20px; border-bottom:1px solid var(--clr-border);">
          <h3 style="margin:0; font-size:1rem;">🔑 Acceso Permanente</h3>
          <p style="margin:6px 0 0; font-size:0.78rem; color:var(--clr-text-muted);">
            Ingresa el Account ID del usuario al que quieres dar acceso permanente.
          </p>
        </div>
        <div style="padding:16px;">
          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px;">
            <input id="sa-grant-input" type="text" placeholder="Account ID del usuario..."
              style="flex:1; min-width:200px; padding:9px 12px; border-radius:8px;
                     border:1px solid var(--clr-border); background:var(--clr-surface);
                     color:var(--clr-text); font-size:0.85rem;" />
            <button onclick="superAdminGrantAccess()"
              style="padding:9px 18px; border-radius:8px; background:#10b981; color:#fff;
                     border:none; cursor:pointer; font-size:0.85rem; font-weight:600;">
              ✅ Dar acceso
            </button>
          </div>
          <div id="sa-granted-list">
            ${renderGrantedList()}
          </div>
        </div>
      </div>

      <!-- Sección: Acceso Momentáneo (solo keylet) -->
      <div class="card card--elevated" style="border-radius:16px; overflow:hidden;">
        <div style="padding:16px 20px; border-bottom:1px solid var(--clr-border);">
          <h3 style="margin:0; font-size:1rem;">⏱️ Acceso Momentáneo</h3>
          <p style="margin:6px 0 0; font-size:0.78rem; color:var(--clr-text-muted);">
            Da acceso temporal a este panel por un número de minutos. Al expirar, el acceso se revoca automáticamente.
          </p>
        </div>
        <div style="padding:16px;">
          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px; align-items:flex-end;">
            <div style="display:flex; flex-direction:column; gap:4px; flex:1; min-width:180px;">
              <label style="font-size:0.74rem; color:var(--clr-text-muted);">Account ID del usuario</label>
              <input id="sa-temp-input" type="text" placeholder="Account ID..."
                style="padding:9px 12px; border-radius:8px; border:1px solid var(--clr-border);
                       background:var(--clr-surface); color:var(--clr-text); font-size:0.85rem;" />
            </div>
            <div style="display:flex; flex-direction:column; gap:4px; width:110px;">
              <label style="font-size:0.74rem; color:var(--clr-text-muted);">Minutos</label>
              <input id="sa-temp-minutes" type="number" min="1" max="1440" value="10" placeholder="Minutos"
                style="padding:9px 12px; border-radius:8px; border:1px solid var(--clr-border);
                       background:var(--clr-surface); color:var(--clr-text); font-size:0.85rem;" />
            </div>
            <button onclick="superAdminGrantTempAccess()"
              style="padding:9px 18px; border-radius:8px;
                     background:linear-gradient(135deg,#f59e0b,#ef4444); color:#fff;
                     border:none; cursor:pointer; font-size:0.85rem; font-weight:600; white-space:nowrap;">
              ⚡ Activar acceso
            </button>
          </div>
          <!-- Active temp accesses -->
          <div id="sa-temp-list">
            ${renderTempList()}
          </div>
        </div>
      </div>
      ` : ''}

    </div>`;

  // Auto-load companies
  superAdminLoadCompanies();

  // Start countdown if user has temp access
  _saStartCountdown();
}

// ─── Countdown ticker for temporary access ───────────────────────────────────
function _saStartCountdown() {
  if (_saCountdownInterval) clearInterval(_saCountdownInterval);
  const countEl = document.getElementById('sa-temp-countdown');
  if (!countEl) return;

  const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
  const tempList = JSON.parse(localStorage.getItem('recim_superadmin_temp') || '[]');
  const myTemp = tempList.find(e => e.accountId === session.accountId);
  if (!myTemp) return;

  _saCountdownInterval = setInterval(() => {
    const remaining = myTemp.expiresAt - Date.now();
    if (remaining <= 0) {
      clearInterval(_saCountdownInterval);
      // Revoke access and redirect
      showToast('⏰ Tu acceso temporal ha expirado.', 'error');
      setTimeout(() => navigate('historial'), 1500);
      return;
    }
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    const el = document.getElementById('sa-temp-countdown');
    if (el) el.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  }, 1000);
}

// ─── Render the list of permanently granted users ────────────────────────────
function renderGrantedList() {
  const granted = JSON.parse(localStorage.getItem('recim_superadmin_granted') || '[]');
  if (granted.length === 0) {
    return `<p style="font-size:0.78rem; color:var(--clr-text-muted);">Ningún usuario extra tiene acceso permanente aún.</p>`;
  }
  return `
    <div style="font-size:0.78rem; color:var(--clr-text-muted); margin-bottom:6px;">Accesos permanentes concedidos:</div>
    <div style="display:flex; flex-direction:column; gap:8px;">
      ${granted.map(id => `
        <div style="display:flex; align-items:center; justify-content:space-between;
                    padding:8px 12px; background:var(--clr-surface-alt,rgba(255,255,255,.04));
                    border-radius:8px; border:1px solid var(--clr-border);">
          <span style="font-size:0.82rem; font-family:monospace;">${id}</span>
          <button onclick="superAdminRevokeAccess('${id}')"
            style="padding:4px 10px; background:#ef4444; color:#fff; border:none;
                   border-radius:6px; cursor:pointer; font-size:0.75rem;">
            🗑️ Revocar
          </button>
        </div>
      `).join('')}
    </div>`;
}

// ─── Render the list of temporary access entries ──────────────────────────────
function renderTempList() {
  const tempList = JSON.parse(localStorage.getItem('recim_superadmin_temp') || '[]');
  const active = tempList.filter(e => e.expiresAt > Date.now());

  if (active.length === 0) {
    return `<p style="font-size:0.78rem; color:var(--clr-text-muted);">Ningún acceso momentáneo activo.</p>`;
  }

  return `
    <div style="font-size:0.78rem; color:var(--clr-text-muted); margin-bottom:6px;">Accesos momentáneos activos:</div>
    <div style="display:flex; flex-direction:column; gap:8px;">
      ${active.map(entry => {
        const remaining = Math.max(0, entry.expiresAt - Date.now());
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        const expiresStr = new Date(entry.expiresAt).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
        return `
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;
                    padding:10px 12px; background:linear-gradient(135deg,rgba(245,158,11,.08),rgba(239,68,68,.06));
                    border-radius:8px; border:1px solid rgba(245,158,11,.35);">
          <div>
            <div style="font-size:0.82rem; font-family:monospace;">${entry.accountId}</div>
            <div style="font-size:0.72rem; color:var(--clr-text-muted); margin-top:2px;">
              Expira a las ${expiresStr} &nbsp;·&nbsp;
              <span style="color:#f59e0b; font-weight:600;">
                ${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')} restantes
              </span>
            </div>
          </div>
          <button onclick="superAdminRevokeTempAccess('${entry.accountId}')"
            style="padding:5px 12px; background:#ef4444; color:#fff; border:none;
                   border-radius:6px; cursor:pointer; font-size:0.75rem;">
            ❌ Cancelar
          </button>
        </div>`;
      }).join('')}
    </div>`;
}

// ─── Grant permanent access ───────────────────────────────────────────────────
function superAdminGrantAccess() {
  const input = document.getElementById('sa-grant-input');
  if (!input) return;
  const accountId = input.value.trim();
  if (!accountId) { showToast('Ingresa un Account ID válido.', 'error'); return; }

  const granted = JSON.parse(localStorage.getItem('recim_superadmin_granted') || '[]');
  if (granted.includes(accountId)) { showToast('Este usuario ya tiene acceso.', 'info'); return; }

  granted.push(accountId);
  localStorage.setItem('recim_superadmin_granted', JSON.stringify(granted));
  input.value = '';
  _superAdminSyncGranted(granted);

  const listEl = document.getElementById('sa-granted-list');
  if (listEl) listEl.innerHTML = renderGrantedList();
  showToast('✅ Acceso permanente concedido.', 'success');
}

// ─── Grant temporary access ───────────────────────────────────────────────────
function superAdminGrantTempAccess() {
  const idInput = document.getElementById('sa-temp-input');
  const minsInput = document.getElementById('sa-temp-minutes');
  if (!idInput || !minsInput) return;

  const accountId = idInput.value.trim();
  const minutes = parseInt(minsInput.value, 10);

  if (!accountId) { showToast('Ingresa un Account ID válido.', 'error'); return; }
  if (!minutes || minutes < 1) { showToast('Ingresa un número de minutos válido.', 'error'); return; }

  const expiresAt = Date.now() + minutes * 60 * 1000;
  let tempList = JSON.parse(localStorage.getItem('recim_superadmin_temp') || '[]');

  // Remove any existing entry for this user and add the new one
  tempList = tempList.filter(e => e.accountId !== accountId);
  tempList.push({ accountId, expiresAt, grantedAt: Date.now() });
  localStorage.setItem('recim_superadmin_temp', JSON.stringify(tempList));
  _superAdminSyncTemp(tempList);

  idInput.value = '';
  minsInput.value = '10';

  const listEl = document.getElementById('sa-temp-list');
  if (listEl) listEl.innerHTML = renderTempList();

  showToast(`⏱️ Acceso momentáneo de ${minutes} min activado.`, 'success');

  // Also update the nav link for the current session if the user is logged in on this device
  _superAdminCheckNavLink();
}

// ─── Revoke permanent access ──────────────────────────────────────────────────
function superAdminRevokeAccess(accountId) {
  if (!confirm(`¿Revocar acceso permanente a:\n${accountId}?`)) return;
  let granted = JSON.parse(localStorage.getItem('recim_superadmin_granted') || '[]');
  granted = granted.filter(id => id !== accountId);
  localStorage.setItem('recim_superadmin_granted', JSON.stringify(granted));
  _superAdminSyncGranted(granted);

  const listEl = document.getElementById('sa-granted-list');
  if (listEl) listEl.innerHTML = renderGrantedList();
  showToast('Acceso permanente revocado.', 'info');
}

// ─── Revoke temporary access ──────────────────────────────────────────────────
function superAdminRevokeTempAccess(accountId) {
  if (!confirm(`¿Cancelar el acceso momentáneo de:\n${accountId}?`)) return;
  let tempList = JSON.parse(localStorage.getItem('recim_superadmin_temp') || '[]');
  tempList = tempList.filter(e => e.accountId !== accountId);
  localStorage.setItem('recim_superadmin_temp', JSON.stringify(tempList));
  _superAdminSyncTemp(tempList);

  const listEl = document.getElementById('sa-temp-list');
  if (listEl) listEl.innerHTML = renderTempList();
  showToast('Acceso momentáneo cancelado.', 'info');
}

// ─── Sync permanent grants to Supabase ───────────────────────────────────────
async function _superAdminSyncGranted(grantedArr) {
  if (!isSupabaseActive || !supabaseClient) return;
  try {
    await supabaseClient.from('user_data').upsert({
      id: 'superadmin_granted',
      data: { granted: grantedArr },
      updated_at: new Date().toISOString()
    });
  } catch (e) { console.warn('No se pudo sincronizar lista de superadmins:', e); }
}

// ─── Sync temporary grants to Supabase ───────────────────────────────────────
async function _superAdminSyncTemp(tempList) {
  if (!isSupabaseActive || !supabaseClient) return;
  try {
    // Only push non-expired entries
    const active = tempList.filter(e => e.expiresAt > Date.now());
    await supabaseClient.from('user_data').upsert({
      id: 'superadmin_temp',
      data: { temp: active },
      updated_at: new Date().toISOString()
    });
  } catch (e) { console.warn('No se pudo sincronizar accesos temporales:', e); }
}

// ─── Update nav link visibility ───────────────────────────────────────────────
function _superAdminCheckNavLink() {
  const link = document.getElementById('nav-link-superadmin');
  if (!link) return;
  link.style.display = isSuperAdminUser() ? '' : 'none';
}

// ─── Pull all access data from Supabase on boot ───────────────────────────────
async function _superAdminPullGranted() {
  if (!isSupabaseActive || !supabaseClient) return;
  try {
    // Pull permanent grants
    const { data: perm } = await supabaseClient
      .from('user_data').select('data').eq('id', 'superadmin_granted').maybeSingle();
    if (perm && perm.data && Array.isArray(perm.data.granted)) {
      localStorage.setItem('recim_superadmin_granted', JSON.stringify(perm.data.granted));
    }

    // Pull temporary grants
    const { data: temp } = await supabaseClient
      .from('user_data').select('data').eq('id', 'superadmin_temp').maybeSingle();
    if (temp && temp.data && Array.isArray(temp.data.temp)) {
      // Only keep non-expired entries
      const active = temp.data.temp.filter(e => e.expiresAt > Date.now());
      localStorage.setItem('recim_superadmin_temp', JSON.stringify(active));
    }

    // Refresh nav link after pulling
    _superAdminCheckNavLink();
  } catch (e) { console.warn('Error cargando datos de superadmin:', e); }
}

// ─── Auto-expire temp grants checker (runs every minute) ─────────────────────
function _superAdminAutoExpire() {
  let tempList = JSON.parse(localStorage.getItem('recim_superadmin_temp') || '[]');
  const before = tempList.length;
  tempList = tempList.filter(e => e.expiresAt > Date.now());
  if (tempList.length !== before) {
    localStorage.setItem('recim_superadmin_temp', JSON.stringify(tempList));
    _superAdminSyncTemp(tempList);
    _superAdminCheckNavLink();
  }
}

// ─── Load all companies from Supabase ────────────────────────────────────────
async function superAdminLoadCompanies() {
  const listEl = document.getElementById('sa-companies-list');
  if (!listEl) return;

  listEl.innerHTML = `
    <div style="color:var(--clr-text-muted); font-size:0.85rem; text-align:center; padding:20px;">
      ⏳ Cargando empresas...
    </div>`;

  if (!isSupabaseActive || !supabaseClient) {
    listEl.innerHTML = `<div style="color:#ef4444; font-size:0.85rem; padding:12px;">❌ Sin conexión a la base de datos.</div>`;
    return;
  }

  try {
    const { data: profiles, error: profErr } = await supabaseClient
      .from('profiles').select('id, name, email, family_id').neq('family_id', null);
    if (profErr) throw profErr;

    const { data: companyRows, error: rowErr } = await supabaseClient
      .from('user_data').select('id, data, updated_at').like('id', 'family_%');
    if (rowErr) throw rowErr;

    if (!companyRows || companyRows.length === 0) {
      listEl.innerHTML = `<div style="color:var(--clr-text-muted); font-size:0.85rem; padding:12px; text-align:center;">No hay empresas registradas.</div>`;
      return;
    }

    const memberMap = {};
    (profiles || []).forEach(p => {
      if (!p.family_id) return;
      if (!memberMap[p.family_id]) memberMap[p.family_id] = [];
      memberMap[p.family_id].push(p);
    });

    const html = companyRows.map(row => {
      const familyId = row.id.replace('family_', '');
      const data = row.data || {};

      let companyName = '—';
      try {
        const sharedRaw = data.recim_company_shared_settings;
        const shared = typeof sharedRaw === 'string' ? JSON.parse(sharedRaw) : sharedRaw;
        if (shared && shared.companyName) companyName = shared.companyName;
      } catch (_) {}

      const adminId = data.recim_company_admin || '—';
      const members = memberMap[familyId] || [];
      const founder = members.find(m => m.id === adminId);
      const founderLabel = founder
        ? `${(founder.name || '?').split(' | ')[0]} (${founder.email})`
        : adminId;

      const membersHtml = members.length === 0
        ? `<div style="color:var(--clr-text-muted); font-size:0.78rem; padding:4px 0;">Sin miembros vinculados</div>`
        : members.map(m => `
            <div style="display:flex; align-items:center; gap:8px; padding:5px 0; border-bottom:1px solid var(--clr-border);">
              <div style="width:28px; height:28px; border-radius:50%; background:var(--clr-primary);
                          display:flex; align-items:center; justify-content:center; font-size:0.7rem; color:#fff; flex-shrink:0;">
                ${(m.name || m.email || '?')[0].toUpperCase()}
              </div>
              <div style="flex:1; min-width:0;">
                <div style="font-size:0.8rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                  ${(m.name || '—').split(' | ')[0]}
                  ${m.id === adminId ? `<span style="font-size:0.65rem; background:#eab308; color:#000; border-radius:4px; padding:1px 5px; margin-left:4px;">👑</span>` : ''}
                </div>
                <div style="font-size:0.72rem; color:var(--clr-text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${m.email}</div>
              </div>
            </div>`).join('');

      const updatedAt = row.updated_at
        ? new Date(row.updated_at).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' })
        : '—';

      return `
        <div style="border:1px solid var(--clr-border); border-radius:12px; margin-bottom:14px; overflow:hidden;">
          <div style="padding:12px 16px; display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;
                      background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(139,92,246,.06));">
            <div>
              <div style="font-size:1rem; font-weight:700;">${companyName}</div>
              <div style="font-size:0.72rem; color:var(--clr-text-muted); margin-top:2px;">
                ID: <code style="font-family:monospace;">${familyId}</code> &nbsp;·&nbsp; Actualizado: ${updatedAt}
              </div>
              <div style="font-size:0.75rem; color:var(--clr-text-muted); margin-top:3px;">
                👑 Creador: <strong>${founderLabel}</strong>
              </div>
              <div style="font-size:0.75rem; color:var(--clr-text-muted); margin-top:2px;">
                👥 ${members.length} miembro${members.length !== 1 ? 's' : ''}
              </div>
            </div>
            <button onclick="superAdminDeleteCompany('${familyId}', '${companyName.replace(/'/g,"\\'")}', this)"
              style="padding:7px 14px; background:#ef4444; color:#fff; border:none; border-radius:8px;
                     cursor:pointer; font-size:0.78rem; font-weight:600; white-space:nowrap; align-self:flex-start;">
              🗑️ Eliminar empresa
            </button>
          </div>
          <div style="padding:10px 16px 14px;">
            <div style="font-size:0.75rem; font-weight:600; color:var(--clr-text-muted); margin-bottom:6px;">MIEMBROS</div>
            ${membersHtml}
          </div>
        </div>`;
    }).join('');

    listEl.innerHTML = html || `<div style="color:var(--clr-text-muted); font-size:0.85rem; padding:12px; text-align:center;">No hay empresas.</div>`;

  } catch (err) {
    console.error('Error cargando empresas:', err);
    listEl.innerHTML = `<div style="color:#ef4444; font-size:0.85rem; padding:12px;">❌ Error: ${err.message}</div>`;
  }
}

// ─── Delete a company ─────────────────────────────────────────────────────────
async function superAdminDeleteCompany(familyId, companyName, btn) {
  if (!confirm(`¿Eliminar permanentemente la empresa "${companyName}" (ID: ${familyId})?\n\nEsto elimina todos sus datos de la nube. No se puede deshacer.`)) return;

  btn.disabled = true;
  btn.textContent = '⏳ Eliminando...';

  try {
    if (!isSupabaseActive || !supabaseClient) throw new Error('Sin conexión');

    const { error: delDataErr } = await supabaseClient
      .from('user_data').delete().eq('id', `family_${familyId}`);
    if (delDataErr) throw delDataErr;

    const { error: unlinkErr } = await supabaseClient
      .from('profiles').update({ family_id: null }).eq('family_id', familyId);
    if (unlinkErr) throw unlinkErr;

    showToast(`🗑️ Empresa "${companyName}" eliminada.`, 'success');
    superAdminLoadCompanies();
  } catch (err) {
    console.error('Error eliminando empresa:', err);
    showToast('❌ Error al eliminar: ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = '🗑️ Eliminar empresa';
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(_superAdminPullGranted, 2000);
  // Check every 30 seconds for expired temp grants
  setInterval(_superAdminAutoExpire, 30000);
});
