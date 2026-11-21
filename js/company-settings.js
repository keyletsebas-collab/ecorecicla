/* =============================================
   COMPANY-SETTINGS.JS – Parametrizaciones de Empresa
   3 Ventanas:
     1. Empresa (Compartir en Empresa + Registro de Empresa)
     2. Accesos y Dispositivos (Solo CEO)
     3. Sucursales (Crear, gestionar, ver usuarios, editar)
   Incluye modal "Parametrizar Empresa" (Solo CEO) en las 3 ventanas,
   código personalizado de empresa y contraseña/código de sucursal.
   ============================================= */

// ---- Estado de módulo ----
let _currentCompanyParamTab = 'empresa'; // 'empresa' | 'accesos' | 'sucursales'
let _accessAuditDeviceFilter = 'all';    // 'all' | 'telefono' | 'computadora' | 'web'
let _accessAuditSearch = '';
let _cachedCompanyProfiles = [];

const CEO_MASTER_WHITELIST = [
  'keyletsebas@gmail.com',
  'noreplyreciminsasrl@gmail.com',
  'gerenciareciminsasrl@gmail.com'
];

function _csEscapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _getActiveSessionSafe() {
  let session = {};
  try { session = JSON.parse(localStorage.getItem('recim_session') || '{}'); } catch (_) {}
  if (!session.accountId || !session.email) {
    try {
      const backup = JSON.parse(localStorage.getItem('recim_last_sqlite_session') || '{}');
      if (backup && (backup.accountId || backup.email)) {
        session = { ...backup, ...session };
      }
    } catch (_) {}
  }
  return session;
}

// =============================================
// 1. GUARD DE CEO Y UTILIDADES DE EMPRESA/SUCURSALES
// =============================================

/**
 * Determina estrictamente si el usuario actual es el CEO / Fundador de la empresa.
 * Nota: a diferencia de isCurrentUserAdminOrFounder(), los administradores delegados
 * (companyAdmins) que no son fundadores ni tienen rol ceo/master devuelven false.
 */
function isCurrentUserCompanyCEO() {
  const session = _getActiveSessionSafe();

  // Cuenta independiente (sin empresa compartida aún): es dueña/CEO de su espacio
  if (!session.familyId) {
    return true;
  }

  if (session.email && CEO_MASTER_WHITELIST.includes(session.email.toLowerCase())) {
    return true;
  }

  if (session.role === 'ceo' || session.role === 'master' || session.isFounder === true || session.isMaster === true) {
    return true;
  }

  let companyAdminId = null;
  let shared = {};
  const sharedKey = typeof userKey === 'function' ? userKey('recim_company_shared_settings') : 'recim_company_shared_settings';
  try {
    companyAdminId = localStorage.getItem(userKey('recim_company_admin'));
    if (companyAdminId && companyAdminId.startsWith('"') && companyAdminId.endsWith('"')) {
      try { companyAdminId = JSON.parse(companyAdminId); } catch (_) {}
    }
    if (companyAdminId && session.accountId && companyAdminId === session.accountId) {
      return true;
    }

    shared = JSON.parse(localStorage.getItem(sharedKey) || '{}');
    if (session.accountId && shared.founderId && shared.founderId === session.accountId) {
      return true;
    }
  } catch (_) {}

  // Auto-reparación para cuentas heredadas que crearon su empresa antes de persistir founderId/recim_company_admin
  if (!companyAdminId && !shared.founderId && session.role !== 'colaborador' && session.accountId) {
    try {
      localStorage.setItem(userKey('recim_company_admin'), session.accountId);
      shared.founderId = session.accountId;
      if (!Array.isArray(shared.companyAdmins)) shared.companyAdmins = [];
      if (!shared.companyAdmins.includes(session.accountId)) {
        shared.companyAdmins.push(session.accountId);
      }
      localStorage.setItem(sharedKey, JSON.stringify(shared));
      if (typeof updateCurrentSession === 'function') {
        updateCurrentSession({ role: 'ceo', isFounder: true });
      }
    } catch (_) {}
    return true;
  }

  return false;
}
window.isCurrentUserCompanyCEO = isCurrentUserCompanyCEO;

function generateDefaultBranchCode() {
  return 'SUC-' + Math.floor(1000 + Math.random() * 9000);
}
window.generateDefaultBranchCode = generateDefaultBranchCode;

function getCompanyBranches() {
  const session = _getActiveSessionSafe();
  const settings = (typeof getSettings === 'function') ? getSettings() : {};
  let shared = {};
  try {
    shared = JSON.parse(localStorage.getItem(userKey('recim_company_shared_settings')) || '{}');
  } catch (_) {}

  let branches = [];
  try {
    const raw = localStorage.getItem(userKey('recim_branches'));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) branches = parsed;
    }
  } catch (_) {}

  if ((!branches || branches.length === 0) && Array.isArray(shared.branches) && shared.branches.length > 0) {
    branches = [...shared.branches];
  }

  const hasCompanyContext = Boolean(session.familyId || shared.companyName || settings.companyName || settings.companyRNC);
  if ((!branches || branches.length === 0) && hasCompanyContext) {
    const defaultMain = {
      id: 'SUC-PRINCIPAL',
      name: 'Sucursal Principal',
      location: shared.companyAddress || settings.companyAddress || 'Sede Central',
      phone: shared.companyPhone || settings.companyPhone || '',
      email: shared.companyEmail || settings.companyEmail || '',
      code: generateDefaultBranchCode(),
      isMain: true,
      active: true,
      createdBy: session.accountId || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    branches = [defaultMain];
    saveCompanyBranches(branches, { isBootInit: true });
  } else if (branches.length > 0) {
    let changed = false;
    branches = branches.map((b, idx) => {
      if (!b || typeof b !== 'object') return b;
      const copy = { ...b };
      if (copy.id === 'SUC-PRINCIPAL' && copy.isMain !== true) {
        copy.isMain = true;
        changed = true;
      }
      if (idx === 0 && !branches.some(x => x && (x.isMain || x.id === 'SUC-PRINCIPAL'))) {
        copy.isMain = true;
        changed = true;
      }
      if (copy.active === undefined) {
        copy.active = true;
        changed = true;
      }
      return copy;
    });
    if (changed) {
      saveCompanyBranches(branches, { isBootInit: true });
    }
  }

  return branches;
}
window.getCompanyBranches = getCompanyBranches;

function saveCompanyBranches(branches, options = {}) {
  const list = Array.isArray(branches) ? branches : [];
  const nextBranchesJson = JSON.stringify(list);
  const branchesKey = userKey('recim_branches');
  try {
    if (localStorage.getItem(branchesKey) !== nextBranchesJson || options.forceWrite) {
      localStorage.setItem(branchesKey, nextBranchesJson);
    }
  } catch (e) {
    console.error('Error guardando sucursales:', e);
  }

  if (options.isBootInit && !options.markModified) {
    return;
  }

  try {
    const sharedKey = typeof userKey === 'function' ? userKey('recim_company_shared_settings') : 'recim_company_shared_settings';
    const prevRaw = localStorage.getItem(sharedKey);
    const shared = JSON.parse(prevRaw || '{}');
    const prevBranchesJson = JSON.stringify(Array.isArray(shared.branches) ? shared.branches : []);
    shared.branches = list;
    if (options.markModified || prevBranchesJson !== nextBranchesJson) {
      const nowIso = new Date().toISOString();
      shared.branchesUpdatedAt = nowIso;
      if (options.markModified) {
        shared.updatedAt = nowIso;
      }
    }
    const nextSharedJson = JSON.stringify(shared);
    if (prevRaw !== nextSharedJson) {
      localStorage.setItem(sharedKey, nextSharedJson);
    }
  } catch (e) {
    console.error('Error sincronizando sucursales en shared settings:', e);
  }
}
window.saveCompanyBranches = saveCompanyBranches;

