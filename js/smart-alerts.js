/* =========================================================================
   SMART-ALERTS.JS – Centro de Notificaciones Inteligentes
   Evalúa NCF agotados/próximos a vencer, facturas a crédito vencidas,
   cotizaciones por expirar y eventos de anulación/borrado por sucursal.
   ========================================================================= */

(function initSmartAlertsCenter() {
    const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };

    function _escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function _escapeJsSingle(str) {
        return String(str ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    }

    function _scopedKey(baseKey) {
        return typeof userKey === 'function' ? userKey(baseKey) : baseKey;
    }

    function _loadAlertState() {
        try {
            const parsed = JSON.parse(localStorage.getItem(_scopedKey('recim_smart_alerts_state')) || '{}');
            return {
                readIds: Array.isArray(parsed.readIds) ? parsed.readIds : [],
                dismissedIds: Array.isArray(parsed.dismissedIds) ? parsed.dismissedIds : [],
                pushedIds: Array.isArray(parsed.pushedIds) ? parsed.pushedIds : []
            };
        } catch (_) {
            return { readIds: [], dismissedIds: [], pushedIds: [] };
        }
    }

    function _saveAlertState(state) {
        try {
            const trimmed = {
                readIds: (state.readIds || []).slice(-300),
                dismissedIds: (state.dismissedIds || []).slice(-300),
                pushedIds: (state.pushedIds || []).slice(-300)
            };
            localStorage.setItem(_scopedKey('recim_smart_alerts_state'), JSON.stringify(trimmed));
        } catch (_) {}
    }

    function _normBranchId(bId) {
        if (typeof normalizeBranchId === 'function') return normalizeBranchId(bId);
        return String(bId || '').trim() || 'SUC-PRINCIPAL';
    }

    function _resolveBranchName(bId) {
        if (typeof resolveBranchNameById === 'function') return resolveBranchNameById(bId);
        return bId || 'Sucursal Principal';
    }

    function _canSwitchBranches() {
        return typeof canCurrentUserSwitchBranches === 'function' ? canCurrentUserSwitchBranches() : true;
    }

    function _activeBranchId() {
        return typeof getActiveBranchId === 'function' ? getActiveBranchId() : 'SUC-PRINCIPAL';
    }

    function _parseLocalYmd(dateStr) {
        const clean = String(dateStr || '').trim().slice(0, 10);
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);
        if (!match) return null;
        return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }

    function _todayUtcMs() {
        const now = new Date();
        return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    }

    function _daysUntilYmd(ymd) {
        const targetMs = _parseLocalYmd(ymd);
        if (targetMs === null) return null;
        return Math.round((targetMs - _todayUtcMs()) / 86400000);
    }

    function _addDaysYmd(ymd, days) {
        const baseMs = _parseLocalYmd(ymd);
        if (baseMs === null) return '';
        const dt = new Date(baseMs + (Number(days) || 0) * 86400000);
        return dt.toISOString().slice(0, 10);
    }

    function _formatAmount(val, currency = 'DOP') {
        if (typeof formatMoney === 'function') {
            try { return formatMoney(val, currency); } catch (_) {}
        }
        return `${currency === 'USD' ? 'US$' : 'RD$'} ${parseFloat(val || 0).toFixed(2)}`;
    }

    function _collectNcfAlerts() {
        const out = [];
        if (typeof getNcfSequences !== 'function') return out;
        const seqs = getNcfSequences() || {};

        Object.entries(seqs).forEach(([code, seq]) => {
            if (!seq || seq.active === false) return;
            const cur = parseInt(seq.current, 10) || 1;
            const to = parseInt(seq.to, 10) || 1;
            const remaining = to - cur + 1;
            const threshold = Math.max(parseInt(seq.alertThreshold, 10) || 10, 10);

            if (cur > to) {
                out.push({
                    id: `ncf_exhausted_${code}_${to}`,
                    category: 'ncf',
                    severity: 'critical',
                    title: `Secuencia ${code} agotada`,
                    message: `Se alcanzó el límite autorizado (#${to}). Configura una nueva secuencia en NCF.`,
                    branchName: 'General',
                    actionPage: 'facturas',
                    actionKey: 'open_ncf_modal',
                    timestamp: new Date().toISOString()
                });
            } else if (remaining <= threshold) {
                out.push({
                    id: `ncf_low_${code}_${remaining <= 5 ? 'crit' : 'warn'}_${to}`,
                    category: 'ncf',
                    severity: remaining <= 5 ? 'critical' : 'warning',
                    title: `Quedan pocos NCF (${code})`,
                    message: `Restan ${remaining} comprobante(s) ${code} antes del límite #${to}.`,
                    branchName: 'General',
                    actionPage: 'facturas',
                    actionKey: 'open_ncf_modal',
                    timestamp: new Date().toISOString()
                });
            }

            if (seq.dueDate) {
                const daysLeft = _daysUntilYmd(seq.dueDate);
                if (daysLeft !== null && daysLeft < 0) {
                    out.push({
                        id: `ncf_expired_${code}_${seq.dueDate}`,
                        category: 'ncf',
                        severity: 'critical',
                        title: `Secuencia ${code} vencida`,
                        message: `La vigencia DGII venció el ${seq.dueDate}. Actualiza la fecha límite.`,
                        branchName: 'General',
                        actionPage: 'facturas',
                        actionKey: 'open_ncf_modal',
                        timestamp: new Date().toISOString()
                    });
                } else if (daysLeft !== null && daysLeft <= 15) {
                    out.push({
                        id: `ncf_expiring_${code}_${seq.dueDate}`,
                        category: 'ncf',
                        severity: 'warning',
                        title: `Secuencia ${code} por vencer`,
                        message: `Vence ${daysLeft === 0 ? 'hoy' : `en ${daysLeft} día(s)`} (${seq.dueDate}).`,
                        branchName: 'General',
                        actionPage: 'facturas',
                        actionKey: 'open_ncf_modal',
                        timestamp: new Date().toISOString()
                    });
                }
            }
        });

        return out;
    }

    function _collectCreditInvoiceAlerts() {
        const out = [];
        if (typeof getAllInvoices !== 'function') return out;
        const canSwitch = _canSwitchBranches();
        const myBranch = _normBranchId(_activeBranchId());

        (getAllInvoices() || []).forEach(inv => {
            if (!inv || inv.type === 'basica') return;
            const invBranch = _normBranchId(inv.branchId);
            if (!canSwitch && invBranch !== myBranch) return;

            const payMethod = String(inv.payMethod || inv.paymentMethod || '');
            if (!/cr[eé]dito/i.test(payMethod)) return;
            if (inv.paid || inv.paidAt || /pagad|anulad|cancelad/i.test(String(inv.status || ''))) return;

            const refYmd = inv.date || String(inv.createdAt || '').slice(0, 10);
            const until = _daysUntilYmd(refYmd);
            if (until === null) return;
            const ageDays = -until;
            if (ageDays < 15) return;

            const isCrit = ageDays >= 30;
            const bName = inv.branchName || _resolveBranchName(invBranch);
            out.push({
                id: `credit_overdue_${inv.id}_${isCrit ? '30' : '15'}`,
                category: 'credit',
                severity: isCrit ? 'critical' : 'warning',
                title: `Factura a crédito (${ageDays} días)`,
                message: `${inv.id} • ${inv.company || inv.client || 'Cliente'} (${_formatAmount(inv.total, inv.currency)})`,
                branchId: invBranch,
                branchName: bName,
                actionPage: 'historial',
                timestamp: inv.createdAt || refYmd
            });
        });

        return out;
    }

    function _collectExpiringQuoteAlerts() {
        const out = [];
        if (typeof getAllQuotes !== 'function') return out;
        const canSwitch = _canSwitchBranches();
        const myBranch = _normBranchId(_activeBranchId());

        (getAllQuotes() || []).forEach(q => {
            if (!q) return;
            const qBranch = _normBranchId(q.branchId);
            if (!canSwitch && qBranch !== myBranch) return;

            const baseYmd = q.date || String(q.createdAt || '').slice(0, 10);
            const validity = parseInt(q.validityDays, 10) || 15;
            const expiryYmd = _addDaysYmd(baseYmd, validity);
            if (!expiryYmd) return;

            const daysLeft = _daysUntilYmd(expiryYmd);
            if (daysLeft === null || daysLeft < -7 || daysLeft > 3) return;

            const bName = q.branchName || _resolveBranchName(qBranch);
            const title = daysLeft < 0
                ? `Cotización ${q.id} vencida`
                : (daysLeft === 0 ? `Cotización ${q.id} vence hoy` : `Cotización ${q.id} vence en ${daysLeft} día(s)`);

            out.push({
                id: `quote_exp_${q.id}_${expiryYmd}_${daysLeft < 0 ? 'exp' : 'soon'}`,
                category: 'quote',
                severity: 'warning',
                title,
                message: `${q.client || 'Cliente'} • ${_formatAmount(q.total, q.currency)} (vigencia ${expiryYmd})`,
                branchId: qBranch,
                branchName: bName,
                actionPage: 'facturas',
                actionSubTab: 'cotizaciones',
                timestamp: q.createdAt || baseYmd
            });
        });

        return out;
    }

    function _collectSupervisoryEventAlerts() {
        const out = [];
        const canSwitch = _canSwitchBranches();
        const myBranch = _normBranchId(_activeBranchId());

        let events = [];
        try {
            const parsed = JSON.parse(localStorage.getItem(_scopedKey('recim_smart_alert_events')) || '[]');
            if (Array.isArray(parsed)) events = parsed;
        } catch (_) {}

        events.forEach(ev => {
            if (!ev || !ev.id) return;
            const evBranch = _normBranchId(ev.branchId);
            if (!canSwitch && evBranch !== myBranch) return;

            out.push({
                id: ev.id,
                category: ev.type || 'audit',
                severity: ev.severity || 'warning',
                title: ev.title || 'Evento de auditoría',
                message: `${ev.message || ''}${ev.actor ? ` — por ${ev.actor}` : ''}`,
                branchId: evBranch,
                branchName: ev.branchName || _resolveBranchName(evBranch),
                actionPage: 'historial',
                timestamp: ev.createdAt || ''
            });
        });

        return out;
    }

    function _collectPickupRouteAlerts() {
        const out = [];
        if (typeof getAllPickupRoutesRaw !== 'function') return out;
        const canSwitch = _canSwitchBranches();
        const myBranch = _normBranchId(_activeBranchId());
        const today = new Date().toISOString().slice(0, 10);

        (getAllPickupRoutesRaw() || []).forEach(route => {
            if (!route || route.status !== 'pending' || !route.scheduledDate) return;
            const rBranch = _normBranchId(route.branchId);
            if (!canSwitch && rBranch !== myBranch) return;

            const daysDiff = _daysUntilYmd(route.scheduledDate);
            if (daysDiff === null || daysDiff > 0) return;

            const bName = route.branchName || _resolveBranchName(rBranch);
            const isOverdue = daysDiff < 0;
            out.push({
                id: `route_${route.id}_${route.scheduledDate}_${isOverdue ? 'late' : 'today'}`,
                category: 'route',
                severity: isOverdue ? 'warning' : 'info',
                title: isOverdue
                    ? `Recogida atrasada (${route.clientName || 'Cliente'})`
                    : `Recogida programada para hoy (${route.clientName || 'Cliente'})`,
                message: `${route.scheduledDate}${route.scheduledTime ? ` • ${route.scheduledTime}` : ''}${route.address ? ` • ${route.address}` : ''}`,
                branchId: rBranch,
                branchName: bName,
                actionPage: 'rutas',
                timestamp: route.scheduledDate || today
            });
        });

        return out;
    }

    function getSmartAlerts() {
        const state = _loadAlertState();
        const dismissedSet = new Set(state.dismissedIds);
        const readSet = new Set(state.readIds);

        const raw = [
            ..._collectNcfAlerts(),
            ..._collectCreditInvoiceAlerts(),
            ..._collectExpiringQuoteAlerts(),
            ..._collectPickupRouteAlerts(),
            ..._collectSupervisoryEventAlerts()
        ];

        const seen = new Set();
        const result = [];
        raw.forEach(alert => {
            if (!alert || !alert.id || dismissedSet.has(alert.id) || seen.has(alert.id)) return;
            seen.add(alert.id);
            result.push({
                ...alert,
                read: readSet.has(alert.id)
            });
        });

        result.sort((a, b) => {
            const ra = SEVERITY_ORDER[a.severity] ?? 9;
            const rb = SEVERITY_ORDER[b.severity] ?? 9;
            if (ra !== rb) return ra - rb;
            return String(b.timestamp || '').localeCompare(String(a.timestamp || ''));
        });

        return result;
    }

    function recordSmartAlertEvent(payload = {}) {
        try {
            let actor = '';
            try {
                const sess = JSON.parse(localStorage.getItem('recim_session') || '{}');
                actor = (sess.name ? String(sess.name).split(' | ')[0].trim() : '') || sess.email || '';
            } catch (_) {}

            const branchId = _normBranchId(payload.branchId || _activeBranchId());
            const branchName = payload.branchName || _resolveBranchName(branchId);

            const entry = {
                id: `EVT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                type: payload.type || 'void_delete',
                severity: payload.severity || 'warning',
                title: payload.title || 'Anulación / eliminación',
                message: payload.message || '',
                branchId,
                branchName,
                refId: payload.refId || '',
                actor,
                createdAt: new Date().toISOString()
            };

            const key = _scopedKey('recim_smart_alert_events');
            const prev = JSON.parse(localStorage.getItem(key) || '[]');
            const list = Array.isArray(prev) ? prev : [];
            const next = [entry, ...list].slice(0, 50);
            localStorage.setItem(key, JSON.stringify(next));

            refreshSmartAlerts({ notifyNative: false });
            if (typeof window.forceSync === 'function') {
                try { window.forceSync(); } catch (_) {}
            }
            return entry;
        } catch (_) {
            return null;
        }
    }

    function _renderAlertsPanelContents() {
        const panel = document.getElementById('smart-alerts-panel');
        if (!panel || panel.classList.contains('hidden')) return;

        const alerts = getSmartAlerts();
        const body = panel.querySelector('.smart-alerts-list');
        if (!body) return;

        if (alerts.length === 0) {
            body.innerHTML = `
                <div class="smart-alerts-empty">
                    <div style="font-size:1.8rem; margin-bottom:6px;">✅</div>
                    <div style="font-weight:700; color:var(--clr-text);">Todo al día</div>
                    <div style="font-size:0.78rem; color:var(--clr-text-muted); margin-top:4px;">No hay alertas pendientes en este momento.</div>
                </div>
            `;
            return;
        }

        body.innerHTML = alerts.map(a => {
            const sevLabel = a.severity === 'critical' ? 'CRÍTICA' : (a.severity === 'warning' ? 'AVISO' : 'INFO');
            const safeId = _escapeJsSingle(a.id);
            const safePage = _escapeJsSingle(a.actionPage || '');
            const safeSub = _escapeJsSingle(a.actionSubTab || '');
            const safeKey = _escapeJsSingle(a.actionKey || '');

            return `
                <div class="smart-alert-item severity-${_escapeHtml(a.severity)} ${a.read ? 'is-read' : 'is-unread'}">
                    <div class="smart-alert-item-head">
                        <span class="smart-alert-sev sev-${_escapeHtml(a.severity)}">${sevLabel}</span>
                        <span class="smart-alert-branch">📍 ${_escapeHtml(a.branchName || 'General')}</span>
                        <button type="button" class="smart-alert-dismiss" onclick="dismissSmartAlert('${safeId}')" title="Descartar alerta">✕</button>
                    </div>
                    <div class="smart-alert-title">${_escapeHtml(a.title)}</div>
                    <div class="smart-alert-msg">${_escapeHtml(a.message)}</div>
                    ${a.actionPage ? `
                        <div class="smart-alert-actions">
                            <button type="button" class="smart-alert-go" onclick="window._triggerSmartAlertAction('${safeId}', '${safePage}', '${safeSub}', '${safeKey}')">Revisar →</button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    function _updateBellBadge(alerts) {
        const badge = document.getElementById('topbar-alerts-badge');
        const btn = document.getElementById('topbar-alerts-btn');
        if (!badge || !btn) return;

        const unread = alerts.filter(a => !a.read);
        const unreadCount = unread.length;
        const hasCritical = unread.some(a => a.severity === 'critical');

        if (unreadCount === 0) {
            badge.classList.add('hidden');
            badge.textContent = '0';
            btn.classList.remove('has-critical', 'has-unread');
        } else {
            badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
            badge.classList.remove('hidden');
            btn.classList.add('has-unread');
            btn.classList.toggle('has-critical', hasCritical);
        }
    }

    function refreshSmartAlerts(options = {}) {
        const { notifyNative = false } = options;
        const alerts = getSmartAlerts();
        _updateBellBadge(alerts);
        _renderAlertsPanelContents();

        if (notifyNative) {
            const state = _loadAlertState();
            const pushedSet = new Set(state.pushedIds);
            const toPush = alerts.filter(a =>
                !a.read &&
                !pushedSet.has(a.id) &&
                (a.severity === 'critical' || a.severity === 'warning' || (a.category === 'route' && a.severity === 'info'))
            );

            if (toPush.length > 0) {
                const hasCritical = toPush.some(a => a.severity === 'critical');
                const notifTitle = toPush.length === 1
                    ? toPush[0].title
                    : (hasCritical ? `${toPush.length} alertas críticas en Reciminsaap` : `${toPush.length} alertas en Reciminsaap`);
                const notifBody = toPush.length === 1
                    ? toPush[0].message
                    : toPush.slice(0, 2).map(a => a.title).join(' • ');
                const channel = (toPush.length === 1 && toPush[0].category === 'route')
                    ? 'reciminsa_routes'
                    : 'reciminsa_alerts';

                const hasAndroidChannel = typeof window !== 'undefined' && window.AndroidNative && typeof window.AndroidNative.ShowNotificationOnChannel === 'function';
                const hasAndroidLegacy = typeof window !== 'undefined' && window.AndroidNative && typeof window.AndroidNative.ShowNotification === 'function';
                const hasWebNotif = typeof window !== 'undefined' && 'Notification' in window && window.Notification && window.Notification.permission === 'granted';

                if (hasAndroidChannel || hasAndroidLegacy) {
                    try {
                        if (hasAndroidChannel) {
                            window.AndroidNative.ShowNotificationOnChannel(notifTitle, notifBody, channel);
                        } else {
                            window.AndroidNative.ShowNotification(notifTitle, notifBody);
                        }
                        toPush.forEach(a => pushedSet.add(a.id));
                        state.pushedIds = Array.from(pushedSet);
                        _saveAlertState(state);
                    } catch (e) {
                        console.warn('Error enviando notificación nativa:', e);
                    }
                } else if (hasWebNotif) {
                    try {
                        new window.Notification(notifTitle, { body: notifBody });
                        toPush.forEach(a => pushedSet.add(a.id));
                        state.pushedIds = Array.from(pushedSet);
                        _saveAlertState(state);
                    } catch (e) {
                        console.warn('Error enviando notificación web:', e);
                    }
                }
            }
        }

        return alerts;
    }

    function _ensurePanelElement() {
        let panel = document.getElementById('smart-alerts-panel');
        if (panel) return panel;

        const wrap = document.querySelector('.topbar-alerts-wrap');
        if (!wrap) return null;

        panel = document.createElement('div');
        panel.id = 'smart-alerts-panel';
        panel.className = 'smart-alerts-panel hidden';
        panel.innerHTML = `
            <div class="smart-alerts-header">
                <span class="smart-alerts-header-title">🔔 Centro de Alertas</span>
                <div style="display:flex; align-items:center; gap:8px;">
                    <button type="button" class="smart-alerts-mark-all" onclick="markAllSmartAlertsRead()">Marcar todo leído</button>
                    <button type="button" class="smart-alerts-close-btn" onclick="closeSmartAlertsPanel()" aria-label="Cerrar alertas">✕</button>
                </div>
            </div>
            <div class="smart-alerts-list"></div>
        `;
        wrap.appendChild(panel);
        return panel;
    }

    function toggleSmartAlertsPanel(forceOpen = null) {
        const panel = _ensurePanelElement();
        if (!panel) return;
        const willOpen = forceOpen !== null ? Boolean(forceOpen) : panel.classList.contains('hidden');
        panel.classList.toggle('hidden', !willOpen);

        const btn = document.getElementById('topbar-alerts-btn');
        if (btn) btn.setAttribute('aria-expanded', String(willOpen));

        if (willOpen) {
            refreshSmartAlerts({ notifyNative: false });
            _renderAlertsPanelContents();
        }
    }

    function closeSmartAlertsPanel() {
        const panel = document.getElementById('smart-alerts-panel');
        if (panel) panel.classList.add('hidden');
        const btn = document.getElementById('topbar-alerts-btn');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }

    function dismissSmartAlert(alertId) {
        if (!alertId) return;
        const state = _loadAlertState();
        if (!state.dismissedIds.includes(alertId)) state.dismissedIds.push(alertId);
        if (!state.readIds.includes(alertId)) state.readIds.push(alertId);
        _saveAlertState(state);
        refreshSmartAlerts({ notifyNative: false });
    }

    function markAllSmartAlertsRead() {
        const alerts = getSmartAlerts();
        const state = _loadAlertState();
        const readSet = new Set(state.readIds);
        alerts.forEach(a => readSet.add(a.id));
        state.readIds = Array.from(readSet);
        _saveAlertState(state);
        refreshSmartAlerts({ notifyNative: false });
    }

    window._triggerSmartAlertAction = function (alertId, page, subTab, actionKey) {
        const state = _loadAlertState();
        if (alertId && !state.readIds.includes(alertId)) {
            state.readIds.push(alertId);
            _saveAlertState(state);
        }
        closeSmartAlertsPanel();
        refreshSmartAlerts({ notifyNative: false });

        if (page && typeof navigate === 'function') {
            navigate(page, subTab || null);
        }
        if (actionKey === 'open_ncf_modal' && typeof openParametrizacionesModal === 'function') {
            setTimeout(() => openParametrizacionesModal('ncf'), 60);
        }
    };

    if (typeof document !== 'undefined') {
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('smart-alerts-panel');
            if (!panel || panel.classList.contains('hidden')) return;
            const wrap = document.querySelector('.topbar-alerts-wrap');
            if (wrap && !wrap.contains(e.target)) {
                closeSmartAlertsPanel();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const panel = document.getElementById('smart-alerts-panel');
                if (panel && !panel.classList.contains('hidden')) {
                    closeSmartAlertsPanel();
                }
            }
        });

        let _lastVisibilityRefreshMs = 0;
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;
            const now = Date.now();
            if (now - _lastVisibilityRefreshMs < 30000) return;
            _lastVisibilityRefreshMs = now;
            try { refreshSmartAlerts({ notifyNative: true }); } catch (_) {}
            if (typeof window.syncPickupRouteReminders === 'function') {
                try { window.syncPickupRouteReminders(); } catch (_) {}
            }
        });
    }

    if (typeof window !== 'undefined') {
        window.getSmartAlerts = getSmartAlerts;
        window.refreshSmartAlerts = refreshSmartAlerts;
        window.toggleSmartAlertsPanel = toggleSmartAlertsPanel;
        window.closeSmartAlertsPanel = closeSmartAlertsPanel;
        window.dismissSmartAlert = dismissSmartAlert;
        window.markAllSmartAlertsRead = markAllSmartAlertsRead;
        window.recordSmartAlertEvent = recordSmartAlertEvent;
    }
})();
