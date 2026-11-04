/* ============================================================================
   TELEMETRY-OPS.JS – Consola de Supervisión Geoespacial en Tiempo Real (Reciminsa Ops v.js)
   Implementa:
   - Sección 3: Monitoreo de Telemetría cada 10s (0.1 Hz)
   - Sección 4: Regla de Detección de Desconexión (Umbral Crítico de 60 Segundos)
     * Delta_t <= 60s -> Marcador Verde ("Conectado / En ruta")
     * Delta_t >  60s -> Marcador Gris/Rojo ("Desconectado / Sin señal"), congela última coordenada
   ============================================================================ */

let _opsMap = null;
let _opsMarkers = {};
let _opsPolylines = {};
let _opsTelemetryInterval = null;

function _getTelemetryOpsDbId() {
  try {
    const s = JSON.parse(localStorage.getItem('recim_session') || '{}');
    if (s.familyId) return `family_${s.familyId}`;
    return s.accountId || 'default';
  } catch (_) {
    return 'default';
  }
}

function formatElapsedDisconnection(deltaSeconds) {
  if (deltaSeconds === null || deltaSeconds === undefined) return 'Sin reportes previos';
  if (deltaSeconds < 60) return `${deltaSeconds}s`;
  const mins = Math.floor(deltaSeconds / 60);
  const secs = deltaSeconds % 60;
  if (mins < 60) return `${mins}m ${secs}s sin señal`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m sin señal`;
}

function renderTelemetryOpsPage(container) {
  container.innerHTML = `
    <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
      <div>
        <h2 class="section-title">🛰️ Supervisión Logística en Tiempo Real (Reciminsa Ops)</h2>
        <p class="section-subtitle">
          Frecuencia de muestreo: <strong>10s (0.1 Hz)</strong> &bull; Umbral de desconexión: <strong>&Delta;t &gt; 60 segundos</strong>
        </p>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn-secondary" onclick="refreshTelemetryOpsView(true)" style="font-size:0.84rem; padding:8px 14px;">
          🔄 Actualizar Ahora
        </button>
        <button class="btn-secondary" onclick="navigate('colaboradores')" style="font-size:0.84rem; padding:8px 14px;">
          🔑 Gestionar Pairing Codes
        </button>
        <a href="/field" target="_blank" class="btn-primary" style="background:var(--clr-primary-light); color:#0a0f1d; font-weight:700; font-size:0.84rem; padding:8px 14px; text-decoration:none;">
          📱 Abrir Reciminsa Field (/field) ↗
        </a>
      </div>
    </div>

    <!-- KPIs de Estado de Flota -->
    <div class="stats-grid" style="margin-bottom:20px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
      <div class="stat-card">
        <div class="stat-label">Terminales Vinculados</div>
        <div class="stat-value" id="tele-stat-total">0</div>
        <div class="stat-sub">Hardware ANDROID_ID activo</div>
      </div>
      <div class="stat-card" style="border-color:rgba(16,185,129,0.4);">
        <div class="stat-label" style="color:#10b981;">🟢 Conectados / En Ruta (&le; 60s)</div>
        <div class="stat-value stat-value--green" id="tele-stat-online">0</div>
        <div class="stat-sub">(T_servidor - T_última_pos) &le; 60s</div>
      </div>
      <div class="stat-card" style="border-color:rgba(239,68,68,0.4);">
        <div class="stat-label" style="color:#f87171;">🔴 Desconectados / Sin Señal (&gt; 60s)</div>
        <div class="stat-value" id="tele-stat-offline" style="color:#f87171;">0</div>
        <div class="stat-sub">Coordenada congelada (&gt; 6 paquetes perdidos)</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">📥 Bitácoras Pendientes (API)</div>
        <div class="stat-value stat-value--blue" id="tele-stat-pending-bit">0</div>
        <div class="stat-sub"><a href="javascript:void(0)" onclick="navigate('bitacoras')" style="color:var(--clr-primary-light);">Ir al panel de aprobación &rarr;</a></div>
      </div>
    </div>

    <!-- Mapa Geoespacial + Lista de Unidades -->
    <div style="display:grid; grid-template-columns: 1.7fr 1fr; gap:18px; align-items:start;" class="telemetry-ops-grid">
      <div class="card card--elevated" style="padding:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
          <div style="font-weight:700; font-size:0.92rem;">🗺️ Mapa Operativo de Recolectores</div>
          <div style="display:flex; gap:14px; font-size:0.78rem;">
            <span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:10px; height:10px; border-radius:50%; background:#10b981; display:inline-block;"></span> Conectado / En ruta (&le;60s)</span>
            <span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:10px; height:10px; border-radius:50%; background:#ef4444; border:2px solid #64748b; display:inline-block;"></span> Desconectado / Sin señal (&gt;60s)</span>
          </div>
        </div>
        <div id="ops-leaflet-map" style="width:100%; height:440px; border-radius:10px; overflow:hidden; border:1px solid var(--clr-border); background:#0f172a;"></div>
      </div>

      <div class="card card--elevated" style="padding:16px;">
        <h3 style="margin:0 0 12px 0; font-size:0.96rem; font-weight:700;">📡 Estado de Enlace por Unidad (Umbral 60s)</h3>
        <div id="ops-telemetry-units-list" style="display:flex; flex-direction:column; gap:10px; max-height:430px; overflow-y:auto;">
          <div style="padding:20px; text-align:center; color:var(--clr-text-muted); font-size:0.85rem;">Cargando telemetría...</div>
        </div>
      </div>
    </div>
    <style>
      @media (max-width: 960px) {
        .telemetry-ops-grid { grid-template-columns: 1fr !important; }
      }
    </style>
  `;

  initOpsLeafletMap();
  refreshTelemetryOpsView(false);

  if (_opsTelemetryInterval) clearInterval(_opsTelemetryInterval);
  _opsTelemetryInterval = setInterval(() => {
    if (typeof getCurrentPage === 'function' && getCurrentPage() === 'telemetria') {
      refreshTelemetryOpsView(false);
    }
  }, 3000);
}

function initOpsLeafletMap() {
  const mapEl = document.getElementById('ops-leaflet-map');
  if (!mapEl || typeof L === 'undefined') return;

  if (_opsMap) {
    try { _opsMap.remove(); } catch (_) {}
    _opsMap = null;
  }
  _opsMarkers = {};
  _opsPolylines = {};

  // Coordenada inicial por defecto: Santo Domingo, República Dominicana
  _opsMap = L.map('ops-leaflet-map').setView([18.4861, -69.9312], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap | Reciminsa Ops v.js'
  }).addTo(_opsMap);
}

async function refreshTelemetryOpsView(manual = false) {
  try {
    const dbId = _getTelemetryOpsDbId();
    const res = await fetch(`/api/v1/ops/fleet?db_id=${encodeURIComponent(dbId)}`);
    if (!res.ok) return;
    const data = await res.json();

    const devices = Array.isArray(data.devices) ? data.devices : [];
    const bitacoras = Array.isArray(data.bitacoras) ? data.bitacoras : [];
    const pendingBits = bitacoras.filter(b => b.estado_aprobacion !== 'ACEPTADA' && !b.guardado_en_supabase);

    const pairedDevices = devices.filter(d => d.is_paired);
    const connectedDevices = pairedDevices.filter(d => d.is_connected);
    const disconnectedDevices = pairedDevices.filter(d => !d.is_connected);

    const totalEl = document.getElementById('tele-stat-total');
    const onlineEl = document.getElementById('tele-stat-online');
    const offlineEl = document.getElementById('tele-stat-offline');
    const pendEl = document.getElementById('tele-stat-pending-bit');

    if (totalEl) totalEl.textContent = pairedDevices.length;
    if (onlineEl) onlineEl.textContent = connectedDevices.length;
    if (offlineEl) offlineEl.textContent = disconnectedDevices.length;
    if (pendEl) pendEl.textContent = pendingBits.length;

    updateOpsMapMarkers(pairedDevices);
    renderOpsUnitsStatusList(devices);

    if (manual && typeof showToast === 'function') {
      showToast('🛰️ Telemetría sincronizada con la flota', 'info');
    }
  } catch (_) {}
}

function updateOpsMapMarkers(pairedDevices) {
  if (!_opsMap || typeof L === 'undefined') return;

  const bounds = [];

  pairedDevices.forEach(dev => {
    const lat = Number(dev.last_latitude);
    const lng = Number(dev.last_longitude);
    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

    bounds.push([lat, lng]);

    // Regla Sección 4:
    // Conectado (<=60s): Verde (#10b981)
    // Desconectado (>60s): Gris/Rojo (#64748b / #ef4444) con coordenada congelada
    const isOnline = dev.is_connected;
    const fillColor = isOnline ? '#10b981' : '#ef4444';
    const strokeColor = isOnline ? '#059669' : '#64748b';
    const statusBadge = isOnline
      ? `<span style="color:#10b981; font-weight:800;">🟢 Conectado / En ruta (${dev.delta_seconds ?? 0}s)</span>`
      : `<span style="color:#ef4444; font-weight:800;">🔴 Desconectado / Sin señal (${formatElapsedDisconnection(dev.delta_seconds)})</span>`;

    const iconHtml = `
      <div style="
        width: 24px; height: 24px; border-radius: 50%;
        background: ${fillColor};
        border: 3px solid ${strokeColor};
        box-shadow: 0 0 ${isOnline ? '12px rgba(16,185,129,0.85)' : '6px rgba(239,68,68,0.6)'};
        display:flex; align-items:center; justify-content:center; color:#fff; font-size:11px; font-weight:bold;
      ">🚛</div>
    `;

    const customIcon = L.divIcon({
      className: 'recim-ops-gps-marker',
      html: iconHtml,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const popupContent = `
      <div style="font-family:sans-serif; min-width:210px; font-size:12.5px; color:#0f172a;">
        <div style="font-weight:800; font-size:14px; margin-bottom:4px;">👷 ${dev.colaborador_nombre || 'Colaborador'}</div>
        <div style="margin-bottom:6px;">${statusBadge}</div>
        <div><strong>Hardware ID:</strong> <code>${dev.android_id || 'N/A'}</code></div>
        <div><strong>Terminal:</strong> ${dev.device_model || 'Android'} &bull; 🔋 ${dev.battery_level ?? 100}%</div>
        ${dev.is_mock_location ? `<div style="margin:4px 0; padding:4px 6px; border-radius:4px; background:#fef2f2; border:1px solid #ef4444; color:#b91c1c; font-weight:800;">⚠️ ALERTA: GPS Simulado (Mock Location) Detectado</div>` : ''}
        <div><strong>Coordenada ${isOnline ? 'Actual' : 'Congelada'}:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
        <div><strong>Velocidad:</strong> ${Number(dev.last_speed || 0).toFixed(1)} km/h | <strong>Precisión:</strong> &plusmn;${Number(dev.last_accuracy || 0).toFixed(1)}m</div>
        <div style="color:#475569; font-size:11px; margin-top:4px;">Último paquete: ${dev.last_seen_at ? new Date(dev.last_seen_at).toLocaleTimeString() : 'N/A'}</div>
      </div>
    `;

    if (_opsMarkers[dev.id]) {
      _opsMarkers[dev.id].setLatLng([lat, lng]);
      _opsMarkers[dev.id].setIcon(customIcon);
      _opsMarkers[dev.id].setPopupContent(popupContent);
    } else {
      _opsMarkers[dev.id] = L.marker([lat, lng], { icon: customIcon })
        .addTo(_opsMap)
        .bindPopup(popupContent);
    }

    // Dibujar trazo de ruta reciente si existe
    if (Array.isArray(dev.recent_track) && dev.recent_track.length > 1) {
      const latlngs = dev.recent_track
        .map(t => [Number(t.latitud), Number(t.longitud)])
        .filter(([a, b]) => !isNaN(a) && !isNaN(b));
      if (_opsPolylines[dev.id]) {
        _opsPolylines[dev.id].setLatLngs(latlngs);
        _opsPolylines[dev.id].setStyle({ color: isOnline ? '#10b981' : '#64748b' });
      } else {
        _opsPolylines[dev.id] = L.polyline(latlngs, {
          color: isOnline ? '#10b981' : '#64748b',
          weight: 3,
          opacity: 0.75,
          dashArray: isOnline ? null : '6, 6'
        }).addTo(_opsMap);
      }
    }
  });

  if (bounds.length > 0 && !_opsMap._hasCenteredOnce) {
    _opsMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    _opsMap._hasCenteredOnce = true;
  }
}

function renderOpsUnitsStatusList(devices) {
  const listEl = document.getElementById('ops-telemetry-units-list');
  if (!listEl) return;

  if (devices.length === 0) {
    listEl.innerHTML = `
      <div style="padding:20px; text-align:center; color:var(--clr-text-muted); font-size:0.84rem; border:1px dashed var(--clr-border); border-radius:8px;">
        No hay dispositivos vinculados aún.<br><br>
        Ve a <strong>Colaboradores & Pairing</strong> para generar un código <code>REC-XXXXXX</code> y vincular un terminal móvil.
      </div>
    `;
    return;
  }

  listEl.innerHTML = devices.map(dev => {
    const isPaired = dev.is_paired;
    const isOnline = dev.is_connected;
    const borderClr = !isPaired
      ? 'rgba(245,158,11,0.35)'
      : (isOnline ? 'rgba(16,185,129,0.45)' : 'rgba(239,68,68,0.45)');
    const bgClr = !isPaired
      ? 'rgba(245,158,11,0.06)'
      : (isOnline ? 'rgba(16,185,129,0.07)' : 'rgba(100,116,139,0.12)');

    const latStr = dev.last_latitude !== null && dev.last_latitude !== undefined
      ? `${Number(dev.last_latitude).toFixed(5)}, ${Number(dev.last_longitude).toFixed(5)}`
      : 'Sin coordenadas aún';

    return `
      <div style="padding:12px; border-radius:8px; border:1px solid ${borderClr}; background:${bgClr}; font-size:0.8rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <strong style="font-size:0.88rem; color:var(--clr-text);">👷 ${dev.colaborador_nombre || 'Colaborador'}</strong>
          ${!isPaired
            ? `<span style="background:rgba(245,158,11,0.2); color:#fbbf24; padding:2px 8px; border-radius:99px; font-size:0.72rem; font-weight:700;">🔑 OTP: ${dev.pairing_code || 'Pendiente'}</span>`
            : (isOnline
                ? `<span style="background:rgba(16,185,129,0.2); color:#10b981; padding:2px 8px; border-radius:99px; font-size:0.72rem; font-weight:800;">🟢 Conectado / En ruta (${dev.delta_seconds ?? 0}s)</span>`
                : `<span style="background:rgba(239,68,68,0.2); color:#f87171; padding:2px 8px; border-radius:99px; font-size:0.72rem; font-weight:800;">🔴 Desconectado / Sin señal</span>`
              )
          }
        </div>
        <div style="color:var(--clr-text-secondary); display:grid; grid-template-columns:1fr 1fr; gap:4px; font-size:0.76rem;">
          <div>📱 <strong>ANDROID_ID:</strong> <code>${dev.android_id || 'No vinculado'}</code></div>
          <div>🏷️ <strong>Modelo:</strong> ${dev.device_model || '—'} (🔋 ${dev.battery_level ?? 100}%)</div>
          <div>📍 <strong>${isOnline ? 'Posición:' : 'Últ. Posición (Congelada):'}</strong> ${latStr}</div>
          <div>⏱️ <strong>Estado enlace:</strong> ${isOnline ? `Activo (&Delta;t = ${dev.delta_seconds || 0}s &le; 60s)` : formatElapsedDisconnection(dev.delta_seconds)}</div>
        </div>
        ${dev.is_mock_location ? `<div style="margin-top:6px; padding:5px 8px; border-radius:6px; background:rgba(239,68,68,0.2); border:1px solid #ef4444; color:#fca5a5; font-size:0.74rem; font-weight:800;">🚨 ALERTA DE AUDITORÍA: Ubicación Falsa (Mock GPS) detectada — Bitácoras bloqueadas</div>` : ''}
        ${dev.last_latitude && _opsMap ? `
          <div style="margin-top:8px; text-align:right;">
            <button type="button" onclick="focusOpsMapOnDevice(${Number(dev.last_latitude)}, ${Number(dev.last_longitude)}, ${dev.id})" style="background:var(--clr-surface-3); border:1px solid var(--clr-border); color:var(--clr-primary-light); border-radius:6px; padding:4px 10px; font-size:0.74rem; cursor:pointer; font-weight:600;">
              🎯 Centrar en Mapa
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function focusOpsMapOnDevice(lat, lng, devId) {
  if (!_opsMap) return;
  _opsMap.setView([lat, lng], 16);
  if (_opsMarkers[devId]) {
    _opsMarkers[devId].openPopup();
  }
}

window.renderTelemetryOpsPage = renderTelemetryOpsPage;
window.refreshTelemetryOpsView = refreshTelemetryOpsView;
window.focusOpsMapOnDevice = focusOpsMapOnDevice;
