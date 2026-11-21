/* =========================================================================
   SYNC-STATUS.JS – Indicador en Vivo de Sincronización & Cola Offline Real
   Muestra estado Sincronizado / Sin red / X pendientes / Sincronizando,
   encola cambios locales sin red y reintenta al recuperar conectividad.
   ========================================================================= */

(function initSyncStatusModule() {
    const QUEUE_MAX = 100;
    const IGNORED_SUFFIXES = ['recim_offline_sync_queue', 'recim_smart_alerts_state', 'recim_logo_storage_mode'];

    const _state = {
        status: 'synced',
        lastSyncAt: '',
        lastError: '',
        pendingKeys: []
    };

    function _queueKey() {
        return typeof userKey === 'function' ? userKey('recim_offline_sync_queue') : 'recim_offline_sync_queue';
    }

    function _isOnline() {
        return typeof navigator === 'undefined' || navigator.onLine !== false;
    }

    function _loadQueue() {
        try {
            const parsed = JSON.parse(localStorage.getItem(_queueKey()) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }

    function _saveQueue(queue) {
        try {
            localStorage.setItem(_queueKey(), JSON.stringify((queue || []).slice(-QUEUE_MAX)));
        } catch (_) {}
    }

    function _escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function _computeDisplayStatus() {
        const pendingCount = _state.pendingKeys.length;
        if (_state.status === 'syncing') {
            return { key: 'syncing', dot: '#3b82f6', label: 'Sincronizando...' };
        }
        if (!_isOnline()) {
            return {
                key: 'offline',
                dot: '#f59e0b',
                label: pendingCount > 0 ? `Sin red (${pendingCount})` : 'Sin red'
            };
        }
        if (pendingCount > 0) {
            return { key: 'pending', dot: '#f59e0b', label: `${pendingCount} pendiente${pendingCount === 1 ? '' : 's'}` };
        }
        if (_state.status === 'error') {
            return { key: 'error', dot: '#ef4444', label: 'Error sync' };
        }
        return { key: 'synced', dot: '#10b981', label: 'Sincronizado' };
    }

    function _updatePillUi() {
        const pill = document.getElementById('topbar-sync-pill');
        if (!pill) return;

        const disp = _computeDisplayStatus();
        pill.dataset.syncStatus = disp.key;
        const dotEl = pill.querySelector('.topbar-sync-dot');
        const labelEl = pill.querySelector('.topbar-sync-label');
        if (dotEl) dotEl.style.background = disp.dot;
        if (labelEl) labelEl.textContent = disp.label;
    }

    function _renderPopover() {
        const pop = document.getElementById('sync-status-popover');
        if (!pop || pop.classList.contains('hidden')) return;

        const disp = _computeDisplayStatus();
        const health = (typeof window !== 'undefined' && window.StorageEngine && typeof window.StorageEngine.getStorageHealth === 'function')
            ? window.StorageEngine.getStorageHealth()
            : null;
        const lastSyncFmt = _state.lastSyncAt
            ? new Date(_state.lastSyncAt).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })
            : 'Pendiente';

        const pendingItemsHtml = _state.pendingKeys.length > 0
            ? `<div style="margin-top:8px; padding:8px; border-radius:8px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.28); font-size:0.75rem; color:#fde68a;">
                ⏳ <b>${_state.pendingKeys.length}</b> cambio(s) en cola offline esperando envío.
               </div>`
            : `<div style="margin-top:8px; padding:8px; border-radius:8px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.22); font-size:0.75rem; color:#a7f3d0;">
                ✅ Todos los cambios locales están respaldados.
               </div>`;

        const healthHtml = health
            ? `<div style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.08); font-size:0.74rem; color:#94a3b8; display:flex; flex-direction:column; gap:3px;">
                <div>💾 Caché local: <b style="color:#e2e8f0;">${health.localKb} KB</b> / ${health.limitKb} KB (${health.localPctOf5Mb}%)</div>
                <div>🗄️ IndexedDB espejo: <b style="color:#e2e8f0;">${health.indexedDBAvailable ? `Activo (${health.mirroredCount} colecciones)` : 'No disponible'}</b></div>
                <div>🖼️ Logo nube: <b style="color:#e2e8f0;">${health.logoMode === 'storage' ? 'Supabase Storage' : 'Inline/Local'}</b></div>
               </div>`
            : '';

        pop.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <strong style="font-size:0.86rem; color:#ecfdf5;">Estado de Nube & Cola Offline</strong>
                <button type="button" onclick="window.SyncStatus.closePopover()" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:0.9rem;">✕</button>
            </div>
            <div style="font-size:0.78rem; color:#cbd5e1;">
                Estado: <b style="color:${disp.dot};">${_escapeHtml(disp.label)}</b> &bull; Última sync: <b>${_escapeHtml(lastSyncFmt)}</b>
            </div>
            ${_state.lastError ? `<div style="margin-top:6px; font-size:0.74rem; color:#fca5a5;">⚠️ ${_escapeHtml(_state.lastError)}</div>` : ''}
            ${pendingItemsHtml}
            ${healthHtml}
            <button type="button" class="btn-primary" onclick="window.SyncStatus.retryNow()" style="width:100%; justify-content:center; margin-top:12px; padding:8px 12px; font-size:0.8rem;">
                🔄 Sincronizar ahora
            </button>
        `;
    }

    function _ensurePopover() {
        let pop = document.getElementById('sync-status-popover');
        if (pop) return pop;
        const wrap = document.querySelector('.topbar-sync-wrap');
        if (!wrap) return null;
        pop = document.createElement('div');
        pop.id = 'sync-status-popover';
        pop.className = 'sync-status-popover hidden';
        wrap.appendChild(pop);
        return pop;
    }

    function _refreshAllUi() {
        _updatePillUi();
        _renderPopover();
    }

    function onLocalChange(key) {
        if (!key || IGNORED_SUFFIXES.some(ig => String(key).includes(ig))) return;
        if (!_isOnline() || _state.status === 'error' || _state.status === 'offline') {
            const exists = _state.pendingKeys.some(p => p.key === key);
            if (!exists) {
                _state.pendingKeys.push({ key, at: new Date().toISOString() });
                if (_state.pendingKeys.length > QUEUE_MAX) {
                    _state.pendingKeys = _state.pendingKeys.slice(-QUEUE_MAX);
                }
                _saveQueue(_state.pendingKeys);
            }
            if (!_isOnline()) _state.status = 'offline';
            else _state.status = 'pending';
            _refreshAllUi();
        }
    }

    function onSyncStart() {
        _state.status = 'syncing';
        _state.lastError = '';
        _refreshAllUi();
    }

    function onSyncSuccess() {
        _state.pendingKeys = [];
        _saveQueue([]);
        _state.status = 'synced';
        _state.lastError = '';
        _state.lastSyncAt = new Date().toISOString();
        _refreshAllUi();
    }

    function onSyncError(err, keyHint = '') {
        if (keyHint && !_state.pendingKeys.some(p => p.key === keyHint)) {
            _state.pendingKeys.push({ key: keyHint, at: new Date().toISOString() });
            _saveQueue(_state.pendingKeys);
        }
        const msg = err && err.message ? String(err.message) : (err ? String(err) : 'Sin conexión con servidor');
        _state.lastError = msg.slice(0, 140);
        _state.status = _isOnline() ? 'error' : 'offline';
        _refreshAllUi();
    }

    async function retryNow() {
        onSyncStart();
        if (typeof window.forceSync === 'function') {
            try {
                const ok = await window.forceSync();
                if (!ok && _state.status === 'syncing') {
                    onSyncError('No se pudo completar la sincronización');
                }
                return ok;
            } catch (e) {
                onSyncError(e);
                return false;
            }
        }
        onSyncError('Sincronización no disponible aún');
        return false;
    }

    function togglePopover(forceOpen = null) {
        const pop = _ensurePopover();
        if (!pop) return;
        const willOpen = forceOpen !== null ? Boolean(forceOpen) : pop.classList.contains('hidden');
        pop.classList.toggle('hidden', !willOpen);
        if (willOpen) _renderPopover();
    }

    function closePopover() {
        const pop = document.getElementById('sync-status-popover');
        if (pop) pop.classList.add('hidden');
    }

    function init() {
        _state.pendingKeys = _loadQueue();
        if (!_isOnline()) _state.status = 'offline';
        else if (_state.pendingKeys.length > 0) _state.status = 'pending';
        else _state.status = 'synced';
        _refreshAllUi();
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('online', () => {
            if (_state.pendingKeys.length > 0) {
                if (typeof showToast === 'function') {
                    showToast('🌐 Conexión recuperada. Sincronizando cambios pendientes...', 'info');
                }
                retryNow();
            } else {
                _state.status = 'synced';
                _refreshAllUi();
            }
        });

        window.addEventListener('offline', () => {
            _state.status = 'offline';
            _refreshAllUi();
        });
    }

    if (typeof document !== 'undefined') {
        document.addEventListener('click', (e) => {
            const pop = document.getElementById('sync-status-popover');
            if (!pop || pop.classList.contains('hidden')) return;
            const wrap = document.querySelector('.topbar-sync-wrap');
            if (wrap && !wrap.contains(e.target)) closePopover();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closePopover();
        });
    }

    if (typeof window !== 'undefined') {
        window.SyncStatus = {
            init,
            onLocalChange,
            onSyncStart,
            onSyncSuccess,
            onSyncError,
            getState: () => ({ ..._state, pendingKeys: _state.pendingKeys.slice() }),
            getPendingCount: () => _state.pendingKeys.length,
            retryNow,
            togglePopover,
            closePopover
        };
    }
})();
