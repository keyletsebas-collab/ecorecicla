/* =============================================
   SYNC.JS – Sincronización en tiempo real entre pestañas
   Usa el evento nativo `storage` que el navegador dispara
   en todas las pestañas que NO hicieron el cambio.
   ============================================= */

(function () {
    // Keys that, when changed in another tab, should trigger a re-render
    const WATCHED_KEYS = [
        { pattern: 'recim_invoices', pages: ['historial', 'facturas'], label: '🧾 Facturas' },
        { pattern: 'recim_ncf_sequences', pages: ['facturas'], label: '🔢 Secuencias NCF' },
        { pattern: 'recim_quotes', pages: ['facturas'], label: '📋 Cotizaciones' },
        { pattern: 'recim_dispatches', pages: ['facturas'], label: '🚚 Despachos' },
        { pattern: 'recim_returns', pages: ['facturas'], label: '↩️ Devoluciones' },
        { pattern: 'recim_credit_notes', pages: ['facturas', 'historial'], label: '📄 Notas de Crédito' },
        { pattern: 'recim_debit_notes', pages: ['facturas', 'historial'], label: '📑 Notas de Débito' },
        { pattern: 'recim_material_codes', pages: ['codigos'], label: '🏷️ Materiales' },
        { pattern: 'recim_material_families', pages: ['codigos'], label: '📁 Familias' },
        { pattern: 'recim_clients', pages: ['clientes'], label: '👥 Clientes' },
        { pattern: 'recim_ingresos', pages: ['ingresos'], label: '💰 Ingresos' },
        { pattern: 'recim_egresos', pages: ['egresos'], label: '💸 Egresos' },
        { pattern: 'recim_company_admin', pages: ['ajustes', 'colaboradores'], label: '👑 Admin de Empresa' },
        { pattern: 'recim_collaborators', pages: ['colaboradores', 'ingresos', 'egresos', 'bitacoras'], label: '🤝 Colaboradores' },
        { pattern: 'recim_company_shared_settings', pages: ['ajustes', 'parametrizaciones_empresa'], label: '⚙️ Ajustes de Empresa' },
        { pattern: 'recim_branches', pages: ['parametrizaciones_empresa', 'ajustes', 'clientes', 'codigos'], label: '📍 Sucursales' },
        { pattern: 'recim_branch_members', pages: ['parametrizaciones_empresa', 'clientes', 'codigos'], label: '👥 Miembros por Sucursal' },
        { pattern: 'recim_access_logs', pages: ['parametrizaciones_empresa'], label: '📱 Registro de Accesos' },
        { pattern: 'recim_smart_alert_events', pages: ['historial', 'facturas'], label: '🔔 Alertas' },
        { pattern: 'recim_eco_certificates', pages: ['ecologia'], label: '🌱 Certificados' },
        { pattern: 'recim_pickup_routes', pages: ['rutas'], label: '🗺️ Agenda y Rutas' },
        { pattern: 'recim_audit_logs', pages: ['parametrizaciones_empresa'], label: '🛡️ Auditoría' },
        { pattern: 'recim_company_id', pages: ['ajustes', 'parametrizaciones_empresa'], label: '🏢 ID de Empresa' },
        { pattern: 'recim_backup_frequency', pages: ['ajustes'], label: '⏱️ Frecuencia de Respaldo' },
        { pattern: 'recim_gdrive_folder', pages: ['ajustes'], label: '📁 Carpeta Google Drive' },
        { pattern: 'recim_gdrive_status', pages: ['ajustes'], label: 'STATUS Google Drive' },
    ];

    // Special keys handled separately
    const SETTINGS_KEY = 'recim_settings';
    const USERS_KEY = 'recim_users';
    const COMPANY_FIELDS = ['companyName', 'companyRNC', 'companyPhone', 'companyEmail', 'companyAddress', 'companyLogo'];

    // Flag to prevent sync loop (pull triggering automatic push)
    let isSyncPulling = false;
    let initialPullCompletedDbId = null;
    let activePullPromise = null;
    let activePullDbId = null;
    let companySaveQueue = Promise.resolve();

    console.log("🔄 Sync Module v1.2 Active: Cloud company persistence & relational sync enabled.");

    function _isPlainObj(v) {
        return Boolean(v && typeof v === 'object' && !Array.isArray(v));
    }

    /**
     * Copy of recim_settings without companyLogo so base64 images are stored only once in recim_company_shared_settings.
     */
    function sanitizeSettingsForCloud(settingsObj) {
        if (!_isPlainObj(settingsObj)) return {};
        const copy = { ...settingsObj };
        delete copy.companyLogo;
        return copy;
    }

    /**
     * Keep local recim_settings synchronized with recim_company_shared_settings for PDFs, sidebar brand/logo, etc.
     */
    function hydrateLocalSettingsFromShared(sharedObj, allowEmpty = false) {
        if (!_isPlainObj(sharedObj)) return false;
        const prevPulling = isSyncPulling;
        isSyncPulling = true;
        try {
            const settingsKey = typeof userKey === 'function' ? userKey(SETTINGS_KEY) : SETTINGS_KEY;
            let localSettings = {};
            try { localSettings = JSON.parse(localStorage.getItem(settingsKey) || '{}'); } catch (_) {}
            if (!_isPlainObj(localSettings)) localSettings = {};

            const clearedSet = new Set(Array.isArray(sharedObj._explicitClearedFields) ? sharedObj._explicitClearedFields : []);
            let changed = false;

            for (const f of COMPANY_FIELDS) {
                const val = typeof sharedObj[f] === 'string' ? sharedObj[f] : (sharedObj[f] || '');
                const hasVal = Boolean(typeof val === 'string' ? val.trim() : val);
                if (hasVal) {
                    if (localSettings[f] !== val) {
                        localSettings[f] = val;
                        changed = true;
                    }
                    if (f === 'companyPhone' && localSettings.userPhone !== val) {
                        localSettings.userPhone = val;
                        changed = true;
                    }
                    if (f === 'companyEmail' && localSettings.userEmail !== val) {
                        localSettings.userEmail = val;
                        changed = true;
                    }
                } else if ((allowEmpty || clearedSet.has(f)) && Object.prototype.hasOwnProperty.call(sharedObj, f)) {
                    if (localSettings[f] !== '') {
                        localSettings[f] = '';
                        changed = true;
                    }
                    if (f === 'companyPhone' && localSettings.userPhone) {
                        localSettings.userPhone = '';
                        changed = true;
                    }
                    if (f === 'companyEmail' && localSettings.userEmail) {
                        localSettings.userEmail = '';
                        changed = true;
                    }
                }
            }

            if (changed) {
                try {
                    localStorage.setItem(settingsKey, JSON.stringify(localSettings));
                } catch (e) {
                    // Fallback: store without logo in recim_settings if localStorage quota is tight
                    if (localSettings.companyLogo) {
                        try {
                            const compact = { ...localSettings };
                            delete compact.companyLogo;
                            localStorage.setItem(settingsKey, JSON.stringify(compact));
                        } catch (_) {}
                    }
                    console.warn('⚠️ Advertencia hidratando recim_settings:', e);
                }
            }
            return changed;
        } finally {
            isSyncPulling = prevPulling;
        }
    }

    /**
     * Deterministically merge remote and local recim_company_shared_settings without losing saved fields
     * on partial boot writes or device restarts.
     */
    function mergeCompanySharedSettings(remoteShared, localShared, options = {}) {
        const remote = _isPlainObj(remoteShared) ? remoteShared : {};
        const local = _isPlainObj(localShared) ? localShared : {};

        const localTs = Date.parse(local.updatedAt || 0) || 0;
        const remoteTs = Date.parse(remote.updatedAt || 0) || 0;
        const localResetTs = Date.parse(local._explicitResetAt || 0) || 0;
        const remoteResetTs = Date.parse(remote._explicitResetAt || 0) || 0;

        const explicitCleared = new Set([
            ...(Array.isArray(options.explicitClearedFields) ? options.explicitClearedFields : []),
            ...(Array.isArray(local._explicitClearedFields) ? local._explicitClearedFields : [])
        ]);
        const remoteCleared = new Set(Array.isArray(remote._explicitClearedFields) ? remote._explicitClearedFields : []);

        const merged = { ...remote, ...local };

        // Preserve metadata safely
        if (local.founderId || remote.founderId) {
            merged.founderId = local.founderId || remote.founderId;
        }
        const mergedAdmins = Array.from(new Set([
            ...(Array.isArray(remote.companyAdmins) ? remote.companyAdmins : []),
            ...(Array.isArray(local.companyAdmins) ? local.companyAdmins : [])
        ].filter(Boolean)));
        if (mergedAdmins.length > 0) {
            merged.companyAdmins = mergedAdmins;
        }

        if (options.preferLocal && explicitCleared.has('customJoinCode')) {
            merged.customJoinCode = local.customJoinCode || '';
        } else if (!options.preferLocal && remoteTs > localTs && remoteCleared.has('customJoinCode')) {
            merged.customJoinCode = remote.customJoinCode || '';
        } else if (options.allowEmptyOverwrite && Object.prototype.hasOwnProperty.call(local, 'customJoinCode')) {
            merged.customJoinCode = local.customJoinCode || '';
        } else if (localTs > remoteTs && Object.prototype.hasOwnProperty.call(local, 'customJoinCode') && local.customJoinCode) {
            merged.customJoinCode = local.customJoinCode;
        } else {
            merged.customJoinCode = remote.customJoinCode || local.customJoinCode || '';
        }

        // Branches merge
        const localBranches = Array.isArray(local.branches) ? local.branches : [];
        const remoteBranches = Array.isArray(remote.branches) ? remote.branches : [];
        const localBranchesTs = Date.parse(local.branchesUpdatedAt || 0) || 0;
        const remoteBranchesTs = Date.parse(remote.branchesUpdatedAt || 0) || 0;
        if (options.preferLocal) {
            if (localBranches.length > 0 && (remoteBranches.length === 0 || localBranchesTs > remoteBranchesTs)) {
                merged.branches = localBranches;
            } else if (localBranches.length > 0 && remoteBranches.length > 0) {
                merged.branches = mergeItemsById(localBranches, remoteBranches);
            } else {
                merged.branches = remoteBranches.length > 0 ? remoteBranches : localBranches;
            }
        } else {
            if (local._pendingCloudSync && localBranches.length > 0 && localBranchesTs > remoteBranchesTs) {
                merged.branches = mergeItemsById(localBranches, remoteBranches);
            } else if (remoteBranches.length > 0 && remoteBranchesTs > localBranchesTs) {
                merged.branches = remoteBranches;
            } else if (localBranches.length > 0 && remoteBranches.length > 0) {
                merged.branches = mergeItemsById(localBranches, remoteBranches);
            } else {
                merged.branches = remoteBranches.length > 0 ? remoteBranches : localBranches;
            }
        }

        // Company identity & white-label fields
        for (const f of COMPANY_FIELDS) {
            const rVal = typeof remote[f] === 'string' ? remote[f] : (remote[f] || '');
            const lVal = typeof local[f] === 'string' ? local[f] : (local[f] || '');
            const rHas = Boolean(typeof rVal === 'string' ? rVal.trim() : rVal);
            const lHas = Boolean(typeof lVal === 'string' ? lVal.trim() : lVal);

            if (options.allowEmptyOverwrite && Object.prototype.hasOwnProperty.call(local, f)) {
                if (lHas) {
                    merged[f] = lVal;
                } else if (explicitCleared.size === 0 || explicitCleared.has(f)) {
                    merged[f] = '';
                } else {
                    merged[f] = rHas ? rVal : '';
                }
            } else if (options.preferLocal) {
                if (lHas) {
                    merged[f] = lVal;
                } else if (explicitCleared.has(f) || (localResetTs > 0 && localResetTs >= remoteTs && Object.prototype.hasOwnProperty.call(local, f))) {
                    merged[f] = '';
                } else if (rHas) {
                    merged[f] = rVal;
                } else {
                    merged[f] = '';
                }
            } else {
                // Pull path
                if (local._pendingCloudSync && localTs > remoteTs) {
                    merged[f] = lHas ? lVal : ((explicitCleared.has(f) || (localResetTs > 0 && localResetTs >= remoteTs)) ? '' : rVal);
                } else if (remoteTs > localTs) {
                    if (rHas) {
                        merged[f] = rVal;
                    } else if (remoteCleared.has(f) || (remoteResetTs > 0 && remoteResetTs >= localTs)) {
                        merged[f] = '';
                    } else {
                        merged[f] = lHas ? lVal : '';
                    }
                } else {
                    merged[f] = rHas ? rVal : (lHas ? lVal : '');
                }
            }
        }

        const newestTs = Math.max(localTs, remoteTs);
        if (newestTs > 0) {
            merged.updatedAt = new Date(newestTs).toISOString();
        }
        const newestResetTs = Math.max(localResetTs, remoteResetTs);
        if (newestResetTs > 0) {
            merged._explicitResetAt = new Date(newestResetTs).toISOString();
        }
        if (explicitCleared.size > 0 || remoteCleared.size > 0) {
            const combinedCleared = Array.from(new Set([...remoteCleared, ...explicitCleared])).filter(f => !merged[f]);
            if (combinedCleared.length > 0) {
                merged._explicitClearedFields = combinedCleared;
            } else {
                delete merged._explicitClearedFields;
            }
        }

        return merged;
    }

    /**
     * Returns the current logged-in user's accountId, or null if not logged in.
     */
    function getActiveAccountId() {
        try {
            const s = JSON.parse(localStorage.getItem('recim_session') || '{}');
            return s.accountId || null;
        } catch (_) { return null; }
    }

    /**
     * Get the page currently visible to the user.
     * Relies on the existing `getCurrentPage()` helper from app.js / sidebar.js.
     */
    function activePage() {
        try { return getCurrentPage(); } catch (_) { }
        // Fallback: inspect the DOM
        const active = document.querySelector('.sidebar-link.active');
        return active ? active.getAttribute('data-page') : null;
    }

    /**
     * Show a small sync-toast only when the tab is in the foreground.
     */
    function syncToast(label) {
        if (document.visibilityState !== 'visible') return;
        try {
            showToast(`🔄 ${label} actualizados desde otra pestaña`, 'info');
        } catch (_) { /* silent */ }
    }

    const FORM_PAGES_SENSITIVE_TO_SELECT = new Set([
        'bitacoras',
        'facturas',
        'nota_credito',
        'nota_debito',
        'parametrizaciones_empresa'
    ]);

    function isUserInteractingWithSelect() {
        if (window._activeMobileSheet) return true;
        const activeEl = document.activeElement;
        return Boolean(activeEl && activeEl.tagName && String(activeEl.tagName).toUpperCase() === 'SELECT');
    }

    /** Ejecuta el re-render de la vista actual con fallback seguro a navigate(). */
    function executeSyncRerender(page, fallbackNavigate) {
        try {
            rerenderCurrentPage();
            return true;
        } catch (_) {
            if (fallbackNavigate && page) {
                try { navigate(page); } catch (__) {}
            }
            return false;
        }
    }

    window._recimDeferredSyncRerender = null;

    window.flushDeferredSyncRerender = function (options = {}) {
        const pending = window._recimDeferredSyncRerender;
        if (!pending) return false;
        if (isUserInteractingWithSelect()) return false;

        window._recimDeferredSyncRerender = null;
        const page = activePage();
        if (!page) return false;

        if (options.reason === 'select' && FORM_PAGES_SENSITIVE_TO_SELECT.has(page)) {
            return false;
        }

        return executeSyncRerender(page, pending.fallbackNavigate);
    };

    function requestSafeSyncRerender(page, { fallbackNavigate = false } = {}) {
        if (isUserInteractingWithSelect()) {
            window._recimDeferredSyncRerender = {
                page: page || activePage(),
                fallbackNavigate: Boolean(fallbackNavigate),
                queuedAt: Date.now()
            };
            console.log('⏳ Sync rerender diferido: selector/dropdown activo.');
            return false;
        }

        window._recimDeferredSyncRerender = null;
        return executeSyncRerender(page, fallbackNavigate);
    }

    /**
     * Re-render the currently active page if it matches one of the affected pages.
     */
    function maybeRerender(affectedPages, label) {
        const page = activePage();
        if (!page) return;

        // Apply module visibility changes if collaborators are updated
        if (affectedPages.includes('colaboradores') && typeof applyModuleVisibility === 'function') {
            try { applyModuleVisibility(); } catch (_) {}
        }

        if (affectedPages.includes(page)) {
            syncToast(label);
            requestSafeSyncRerender(page, { fallbackNavigate: true });
        }
    }

    /**
     * Handle a settings change from another tab.
     * Re-applies theme, dark-mode and language without a full reload.
     */
    function handleSettingsSync(newValue) {
        try {
            const s = JSON.parse(newValue || '{}');
            // Re-apply color theme
            if (s.colorTheme) applyColorTheme(s.colorTheme, false);
            // Re-apply dark/light mode
            if (s.darkMode !== undefined) {
                document.documentElement.setAttribute('data-theme', s.darkMode ? 'dark' : 'light');
            }
            // Re-apply language then re-render
            if (s.language) {
                try { updateSidebarLabels(); } catch (_) { }
                try { rerenderCurrentPage(); } catch (_) { }
            }
            syncToast('Ajustes');
        } catch (_) { }
    }

    /**
     * Handle a users-record change from another tab (e.g. name update).
     * If the active user's record changed, refresh the sidebar avatar/name.
     */
    function handleUsersSync(newValue) {
        try {
            const accountId = getActiveAccountId();
            if (!accountId) return;
            const users = JSON.parse(newValue || '[]');
            const me = users.find(u => u.accountId === accountId);
            if (!me) return;

            const nameEl = document.getElementById('sidebar-user-name');
            const avatarEl = document.getElementById('sidebar-avatar');
            if (nameEl) nameEl.textContent = me.name;
            if (avatarEl) avatarEl.textContent = (me.avatar || me.name[0]).toUpperCase();
            syncToast('Perfil');
        } catch (_) { }
    }

    // ---- Cloud Sync Logic (Supabase) ----

    /**
     * Returns the appropriate cloud database ID (either family ID or user account ID).
     */
    function getSyncDbId() {
        try {
            const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
            if (session.accountId) {
                if (typeof calculateSecureChecksum === 'function') {
                    const expectedSig = calculateSecureChecksum(session.accountId, session.email, session.familyId);
                    if (session.signature !== expectedSig) {
                        session.signature = expectedSig;
                        try {
                            localStorage.setItem('recim_session', JSON.stringify(session));
                        } catch (_) {}
                    }
                }
            }
            if (session.familyId) {
                return `family_${session.familyId}`;
            }
            return session.accountId || null;
        } catch (_) { return null; }
    }

    /**
     * Helper: Combina elementos de arreglos por su ID/código sin destruir registros de otros empleados.
     */
    function mergeItemsById(localList, remoteList) {
        if (!Array.isArray(localList)) localList = [];
        if (!Array.isArray(remoteList)) remoteList = [];

        const map = new Map();

        const getItemKey = (item) => {
            if (!item || typeof item !== 'object') return null;
            return item.id || item.code || item.codeId || item.nit || null;
        };

        // Agregar remotos al mapa
        remoteList.forEach(item => {
            const key = getItemKey(item);
            if (key) {
                map.set(String(key), item);
            }
        });

        // Fusionar locales: si no existe en remoto o el local es más reciente, conserva/actualiza
        localList.forEach(item => {
            const key = getItemKey(item);
            if (key) {
                if (!map.has(String(key))) {
                    map.set(String(key), item);
                } else {
                    const existing = map.get(String(key));
                    const localTime = new Date(item.createdAt || item.updatedAt || item.date || 0).getTime();
                    const remoteTime = new Date(existing.createdAt || existing.updatedAt || existing.date || 0).getTime();
                    if (localTime > remoteTime) {
                        map.set(String(key), item);
                    }
                }
            }
        });

        return Array.from(map.values());
    }

    let lastPushTime = 0;

    /**
     * Write shared settings to localStorage without triggering recursive debounced cloud push.
     */
    function _setLocalSharedSilently(sharedKey, obj) {
        const prevPulling = isSyncPulling;
        isSyncPulling = true;
        try {
            localStorage.setItem(sharedKey, JSON.stringify(obj));
        } finally {
            isSyncPulling = prevPulling;
        }
    }

    /**
     * Save company registration / white-label fields immediately & atomically to localStorage and Supabase user_data.
     */
    async function syncSaveCompanySettingsToCloud(patch = {}, options = {}) {
        const run = async () => {
            const safePatch = _isPlainObj(patch) ? patch : {};
            const nowIso = new Date().toISOString();
            const sharedKey = typeof userKey === 'function' ? userKey('recim_company_shared_settings') : 'recim_company_shared_settings';
            const settingsKey = typeof userKey === 'function' ? userKey(SETTINGS_KEY) : SETTINGS_KEY;
            const allowEmptyOverwrite = Boolean(options.allowEmptyOverwrite);
            const explicitClearedFields = Array.isArray(options.explicitClearedFields)
                ? options.explicitClearedFields.filter(Boolean)
                : (allowEmptyOverwrite
                    ? Object.keys(safePatch).filter(k => COMPANY_FIELDS.includes(k) && !String(safePatch[k] || '').trim())
                    : []);

            let localShared = {};
            try { localShared = JSON.parse(localStorage.getItem(sharedKey) || '{}'); } catch (_) {}
            if (!_isPlainObj(localShared)) localShared = {};

            const updatedLocal = {
                ...localShared,
                ...safePatch,
                updatedAt: nowIso,
                _pendingCloudSync: true
            };

            if (Array.isArray(safePatch.branches)) {
                updatedLocal.branchesUpdatedAt = safePatch.branchesUpdatedAt || nowIso;
            }
            if (allowEmptyOverwrite) {
                updatedLocal._explicitResetAt = nowIso;
                if (explicitClearedFields.length > 0) {
                    const prevCleared = Array.isArray(localShared._explicitClearedFields) ? localShared._explicitClearedFields : [];
                    const mergedCleared = Array.from(new Set([...prevCleared, ...explicitClearedFields]))
                        .filter(f => !String(updatedLocal[f] || '').trim());
                    if (mergedCleared.length > 0) {
                        updatedLocal._explicitClearedFields = mergedCleared;
                    } else {
                        delete updatedLocal._explicitClearedFields;
                    }
                }
            } else if (Array.isArray(updatedLocal._explicitClearedFields)) {
                const remaining = updatedLocal._explicitClearedFields.filter(f => !String(updatedLocal[f] || '').trim());
                if (remaining.length > 0) updatedLocal._explicitClearedFields = remaining;
                else delete updatedLocal._explicitClearedFields;
            }

            try {
                _setLocalSharedSilently(sharedKey, updatedLocal);
            } catch (quotaErr) {
                console.warn('⚠️ QuotaExceeded al guardar recim_company_shared_settings en localStorage:', quotaErr);
            }

            hydrateLocalSettingsFromShared(updatedLocal, allowEmptyOverwrite || explicitClearedFields.length > 0);

            if ((Object.prototype.hasOwnProperty.call(safePatch, 'companyName') || Object.prototype.hasOwnProperty.call(safePatch, 'companyRNC')) && typeof updateCurrentSession === 'function') {
                const sessionUpdates = {};
                if (Object.prototype.hasOwnProperty.call(safePatch, 'companyName')) sessionUpdates.companyName = safePatch.companyName || '';
                if (Object.prototype.hasOwnProperty.call(safePatch, 'companyRNC')) sessionUpdates.companyRNC = safePatch.companyRNC || '';
                updateCurrentSession(sessionUpdates);
            }

            if (typeof applySettings === 'function') {
                try { applySettings(); } catch (_) {}
            }

            const dbId = getSyncDbId();
            if (!isSupabaseActive || !supabaseClient || !dbId) {
                return { ok: false, offline: true, shared: updatedLocal };
            }

            try {
                const { data: existingRow, error: readErr } = await supabaseClient
                    .from('user_data')
                    .select('data')
                    .eq('id', dbId)
                    .maybeSingle();
                if (readErr) throw readErr;

                const mergedRemoteData = (existingRow && _isPlainObj(existingRow.data))
                    ? { ...existingRow.data }
                    : {};

                const mergedShared = mergeCompanySharedSettings(
                    mergedRemoteData.recim_company_shared_settings,
                    updatedLocal,
                    {
                        preferLocal: true,
                        allowEmptyOverwrite,
                        explicitClearedFields
                    }
                );
                delete mergedShared._pendingCloudSync;
                mergedRemoteData.recim_company_shared_settings = mergedShared;

                let localSettings = {};
                try { localSettings = JSON.parse(localStorage.getItem(settingsKey) || '{}'); } catch (_) {}
                if (_isPlainObj(localSettings)) {
                    const prevRemoteSettings = _isPlainObj(mergedRemoteData[SETTINGS_KEY]) ? mergedRemoteData[SETTINGS_KEY] : {};
                    mergedRemoteData[SETTINGS_KEY] = {
                        ...prevRemoteSettings,
                        ...sanitizeSettingsForCloud(localSettings)
                    };
                }

                if (Array.isArray(mergedShared.branches) && mergedShared.branches.length > 0) {
                    mergedRemoteData.recim_branches = mergedShared.branches;
                }

                const { error: upsertErr } = await supabaseClient
                    .from('user_data')
                    .upsert({
                        id: dbId,
                        data: mergedRemoteData,
                        updated_at: nowIso
                    });
                if (upsertErr) throw upsertErr;

                lastPushTime = Date.now();
                initialPullCompletedDbId = dbId;

                try {
                    const cleanLocal = { ...mergedShared };
                    delete cleanLocal._pendingCloudSync;
                    _setLocalSharedSilently(sharedKey, cleanLocal);
                } catch (_) {}

                console.log(`☁️ Empresa guardada en Supabase user_data (${dbId})`);
                return { ok: true, dbId, shared: mergedShared };
            } catch (err) {
                console.error('❌ Error guardando configuración de empresa en Supabase:', err);
                return { ok: false, error: err, shared: updatedLocal };
            }
        };

        const queued = companySaveQueue.then(run, run);
        companySaveQueue = queued.catch(() => {});
        return queued;
    }

    /**
     * Lightweight cloud pull for company registration settings + one-time recovery from personal account if missing.
     */
    async function syncPullCompanySettingsOnly() {
        const dbId = getSyncDbId();
        if (!isSupabaseActive || !supabaseClient || !dbId) {
            return { ok: false, offline: true, changed: false };
        }

        const prevPulling = isSyncPulling;
        isSyncPulling = true;
        try {
            const { data: row, error } = await supabaseClient
                .from('user_data')
                .select('data')
                .eq('id', dbId)
                .maybeSingle();
            if (error) throw error;

            const sharedKey = typeof userKey === 'function' ? userKey('recim_company_shared_settings') : 'recim_company_shared_settings';
            const settingsKey = typeof userKey === 'function' ? userKey(SETTINGS_KEY) : SETTINGS_KEY;

            let localShared = {};
            try { localShared = JSON.parse(localStorage.getItem(sharedKey) || '{}'); } catch (_) {}
            if (!_isPlainObj(localShared)) localShared = {};

            let remoteShared = (row && _isPlainObj(row.data) && _isPlainObj(row.data.recim_company_shared_settings))
                ? { ...row.data.recim_company_shared_settings }
                : {};

            // Recovery read: if family_${familyId} has no company identity yet while user is CEO/founder, check accountId row once
            let session = {};
            try { session = JSON.parse(localStorage.getItem('recim_session') || '{}'); } catch (_) {}
            const hasRemoteIdentity = COMPANY_FIELDS.some(f => Boolean(String(remoteShared[f] || '').trim()));
            const recoveryFlagKey = `recim_company_recovered_${dbId}`;
            const canRecoverFromPersonal = dbId.startsWith('family_')
                && !hasRemoteIdentity
                && session.accountId
                && (!session.role || session.role !== 'colaborador' || session.isFounder === true)
                && (typeof isCurrentUserCompanyCEO !== 'function' || isCurrentUserCompanyCEO())
                && !sessionStorage.getItem(recoveryFlagKey);

            if (canRecoverFromPersonal) {
                try { sessionStorage.setItem(recoveryFlagKey, '1'); } catch (_) {}
                try {
                    const { data: personalRow, error: pErr } = await supabaseClient
                        .from('user_data')
                        .select('data')
                        .eq('id', session.accountId)
                        .maybeSingle();
                    if (!pErr && personalRow && _isPlainObj(personalRow.data)) {
                        const personalShared = _isPlainObj(personalRow.data.recim_company_shared_settings)
                            ? personalRow.data.recim_company_shared_settings
                            : {};
                        const personalSettings = _isPlainObj(personalRow.data[SETTINGS_KEY])
                            ? personalRow.data[SETTINGS_KEY]
                            : {};
                        const recoveredPatch = {};
                        for (const f of COMPANY_FIELDS) {
                            const val = personalShared[f] || personalSettings[f] || '';
                            if (String(val || '').trim()) {
                                recoveredPatch[f] = val;
                            }
                        }
                        if (Object.keys(recoveredPatch).length > 0) {
                            remoteShared = {
                                ...remoteShared,
                                ...recoveredPatch,
                                updatedAt: personalShared.updatedAt || new Date().toISOString()
                            };
                            console.log(`☁️ Recuperados datos de empresa desde cuenta personal (${session.accountId}) hacia ${dbId}`);
                        }
                    }
                } catch (recErr) {
                    console.warn('⚠️ Error en recuperación de ajustes personales de empresa:', recErr);
                }
            }

            let changed = false;
            const mergedShared = mergeCompanySharedSettings(remoteShared, localShared, { preferLocal: false });
            const localTs = Date.parse(localShared.updatedAt || 0) || 0;
            const remoteTs = Date.parse(remoteShared.updatedAt || 0) || 0;
            const pendingNewer = Boolean(localShared._pendingCloudSync && localTs > remoteTs);
            if (!pendingNewer) {
                delete mergedShared._pendingCloudSync;
            }

            const prevJson = localStorage.getItem(sharedKey);
            const nextJson = JSON.stringify(mergedShared);
            if (prevJson !== nextJson) {
                try {
                    localStorage.setItem(sharedKey, nextJson);
                    changed = true;
                } catch (_) {}
            }

            if (hydrateLocalSettingsFromShared(mergedShared, Boolean(mergedShared._explicitResetAt || (Array.isArray(mergedShared._explicitClearedFields) && mergedShared._explicitClearedFields.length > 0)))) {
                changed = true;
            }

            if (row && _isPlainObj(row.data) && _isPlainObj(row.data[SETTINGS_KEY])) {
                let localSet = {};
                try { localSet = JSON.parse(localStorage.getItem(settingsKey) || '{}'); } catch (_) {}
                if (!_isPlainObj(localSet)) localSet = {};
                const nextSet = { ...localSet };
                ['colorTheme', 'darkMode', 'language'].forEach(k => {
                    if (localSet[k] === undefined && row.data[SETTINGS_KEY][k] !== undefined) {
                        nextSet[k] = row.data[SETTINGS_KEY][k];
                    }
                });
                const prevSetStr = localStorage.getItem(settingsKey);
                const nextSetStr = JSON.stringify(nextSet);
                if (prevSetStr !== nextSetStr) {
                    try { localStorage.setItem(settingsKey, nextSetStr); changed = true; } catch (_) {}
                }
            }

            if (changed && typeof applySettings === 'function') {
                try { applySettings(); } catch (_) {}
            }

            return { ok: true, shared: mergedShared, changed };
        } catch (err) {
            console.warn('⚠️ Error en syncPullCompanySettingsOnly:', err);
            return { ok: false, error: err, changed: false };
        } finally {
            isSyncPulling = prevPulling;
        }
    }

    function safePullSetItem(key, val) {
        try {
            localStorage.setItem(key, val);
            return true;
        } catch (err) {
            if (err && (err.name === 'QuotaExceededError' || err.code === 22)) {
                console.warn(`⚠️ localStorage lleno al guardar ${key}; respaldando en IndexedDB...`);
                if (typeof window !== 'undefined' && window.StorageEngine && typeof window.StorageEngine.mirrorKey === 'function') {
                    window.StorageEngine.mirrorKey(key, val);
                }
                return false;
            }
            throw err;
        }
    }

    /**
     * Push current localStorage data to Supabase (user_data merge-upsert first + Relational Tables).
     */
    async function syncPushData(force = false) {
        if (!isSupabaseActive || !supabaseClient) return false;
        const dbId = getSyncDbId();
        if (!dbId) return false;

        if (!force && initialPullCompletedDbId !== dbId) {
            console.warn(`⏳ Cloud Sync Push omitido para ${dbId}: esperando syncPullData inicial para proteger datos remotos.`);
            return false;
        }

        if (typeof window !== 'undefined' && window.SyncStatus) {
            try { window.SyncStatus.onSyncStart(); } catch (_) {}
        }
        lastPushTime = Date.now();

        const dataToSync = {};
        let hasData = false;
        WATCHED_KEYS.forEach(k => {
            let val = localStorage.getItem(userKey(k.pattern));
            if (val === '[]' && k.pattern === 'recim_gdrive_folder') {
                val = null;
            }
            if (val !== null && val !== undefined) {
                try {
                    dataToSync[k.pattern] = JSON.parse(val);
                } catch (_) {
                    dataToSync[k.pattern] = val;
                }
                hasData = true;
            }
        });

        // Incluir recim_settings sanitizado (sin duplicar companyLogo base64)
        const rawLocalSettings = localStorage.getItem(userKey(SETTINGS_KEY));
        if (rawLocalSettings !== null && rawLocalSettings !== undefined) {
            try {
                const parsedSettings = JSON.parse(rawLocalSettings);
                if (_isPlainObj(parsedSettings)) {
                    dataToSync[SETTINGS_KEY] = sanitizeSettingsForCloud(parsedSettings);
                    hasData = true;
                }
            } catch (_) {}
        }

        try {
            // 1. PRIORITARIO: Fusionar y guardar user_data primero para que configuraciones/sucursales persistan de inmediato
            let userDataOk = false;
            let mergedUserData = hasData ? { ...dataToSync } : {};

            try {
                const { data: existingRow, error: readErr } = await supabaseClient
                    .from('user_data')
                    .select('data')
                    .eq('id', dbId)
                    .maybeSingle();

                if (readErr) {
                    console.error(`❌ Error leyendo user_data previo para ${dbId}:`, readErr);
                } else {
                    const remoteObj = (existingRow && _isPlainObj(existingRow.data)) ? { ...existingRow.data } : {};
                    mergedUserData = { ...remoteObj };

                    Object.keys(dataToSync).forEach(k => {
                        if (k === 'recim_company_shared_settings') {
                            const mergedShared = mergeCompanySharedSettings(
                                remoteObj.recim_company_shared_settings,
                                dataToSync.recim_company_shared_settings,
                                { preferLocal: true }
                            );
                            delete mergedShared._pendingCloudSync;
                            mergedUserData.recim_company_shared_settings = mergedShared;
                        } else if (k === SETTINGS_KEY) {
                            const prevSet = _isPlainObj(remoteObj[SETTINGS_KEY]) ? remoteObj[SETTINGS_KEY] : {};
                            mergedUserData[SETTINGS_KEY] = { ...prevSet, ...sanitizeSettingsForCloud(dataToSync[SETTINGS_KEY]) };
                        } else if (k === 'recim_gdrive_folder' && (!dataToSync[k] || dataToSync[k] === '[]')) {
                            if (remoteObj[k]) mergedUserData[k] = remoteObj[k];
                        } else {
                            mergedUserData[k] = dataToSync[k];
                        }
                    });

                    const { error: userDataErr } = await supabaseClient
                        .from('user_data')
                        .upsert({
                            id: dbId,
                            data: mergedUserData,
                            updated_at: new Date().toISOString()
                        });

                    if (userDataErr) {
                        console.error(`❌ Error guardando user_data para DB ${dbId}:`, userDataErr);
                    } else {
                        userDataOk = true;
                        // Limpiar bandera _pendingCloudSync si existía localmente
                        try {
                            const sharedKey = userKey('recim_company_shared_settings');
                            const curSharedRaw = localStorage.getItem(sharedKey);
                            if (curSharedRaw) {
                                const curShared = JSON.parse(curSharedRaw);
                                if (_isPlainObj(curShared) && curShared._pendingCloudSync) {
                                    delete curShared._pendingCloudSync;
                                    _setLocalSharedSilently(sharedKey, curShared);
                                }
                            }
                        } catch (_) {}
                    }
                }
            } catch (udErr) {
                console.error('❌ Excepción en merge-upsert de user_data:', udErr);
            }

            // 2. Sincronización relacional a nivel de fila individual por entidad
            const entityMap = [
                { pattern: 'recim_invoices', table: 'invoices' },
                { pattern: 'recim_ingresos', table: 'finances', type: 'ingreso' },
                { pattern: 'recim_egresos', table: 'finances', type: 'egreso' },
                { pattern: 'recim_clients', table: 'clients' },
                { pattern: 'recim_material_codes', table: 'materials' },
                { pattern: 'recim_collaborators', table: 'collaborators' }
            ];

            for (const ent of entityMap) {
                const val = localStorage.getItem(userKey(ent.pattern));
                let items = [];
                if (val) {
                    try {
                        const parsed = JSON.parse(val);
                        if (Array.isArray(parsed)) items = parsed;
                    } catch (_) {}
                }

                try {
                    const localIdSet = new Set();
                    if (items.length > 0) {
                        const rows = items.map(item => {
                            const itemId = String(item.id || item.code || `${ent.pattern}_${Date.now()}_${Math.random()}`);
                            localIdSet.add(itemId);
                            return {
                                id: itemId,
                                db_id: dbId,
                                type: ent.type || item.type || null,
                                data: item,
                                is_deleted: false,
                                updated_at: new Date().toISOString()
                            };
                        });
                        for (let i = 0; i < rows.length; i += 50) {
                            const chunk = rows.slice(i, i + 50);
                            await supabaseClient.from(ent.table).upsert(chunk);
                        }
                    }

                    // Marcar como is_deleted = true en Supabase las filas remotas que fueron eliminadas localmente
                    let remQuery = supabaseClient.from(ent.table).select('id').eq('db_id', dbId).eq('is_deleted', false);
                    if (ent.type) {
                        remQuery = remQuery.eq('type', ent.type);
                    }
                    const { data: remoteRows, error: remErr } = await remQuery;
                    if (!remErr && Array.isArray(remoteRows) && remoteRows.length > 0) {
                        const deletedIds = remoteRows
                            .map(r => String(r.id))
                            .filter(id => !localIdSet.has(id));
                        if (deletedIds.length > 0) {
                            for (let i = 0; i < deletedIds.length; i += 50) {
                                const delChunk = deletedIds.slice(i, i + 50);
                                await supabaseClient
                                    .from(ent.table)
                                    .update({ is_deleted: true, updated_at: new Date().toISOString() })
                                    .eq('db_id', dbId)
                                    .in('id', delChunk);
                            }
                        }
                    }
                } catch (e) {
                    console.warn(`⚠️ Error sincronizando filas relacionales en ${ent.table}:`, e);
                }
            }

            console.log(`☁️ Cloud Relational Push: user_data(${userDataOk ? 'OK' : 'WARN'}) y filas relacionales actualizadas para DB: ${dbId}`);
            
            // Sincronizar también con Google Drive (respaldo dual automático)
            syncPushGDrive(mergedUserData, force).then(ok => {
                if (ok) {
                    console.log("☁️ Google Drive: Sincronización automática de respaldo exitosa.");
                }
            });

            // Enviar todos los archivos Excel automáticamente a Google Drive
            syncPushGDriveExcel(force).then(ok => {
                if (ok) {
                    console.log("☁️ Google Drive: Envío automático de todos los archivos Excel completado.");
                }
            });

            if (typeof window !== 'undefined' && window.SyncStatus) {
                if (userDataOk) {
                    try { window.SyncStatus.onSyncSuccess(); } catch (_) {}
                } else {
                    try { window.SyncStatus.onSyncError('Error sincronizando datos con la nube'); } catch (_) {}
                }
            }
            return userDataOk;
        } catch (err) {
            console.error('Supabase Sync Push Error:', err);
            if (typeof window !== 'undefined' && window.SyncStatus) {
                try { window.SyncStatus.onSyncError(err); } catch (_) {}
            }
            return false;
        }
    }

    /**
     * Parse Google Drive URL/ID to extract Folder ID cleanly.
     */
    function extractFolderId(input) {
        if (!input) return null;
        let clean = input.trim();
        // Strip query params and hash anchors
        clean = clean.split('?')[0].split('#')[0];
        
        // Extract 25+ character folder ID pattern
        const match = clean.match(/(?:folders\/|id=|^|\/)([a-zA-Z0-9_-]{25,})/);
        if (match && match[1]) {
            return match[1];
        }
        clean = clean.replace(/^(.*\/)+/, '');
        return clean || null;
    }

    /**
     * Push current database data to Google Drive.
     */
    async function syncPushGDrive(data, force = false) {
        const folderInput = localStorage.getItem(userKey('recim_gdrive_folder')) || localStorage.getItem('recim_gdrive_folder');
        if (!folderInput) return false;

        const folderId = extractFolderId(folderInput);
        if (!folderId) return false;

        const now = Date.now();
        if (!force) {
            const freq = localStorage.getItem(userKey('recim_backup_frequency')) || '2hours';
            if (freq === 'manual') {
                console.log("⏳ Google Drive JSON: Modo manual activo, omitiendo auto-envío.");
                return true;
            }
            const intervalMs = {
                '30min': 30 * 60 * 1000,
                '1hour': 60 * 60 * 1000,
                '2hours': 2 * 60 * 60 * 1000,
                '6hours': 6 * 60 * 60 * 1000,
                '12hours': 12 * 60 * 60 * 1000,
                '24hours': 24 * 60 * 60 * 1000
            }[freq] || (2 * 60 * 60 * 1000);

            const lastSync = localStorage.getItem(userKey('recim_last_json_sync'));
            if (lastSync) {
                const elapsed = now - parseInt(lastSync, 10);
                if (elapsed < intervalMs) {
                    console.log(`⏳ Google Drive JSON: Omitiendo auto-envío (frecuencia ${freq} activa).`);
                    return true;
                }
            }
        }

        if (!data || Object.keys(data).length === 0) {
            data = {};
            WATCHED_KEYS.forEach(k => {
                const val = localStorage.getItem(userKey(k.pattern));
                if (val !== null && val !== undefined && val !== '[]') {
                    try { data[k.pattern] = JSON.parse(val); } catch (_) { data[k.pattern] = val; }
                }
            });
        }

        const scriptUrl = (typeof getAppsScriptUrl === 'function')
            ? getAppsScriptUrl()
            : ((typeof _unlockVaultSecret === 'function' && _unlockVaultSecret('GAS_URL')) || '');
        let accountId = 'default';
        try {
            const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
            accountId = session.accountId || 'default';
        } catch (_) {}

        const fileName = `reciminsa_backup_${accountId}.json`;
        const bodyPayload = JSON.stringify({
            appToken: APP_SECURITY_TOKEN,
            action: 'backup',
            folderId: folderId,
            fileName: fileName,
            content: JSON.stringify(data || {})
        });

        console.log(`📡 Enviando respaldo a Google Drive folderId: ${folderId}`);
        
        try {
            await fetch(scriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: bodyPayload
            }).catch(err => {
                console.warn('Fetch fallback caught:', err);
            });

            console.log('☁️ Google Drive Sync: Respaldo enviado con éxito.');
            localStorage.setItem(userKey('recim_last_json_sync'), now.toString());
            return true;
        } catch (err) {
            console.error('Google Drive Sync Push Error:', err);
            return true;
        }
    }

/**
 * Push ALL Excel files (Facturas, Ingresos, Egresos, Materiales) to Google Drive.
 * Generates them with SheetJS and sends as base64, always regardless of data state.
 */
async function syncPushGDriveExcel(force = false) {
    if (typeof XLSX === 'undefined') {
        console.warn("⚠️ Librería XLSX no disponible para respaldos Excel.");
        return false;
    }

    const folderInput = localStorage.getItem(userKey('recim_gdrive_folder'));
    if (!folderInput) return false;

    const folderId = extractFolderId(folderInput);
    if (!folderId) return false;

    // Check dynamic rate limit if not forced
    const now = Date.now();
    if (!force) {
        const freq = localStorage.getItem(userKey('recim_backup_frequency')) || '2hours';
        if (freq === 'manual') {
            console.log("⏳ Google Drive Excel: Modo manual activo, omitiendo auto-envío.");
            return true;
        }
        const intervalMs = {
            '30min': 30 * 60 * 1000,
            '1hour': 60 * 60 * 1000,
            '2hours': 2 * 60 * 60 * 1000,
            '6hours': 6 * 60 * 60 * 1000,
            '12hours': 12 * 60 * 60 * 1000,
            '24hours': 24 * 60 * 60 * 1000
        }[freq] || (2 * 60 * 60 * 1000);

        const lastSync = localStorage.getItem(userKey('recim_last_excel_sync'));
        if (lastSync) {
            const elapsed = now - parseInt(lastSync, 10);
            if (elapsed < intervalMs) {
                console.log(`⏳ Google Drive Excel: Omitiendo auto-envío (frecuencia ${freq} activa).`);
                return true;
            }
        }
    }

    let scriptUrl = (typeof getAppsScriptUrl === 'function')
        ? getAppsScriptUrl()
        : ((typeof _unlockVaultSecret === 'function' && _unlockVaultSecret('GAS_URL')) || '');

    let accountId = 'default';
    try {
        const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
        accountId = session.accountId || 'default';
    } catch (_) {}

    // Gather all data
    const invoices = JSON.parse(localStorage.getItem(userKey('recim_invoices')) || '[]');
    const ingresos = JSON.parse(localStorage.getItem(userKey('recim_ingresos')) || '[]');
    const egresos  = JSON.parse(localStorage.getItem(userKey('recim_egresos'))  || '[]');

    // Build rich sheet data using helper functions if available, or fallbacks
    const invSheetData = (typeof buildInvoiceSheet === 'function')
        ? buildInvoiceSheet(invoices)
        : { name: 'Facturas', data: [] };

    const finSheetData = (typeof buildCombinedFinanceSheet === 'function')
        ? buildCombinedFinanceSheet(ingresos, egresos, invoices)
        : { name: 'Finanzas', data: [] };

    const matSheetData = (typeof buildMaterialsSheet === 'function')
        ? buildMaterialsSheet()
        : { name: 'Catálogo_Materiales', data: [] };

    // Format timestamp for filenames
    const nowObj = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const datePart = nowObj.getFullYear() + '-' + pad(nowObj.getMonth() + 1) + '-' + pad(nowObj.getDate());
    const timePart = pad(nowObj.getHours()) + '-' + pad(nowObj.getMinutes());
    const timestampLabel = `${datePart}_${timePart}`;

    // Helper: encode a workbook to base64
    function encodeWorkbook(wb) {
        return XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    }

    // Helper: create styled worksheet from AOA
    function createStyledSheet(aoaData) {
        let ws;
        if (!aoaData || !aoaData.length || (aoaData.length === 1 && (!aoaData[0] || !aoaData[0].length))) {
            ws = XLSX.utils.aoa_to_sheet([['Sin datos']]);
        } else {
            ws = XLSX.utils.aoa_to_sheet(aoaData);
        }
        if (typeof formatAndStyleWorksheet === 'function') {
            formatAndStyleWorksheet(ws);
        }
        return ws;
    }

    // 1. ARCHIVO UNIFICADO CON LAS 3 HOJAS (Facturas, Finanzas, Catálogo_Materiales)
    const wbUnified = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbUnified, createStyledSheet(invSheetData.data), 'Facturas');
    XLSX.utils.book_append_sheet(wbUnified, createStyledSheet(finSheetData.data), 'Finanzas');
    XLSX.utils.book_append_sheet(wbUnified, createStyledSheet(matSheetData.data), 'Catálogo_Materiales');

    // 2. ARCHIVOS INDIVIDUALES POR CATEGORÍA
    const wbFacturas = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbFacturas, createStyledSheet(invSheetData.data), 'Facturas');

    const wbFinanzas = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbFinanzas, createStyledSheet(finSheetData.data), 'Finanzas');

    const wbMateriales = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbMateriales, createStyledSheet(matSheetData.data), 'Catálogo_Materiales');

    const excelFiles = [
        {
            fileName: `Reciminsa_Export_${datePart}.xlsx`,
            base64Content: encodeWorkbook(wbUnified)
        },
        {
            fileName: `Reciminsaap_Facturas_${accountId}_${timestampLabel}.xlsx`,
            base64Content: encodeWorkbook(wbFacturas)
        },
        {
            fileName: `Reciminsaap_Finanzas_${accountId}_${timestampLabel}.xlsx`,
            base64Content: encodeWorkbook(wbFinanzas)
        },
        {
            fileName: `Reciminsaap_Materiales_${accountId}_${timestampLabel}.xlsx`,
            base64Content: encodeWorkbook(wbMateriales)
        }
    ];

    let allSuccess = true;
    for (const fileInfo of excelFiles) {
        try {
            const bodyPayload = JSON.stringify({
                appToken: APP_SECURITY_TOKEN,
                action: 'excel',
                folderId: folderId,
                fileName: fileInfo.fileName,
                base64Content: fileInfo.base64Content
            });
            try {
                await fetch(scriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: bodyPayload
                });
            } catch (corsErr) {
                await fetch(scriptUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: bodyPayload
                }).catch(() => {});
            }
            console.log(`☁️ Google Drive: Excel enviado → ${fileInfo.fileName}`);
        } catch (err) {
            console.error(`Google Drive Excel Push Error (${fileInfo.fileName}):`, err);
            allSuccess = false;
        }
    }

    if (allSuccess) {
        localStorage.setItem(userKey('recim_last_excel_sync'), now.toString());
    }
    return allSuccess;
}

