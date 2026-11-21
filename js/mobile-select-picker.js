/* =============================================
   MOBILE-SELECT-PICKER.JS
   Ultra-luxurious native-feeling Bottom Sheet picker
   for <select> elements on mobile viewports.
   ============================================= */

(function initMobileSelectEnhancer() {
    /** Escapa caracteres especiales HTML para interpolación segura en plantillas. */
    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function isMobileDevice() {
        return window.innerWidth <= 768 ||
            document.documentElement.classList.contains('is-mobile-device') ||
            /android|iphone|ipad|ipod/i.test(navigator.userAgent || '');
    }

    function isEnhancedSelect(el) {
        return Boolean(
            el &&
            el.tagName === 'SELECT' &&
            isMobileDevice() &&
            el.dataset.native !== 'true' &&
            !el.disabled &&
            !el.multiple
        );
    }

    function getSelectElement(target) {
        if (!target || typeof target.closest !== 'function') return null;
        return target.closest('select');
    }

    // Cancelar el diálogo nativo en mousedown (desktop/WebView2/Chromium) sin bloquear scroll en pointerdown ni abrir el sheet antes del click final.
    document.addEventListener('mousedown', (e) => {
        const select = getSelectElement(e.target);
        if (!isEnhancedSelect(select)) return;

        e.preventDefault();
        e.stopPropagation();
        if (document.activeElement === select && typeof select.blur === 'function') {
            select.blur();
        }
    }, true);

    // Abrir el Bottom Sheet únicamente en click para evitar que pointerdown inserte el backdrop debajo del dedo y cause auto-cierre al soltar.
    document.addEventListener('click', (e) => {
        const select = getSelectElement(e.target);
        if (!isEnhancedSelect(select)) return;

        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') {
            e.stopImmediatePropagation();
        }

        openMobileSelectSheet(select);
    }, true);

    // Soporte de teclado: Escape cierra el sheet activo y las teclas de activación abren el selector en móvil/hybrid.
    document.addEventListener('keydown', (e) => {
        if (window._activeMobileSheet && e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            closeActiveSheet({ reason: 'escape' });
            return;
        }

        const select = getSelectElement(e.target);
        if (isEnhancedSelect(select) && [' ', 'Enter', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();
            openMobileSelectSheet(select);
        }
    }, true);

    function resolveSelectTitle(select) {
        let title = '';

        if (select.id) {
            const escapedId = (typeof CSS !== 'undefined' && typeof CSS.escape === 'function')
                ? CSS.escape(select.id)
                : select.id.replace(/["\\]/g, '\\$&');
            const lbl = document.querySelector(`label[for="${escapedId}"]`);
            if (lbl) title = lbl.textContent.replace(/[#*]/g, '').trim();
        }

        if (!title) {
            const groupLabel = select.closest('.form-group')?.querySelector('.form-label');
            if (groupLabel) title = groupLabel.textContent.replace(/[#*]/g, '').trim();
        }

        if (!title && select.title) title = String(select.title).trim();
        if (!title && select.name) title = String(select.name).trim();
        return title || 'Seleccionar opción';
    }

    function openMobileSelectSheet(select) {
        if (
            window._activeMobileSheet &&
            window._activeMobileSheet.select === select &&
            (Date.now() - window._activeMobileSheet.openedAt) < 200
        ) {
            return;
        }

        const rawOptions = Array.from(select.options || []);
        if (rawOptions.length === 0) return;

        closeActiveSheet({ immediate: true, reason: 'reopen' });

        // Quitar foco de campos previos una vez completado el toque de apertura para ocultar el teclado virtual sin mover el sheet luego.
        const activeEl = document.activeElement;
        if (activeEl && activeEl !== document.body && /^(INPUT|TEXTAREA|SELECT)$/i.test(activeEl.tagName)) {
            try { activeEl.blur(); } catch (_) {}
        }

        const title = resolveSelectTitle(select);

        const backdrop = document.createElement('div');
        backdrop.className = 'mobile-select-backdrop';

        const sheet = document.createElement('div');
        sheet.className = 'mobile-select-sheet';

        const visibleCount = rawOptions.filter(opt => !opt.hidden).length;
        const showSearch = visibleCount > 5;

        sheet.innerHTML = `
            <div class="mobile-select-handle"></div>
            <div class="mobile-select-header">
                <span class="mobile-select-title">${escapeHtml(title)}</span>
                <button type="button" class="mobile-select-close" aria-label="Cerrar">✕</button>
            </div>
            ${showSearch ? `
                <div class="mobile-select-search-wrap">
                    <input type="text" class="mobile-select-search" placeholder="🔍 Buscar opción..." autocomplete="off" />
                </div>
            ` : ''}
            <div class="mobile-select-list"></div>
        `;

        const listContainer = sheet.querySelector('.mobile-select-list');
        let selectionCommitted = false;

        function renderItems(filterText = '') {
            listContainer.innerHTML = '';
            const lower = filterText.toLowerCase().trim();

            let matchedCount = 0;
            rawOptions.forEach(opt => {
                if (opt.hidden) return;
                if (!opt.value && (opt.text.toLowerCase().includes('seleccione') || opt.text.trim() === '')) {
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
                        ${codeBadge ? `<span class="mobile-select-badge">${escapeHtml(codeBadge)}</span>` : ''}
                        <span class="mobile-select-item-text">${escapeHtml(cleanText || optText)}</span>
                    </div>
                    <div class="mobile-select-check">${isSelected ? '✓' : ''}</div>
                `;

                if (!opt.disabled) {
                    item.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        if (selectionCommitted) return;
                        selectionCommitted = true;

                        const chosenValue = opt.value;
                        closeActiveSheet({ reason: 'select' });

                        select.value = chosenValue;
                        if (select.isConnected) {
                            select.dispatchEvent(new Event('input', { bubbles: true }));
                            select.dispatchEvent(new Event('change', { bubbles: true }));
                        }
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
            const searchInput = sheet.querySelector('.mobile-select-search');
            if (searchInput) {
                searchInput.addEventListener('input', (ev) => {
                    renderItems(ev.target.value);
                });
            }
        }

        // Evitar que eventos dentro del panel se propaguen al backdrop o a overlays padres.
        sheet.addEventListener('pointerdown', (ev) => ev.stopPropagation());
        sheet.addEventListener('click', (ev) => ev.stopPropagation());

        // Cierre por backdrop solo tras un toque deliberado iniciado sobre el backdrop después de la apertura.
        const openedAt = Date.now();
        let backdropPressStarted = false;

        backdrop.addEventListener('pointerdown', (ev) => {
            backdropPressStarted = (ev.target === backdrop && (Date.now() - openedAt) >= 200);
        });
        backdrop.addEventListener('pointercancel', () => {
            backdropPressStarted = false;
        });
        backdrop.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            if (ev.target === backdrop && (Date.now() - openedAt) >= 350 && backdropPressStarted) {
                backdropPressStarted = false;
                closeActiveSheet({ reason: 'backdrop' });
            }
        });

        const closeBtn = sheet.querySelector('.mobile-select-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                closeActiveSheet({ reason: 'close_btn' });
            });
        }

        const sheetState = { backdrop, sheet, select, openedAt, removeTimer: null };
        window._activeMobileSheet = sheetState;

        document.body.appendChild(backdrop);
        document.body.appendChild(sheet);

        requestAnimationFrame(() => {
            if (window._activeMobileSheet !== sheetState) return;
            backdrop.classList.add('visible');
            sheet.classList.add('visible');

            const selectedItem = listContainer.querySelector('.mobile-select-item.selected');
            if (selectedItem && typeof selectedItem.scrollIntoView === 'function') {
                try { selectedItem.scrollIntoView({ block: 'nearest' }); } catch (_) {}
            }
        });
    }

    function closeActiveSheet(options = {}) {
        const state = window._activeMobileSheet;
        if (!state) return;
        window._activeMobileSheet = null;

        if (state.removeTimer) {
            clearTimeout(state.removeTimer);
            state.removeTimer = null;
        }

        const { backdrop, sheet } = state;
        backdrop.style.pointerEvents = 'none';
        sheet.style.pointerEvents = 'none';
        backdrop.classList.remove('visible');
        sheet.classList.remove('visible');

        const removeNodes = () => {
            if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
            if (sheet && sheet.parentNode) sheet.parentNode.removeChild(sheet);
        };

        if (options.immediate) {
            removeNodes();
        } else {
            state.removeTimer = setTimeout(removeNodes, 280);
        }

        if (options.reason !== 'reopen') {
            const closeReason = options.reason || 'dismiss';
            setTimeout(() => {
                if (typeof window.flushDeferredSyncRerender === 'function') {
                    window.flushDeferredSyncRerender({ reason: closeReason });
                }
            }, 60);
        }
    }

    window.closeMobileSelectSheet = closeActiveSheet;
})();
