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
    ajustes: 'page.ajustes'
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
        case 'codigos': renderCodigosPage(target); break;
        case 'clientes': renderClientesPage(target); break;
        case 'ingresos': renderIngresosPage(target); break;
        case 'egresos': renderEgresosPage(target); break;
        case 'ajustes': renderSettingsPage(target); break;
    }
}

// ---- Navigation ----
function navigate(pageName) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));

    // Show target page
    const target = document.getElementById(`page-${pageName}`);
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
        case 'facturas': renderInvoicesPage(target); break;
        case 'codigos': renderCodigosPage(target); break;
        case 'clientes': renderClientesPage(target); break;
        case 'ingresos': renderIngresosPage(target); break;
        case 'egresos': renderEgresosPage(target); break;
        case 'ajustes': renderSettingsPage(target); break;
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
    // Hide auth, show app
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');

    // Populate user info
    document.getElementById('sidebar-user-name').textContent = user.name || 'Usuario';
    document.getElementById('sidebar-user-email').textContent = user.email || '';
    document.getElementById('sidebar-avatar').textContent = (user.avatar || (user.name || 'U')[0]).toUpperCase();

    setTopbarDate();
    
    // Default page (Restricted to Ingresos/Egresos on mobile)
    const defaultPage = isMobile() ? 'ingresos' : 'historial';
    navigate(defaultPage);
}

// ---- Restore session on load ----
document.addEventListener('DOMContentLoaded', () => {
    applySettings(); // apply color theme + dark mode before anything renders

    const session = localStorage.getItem('recim_session');
    if (session) {
        try {
            const user = JSON.parse(session);
            initApp(user);
        } catch (_) {
            localStorage.removeItem('recim_session');
        }
    }

    // Update date every minute
    setTopbarDate();
    setInterval(setTopbarDate, 60000);
});