function getBranchMembers() {
  try {
    const raw = localStorage.getItem(userKey('recim_branch_members'));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}
window.getBranchMembers = getBranchMembers;

function upsertBranchMember(memberObj) {
  if (!memberObj || !memberObj.accountId) return [];
  const members = getBranchMembers();
  const idx = members.findIndex(m => m && (m.accountId === memberObj.accountId || m.id === memberObj.accountId));
  const cleanName = (memberObj.name || 'Usuario').split(' | ')[0].trim();
  const record = {
    id: memberObj.accountId,
    accountId: memberObj.accountId,
    name: cleanName,
    email: memberObj.email || '',
    role: memberObj.role || 'colaborador',
    branchId: memberObj.branchId || 'SUC-PRINCIPAL',
    branchName: memberObj.branchName || 'Sucursal Principal',
    updatedAt: memberObj.updatedAt || new Date().toISOString()
  };

  if (idx >= 0) {
    members[idx] = { ...members[idx], ...record };
  } else {
    members.push(record);
  }

  try {
    localStorage.setItem(userKey('recim_branch_members'), JSON.stringify(members));
  } catch (e) {
    console.error('Error guardando miembro de sucursal:', e);
  }
  return members;
}
window.upsertBranchMember = upsertBranchMember;

const DEFAULT_MAIN_BRANCH_ID = 'SUC-PRINCIPAL';
window.DEFAULT_MAIN_BRANCH_ID = DEFAULT_MAIN_BRANCH_ID;

function normalizeBranchId(branchId) {
  const clean = branchId == null ? '' : String(branchId).trim();
  return clean || DEFAULT_MAIN_BRANCH_ID;
}
window.normalizeBranchId = normalizeBranchId;

function resolveBranchNameById(branchId) {
  const targetId = normalizeBranchId(branchId);
  try {
    const branches = getCompanyBranches();
    const found = branches.find(b => b && normalizeBranchId(b.id) === targetId);
    if (found && found.name) return found.name;
  } catch (_) {}
  if (targetId === DEFAULT_MAIN_BRANCH_ID) return 'Sucursal Principal';
  return targetId;
}
window.resolveBranchNameById = resolveBranchNameById;

function getUserAssignedBranch() {
  const session = _getActiveSessionSafe();
  const branches = getCompanyBranches();
  const members = getBranchMembers();
  const lowerEmail = (session.email || '').trim().toLowerCase();

  const memberMatch = members.find(m => m && (
    (session.accountId && (m.accountId === session.accountId || m.id === session.accountId)) ||
    (lowerEmail && m.email && m.email.trim().toLowerCase() === lowerEmail)
  ));

  const mainBranch = branches.find(b => b && (b.isMain || b.id === DEFAULT_MAIN_BRANCH_ID)) || branches[0];
  const rawBranchId = (memberMatch && memberMatch.branchId)
    || session.branchId
    || (mainBranch ? mainBranch.id : DEFAULT_MAIN_BRANCH_ID);
  const targetId = normalizeBranchId(rawBranchId);

  const matchedBranch = branches.find(b => b && normalizeBranchId(b.id) === targetId) || mainBranch;
  return {
    id: targetId,
    name: (matchedBranch && matchedBranch.name) || (memberMatch && memberMatch.branchName) || session.branchName || resolveBranchNameById(targetId),
    location: (matchedBranch && matchedBranch.location) || session.branchLocation || 'Sede Central',
    phone: (matchedBranch && matchedBranch.phone) || session.branchPhone || '',
    isMain: matchedBranch ? Boolean(matchedBranch.isMain || matchedBranch.id === DEFAULT_MAIN_BRANCH_ID) : (targetId === DEFAULT_MAIN_BRANCH_ID)
  };
}
window.getUserAssignedBranch = getUserAssignedBranch;

function syncSessionBranchFromMembers() {
  const session = _getActiveSessionSafe();
  if (!session || !session.accountId) return null;

  const members = getBranchMembers();
  const lowerEmail = (session.email || '').trim().toLowerCase();
  const memberMatch = members.find(m => m && (
    (session.accountId && (m.accountId === session.accountId || m.id === session.accountId)) ||
    (lowerEmail && m.email && m.email.trim().toLowerCase() === lowerEmail)
  ));

  if (!memberMatch || !memberMatch.branchId) return null;

  const nextId = normalizeBranchId(memberMatch.branchId);
  const branches = getCompanyBranches();
  const matchedBranch = branches.find(b => b && normalizeBranchId(b.id) === nextId);
  const nextName = (matchedBranch && matchedBranch.name) || memberMatch.branchName || resolveBranchNameById(nextId);

  if (normalizeBranchId(session.branchId) !== nextId || session.branchName !== nextName) {
    const updates = {
      branchId: nextId,
      branchName: nextName
    };
    if (matchedBranch) {
      updates.branchLocation = matchedBranch.location || '';
      updates.branchPhone = matchedBranch.phone || '';
    }
    if (typeof updateCurrentSession === 'function') {
      return updateCurrentSession(updates);
    }
  }
  return null;
}
window.syncSessionBranchFromMembers = syncSessionBranchFromMembers;

function canCurrentUserSwitchBranches() {
  if (typeof isCurrentUserCompanyCEO === 'function' && isCurrentUserCompanyCEO()) {
    return true;
  }
  if (typeof isCurrentUserAdminOrFounder === 'function' && isCurrentUserAdminOrFounder()) {
    return true;
  }
  return false;
}
window.canCurrentUserSwitchBranches = canCurrentUserSwitchBranches;

function getActiveBranchId() {
  const assigned = getUserAssignedBranch();
  if (!canCurrentUserSwitchBranches()) {
    return normalizeBranchId(assigned.id);
  }
  try {
    const storedKey = typeof userKey === 'function' ? userKey('recim_active_branch') : 'recim_active_branch';
    const stored = sessionStorage.getItem(storedKey);
    if (stored) {
      const branches = getCompanyBranches();
      if (branches.some(b => b && normalizeBranchId(b.id) === normalizeBranchId(stored))) {
        return normalizeBranchId(stored);
      }
    }
  } catch (_) {}
  return normalizeBranchId(assigned.id);
}
window.getActiveBranchId = getActiveBranchId;

function getActiveBranch() {
  const targetId = getActiveBranchId();
  const branches = getCompanyBranches();
  const matched = branches.find(b => b && normalizeBranchId(b.id) === targetId);
  if (matched) return matched;
  return getUserAssignedBranch();
}
window.getActiveBranch = getActiveBranch;

function setActiveBranchId(branchId, shouldRerender = true) {
  if (!canCurrentUserSwitchBranches()) {
    return getActiveBranchId();
  }
  const targetId = normalizeBranchId(branchId);
  try {
    const storedKey = typeof userKey === 'function' ? userKey('recim_active_branch') : 'recim_active_branch';
    sessionStorage.setItem(storedKey, targetId);
  } catch (_) {}

  if (shouldRerender && typeof rerenderCurrentPage === 'function') {
    try { rerenderCurrentPage(); } catch (_) {}
  }
  return targetId;
}
window.setActiveBranchId = setActiveBranchId;

function renderBranchContextBar(moduleLabel = 'registros') {
  const canSwitch = canCurrentUserSwitchBranches();
  const branches = getCompanyBranches();
  const activeId = getActiveBranchId();
  const activeName = resolveBranchNameById(activeId);
  const activeBranches = branches.filter(b => b && b.active !== false);
  const selectableBranches = activeBranches.length > 0 ? activeBranches : [{ id: DEFAULT_MAIN_BRANCH_ID, name: 'Sucursal Principal' }];
  if (!selectableBranches.some(b => normalizeBranchId(b.id) === activeId)) {
    selectableBranches.push({ id: activeId, name: activeName });
  }

  return `
    <div class="card card--elevated" style="margin-bottom: 16px; padding: 12px 16px; border-left: 4px solid var(--clr-primary); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.02));">
      <div>
        <div style="font-size: 0.9rem; font-weight: 700; color: var(--clr-text); display: flex; align-items: center; gap: 8px;">
          <span>📍 Sucursal Activa:</span>
          <span class="badge badge--green" style="font-size: 0.78rem; padding: 3px 9px;">${_csEscapeHtml(activeName)}</span>
        </div>
        <div style="font-size: 0.76rem; color: var(--clr-text-muted); margin-top: 3px;">
          Los ${_csEscapeHtml(moduleLabel)} están aislados por sucursal y no se mezclan entre sucursales distintas.
        </div>
      </div>
      ${canSwitch && selectableBranches.length > 1 ? `
        <div style="display: flex; align-items: center; gap: 8px;">
          <label for="branch-context-switcher" style="font-size: 0.78rem; font-weight: 600; color: var(--clr-text-secondary); white-space: nowrap;">Cambiar sucursal:</label>
          <select id="branch-context-switcher" class="form-select" style="width: auto; min-width: 190px; font-weight: 600;" onchange="setActiveBranchId(this.value, true)">
            ${selectableBranches.map(b => {
              const bid = normalizeBranchId(b.id);
              return `<option value="${_csEscapeHtml(bid)}" ${bid === activeId ? 'selected' : ''}>📍 ${_csEscapeHtml(b.name || bid)}</option>`;
            }).join('')}
          </select>
        </div>
      ` : ''}
    </div>
  `;
}
window.renderBranchContextBar = renderBranchContextBar;

function renderBranchSelectorField({ selectId, label = '📍 Sucursal', selectedBranchId = null, onChangeExpr = '' } = {}) {
  const canSwitch = canCurrentUserSwitchBranches();
  const assigned = getUserAssignedBranch();
  const targetId = canSwitch
    ? normalizeBranchId(selectedBranchId || getActiveBranchId())
    : normalizeBranchId(assigned.id);
  const branches = getCompanyBranches();
  const activeBranches = branches.filter(b => b && b.active !== false);

  let optionsHtml = '';
  if (!canSwitch) {
    optionsHtml = `<option value="${_csEscapeHtml(targetId)}" selected>📍 ${_csEscapeHtml(assigned.name || resolveBranchNameById(targetId))}</option>`;
  } else {
    const list = activeBranches.length > 0 ? [...activeBranches] : [{ id: DEFAULT_MAIN_BRANCH_ID, name: 'Sucursal Principal' }];
    if (!list.some(b => normalizeBranchId(b.id) === targetId)) {
      list.push({ id: targetId, name: resolveBranchNameById(targetId) });
    }
    optionsHtml = list.map(b => {
      const bid = normalizeBranchId(b.id);
      return `<option value="${_csEscapeHtml(bid)}" ${bid === targetId ? 'selected' : ''}>📍 ${_csEscapeHtml(b.name || bid)}</option>`;
    }).join('');
  }

  return `
    <div class="form-group" style="margin-bottom: 0;">
      <label class="form-label" for="${_csEscapeHtml(selectId)}">${label}</label>
      <select id="${_csEscapeHtml(selectId)}" class="form-select" ${!canSwitch ? 'disabled' : ''} ${onChangeExpr && canSwitch ? `onchange="${onChangeExpr}"` : ''}>
        ${optionsHtml}
      </select>
    </div>
  `;
}
window.renderBranchSelectorField = renderBranchSelectorField;

/**
 * Resuelve una empresa en Supabase a partir de su código numérico (familyId)
 * o su código personalizado (company_code_<CODE> en user_data).
 */
async function resolveCompanyByCode(rawInput) {
  const trimmed = String(rawInput || '').trim();
  if (trimmed.length < 3) {
    return { found: false };
  }

  const normalized = trimmed.toUpperCase();

  if (typeof isSupabaseActive === 'undefined' || !isSupabaseActive || typeof supabaseClient === 'undefined' || !supabaseClient) {
    return { found: false, offline: true };
  }

  try {
    let resolvedFamilyId = trimmed;

    // 1. Buscar si es un código personalizado en user_data
    const { data: aliasRow } = await supabaseClient
      .from('user_data')
      .select('data')
      .eq('id', `company_code_${normalized}`)
      .maybeSingle();

    if (aliasRow && aliasRow.data && aliasRow.data.familyId) {
      resolvedFamilyId = String(aliasRow.data.familyId);
    }

    // 2. Consultar profiles con el family_id resuelto
    const { data: cloudUsers, error: checkError } = await supabaseClient
      .from('profiles')
      .select('id, name, email, role')
      .eq('family_id', resolvedFamilyId);

    if (checkError) throw checkError;

    // 3. Consultar user_data de la familia
    const { data: familyRow } = await supabaseClient
      .from('user_data')
      .select('data')
      .eq('id', `family_${resolvedFamilyId}`)
      .maybeSingle();

    const hasProfiles = Array.isArray(cloudUsers) && cloudUsers.length > 0;
    const hasFamilyData = Boolean(familyRow && familyRow.data);

    if (!hasProfiles && !hasFamilyData) {
      return { found: false };
    }

    const remoteData = (familyRow && familyRow.data && typeof familyRow.data === 'object') ? familyRow.data : {};
    const sharedSettings = (remoteData.recim_company_shared_settings && typeof remoteData.recim_company_shared_settings === 'object')
      ? remoteData.recim_company_shared_settings
      : {};

    let branches = [];
    if (Array.isArray(remoteData.recim_branches) && remoteData.recim_branches.length > 0) {
      branches = remoteData.recim_branches;
    } else if (Array.isArray(sharedSettings.branches) && sharedSettings.branches.length > 0) {
      branches = sharedSettings.branches;
    }

    return {
      found: true,
      familyId: resolvedFamilyId,
      profiles: cloudUsers || [],
      remoteData,
      sharedSettings,
      branches,
      companyName: sharedSettings.companyName || `Empresa #${resolvedFamilyId}`,
      companyRNC: sharedSettings.companyRNC || '',
      customCode: sharedSettings.customJoinCode || ''
    };
  } catch (err) {
    console.error('Error en resolveCompanyByCode:', err);
    return { found: false, error: err };
  }
}
window.resolveCompanyByCode = resolveCompanyByCode;

// =============================================
// 2. AUDITORÍA DE ACCESOS Y DISPOSITIVOS
// =============================================

function detectCurrentDeviceProfile() {
  let devInfo = { deviceId: '', platform: 'WEB_BROWSER' };
  if (typeof getDeviceAuditInfo === 'function') {
    try {
      devInfo = getDeviceAuditInfo();
    } catch (_) {}
  }

  const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
  let deviceCategory = 'web';
  let deviceLabel = 'Web';
  let deviceIcon = '🌐';
  let deviceDetail = 'Navegador Web';

  const isNativeAndroid = Boolean(window.AndroidNative) || devInfo.platform === 'ANDROID';
  const isMobileUA = /android|iphone|ipad|ipod|mobile/i.test(ua);
  const isNativeDesktop = Boolean(window.chrome && window.chrome.webview) ||
    ua.includes('Electron') ||
    Boolean(window.__NATIVE_DEVICE_ID__) ||
    devInfo.platform === 'PC_DESKTOP';

  if (isNativeAndroid || isMobileUA) {
    deviceCategory = 'telefono';
    deviceLabel = 'Teléfono';
    deviceIcon = '📱';
    deviceDetail = isNativeAndroid ? 'App Android' : 'Navegador Móvil';
  } else if (isNativeDesktop) {
    deviceCategory = 'computadora';
    deviceLabel = 'Computadora';
    deviceIcon = '💻';
    deviceDetail = 'App Escritorio PC';
  } else {
    deviceCategory = 'web';
    deviceLabel = 'Web';
    deviceIcon = '🌐';
    let browser = 'Navegador';
    if (/edg/i.test(ua)) browser = 'Edge';
    else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
    else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua)) browser = 'Safari';

    let os = '';
    if (/windows/i.test(ua)) os = 'Windows';
    else if (/mac os|macintosh/i.test(ua)) os = 'macOS';
    else if (/linux/i.test(ua)) os = 'Linux';

    deviceDetail = os ? `Navegador Web (${browser} / ${os})` : `Navegador Web (${browser})`;
  }

  return {
    deviceCategory,
    deviceLabel,
    deviceIcon,
    deviceDetail,
    deviceId: devInfo.deviceId || (typeof getDeviceUUID === 'function' ? getDeviceUUID() : 'WEB-LOCAL')
  };
}
window.detectCurrentDeviceProfile = detectCurrentDeviceProfile;

function recordCurrentUserDeviceAccess(user) {
  const session = { ..._getActiveSessionSafe(), ...(user && typeof user === 'object' ? user : {}) };
  if (!session || !session.accountId) return;

  const dev = detectCurrentDeviceProfile();
  const nowIso = new Date().toISOString();
  const cleanName = (session.name || 'Usuario').split(' | ')[0].trim();

  // Resolver sucursal actual del usuario priorizando membresía en recim_branch_members
  const branches = getCompanyBranches();
  const members = getBranchMembers();
  const existingMember = members.find(m => m && (m.accountId === session.accountId || m.id === session.accountId));
  const mainBranch = branches.find(b => b && (b.isMain || b.id === 'SUC-PRINCIPAL')) || branches[0];

  let activeBranchId = (existingMember && existingMember.branchId) || session.branchId || (mainBranch ? mainBranch.id : 'SUC-PRINCIPAL');
  let activeBranchObj = branches.find(b => b && b.id === activeBranchId) || mainBranch;
  let activeBranchName = (activeBranchObj && activeBranchObj.name) || (existingMember && existingMember.branchName) || session.branchName || 'Sucursal Principal';

  if (existingMember) {
    upsertBranchMember({
      accountId: session.accountId,
      name: cleanName,
      email: session.email || '',
      role: session.role || existingMember.role || 'colaborador',
      branchId: activeBranchId,
      branchName: activeBranchName,
      updatedAt: existingMember.updatedAt || nowIso
    });
  } else if (session.familyId || activeBranchId) {
    upsertBranchMember({
      accountId: session.accountId,
      name: cleanName,
      email: session.email || '',
      role: session.role || (isCurrentUserCompanyCEO() ? 'ceo' : 'colaborador'),
      branchId: activeBranchId,
      branchName: activeBranchName,
      updatedAt: nowIso
    });
  }
  syncSessionBranchFromMembers();

  // Registrar acceso en recim_access_logs
  const logId = `LOG_${session.accountId}_${dev.deviceId}`;
  const sessionFlagKey = `recim_access_logged_${session.accountId}_${dev.deviceId}`;
  let logs = [];
  try {
    const raw = localStorage.getItem(userKey('recim_access_logs'));
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) logs = parsed;
  } catch (_) {}

  const alreadyLoggedThisTab = sessionStorage.getItem(sessionFlagKey) === '1';
  const idx = logs.findIndex(l => l && l.id === logId);

  if (idx >= 0) {
    const prevCount = parseInt(logs[idx].accessCount || 1, 10) || 1;
    logs[idx] = {
      ...logs[idx],
      id: logId,
      accountId: session.accountId,
      name: cleanName,
      email: session.email || logs[idx].email || '',
      role: session.role || logs[idx].role || 'colaborador',
      branchId: activeBranchId,
      branchName: activeBranchName,
      deviceCategory: dev.deviceCategory,
      deviceLabel: dev.deviceLabel,
      deviceDetail: dev.deviceDetail,
      deviceId: dev.deviceId,
      lastAccessAt: nowIso,
      updatedAt: nowIso,
      accessCount: alreadyLoggedThisTab ? prevCount : (prevCount + 1)
    };
  } else {
    logs.push({
      id: logId,
      accountId: session.accountId,
      name: cleanName,
      email: session.email || '',
      role: session.role || (isCurrentUserCompanyCEO() ? 'ceo' : 'colaborador'),
      branchId: activeBranchId,
      branchName: activeBranchName,
      deviceCategory: dev.deviceCategory,
      deviceLabel: dev.deviceLabel,
      deviceDetail: dev.deviceDetail,
      deviceId: dev.deviceId,
      lastAccessAt: nowIso,
      updatedAt: nowIso,
      accessCount: 1
    });
  }

  try {
    localStorage.setItem(userKey('recim_access_logs'), JSON.stringify(logs));
    sessionStorage.setItem(sessionFlagKey, '1');
  } catch (e) {
    console.warn('No se pudo guardar recim_access_logs:', e);
  }

  if (session.familyId && typeof window.syncPushData === 'function') {
    window.syncPushData();
  }
}
window.recordCurrentUserDeviceAccess = recordCurrentUserDeviceAccess;

