/* =============================================
   SIDEBAR.JS – Toggle & navigation
   ============================================= */

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const isOpen = sidebar.classList.contains('open');

    if (isOpen) {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    } else {
        sidebar.classList.add('open');
        overlay.classList.add('active');
    }
}

// Close sidebar on wide screens (no mobile)
function isMobile() {
    return window.innerWidth <= 768;
}

function closeSidebarIfMobile() {
    if (isMobile()) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }
}

function toggleSidebarDropdown(id) {
    const dropdown = document.getElementById(`sidebar-dropdown-${id}`);
    if (!dropdown) return;
    dropdown.classList.toggle('open');
}

// Highlight active nav link
function setActiveNav(pageName) {
    // Sidebar links
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === pageName) link.classList.add('active');
    });

    // Auto-expand and highlight dropdown if active link is inside
    const finanzasPages = ['facturas', 'nota_credito', 'nota_debito', 'ingresos', 'egresos', 'manejo_dgii'];
    const dropdownFinanzas = document.getElementById('sidebar-dropdown-finanzas');
    const toggleFinanzas = document.getElementById('sidebar-dropdown-toggle-finanzas');
    if (dropdownFinanzas && toggleFinanzas) {
        if (finanzasPages.includes(pageName)) {
            dropdownFinanzas.classList.add('open');
            toggleFinanzas.classList.add('active-parent');
        } else {
            toggleFinanzas.classList.remove('active-parent');
        }
    }

    // Bottom nav links
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === pageName) item.classList.add('active');
    });
}

window.toggleSidebarDropdown = toggleSidebarDropdown;
