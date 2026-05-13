/* =============================================
   SYNC.JS – Sincronización en tiempo real entre pestañas
   Usa el evento nativo `storage` que el navegador dispara
   en todas las pestañas que NO hicieron el cambio.
   ============================================= */

(function () {
    // Keys that, when changed in another tab, should trigger a re-render
    const WATCHED_KEYS = [
        { pattern: 'recim_invoices', pages: ['facturas', 'historial'], label: '🧾 Facturas' },
        { pattern: 'recim_material_codes', pages: ['codigos'], label: '🏷️ Materiales' },
        { pattern: 'recim_clients', pages: ['clientes'], label: '👥 Clientes' },
        { pattern: 'recim_ingresos', pages: ['ingresos'], label: '💰 Ingresos' },
        { pattern: 'recim_egresos', pages: ['egresos'], label: '💸 Egresos' },
    ];

    // Special keys handled separately
    const SETTINGS_KEY = 'recim_settings';
    const USERS_KEY = 'recim_users';

    console.log("🔄 Sync Module v1.1 Active: Cloud deletions support enabled.");

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

    /**
     * Re-render the currently active page if it matches one of the affected pages.
     */
    function maybeRerender(affectedPages, label) {
        const page = activePage();
        if (!page) return;

        if (affectedPages.includes(page)) {
            syncToast(label);
            try {
                rerenderCurrentPage();
            } catch (_) {
                // Fallback: navigate to the same page to force a re-render
                try { navigate(page); } catch (__) { }
            }
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

    // ---- Cloud Sync Logic (Firebase) ----

    /**
     * Push current localStorage data to Firebase.
     */
    async function syncPushData() {
        if (!isFirebaseActive || !db) return;
        const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
        const accountId = session.accountId;
        if (!accountId) return;

        const dataToSync = {};
        let hasData = false;
        WATCHED_KEYS.forEach(k => {
            const val = localStorage.getItem(k.pattern);
            if (val) {
                dataToSync[k.pattern] = JSON.parse(val);
                hasData = true;
            }
        });

        try {
            // Use null if no data to ensure the cloud path is cleared
            const finalData = hasData ? dataToSync : null;
            await db.ref(`data/${accountId}`).set(finalData);
            console.log(`☁️ Firebase Push: ${hasData ? 'Datos actualizados' : 'Nube limpiada (vacío)'}`);
            return true;
        } catch (err) {
            console.error('Firebase Sync Push Error:', err);
            return false;
        }
    }

    /**
     * Pull data from Firebase and update localStorage.
     */
    async function syncPullData(accountId) {
        if (!isFirebaseActive || !db) return;
        if (!accountId) {
            const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
            accountId = session.accountId;
        }
        if (!accountId) return;

        try {
            const snapshot = await db.ref(`data/${accountId}`).get();
            const remoteData = snapshot.val() || {}; // Fallback to empty object

            let changed = false;

            // 1. Update or clear local data based on remote state
            WATCHED_KEYS.forEach(k => {
                const remoteVal = remoteData[k.pattern];
                const localVal = localStorage.getItem(k.pattern);
                
                if (remoteVal === undefined) {
                    // Missing in cloud = should be missing in local
                    if (localVal !== null) {
                        localStorage.removeItem(k.pattern);
                        changed = true;
                        console.log(`☁️ Firebase Pull: Eliminando ${k.label} localmente (Sincronizado)`);
                    }
                } else {
                    // Exists in cloud = update local if different
                    const remoteStr = JSON.stringify(remoteVal);
                    if (localVal !== remoteStr) {
                        localStorage.setItem(k.pattern, remoteStr);
                        changed = true;
                        console.log(`☁️ Firebase Pull: Actualizando ${k.label} (Datos remotos)`);
                    }
                }
            });

            if (changed) {
                console.log('☁️ Firebase Pull: Cambios aplicados, renderizando...');
                try { rerenderCurrentPage(); } catch (_) { }
            } else {
                console.log('☁️ Firebase Pull: Local sincronizado con nube (sin cambios)');
            }
        } catch (err) {
            console.error('Firebase Pull Error:', err);
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
        return await syncPushData();
    }

    // Export to window
    window.syncPushData = syncPushData;
    window.syncPullData = syncPullData;
    window.forceSync = forceSync;

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
            if (key === watched.pattern) {
                maybeRerender(watched.pages, watched.label);
                return;
            }
        }
    });

    // ---- Global localStorage override to trigger cloud Push ----
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function (key, value) {
        originalSetItem.apply(this, arguments);

        // If the key is one of our watched keys, push to cloud
        if (isFirebaseActive && key.startsWith('recim_')) {
            const isWatched = WATCHED_KEYS.some(wk => wk.pattern === key);
            if (isWatched) {
                debouncedSyncPush();
            }
        }
    };

    const originalRemoveItem = localStorage.removeItem;
    localStorage.removeItem = function (key) {
        originalRemoveItem.apply(this, arguments);

        // If a watched key is removed, sync the empty state to cloud
        if (isFirebaseActive && key.startsWith('recim_')) {
            const isWatched = WATCHED_KEYS.some(wk => wk.pattern === key);
            if (isWatched) {
                debouncedSyncPush();
            }
        }
    };

    // ---- Initial Load: Pull data from cloud ----
    window.addEventListener('load', () => {
        const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
        if (session.accountId) {
            // Give it a moment to ensure isFirebaseActive is set
            setTimeout(() => {
                if (isFirebaseActive) syncPullData(session.accountId);
            }, 1000);
        }
    });

})();
