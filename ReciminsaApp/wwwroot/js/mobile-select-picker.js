/* =============================================
   MOBILE-SELECT-PICKER.JS
   Ultra-luxurious native-feeling Bottom Sheet picker
   for <select> elements on mobile viewports.
   ============================================= */

(function initMobileSelectEnhancer() {
    function isMobileDevice() {
        return window.innerWidth <= 768 ||
            document.documentElement.classList.contains('is-mobile-device') ||
            /android|iphone|ipad|ipod/i.test(navigator.userAgent || '');
    }

    // Handle delegated pointerdown on <select> to prevent native dialog and show sheet
    document.addEventListener('pointerdown', (e) => {
        const select = e.target.closest('select');
        if (!select) return;
        if (!isMobileDevice()) return;
        if (select.dataset.native === 'true') return;
        if (select.disabled) return;

        // Prevent Android WebView single-choice dialog
        e.preventDefault();
        e.stopPropagation();
        select.blur();

        openMobileSelectSheet(select);
    }, true);

    // Also guard on click for browsers that trigger on click
    document.addEventListener('click', (e) => {
        const select = e.target.closest('select');
        if (!select) return;
        if (!isMobileDevice()) return;
        if (select.dataset.native === 'true') return;
        if (select.disabled) return;

        e.preventDefault();
        e.stopPropagation();
        select.blur();
    }, true);

    function openMobileSelectSheet(select) {
        closeActiveSheet();

        // Determine title
        let title = 'Seleccionar opción';
        if (select.id) {
            const lbl = document.querySelector(`label[for="${select.id}"]`) ||
                        select.closest('.form-group')?.querySelector('.form-label');
            if (lbl) {
                title = lbl.textContent.replace(/[#*]/g, '').trim();
            }
        }
        if (!title && select.title) title = select.title;
        if (!title && select.name) title = select.name;

        // Read options
        const rawOptions = Array.from(select.options);
        if (rawOptions.length === 0) return;

        const backdrop = document.createElement('div');
        backdrop.className = 'mobile-select-backdrop';

        const sheet = document.createElement('div');
        sheet.className = 'mobile-select-sheet';

        const showSearch = rawOptions.length > 5;

        sheet.innerHTML = `
            <div class="mobile-select-handle"></div>
            <div class="mobile-select-header">
                <span class="mobile-select-title">${title}</span>
                <button type="button" class="mobile-select-close" id="mobile-sheet-close-btn" aria-label="Cerrar">✕</button>
            </div>
            ${showSearch ? `
                <div class="mobile-select-search-wrap">
                    <input type="text" class="mobile-select-search" id="mobile-sheet-search-input" placeholder="🔍 Buscar opción..." autocomplete="off" />
                </div>
            ` : ''}
            <div class="mobile-select-list" id="mobile-sheet-list"></div>
        `;

        const listContainer = sheet.querySelector('#mobile-sheet-list');

        function renderItems(filterText = '') {
            listContainer.innerHTML = '';
            const lower = filterText.toLowerCase().trim();

            let matchedCount = 0;
            rawOptions.forEach(opt => {
                if (!opt.value && (opt.text.toLowerCase().includes('seleccione') || opt.text.trim() === '')) {
                    // Header/placeholder option: skip unless it is the only one
                    if (rawOptions.length > 1) return;
                }

                const optText = opt.text.trim();
                if (lower && !optText.toLowerCase().includes(lower) && !opt.value.toLowerCase().includes(lower)) {
                    return;
                }
                matchedCount++;

                const isSelected = opt.value === select.value || (opt.selected && !select.value);
                const item = document.createElement('div');
                item.className = `mobile-select-item ${isSelected ? 'selected' : ''}`;
                if (opt.disabled) item.style.opacity = '0.45';

                // Extract code badges e.g. "(B01)" or "01 - " or "B01"
                let codeBadge = '';
                let cleanText = optText;

                const parenMatch = optText.match(/\(([A-Z0-9]+)\)/i);
                const prefixMatch = optText.match(/^([A-Z0-9]{2,4})\s*-\s*/i);

                if (parenMatch) {
                    codeBadge = parenMatch[1];
                    cleanText = optText.replace(parenMatch[0], '').trim();
                } else if (prefixMatch) {
                    codeBadge = prefixMatch[1];
                    cleanText = optText.replace(prefixMatch[0], '').trim();
                } else if (opt.value && opt.value.length <= 4) {
                    codeBadge = opt.value;
                }

                item.innerHTML = `
                    <div class="mobile-select-item-content">
                        ${codeBadge ? `<span class="mobile-select-badge">${codeBadge}</span>` : ''}
                        <span class="mobile-select-item-text">${cleanText || optText}</span>
                    </div>
                    <div class="mobile-select-check">${isSelected ? '✓' : ''}</div>
                `;

                if (!opt.disabled) {
                    item.addEventListener('click', () => {
                        select.value = opt.value;
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                        select.dispatchEvent(new Event('input', { bubbles: true }));
                        closeActiveSheet();
                    });
                }

                listContainer.appendChild(item);
            });

            if (matchedCount === 0) {
                listContainer.innerHTML = `
                    <div style="padding: 24px; text-align: center; color: var(--clr-text-muted); font-size: 0.9rem;">
                        No se encontraron opciones coincidentes.
                    </div>
                `;
            }
        }

        renderItems();

        if (showSearch) {
            const searchInput = sheet.querySelector('#mobile-sheet-search-input');
            searchInput.addEventListener('input', (e) => {
                renderItems(e.target.value);
            });
            setTimeout(() => {
                // Keep virtual keyboard from jumping violently
                try { searchInput.focus(); } catch (_) {}
            }, 300);
        }

        backdrop.addEventListener('click', closeActiveSheet);
        const closeBtn = sheet.querySelector('#mobile-sheet-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', closeActiveSheet);

        document.body.appendChild(backdrop);
        document.body.appendChild(sheet);

        // Animate in
        requestAnimationFrame(() => {
            backdrop.classList.add('visible');
            sheet.classList.add('visible');
        });

        window._activeMobileSheet = { backdrop, sheet };
    }

    function closeActiveSheet() {
        if (!window._activeMobileSheet) return;
        const { backdrop, sheet } = window._activeMobileSheet;
        window._activeMobileSheet = null;

        backdrop.classList.remove('visible');
        sheet.classList.remove('visible');

        setTimeout(() => {
            if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
            if (sheet && sheet.parentNode) sheet.parentNode.removeChild(sheet);
        }, 280);
    }

    window.closeMobileSelectSheet = closeActiveSheet;
})();
