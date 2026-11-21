/* =========================================================================
   ROUTES-AGENDA.JS – Agenda y Rutas de Recogida por Sucursal
   Soporta programación única/recurrente, apertura directa en Maps/Waze,
   aviso rápido por WhatsApp al cliente y conversión directa a Bitácora.
   ========================================================================= */

(function initRoutesAgendaModule() {
    function _rtEscapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function _rtEscapeJsSingle(str) {
        return String(str ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    }

    function _rtStorageKey() {
        return typeof userKey === 'function' ? userKey('recim_pickup_routes') : 'recim_pickup_routes';
    }

    function _rtNormBranchId(branchId) {
        if (typeof normalizeBranchId === 'function') return normalizeBranchId(branchId);
        const clean = branchId == null ? '' : String(branchId).trim();
        return clean || 'SUC-PRINCIPAL';
    }

    function _rtResolveBranchName(branchId) {
        const id = _rtNormBranchId(branchId);
        if (typeof resolveBranchNameById === 'function') return resolveBranchNameById(id);
        return id === 'SUC-PRINCIPAL' ? 'Sucursal Principal' : id;
    }

    function _rtTargetBranchId(branchIdOverride = null) {
        const canSwitch = typeof canCurrentUserSwitchBranches === 'function' ? canCurrentUserSwitchBranches() : true;
        if (!canSwitch && typeof getUserAssignedBranch === 'function') {
            return _rtNormBranchId(getUserAssignedBranch().id);
        }
        if (branchIdOverride) return _rtNormBranchId(branchIdOverride);
        if (typeof getActiveBranchId === 'function') return _rtNormBranchId(getActiveBranchId());
        return 'SUC-PRINCIPAL';
    }

    function _rtTodayYmd() {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    function getAllPickupRoutesRaw() {
        try {
            const parsed = JSON.parse(localStorage.getItem(_rtStorageKey()) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }

    function getPickupRoutes(branchIdOverride = null) {
        const targetBranch = _rtTargetBranchId(branchIdOverride);
        return getAllPickupRoutesRaw().filter(r => r && _rtNormBranchId(r.branchId) === targetBranch);
    }

    function savePickupRoutes(list) {
        localStorage.setItem(_rtStorageKey(), JSON.stringify(Array.isArray(list) ? list : []));
        if (typeof window.refreshSmartAlerts === 'function') {
            try { window.refreshSmartAlerts({ notifyNative: false }); } catch (_) {}
        }
        try { syncPickupRouteReminders(); } catch (_) {}
        if (typeof window.forceSync === 'function') {
            try { window.forceSync(); } catch (_) {}
        }
    }

    function _rtNotifStateKey() {
        return typeof userKey === 'function' ? userKey('recim_scheduled_route_notifs') : 'recim_scheduled_route_notifs';
    }

    function _routeNotifId(routeId, slot) {
        const key = `${String(routeId || '')}:${slot}`;
        let h = 2166136261;
        for (let i = 0; i < key.length; i++) {
            h ^= key.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return 200000 + ((h >>> 0) % 899800000);
    }

    function _parseRouteLocalEpochMs(ymd, hhmm) {
        const dMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim().slice(0, 10));
        if (!dMatch) return null;
        const tMatch = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '09:00').trim());
        const hh = tMatch ? Math.min(23, Math.max(0, Number(tMatch[1]))) : 9;
        const mm = tMatch ? Math.min(59, Math.max(0, Number(tMatch[2]))) : 0;
        const dt = new Date(Number(dMatch[1]), Number(dMatch[2]) - 1, Number(dMatch[3]), hh, mm, 0, 0);
        const ms = dt.getTime();
        return Number.isFinite(ms) ? ms : null;
    }

    function syncPickupRouteReminders() {
        if (typeof window === 'undefined' || !window.AndroidNative || typeof window.AndroidNative.ScheduleNotification !== 'function') {
            return { supported: false, scheduled: 0, cancelled: 0, active: 0 };
        }

        const nowMs = Date.now();
        const minTriggerMs = nowMs + 15000;
        const maxRouteMs = nowMs + 30 * 86400000;

        const canSwitch = typeof canCurrentUserSwitchBranches === 'function' ? canCurrentUserSwitchBranches() : true;
        const targetBranch = _rtTargetBranchId(null);

        const visiblePending = getAllPickupRoutesRaw().filter(r => {
            if (!r || r.status !== 'pending' || !r.scheduledDate) return false;
            if (!canSwitch && _rtNormBranchId(r.branchId) !== targetBranch) return false;
            return true;
        });

        const desiredList = [];
        visiblePending.forEach(r => {
            const routeMs = _parseRouteLocalEpochMs(r.scheduledDate, r.scheduledTime);
            if (routeMs === null || routeMs <= minTriggerMs || routeMs > maxRouteMs) return;

            const timeTxt = String(r.scheduledTime || '09:00').slice(0, 5);
            const commonParts = [timeTxt, r.address, r.driverName ? `Chofer: ${r.driverName}` : ''].filter(Boolean);

            const preMs = routeMs - 30 * 60000;
            if (preMs > minTriggerMs) {
                desiredList.push({
                    id: _routeNotifId(r.id, 0),
                    triggerMs: preMs,
                    title: `🚛 Recogida en 30 min: ${r.clientName || 'Cliente'}`,
                    body: commonParts.join(' • ')
                });
            }

            if (routeMs > minTriggerMs) {
                const exactParts = [timeTxt, r.address, 'Recuerda registrar la Bitácora'].filter(Boolean);
                desiredList.push({
                    id: _routeNotifId(r.id, 1),
                    triggerMs: routeMs,
                    title: `📍 Recogida programada: ${r.clientName || 'Cliente'}`,
                    body: exactParts.join(' • ')
                });
            }
        });

        desiredList.sort((a, b) => a.triggerMs - b.triggerMs);
        const capped = desiredList.slice(0, 40);

        const desiredMap = {};
        capped.forEach(rem => {
            desiredMap[String(rem.id)] = {
                id: rem.id,
                triggerMs: rem.triggerMs,
                title: rem.title,
                body: rem.body,
                sig: `${rem.title}|${rem.body}`
            };
        });

        let prevMap = {};
        try {
            const rawPrev = JSON.parse(localStorage.getItem(_rtNotifStateKey()) || '{}');
            if (rawPrev && typeof rawPrev === 'object' && !Array.isArray(rawPrev)) prevMap = rawPrev;
        } catch (_) {}

        let cancelled = 0;
        let scheduled = 0;

        Object.keys(prevMap).forEach(idStr => {
            if (!Object.prototype.hasOwnProperty.call(desiredMap, idStr)) {
                if (typeof window.AndroidNative.CancelScheduledNotification === 'function') {
                    try {
                        window.AndroidNative.CancelScheduledNotification(Number(idStr));
                        cancelled++;
                    } catch (_) {}
                }
            }
        });

        const nextMap = {};
        Object.keys(desiredMap).forEach(idStr => {
            const rem = desiredMap[idStr];
            const prev = prevMap[idStr];
            if (!prev || prev.triggerMs !== rem.triggerMs || prev.sig !== rem.sig) {
                try {
                    window.AndroidNative.ScheduleNotification(rem.id, rem.title, rem.body, String(rem.triggerMs), 'reciminsa_routes');
                    scheduled++;
                } catch (_) {}
            }
            nextMap[idStr] = { triggerMs: rem.triggerMs, sig: rem.sig };
        });

        try {
            localStorage.setItem(_rtNotifStateKey(), JSON.stringify(nextMap));
        } catch (_) {}

        return { supported: true, scheduled, cancelled, active: Object.keys(nextMap).length };
    }

    function computeNextRecurrenceDate(ymd, recurrence) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim().slice(0, 10));
        if (!match) return '';
        let y = Number(match[1]);
        let m = Number(match[2]) - 1;
        let d = Number(match[3]);

        if (recurrence === 'weekly') {
            const dt = new Date(Date.UTC(y, m, d + 7));
            return dt.toISOString().slice(0, 10);
        }
        if (recurrence === 'biweekly') {
            const dt = new Date(Date.UTC(y, m, d + 14));
            return dt.toISOString().slice(0, 10);
        }
        if (recurrence === 'monthly') {
            const nextMonthTotal = m + 1;
            const ny = y + Math.floor(nextMonthTotal / 12);
            const nm = nextMonthTotal % 12;
            const lastDayOfTargetMonth = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
            const nd = Math.min(d, lastDayOfTargetMonth);
            return new Date(Date.UTC(ny, nm, nd)).toISOString().slice(0, 10);
        }
        return '';
    }

    function _rtAudit(actionType, stop, summary) {
        if (typeof window.recordAuditLog === 'function') {
            try {
                window.recordAuditLog({
                    actionType,
                    entityType: 'pickup_route',
                    entityId: stop.id,
                    summary,
                    branchId: stop.branchId,
                    branchName: stop.branchName,
                    details: {
                        clientName: stop.clientName,
                        scheduledDate: stop.scheduledDate,
                        recurrence: stop.recurrence,
                        linkedBitacoraId: stop.linkedBitacoraId || ''
                    }
                });
            } catch (_) {}
        }
    }

    function addPickupRoute(stopInput = {}) {
        const branchId = _rtTargetBranchId(stopInput.branchId || null);
        const branchName = stopInput.branchName || _rtResolveBranchName(branchId);
        const entry = {
            id: stopInput.id || `RUTA-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            branchId,
            branchName,
            clientId: stopInput.clientId || '',
            clientName: String(stopInput.clientName || '').trim() || 'Cliente sin nombre',
            address: String(stopInput.address || '').trim(),
            phone: String(stopInput.phone || '').trim(),
            scheduledDate: String(stopInput.scheduledDate || _rtTodayYmd()).slice(0, 10),
            scheduledTime: String(stopInput.scheduledTime || '09:00').slice(0, 5),
            recurrence: ['once', 'weekly', 'biweekly', 'monthly'].includes(stopInput.recurrence) ? stopInput.recurrence : 'once',
            driverName: String(stopInput.driverName || '').trim(),
            estimatedMaterials: String(stopInput.estimatedMaterials || '').trim(),
            notes: String(stopInput.notes || '').trim(),
            status: stopInput.status || 'pending',
            completedAt: stopInput.completedAt || '',
            linkedBitacoraId: stopInput.linkedBitacoraId || '',
            parentStopId: stopInput.parentStopId || '',
            createdAt: stopInput.createdAt || new Date().toISOString()
        };

        const all = getAllPickupRoutesRaw();
        all.unshift(entry);
        savePickupRoutes(all);
        _rtAudit('route_create', entry, `Recogida programada: ${entry.clientName} (${entry.scheduledDate})`);
        try {
            if (typeof window !== 'undefined' &&
                window.AndroidNative &&
                typeof window.AndroidNative.AreNotificationsEnabled === 'function' &&
                !window.AndroidNative.AreNotificationsEnabled() &&
                typeof window.AndroidNative.RequestNotificationPermission === 'function') {
                window.AndroidNative.RequestNotificationPermission();
            }
        } catch (_) {}
        return entry;
    }

    function updatePickupRoute(id, patch = {}) {
        const all = getAllPickupRoutesRaw();
        const idx = all.findIndex(r => r && r.id === id);
        if (idx === -1) return null;

        const targetBranch = _rtTargetBranchId(null);
        const canSwitch = typeof canCurrentUserSwitchBranches === 'function' ? canCurrentUserSwitchBranches() : true;
        if (!canSwitch && _rtNormBranchId(all[idx].branchId) !== targetBranch) {
            if (typeof showToast === 'function') showToast('🔒 No puedes editar rutas de otra sucursal.', 'error');
            return null;
        }

        all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
        savePickupRoutes(all);
        return all[idx];
    }

    function completePickupRoute(id, linkedBitacoraId = '') {
        const all = getAllPickupRoutesRaw();
        const idx = all.findIndex(r => r && r.id === id);
        if (idx === -1) return null;

        const stop = all[idx];
        const canSwitch = typeof canCurrentUserSwitchBranches === 'function' ? canCurrentUserSwitchBranches() : true;
        if (!canSwitch && _rtNormBranchId(stop.branchId) !== _rtTargetBranchId(null)) {
            if (typeof showToast === 'function') showToast('🔒 No puedes completar rutas de otra sucursal.', 'error');
            return null;
        }

        const updated = {
            ...stop,
            status: 'completed',
            completedAt: new Date().toISOString(),
            linkedBitacoraId: linkedBitacoraId || stop.linkedBitacoraId || '',
            updatedAt: new Date().toISOString()
        };
        all[idx] = updated;

        let nextStop = null;
        if (stop.recurrence && stop.recurrence !== 'once') {
            const nextYmd = computeNextRecurrenceDate(stop.scheduledDate, stop.recurrence);
            const alreadySpawned = all.some(r =>
                r && r.status === 'pending' && (
                    r.parentStopId === stop.id ||
                    (
                        _rtNormBranchId(r.branchId) === _rtNormBranchId(stop.branchId) &&
                        String(r.clientName || '').trim().toLowerCase() === String(stop.clientName || '').trim().toLowerCase() &&
                        r.scheduledDate === nextYmd
                    )
                )
            );
            if (nextYmd && !alreadySpawned) {
                nextStop = {
                    ...stop,
                    id: `RUTA-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    scheduledDate: nextYmd,
                    status: 'pending',
                    completedAt: '',
                    linkedBitacoraId: '',
                    parentStopId: stop.id,
                    createdAt: new Date().toISOString()
                };
                all.unshift(nextStop);
            }
        }

        savePickupRoutes(all);
        _rtAudit('route_complete', updated, `Recogida completada: ${updated.clientName}${updated.linkedBitacoraId ? ` (Bitácora ${updated.linkedBitacoraId})` : ''}`);
        return { completed: updated, nextRecurring: nextStop };
    }

    function deletePickupRoute(id) {
        const all = getAllPickupRoutesRaw();
        const target = all.find(r => r && r.id === id);
        if (!target) return false;

        const canSwitch = typeof canCurrentUserSwitchBranches === 'function' ? canCurrentUserSwitchBranches() : true;
        if (!canSwitch && _rtNormBranchId(target.branchId) !== _rtTargetBranchId(null)) {
            if (typeof showToast === 'function') showToast('🔒 No puedes eliminar rutas de otra sucursal.', 'error');
            return false;
        }

        savePickupRoutes(all.filter(r => r && r.id !== id));
        _rtAudit('route_delete', target, `Recogida eliminada: ${target.clientName} (${target.scheduledDate})`);
        return true;
    }

    function _openExternalUrlSafe(url) {
        if (window.AndroidNative && typeof window.AndroidNative.OpenUrl === 'function') {
            window.AndroidNative.OpenUrl(url);
            return;
        }
        if (typeof window.openExternalLink === 'function') {
            window.openExternalLink(url);
            return;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    function openRouteInMaps(stopId) {
        const stop = getAllPickupRoutesRaw().find(r => r && r.id === stopId);
        if (!stop) return null;
        const query = (stop.address || stop.clientName || '').trim();
        if (!query) {
            if (typeof showToast === 'function') showToast('⚠️ Esta parada no tiene dirección o nombre para buscar en Maps.', 'warning');
            return null;
        }
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
        _openExternalUrlSafe(url);
        return url;
    }

    function openRouteInWaze(stopId) {
        const stop = getAllPickupRoutesRaw().find(r => r && r.id === stopId);
        if (!stop) return null;
        const query = (stop.address || stop.clientName || '').trim();
        if (!query) {
            if (typeof showToast === 'function') showToast('⚠️ Esta parada no tiene dirección o nombre para abrir en Waze.', 'warning');
            return null;
        }
        const url = `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`;
        _openExternalUrlSafe(url);
        return url;
    }

    function notifyRouteClientWhatsApp(stopId) {
        const stop = getAllPickupRoutesRaw().find(r => r && r.id === stopId);
        if (!stop) return null;

        let phone = '';
        if (typeof window.normalizeWhatsAppPhone === 'function') {
            phone = window.normalizeWhatsAppPhone(stop.phone);
        } else {
            phone = String(stop.phone || '').replace(/\D/g, '');
        }
        if (!phone && typeof window.lookupClientPhone === 'function') {
            phone = window.lookupClientPhone(stop.clientName, stop.branchId);
        }

        const timeText = stop.scheduledTime ? ` (${stop.scheduledTime})` : '';
        const text = `Hola *${stop.clientName}*, vamos en camino para realizar tu recogida programada de material reciclable (${stop.scheduledDate}${timeText}).${stop.address ? `\n📍 Dirección: ${stop.address}` : ''}`;

        const params = [];
        if (phone) params.push(`phone=${encodeURIComponent(phone)}`);
        params.push(`text=${encodeURIComponent(text)}`);
        const url = `https://api.whatsapp.com/send?${params.join('&')}`;
        _openExternalUrlSafe(url);
        return url;
    }

    function convertRouteStopToBitacora(stopId) {
        const stop = getAllPickupRoutesRaw().find(r => r && r.id === stopId);
        if (!stop) return null;

        const noteParts = [`Ruta programada ${stop.id} (${stop.scheduledDate})`];
        if (stop.estimatedMaterials) noteParts.push(`Materiales est.: ${stop.estimatedMaterials}`);
        if (stop.notes) noteParts.push(stop.notes);

        window._pendingBitacoraPrefill = {
            routeStopId: stop.id,
            branchId: _rtNormBranchId(stop.branchId),
            clientId: stop.clientId || '',
            clientName: stop.clientName || '',
            driverName: stop.driverName || '',
            date: _rtTodayYmd(),
            notes: noteParts.join(' | ')
        };

        if (typeof navigate === 'function') {
            navigate('bitacoras');
        }
        if (typeof showToast === 'function') {
            showToast(`🚛 Datos de ${stop.clientName} cargados en Bitácora`, 'info');
        }
        return window._pendingBitacoraPrefill;
    }

    function markRouteStopCompletedFromBitacora(stopId, bitacoraId) {
        if (!stopId) return null;
        const result = completePickupRoute(stopId, bitacoraId);
        if (result && typeof showToast === 'function') {
            const extra = result.nextRecurring
                ? ` Próxima recogida recurrente: ${result.nextRecurring.scheduledDate}`
                : '';
            showToast(`✅ Ruta ${stopId} completada y vinculada a ${bitacoraId}.${extra}`, 'success', 4500);
        }
        return result;
    }

    let _currentRouteFilter = 'today';

    function _renderRoutesListHtml(branchRoutes) {
        const query = (document.getElementById('routes-search-input')?.value || '').trim().toLowerCase();
        const today = _rtTodayYmd();

        const filtered = branchRoutes
            .filter(r => {
                if (_currentRouteFilter === 'today') {
                    return r.status === 'pending' && r.scheduledDate <= today;
                }
                if (_currentRouteFilter === 'pending') {
                    return r.status === 'pending';
                }
                if (_currentRouteFilter === 'completed') {
                    return r.status === 'completed';
                }
                return true;
            })
            .filter(r => {
                if (!query) return true;
                return (
                    (r.clientName || '').toLowerCase().includes(query) ||
                    (r.address || '').toLowerCase().includes(query) ||
                    (r.driverName || '').toLowerCase().includes(query) ||
                    (r.estimatedMaterials || '').toLowerCase().includes(query)
                );
            })
            .sort((a, b) => {
                if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
                return `${a.scheduledDate} ${a.scheduledTime}`.localeCompare(`${b.scheduledDate} ${b.scheduledTime}`);
            });

        if (filtered.length === 0) {
            return `
                <div class="empty-state" style="padding:28px 16px;">
                    <div class="empty-state-icon">🗺️</div>
                    <p class="empty-state-text">No hay recogidas en esta vista.<br>Programa una nueva parada arriba o cambia el filtro.</p>
                </div>
            `;
        }

        const recLabel = { once: 'Única', weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual' };
        return filtered.map(r => {
            const isOverdue = r.status === 'pending' && r.scheduledDate < today;
            const isToday = r.status === 'pending' && r.scheduledDate === today;
            const isDone = r.status === 'completed';
            const statusBadge = isDone
                ? `<span class="badge badge--green">✅ Completada</span>`
                : (isOverdue
                    ? `<span class="badge badge--red">⚠️ Atrasada</span>`
                    : (isToday
                        ? `<span class="badge badge--green">📌 Hoy</span>`
                        : `<span class="badge" style="background:rgba(59,130,246,0.16); color:#93c5fd;">🗓️ Programada</span>`));
            const safeId = _rtEscapeJsSingle(r.id);

            return `
                <div class="card" style="padding:14px 16px; border-left:4px solid ${isDone ? '#10b981' : (isOverdue ? '#ef4444' : '#3b82f6')}; background:var(--clr-surface-2);">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;">
                        <div>
                            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
                                <strong style="font-size:0.98rem;">${_rtEscapeHtml(r.clientName)}</strong>
                                ${statusBadge}
                                <span class="badge" style="background:rgba(16,185,129,0.14); color:#6ee7b7; border:1px solid rgba(16,185,129,0.3); font-size:0.7rem;">🔁 ${_rtEscapeHtml(recLabel[r.recurrence] || 'Única')}</span>
                                <span class="badge" style="font-size:0.7rem;">📍 ${_rtEscapeHtml(r.branchName || _rtResolveBranchName(r.branchId))}</span>
                            </div>
                            <div style="font-size:0.82rem; color:var(--clr-text-secondary); display:flex; flex-wrap:wrap; gap:12px;">
                                <span>📅 ${_rtEscapeHtml(r.scheduledDate)} ${r.scheduledTime ? `⏰ ${_rtEscapeHtml(r.scheduledTime)}` : ''}</span>
                                ${r.driverName ? `<span>🚚 Chofer: <b>${_rtEscapeHtml(r.driverName)}</b></span>` : ''}
                                ${r.phone ? `<span>📞 ${_rtEscapeHtml(r.phone)}</span>` : ''}
                            </div>
                            ${r.address ? `<div style="font-size:0.8rem; color:var(--clr-text-muted); margin-top:4px;">📍 ${_rtEscapeHtml(r.address)}</div>` : ''}
                            ${r.estimatedMaterials ? `<div style="font-size:0.78rem; color:#6ee7b7; margin-top:4px;">♻️ Materiales est.: ${_rtEscapeHtml(r.estimatedMaterials)}</div>` : ''}
                            ${r.notes ? `<div style="font-size:0.76rem; color:var(--clr-text-muted); margin-top:4px;">📝 ${_rtEscapeHtml(r.notes)}</div>` : ''}
                            ${r.linkedBitacoraId ? `<div style="font-size:0.75rem; color:#34d399; margin-top:4px;">🔗 Bitácora vinculada: <b>${_rtEscapeHtml(r.linkedBitacoraId)}</b></div>` : ''}
                        </div>

                        <div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
                            <button type="button" class="btn-secondary" onclick="openRouteInMaps('${safeId}')" style="padding:6px 10px; font-size:0.78rem;" title="Abrir en Google Maps">🗺️ Maps</button>
                            <button type="button" class="btn-secondary" onclick="openRouteInWaze('${safeId}')" style="padding:6px 10px; font-size:0.78rem;" title="Abrir en Waze">🚗 Waze</button>
                            <button type="button" class="btn-secondary" onclick="notifyRouteClientWhatsApp('${safeId}')" style="padding:6px 10px; font-size:0.78rem; background:#25d366; color:#ffffff; border-color:#25d366;" title="Avisar al cliente por WhatsApp">💬 Avisar</button>
                            ${!isDone ? `
                                <button type="button" class="btn-primary" onclick="convertRouteStopToBitacora('${safeId}')" style="padding:6px 10px; font-size:0.78rem;">🚛 Crear Bitácora</button>
                                <button type="button" class="btn-secondary" onclick="handleCompleteRouteClick('${safeId}')" style="padding:6px 10px; font-size:0.78rem;">✅ Completar</button>
                            ` : `
                                <button type="button" class="btn-secondary" onclick="handleReopenRouteClick('${safeId}')" style="padding:6px 10px; font-size:0.78rem;">↩️ Reabrir</button>
                            `}
                            <button type="button" class="btn-danger" onclick="handleDeleteRouteClick('${safeId}')" style="padding:6px 9px; font-size:0.78rem;" title="Eliminar parada">🗑️</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderRoutesAgendaPage(container) {
        if (!container) container = document.getElementById('page-rutas');
        if (!container) return;

        const activeBranchId = _rtTargetBranchId(null);
        const branchName = _rtResolveBranchName(activeBranchId);
        const branchRoutes = getPickupRoutes(activeBranchId);
        const today = _rtTodayYmd();

        const todayCount = branchRoutes.filter(r => r.status === 'pending' && r.scheduledDate === today).length;
        const pendingCount = branchRoutes.filter(r => r.status === 'pending').length;
        const completedCount = branchRoutes.filter(r => r.status === 'completed').length;
        const recurringCount = branchRoutes.filter(r => r.status === 'pending' && r.recurrence !== 'once').length;

        const clients = typeof getClients === 'function' ? getClients(activeBranchId) : [];
        const colabs = (() => {
            try {
                const raw = JSON.parse(localStorage.getItem(typeof userKey === 'function' ? userKey('recim_collaborators') : 'recim_collaborators') || '[]');
                return Array.isArray(raw) ? raw : [];
            } catch (_) { return []; }
        })();

        const branchBarHtml = typeof renderBranchContextBar === 'function'
            ? renderBranchContextBar({ onChangeExpr: 'renderRoutesAgendaPage()', containerStyle: 'margin-bottom:14px;' })
            : `<span class="badge badge--green">📍 ${_rtEscapeHtml(branchName)}</span>`;

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h2 class="section-title">🗺️ Agenda y Rutas de Recogida</h2>
                    <p class="section-subtitle">Programa paradas por sucursal, navega con Maps/Waze y conviértelas directo en Bitácoras.</p>
                </div>
            </div>

            ${branchBarHtml}

            <div class="stats-grid" style="margin-bottom:20px;">
                <div class="stat-card">
                    <div class="stat-label">Para Hoy</div>
                    <div class="stat-value stat-value--green">${todayCount}</div>
                    <div class="stat-sub">${_rtEscapeHtml(branchName)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Pendientes Totales</div>
                    <div class="stat-value stat-value--blue">${pendingCount}</div>
                    <div class="stat-sub">En agenda activa</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Completadas</div>
                    <div class="stat-value stat-value--green">${completedCount}</div>
                    <div class="stat-sub">Historial de ruta</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Recurrentes</div>
                    <div class="stat-value">${recurringCount}</div>
                    <div class="stat-sub">Semanales / Mensuales</div>
                </div>
            </div>

            <div class="card" style="margin-bottom:20px;">
                <div class="card-header" style="margin-bottom:12px;">
                    <h3 class="card-title">➕ Programar Nueva Recogida</h3>
                    <p class="card-subtitle">Cliente y chofer aislados en <b>${_rtEscapeHtml(branchName)}</b></p>
                </div>

                <div class="form-row" style="grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap:12px;">
                    <div class="form-group">
                        <label class="form-label" for="route-client-select">Cliente de esta sucursal</label>
                        <select id="route-client-select" class="form-select" onchange="onRouteClientSelectChange(this.value)">
                            <option value="">-- Seleccionar cliente o escribir --</option>
                            ${clients.map(c => `<option value="${_rtEscapeHtml(c.id)}">${_rtEscapeHtml(c.name)}${c.nit ? ` (${_rtEscapeHtml(c.nit)})` : ''}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="route-client-name">Nombre Cliente / Punto <span style="color:#ef4444;">*</span></label>
                        <input id="route-client-name" type="text" class="form-input" placeholder="Ej: Supermercado Central" />
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="route-date">Fecha</label>
                        <input id="route-date" type="date" class="form-input" value="${today}" />
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="route-time">Hora estimada</label>
                        <input id="route-time" type="time" class="form-input" value="09:00" />
                    </div>
                </div>

                <div class="form-row" style="grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap:12px; margin-top:10px;">
                    <div class="form-group">
                        <label class="form-label" for="route-address">Dirección / Referencia Maps</label>
                        <input id="route-address" type="text" class="form-input" placeholder="Calle, número, sector o referencia" />
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="route-phone">Teléfono (WhatsApp)</label>
                        <input id="route-phone" type="tel" class="form-input" placeholder="809-555-0100" />
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="route-recurrence">Recurrencia</label>
                        <select id="route-recurrence" class="form-select">
                            <option value="once">Única vez</option>
                            <option value="weekly">🔁 Semanal (cada 7 días)</option>
                            <option value="biweekly">🔁 Quincenal (cada 14 días)</option>
                            <option value="monthly">🔁 Mensual</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="route-driver">Chofer / Colaborador</label>
                        <select id="route-driver" class="form-select">
                            <option value="">-- Sin asignar --</option>
                            ${colabs.map(c => `<option value="${_rtEscapeHtml(c.name)}">${_rtEscapeHtml(c.name)} (${_rtEscapeHtml(c.role || 'Ruta')})</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div class="form-row" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-top:10px;">
                    <div class="form-group">
                        <label class="form-label" for="route-materials">Materiales estimados</label>
                        <input id="route-materials" type="text" class="form-input" placeholder="Ej: Cartón ~200 kg, PET ~80 kg" />
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="route-notes">Notas adicionales</label>
                        <input id="route-notes" type="text" class="form-input" placeholder="Ej: Entrar por portón trasero" />
                    </div>
                </div>

                <div style="display:flex; justify-content:flex-end; margin-top:12px;">
                    <button type="button" class="btn-primary" onclick="handleSaveNewPickupRoute()">➕ Guardar en Agenda</button>
                </div>
            </div>

            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        ${[
                            ['today', '📌 Hoy / Atrasadas'],
                            ['pending', '⏳ Pendientes'],
                            ['all', '📋 Todas'],
                            ['completed', '✅ Completadas']
                        ].map(([key, label]) => `
                            <button type="button" class="btn-secondary" onclick="setRoutesFilter('${key}')" style="padding:6px 12px; font-size:0.8rem; ${_currentRouteFilter === key ? 'background:var(--clr-primary); color:#ffffff; border-color:var(--clr-primary);' : ''}">${label}</button>
                        `).join('')}
                    </div>
                    <input id="routes-search-input" type="text" class="form-input" placeholder="🔍 Buscar cliente, dirección o chofer..." oninput="refreshRoutesList()" style="max-width:280px; width:100%;" />
                </div>

                <div id="routes-agenda-list" style="display:flex; flex-direction:column; gap:10px;">
                    ${_renderRoutesListHtml(branchRoutes)}
                </div>
            </div>
        `;
    }

    function refreshRoutesList() {
        const listEl = document.getElementById('routes-agenda-list');
        if (!listEl) return;
        listEl.innerHTML = _renderRoutesListHtml(getPickupRoutes(null));
    }

    function setRoutesFilter(filter) {
        _currentRouteFilter = filter || 'today';
        renderRoutesAgendaPage();
    }

    function onRouteClientSelectChange(clientId) {
        if (!clientId) return;
        const clients = typeof getClients === 'function' ? getClients(_rtTargetBranchId(null)) : [];
        const c = clients.find(x => x && x.id === clientId);
        if (!c) return;
        const nameEl = document.getElementById('route-client-name');
        const addrEl = document.getElementById('route-address');
        const phoneEl = document.getElementById('route-phone');
        if (nameEl) nameEl.value = c.name || '';
        if (addrEl && c.address) addrEl.value = c.address;
        if (phoneEl && (c.phone || c.contact)) phoneEl.value = c.phone || c.contact;
    }

    function handleSaveNewPickupRoute() {
        const clientName = (document.getElementById('route-client-name')?.value || '').trim();
        if (!clientName) {
            if (typeof showToast === 'function') showToast('⚠️ Indica el nombre del cliente o punto de recogida', 'warning');
            return;
        }
        const stop = addPickupRoute({
            branchId: _rtTargetBranchId(null),
            clientId: document.getElementById('route-client-select')?.value || '',
            clientName,
            scheduledDate: document.getElementById('route-date')?.value || _rtTodayYmd(),
            scheduledTime: document.getElementById('route-time')?.value || '09:00',
            address: document.getElementById('route-address')?.value || '',
            phone: document.getElementById('route-phone')?.value || '',
            recurrence: document.getElementById('route-recurrence')?.value || 'once',
            driverName: document.getElementById('route-driver')?.value || '',
            estimatedMaterials: document.getElementById('route-materials')?.value || '',
            notes: document.getElementById('route-notes')?.value || ''
        });
        if (typeof showToast === 'function') {
            showToast(`✅ Recogida para ${stop.clientName} agregada a la agenda`, 'success');
        }
        renderRoutesAgendaPage();
    }

    function handleCompleteRouteClick(id) {
        const res = completePickupRoute(id);
        if (res && typeof showToast === 'function') {
            const msg = res.nextRecurring
                ? `✅ Recogida completada. Próxima programada para ${res.nextRecurring.scheduledDate}`
                : '✅ Recogida marcada como completada';
            showToast(msg, 'success');
        }
        renderRoutesAgendaPage();
    }

    function handleReopenRouteClick(id) {
        updatePickupRoute(id, { status: 'pending', completedAt: '' });
        if (typeof showToast === 'function') showToast('↩️ Recogida reabierta como pendiente', 'info');
        renderRoutesAgendaPage();
    }

    function handleDeleteRouteClick(id) {
        if (typeof confirm === 'function' && !confirm('¿Eliminar esta parada de la agenda?')) return;
        if (deletePickupRoute(id) && typeof showToast === 'function') {
            showToast('🗑️ Parada eliminada de la agenda', 'info');
        }
        renderRoutesAgendaPage();
    }

    if (typeof window !== 'undefined') {
        window.getAllPickupRoutesRaw = getAllPickupRoutesRaw;
        window.getPickupRoutes = getPickupRoutes;
        window.savePickupRoutes = savePickupRoutes;
        window.addPickupRoute = addPickupRoute;
        window.updatePickupRoute = updatePickupRoute;
        window.completePickupRoute = completePickupRoute;
        window.deletePickupRoute = deletePickupRoute;
        window.computeNextRecurrenceDate = computeNextRecurrenceDate;
        window.openRouteInMaps = openRouteInMaps;
        window.openRouteInWaze = openRouteInWaze;
        window.notifyRouteClientWhatsApp = notifyRouteClientWhatsApp;
        window.convertRouteStopToBitacora = convertRouteStopToBitacora;
        window.markRouteStopCompletedFromBitacora = markRouteStopCompletedFromBitacora;
        window.renderRoutesAgendaPage = renderRoutesAgendaPage;
        window.refreshRoutesList = refreshRoutesList;
        window.setRoutesFilter = setRoutesFilter;
        window.onRouteClientSelectChange = onRouteClientSelectChange;
        window.handleSaveNewPickupRoute = handleSaveNewPickupRoute;
        window.handleCompleteRouteClick = handleCompleteRouteClick;
        window.handleReopenRouteClick = handleReopenRouteClick;
        window.handleDeleteRouteClick = handleDeleteRouteClick;
        window.syncPickupRouteReminders = syncPickupRouteReminders;
    }
})();
