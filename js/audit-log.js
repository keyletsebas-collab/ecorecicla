/* =========================================================================
   AUDIT-LOG.JS – Registro Inmutable de Auditoría Antifraude (Fase 3)
   Registra eliminaciones, anulaciones, cambios de precios, catálogos,
   empresa y rutas por usuario, dispositivo y sucursal.
   ========================================================================= */

(function initAuditLogModule() {
    const MAX_AUDIT_ENTRIES = 500;

    function _audEscapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function _audKey() {
        return typeof userKey === 'function' ? userKey('recim_audit_logs') : 'recim_audit_logs';
    }

    function _audNormBranch(branchId) {
        if (typeof normalizeBranchId === 'function') return normalizeBranchId(branchId);
        return String(branchId || '').trim() || 'SUC-PRINCIPAL';
    }

    function _audResolveBranchName(branchId) {
        if (typeof resolveBranchNameById === 'function') return resolveBranchNameById(branchId);
        return branchId || 'Sucursal Principal';
    }

    function _audCanSwitch() {
        return typeof canCurrentUserSwitchBranches === 'function' ? canCurrentUserSwitchBranches() : true;
    }

    function _loadRawLogs() {
        try {
            const parsed = JSON.parse(localStorage.getItem(_audKey()) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }

    function recordAuditLog({ actionType, entityType, entityId, summary, branchId, branchName, details } = {}) {
        try {
            let actorName = 'Usuario';
            let actorEmail = '';
            let dbId = '';
            try {
                const s = JSON.parse(localStorage.getItem('recim_session') || '{}');
                actorName = (s.name ? String(s.name).split(' | ')[0].trim() : '') || s.email || 'Usuario';
                actorEmail = s.email || '';
                dbId = s.familyId ? `family_${s.familyId}` : (s.accountId || '');
            } catch (_) {}

            let deviceId = 'WEB-LOCAL';
            let deviceLabel = 'Web';
            if (typeof detectCurrentDeviceProfile === 'function') {
                try {
                    const prof = detectCurrentDeviceProfile();
                    deviceId = prof.deviceId || deviceId;
                    deviceLabel = prof.deviceDetail || prof.deviceLabel || deviceLabel;
                } catch (_) {}
            }

            const resolvedBranchId = _audNormBranch(branchId || (typeof getActiveBranchId === 'function' ? getActiveBranchId() : 'SUC-PRINCIPAL'));
            const resolvedBranchName = branchName || _audResolveBranchName(resolvedBranchId);

            const entry = {
                id: `AUD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
                actionType: String(actionType || 'update'),
                entityType: String(entityType || 'system'),
                entityId: String(entityId || ''),
                summary: String(summary || actionType || 'Acción registrada'),
                branchId: resolvedBranchId,
                branchName: resolvedBranchName,
                actorName,
                actorEmail,
                deviceId,
                deviceLabel,
                details: details && typeof details === 'object' ? details : {},
                createdAt: new Date().toISOString()
            };

            const next = [entry, ..._loadRawLogs()].slice(0, MAX_AUDIT_ENTRIES);
            const serialized = JSON.stringify(next);
            const storageKey = _audKey();
            localStorage.setItem(storageKey, serialized);

            if (typeof window !== 'undefined' && window.StorageEngine && typeof window.StorageEngine.mirrorKey === 'function') {
                window.StorageEngine.mirrorKey(storageKey, serialized);
            }

            // Respaldo no bloqueante a tabla public.audit_logs si ya se ejecutó el SQL
            const sbActive = (typeof isSupabaseActive !== 'undefined' && isSupabaseActive) || Boolean(typeof window !== 'undefined' && window.isSupabaseActive);
            const sbClient = (typeof supabaseClient !== 'undefined' && supabaseClient) || (typeof window !== 'undefined' ? window.supabaseClient : null);
            if (sbActive && sbClient && typeof sbClient.from === 'function' && dbId) {
                Promise.resolve(
                    sbClient.from('audit_logs').upsert({
                        id: entry.id,
                        db_id: dbId,
                        branch_id: entry.branchId,
                        branch_name: entry.branchName,
                        action_type: entry.actionType,
                        entity_type: entry.entityType,
                        entity_id: entry.entityId,
                        actor_name: entry.actorName,
                        actor_email: entry.actorEmail,
                        device_id: entry.deviceId,
                        details: { ...entry.details, summary: entry.summary, deviceLabel: entry.deviceLabel },
                        created_at: entry.createdAt
                    })
                ).catch(() => {});
            }

            return entry;
        } catch (err) {
            console.warn('Error registrando auditoría:', err);
            return null;
        }
    }

    function _matchesCategory(entry, category) {
        if (!category || category === 'all') return true;
        const a = String(entry.actionType || '').toLowerCase();
        const e = String(entry.entityType || '').toLowerCase();
        if (category === 'deletes') return a.includes('delete') || a.includes('clear') || a.includes('reset');
        if (category === 'billing') return e.includes('invoice') || e.includes('quote') || e.includes('ncf') || e.includes('credit_note') || e.includes('debit_note') || e.includes('history');
        if (category === 'catalog') return e.includes('client') || e.includes('material');
        if (category === 'prices') return e.includes('price');
        if (category === 'company') return e.includes('company');
        if (category === 'routes') return e.includes('route');
        return true;
    }

    function getAuditLogs({ branchFilter = 'all', actionFilter = 'all', query = '' } = {}) {
        const canSwitch = _audCanSwitch();
        const myBranch = _audNormBranch(typeof getActiveBranchId === 'function' ? getActiveBranchId() : 'SUC-PRINCIPAL');
        const q = String(query || '').trim().toLowerCase();

        return _loadRawLogs().filter(item => {
            if (!item) return false;
            const itemBranch = _audNormBranch(item.branchId);
            if (!canSwitch && itemBranch !== myBranch) return false;
            if (branchFilter && branchFilter !== 'all' && itemBranch !== _audNormBranch(branchFilter)) return false;
            if (!_matchesCategory(item, actionFilter)) return false;
            if (q) {
                const hay = [
                    item.summary,
                    item.actionType,
                    item.entityType,
                    item.entityId,
                    item.actorName,
                    item.actorEmail,
                    item.deviceLabel,
                    item.branchName
                ].join(' ').toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }

    function _csvCell(val) {
        const s = String(val ?? '').replace(/"/g, '""');
        return `"${s}"`;
    }

    function exportAuditLogsToCsv(logs = null) {
        const rows = Array.isArray(logs) ? logs : getAuditLogs();
        if (!rows || rows.length === 0) {
            if (typeof showToast === 'function') showToast('⚠️ No hay registros de auditoría para exportar', 'warning');
            return '';
        }

        const header = ['ID', 'Fecha', 'Sucursal', 'Acción', 'Entidad', 'Ref', 'Resumen', 'Usuario', 'Correo', 'Dispositivo'];
        const csvLines = [header.map(_csvCell).join(',')];
        rows.forEach(r => {
            csvLines.push([
                r.id,
                r.createdAt,
                r.branchName || r.branchId,
                r.actionType,
                r.entityType,
                r.entityId,
                r.summary,
                r.actorName,
                r.actorEmail,
                r.deviceLabel || r.deviceId
            ].map(_csvCell).join(','));
        });

        const csvString = `\uFEFF${csvLines.join('\n')}`;
        const filename = `Auditoria_Reciminsa_${new Date().toISOString().slice(0, 10)}.csv`;

        try {
            const b64 = typeof Buffer !== 'undefined'
                ? Buffer.from(csvString, 'utf8').toString('base64')
                : btoa(unescape(encodeURIComponent(csvString)));

            if (window.AndroidNative && typeof window.AndroidNative.DownloadFile === 'function') {
                window.AndroidNative.DownloadFile(filename, b64);
                if (typeof showToast === 'function') showToast('📊 CSV de auditoría guardado en Descargas', 'success');
                return csvString;
            }
            if (window.NativeBridge && typeof window.NativeBridge.post === 'function') {
                if (window.NativeBridge.post({ action: 'download', filename, data: b64 })) {
                    if (typeof showToast === 'function') showToast('📊 CSV de auditoría descargado', 'success');
                    return csvString;
                }
            }
            if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' && typeof document !== 'undefined') {
                const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 400);
                if (typeof showToast === 'function') showToast('📊 Auditoría exportada en CSV', 'success');
            }
        } catch (err) {
            console.warn('Error exportando CSV de auditoría:', err);
        }
        return csvString;
    }

    function _renderAuditRowsHtml(logs) {
        if (!logs || logs.length === 0) {
            return `
                <div class="empty-state" style="padding:28px 16px;">
                    <div class="empty-state-icon">🛡️</div>
                    <p class="empty-state-text">Sin eventos registrados con los filtros actuales.</p>
                </div>
            `;
        }

        return logs.slice(0, 150).map(item => {
            const isDelete = _matchesCategory(item, 'deletes');
            const badgeColor = isDelete ? 'badge--red' : 'badge--green';
            const timeFmt = item.createdAt
                ? new Date(item.createdAt).toLocaleString('es-DO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                : '—';

            return `
                <div style="padding:10px 12px; border-radius:10px; background:var(--clr-surface-2); border:1px solid var(--clr-border); border-left:4px solid ${isDelete ? '#ef4444' : '#10b981'}; display:flex; flex-direction:column; gap:4px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
                        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                            <span class="badge ${badgeColor}" style="font-size:0.7rem;">${_audEscapeHtml(item.actionType)}</span>
                            <span class="badge" style="font-size:0.7rem;">📍 ${_audEscapeHtml(item.branchName || item.branchId)}</span>
                            <strong style="font-size:0.86rem;">${_audEscapeHtml(item.summary)}</strong>
                        </div>
                        <span style="font-size:0.74rem; color:var(--clr-text-muted);">${_audEscapeHtml(timeFmt)}</span>
                    </div>
                    <div style="font-size:0.76rem; color:var(--clr-text-secondary); display:flex; flex-wrap:wrap; gap:12px;">
                        <span>👤 ${_audEscapeHtml(item.actorName)}${item.actorEmail ? ` (${_audEscapeHtml(item.actorEmail)})` : ''}</span>
                        <span>📱 ${_audEscapeHtml(item.deviceLabel || item.deviceId)}</span>
                        ${item.entityId ? `<span style="font-family:monospace;">Ref: ${_audEscapeHtml(item.entityId)}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderCompanyTabAuditoria(host) {
        if (!host) return;
        const allLogs = _loadRawLogs();
        const deletesCount = allLogs.filter(i => _matchesCategory(i, 'deletes')).length;
        const editsCount = allLogs.length - deletesCount;
        const uniqueDevices = new Set(allLogs.map(i => i.deviceId).filter(Boolean)).size;
        const branches = typeof getCompanyBranches === 'function' ? getCompanyBranches() : [];

        host.innerHTML = `
            <div class="stats-grid" style="margin-bottom:18px;">
                <div class="stat-card">
                    <div class="stat-label">Eventos Registrados</div>
                    <div class="stat-value stat-value--green">${allLogs.length}</div>
                    <div class="stat-sub">Últimos 500 movimientos</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Eliminaciones / Limpiezas</div>
                    <div class="stat-value" style="color:#f87171;">${deletesCount}</div>
                    <div class="stat-sub">Acciones destructivas</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Ediciones / Emisiones</div>
                    <div class="stat-value stat-value--blue">${editsCount}</div>
                    <div class="stat-sub">Cambios de catálogo o precio</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Dispositivos Activos</div>
                    <div class="stat-value">${uniqueDevices}</div>
                    <div class="stat-sub">Equipos distintos</div>
                </div>
            </div>

            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
                    <div>
                        <h3 class="card-title">🛡️ Auditoría de Acciones Sensibles</h3>
                        <p class="card-subtitle">Trazabilidad por usuario, dispositivo y sucursal (antifraude).</p>
                    </div>
                    <button type="button" class="btn-secondary" onclick="exportAuditLogsToCsv(getAuditLogsFromFilters())">📊 Exportar CSV</button>
                </div>

                <div class="form-row" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin-bottom:14px;">
                    <select id="audit-branch-filter" class="form-select" onchange="refreshAuditTabList()">
                        <option value="all">📍 Todas las sucursales</option>
                        ${branches.map(b => `<option value="${_audEscapeHtml(b.id)}">📍 ${_audEscapeHtml(b.name || b.id)}</option>`).join('')}
                    </select>
                    <select id="audit-action-filter" class="form-select" onchange="refreshAuditTabList()">
                        <option value="all">Todas las categorías</option>
                        <option value="deletes">🗑️ Eliminaciones y Resets</option>
                        <option value="billing">🧾 Facturación y NCF</option>
                        <option value="catalog">👥 Clientes y Materiales</option>
                        <option value="prices">💲 Precios de Mercado</option>
                        <option value="company">🏢 Empresa</option>
                        <option value="routes">🗺️ Agenda y Rutas</option>
                    </select>
                    <input id="audit-search-input" type="text" class="form-input" placeholder="🔍 Buscar usuario, ref o acción..." oninput="refreshAuditTabList()" />
                </div>

                <div id="audit-log-timeline" style="display:flex; flex-direction:column; gap:8px;">
                    ${_renderAuditRowsHtml(getAuditLogs())}
                </div>
            </div>
        `;
    }

    function getAuditLogsFromFilters() {
        return getAuditLogs({
            branchFilter: document.getElementById('audit-branch-filter')?.value || 'all',
            actionFilter: document.getElementById('audit-action-filter')?.value || 'all',
            query: document.getElementById('audit-search-input')?.value || ''
        });
    }

    function refreshAuditTabList() {
        const el = document.getElementById('audit-log-timeline');
        if (!el) return;
        el.innerHTML = _renderAuditRowsHtml(getAuditLogsFromFilters());
    }

    if (typeof window !== 'undefined') {
        window.recordAuditLog = recordAuditLog;
        window.getAuditLogs = getAuditLogs;
        window.getAuditLogsFromFilters = getAuditLogsFromFilters;
        window.exportAuditLogsToCsv = exportAuditLogsToCsv;
        window.renderCompanyTabAuditoria = renderCompanyTabAuditoria;
        window.refreshAuditTabList = refreshAuditTabList;
    }
})();
