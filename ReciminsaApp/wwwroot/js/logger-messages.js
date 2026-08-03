/* ==========================================================================
   LOGGER-MESSAGES.JS - Sistema Propio de Logs, Mensajes Nativos y Desktop UX
   ========================================================================== */

(function () {
    'use strict';

    // ==========================================
    // 1. APPLOGGER (Sistema de Logs Interno)
    // ==========================================
    const LOG_STORAGE_KEY = 'recim_app_logs_v1';
    const MAX_LOGS = 500;

    class AppLoggerService {
        constructor() {
            this.logs = this.loadLogs();
            this.listeners = [];
            this.setupConsoleInterceptor();
        }

        loadLogs() {
            try {
                const stored = localStorage.getItem(LOG_STORAGE_KEY);
                return stored ? JSON.parse(stored) : [];
            } catch (e) {
                return [];
            }
        }

        saveLogs() {
            try {
                if (this.logs.length > MAX_LOGS) {
                    this.logs = this.logs.slice(this.logs.length - MAX_LOGS);
                }
                localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(this.logs));
            } catch (e) { /* ignore storage errors */ }
        }

        log(level, category, message, data = null) {
            const entry = {
                id: Date.now() + Math.random().toString(36).substr(2, 4),
                timestamp: new Date().toISOString(),
                timeString: new Date().toLocaleTimeString(),
                level: level.toUpperCase(), // INFO, WARN, ERROR, SUCCESS, DEBUG
                category: (category || 'SYS').toUpperCase(),
                message: typeof message === 'object' ? JSON.stringify(message) : String(message),
                data: data ? (typeof data === 'object' ? JSON.stringify(data) : String(data)) : null
            };

            this.logs.push(entry);
            this.saveLogs();
            this.notifyListeners(entry);

            if (window._originalConsoleLog && level === 'INFO') {
                window._originalConsoleLog(`[${entry.category}] ${entry.message}`);
            }
            return entry;
        }

        info(cat, msg, data) { return this.log('INFO', cat, msg, data); }
        warn(cat, msg, data) { return this.log('WARN', cat, msg, data); }
        error(cat, msg, data) { return this.log('ERROR', cat, msg, data); }
        success(cat, msg, data) { return this.log('SUCCESS', cat, msg, data); }
        debug(cat, msg, data) { return this.log('DEBUG', cat, msg, data); }

        getLogs() {
            return [...this.logs];
        }

        clear() {
            this.logs = [];
            localStorage.removeItem(LOG_STORAGE_KEY);
            this.notifyListeners(null);
            this.info('SYS', 'Logs del sistema limpiados por el usuario.');
        }

        exportJSON() {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.logs, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `reciminsa_logs_${new Date().toISOString().slice(0, 10)}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        }

        exportTXT() {
            const lines = this.logs.map(l => `[${l.timestamp}] [${l.level}] [${l.category}] ${l.message} ${l.data ? '-> ' + l.data : ''}`);
            const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(lines.join('\n'));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `reciminsa_logs_${new Date().toISOString().slice(0, 10)}.log`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        }

        addListener(fn) {
            if (typeof fn === 'function') this.listeners.push(fn);
        }

        removeListener(fn) {
            this.listeners = this.listeners.filter(l => l !== fn);
        }

        notifyListeners(entry) {
            this.listeners.forEach(fn => {
                try { fn(entry, this.logs); } catch (_) {}
            });
        }

        setupConsoleInterceptor() {
            const self = this;
            const origErr = console.error;
            const origWarn = console.warn;

            console.error = function (...args) {
                try {
                    self.error('CONSOLE', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
                } catch (_) {}
                if (origErr) origErr.apply(console, args);
            };

            console.warn = function (...args) {
                try {
                    self.warn('CONSOLE', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
                } catch (_) {}
                if (origWarn) origWarn.apply(console, args);
            };

            window.addEventListener('error', (e) => {
                self.error('UNCAUGHT', `${e.message} en ${e.filename}:${e.lineno}:${e.colno}`);
            });

            window.addEventListener('unhandledrejection', (e) => {
                self.error('PROMISE', `Promesa no manejada: ${e.reason}`);
            });
        }
    }

    window.AppLogger = new AppLoggerService();
    window.AppLogger.info('SYS', 'Sistema de Logs e Interfaz Nativa de Reciminsa inicializados.');

    // ==========================================
    // 2. APPDIALOG (Sistema de Mensajes Nativos)
    // ==========================================
    class AppDialogService {
        constructor() {
            this.initDOM();
            this.patchWindowDialogs();
        }

        initDOM() {
            if (document.getElementById('native-dialog-overlay')) return;

            const overlay = document.createElement('div');
            overlay.id = 'native-dialog-overlay';
            overlay.className = 'native-dialog-overlay hidden';
            overlay.innerHTML = `
                <div class="native-dialog-card" id="native-dialog-card">
                    <div class="native-dialog-header">
                        <div class="native-dialog-icon-wrapper" id="native-dialog-icon-bg">
                            <span class="native-dialog-icon" id="native-dialog-icon">🔔</span>
                        </div>
                        <div class="native-dialog-titles">
                            <h3 class="native-dialog-title" id="native-dialog-title">Mensaje del Sistema</h3>
                            <p class="native-dialog-subtitle" id="native-dialog-subtitle">Reciminsaap Desktop System</p>
                        </div>
                    </div>
                    <div class="native-dialog-body" id="native-dialog-body"></div>
                    <div class="native-dialog-input-wrap hidden" id="native-dialog-input-wrap">
                        <input type="text" id="native-dialog-input" class="native-dialog-input" placeholder="Escribe aquí..." />
                    </div>
                    <div class="native-dialog-actions" id="native-dialog-actions">
                        <button class="native-btn native-btn-secondary" id="native-dialog-cancel-btn">Cancelar</button>
                        <button class="native-btn native-btn-primary" id="native-dialog-confirm-btn">Aceptar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
        }

        show({ title = 'Mensaje del Sistema', message = '', type = 'info', confirmText = 'Aceptar', cancelText = 'Cancelar', showCancel = false, isPrompt = false, defaultValue = '' }) {
            return new Promise((resolve) => {
                this.initDOM();

                const overlay = document.getElementById('native-dialog-overlay');
                const card = document.getElementById('native-dialog-card');
                const iconBg = document.getElementById('native-dialog-icon-bg');
                const icon = document.getElementById('native-dialog-icon');
                const titleEl = document.getElementById('native-dialog-title');
                const bodyEl = document.getElementById('native-dialog-body');
                const inputWrap = document.getElementById('native-dialog-input-wrap');
                const input = document.getElementById('native-dialog-input');
                const confirmBtn = document.getElementById('native-dialog-confirm-btn');
                const cancelBtn = document.getElementById('native-dialog-cancel-btn');

                titleEl.textContent = title;
                bodyEl.innerHTML = message.replace(/\n/g, '<br>');

                iconBg.className = 'native-dialog-icon-wrapper ' + type;
                if (type === 'danger' || type === 'error') {
                    icon.textContent = '🚨';
                    confirmBtn.className = 'native-btn native-btn-danger';
                } else if (type === 'warning') {
                    icon.textContent = '⚠️';
                    confirmBtn.className = 'native-btn native-btn-warning';
                } else if (type === 'success') {
                    icon.textContent = '✅';
                    confirmBtn.className = 'native-btn native-btn-success';
                } else {
                    icon.textContent = 'ℹ️';
                    confirmBtn.className = 'native-btn native-btn-primary';
                }

                confirmBtn.textContent = confirmText;
                cancelBtn.textContent = cancelText;

                if (showCancel || isPrompt) {
                    cancelBtn.style.display = 'inline-flex';
                } else {
                    cancelBtn.style.display = 'none';
                }

                if (isPrompt) {
                    inputWrap.classList.remove('hidden');
                    input.value = defaultValue;
                    setTimeout(() => input.focus(), 100);
                } else {
                    inputWrap.classList.add('hidden');
                }

                overlay.classList.remove('hidden');
                setTimeout(() => card.classList.add('active'), 10);

                const cleanup = () => {
                    card.classList.remove('active');
                    setTimeout(() => {
                        overlay.classList.add('hidden');
                        confirmBtn.onclick = null;
                        cancelBtn.onclick = null;
                        document.removeEventListener('keydown', keyHandler);
                    }, 200);
                };

                const handleConfirm = () => {
                    cleanup();
                    if (isPrompt) {
                        resolve(input.value);
                    } else {
                        resolve(true);
                    }
                };

                const handleCancel = () => {
                    cleanup();
                    if (isPrompt) {
                        resolve(null);
                    } else {
                        resolve(false);
                    }
                };

                confirmBtn.onclick = handleConfirm;
                cancelBtn.onclick = handleCancel;

                const keyHandler = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleConfirm();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        handleCancel();
                    }
                };
                document.addEventListener('keydown', keyHandler);
            });
        }

        alert(message, title = 'Notificación Reciminsa') {
            window.AppLogger.info('MSG', `Alert presentado: ${message}`);
            return this.show({ title, message, type: 'info', confirmText: 'Aceptar', showCancel: false });
        }

        confirm(message, title = 'Confirmar Acción') {
            window.AppLogger.info('MSG', `Confirmación solicitada: ${message}`);
            const isDanger = message.includes('ELIMINAR') || message.includes('IRREVERSIBLE') || message.includes('borrar') || message.includes('Baja') || message.includes('Revocar');
            return this.show({
                title,
                message,
                type: isDanger ? 'danger' : 'warning',
                confirmText: isDanger ? 'Sí, continuar' : 'Aceptar',
                cancelText: 'Cancelar',
                showCancel: true
            });
        }

        prompt(message, defaultValue = '', title = 'Ingresar Dato') {
            window.AppLogger.info('MSG', `Prompt presentado: ${message}`);
            return this.show({ title, message, type: 'info', confirmText: 'Aceptar', cancelText: 'Cancelar', isPrompt: true, defaultValue });
        }

        patchWindowDialogs() {
            const self = this;

            window.alert = function (msg, title) {
                return self.alert(String(msg), title);
            };

            window.confirm = function (msg, title) {
                return self.confirm(String(msg), title);
            };

            window.nativeConfirm = function (msg, title) {
                return self.confirm(msg, title);
            };

            window.nativeAlert = function (msg, title) {
                return self.alert(msg, title);
            };
        }
    }

    window.AppDialog = new AppDialogService();

    // ==========================================
    // 3. APPLOGVIEWER (Consola del Sistema)
    // ==========================================
    class AppLogViewerService {
        constructor() {
            this.activeFilter = 'ALL';
            this.searchQuery = '';
            this.isOpen = false;
        }

        initDOM() {
            if (document.getElementById('native-logviewer-modal')) return;

            const modal = document.createElement('div');
            modal.id = 'native-logviewer-modal';
            modal.className = 'native-logviewer-overlay hidden';
            modal.innerHTML = `
                <div class="native-logviewer-card">
                    <div class="native-logviewer-header">
                        <div class="native-logviewer-title-group">
                            <span class="native-logviewer-icon">📜</span>
                            <div>
                                <h3>Console Logs del Sistema</h3>
                                <p>Registro de eventos en tiempo real & auditoría de Reciminsaap</p>
                            </div>
                        </div>
                        <div class="native-logviewer-header-actions">
                            <button class="log-action-btn" id="logviewer-btn-export-txt" title="Exportar en formato .log">📥 TXT</button>
                            <button class="log-action-btn" id="logviewer-btn-export-json" title="Exportar en formato .json">📦 JSON</button>
                            <button class="log-action-btn log-action-btn-danger" id="logviewer-btn-clear" title="Limpiar todos los logs">🗑️ Limpiar</button>
                            <button class="native-logviewer-close" id="logviewer-btn-close">✕</button>
                        </div>
                    </div>

                    <div class="native-logviewer-toolbar">
                        <div class="log-search-box">
                            <span class="search-icon">🔍</span>
                            <input type="text" id="logviewer-search" placeholder="Buscar en los registros del sistema..." />
                        </div>
                        <div class="log-filter-pills">
                            <button class="log-pill active" data-filter="ALL">Todos <span class="badge" id="log-count-all">0</span></button>
                            <button class="log-pill log-pill-info" data-filter="INFO">Info <span class="badge" id="log-count-info">0</span></button>
                            <button class="log-pill log-pill-success" data-filter="SUCCESS">Éxito <span class="badge" id="log-count-success">0</span></button>
                            <button class="log-pill log-pill-warn" data-filter="WARN">Warn <span class="badge" id="log-count-warn">0</span></button>
                            <button class="log-pill log-pill-error" data-filter="ERROR">Error <span class="badge" id="log-count-error">0</span></button>
                        </div>
                    </div>

                    <div class="native-logviewer-body" id="logviewer-list">
                    </div>

                    <div class="native-logviewer-footer">
                        <span id="logviewer-status">● Sistema activo - Capturando eventos</span>
                        <span class="shortcut-tip">Presiona <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd> o <kbd>Esc</kbd> para alternar</span>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('logviewer-btn-close').onclick = () => this.hide();
            document.getElementById('logviewer-btn-clear').onclick = () => {
                window.AppLogger.clear();
                this.render();
            };
            document.getElementById('logviewer-btn-export-txt').onclick = () => window.AppLogger.exportTXT();
            document.getElementById('logviewer-btn-export-json').onclick = () => window.AppLogger.exportJSON();

            const searchInput = document.getElementById('logviewer-search');
            searchInput.oninput = (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.render();
            };

            const filterPills = modal.querySelectorAll('.log-pill');
            filterPills.forEach(pill => {
                pill.onclick = () => {
                    filterPills.forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                    this.activeFilter = pill.getAttribute('data-filter');
                    this.render();
                };
            });

            window.AppLogger.addListener(() => {
                if (this.isOpen) this.render();
            });
        }

        show() {
            this.initDOM();
            const modal = document.getElementById('native-logviewer-modal');
            modal.classList.remove('hidden');
            this.isOpen = true;
            this.render();
            window.AppLogger.info('UI', 'Visor de Logs desplegado por el usuario.');
        }

        hide() {
            const modal = document.getElementById('native-logviewer-modal');
            if (modal) modal.classList.add('hidden');
            this.isOpen = false;
        }

        toggle() {
            if (this.isOpen) this.hide();
            else this.show();
        }

        render() {
            const listEl = document.getElementById('logviewer-list');
            if (!listEl) return;

            const allLogs = window.AppLogger.getLogs();

            const counts = { ALL: allLogs.length, INFO: 0, SUCCESS: 0, WARN: 0, ERROR: 0 };
            allLogs.forEach(l => {
                if (counts[l.level] !== undefined) counts[l.level]++;
            });

            document.getElementById('log-count-all').textContent = counts.ALL;
            document.getElementById('log-count-info').textContent = counts.INFO;
            document.getElementById('log-count-success').textContent = counts.SUCCESS;
            document.getElementById('log-count-warn').textContent = counts.WARN;
            document.getElementById('log-count-error').textContent = counts.ERROR;

            const filtered = allLogs.filter(log => {
                const matchesFilter = this.activeFilter === 'ALL' || log.level === this.activeFilter;
                const matchesSearch = !this.searchQuery ||
                    log.message.toLowerCase().includes(this.searchQuery) ||
                    log.category.toLowerCase().includes(this.searchQuery) ||
                    (log.data && log.data.toLowerCase().includes(this.searchQuery));
                return matchesFilter && matchesSearch;
            }).reverse();

            if (filtered.length === 0) {
                listEl.innerHTML = `
                    <div class="log-empty-state">
                        <span style="font-size: 2rem;">🔍</span>
                        <p>No se encontraron registros de logs que coincidan.</p>
                    </div>
                `;
                return;
            }

            listEl.innerHTML = filtered.map(log => {
                let badgeClass = 'level-info';
                if (log.level === 'SUCCESS') badgeClass = 'level-success';
                else if (log.level === 'WARN') badgeClass = 'level-warn';
                else if (log.level === 'ERROR') badgeClass = 'level-error';

                return `
                    <div class="log-entry-row ${badgeClass}">
                        <div class="log-row-meta">
                            <span class="log-time">${log.timeString}</span>
                            <span class="log-badge ${badgeClass}">${log.level}</span>
                            <span class="log-tag">[${log.category}]</span>
                        </div>
                        <div class="log-row-message">${this.escapeHtml(log.message)}</div>
                        ${log.data ? `<pre class="log-row-data">${this.escapeHtml(log.data)}</pre>` : ''}
                    </div>
                `;
            }).join('');
        }

        escapeHtml(str) {
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }
    }

    window.AppLogViewer = new AppLogViewerService();

    // ==========================================
    // 4. DESKTOP NATIVE UX & CONTEXT MENU
    // ==========================================
    function setupNativeDesktopBehaviors() {
        window.addEventListener('dragover', (e) => e.preventDefault(), false);
        window.addEventListener('drop', (e) => e.preventDefault(), false);

        let contextMenuEl = null;

        function createContextMenu() {
            if (contextMenuEl) return;
            contextMenuEl = document.createElement('div');
            contextMenuEl.id = 'native-app-contextmenu';
            contextMenuEl.className = 'native-context-menu hidden';
            contextMenuEl.innerHTML = `
                <div class="menu-item" id="ctx-item-logs">
                    <span>📜 Logs del Sistema</span>
                    <span class="menu-shortcut">Ctrl+Shift+L</span>
                </div>
                <div class="menu-divider"></div>
                <div class="menu-item" id="ctx-item-refresh">
                    <span>🔄 Recargar Aplicación</span>
                </div>
                <div class="menu-item" id="ctx-item-clearcache">
                    <span>🧹 Limpiar Caché Local</span>
                </div>
            `;
            document.body.appendChild(contextMenuEl);

            document.getElementById('ctx-item-logs').onclick = () => {
                hideContextMenu();
                window.AppLogViewer.show();
            };
            document.getElementById('ctx-item-refresh').onclick = () => {
                hideContextMenu();
                if (typeof handleAppRefresh === 'function') handleAppRefresh();
                else window.location.reload();
            };
            document.getElementById('ctx-item-clearcache').onclick = () => {
                hideContextMenu();
                window.AppDialog.confirm('¿Deseas limpiar la caché y reiniciar la aplicación?', 'Limpiar Caché').then(res => {
                    if (res) {
                        localStorage.clear();
                        window.location.reload();
                    }
                });
            };
        }

        function hideContextMenu() {
            if (contextMenuEl) contextMenuEl.classList.add('hidden');
        }

        document.addEventListener('contextmenu', (e) => {
            const target = e.target;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }
            e.preventDefault();
            createContextMenu();

            const x = Math.min(e.clientX, window.innerWidth - 230);
            const y = Math.min(e.clientY, window.innerHeight - 160);

            contextMenuEl.style.left = `${x}px`;
            contextMenuEl.style.top = `${y}px`;
            contextMenuEl.classList.remove('hidden');
        });

        document.addEventListener('click', () => hideContextMenu());

        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
                e.preventDefault();
                window.AppLogViewer.toggle();
            }
            if (e.key === 'Escape' && window.AppLogViewer && window.AppLogViewer.isOpen) {
                window.AppLogViewer.hide();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupNativeDesktopBehaviors);
    } else {
        setupNativeDesktopBehaviors();
    }

})();
