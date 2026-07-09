/* =============================================
   SYNC.JS – Sincronización en tiempo real entre pestañas
   Usa el evento nativo `storage` que el navegador dispara
   en todas las pestañas que NO hicieron el cambio.
   ============================================= */

(function () {
    // Keys that, when changed in another tab, should trigger a re-render
    const WATCHED_KEYS = [
        { pattern: 'recim_invoices', pages: ['historial'], label: '🧾 Facturas' },
        { pattern: 'recim_material_codes', pages: ['codigos'], label: '🏷️ Materiales' },
        { pattern: 'recim_clients', pages: ['clientes'], label: '👥 Clientes' },
        { pattern: 'recim_ingresos', pages: ['ingresos'], label: '💰 Ingresos' },
        { pattern: 'recim_egresos', pages: ['egresos'], label: '💸 Egresos' },
        { pattern: 'recim_company_admin', pages: ['ajustes', 'colaboradores'], label: '👑 Admin de Empresa' },
        { pattern: 'recim_collaborators', pages: ['colaboradores', 'ingresos', 'egresos', 'bitacoras'], label: '🤝 Colaboradores' },
        { pattern: 'recim_company_shared_settings', pages: ['ajustes'], label: '⚙️ Ajustes de Empresa' },
        { pattern: 'recim_company_id', pages: ['ajustes'], label: '🏢 ID de Empresa' },
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

        // Apply module visibility changes if collaborators are updated
        if (affectedPages.includes('colaboradores') && typeof applyModuleVisibility === 'function') {
            try { applyModuleVisibility(); } catch (_) {}
        }

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
                        console.warn("⚠️ Sesión alterada en getSyncDbId. Cerrando sesión...");
                        localStorage.removeItem('recim_session');
                        window.location.reload();
                        return null;
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
     * Push current localStorage data to Supabase.
     */
    async function syncPushData(force = false) {
        if (!isSupabaseActive || !supabaseClient) return;
        const dbId = getSyncDbId();
        if (!dbId) return;

        const dataToSync = {};
        let hasData = false;
        WATCHED_KEYS.forEach(k => {
            const val = localStorage.getItem(userKey(k.pattern));
            if (val) {
                try {
                    dataToSync[k.pattern] = JSON.parse(val);
                } catch (_) {
                    dataToSync[k.pattern] = val;
                }
                hasData = true;
            }
        });

        try {
            const finalData = hasData ? dataToSync : {};
            const { error } = await supabaseClient
                .from('user_data')
                .upsert({
                    id: dbId,
                    data: finalData,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            console.log(`☁️ Supabase Push: ${hasData ? 'Datos actualizados' : 'Nube limpiada (vacío)'} para DB: ${dbId}`);
            
            // Sincronizar también con Google Drive (respaldo dual automático)
            syncPushGDrive(finalData, force).then(ok => {
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

            return true;
        } catch (err) {
            console.error('Supabase Sync Push Error:', err);
            return false;
        }
    }

    /**
     * Parse Google Drive URL/ID to extract Folder ID.
     */
    function extractFolderId(input) {
        if (!input) return null;
        const match = input.match(/\/folders\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
            return match[1];
        }
        return input.trim();
    }

    /**
     * Push current database data to Google Drive.
     */
    async function syncPushGDrive(data, force = false) {
        const folderInput = localStorage.getItem(userKey('recim_gdrive_folder'));
        if (!folderInput) return false; // Not configured

        const folderId = extractFolderId(folderInput);
        if (!folderId) return false;

        // Check 2-hour rate limit if not forced
        const now = Date.now();
        if (!force) {
            const lastSync = localStorage.getItem(userKey('recim_last_json_sync'));
            if (lastSync) {
                const elapsed = now - parseInt(lastSync, 10);
                if (elapsed < 2 * 60 * 60 * 1000) {
                    console.log("⏳ Google Drive JSON: Omitiendo auto-envío (límite de 2 horas activo).");
                    return false;
                }
            }
        }

        let scriptUrl = localStorage.getItem(userKey('recim_gdrive_script_url'));
        if (!scriptUrl) {
            // Fall back to the administrator's central script
            if (typeof getAppsScriptUrl === 'function') {
                scriptUrl = getAppsScriptUrl();
            } else {
                scriptUrl = 'https://script.google.com/macros/s/AKfycbxYHnE-4KnXCqd-l3MWNKtQ3_HU-Fz6GNsNhf05loH0pfvJTXxbwujAC21OvLZddvSI/exec';
            }
        }
        
        let accountId = 'default';
        try {
            const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
            accountId = session.accountId || 'default';
        } catch (_) {}

        const fileName = `reciminsa_backup_${accountId}.json`;

        console.log(`📡 Enviando respaldo a Google Drive folderId: ${folderId}`);
        
        try {
            await fetch(scriptUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify({
                    appToken: APP_SECURITY_TOKEN,
                    action: 'backup',
                    folderId: folderId,
                    fileName: fileName,
                    content: JSON.stringify(data || {})
                })
            });

            console.log('☁️ Google Drive Sync: Respaldo enviado con éxito.');
            localStorage.setItem(userKey('recim_last_json_sync'), now.toString());
            return true;
        } catch (err) {
            console.error('Google Drive Sync Push Error:', err);
            return false;
        }
    }

/**
 * Push ALL Excel files (Facturas, Ingresos, Egresos, Materiales) to Google Drive.
 * Generates them with SheetJS and sends as base64, always regardless of data state.
 */
async function syncPushGDriveExcel(force = false) {
    if (typeof XLSX === 'undefined') return false;

    const folderInput = localStorage.getItem(userKey('recim_gdrive_folder'));
    if (!folderInput) return false;

    const folderId = extractFolderId(folderInput);
    if (!folderId) return false;

    // Check 2-hour rate limit if not forced
    const now = Date.now();
    if (!force) {
        const lastSync = localStorage.getItem(userKey('recim_last_excel_sync'));
        if (lastSync) {
            const elapsed = now - parseInt(lastSync, 10);
            if (elapsed < 2 * 60 * 60 * 1000) {
                console.log("⏳ Google Drive Excel: Omitiendo auto-envío (límite de 2 horas activo).");
                return false;
            }
        }
    }

    let scriptUrl = localStorage.getItem(userKey('recim_gdrive_script_url'));
    if (!scriptUrl) {
        if (typeof getAppsScriptUrl === 'function') {
            scriptUrl = getAppsScriptUrl();
        } else {
            scriptUrl = 'https://script.google.com/macros/s/AKfycbxYHnE-4KnXCqd-l3MWNKtQ3_HU-Fz6GNsNhf05loH0pfvJTXxbwujAC21OvLZddvSI/exec';
        }
    }

    let accountId = 'default';
    try {
        const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
        accountId = session.accountId || 'default';
    } catch (_) {}

    // Helper: build an Excel workbook for a given set of sheets (name + headers + rows AOA)
    function buildAndEncodeWorkbook(sheets) {
        const wb = XLSX.utils.book_new();
        sheets.forEach(({ name, headers, rows }) => {
            let ws;
            if (rows.length === 0) {
                ws = XLSX.utils.aoa_to_sheet([headers, ['Sin datos']]);
            } else {
                ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            }
            // Apply premium formatting and styling
            if (typeof formatAndStyleWorksheet === 'function') {
                formatAndStyleWorksheet(ws);
            }
            XLSX.utils.book_append_sheet(wb, ws, name);
        });
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        return wbout;
    }

    // Gather all data
    const invoices = JSON.parse(localStorage.getItem(userKey('recim_invoices')) || '[]');
    const ingresos = JSON.parse(localStorage.getItem(userKey('recim_ingresos')) || '[]');
    const egresos  = JSON.parse(localStorage.getItem(userKey('recim_egresos'))  || '[]');
    const mats     = (typeof getMaterialCodes === 'function') ? getMaterialCodes() : [];

    // 1. Map Facturas (AOA with formulas)
    const invHeaders = [
        'ID', 'Fecha', 'Cliente', 'Tipo', 'Material', 
        'Cantidad', 'Unidad', 'Precio Compra', 'Precio Venta', 
        'Total Compra', 'Total Venta', 'Ganancia', 'Notas'
    ];
    const invRows = [];
    let invRowIndex = 2; // Row 1 is headers
    invoices.forEach(inv => {
        (inv.items || []).forEach(item => {
            invRows.push([
                inv.id,
                inv.date,
                inv.client || inv.company || '—',
                inv.type || 'basic',
                item.name || item.desc || '',
                item.qty || 0,
                item.unit || 'kg',
                item.priceBuy || item.uprice || 0,
                item.priceSell || 0,
                { f: `F${invRowIndex}*H${invRowIndex}` }, // J - Total Compra (Fórmula)
                { f: `F${invRowIndex}*I${invRowIndex}` }, // K - Total Venta (Fórmula)
                { f: `K${invRowIndex}-J${invRowIndex}` }, // L - Ganancia (Fórmula)
                inv.notes || ''
            ]);
            invRowIndex++;
        });
    });

    // 2. Map Ingresos (AOA)
    const incHeaders = ['ID', 'Fecha', 'Concepto', 'Monto', 'Categoría', 'Notas'];
    const incRows = ingresos.map(i => [
        i.id,
        i.date,
        i.concept,
        i.amount,
        i.category || 'General',
        i.notes || ''
    ]);

    // 3. Map Egresos (AOA)
    const expHeaders = ['ID', 'Fecha', 'Concepto', 'Monto', 'Categoría', 'Notas'];
    const expRows = egresos.map(e => [
        e.id,
        e.date,
        e.concept,
        e.amount,
        e.category || 'General',
        e.notes || ''
    ]);

    // 4. Map Materiales (AOA)
    const matHeaders = ['Código', 'Nombre', 'Unidad'];
    const matRows = mats.map(m => [
        m.id || m.code || '',
        m.name || '',
        m.unit || 'kg'
    ]);

    // Format date and time for filename (e.g., YYYY-MM-DD_HH-mm)
    const nowObj = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const datePart = nowObj.getFullYear() + '-' + pad(nowObj.getMonth() + 1) + '-' + pad(nowObj.getDate());
    const timePart = pad(nowObj.getHours()) + '-' + pad(nowObj.getMinutes());
    const timestampLabel = `${datePart}_${timePart}`;

    // Define the Excel files to send
    const excelFiles = [
        {
            fileName: `Reciminsaap_Facturas_${accountId}_${timestampLabel}.xlsx`,
            sheets: [{ name: 'Facturas', headers: invHeaders, rows: invRows }]
        },
        {
            fileName: `Reciminsaap_Finanzas_${accountId}_${timestampLabel}.xlsx`,
            sheets: [
                { name: 'Ingresos', headers: incHeaders, rows: incRows },
                { name: 'Egresos', headers: expHeaders, rows: expRows }
            ]
        },
        {
            fileName: `Reciminsaap_Materiales_${accountId}_${timestampLabel}.xlsx`,
            sheets: [{ name: 'Catálogo_Materiales', headers: matHeaders, rows: matRows }]
        }
    ];

    let allSuccess = true;
    for (const fileInfo of excelFiles) {
        try {
            const base64Content = buildAndEncodeWorkbook(fileInfo.sheets);
            await fetch(scriptUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    appToken: APP_SECURITY_TOKEN,
                    action: 'excel',
                    folderId: folderId,
                    fileName: fileInfo.fileName,
                    base64Content: base64Content
                })
            });
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
 * Send a welcome document to Google Drive.
 */
async function sendGDriveWelcomeDoc() {
    const folderInput = localStorage.getItem(userKey('recim_gdrive_folder'));
    if (!folderInput) return false;

    const folderId = extractFolderId(folderInput);
    if (!folderId) return false;

    let scriptUrl = localStorage.getItem(userKey('recim_gdrive_script_url'));
    if (!scriptUrl) {
        if (typeof getAppsScriptUrl === 'function') {
            scriptUrl = getAppsScriptUrl();
        } else {
            scriptUrl = 'https://script.google.com/macros/s/AKfycbxYHnE-4KnXCqd-l3MWNKtQ3_HU-Fz6GNsNhf05loH0pfvJTXxbwujAC21OvLZddvSI/exec';
        }
    }

    try {
        await fetch(scriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({
                appToken: APP_SECURITY_TOKEN,
                action: 'backup',
                folderId: folderId,
                fileName: 'Bienvenido_a_Reciminsaap.txt',
                content: '¡Bienvenido a Reciminsaap!\n\nTu carpeta de Google Drive ha sido vinculada correctamente.\nAquí se guardarán tus copias de seguridad de datos (.json) y tus reportes de Excel (.xlsx) automáticamente.\n\nFecha de vinculación: ' + new Date().toLocaleString()
            })
        });
        return true;
    } catch (err) {
        console.error('Error sending welcome document:', err);
        return false;
    }
}

    /**
     * Pull data from Supabase and update localStorage.
     */
    async function syncPullData(dbId) {
        if (!isSupabaseActive || !supabaseClient) return;
        if (!dbId) {
            dbId = getSyncDbId();
        }
        if (!dbId) return;

        try {
            const { data, error } = await supabaseClient
                .from('user_data')
                .select('data')
                .eq('id', dbId)
                .maybeSingle();

            if (error) throw error;

            if (!data || !data.data || Object.keys(data.data).length === 0) {
                console.log(`☁️ Supabase Pull: Sin datos en la nube para ${dbId}. Inicializando con datos locales...`);
                await syncPushData(true);
                return;
            }
            
            const remoteData = data.data;
            let changed = false;

            // 1. Update or clear local data based on remote state
            WATCHED_KEYS.forEach(k => {
                const remoteVal = remoteData[k.pattern];
                const localVal = localStorage.getItem(userKey(k.pattern));
                
                if (remoteVal === undefined) {
                    // Missing in cloud: do NOT delete local data if it contains items!
                    // This prevents wiping local data before it has been pushed.
                    if (localVal !== null && localVal !== '[]' && localVal !== '{}') {
                        console.log(`☁️ Supabase Pull: ${k.label} no existe en la nube pero tiene datos locales. Conservando y programando push.`);
                        setTimeout(() => syncPushData(), 1000);
                    } else if (localVal !== null) {
                        localStorage.removeItem(userKey(k.pattern));
                        changed = true;
                        console.log(`☁️ Supabase Pull: Eliminando ${k.label} localmente (Sincronizado)`);
                    }
                } else {
                    // Exists in cloud = update local if different
                    const remoteStr = JSON.stringify(remoteVal);
                    if (localVal !== remoteStr) {
                        localStorage.setItem(userKey(k.pattern), remoteStr);
                        changed = true;
                        console.log(`☁️ Supabase Pull: Actualizando ${k.label} (Datos remotos)`);
                    }
                }
            });

            if (changed) {
                console.log('☁️ Supabase Pull: Cambios aplicados, renderizando...');
                try { rerenderCurrentPage(); } catch (_) { }
            } else {
                console.log('☁️ Supabase Pull: Local sincronizado con nube (sin cambios)');
            }
        } catch (err) {
            console.error('Supabase Pull Error:', err);
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
                const localFolder = localStorage.getItem(userKey('recim_gdrive_folder')) || '';
                const localScriptUrl = localStorage.getItem(userKey('recim_gdrive_script_url')) || '';
                const localStatus = localStorage.getItem(userKey('recim_gdrive_status')) || '';

                if (remote.folder !== localFolder || remote.scriptUrl !== localScriptUrl || remote.status !== localStatus) {
                    if (remote.folder) {
                        localStorage.setItem(userKey('recim_gdrive_folder'), remote.folder);
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

        let scriptUrl = localStorage.getItem(userKey('recim_gdrive_script_url'));
        if (!scriptUrl) {
            if (typeof getAppsScriptUrl === 'function') {
                scriptUrl = getAppsScriptUrl();
            } else {
                scriptUrl = 'https://script.google.com/macros/s/AKfycbxYHnE-4KnXCqd-l3MWNKtQ3_HU-Fz6GNsNhf05loH0pfvJTXxbwujAC21OvLZddvSI/exec';
            }
        }
        
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
    window.forceSync = forceSync;
    window.syncPushGDrive = syncPushGDrive;
    window.syncPullGDriveData = syncPullGDriveData;
    window.syncPushGDriveExcel = syncPushGDriveExcel;
    window.sendGDriveWelcomeDoc = sendGDriveWelcomeDoc;
    window.syncPushGDriveSettings = syncPushGDriveSettings;
    window.syncPullGDriveSettings = syncPullGDriveSettings;

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

    // ---- Global localStorage override to trigger cloud Push ----
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function (key, value) {
        originalSetItem.apply(this, arguments);

        // If the key is one of our watched keys, push to cloud
        if (isSupabaseActive && key.startsWith('recim_')) {
            const isWatched = WATCHED_KEYS.some(wk => userKey(wk.pattern) === key);
            if (isWatched) {
                debouncedSyncPush();
            }
        }
    };

    const originalRemoveItem = localStorage.removeItem;
    localStorage.removeItem = function (key) {
        originalRemoveItem.apply(this, arguments);

        // If a watched key is removed, sync the empty state to cloud
        if (isSupabaseActive && key.startsWith('recim_')) {
            const isWatched = WATCHED_KEYS.some(wk => userKey(wk.pattern) === key);
            if (isWatched) {
                debouncedSyncPush();
            }
        }
    };

    // ---- Initial Load: Pull data from cloud ----
    window.addEventListener('load', () => {
        const dbId = getSyncDbId();
        if (dbId) {
            // Give it a moment to ensure isSupabaseActive is set
            setTimeout(() => {
                if (isSupabaseActive) {
                    syncPullData(dbId);
                    
                    // Activate Realtime Database listeners
                    supabaseClient.channel('custom-all-channel')
                        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_data', filter: `id=eq.${dbId}` }, payload => {
                            console.log('🔄 Cambio detectado en Realtime Database:', payload);
                            // Avoid unnecessary push loop by just pulling new data
                            syncPullData(dbId);
                        })
                        .subscribe((status) => {
                            if (status === 'SUBSCRIBED') {
                                console.log('📡 Conectado a Supabase Realtime Database exitosamente.');
                            }
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
                                if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.Plugins.LocalNotifications) {
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
