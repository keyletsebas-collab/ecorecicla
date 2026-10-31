/* =============================================
   APP.JS – Bootstrap, routing, toasts
   ============================================= */

// ---- Toast system ----
function showToast(message, type = 'success') {
    if (window.AppLogger) {
        if (type === 'error') window.AppLogger.error('TOAST', message);
        else if (type === 'warning') window.AppLogger.warn('TOAST', message);
        else if (type === 'info') window.AppLogger.info('TOAST', message);
        else window.AppLogger.success('TOAST', message);
    }

    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    // Haptic vibration feedback for mobile devices
    try {
        if (navigator.vibrate) {
            if (type === 'error') navigator.vibrate([30, 50, 30]);
            else if (type === 'warning') navigator.vibrate([25]);
            else navigator.vibrate([15]);
        }
    } catch (_) { }

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;

    let icon = '🔔';
    if (type === 'success') icon = '✅';
    else if (type === 'error') icon = '❌';
    else if (type === 'warning') icon = '⚠️';
    else if (type === 'info') icon = 'ℹ️';

    toast.innerHTML = `<span style="font-size:1.15rem; flex-shrink:0;">${icon}</span><span style="flex:1;">${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-15px) scale(0.95)';
        setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    }, 3000);
}


// ---- Page title keys (used with t()) ----
const PAGE_TITLE_KEYS = {
    historial: 'page.historial',
    bitacoras: 'page.bitacoras',
    facturas: 'page.facturas',
    nota_credito: 'Notas de Crédito (B04)',
    nota_debito: 'Notas de Débito (B03)',
    manejo_dgii: 'Manejo DGII – Formatos y Declaraciones Fiscales',
    codigos: 'page.codigos',
    clientes: 'page.clientes',
    ingresos: 'page.ingresos',
    egresos: 'page.egresos',
    ajustes: 'page.ajustes',
    empresas: 'page.empresas',
    ecologia: 'page.ecologia',
    precios: 'page.precios'
};

// ---- Current page tracker (used by sync.js) ----
let _currentPage = null;
// ---- PWA Install Prompt ----
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Notify settings page if it's currently rendered
    if (_currentPage === 'ajustes') rerenderCurrentPage();
});

function getCurrentPage() { return _currentPage; }
function setCurrentPage(pageName) { _currentPage = pageName; }

/**
 * Re-renders the active page in-place. Called by sync.js when
 * another tab modifies shared localStorage data.
 */
function rerenderCurrentPage() {
    const pageName = _currentPage;
    if (!pageName) return;
    const target = document.getElementById(`page-${pageName}`);
    if (!target) return;
    switch (pageName) {
        case 'historial': renderHistoryPage(target); break;
        case 'bitacoras': renderBitacorasPage(target); break;
        case 'facturas': renderInvoicesPage(target); break;
        case 'nota_credito': if (typeof renderCreditNotesPage === 'function') renderCreditNotesPage(target); break;
        case 'nota_debito': if (typeof renderDebitNotesPage === 'function') renderDebitNotesPage(target); break;
        case 'manejo_dgii': if (typeof renderManejoDgiiPage === 'function') renderManejoDgiiPage(target); break;
        case 'empresas': renderClientesPage(target, true); break;
        case 'codigos': renderCodigosPage(target); break;
        case 'clientes': renderClientesPage(target); break;
        case 'ingresos': renderIngresosPage(target); break;
        case 'egresos': renderEgresosPage(target); break;
        case 'ajustes': renderSettingsPage(target); break;
        case 'ecologia': renderEcologyPage(target); break;
        case 'precios': renderPricesPage(target); break;
    }
}

// ---- Navigation ----
function navigate(pageName, subTab = null) {
    // Block navigation if subscription is expired or device is cloned
    if (typeof verifyDeviceAndSubscription === 'function') {
        const verification = verifyDeviceAndSubscription();
        if (!verification.success) {
            checkSubscriptionAndDevice();
            return;
        }
    }

    // Block navigation if module is disabled by the user
    if (pageName !== 'historial' && pageName !== 'ajustes' && typeof getModuleConfig === 'function') {
        const config = getModuleConfig();
        if (config[pageName] === false) {
            navigate('historial');
            return;
        }
    }

    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));

    // Show target page
    // Note: 'empresas' uses the 'facturas' page container
    const realPageName = pageName === 'empresas' ? 'facturas' : pageName;
    const target = document.getElementById(`page-${realPageName}`);
    if (!target) return;
    target.classList.remove('hidden');

    // Track current page for rerenderCurrentPage()
    setCurrentPage(pageName);

    // Update topbar title (translated)
    const titleEl = document.getElementById('topbar-title');
    if (titleEl) titleEl.textContent = t(PAGE_TITLE_KEYS[pageName] || pageName);

    // Update sidebar active state
    setActiveNav(pageName);

    // Close sidebar on mobile
    closeSidebarIfMobile();

    // Render page content
    switch (pageName) {
        case 'historial': renderHistoryPage(target); break;
        case 'bitacoras': renderBitacorasPage(target); break;
        case 'facturas': renderInvoicesPage(target, subTab || 'facturas'); break;
        case 'nota_credito': if (typeof renderCreditNotesPage === 'function') renderCreditNotesPage(target); break;
        case 'nota_debito': if (typeof renderDebitNotesPage === 'function') renderDebitNotesPage(target); break;
        case 'manejo_dgii': if (typeof renderManejoDgiiPage === 'function') renderManejoDgiiPage(target); break;
        case 'empresas': renderClientesPage(target, true); break;
        case 'codigos': renderCodigosPage(target); break;
        case 'clientes': renderClientesPage(target); break;
        case 'ingresos': renderIngresosPage(target); break;
        case 'egresos': renderEgresosPage(target); break;
        case 'ajustes': renderSettingsPage(target); break;
        case 'ecologia': renderEcologyPage(target); break;
        case 'precios': renderPricesPage(target); break;
        case 'colaboradores': renderCollaboratorsPage(target); break;
    }
}

// ---- Set topbar date ----
function setTopbarDate() {
    const el = document.getElementById('topbar-date');
    if (!el) return;
    const lang = (getSettings().language) || 'es';
    el.textContent = new Date().toLocaleDateString(lang, {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
    });
}

// ---- Init app after login ----
function initApp(user) {
    // Check device IMEI fingerprint and subscription state
    if (typeof checkSubscriptionAndDevice === 'function') {
        checkSubscriptionAndDevice();
    }

    // Hide auth, show app
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');

    // Populate user info
    // Clean the name from metadata like | SUB:none | EXP:0
    const cleanName = (user.name || 'Usuario').split(' | ')[0].trim();
    document.getElementById('sidebar-user-name').textContent = cleanName;
    document.getElementById('sidebar-user-email').textContent = user.email || '';
    document.getElementById('sidebar-avatar').textContent = (user.avatar || (user.name || 'U')[0]).toUpperCase();

    setTopbarDate();
    
    // Ensure modules visibility is applied based on user config
    if (typeof applyModuleVisibility === 'function') {
        applyModuleVisibility();
    }
    if (typeof _superAdminCheckNavLink === 'function') {
        _superAdminCheckNavLink();
    }
    
    // Default page (Permitir query param ?page=... o por defecto 'historial')
    let defaultPage = 'historial';
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const pageParam = urlParams.get('page');
        if (pageParam && document.getElementById(`page-${pageParam === 'empresas' ? 'facturas' : pageParam}`)) {
            defaultPage = pageParam;
        }
    } catch (_) {}
    navigate(defaultPage);

    // Pull correct data from Firebase cloud immediately on boot
    if (window.syncPullData) {
        const dbId = user.familyId ? `family_${user.familyId}` : user.accountId;
        window.syncPullData(dbId);
    }

    // Pull Google Drive settings from Supabase on boot
    if (window.syncPullGDriveSettings) {
        window.syncPullGDriveSettings(user.accountId);
    }

    // Request web notification permissions if supported
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
}

// ---- Restore session on load ----
document.addEventListener('DOMContentLoaded', () => {
    // Check if redirecting from desktop app update check
    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('dev') === 'true') {
            const installedVersion = urlParams.get('installed');
            if (installedVersion) {
                fetch('https://raw.githubusercontent.com/keyletsebas-collab/ecorecicla/main/version.json?t=' + Date.now())
                    .then(r => r.json())
                    .then(data => {
                        if (data && data.Version) {
                            const remote = data.Version.replace('v', '').trim();
                            const local = installedVersion.replace('v', '').trim();
                            
                            function isNewer(rVer, lVer) {
                                const rParts = rVer.split('.').map(x => parseInt(x) || 0);
                                const lParts = lVer.split('.').map(x => parseInt(x) || 0);
                                const maxLen = Math.max(rParts.length, lParts.length);
                                for (let i = 0; i < maxLen; i++) {
                                    const rv = rParts[i] || 0;
                                    const lv = lParts[i] || 0;
                                    if (rv > lv) return true;
                                    if (rv < lv) return false;
                                }
                                return false;
                            }
                            
                            if (isNewer(remote, local)) {
                                const confirmDownload = confirm(`¡Actualización Detectada!\n\nHay una nueva versión o parche disponible (${data.Version}). ¿Deseas descargar el instalador ahora?`);
                                if (confirmDownload) {
                                    window.location.href = data.DownloadUrl || 'https://github.com/keyletsebas-collab/ecorecicla/raw/main/Instalar_Reciminsa.exe';
                                }
                            } else {
                                alert(`Tu versión de la aplicación (${installedVersion}) está actualizada. No se requieren nuevos parches en este momento.`);
                            }
                        }
                    })
                    .catch(err => console.error('Error checking version from landing page:', err));
            }
        }
    } catch (e) {
        console.error('Error in URL search parameters parsing:', e);
    }

    if (typeof applySettings === 'function') {
        applySettings(); // apply color theme + dark mode before anything renders
    }
    if (typeof updateQuickLangUI === 'function') {
        const lang = (typeof getSettings === 'function' ? getSettings().language : null) || 'es';
        updateQuickLangUI(lang);
    }
    if (typeof updateSidebarLabels === 'function') {
        updateSidebarLabels();
    }

    // Verify subscription and device integrity on load
    if (localStorage.getItem('recim_session') && typeof checkSubscriptionAndDevice === 'function') {
        checkSubscriptionAndDevice();
    }

    const session = localStorage.getItem('recim_session');
    if (session) {
        try {
            const user = JSON.parse(session);
            
            // Verificación criptográfica de la sesión
            if (user && user.accountId && typeof calculateSecureChecksum === 'function') {
                const expectedSig = calculateSecureChecksum(user.accountId, user.email, user.familyId);
                if (user.signature !== expectedSig) {
                    user.signature = expectedSig;
                    try {
                        localStorage.setItem('recim_session', JSON.stringify(user));
                    } catch (_) {}
                }
            }
            
            // Función helper: Verifica que la sesión fuera de línea no supere los 7 días sin re-validación
            function enforceOfflineTimeout(u) {
                if (!u) return false;
                if (!u.lastOnlineValidation && !u.loginTimestamp) {
                    u.lastOnlineValidation = Date.now();
                    u.loginTimestamp = Date.now();
                    try { localStorage.setItem('recim_session', JSON.stringify(u)); } catch (_) {}
                    return false;
                }
                const MAX_OFFLINE_MS = 7 * 24 * 60 * 60 * 1000; // 7 Días
                const lastValid = u.lastOnlineValidation || u.loginTimestamp || Date.now();
                const elapsedMs = Date.now() - lastValid;

                if (elapsedMs > MAX_OFFLINE_MS) {
                    console.warn("⛔ Sesión expirada: Excedido el tiempo máximo offline.");
                    localStorage.removeItem('recim_session');
                    if (typeof showToast === 'function') {
                        showToast('⚠️ Tu sesión offline ha expirado. Por favor vuelve a iniciar sesión.', 'error', 7000);
                    }
                    setTimeout(() => {
                        window.location.reload();
                    }, 1800);
                    return true;
                }
                return false;
            }

            // Verificación asíncrona y actualización de perfil en Supabase
            if (user && user.accountId && typeof isSupabaseActive !== 'undefined' && isSupabaseActive && supabaseClient) {
                supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('id', user.accountId)
                    .maybeSingle()
                    .then(({ data, error }) => {
                        if (error) throw error;
                        if (data) {
                            if (data.family_id === 'BLOCKED') {
                                localStorage.removeItem('recim_session');
                                showToast('🔴 Tu cuenta ha sido bloqueada por el administrador.', 'error');
                                setTimeout(() => {
                                    window.location.reload();
                                }, 1500);
                                return;
                            }

                            // Re-validación online exitosa: renovar timestamp de sesión de 24h
                            const cachedSession = JSON.parse(localStorage.getItem('recim_session') || '{}');
                            cachedSession.lastOnlineValidation = Date.now();
                            cachedSession.loginTimestamp = cachedSession.loginTimestamp || Date.now();
                            const oldFamilyId = cachedSession.familyId || null;
                            const newFamilyId = data.family_id || null;
                            const oldName = cachedSession.name || '';
                            const newName = data.name || oldName;

                            let sessionChanged = false;
                            if (oldFamilyId !== newFamilyId) {
                                cachedSession.familyId = newFamilyId;
                                sessionChanged = true;
                            }
                            if (oldName !== newName) {
                                cachedSession.name = newName;
                                sessionChanged = true;
                            }

                            if (sessionChanged || !cachedSession.signature) {
                                if (typeof calculateSecureChecksum === 'function') {
                                    cachedSession.signature = calculateSecureChecksum(cachedSession.accountId, cachedSession.email, newFamilyId);
                                }
                                localStorage.setItem('recim_session', JSON.stringify(cachedSession));
                            }
                            
                            // Update sidebar UI directly
                            const nameEl = document.getElementById('sidebar-user-name');
                            const avatarEl = document.getElementById('sidebar-avatar');
                            const newAvatar = (data.avatar || data.name || 'U')[0].toUpperCase();
                            if (nameEl) nameEl.textContent = newName.split(' | ')[0].trim();
                            if (avatarEl) avatarEl.textContent = newAvatar;

                            // If familyId changed, we need to trigger sync pull for the new ID
                            if (oldFamilyId !== newFamilyId) {
                                const newDbId = newFamilyId ? `family_${newFamilyId}` : cachedSession.accountId;
                                showToast('🔄 Tu estado de empresa ha cambiado. Actualizando datos...', 'info');
                                if (window.syncPullData) {
                                    window.syncPullData(newDbId);
                                }
                                if (typeof getCurrentPage === 'function' && getCurrentPage() === 'ajustes') {
                                    rerenderCurrentPage();
                                }
                            }
                        }
                    })
                    .catch(err => {
                        console.warn('Advertencia al verificar perfil (manteniendo sesión activa):', err);
                    });
            } else {
                // Modo fuera de línea o sin cliente Supabase activo: verificar límite offline
                if (enforceOfflineTimeout(user)) {
                    return;
                }
            }
            
            if (typeof initApp === 'function') {
                initApp(user);
            }
        } catch (e) {
            console.warn('Advertencia en inicialización de app.js (manteniendo sesión activa):', e);
        }
    } else {
        if (typeof checkShowSavedAccountModal === 'function') {
            setTimeout(checkShowSavedAccountModal, 400);
        }
    }

    // Update date every minute
    setTopbarDate();
    setInterval(setTopbarDate, 60000);
});

// ---- App hard refresh & cache clear ----
async function handleAppRefresh() {
    // 1. Show notification that refresh is in progress
    const msg = typeof t === 'function' ? t('toast.refreshing') : '🔄 Actualizando aplicación y sincronizando datos...';
    showToast(msg, 'info');

    // 2. Add rotation animation to the sidebar logo image
    const logoImg = document.getElementById('sidebar-logo-img');
    if (logoImg) {
        logoImg.classList.add('refreshing');
    }

    // 3. Trigger database synchronization pull
    try {
        if (window.syncPullData) {
            const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
            const dbId = session.familyId ? `family_${session.familyId}` : session.accountId;
            if (dbId) {
                await window.syncPullData(dbId);
            }
        }
    } catch (e) {
        console.error('Error syncing during hard refresh:', e);
    }

    // 4. Delete Service Worker registrations and Cache storage
    try {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let reg of registrations) {
                await reg.unregister();
            }
        }
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            for (let name of cacheNames) {
                await caches.delete(name);
            }
        }
        console.log('SW and Cache storage cleared.');
    } catch (e) {
        console.error('Error clearing cache storage:', e);
    }

    // 5. Reload the page after 1.2 seconds to let the user see the rotation and feedback
    setTimeout(() => {
        if (window.location.search) {
            window.location.href = window.location.origin + window.location.pathname;
        } else {
            window.location.reload();
        }
    }, 1200);
}

function toggleLanguageQuickly() {
    const current = (typeof getSettings === 'function' ? getSettings().language : localStorage.getItem('recim_language')) || 'es';
    const next = current === 'es' ? 'en' : 'es';
    if (typeof handleLangChange === 'function') {
        handleLangChange(next);
    } else {
        if (typeof saveSetting === 'function') {
            saveSetting('language', next);
        } else {
            localStorage.setItem('recim_language', next);
        }
        window.location.reload();
    }
    updateQuickLangUI(next);
}
window.toggleLanguageQuickly = toggleLanguageQuickly;

function updateQuickLangUI(lang) {
    const flagEl = document.getElementById('quick-lang-flag');
    const labelEl = document.getElementById('quick-lang-label');
    if (!flagEl || !labelEl) return;
    if (lang === 'es') {
        flagEl.textContent = '🇪🇸';
        labelEl.textContent = 'ES';
    } else {
        flagEl.textContent = '🇺🇸';
        labelEl.textContent = 'EN';
    }
}
window.updateQuickLangUI = updateQuickLangUI;

// ---- Native/Capacitor/Web Sharing and Opening Utilities ----
function openExternalLink(url) {
    if (window.AndroidNative && typeof window.AndroidNative.OpenUrl === 'function') {
        window.AndroidNative.OpenUrl(url);
    } else if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
        window.open(url, '_system');
    } else {
        window.open(url, '_blank');
    }
}
window.openExternalLink = openExternalLink;