/**
 * Check and run scheduled Google Drive backups if overdue based on user-selected frequency.
 */
async function checkAndRunScheduledGDriveBackup() {
    const folderInput = localStorage.getItem(userKey('recim_gdrive_folder')) || localStorage.getItem('recim_gdrive_folder');
    if (!folderInput) return;

    const folderId = extractFolderId(folderInput);
    if (!folderId) return;

    const freq = localStorage.getItem(userKey('recim_backup_frequency')) || '2hours';
    if (freq === 'manual') return;

    const intervalMs = {
        '30min': 30 * 60 * 1000,
        '1hour': 60 * 60 * 1000,
        '2hours': 2 * 60 * 60 * 1000,
        '6hours': 6 * 60 * 60 * 1000,
        '12hours': 12 * 60 * 60 * 1000,
        '24hours': 24 * 60 * 60 * 1000
    }[freq] || (2 * 60 * 60 * 1000);

    const now = Date.now();
    const lastJsonSync = parseInt(localStorage.getItem(userKey('recim_last_json_sync')) || '0', 10);
    const lastExcelSync = parseInt(localStorage.getItem(userKey('recim_last_excel_sync')) || '0', 10);

    const isJsonOverdue = (now - lastJsonSync) >= intervalMs;
    const isExcelOverdue = (now - lastExcelSync) >= intervalMs;

    if (isJsonOverdue || isExcelOverdue) {
        console.log(`⏰ [Google Drive AutoBackup] Comprobando respaldo programado (Frecuencia: ${freq})...`);
        
        if (isJsonOverdue) {
            const dataToSync = {};
            WATCHED_KEYS.forEach(k => {
                const val = localStorage.getItem(userKey(k.pattern));
                if (val !== null && val !== undefined && val !== '[]') {
                    try { dataToSync[k.pattern] = JSON.parse(val); } catch (_) { dataToSync[k.pattern] = val; }
                }
            });
            await syncPushGDrive(dataToSync, false);
        }

        if (isExcelOverdue) {
            await syncPushGDriveExcel(false);
        }
    }
}

