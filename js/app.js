/* =============================================
   APP.JS – Bootstrap, routing, toasts
   ============================================= */

// ---- Toast system ----
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 3000);
}

// ---- Page title keys (used with t()) ----
const PAGE_TITLE_KEYS = {
    historial: 'page.historial',
    bitacoras: 'page.bitacoras',
    facturas: 'page.facturas',
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
        case 'facturas': renderInvoicesPage(target, subTab || 'local'); break;
        case 'empresas': renderClientesPage(target, true); break;
        case 'codigos': renderCodigosPage(target); break;
        case 'clientes': renderClientesPage(target); break;
        case 'ingresos': renderIngresosPage(target); break;
        case 'egresos': renderEgresosPage(target); break;
        case 'ajustes': renderSettingsPage(target); break;
        case 'ecologia': renderEcologyPage(target); break;
        case 'precios': renderPricesPage(target); break;
        case 'superadmin': renderSuperAdminPage(target); break;
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
    
    // Default page (Restricted to Ingresos/Egresos on mobile)
    const defaultPage = isMobile() ? 'ingresos' : 'historial';
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

    applySettings(); // apply color theme + dark mode before anything renders
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
                    console.warn("⚠️ Sesión alterada detectada al inicio. Cerrando sesión...");
                    localStorage.removeItem('recim_session');
                    window.location.reload();
                    return;
                }
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

                            // Update cached session if different
                            const cachedSession = JSON.parse(localStorage.getItem('recim_session') || '{}');
                            const oldFamilyId = cachedSession.familyId || null;
                            const newFamilyId = data.family_id || null;
                            const oldName = cachedSession.name || '';
                            const newName = data.name || '';
                            const oldAvatar = cachedSession.avatar || '';
                            const newAvatar = (data.avatar || data.name || 'U')[0].toUpperCase();

                            if (oldFamilyId !== newFamilyId || oldName !== newName || oldAvatar !== newAvatar) {
                                cachedSession.familyId = newFamilyId;
                                cachedSession.name = newName;
                                cachedSession.avatar = newAvatar;
                                if (typeof calculateSecureChecksum === 'function') {
                                    cachedSession.signature = calculateSecureChecksum(cachedSession.accountId, cachedSession.email, newFamilyId);
                                }
                                localStorage.setItem('recim_session', JSON.stringify(cachedSession));
                                
                                // Update sidebar UI directly
                                const nameEl = document.getElementById('sidebar-user-name');
                                const avatarEl = document.getElementById('sidebar-avatar');
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
                        }
                    })
                    .catch(err => console.error('Error verifying profile:', err));
            }
            
            initApp(user);
        } catch (_) {
            localStorage.removeItem('recim_session');
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
        window.location.reload();
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