// =============================================
// 3. RENDER PRINCIPAL DE PARAMETRIZACIONES DE EMPRESA (3 VENTANAS)
// =============================================

function _renderParametrizarEmpresaBar(windowTitle, windowSubtitle) {
  return `
    <div class="card card--elevated" style="margin-bottom: 18px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border-left: 4px solid var(--clr-primary);">
      <div>
        <div style="font-size: 0.98rem; font-weight: 700; color: var(--clr-text);">${windowTitle}</div>
        <div style="font-size: 0.8rem; color: var(--clr-text-muted); margin-top: 2px;">${windowSubtitle}</div>
      </div>
    </div>
  `;
}

function switchCompanyParamTab(tabName) {
  const isCEO = isCurrentUserCompanyCEO();
  if (tabName === 'accesos' && !isCEO) {
    showToast('🔒 Esta sección es exclusiva para el CEO de la empresa.', 'warning');
    _currentCompanyParamTab = 'empresa';
  } else {
    _currentCompanyParamTab = tabName;
  }
  const container = document.getElementById('page-parametrizaciones_empresa');
  if (container) {
    renderParametrizacionesEmpresaPage(container, _currentCompanyParamTab);
  }
}
window.switchCompanyParamTab = switchCompanyParamTab;

function renderParametrizacionesEmpresaPage(container, tabOverride) {
  if (!container) container = document.getElementById('page-parametrizaciones_empresa');
  if (!container) return;

  const isCEO = isCurrentUserCompanyCEO();
  if (tabOverride) {
    _currentCompanyParamTab = tabOverride;
  }
  if (!isCEO && (_currentCompanyParamTab === 'accesos' || _currentCompanyParamTab === 'auditoria')) {
    _currentCompanyParamTab = 'empresa';
  }

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="section-title">🏢 Parametrizaciones de Empresa</h2>
        <p class="section-subtitle">Administra los datos fiscales de tu empresa, los accesos por dispositivo y las sucursales</p>
      </div>
    </div>

    <div class="invoice-tabs" role="tablist">
      <button type="button" class="invoice-tab ${_currentCompanyParamTab === 'empresa' ? 'active' : ''}" data-ctab="empresa" onclick="switchCompanyParamTab('empresa')">
        <span class="invoice-tab-icon">🏢</span>
        <span>Empresa</span>
      </button>
      ${isCEO ? `
        <button type="button" class="invoice-tab ${_currentCompanyParamTab === 'accesos' ? 'active' : ''}" data-ctab="accesos" onclick="switchCompanyParamTab('accesos')">
          <span class="invoice-tab-icon">📱</span>
          <span>Accesos y Dispositivos</span>
        </button>
      ` : ''}
      <button type="button" class="invoice-tab ${_currentCompanyParamTab === 'sucursales' ? 'active' : ''}" data-ctab="sucursales" onclick="switchCompanyParamTab('sucursales')">
        <span class="invoice-tab-icon">📍</span>
        <span>Sucursales</span>
      </button>
      ${isCEO ? `
        <button type="button" class="invoice-tab ${_currentCompanyParamTab === 'auditoria' ? 'active' : ''}" data-ctab="auditoria" onclick="switchCompanyParamTab('auditoria')">
          <span class="invoice-tab-icon">🛡️</span>
          <span>Auditoría</span>
        </button>
      ` : ''}
    </div>

    <div id="company-param-tab-content"></div>
  `;

  const host = document.getElementById('company-param-tab-content');
  if (!host) return;

  if (_currentCompanyParamTab === 'accesos' && isCEO) {
    renderCompanyTabAccesos(host);
  } else if (_currentCompanyParamTab === 'auditoria' && isCEO && typeof window.renderCompanyTabAuditoria === 'function') {
    window.renderCompanyTabAuditoria(host);
  } else if (_currentCompanyParamTab === 'sucursales') {
    renderCompanyTabSucursales(host);
  } else {
    renderCompanyTabEmpresa(host);
  }
}
window.renderParametrizacionesEmpresaPage = renderParametrizacionesEmpresaPage;

// =============================================
// 4. VENTANA 1: EMPRESA (MOVIDO DESDE AJUSTES)
// =============================================

function _renderCompanyFieldRow({ fieldKey, inputId, label, type = 'text', placeholder = '', value = '', helpText = '', extraButtonsHtml = '', canEditCompany = true }) {
  const safeVal = _csEscapeHtml(value);
  const isLockedWithVal = canEditCompany && Boolean(String(value || '').trim());
  const editActions = canEditCompany ? `
    <button id="btn-edit-company-${fieldKey}" type="button" class="btn-secondary" onclick="startEditCompanyField('${fieldKey}')" title="Editar ${_csEscapeHtml(label)}" style="margin:0; padding:0 12px; white-space:nowrap; font-size:0.82rem;">✏️ Editar</button>
    <span id="company-edit-actions-${fieldKey}" style="display:none; gap:6px; align-items:center;">
      <button id="btn-save-company-${fieldKey}" type="button" class="btn-primary" onclick="saveEditedCompanyField('${fieldKey}')" title="Guardar en Supabase" style="margin:0; padding:0 12px; white-space:nowrap; font-size:0.82rem;">💾 Guardar</button>
      <button type="button" class="btn-secondary" onclick="cancelEditCompanyField('${fieldKey}')" title="Cancelar" style="margin:0; padding:0 10px; font-size:0.82rem;">✕</button>
    </span>
  ` : '';

  return `
    <div class="form-group">
      <label class="form-label" for="${inputId}">${label}</label>
      <div style="display:flex; gap:8px; align-items:stretch; flex-wrap:wrap;">
        <input id="${inputId}" type="${type}" class="form-input" placeholder="${_csEscapeHtml(placeholder)}" value="${safeVal}" data-original-value="${safeVal}" style="flex:1; min-width:170px;" ${isLockedWithVal ? 'readonly' : ''} ${!canEditCompany ? 'disabled' : ''} onfocus="if(!this.readOnly && this.dataset.editing !== 'true') startEditCompanyField('${fieldKey}')" onkeydown="if(event.key==='Enter'){event.preventDefault();saveEditedCompanyField('${fieldKey}');}else if(event.key==='Escape'){event.preventDefault();cancelEditCompanyField('${fieldKey}');}" />
        ${editActions}
        ${extraButtonsHtml}
      </div>
      ${helpText ? `<p style="font-size:0.75rem; color:var(--clr-text-muted); margin-top:4px;">${helpText}</p>` : ''}
    </div>
  `;
}

function renderCompanyTabEmpresa(host) {
  const session = _getActiveSessionSafe();
  const settings = (typeof getSettings === 'function') ? getSettings() : {};
  const canEditCompany = (typeof isCurrentUserAdminOrFounder === 'function') ? isCurrentUserAdminOrFounder() : true;
  const rncExtraBtns = canEditCompany ? `
    <button class="btn-secondary" onclick="autoFillSettingsCompanyDGII()" style="margin:0; padding: 0 15px;" title="Buscar en DGII" type="button">🔍</button>
    <button class="btn-danger" onclick="clearSettingsCompanyRNC()" style="margin:0; padding: 0 12px; display:flex; align-items:center; justify-content:center; background: var(--clr-danger-soft); border-color: var(--clr-danger);" title="Eliminar RNC" type="button">🗑</button>
  ` : '';

  host.innerHTML = `
    ${_renderParametrizarEmpresaBar(
      'Datos Generales y Membresía de Empresa',
      'Gestiona el código de acceso compartido, los miembros vinculados, la identidad fiscal y el membrete.'
    )}

    <div class="settings-grid">
      <!-- ===== COMPARTIR EN EMPRESA ===== -->
      <div class="card card--elevated settings-section" style="grid-column: span 2;">
        <h3 class="settings-section-title">🏢 Compartir en Empresa</h3>
        <div id="settings-family-container">
          <div style="font-size:0.85rem;color:var(--clr-text-muted);">Cargando...</div>
        </div>
      </div>

      <!-- ===== REGISTRO DE EMPRESA ===== -->
      <div class="card card--elevated settings-section" style="grid-column: span 2;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
          <h3 class="settings-section-title" style="margin:0;">🏢 Registro de Empresa</h3>
          <span id="company-reg-sync-status" style="font-size:0.74rem; font-weight:600; padding:4px 10px; border-radius:999px; border:1px solid rgba(16, 185, 129, 0.4); background:rgba(16, 185, 129, 0.14); color:#6ee7b7;">
            ☁️ Sincronizado con la base de datos
          </span>
        </div>

        ${!canEditCompany
          ? `<div style="background: rgba(234, 179, 8, 0.1); border: 1px solid #eab308; border-radius: var(--r-md); padding: 12px; margin-bottom: 16px; font-size: 0.85rem; color: #eab308; display: flex; align-items: center; gap: 8px;"><span>⚠️</span> <span>Estos datos son compartidos por toda la empresa. Solo el <b>Administrador</b> puede modificarlos.</span></div>`
          : ''
        }

        <div class="form-row" style="grid-template-columns: 1fr 1fr; gap: var(--sp-lg); align-items: start;">
          <!-- Columna Izquierda: Formulario -->
          <div style="display:flex; flex-direction:column; gap:14px;">
            ${_renderCompanyFieldRow({
              fieldKey: 'companyName',
              inputId: 'set-company-name',
              label: 'Nombre de la Empresa',
              type: 'text',
              placeholder: 'Ej: Mi Recicladora',
              value: settings.companyName || '',
              helpText: 'Aparecerá en el menú lateral y como nombre de la empresa emisora en facturas.',
              canEditCompany
            })}

            ${_renderCompanyFieldRow({
              fieldKey: 'companyRNC',
              inputId: 'set-company-rnc',
              label: 'RNC de tu Compañía',
              type: 'text',
              placeholder: '9 u 11 dígitos',
              value: settings.companyRNC || '',
              helpText: 'Se usará en la generación de facturas (PDF).',
              extraButtonsHtml: rncExtraBtns,
              canEditCompany
            })}

            ${_renderCompanyFieldRow({
              fieldKey: 'companyPhone',
              inputId: 'set-company-phone',
              label: 'Teléfono de la Empresa',
              type: 'text',
              placeholder: 'Ej: +1 (849) 585-0386',
              value: settings.companyPhone || '',
              helpText: 'Se usará en la generación de facturas (PDF).',
              canEditCompany
            })}

            ${_renderCompanyFieldRow({
              fieldKey: 'companyEmail',
              inputId: 'set-company-email',
              label: 'Correo Electrónico',
              type: 'email',
              placeholder: 'Ej: contacto@empresa.com',
              value: settings.companyEmail || session.email || '',
              helpText: 'Se usará en la generación de facturas (PDF).',
              canEditCompany
            })}

            ${_renderCompanyFieldRow({
              fieldKey: 'companyAddress',
              inputId: 'set-company-address',
              label: 'Dirección de la Empresa',
              type: 'text',
              placeholder: 'Ej: Calle Duarte #12, Santo Domingo',
              value: settings.companyAddress || '',
              helpText: 'Se usará en la generación de facturas (PDF).',
              canEditCompany
            })}

            <div class="form-group">
              <label class="form-label" for="set-company-logo">Logo de la App / Membrete (Opcional)</label>
              <div style="display:flex; gap:8px; align-items:stretch; flex-wrap:wrap;">
                <input id="set-company-logo" type="file" accept="image/*" class="form-input" style="flex:1; min-width:170px;" onchange="handleSettingsLogoUpload(this)" ${!canEditCompany ? 'disabled' : ''} />
                ${canEditCompany ? `
                  <button id="btn-edit-company-logo" type="button" class="btn-secondary" onclick="triggerEditCompanyLogo()" title="Cambiar / Editar logo y subir a Supabase" style="margin:0; padding:0 12px; white-space:nowrap; font-size:0.82rem;">✏️ Editar</button>
                  <button id="btn-clear-company-logo" type="button" class="btn-danger" onclick="clearSettingsCompanyLogo()" title="Quitar logo" style="margin:0; padding:0 12px; display:flex; align-items:center; justify-content:center; background: var(--clr-danger-soft); border-color: var(--clr-danger);">🗑</button>
                ` : ''}
              </div>
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

        ${canEditCompany
          ? `<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-top:20px; padding-top:15px; border-top:1px solid var(--clr-border);">
              <button type="button" class="btn-secondary" onclick="restoreWhiteLabelToOriginal()" style="color: #ef4444; border-color: #ef4444; background: rgba(239, 68, 68, 0.05); font-weight:600; display:flex; align-items:center; gap:6px;">
                🔄 Restaurar Todo al Original
              </button>
              <button id="btn-save-company-registration" type="button" class="btn-primary" onclick="saveAllCompanyRegistrationSettings()" style="font-weight:700; display:flex; align-items:center; gap:8px; padding:10px 18px;">
                💾 Guardar Datos de Empresa
              </button>
            </div>`
          : ''
        }
      </div>
    </div>
  `;

  setTimeout(() => {
    if (typeof renderFamilySection === 'function') {
      renderFamilySection();
    }
    try {
      const shared = JSON.parse(localStorage.getItem(userKey('recim_company_shared_settings')) || '{}');
      if (shared && shared._pendingCloudSync && typeof window._setCompanyRegSyncStatus === 'function') {
        window._setCompanyRegSyncStatus('offline');
      }
    } catch (_) {}
  }, 0);

  if (typeof window.syncPullCompanySettingsOnly === 'function') {
    window.syncPullCompanySettingsOnly().then((res) => {
      if (res && res.changed && typeof window.refreshCompanyRegistrationInputsFromStorage === 'function') {
        window.refreshCompanyRegistrationInputsFromStorage({ preserveFocused: true });
      }
      if (res && res.ok && typeof window._setCompanyRegSyncStatus === 'function') {
        window._setCompanyRegSyncStatus('saved');
      }
    }).catch(() => {});
  }
}

function refreshCompanyRegistrationInputsFromStorage({ preserveFocused = true } = {}) {
  const settings = (typeof getSettings === 'function') ? getSettings() : {};
  const session = _getActiveSessionSafe();
  const activeEl = preserveFocused ? document.activeElement : null;
  const canEditCompany = (typeof isCurrentUserAdminOrFounder === 'function') ? isCurrentUserAdminOrFounder() : true;

  const fieldMap = [
    ['set-company-name', settings.companyName || ''],
    ['set-company-rnc', settings.companyRNC || ''],
    ['set-company-phone', settings.companyPhone || ''],
    ['set-company-email', settings.companyEmail || session.email || ''],
    ['set-company-address', settings.companyAddress || '']
  ];

  fieldMap.forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.dataset && el.dataset.editing === 'true') return;
    if (preserveFocused && activeEl === el) return;
    if (el.value !== val) {
      el.value = val;
    }
    if (el.dataset) {
      el.dataset.originalValue = val;
    }
    if (canEditCompany && !el.disabled) {
      el.readOnly = Boolean(String(val || '').trim());
    }
  });

  const previewContainer = document.getElementById('set-logo-preview-container');
  if (previewContainer) {
    if (settings.companyLogo) {
      previewContainer.innerHTML = '';
      const img = document.createElement('img');
      img.src = settings.companyLogo;
      img.alt = 'Logo de la empresa';
      img.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain;';
      previewContainer.appendChild(img);
    } else {
      previewContainer.innerHTML = `<span style="font-size: 0.9rem; color: var(--clr-text-muted);">Sin Logo</span>`;
    }
  }

  try {
    const shared = JSON.parse(localStorage.getItem(userKey('recim_company_shared_settings')) || '{}');
    if (typeof window._setCompanyRegSyncStatus === 'function') {
      window._setCompanyRegSyncStatus(shared && shared._pendingCloudSync ? 'offline' : 'saved');
    }
  } catch (_) {}
}
window.refreshCompanyRegistrationInputsFromStorage = refreshCompanyRegistrationInputsFromStorage;

// =============================================
// 5. VENTANA 2: ACCESOS Y DISPOSITIVOS (SOLO CEO)
// =============================================

function renderCompanyTabAccesos(host) {
  if (!isCurrentUserCompanyCEO()) {
    host.innerHTML = '';
    return;
  }

  host.innerHTML = `
    ${_renderParametrizarEmpresaBar(
      'Auditoría de Accesos y Dispositivos',
      'Control exclusivo del CEO: usuarios que han ingresado en la app y desde qué dispositivo (Teléfono, Computadora o Web).'
    )}

    <!-- KPI Cards -->
    <div id="access-audit-kpis" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 18px;">
      <div class="card card--elevated" style="padding: 14px 16px;">
        <div style="font-size: 0.74rem; color: var(--clr-text-muted); text-transform: uppercase; font-weight: 600;">Total Accesos</div>
        <div id="kpi-acc-total" style="font-size: 1.5rem; font-weight: 800; color: var(--clr-text); margin-top: 4px;">0</div>
      </div>
      <div class="card card--elevated" style="padding: 14px 16px; border-top: 3px solid #10b981;">
        <div style="font-size: 0.74rem; color: var(--clr-text-muted); text-transform: uppercase; font-weight: 600;">📱 Teléfono</div>
        <div id="kpi-acc-tel" style="font-size: 1.5rem; font-weight: 800; color: #10b981; margin-top: 4px;">0</div>
      </div>
      <div class="card card--elevated" style="padding: 14px 16px; border-top: 3px solid #3b82f6;">
        <div style="font-size: 0.74rem; color: var(--clr-text-muted); text-transform: uppercase; font-weight: 600;">💻 Computadora</div>
        <div id="kpi-acc-pc" style="font-size: 1.5rem; font-weight: 800; color: #3b82f6; margin-top: 4px;">0</div>
      </div>
      <div class="card card--elevated" style="padding: 14px 16px; border-top: 3px solid #a855f7;">
        <div style="font-size: 0.74rem; color: var(--clr-text-muted); text-transform: uppercase; font-weight: 600;">🌐 Web</div>
        <div id="kpi-acc-web" style="font-size: 1.5rem; font-weight: 800; color: #a855f7; margin-top: 4px;">0</div>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="card card--elevated" style="padding: 14px 16px; margin-bottom: 16px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between;">
      <div style="display: flex; flex-wrap: wrap; gap: 6px;">
        <button type="button" class="${_accessAuditDeviceFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" style="padding: 6px 12px; font-size: 0.8rem;" onclick="setAccessAuditFilter('all')">Todos</button>
        <button type="button" class="${_accessAuditDeviceFilter === 'telefono' ? 'btn-primary' : 'btn-secondary'}" style="padding: 6px 12px; font-size: 0.8rem;" onclick="setAccessAuditFilter('telefono')">📱 Teléfono</button>
        <button type="button" class="${_accessAuditDeviceFilter === 'computadora' ? 'btn-primary' : 'btn-secondary'}" style="padding: 6px 12px; font-size: 0.8rem;" onclick="setAccessAuditFilter('computadora')">💻 Computadora</button>
        <button type="button" class="${_accessAuditDeviceFilter === 'web' ? 'btn-primary' : 'btn-secondary'}" style="padding: 6px 12px; font-size: 0.8rem;" onclick="setAccessAuditFilter('web')">🌐 Web</button>
      </div>
      <div style="display: flex; gap: 8px; flex: 1; max-width: 380px; min-width: 220px;">
        <input type="text" id="access-audit-search" class="form-input" placeholder="🔍 Buscar usuario, correo o sucursal..." value="${_csEscapeHtml(_accessAuditSearch)}" oninput="onAccessAuditSearch(this.value)" style="flex: 1; height: 36px; font-size: 0.82rem;" />
        <button type="button" class="btn-secondary" onclick="loadAndRenderCompanyAccessLogs(true)" style="padding: 6px 12px; font-size: 0.82rem; white-space: nowrap;">🔄 Actualizar</button>
      </div>
    </div>

    <!-- Table Card -->
    <div class="card card--elevated" style="padding: 0; overflow: hidden;">
      <div id="company-access-audit-body" style="overflow-x: auto;">
        <div style="padding: 24px; text-align: center; color: var(--clr-text-muted); font-size: 0.88rem;">Cargando registros de acceso...</div>
      </div>
    </div>
  `;

  loadAndRenderCompanyAccessLogs(false);
}

function setAccessAuditFilter(cat) {
  _accessAuditDeviceFilter = cat || 'all';
  const host = document.getElementById('company-param-tab-content');
  if (host && _currentCompanyParamTab === 'accesos') {
    renderCompanyTabAccesos(host);
  }
}
window.setAccessAuditFilter = setAccessAuditFilter;

function onAccessAuditSearch(val) {
  _accessAuditSearch = val || '';
  renderAccessAuditRows();
}
window.onAccessAuditSearch = onAccessAuditSearch;

function _getLocalAccessLogs() {
  try {
    const raw = localStorage.getItem(userKey('recim_access_logs'));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function _mergeAccessLogLists(localList, remoteList) {
  const map = new Map();
  const addItem = (item) => {
    if (!item || typeof item !== 'object' || !item.id) return;
    const key = String(item.id);
    if (!map.has(key)) {
      map.set(key, item);
    } else {
      const existing = map.get(key);
      const tNew = new Date(item.lastAccessAt || item.updatedAt || 0).getTime();
      const tOld = new Date(existing.lastAccessAt || existing.updatedAt || 0).getTime();
      if (tNew >= tOld) {
        map.set(key, {
          ...existing,
          ...item,
          accessCount: Math.max(parseInt(item.accessCount || 1, 10), parseInt(existing.accessCount || 1, 10))
        });
      }
    }
  };
  (remoteList || []).forEach(addItem);
  (localList || []).forEach(addItem);
  return Array.from(map.values());
}

async function loadAndRenderCompanyAccessLogs(forceRefresh) {
  if (!isCurrentUserCompanyCEO()) return;

  const session = _getActiveSessionSafe();
  let logs = _getLocalAccessLogs();

  if (session.familyId && typeof isSupabaseActive !== 'undefined' && isSupabaseActive && typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      if (forceRefresh) {
        showToast('📡 Actualizando registros de acceso...', 'info');
      }

      const [familyRes, profilesRes] = await Promise.all([
        supabaseClient.from('user_data').select('data').eq('id', `family_${session.familyId}`).maybeSingle(),
        supabaseClient.from('profiles').select('id, name, email, role').eq('family_id', session.familyId)
      ]);

      if (profilesRes && Array.isArray(profilesRes.data)) {
        _cachedCompanyProfiles = profilesRes.data;
      }

      if (familyRes && familyRes.data && familyRes.data.data && Array.isArray(familyRes.data.data.recim_access_logs)) {
        logs = _mergeAccessLogLists(logs, familyRes.data.data.recim_access_logs);
        try {
          localStorage.setItem(userKey('recim_access_logs'), JSON.stringify(logs));
        } catch (_) {}
      }
    } catch (err) {
      console.warn('Aviso cargando auditoría de accesos desde Supabase:', err);
    }
  }

  renderAccessAuditRows(logs);
}
window.loadAndRenderCompanyAccessLogs = loadAndRenderCompanyAccessLogs;

function renderAccessAuditRows(logsOverride) {
  const body = document.getElementById('company-access-audit-body');
  if (!body) return;

  const logs = Array.isArray(logsOverride) ? logsOverride : _getLocalAccessLogs();
  const sorted = [...logs].sort((a, b) => new Date(b.lastAccessAt || b.updatedAt || 0).getTime() - new Date(a.lastAccessAt || a.updatedAt || 0).getTime());

  // Actualizar KPIs con el total sin filtrar
  const totalEl = document.getElementById('kpi-acc-total');
  const telEl = document.getElementById('kpi-acc-tel');
  const pcEl = document.getElementById('kpi-acc-pc');
  const webEl = document.getElementById('kpi-acc-web');

  if (totalEl) totalEl.textContent = String(sorted.length);
  if (telEl) telEl.textContent = String(sorted.filter(l => l.deviceCategory === 'telefono').length);
  if (pcEl) pcEl.textContent = String(sorted.filter(l => l.deviceCategory === 'computadora').length);
  if (webEl) webEl.textContent = String(sorted.filter(l => l.deviceCategory === 'web').length);

  let filtered = sorted;
  if (_accessAuditDeviceFilter !== 'all') {
    filtered = filtered.filter(l => l.deviceCategory === _accessAuditDeviceFilter);
  }
  const q = (_accessAuditSearch || '').trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(l =>
      (l.name || '').toLowerCase().includes(q) ||
      (l.email || '').toLowerCase().includes(q) ||
      (l.branchName || '').toLowerCase().includes(q) ||
      (l.deviceLabel || '').toLowerCase().includes(q) ||
      (l.deviceDetail || '').toLowerCase().includes(q) ||
      (l.deviceId || '').toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    body.innerHTML = `
      <div style="padding: 32px 20px; text-align: center; color: var(--clr-text-muted); font-size: 0.88rem;">
        No hay registros de acceso que coincidan con el filtro actual.
      </div>
    `;
    return;
  }

  const badgeStyleForCat = (cat) => {
    if (cat === 'telefono') return { bg: 'rgba(16, 185, 129, 0.14)', color: '#34d399', border: 'rgba(16, 185, 129, 0.35)', icon: '📱', label: 'Teléfono' };
    if (cat === 'computadora') return { bg: 'rgba(59, 130, 246, 0.14)', color: '#60a5fa', border: 'rgba(59, 130, 246, 0.35)', icon: '💻', label: 'Computadora' };
    return { bg: 'rgba(168, 85, 247, 0.14)', color: '#c084fc', border: 'rgba(168, 85, 247, 0.35)', icon: '🌐', label: 'Web' };
  };

  body.innerHTML = `
    <table class="data-table" style="width: 100%; min-width: 720px; border-collapse: collapse; font-size: 0.84rem;">
      <thead>
        <tr style="background: var(--clr-surface-2); border-bottom: 1px solid var(--clr-border);">
          <th style="text-align: left; padding: 12px 14px;">Usuario</th>
          <th style="text-align: left; padding: 12px 14px;">Sucursal</th>
          <th style="text-align: left; padding: 12px 14px;">Dispositivo</th>
          <th style="text-align: left; padding: 12px 14px;">ID Dispositivo</th>
          <th style="text-align: left; padding: 12px 14px;">Último Acceso</th>
          <th style="text-align: center; padding: 12px 14px;">Ingresos</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map(l => {
          const cleanName = (l.name || 'Usuario').split(' | ')[0].trim();
          const initial = (cleanName[0] || 'U').toUpperCase();
          const style = badgeStyleForCat(l.deviceCategory);
          const roleLabel = l.role === 'ceo' ? 'CEO' : (l.role === 'master' ? 'Master' : 'Colaborador');
          let dateStr = '—';
          if (l.lastAccessAt) {
            try {
              dateStr = new Date(l.lastAccessAt).toLocaleString('es-DO', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
              });
            } catch (_) {
              dateStr = l.lastAccessAt;
            }
          }
          return `
            <tr style="border-bottom: 1px solid var(--clr-border);">
              <td style="padding: 12px 14px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--clr-primary); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.82rem; flex-shrink: 0;">${_csEscapeHtml(initial)}</div>
                  <div>
                    <div style="font-weight: 600; color: var(--clr-text); display: flex; align-items: center; gap: 6px;">
                      <span>${_csEscapeHtml(cleanName)}</span>
                      <span class="badge" style="font-size: 0.66rem; padding: 1px 6px; border-radius: 4px; background: rgba(255,255,255,0.08); color: var(--clr-text-muted);">${_csEscapeHtml(roleLabel)}</span>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--clr-text-muted);">${_csEscapeHtml(l.email || '—')}</div>
                  </div>
                </div>
              </td>
              <td style="padding: 12px 14px; color: var(--clr-text-secondary); font-weight: 500;">
                📍 ${_csEscapeHtml(l.branchName || 'Sucursal Principal')}
              </td>
              <td style="padding: 12px 14px;">
                <span class="badge" style="display: inline-flex; align-items: center; gap: 5px; background: ${style.bg}; color: ${style.color}; border: 1px solid ${style.border}; padding: 3px 9px; border-radius: 999px; font-size: 0.75rem; font-weight: 700;">
                  ${style.icon} ${_csEscapeHtml(l.deviceLabel || style.label)}
                </span>
                <div style="font-size: 0.72rem; color: var(--clr-text-muted); margin-top: 3px;">${_csEscapeHtml(l.deviceDetail || '')}</div>
              </td>
              <td style="padding: 12px 14px; font-family: monospace; font-size: 0.76rem; color: var(--clr-text-muted);">
                ${_csEscapeHtml(l.deviceId || '—')}
              </td>
              <td style="padding: 12px 14px; font-size: 0.8rem; color: var(--clr-text-secondary); white-space: nowrap;">
                ${_csEscapeHtml(dateStr)}
              </td>
              <td style="padding: 12px 14px; text-align: center; font-weight: 700; color: var(--clr-primary);">
                ${parseInt(l.accessCount || 1, 10)}
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

// =============================================
// 6. VENTANA 3: SUCURSALES (CREAR, GESTIONAR, USUARIOS, EDITAR)
// =============================================

function _canManageBranches() {
  return isCurrentUserCompanyCEO() || (typeof isCurrentUserAdminOrFounder === 'function' && isCurrentUserAdminOrFounder());
}

function renderCompanyTabSucursales(host) {
  const canManage = _canManageBranches();

  host.innerHTML = `
    ${_renderParametrizarEmpresaBar(
      'Gestión de Sucursales',
      'Crea sucursales con su código/contraseña de acceso, gestiona sus datos y consulta cuántos usuarios pertenecen a cada una.'
    )}

    <div class="card card--elevated" style="padding: 14px 18px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
      <div id="branches-summary-badges" style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
        <span class="badge badge--blue" style="padding: 5px 10px; font-size: 0.78rem;">Cargando sucursales...</span>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button type="button" class="btn-secondary" onclick="loadAndRenderBranchesGrid(true)" style="font-size: 0.84rem; padding: 8px 12px;">🔄 Actualizar</button>
        ${canManage ? `
          <button type="button" class="btn-primary" onclick="openBranchEditorModal(null)" style="font-size: 0.86rem; font-weight: 700; padding: 8px 16px;">
            ➕ Nueva Sucursal
          </button>
        ` : ''}
      </div>
    </div>

    <div id="branches-grid-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 16px;">
      <div class="card card--elevated" style="padding: 24px; text-align: center; color: var(--clr-text-muted);">Cargando sucursales...</div>
    </div>
  `;

  loadAndRenderBranchesGrid(false);
}

async function _fetchAllCompanyUsersForBranches() {
  const session = _getActiveSessionSafe();
  let profiles = [];

  if (session.familyId && typeof isSupabaseActive !== 'undefined' && isSupabaseActive && typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      const [profRes, familyRes] = await Promise.all([
        supabaseClient.from('profiles').select('id, name, email, role').eq('family_id', session.familyId),
        supabaseClient.from('user_data').select('data').eq('id', `family_${session.familyId}`).maybeSingle()
      ]);

      if (profRes && Array.isArray(profRes.data)) {
        profiles = profRes.data;
        _cachedCompanyProfiles = profiles;
      }

      if (familyRes && familyRes.data && familyRes.data.data) {
        const remote = familyRes.data.data;
        if (Array.isArray(remote.recim_branches) && remote.recim_branches.length > 0) {
          saveCompanyBranches(remote.recim_branches, { isBootInit: true });
        }
        if (Array.isArray(remote.recim_branch_members)) {
          const localMembers = getBranchMembers();
          const map = new Map();
          remote.recim_branch_members.forEach(m => { if (m && m.accountId) map.set(m.accountId, m); });
          localMembers.forEach(m => {
            if (!m || !m.accountId) return;
            const prev = map.get(m.accountId);
            if (!prev || new Date(m.updatedAt || 0).getTime() > new Date(prev.updatedAt || 0).getTime()) {
              map.set(m.accountId, m);
            }
          });
          localStorage.setItem(userKey('recim_branch_members'), JSON.stringify(Array.from(map.values())));
        }
      }
    } catch (err) {
      console.warn('Aviso cargando miembros de sucursales:', err);
    }
  }

  const branches = getCompanyBranches();
  const mainBranch = branches.find(b => b && (b.isMain || b.id === 'SUC-PRINCIPAL')) || branches[0];
  const mainBranchId = mainBranch ? mainBranch.id : 'SUC-PRINCIPAL';
  const branchMap = new Map(branches.map(b => [b.id, b]));
  const storedMembers = getBranchMembers();
  const accessLogs = _getLocalAccessLogs();

  const unifiedMap = new Map();

  // 1. Iniciar desde perfiles reales de la empresa en Supabase
  profiles.forEach(p => {
    if (!p || !p.id) return;
    const cleanName = (p.name || 'Usuario').split(' | ')[0].trim();
    unifiedMap.set(p.id, {
      accountId: p.id,
      name: cleanName,
      email: p.email || '',
      role: p.role || 'colaborador',
      branchId: mainBranchId,
      branchName: mainBranch ? mainBranch.name : 'Sucursal Principal'
    });
  });

  // 2. Fallback con el usuario actual si está offline o sin profiles remotos
  if (session.accountId && !unifiedMap.has(session.accountId)) {
    const cleanName = (session.name || 'Usuario').split(' | ')[0].trim();
    unifiedMap.set(session.accountId, {
      accountId: session.accountId,
      name: cleanName,
      email: session.email || '',
      role: session.role || (isCurrentUserCompanyCEO() ? 'ceo' : 'colaborador'),
      branchId: session.branchId || mainBranchId,
      branchName: session.branchName || (mainBranch ? mainBranch.name : 'Sucursal Principal')
    });
  }

  // 3. Aplicar asignaciones de accessLogs como pista secundaria
  accessLogs.forEach(l => {
    if (!l || !l.accountId) return;
    const existing = unifiedMap.get(l.accountId);
    if (existing && l.branchId && branchMap.has(l.branchId)) {
      existing.branchId = l.branchId;
      existing.branchName = branchMap.get(l.branchId).name;
    }
  });

  // 3.5. Incorporar empleados/colaboradores registrados en recim_collaborators
  let colabsList = [];
  try {
    const rawColabs = localStorage.getItem(userKey('recim_collaborators'));
    const parsedColabs = rawColabs ? JSON.parse(rawColabs) : [];
    if (Array.isArray(parsedColabs)) colabsList = parsedColabs;
  } catch (_) {}

  colabsList.forEach(c => {
    if (!c || typeof c !== 'object') return;
    const colabName = (c.name || `${c.firstName || ''} ${c.lastName || ''}`).trim() || 'Colaborador';
    const colabEmail = (c.email || '').trim();
    const colabBranchId = (c.branchId && branchMap.has(c.branchId)) ? c.branchId : mainBranchId;
    const colabBranchName = branchMap.has(colabBranchId) ? branchMap.get(colabBranchId).name : (c.branchName || (mainBranch ? mainBranch.name : 'Sucursal Principal'));

    let matchedKey = null;
    if (c.linkedAccountId && unifiedMap.has(c.linkedAccountId)) {
      matchedKey = c.linkedAccountId;
    } else if (colabEmail) {
      for (const [k, u] of unifiedMap.entries()) {
        if (u && u.email && u.email.trim().toLowerCase() === colabEmail.toLowerCase()) {
          matchedKey = k;
          break;
        }
      }
    }

    const key = matchedKey || c.linkedAccountId || c.id;
    if (!key) return;
    const prev = unifiedMap.get(key) || {};
    unifiedMap.set(key, {
      accountId: key,
      collabId: c.id || prev.collabId || '',
      name: (prev.name || colabName).split(' | ')[0].trim(),
      email: prev.email || colabEmail || c.cedula || '',
      role: prev.role || c.role || 'colaborador',
      branchId: (c.branchId && branchMap.has(c.branchId)) ? c.branchId : (prev.branchId || colabBranchId),
      branchName: (c.branchId && branchMap.has(c.branchId)) ? branchMap.get(c.branchId).name : (prev.branchName || colabBranchName)
    });
  });

  // 4. Aplicar asignaciones explícitas de recim_branch_members (prioridad máxima)
  storedMembers.forEach(m => {
    if (!m || !m.accountId) return;
    const targetBranchId = branchMap.has(m.branchId) ? m.branchId : mainBranchId;
    const targetBranchName = branchMap.has(targetBranchId) ? branchMap.get(targetBranchId).name : (m.branchName || 'Sucursal Principal');
    const prev = unifiedMap.get(m.accountId) || {};
    unifiedMap.set(m.accountId, {
      accountId: m.accountId,
      collabId: m.collabId || prev.collabId || '',
      name: (m.name || prev.name || 'Usuario').split(' | ')[0].trim(),
      email: m.email || prev.email || '',
      role: prev.role || m.role || 'colaborador',
      branchId: targetBranchId,
      branchName: targetBranchName
    });
  });

  return Array.from(unifiedMap.values());
}

async function loadAndRenderBranchesGrid(forceRefresh) {
  const grid = document.getElementById('branches-grid-container');
  const summaryEl = document.getElementById('branches-summary-badges');
  if (!grid) return;

  if (forceRefresh) {
    showToast('📡 Sincronizando sucursales y usuarios...', 'info');
  }

  const allUsers = await _fetchAllCompanyUsersForBranches();
  const branches = getCompanyBranches();
  const canManage = _canManageBranches();
  const session = _getActiveSessionSafe();

  const activeCount = branches.filter(b => b.active !== false).length;
  if (summaryEl) {
    summaryEl.innerHTML = `
      <span class="badge badge--green" style="padding: 5px 10px; font-size: 0.78rem;">📍 ${branches.length} Sucursal${branches.length === 1 ? '' : 'es'}</span>
      <span class="badge badge--blue" style="padding: 5px 10px; font-size: 0.78rem;">✅ ${activeCount} Activa${activeCount === 1 ? '' : 's'}</span>
      <span class="badge" style="padding: 5px 10px; font-size: 0.78rem; background: rgba(168,85,247,0.14); color: #c084fc; border: 1px solid rgba(168,85,247,0.3);">👥 ${allUsers.length} Usuario${allUsers.length === 1 ? '' : 's'} en total</span>
    `;
  }

  if (branches.length === 0) {
    grid.innerHTML = `
      <div class="card card--elevated" style="padding: 28px; text-align: center; color: var(--clr-text-muted); grid-column: 1 / -1;">
        No hay sucursales registradas todavía. Crea la primera usando el botón <b>➕ Nueva Sucursal</b>.
      </div>
    `;
    return;
  }

  grid.innerHTML = branches.map(b => {
    const membersInBranch = allUsers.filter(u => u.branchId === b.id);
    const userCount = membersInBranch.length;
    const isActive = b.active !== false;
    const isMyBranch = session.branchId === b.id;

    return `
      <div class="card card--elevated" style="padding: 18px; display: flex; flex-direction: column; justify-content: space-between; gap: 14px; border: 1px solid ${b.isMain ? 'rgba(16, 185, 129, 0.45)' : 'var(--clr-border)'};">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 10px;">
            <div>
              <h4 style="margin: 0; font-size: 1.02rem; font-weight: 700; color: var(--clr-text); display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span>🏢 ${_csEscapeHtml(b.name || 'Sucursal')}</span>
              </h4>
            </div>
            <div style="display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end;">
              ${b.isMain ? '<span class="badge" style="background: rgba(245, 158, 11, 0.16); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); font-size: 0.68rem; padding: 2px 7px;">⭐ Principal</span>' : ''}
              <span class="badge ${isActive ? 'badge--green' : 'badge--red'}" style="font-size: 0.68rem; padding: 2px 7px;">${isActive ? 'Activa' : 'Inactiva'}</span>
              ${isMyBranch ? '<span class="badge badge--blue" style="font-size: 0.68rem; padding: 2px 7px;">Tu sucursal</span>' : ''}
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.82rem; color: var(--clr-text-secondary);">
            <div>📍 <b>Ubicación:</b> ${_csEscapeHtml(b.location || 'Sin ubicación registrada')}</div>
            <div>📞 <b>Teléfono:</b> ${_csEscapeHtml(b.phone || 'Sin teléfono')}</div>
            ${b.email ? `<div>✉️ <b>Correo:</b> ${_csEscapeHtml(b.email)}</div>` : ''}
          </div>

          <div style="margin-top: 12px; padding: 10px 12px; background: var(--clr-surface-2); border: 1px dashed rgba(16, 185, 129, 0.35); border-radius: var(--r-md); display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <div>
              <div style="font-size: 0.68rem; text-transform: uppercase; color: var(--clr-text-muted); font-weight: 700;">🔑 Código de Acceso (Contraseña)</div>
              <div style="font-family: monospace; font-size: 0.92rem; font-weight: 700; color: var(--clr-primary); margin-top: 2px;">
                ${canManage ? _csEscapeHtml(b.code || 'Sin código asignado') : '•••••••• (Solo Admin/CEO)'}
              </div>
            </div>
            ${canManage && b.code ? `
              <button type="button" class="btn-secondary" onclick="copyBranchAccessCode('${_csEscapeHtml(b.code)}')" style="padding: 4px 8px; font-size: 0.74rem; white-space: nowrap;">📋 Copiar</button>
            ` : ''}
          </div>
        </div>

        <div style="border-top: 1px solid var(--clr-border); padding-top: 12px; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn-secondary" onclick="openBranchMembersModal('${_csEscapeHtml(b.id)}', false)" style="flex: 1; justify-content: space-between; font-size: 0.82rem; font-weight: 600; padding: 8px 12px;">
              <span>👥 Usuarios (${userCount})</span>
              <span class="badge badge--green" style="font-size: 0.75rem; padding: 2px 8px;">Ver</span>
            </button>
            ${canManage ? `
              <button type="button" class="btn-primary" onclick="openBranchMembersModal('${_csEscapeHtml(b.id)}', true)" style="flex: 1; justify-content: center; font-size: 0.82rem; font-weight: 700; padding: 8px 12px; background: rgba(16, 185, 129, 0.18); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.45);">
                ➕ Añadir Usuario
              </button>
            ` : ''}
          </div>

          ${canManage ? `
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn-primary" onclick="openBranchEditorModal('${_csEscapeHtml(b.id)}')" style="flex: 1; justify-content: center; font-size: 0.8rem; padding: 8px 10px;">
                ✏️ Editar Sucursal
              </button>
              ${!b.isMain ? `
                <button type="button" class="btn-danger" onclick="deleteCompanyBranch('${_csEscapeHtml(b.id)}')" style="justify-content: center; font-size: 0.8rem; padding: 8px 12px;">
                  🗑️ Eliminar
                </button>
              ` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}
window.loadAndRenderBranchesGrid = loadAndRenderBranchesGrid;

function copyBranchAccessCode(code) {
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => {
    showToast('📋 Código de sucursal copiado al portapapeles', 'success');
  }).catch(() => {
    showToast('❌ No se pudo copiar automáticamente', 'error');
  });
}
window.copyBranchAccessCode = copyBranchAccessCode;

function openBranchEditorModal(branchId) {
  if (!_canManageBranches()) {
    showToast('🔒 Solo el CEO o Administrador puede gestionar sucursales.', 'error');
    return;
  }

  document.getElementById('branch-editor-modal')?.remove();

  const branches = getCompanyBranches();
  const isEdit = Boolean(branchId);
  const branch = isEdit ? branches.find(b => b && b.id === branchId) : null;
  if (isEdit && !branch) {
    showToast('❌ Sucursal no encontrada.', 'error');
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'branch-editor-modal';
  overlay.className = 'modal-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  const defaultCode = isEdit ? (branch.code || '') : generateDefaultBranchCode();
  const isMain = Boolean(branch && branch.isMain);

  overlay.innerHTML = `
    <div class="modal" style="max-width: 520px; width: 92%;">
      <div class="modal-header">
        <h3 class="modal-title">${isEdit ? '✏️ Editar Sucursal' : '➕ Crear Nueva Sucursal'}</h3>
        <button type="button" class="modal-close" onclick="document.getElementById('branch-editor-modal')?.remove()">✕</button>
      </div>
      <form onsubmit="saveBranchFromModal(event)">
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 14px;">
          <input type="hidden" id="branch-ed-id" value="${_csEscapeHtml(isEdit ? branch.id : '')}" />

          <div class="form-group">
            <label class="form-label" for="branch-ed-name">Nombre de la Sucursal <span style="color:#10b981;">*</span></label>
            <input id="branch-ed-name" type="text" class="form-input" placeholder="Ej: Sucursal Santiago" value="${_csEscapeHtml(isEdit ? (branch.name || '') : '')}" required />
          </div>

          <div class="form-group">
            <label class="form-label" for="branch-ed-code">Código de Acceso (Contraseña para unirse) <span style="color:#10b981;">*</span></label>
            <div style="display: flex; gap: 8px;">
              <input id="branch-ed-code" type="text" class="form-input" placeholder="Ej: SUC-4821" value="${_csEscapeHtml(defaultCode)}" style="flex: 1; font-family: monospace; text-transform: uppercase;" required />
              <button type="button" class="btn-secondary" onclick="document.getElementById('branch-ed-code').value = generateDefaultBranchCode()" style="padding: 0 12px; font-size: 0.8rem; white-space: nowrap;">🎲 Generar</button>
            </div>
            <p style="font-size: 0.74rem; color: var(--clr-text-muted); margin-top: 4px;">
              Este código funcionará como contraseña obligatoria cuando un usuario nuevo elija unirse a esta sucursal al crear su cuenta.
            </p>
          </div>

          <div class="form-group">
            <label class="form-label" for="branch-ed-location">Ubicación / Dirección <span style="color:#10b981;">*</span></label>
            <input id="branch-ed-location" type="text" class="form-input" placeholder="Ej: Av. 27 de Febrero #102" value="${_csEscapeHtml(isEdit ? (branch.location || '') : '')}" required />
          </div>

          <div class="form-group">
            <label class="form-label" for="branch-ed-phone">Teléfono <span style="color:#10b981;">*</span></label>
            <input id="branch-ed-phone" type="tel" class="form-input" placeholder="Ej: 809-555-0101" value="${_csEscapeHtml(isEdit ? (branch.phone || '') : '')}" required />
          </div>

          <div class="form-group">
            <label class="form-label" for="branch-ed-email">Correo Electrónico (Opcional)</label>
            <input id="branch-ed-email" type="email" class="form-input" placeholder="Ej: sucursal@empresa.com" value="${_csEscapeHtml(isEdit ? (branch.email || '') : '')}" />
          </div>

          ${!isMain ? `
            <div class="form-group">
              <label class="form-label" for="branch-ed-active">Estado de la Sucursal</label>
              <select id="branch-ed-active" class="form-input" style="width: 100%;">
                <option value="true" ${(!isEdit || branch.active !== false) ? 'selected' : ''}>✅ Activa (Visible para nuevos registros)</option>
                <option value="false" ${(isEdit && branch.active === false) ? 'selected' : ''}>⛔ Inactiva</option>
              </select>
            </div>
          ` : `<input type="hidden" id="branch-ed-active" value="true" />`}
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-secondary" onclick="document.getElementById('branch-editor-modal')?.remove()">Cancelar</button>
          <button type="submit" class="btn-primary">💾 Guardar Sucursal</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
}
window.openBranchEditorModal = openBranchEditorModal;

async function saveBranchFromModal(evt) {
  if (evt) evt.preventDefault();
  if (!_canManageBranches()) return;

  const branchId = (document.getElementById('branch-ed-id')?.value || '').trim();
  const name = (document.getElementById('branch-ed-name')?.value || '').trim();
  const code = (document.getElementById('branch-ed-code')?.value || '').trim().toUpperCase();
  const location = (document.getElementById('branch-ed-location')?.value || '').trim();
  const phone = (document.getElementById('branch-ed-phone')?.value || '').trim();
  const email = (document.getElementById('branch-ed-email')?.value || '').trim();
  const activeVal = document.getElementById('branch-ed-active')?.value !== 'false';

  if (!name || !code || !location || !phone) {
    showToast('⚠️ Completa nombre, código de acceso, ubicación y teléfono.', 'warning');
    return;
  }

  if (code.length < 3) {
    showToast('⚠️ El código de sucursal debe tener al menos 3 caracteres.', 'warning');
    return;
  }

  const branches = getCompanyBranches();
  const duplicateCode = branches.find(b =>
    b && b.id !== branchId && b.code && b.code.trim().toUpperCase() === code
  );
  if (duplicateCode) {
    showToast(`❌ El código "${code}" ya está asignado a la sucursal "${duplicateCode.name}". Usa otro código.`, 'error');
    return;
  }

  const session = _getActiveSessionSafe();
  const nowIso = new Date().toISOString();
  let isMainEdited = false;

  if (branchId) {
    const idx = branches.findIndex(b => b && b.id === branchId);
    if (idx === -1) {
      showToast('❌ No se encontró la sucursal a editar.', 'error');
      return;
    }
    isMainEdited = Boolean(branches[idx].isMain);
    branches[idx] = {
      ...branches[idx],
      name,
      code,
      location,
      phone,
      email,
      active: isMainEdited ? true : activeVal,
      updatedAt: nowIso
    };
  } else {
    branches.push({
      id: `SUC-${Date.now()}`,
      name,
      code,
      location,
      phone,
      email,
      isMain: false,
      active: activeVal,
      createdBy: session.accountId || '',
      createdAt: nowIso,
      updatedAt: nowIso
    });
  }

  saveCompanyBranches(branches, { markModified: true });

  if (isMainEdited) {
    if (typeof saveSetting === 'function') {
      saveSetting('companyAddress', location);
      saveSetting('companyPhone', phone);
      if (email) saveSetting('companyEmail', email);
    }
    if (typeof saveSharedCompanySetting === 'function') {
      saveSharedCompanySetting('companyAddress', location);
      saveSharedCompanySetting('companyPhone', phone);
      if (email) saveSharedCompanySetting('companyEmail', email);
    }
  }

  // Si la sucursal editada es la sucursal activa del usuario actual, actualizar sesión
  if (branchId && session.branchId === branchId && typeof updateCurrentSession === 'function') {
    updateCurrentSession({ branchName: name, branchLocation: location, branchPhone: phone });
  }

  if (typeof window.syncPushData === 'function') {
    await window.syncPushData(true);
  }

  document.getElementById('branch-editor-modal')?.remove();
  showToast(branchId ? '✅ Sucursal actualizada correctamente' : '✅ Sucursal creada correctamente', 'success');
  loadAndRenderBranchesGrid(false);
}
window.saveBranchFromModal = saveBranchFromModal;

async function deleteCompanyBranch(branchId) {
  if (!_canManageBranches()) {
    showToast('🔒 No tienes permisos para eliminar sucursales.', 'error');
    return;
  }

  const branches = getCompanyBranches();
  const target = branches.find(b => b && b.id === branchId);
  if (!target) return;
  if (target.isMain) {
    showToast('⚠️ No se puede eliminar la Sucursal Principal.', 'warning');
    return;
  }

  const confirmed = window.AppDialog && typeof window.AppDialog.confirm === 'function'
    ? await window.AppDialog.confirm(`¿Eliminar la sucursal "${target.name}"? Los usuarios asignados pasarán a la Sucursal Principal.`, 'Eliminar Sucursal')
    : confirm(`¿Eliminar la sucursal "${target.name}"?`);
  if (!confirmed) return;

  const updatedBranches = branches.filter(b => b && b.id !== branchId);
  const mainBranch = updatedBranches.find(b => b && (b.isMain || b.id === 'SUC-PRINCIPAL')) || updatedBranches[0];
  saveCompanyBranches(updatedBranches, { markModified: true });

  // Reasignar miembros que estaban en la sucursal eliminada
  if (mainBranch) {
    const members = getBranchMembers().map(m => {
      if (m && m.branchId === branchId) {
        return { ...m, branchId: mainBranch.id, branchName: mainBranch.name, updatedAt: new Date().toISOString() };
      }
      return m;
    });
    localStorage.setItem(userKey('recim_branch_members'), JSON.stringify(members));
  }

  if (typeof window.syncPushData === 'function') {
    await window.syncPushData(true);
  }

  showToast('🗑️ Sucursal eliminada y usuarios reasignados.', 'success');
  loadAndRenderBranchesGrid(false);
}
window.deleteCompanyBranch = deleteCompanyBranch;

async function openBranchMembersModal(branchId, focusAdd = false) {
  document.getElementById('branch-members-modal')?.remove();

  const branches = getCompanyBranches();
  const branch = branches.find(b => b && b.id === branchId);
  if (!branch) return;

  const allUsers = await _fetchAllCompanyUsersForBranches();
  const inBranch = allUsers.filter(u => u.branchId === branchId);
  const otherUsers = allUsers.filter(u => u.branchId !== branchId);
  const canManage = _canManageBranches();

  const overlay = document.createElement('div');
  overlay.id = 'branch-members-modal';
  overlay.className = 'modal-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  overlay.innerHTML = `
    <div class="modal" style="max-width: 600px; width: 94%; max-height: 88vh; display: flex; flex-direction: column;">
      <div class="modal-header">
        <div>
          <h3 class="modal-title" style="margin: 0;">👥 Usuarios de ${_csEscapeHtml(branch.name)}</h3>
          <p style="margin: 4px 0 0 0; font-size: 0.78rem; color: var(--clr-text-muted);">${inBranch.length} usuario${inBranch.length === 1 ? '' : 's'} en esta sucursal</p>
        </div>
        <button type="button" class="modal-close" onclick="document.getElementById('branch-members-modal')?.remove()">✕</button>
      </div>

      <div class="modal-body" style="overflow-y: auto; display: flex; flex-direction: column; gap: 14px;">
        ${canManage ? `
          <div style="padding: 14px; background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--r-md); display: flex; flex-direction: column; gap: 12px;">
            <div style="font-size: 0.85rem; font-weight: 700; color: #34d399; display: flex; align-items: center; gap: 6px;">
              <span>➕ Añadir usuario a ${_csEscapeHtml(branch.name)}</span>
            </div>

            ${otherUsers.length > 0 ? `
              <div>
                <label class="form-label" for="assign-branch-user-select" style="font-size: 0.76rem; margin-bottom: 5px;">Seleccionar usuario o empleado existente de otra sucursal:</label>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  <select id="assign-branch-user-select" class="form-input" style="flex: 1; min-width: 200px; font-size: 0.82rem;">
                    <option value="">-- Selecciona un usuario o empleado --</option>
                    ${otherUsers.map(u => `<option value="${_csEscapeHtml(u.accountId)}">${_csEscapeHtml(u.name)} — ${_csEscapeHtml(u.branchName || 'Otra sucursal')}</option>`).join('')}
                  </select>
                  <button type="button" class="btn-primary" onclick="handleAssignSelectedUserToBranch('${_csEscapeHtml(branch.id)}')" style="padding: 8px 14px; font-size: 0.82rem; white-space: nowrap;">➕ Asignar aquí</button>
                </div>
              </div>
              <div style="border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 10px;"></div>
            ` : ''}

            <div>
              <label class="form-label" for="branch-new-user-name" style="font-size: 0.76rem; margin-bottom: 6px;">Registrar / añadir nuevo usuario o empleado directo en esta sucursal:</label>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; margin-bottom: 8px;">
                <input id="branch-new-user-name" type="text" class="form-input" placeholder="Nombre completo *" style="font-size: 0.82rem;" />
                <input id="branch-new-user-email" type="text" class="form-input" placeholder="Correo o Cédula (opcional)" style="font-size: 0.82rem;" />
                <select id="branch-new-user-role" class="form-input" style="font-size: 0.82rem;">
                  <option value="Colaborador">🤝 Colaborador / Operario</option>
                  <option value="Chofer">🚛 Chofer de Ruta</option>
                  <option value="Pesador">⚖️ Pesador</option>
                  <option value="Caja">💵 Caja / Facturación</option>
                  <option value="Administrador">👑 Administrador de Sucursal</option>
                </select>
              </div>
              <button type="button" class="btn-primary" onclick="handleCreateAndAssignUserToBranch('${_csEscapeHtml(branch.id)}')" style="width: 100%; justify-content: center; padding: 8px 14px; font-size: 0.82rem; font-weight: 700;">
                ➕ Añadir Usuario a ${_csEscapeHtml(branch.name)}
              </button>
            </div>
          </div>
        ` : ''}

        <div style="font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: var(--clr-text-muted); letter-spacing: 0.04em;">
          Usuarios asignados actualmente (${inBranch.length})
        </div>

        ${inBranch.length === 0
          ? `<div style="padding: 24px; text-align: center; color: var(--clr-text-muted); font-size: 0.86rem;">No hay usuarios asignados a esta sucursal aún. Usa el formulario de arriba para añadir el primero.</div>`
          : `<div style="display: flex; flex-direction: column; gap: 8px;">
              ${inBranch.map(u => {
                const initial = ((u.name || 'U')[0] || 'U').toUpperCase();
                const roleLabel = u.role === 'ceo' ? 'CEO' : (u.role === 'master' ? 'Master' : (u.role || 'Colaborador'));
                return `
                  <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; padding: 10px 12px; background: var(--clr-surface-2); border: 1px solid var(--clr-border); border-radius: var(--r-md);">
                    <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 180px;">
                      <div style="width: 34px; height: 34px; border-radius: 50%; background: var(--clr-primary); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; flex-shrink: 0;">${_csEscapeHtml(initial)}</div>
                      <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; font-size: 0.86rem; color: var(--clr-text); display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                          <span>${_csEscapeHtml(u.name)}</span>
                          <span class="badge badge--blue" style="font-size: 0.66rem; padding: 1px 6px;">${_csEscapeHtml(roleLabel)}</span>
                        </div>
                        <div style="font-size: 0.75rem; color: var(--clr-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${_csEscapeHtml(u.email || '—')}</div>
                      </div>
                    </div>
                    ${canManage && branches.length > 1 ? `
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <select class="form-input" style="font-size: 0.76rem; padding: 4px 8px; height: 32px; width: auto;" onchange="if(this.value && this.value !== '${_csEscapeHtml(branch.id)}') assignMemberToBranch('${_csEscapeHtml(u.accountId)}', this.value)" title="Cambiar de sucursal">
                          ${branches.map(bOpt => `<option value="${_csEscapeHtml(bOpt.id)}" ${bOpt.id === branch.id ? 'selected' : ''}>📍 ${_csEscapeHtml(bOpt.name)}</option>`).join('')}
                        </select>
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>`
        }
      </div>

      <div class="modal-footer">
        <button type="button" class="btn-secondary" onclick="document.getElementById('branch-members-modal')?.remove()">Cerrar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (focusAdd) {
    setTimeout(() => {
      const targetInput = document.getElementById('assign-branch-user-select') || document.getElementById('branch-new-user-name');
      targetInput?.focus();
    }, 50);
  }
}
window.openBranchMembersModal = openBranchMembersModal;

function _syncColabBranchInStorage(matchCriteria, branch) {
  if (!branch || !branch.id) return;
  try {
    const colabsKey = userKey('recim_collaborators');
    const colabs = JSON.parse(localStorage.getItem(colabsKey) || '[]');
    if (!Array.isArray(colabs)) return;
    let changed = false;
    colabs.forEach(c => {
      if (!c || typeof c !== 'object') return;
      const byId = matchCriteria.accountId && (c.id === matchCriteria.accountId || c.linkedAccountId === matchCriteria.accountId || c.id === matchCriteria.collabId);
      const byEmail = matchCriteria.email && c.email && c.email.trim().toLowerCase() === matchCriteria.email.trim().toLowerCase();
      const byName = matchCriteria.name && c.name && c.name.trim().toLowerCase() === matchCriteria.name.trim().toLowerCase();
      if (byId || byEmail || byName) {
        c.branchId = branch.id;
        c.branchName = branch.name;
        c.updatedAt = new Date().toISOString();
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem(colabsKey, JSON.stringify(colabs));
    }
  } catch (_) {}
}

async function handleCreateAndAssignUserToBranch(branchId) {
  if (!_canManageBranches()) {
    showToast('🔒 No tienes permisos para añadir usuarios a sucursales.', 'error');
    return;
  }

  const branches = getCompanyBranches();
  const branch = branches.find(b => b && b.id === branchId);
  if (!branch) return;

  const nameEl = document.getElementById('branch-new-user-name');
  const emailEl = document.getElementById('branch-new-user-email');
  const roleEl = document.getElementById('branch-new-user-role');

  const rawName = (nameEl?.value || '').trim();
  const rawEmail = (emailEl?.value || '').trim();
  const rawRole = (roleEl?.value || 'Colaborador').trim();

  if (!rawName) {
    showToast('⚠️ Escribe el nombre del usuario o empleado para añadirlo a la sucursal.', 'warning');
    nameEl?.focus();
    return;
  }

  const allUsers = await _fetchAllCompanyUsersForBranches();
  const existingUser = allUsers.find(u =>
    (rawEmail && u.email && u.email.trim().toLowerCase() === rawEmail.toLowerCase()) ||
    (u.name && u.name.trim().toLowerCase() === rawName.toLowerCase())
  );

  const nowIso = new Date().toISOString();
  const accountId = existingUser ? existingUser.accountId : `COLAB-${Date.now()}`;

  upsertBranchMember({
    accountId,
    name: rawName,
    email: rawEmail || (existingUser ? existingUser.email : ''),
    role: rawRole,
    branchId: branch.id,
    branchName: branch.name,
    updatedAt: nowIso
  });

  // Asegurar que también quede reflejado en recim_collaborators con su sucursal
  try {
    const colabsKey = userKey('recim_collaborators');
    const colabs = JSON.parse(localStorage.getItem(colabsKey) || '[]');
    const list = Array.isArray(colabs) ? colabs : [];
    const existingColabIdx = list.findIndex(c =>
      c && (
        c.id === accountId ||
        c.linkedAccountId === accountId ||
        (rawEmail && c.email && c.email.trim().toLowerCase() === rawEmail.toLowerCase()) ||
        (c.name && c.name.trim().toLowerCase() === rawName.toLowerCase())
      )
    );

    if (existingColabIdx >= 0) {
      list[existingColabIdx] = {
        ...list[existingColabIdx],
        branchId: branch.id,
        branchName: branch.name,
        role: list[existingColabIdx].role || rawRole,
        updatedAt: nowIso
      };
    } else {
      const nameParts = rawName.split(/\s+/);
      const firstName = nameParts[0] || rawName;
      const lastName = nameParts.slice(1).join(' ') || '—';
      const nextCode = typeof generateNextEmployeeCode === 'function'
        ? generateNextEmployeeCode(list)
        : `EMPL-${String(list.length + 1).padStart(5, '0')}`;
      list.unshift({
        id: accountId.startsWith('COLAB-') ? accountId : `COLAB-${Date.now()}`,
        code: nextCode,
        firstName,
        lastName,
        name: rawName,
        cedula: rawEmail && !rawEmail.includes('@') ? rawEmail : '000-0000000-0',
        nationality: 'Dominicana',
        gender: 'M',
        civilStatus: 'SOLTERO',
        phone: '',
        mobile: '',
        email: rawEmail.includes('@') ? rawEmail : '',
        address: branch.location || '',
        role: rawRole,
        department: 'Operaciones',
        status: 'ACTIVO',
        branchId: branch.id,
        branchName: branch.name,
        linkedAccountId: existingUser ? existingUser.accountId : '',
        isAdminColab: /admin/i.test(rawRole),
        modules: {},
        createdAt: nowIso
      });
    }
    localStorage.setItem(colabsKey, JSON.stringify(list));
  } catch (e) {
    console.warn('No se pudo sincronizar colaborador al añadir usuario en sucursal:', e);
  }

  if (typeof window.syncPushData === 'function') {
    await window.syncPushData(true);
  }

  showToast(`✅ ${rawName} añadido a ${branch.name}`, 'success');
  await openBranchMembersModal(branchId, false);
  loadAndRenderBranchesGrid(false);
}
window.handleCreateAndAssignUserToBranch = handleCreateAndAssignUserToBranch;

async function handleAssignSelectedUserToBranch(branchId) {
  const select = document.getElementById('assign-branch-user-select');
  const accountId = select ? select.value : '';
  if (!accountId) {
    showToast('⚠️ Selecciona un usuario primero.', 'warning');
    return;
  }
  await assignMemberToBranch(accountId, branchId);
}
window.handleAssignSelectedUserToBranch = handleAssignSelectedUserToBranch;

async function assignMemberToBranch(accountId, branchId) {
  if (!_canManageBranches()) {
    showToast('🔒 No tienes permisos para mover usuarios entre sucursales.', 'error');
    return;
  }

  const branches = getCompanyBranches();
  const branch = branches.find(b => b && b.id === branchId);
  if (!branch) return;

  const allUsers = await _fetchAllCompanyUsersForBranches();
  const targetUser = allUsers.find(u => u.accountId === accountId);
  if (!targetUser) return;

  upsertBranchMember({
    accountId: targetUser.accountId,
    name: targetUser.name,
    email: targetUser.email,
    role: targetUser.role,
    branchId: branch.id,
    branchName: branch.name,
    updatedAt: new Date().toISOString()
  });

  _syncColabBranchInStorage(targetUser, branch);

  const session = _getActiveSessionSafe();
  if (session.accountId === accountId && typeof updateCurrentSession === 'function') {
    updateCurrentSession({
      branchId: branch.id,
      branchName: branch.name,
      branchLocation: branch.location || '',
      branchPhone: branch.phone || ''
    });
    if (typeof saveSetting === 'function') {
      saveSetting('branchId', branch.id);
      saveSetting('branchName', branch.name);
    }
  }

  if (typeof window.syncPushData === 'function') {
    await window.syncPushData(true);
  }

  showToast(`✅ ${targetUser.name} asignado a ${branch.name}`, 'success');
  await openBranchMembersModal(branchId);
  loadAndRenderBranchesGrid(false);
}
window.assignMemberToBranch = assignMemberToBranch;

// =============================================
// 7. MODAL "PARAMETRIZAR EMPRESA" (SOLO CEO)
// =============================================

function openParametrizarEmpresaModal() {
  if (!isCurrentUserCompanyCEO()) {
    showToast('🔒 Solo el CEO de la empresa tiene acceso a esta opción.', 'error');
    return;
  }

  document.getElementById('parametrizar-empresa-modal')?.remove();

  const session = _getActiveSessionSafe();
  const settings = (typeof getSettings === 'function') ? getSettings() : {};
  let shared = {};
  try {
    shared = JSON.parse(localStorage.getItem(userKey('recim_company_shared_settings')) || '{}');
  } catch (_) {}

  const branches = getCompanyBranches();
  const mainBranch = branches.find(b => b && (b.isMain || b.id === 'SUC-PRINCIPAL')) || branches[0] || {};

  const currentName = (shared.companyName || settings.companyName || session.companyName || '').trim();
  const currentRNC = (shared.companyRNC || settings.companyRNC || session.companyRNC || '').trim();
  const currentAddress = (mainBranch.location || shared.companyAddress || settings.companyAddress || '').trim();
  const currentEmail = (mainBranch.email || shared.companyEmail || settings.companyEmail || session.email || '').trim();
  const currentPhone = (mainBranch.phone || shared.companyPhone || settings.companyPhone || '').trim();
  const currentCustomCode = (shared.customJoinCode || '').trim();

  const hasName = Boolean(currentName);
  const hasRNC = Boolean(currentRNC);

  const overlay = document.createElement('div');
  overlay.id = 'parametrizar-empresa-modal';
  overlay.className = 'modal-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  overlay.innerHTML = `
    <div class="modal" style="max-width: 560px; width: 94%; max-height: 90vh; display: flex; flex-direction: column;">
      <div class="modal-header">
        <div>
          <h3 class="modal-title" style="margin: 0;">⚙️ Parametrizar Empresa</h3>
          <p style="margin: 4px 0 0 0; font-size: 0.78rem; color: var(--clr-text-muted);">Configuración maestra exclusiva del CEO</p>
        </div>
        <button type="button" class="modal-close" onclick="document.getElementById('parametrizar-empresa-modal')?.remove()">✕</button>
      </div>

      <form onsubmit="saveParametrizarEmpresaModal(event)" style="display: flex; flex-direction: column; overflow: hidden; flex: 1;">
        <div class="modal-body" style="overflow-y: auto; display: flex; flex-direction: column; gap: 14px;">

          <div class="form-group">
            <label class="form-label" for="param-emp-name" style="display: flex; justify-content: space-between; align-items: center;">
              <span>Nombre de la Empresa (Razón Social) <span style="color:#10b981;">*</span></span>
              ${hasName ? '<span class="badge badge--green" style="font-size: 0.68rem; padding: 2px 7px;">✓ Ya registrado</span>' : ''}
            </label>
            <div style="display: flex; gap: 8px;">
              <input id="param-emp-name" type="text" class="form-input" value="${_csEscapeHtml(currentName)}" placeholder="Ej: Reciminsa SRL"
                     ${hasName ? 'readonly style="flex: 1; background: var(--clr-surface-2); opacity: 0.85;"' : 'style="flex: 1;"'} required />
              ${!hasName ? `<button type="button" class="btn-secondary" onclick="lookupParamEmpDGIIByName()" title="Buscar RNC por Nombre en DGII" style="padding: 0 12px;">🔍</button>` : ''}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="param-emp-rnc" style="display: flex; justify-content: space-between; align-items: center;">
              <span>RNC de la Empresa <span style="color:#10b981;">*</span></span>
              ${hasRNC ? '<span class="badge badge--green" style="font-size: 0.68rem; padding: 2px 7px;">✓ Ya registrado</span>' : ''}
            </label>
            <div style="display: flex; gap: 8px;">
              <input id="param-emp-rnc" type="text" class="form-input" value="${_csEscapeHtml(currentRNC)}" placeholder="9 u 11 dígitos"
                     ${hasRNC ? 'readonly style="flex: 1; background: var(--clr-surface-2); opacity: 0.85;"' : 'style="flex: 1;"'} required />
              ${!hasRNC ? `<button type="button" class="btn-secondary" onclick="lookupParamEmpDGIIByRNC()" title="Buscar Razón Social por RNC en DGII" style="padding: 0 12px;">🔍</button>` : ''}
            </div>
          </div>

          <div style="border-top: 1px solid var(--clr-border); padding-top: 12px;">
            <div style="font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: var(--clr-primary); margin-bottom: 10px;">
              📍 Datos de la Sucursal Principal
            </div>

            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label" for="param-emp-address">Ubicación de la Sucursal Principal <span style="color:#10b981;">*</span></label>
              <input id="param-emp-address" type="text" class="form-input" value="${_csEscapeHtml(currentAddress)}" placeholder="Ej: Calle Principal #12, Santo Domingo" required />
            </div>

            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label" for="param-emp-email">Correo Electrónico de la Sucursal Principal <span style="color:#10b981;">*</span></label>
              <input id="param-emp-email" type="email" class="form-input" value="${_csEscapeHtml(currentEmail)}" placeholder="Ej: contacto@empresa.com" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="param-emp-phone">Número de Teléfono de la Sucursal Principal <span style="color:#10b981;">*</span></label>
              <input id="param-emp-phone" type="tel" class="form-input" value="${_csEscapeHtml(currentPhone)}" placeholder="Ej: 809-555-0100" required />
            </div>
          </div>

          <div style="border-top: 1px solid var(--clr-border); padding-top: 12px;">
            <div class="form-group">
              <label class="form-label" for="param-emp-custom-code">🔑 Código Personalizado para Unirse a esta Empresa</label>
              <input id="param-emp-custom-code" type="text" class="form-input" maxlength="32" value="${_csEscapeHtml(currentCustomCode)}" placeholder="Ej: RECIMINSA-2026" style="font-family: monospace; text-transform: uppercase;" />
              <p style="font-size: 0.74rem; color: var(--clr-text-muted); margin-top: 5px; line-height: 1.4;">
                Opcional (4–32 caracteres, letras/números/guiones). Permite que nuevos usuarios se unan usando este código personalizado además del código numérico <b>${_csEscapeHtml(session.familyId || 'autogenerado')}</b>.
              </p>
            </div>
          </div>

        </div>

        <div class="modal-footer">
          <button type="button" class="btn-secondary" onclick="document.getElementById('parametrizar-empresa-modal')?.remove()">Cancelar</button>
          <button type="submit" id="param-emp-save-btn" class="btn-primary">💾 Guardar Parametrización</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
}
window.openParametrizarEmpresaModal = openParametrizarEmpresaModal;

async function lookupParamEmpDGIIByRNC() {
  const rncEl = document.getElementById('param-emp-rnc');
  const nameEl = document.getElementById('param-emp-name');
  if (!rncEl || typeof fetchDGIIData !== 'function') return;
  const val = (rncEl.value || '').trim();
  if (!val) {
    showToast('⚠️ Ingresa un RNC primero.', 'warning');
    return;
  }
  const data = await fetchDGIIData(val);
  if (data && data.name) {
    rncEl.value = (data.rnc || val).replace(/\D/g, '');
    if (nameEl && !nameEl.readOnly) nameEl.value = data.name;
  }
}
window.lookupParamEmpDGIIByRNC = lookupParamEmpDGIIByRNC;

async function lookupParamEmpDGIIByName() {
  const rncEl = document.getElementById('param-emp-rnc');
  const nameEl = document.getElementById('param-emp-name');
  if (!nameEl) return;
  const query = (nameEl.value || '').trim();
  if (!query || query.length < 3) {
    showToast('⚠️ Escribe al menos 3 caracteres del nombre.', 'warning');
    return;
  }

  let results = [];
  if (typeof searchDGIICompanies === 'function') {
    results = await searchDGIICompanies(query);
  } else if (typeof fetchDGIIData === 'function') {
    const single = await fetchDGIIData(query);
    if (single) results = [single];
  }

  if (results && results.length > 0) {
    const apply = (chosen) => {
      if (rncEl && !rncEl.readOnly) rncEl.value = (chosen.rnc || '').replace(/\D/g, '');
      if (nameEl && !nameEl.readOnly) nameEl.value = chosen.name || query;
    };
    if (results.length === 1) {
      apply(results[0]);
    } else if (typeof openDGIICompanyPickerModal === 'function') {
      openDGIICompanyPickerModal(results, apply);
    } else {
      apply(results[0]);
    }
  }
}
window.lookupParamEmpDGIIByName = lookupParamEmpDGIIByName;

async function saveParametrizarEmpresaModal(evt) {
  if (evt) evt.preventDefault();
  if (!isCurrentUserCompanyCEO()) {
    showToast('🔒 Solo el CEO de la empresa tiene acceso a esta opción.', 'error');
    return;
  }

  const nameVal = (document.getElementById('param-emp-name')?.value || '').trim();
  const rncVal = (document.getElementById('param-emp-rnc')?.value || '').trim();
  const addressVal = (document.getElementById('param-emp-address')?.value || '').trim();
  const emailVal = (document.getElementById('param-emp-email')?.value || '').trim();
  const phoneVal = (document.getElementById('param-emp-phone')?.value || '').trim();
  const rawCustom = (document.getElementById('param-emp-custom-code')?.value || '').trim();
  const customCode = rawCustom.toUpperCase().replace(/[^A-Z0-9_-]/g, '');

  if (!nameVal || !rncVal || !addressVal || !emailVal || !phoneVal) {
    showToast('⚠️ Completa todos los campos requeridos.', 'warning');
    return;
  }

  if (customCode && (customCode.length < 4 || customCode.length > 32)) {
    showToast('⚠️ El código personalizado debe tener entre 4 y 32 caracteres (letras, números, - o _).', 'warning');
    return;
  }

  const saveBtn = document.getElementById('param-emp-save-btn');
  if (saveBtn) saveBtn.disabled = true;

  try {
    let session = _getActiveSessionSafe();
    const prevAccountId = session.accountId;

    // Capturar ajustes y logo personales antes de migrar de cuenta individual a family_${newCode}
    let preMigrationSettings = null;
    let preMigrationShared = null;
    if (!session.familyId && prevAccountId) {
      try {
        const sRaw = localStorage.getItem(`recim_settings_${prevAccountId}`);
        if (sRaw) preMigrationSettings = JSON.parse(sRaw);
      } catch (_) {}
      try {
        const shRaw = localStorage.getItem(`recim_company_shared_settings_${prevAccountId}`);
        if (shRaw) preMigrationShared = JSON.parse(shRaw);
      } catch (_) {}
    }

    // Si la cuenta aún no tenía familyId, inicializar su empresa ahora
    if (!session.familyId) {
      let newCode = '';
      for (let i = 0; i < 10; i++) newCode += Math.floor(Math.random() * 10);
      session.familyId = newCode;
      session.role = 'ceo';
      session.isFounder = true;
      if (typeof calculateSecureChecksum === 'function') {
        session.signature = calculateSecureChecksum(session.accountId, session.email, newCode);
      }
      localStorage.setItem('recim_session', JSON.stringify(session));
      if (typeof BiometricAuthManager !== 'undefined' && typeof BiometricAuthManager.saveSessionToSQLite === 'function') {
        BiometricAuthManager.saveSessionToSQLite(session);
      }
      localStorage.setItem(userKey('recim_company_id'), newCode);
      if (session.accountId) {
        localStorage.setItem(userKey('recim_company_admin'), session.accountId);
      }

      if (preMigrationSettings && typeof preMigrationSettings === 'object') {
        try {
          localStorage.setItem(userKey('recim_settings'), JSON.stringify(preMigrationSettings));
        } catch (_) {}
      }
      if (preMigrationShared && typeof preMigrationShared === 'object') {
        try {
          localStorage.setItem(userKey('recim_company_shared_settings'), JSON.stringify(preMigrationShared));
        } catch (_) {}
      }

      if (typeof isSupabaseActive !== 'undefined' && isSupabaseActive && typeof supabaseClient !== 'undefined' && supabaseClient && session.accountId) {
        let { error: pErr } = await supabaseClient
          .from('profiles')
          .update({ family_id: newCode, role: 'ceo' })
          .eq('id', session.accountId);
        if (pErr && (pErr.code === 'PGRST204' || (pErr.message && pErr.message.includes('role')))) {
          await supabaseClient.from('profiles').update({ family_id: newCode }).eq('id', session.accountId);
        }
      }
    }

    const sharedKey = typeof userKey === 'function' ? userKey('recim_company_shared_settings') : 'recim_company_shared_settings';
    let shared = {};
    try { shared = JSON.parse(localStorage.getItem(sharedKey) || '{}'); } catch (_) {}
    if (!shared || typeof shared !== 'object') shared = {};
    const oldCustomCode = (shared.customJoinCode || '').trim().toUpperCase();

    // Verificar disponibilidad y actualizar alias en Supabase user_data
    if (typeof isSupabaseActive !== 'undefined' && isSupabaseActive && typeof supabaseClient !== 'undefined' && supabaseClient) {
      if (customCode) {
        const { data: existingAlias } = await supabaseClient
          .from('user_data')
          .select('data')
          .eq('id', `company_code_${customCode}`)
          .maybeSingle();

        if (existingAlias && existingAlias.data && existingAlias.data.familyId && existingAlias.data.familyId !== session.familyId) {
          showToast(`❌ El código personalizado "${customCode}" ya pertenece a otra empresa. Elige uno distinto.`, 'error');
          if (saveBtn) saveBtn.disabled = false;
          return;
        }
      }

      if (oldCustomCode && oldCustomCode !== customCode) {
        await supabaseClient
          .from('user_data')
          .delete()
          .eq('id', `company_code_${oldCustomCode}`);
      }

      if (customCode) {
        const { error: aliasErr } = await supabaseClient
          .from('user_data')
          .upsert({
            id: `company_code_${customCode}`,
            data: {
              type: 'company_code_alias',
              customCode,
              familyId: session.familyId,
              companyName: nameVal,
              updatedAt: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          });
        if (aliasErr) throw aliasErr;
      }
    }

    // Guardar datos de empresa en recim_settings y recim_company_shared_settings
    if (typeof saveSetting === 'function') {
      saveSetting('companyName', nameVal);
      saveSetting('companyRNC', rncVal);
      saveSetting('companyAddress', addressVal);
      saveSetting('companyEmail', emailVal);
      saveSetting('companyPhone', phoneVal);
      if (preMigrationShared && preMigrationShared.companyLogo && !shared.companyLogo) {
        shared.companyLogo = preMigrationShared.companyLogo;
      }
      if (shared.companyLogo) {
        saveSetting('companyLogo', shared.companyLogo);
      }
    }

    const nowIso = new Date().toISOString();
    shared.companyName = nameVal;
    shared.companyRNC = rncVal;
    shared.companyAddress = addressVal;
    shared.companyEmail = emailVal;
    shared.companyPhone = phoneVal;
    shared.customJoinCode = customCode || '';
    shared.updatedAt = nowIso;
    shared.branchesUpdatedAt = nowIso;
    if (session.accountId && !shared.founderId) {
      shared.founderId = session.accountId;
    }

    // Actualizar sucursal principal en recim_branches y shared.branches
    let branches = getCompanyBranches();
    const mainIdx = branches.findIndex(b => b && (b.isMain || b.id === 'SUC-PRINCIPAL'));
    if (mainIdx >= 0) {
      branches[mainIdx] = {
        ...branches[mainIdx],
        isMain: true,
        active: true,
        location: addressVal,
        email: emailVal,
        phone: phoneVal,
        code: branches[mainIdx].code || generateDefaultBranchCode(),
        updatedAt: nowIso
      };
    } else {
      branches.unshift({
        id: 'SUC-PRINCIPAL',
        name: 'Sucursal Principal',
        location: addressVal,
        email: emailVal,
        phone: phoneVal,
        code: generateDefaultBranchCode(),
        isMain: true,
        active: true,
        createdBy: session.accountId || '',
        createdAt: nowIso,
        updatedAt: nowIso
      });
    }

    shared.branches = branches;
    localStorage.setItem(sharedKey, JSON.stringify(shared));
    localStorage.setItem(userKey('recim_branches'), JSON.stringify(branches));

    if (typeof updateCurrentSession === 'function') {
      updateCurrentSession({ companyName: nameVal, companyRNC: rncVal });
    }

    if (typeof applySettings === 'function') {
      applySettings();
    }

    if (typeof window.syncSaveCompanySettingsToCloud === 'function') {
      const explicitClearedFields = !shared.customJoinCode ? ['customJoinCode'] : [];
      const cloudRes = await window.syncSaveCompanySettingsToCloud(shared, {
        allowEmptyOverwrite: false,
        explicitClearedFields
      });
      if (typeof isSupabaseActive !== 'undefined' && isSupabaseActive && typeof supabaseClient !== 'undefined' && supabaseClient && cloudRes && !cloudRes.ok) {
        throw (cloudRes.error || new Error('No se pudo persistir la configuración de empresa en Supabase.'));
      }
    }

    if (typeof window.syncPushData === 'function') {
      await window.syncPushData(true);
    }

    document.getElementById('parametrizar-empresa-modal')?.remove();
    showToast('✅ Parametrización de empresa guardada en la base de datos.', 'success');

    const pageContainer = document.getElementById('page-parametrizaciones_empresa');
    if (pageContainer) {
      renderParametrizacionesEmpresaPage(pageContainer, _currentCompanyParamTab);
    }
  } catch (err) {
    console.error('Error guardando parametrización de empresa:', err);
    showToast('❌ Error al guardar la parametrización: ' + (err.message || err), 'error');
    if (saveBtn) saveBtn.disabled = false;
  }
}
window.saveParametrizarEmpresaModal = saveParametrizarEmpresaModal;