/**
 * Send a welcome document to Google Drive.
 */
async function sendGDriveWelcomeDoc() {
    const folderInput = localStorage.getItem(userKey('recim_gdrive_folder'));
    if (!folderInput) return false;

    const folderId = extractFolderId(folderInput);
    if (!folderId) return false;

    let scriptUrl = (typeof getAppsScriptUrl === 'function')
        ? getAppsScriptUrl()
        : ((typeof _unlockVaultSecret === 'function' && _unlockVaultSecret('GAS_URL')) || '');

    try {
        const bodyPayload = JSON.stringify({
            appToken: APP_SECURITY_TOKEN,
            action: 'backup',
            folderId: folderId,
            fileName: 'Bienvenido_a_Reciminsaap.txt',
            content: '¡Bienvenido a Reciminsaap!\n\nTu carpeta de Google Drive ha sido vinculada correctamente.\nAquí se guardarán tus copias de seguridad de datos (.json) y tus reportes de Excel (.xlsx) automáticamente.\n\nFecha de vinculación: ' + new Date().toLocaleString()
        });
        try {
            await fetch(scriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: bodyPayload
            });
        } catch (corsErr) {
            await fetch(scriptUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: bodyPayload
            }).catch(() => {});
        }
        return true;
    } catch (err) {
        console.error('Error sending welcome document:', err);
        return false;
    }
}

    /**
     * Pull data from Supabase (Relational Tables + user_data fallback) and update localStorage.
     */
    async function syncPullData(dbId) {
        if (!isSupabaseActive || !supabaseClient) return false;
        if (!dbId) {
            dbId = getSyncDbId();
        }
        if (!dbId) return false;

        if (activePullPromise && activePullDbId === dbId) {
            return activePullPromise;
        }

        activePullDbId = dbId;
        activePullPromise = (async () => {
            isSyncPulling = true;
            let changed = false;
            let companySettingsUpdated = false;
            let pendingNeedsPush = false;

            try {
                // Verificar permisos de módulos para el usuario actual antes de descargar
                let canAccessIngresos = true;
                let canAccessEgresos = true;
                if (typeof getModuleConfig === 'function') {
                    const moduleCfg = getModuleConfig();
                    const isAdmin = (typeof isCurrentUserAdminOrFounder === 'function') ? isCurrentUserAdminOrFounder() : true;
                    if (!isAdmin) {
                        if (moduleCfg['ingresos'] === false) canAccessIngresos = false;
                        if (moduleCfg['egresos'] === false) canAccessEgresos = false;
                    }
                }

                // Purgar datos financieros del dispositivo si el colaborador no tiene autorización
                if (!canAccessIngresos) {
                    if (localStorage.getItem(userKey('recim_ingresos')) !== null) {
                        localStorage.removeItem(userKey('recim_ingresos'));
                        console.log("🔒 Seguridad RLS/Local: Purga de ingresos no autorizados en dispositivo");
                    }
                }
                if (!canAccessEgresos) {
                    if (localStorage.getItem(userKey('recim_egresos')) !== null) {
                        localStorage.removeItem(userKey('recim_egresos'));
                        console.log("🔒 Seguridad RLS/Local: Purga de egresos no autorizados en dispositivo");
                    }
                }

                const entityMap = [
                    { pattern: 'recim_invoices', table: 'invoices', label: '🧾 Facturas' },
                    { pattern: 'recim_ingresos', table: 'finances', type: 'ingreso', label: '💰 Ingresos' },
                    { pattern: 'recim_egresos', table: 'finances', type: 'egreso', label: '💸 Egresos' },
                    { pattern: 'recim_clients', table: 'clients', label: '👥 Clientes' },
                    { pattern: 'recim_material_codes', table: 'materials', label: '🏷️ Materiales' },
                    { pattern: 'recim_collaborators', table: 'collaborators', label: '🤝 Colaboradores' }
                ];

                const relationalFound = new Set();

                // 1. Descargar y fusionar filas relacionales por entidad (respetando permisos)
                for (const ent of entityMap) {
                    if (ent.pattern === 'recim_ingresos' && !canAccessIngresos) continue;
                    if (ent.pattern === 'recim_egresos' && !canAccessEgresos) continue;

                    try {
                        let query = supabaseClient.from(ent.table).select('id, type, data, is_deleted').eq('db_id', dbId);
                        if (ent.type) {
                            query = query.eq('type', ent.type);
                        }
                        const { data: rows, error } = await query;
                        if (!error && Array.isArray(rows) && rows.length > 0) {
                            relationalFound.add(ent.pattern);
                            const remoteItems = rows.filter(r => !r.is_deleted).map(r => r.data);
                            const localRaw = localStorage.getItem(userKey(ent.pattern));
                            const localItems = localRaw ? JSON.parse(localRaw) : [];

                            const merged = mergeItemsById(localItems, remoteItems);
                            const mergedStr = JSON.stringify(merged);
                            if (localRaw !== mergedStr) {
                                safePullSetItem(userKey(ent.pattern), mergedStr);
                                changed = true;
                                console.log(`☁️ Cloud Relational Pull: Fusionados ${merged.length} items en ${ent.label}`);
                            }
                        }
                    } catch (e) {
                        console.warn(`⚠️ Error descargando tabla relacional ${ent.table}:`, e);
                    }
                }

                // 2. Respaldo / configuraciones / llaves no relacionales desde user_data
                const { data, error } = await supabaseClient
                    .from('user_data')
                    .select('data')
                    .eq('id', dbId)
                    .maybeSingle();

                if (!error) {
                    initialPullCompletedDbId = dbId;
                }

                if (!error && data && _isPlainObj(data.data)) {
                    const remoteData = data.data;

                    // 2a. Merge explícito y seguro de recim_company_shared_settings + hidratación de recim_settings
                    const sharedKey = userKey('recim_company_shared_settings');
                    const localSharedRaw = localStorage.getItem(sharedKey);
                    let localShared = {};
                    try { localShared = JSON.parse(localSharedRaw || '{}'); } catch (_) {}
                    if (!_isPlainObj(localShared)) localShared = {};

                    const remoteShared = _isPlainObj(remoteData.recim_company_shared_settings)
                        ? remoteData.recim_company_shared_settings
                        : {};

                    if (Object.keys(remoteShared).length > 0 || Object.keys(localShared).length > 0) {
                        const localTs = Date.parse(localShared.updatedAt || 0) || 0;
                        const remoteTs = Date.parse(remoteShared.updatedAt || 0) || 0;
                        const hasPendingOfflineEdits = Boolean(localShared._pendingCloudSync && localTs > remoteTs);
                        if (hasPendingOfflineEdits) {
                            pendingNeedsPush = true;
                        }

                        const mergedShared = mergeCompanySharedSettings(remoteShared, localShared, { preferLocal: false });
                        if (!hasPendingOfflineEdits) {
                            delete mergedShared._pendingCloudSync;
                        }

                        const mergedSharedJson = JSON.stringify(mergedShared);
                        if (localSharedRaw !== mergedSharedJson) {
                            try {
                                localStorage.setItem(sharedKey, mergedSharedJson);
                                changed = true;
                                companySettingsUpdated = true;
                                console.log('☁️ Cloud Pull: recim_company_shared_settings sincronizados.');
                            } catch (e) {
                                console.warn('⚠️ Error guardando recim_company_shared_settings en pull:', e);
                            }
                        }

                        const allowEmptyFromRemote = Boolean(
                            mergedShared._explicitResetAt ||
                            (Array.isArray(mergedShared._explicitClearedFields) && mergedShared._explicitClearedFields.length > 0)
                        );
                        if (hydrateLocalSettingsFromShared(mergedShared, allowEmptyFromRemote)) {
                            changed = true;
                            companySettingsUpdated = true;
                        }

                        // Si remote trae branches más recientes tras una eliminación, respetar la lista remota
                        const rBranchTs = Date.parse(remoteShared.branchesUpdatedAt || 0) || 0;
                        const lBranchTs = Date.parse(localShared.branchesUpdatedAt || 0) || 0;
                        if (!hasPendingOfflineEdits && rBranchTs > lBranchTs && Array.isArray(remoteShared.branches)) {
                            const branchKey = userKey('recim_branches');
                            const nextBranchesStr = JSON.stringify(remoteShared.branches);
                            if (localStorage.getItem(branchKey) !== nextBranchesStr) {
                                localStorage.setItem(branchKey, nextBranchesStr);
                                changed = true;
                            }
                        }
                    }

                    // 2b. Sincronizar preferencias UI de recim_settings sin pisar logo o identidad resuelta arriba
                    if (_isPlainObj(remoteData[SETTINGS_KEY])) {
                        const settingsKey = userKey(SETTINGS_KEY);
                        let localSet = {};
                        try { localSet = JSON.parse(localStorage.getItem(settingsKey) || '{}'); } catch (_) {}
                        if (!_isPlainObj(localSet)) localSet = {};

                        const remoteSet = sanitizeSettingsForCloud(remoteData[SETTINGS_KEY]);
                        let setChanged = false;
                        ['colorTheme', 'darkMode', 'language', 'currency'].forEach(prefKey => {
                            if (remoteSet[prefKey] !== undefined && localSet[prefKey] === undefined) {
                                localSet[prefKey] = remoteSet[prefKey];
                                setChanged = true;
                            }
                        });
                        if (setChanged) {
                            try {
                                localStorage.setItem(settingsKey, JSON.stringify(localSet));
                                changed = true;
                                companySettingsUpdated = true;
                            } catch (_) {}
                        }
                    }

                    // 2c. Resto de WATCHED_KEYS
                    WATCHED_KEYS.forEach(k => {
                        if (k.pattern === 'recim_company_shared_settings') return; // ya procesado arriba
                        if (relationalFound.has(k.pattern)) return; // ya procesado con datos relacionales
                        if (k.pattern === 'recim_ingresos' && !canAccessIngresos) return;
                        if (k.pattern === 'recim_egresos' && !canAccessEgresos) return;

                        const remoteVal = remoteData[k.pattern];
                        const localVal = localStorage.getItem(userKey(k.pattern));
                        if (remoteVal !== undefined && remoteVal !== null) {
                            // Protect valid local string setting (e.g. Google Drive folder URL) from being wiped by corrupted '[]' remote value
                            if ((remoteVal === '[]' || (Array.isArray(remoteVal) && remoteVal.length === 0)) && k.pattern === 'recim_gdrive_folder') {
                                if (localVal && localVal !== '[]') return;
                            }

                            let remoteItems = null;
                            if (Array.isArray(remoteVal)) {
                                remoteItems = remoteVal;
                            } else if (typeof remoteVal === 'string') {
                                try {
                                    const parsed = JSON.parse(remoteVal);
                                    if (Array.isArray(parsed)) remoteItems = parsed;
                                } catch (_) {}
                            }

                            let localItems = null;
                            if (localVal) {
                                try {
                                    const parsed = JSON.parse(localVal);
                                    if (Array.isArray(parsed)) localItems = parsed;
                                } catch (_) {}
                            }

                            let mergedStr = (typeof remoteVal === 'string') ? remoteVal : JSON.stringify(remoteVal);
                            if (Array.isArray(remoteItems) && Array.isArray(localItems)) {
                                const merged = mergeItemsById(localItems, remoteItems);
                                mergedStr = JSON.stringify(merged);
                            } else if (k.pattern === 'recim_gdrive_folder' && mergedStr === '[]') {
                                if (localVal && localVal !== '[]') return;
                                mergedStr = '';
                            }

                            if (localVal !== mergedStr) {
                                safePullSetItem(userKey(k.pattern), mergedStr);
                                changed = true;
                                console.log(`☁️ Cloud Fallback Pull: Recuperados datos de ${k.pattern} desde user_data`);
                            }
                        }
                    });
                }

                if (companySettingsUpdated || changed) {
                    if (typeof window.syncSessionBranchFromMembers === 'function') {
                        try { window.syncSessionBranchFromMembers(); } catch (_) {}
                    }
                    if (typeof applySettings === 'function') {
                        try { applySettings(); } catch (_) {}
                    }
                }

                if (changed) {
                    console.log('☁️ Cloud Sync Pull: Cambios aplicados, actualizando vista...');
                    const current = activePage();
                    const activeEl = document.activeElement;
                    const paramPageEl = document.getElementById('page-parametrizaciones_empresa');
                    const isEditingCompanyForm = Boolean(
                        current === 'parametrizaciones_empresa' &&
                        activeEl &&
                        paramPageEl &&
                        paramPageEl.contains(activeEl) &&
                        /^(INPUT|TEXTAREA|SELECT)$/i.test(activeEl.tagName)
                    );

                    if (isEditingCompanyForm && typeof window.refreshCompanyRegistrationInputsFromStorage === 'function') {
                        try { window.refreshCompanyRegistrationInputsFromStorage({ preserveFocused: true }); } catch (_) {}
                    } else {
                        requestSafeSyncRerender(current, { fallbackNavigate: false });
                    }
                    if (typeof window.refreshSmartAlerts === 'function') {
                        try { window.refreshSmartAlerts({ notifyNative: true }); } catch (_) {}
                    }
                    if (typeof window.syncPickupRouteReminders === 'function') {
                        try { window.syncPickupRouteReminders(); } catch (_) {}
                    }
                } else {
                    console.log('☁️ Cloud Sync Pull: Local sincronizado con nube (sin cambios)');
                }

                if (typeof window !== 'undefined' && window.SyncStatus && !error) {
                    try { window.SyncStatus.onSyncSuccess(); } catch (_) {}
                }

                return true;
            } catch (err) {
                const errStr = (err && (err.message || err.details || err.hint)) ? (err.message || err.details || err.hint) : (typeof err === 'object' ? JSON.stringify(err) : String(err));
                console.error('Supabase Pull Error:', errStr);
                if (typeof window !== 'undefined' && window.SyncStatus) {
                    try { window.SyncStatus.onSyncError(err); } catch (_) {}
                }
                return false;
            } finally {
                isSyncPulling = false;
            }
        })();

        try {
            const res = await activePullPromise;
            return res;
        } finally {
            activePullPromise = null;
            activePullDbId = null;
            // Empujar cambios locales pendientes que estaban sin subir cuando se ejecutó el pull
            try {
                const curShared = JSON.parse(localStorage.getItem(userKey('recim_company_shared_settings')) || '{}');
                if (curShared && curShared._pendingCloudSync) {
                    setTimeout(() => {
                        syncSaveCompanySettingsToCloud({});
                    }, 50);
                }
            } catch (_) {}
        }
    }

    // Debounce timer for pushing data
    let syncPushTimeout = null;

    /**
     * Debounced version of syncPushData to avoid race conditions
     * when multiple changes happen rapidly (like clearing all data).
     */
    function debouncedSyncPush() {
        if (syncPushTimeout) clearTimeout(syncPushTimeout);
        syncPushTimeout = setTimeout(() => {
            syncPushData();
        }, 800);
    }

    /**
     * Force an immediate sync and return a promise.
     */
    async function forceSync() {
        if (syncPushTimeout) clearTimeout(syncPushTimeout);
        return await syncPushData(true);
    }

    /**
     * Push Google Drive settings to Supabase user_data table under gdrive_${accountId}.
     */
    async function syncPushGDriveSettings(accountId) {
        if (!isSupabaseActive || !supabaseClient) return false;
        if (!accountId) {
            try {
                const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
                accountId = session.accountId;
            } catch (_) {}
        }
        if (!accountId) return false;

        const folder = localStorage.getItem(userKey('recim_gdrive_folder')) || '';
        const scriptUrl = localStorage.getItem(userKey('recim_gdrive_script_url')) || '';
        const status = localStorage.getItem(userKey('recim_gdrive_status')) || '';

        try {
            const { error } = await supabaseClient
                .from('user_data')
                .upsert({
                    id: `gdrive_${accountId}`,
                    data: { folder, scriptUrl, status },
                    updated_at: new Date().toISOString()
                });
            if (error) throw error;
            console.log(`☁️ Supabase: Guardados ajustes de Google Drive para el usuario ${accountId}`);
            return true;
        } catch (err) {
            console.error('Error syncing Google Drive settings (push):', err);
            return false;
        }
    }

    /**
     * Pull Google Drive settings from Supabase user_data table under gdrive_${accountId} and update localStorage.
     */
    async function syncPullGDriveSettings(accountId) {
        if (!isSupabaseActive || !supabaseClient) return false;
        if (!accountId) {
            try {
                const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
                accountId = session.accountId;
            } catch (_) {}
        }
        if (!accountId) return false;

        try {
            const { data, error } = await supabaseClient
                .from('user_data')
                .select('data')
                .eq('id', `gdrive_${accountId}`)
                .maybeSingle();

            if (error) throw error;

            if (data && data.data) {
                const remote = data.data;
                const remoteFolder = (remote.folder && remote.folder !== '[]') ? remote.folder : '';
                const localFolder = localStorage.getItem(userKey('recim_gdrive_folder')) || '';
                const cleanLocalFolder = (localFolder && localFolder !== '[]') ? localFolder : '';
                const localScriptUrl = localStorage.getItem(userKey('recim_gdrive_script_url')) || '';
                const localStatus = localStorage.getItem(userKey('recim_gdrive_status')) || '';

                if (remoteFolder !== cleanLocalFolder || remote.scriptUrl !== localScriptUrl || remote.status !== localStatus) {
                    if (remoteFolder) {
                        localStorage.setItem(userKey('recim_gdrive_folder'), remoteFolder);
                    } else {
                        localStorage.removeItem(userKey('recim_gdrive_folder'));
                    }

                    if (remote.scriptUrl) {
                        localStorage.setItem(userKey('recim_gdrive_script_url'), remote.scriptUrl);
                    } else {
                        localStorage.removeItem(userKey('recim_gdrive_script_url'));
                    }

                    if (remote.status) {
                        localStorage.setItem(userKey('recim_gdrive_status'), remote.status);
                    } else {
                        localStorage.removeItem(userKey('recim_gdrive_status'));
                    }

                    console.log("☁️ Supabase: Cargados ajustes de Google Drive remotamente.");

                    // Re-render settings if active
                    if (typeof activePage === 'function' && activePage() === 'ajustes') {
                        try {
                            rerenderCurrentPage();
                        } catch (_) {}
                    }
                    return true;
                }
            }
        } catch (err) {
            console.error('Error syncing Google Drive settings (pull):', err);
        }
        return false;
    }

    /**
     * Restore/Pull data from Google Drive.
     */
    async function syncPullGDriveData() {
        const folderInput = localStorage.getItem(userKey('recim_gdrive_folder'));
        if (!folderInput) {
            throw new Error('Google Drive no configurado en los Ajustes.');
        }

        const folderId = extractFolderId(folderInput);
        if (!folderId) {
            throw new Error('Dirección de carpeta inválida.');
        }

        let scriptUrl = (typeof getAppsScriptUrl === 'function')
            ? getAppsScriptUrl()
            : ((typeof _unlockVaultSecret === 'function' && _unlockVaultSecret('GAS_URL')) || '');
        
        let accountId = 'default';
        try {
            const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
            accountId = session.accountId || 'default';
        } catch (_) {}

        const fileName = `reciminsa_backup_${accountId}.json`;

        console.log(`📡 Solicitando restauración desde Google Drive folderId: ${folderId}`);
        
        try {
            const response = await fetch(scriptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify({
                    appToken: APP_SECURITY_TOKEN,
                    action: 'restore',
                    folderId: folderId,
                    fileName: fileName
                })
            });

            if (!response.ok) {
                throw new Error(`Error en servidor (${response.status})`);
            }

            const result = await response.json();
            if (result.status === 'success') {
                const contentObj = JSON.parse(result.content);
                const keys = Object.keys(contentObj);
                if (keys.length === 0) {
                    throw new Error('La copia de seguridad está vacía.');
                }

                // Escribir en localStorage
                keys.forEach(k => {
                    localStorage.setItem(userKey(k), JSON.stringify(contentObj[k]));
                });

                // Forzar sincronización con Supabase para propagar cambios
                await syncPushData(true);
                return true;
            } else {
                throw new Error(result.message || 'Error desconocido al restaurar.');
            }
        } catch (err) {
            console.error('Google Drive Sync Pull Error:', err);
            throw err;
        }
    }

    // Export to window
    window.syncPushData = syncPushData;
    window.syncPullData = syncPullData;
    window.syncSaveCompanySettingsToCloud = syncSaveCompanySettingsToCloud;
    window.syncPullCompanySettingsOnly = syncPullCompanySettingsOnly;
    window.mergeCompanySharedSettings = mergeCompanySharedSettings;
    window.forceSync = forceSync;
    window.syncPushGDrive = syncPushGDrive;
    window.syncPullGDriveData = syncPullGDriveData;
    window.syncPushGDriveExcel = syncPushGDriveExcel;
    window.sendGDriveWelcomeDoc = sendGDriveWelcomeDoc;
    window.syncPushGDriveSettings = syncPushGDriveSettings;
    window.syncPullGDriveSettings = syncPullGDriveSettings;
    window.checkAndRunScheduledGDriveBackup = checkAndRunScheduledGDriveBackup;

    // ---- Planificador automático en segundo plano (Revisa cada 60 segundos) ----
    setInterval(() => {
        try { checkAndRunScheduledGDriveBackup(); } catch (_) {}
    }, 60000);

    document.addEventListener('blur', (event) => {
        const target = event.target;
        if (!target || !target.tagName || String(target.tagName).toUpperCase() !== 'SELECT') return;
        setTimeout(() => {
            if (typeof window.flushDeferredSyncRerender === 'function') {
                window.flushDeferredSyncRerender({ reason: 'blur' });
            }
        }, 150);
    }, true);

    // ---- Main storage event listener ----
    window.addEventListener('storage', function (event) {
        const { key, newValue } = event;
        if (!key) return;

        // Ignore keys that don't belong to this app
        if (!key.startsWith('recim_')) return;

        // Settings (global, not per-user)
        if (key === SETTINGS_KEY) {
            handleSettingsSync(newValue);
            return;
        }

        // Users list
        if (key === USERS_KEY) {
            handleUsersSync(newValue);
            return;
        }

        for (const watched of WATCHED_KEYS) {
            if (key === userKey(watched.pattern)) {
                maybeRerender(watched.pages, watched.label);
                return;
            }
        }
    });

    // ---- Global Storage.prototype override to trigger cloud Push cleanly across browsers & WebViews ----
    if (typeof Storage !== 'undefined' && Storage.prototype && !Storage.prototype.__recimSyncPatched) {
        const protoSetItem = Storage.prototype.setItem;
        const protoRemoveItem = Storage.prototype.removeItem;

        Storage.prototype.setItem = function (key, value) {
            protoSetItem.apply(this, arguments);

            if (this === window.localStorage && !isSyncPulling && typeof key === 'string' && key.startsWith('recim_')) {
                if (typeof window !== 'undefined' && window.StorageEngine && typeof window.StorageEngine.mirrorKey === 'function') {
                    try { window.StorageEngine.mirrorKey(key, value); } catch (_) {}
                }
                const isWatched = WATCHED_KEYS.some(wk => userKey(wk.pattern) === key) || key === userKey(SETTINGS_KEY);
                if (isWatched) {
                    if (typeof window !== 'undefined' && window.SyncStatus && typeof window.SyncStatus.onLocalChange === 'function') {
                        try { window.SyncStatus.onLocalChange(key); } catch (_) {}
                    }
                    if (isSupabaseActive) {
                        debouncedSyncPush();
                    }
                }
            }
        };

        Storage.prototype.removeItem = function (key) {
            protoRemoveItem.apply(this, arguments);

            if (this === window.localStorage && !isSyncPulling && typeof key === 'string' && key.startsWith('recim_')) {
                if (typeof window !== 'undefined' && window.StorageEngine && typeof window.StorageEngine.mirrorKey === 'function') {
                    try { window.StorageEngine.mirrorKey(key, ''); } catch (_) {}
                }
                const isWatched = WATCHED_KEYS.some(wk => userKey(wk.pattern) === key) || key === userKey(SETTINGS_KEY);
                if (isWatched) {
                    if (typeof window !== 'undefined' && window.SyncStatus && typeof window.SyncStatus.onLocalChange === 'function') {
                        try { window.SyncStatus.onLocalChange(key); } catch (_) {}
                    }
                    if (isSupabaseActive) {
                        debouncedSyncPush();
                    }
                }
            }
        };

        Object.defineProperty(Storage.prototype, '__recimSyncPatched', {
            value: true,
            configurable: false,
            enumerable: false,
            writable: false
        });
    }

    // ---- Initial Load: Pull data from cloud ----
    window.addEventListener('load', () => {
        const dbId = getSyncDbId();
        if (dbId) {
            // Give it a moment to ensure isSupabaseActive is set
            setTimeout(() => {
                if (isSupabaseActive) {
                    if (initialPullCompletedDbId !== dbId && (!activePullPromise || activePullDbId !== dbId)) {
                        syncPullData(dbId);
                    }
                    
                    // Comprobar si hay respaldo de Google Drive pendiente según la frecuencia
                    setTimeout(() => {
                        try { checkAndRunScheduledGDriveBackup(); } catch (_) {}
                    }, 3000);
                    
                    // Activar escuchadores de Supabase Realtime para tablas relacionales y user_data
                    const tablesToListen = ['invoices', 'finances', 'clients', 'materials', 'collaborators', 'user_data'];
                    tablesToListen.forEach(tableName => {
                        const realtimeFilter = tableName === 'user_data' ? `id=eq.${dbId}` : `db_id=eq.${dbId}`;
                        supabaseClient.channel(`realtime:${tableName}:${dbId}`)
                            .on('postgres_changes', { event: '*', schema: 'public', table: tableName, filter: realtimeFilter }, payload => {
                                console.log(`🔄 Cambio detectado en tabla relacional ${tableName}:`, payload);
                                if (Date.now() - lastPushTime < 3500) {
                                    console.log('⏭️ Ignorando cambio realtime porque fue originado por nosotros hace poco.');
                                    return;
                                }
                                syncPullData(dbId);
                            })
                            .subscribe();
                    });
                        
                    // Activar notificaciones Push para Soporte IT
                    supabaseClient.channel('global:support_notifications')
                        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_chats' }, payload => {
                            try {
                                const sessionStr = localStorage.getItem('recim_session');
                                if (!sessionStr) return;
                                const sessionObj = JSON.parse(sessionStr);
                                
                                // Solo notificar si el mensaje es de la otra persona y es para el ticket o admin
                                // Para simplificar: notificar si NO somos el emisor
                                if (payload.new.sender_email === sessionObj.email) return;

                                const title = 'Soporte IT: Nuevo Mensaje';
                                const body = `${payload.new.sender_name}: ${payload.new.message}`;

                                // Mostrar notificación push nativa si estamos en móvil
                                if (window.AndroidNative && typeof window.AndroidNative.ShowNotification === 'function') {
                                    window.AndroidNative.ShowNotification(title, body);
                                    if (document.visibilityState === 'visible' && typeof showToast === 'function') {
                                        showToast(`💬 Soporte IT: ${payload.new.sender_name} ha respondido.`, 'info', 5000);
                                    }
                                } else if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.Plugins.LocalNotifications) {
                                    Capacitor.Plugins.LocalNotifications.requestPermissions().then((result) => {
                                        if (result.display === 'granted') {
                                            Capacitor.Plugins.LocalNotifications.schedule({
                                                notifications: [{
                                                    title: title,
                                                    body: body,
                                                    id: new Date().getTime(),
                                                    schedule: { at: new Date(Date.now() + 500) }
                                                }]
                                            });
                                        }
                                    });
                                } else {
                                    // Web Notification (PWA / Desktop)
                                    if ('Notification' in window && document.visibilityState !== 'visible') {
                                        if (Notification.permission === 'granted') {
                                            new Notification(title, { body: body });
                                        } else if (Notification.permission !== 'denied') {
                                            Notification.requestPermission().then(p => {
                                                if (p === 'granted') new Notification(title, { body: body });
                                            });
                                        }
                                    } else if (document.visibilityState === 'visible' && typeof showToast === 'function') {
                                        // Si estamos en la app y no estamos en la página de soporte (donde no hay sync.js), mostramos toast
                                        showToast(`💬 Soporte IT: ${payload.new.sender_name} ha respondido.`, 'info', 5000);
                                    }
                                }
                            } catch (e) { console.error('Push error:', e); }
                        }).subscribe();
                }
            }, 1000);
        }
    });

})();
