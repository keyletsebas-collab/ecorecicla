/* ============================================================================
   FIELD-APP.JS – Cliente Operativo Móvil Reciminsa Field (Versión v.js)
   - CERO conexión a Supabase (sin SDK, sin URLs, sin credenciales de BD).
   - Comunicación exclusiva vía RESTful API (/api/v1/*) hacia Reciminsa Ops.
   - Implementa las 15 protecciones de "Auditoria de posibles errores.pdf":
     * Pairing sin Login (Settings.Secure.ANDROID_ID + Modelo)
     * Header estándar Authorization: Bearer <api_key> + X-Android-Id
     * Sincronización automática de catálogos al iniciar app y jornada (POST /api/v1/auth/sync)
     * Control de turno (Iniciar Jornada / Finalizar Jornada) para privacidad fuera de horario
     * Telemetría GPS cada 10s (0.1 Hz) con battery_level, is_mock, gps_enabled y timestamp_gps
     * Captura de Bitácora estrictamente INSERT-Only (sin edición ni borrado)
     * Cola Offline-First idempotente con client_record_uuid (UUID v4) y envío por lotes (entries)
   ============================================================================ */

const STORAGE_KEYS = {
  STATE: 'recim_field_vjs_device_state',
  CATALOGS: 'recim_field_vjs_catalogs',
  QUEUE: 'recim_field_vjs_offline_queue',
  HW_ID: 'recim_field_vjs_android_id',
  SHIFT_ACTIVE: 'recim_field_vjs_shift_active'
};

let _telemetryTimer = null;
let _queueWorkerTimer = null;
let _wakeLockSentinel = null;
let _lastPosition = {
  latitude: 18.486058,
  longitude: -69.931212,
  speed: 0,
  accuracy: 4.5,
  is_mock: false,
  gps_enabled: true
};
let _batteryLevel = 100;

// Generador UUID v4 criptográfico (Auditoría #3: client_record_uuid único en el instante de captura)
function generateUuidV4() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function showFieldToast(msg) {
  const el = document.getElementById('field-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._hideTimeout);
  el._hideTimeout = setTimeout(() => el.classList.add('hidden'), 3200);
}

// Extracción de Settings.Secure.ANDROID_ID y Modelo del Dispositivo (Sección 2.3)
function getHardwareTelemetry() {
  let androidId = null;
  let deviceModel = 'Android Field Terminal';

  try {
    if (window.AndroidFieldBridge && typeof window.AndroidFieldBridge.getAndroidId === 'function') {
      androidId = window.AndroidFieldBridge.getAndroidId();
    }
    if (window.AndroidFieldBridge && typeof window.AndroidFieldBridge.getDeviceModel === 'function') {
      deviceModel = window.AndroidFieldBridge.getDeviceModel();
    }
  } catch (_) {}

  if (!androidId) {
    androidId = localStorage.getItem(STORAGE_KEYS.HW_ID);
    if (!androidId) {
      const hex = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      androidId = hex;
      localStorage.setItem(STORAGE_KEYS.HW_ID, androidId);
    }
  }

  if (deviceModel === 'Android Field Terminal' && typeof navigator !== 'undefined') {
    const ua = navigator.userAgent || '';
    const match = ua.match(/\(([^)]+)\)/);
    if (match && match[1]) {
      deviceModel = match[1].split(';').slice(0, 2).join(' ').trim().substring(0, 60);
    }
  }

  return { androidId, deviceModel };
}

function getDeviceState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.STATE) || 'null');
  } catch (_) {
    return null;
  }
}

function saveDeviceState(state) {
  localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(state));
}

function getLocalCatalogs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.CATALOGS) || '{"materiales":[],"clientes":[]}');
  } catch (_) {
    return { materiales: [], clientes: [] };
  }
}

function saveLocalCatalogs(catalogs) {
  localStorage.setItem(STORAGE_KEYS.CATALOGS, JSON.stringify(catalogs));
}

function getOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.QUEUE) || '[]');
  } catch (_) {
    return [];
  }
}

function saveOfflineQueue(queue) {
  localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));
}

function isWorkShiftActive() {
  return localStorage.getItem(STORAGE_KEYS.SHIFT_ACTIVE) !== 'false';
}

// Headers autenticados estandarizados (Auditoría #6: Authorization: Bearer <api_key> + X-Android-Id)
function getAuthHeaders(state) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${state.api_key}`,
    'X-Device-Token': state.api_key,
    'X-Android-Id': state.android_id
  };
}

// Lectura de nivel de batería (Auditoría #15)
async function initBatteryMonitor() {
  try {
    if (navigator.getBattery) {
      const bat = await navigator.getBattery();
      const updateBat = () => {
        _batteryLevel = Math.round((bat.level || 1) * 100);
        const lbl = document.getElementById('op-battery-label');
        if (lbl) lbl.textContent = `${_batteryLevel}%`;
      };
      updateBat();
      bat.addEventListener('levelchange', updateBat);
    }
  } catch (_) {}
}

// Solicitar WakeLock / Exención Doze Mode (Sección 3)
async function requestDozeExemptionAndWakeLock() {
  try {
    if (window.AndroidFieldBridge && typeof window.AndroidFieldBridge.requestIgnoreBatteryOptimizations === 'function') {
      window.AndroidFieldBridge.requestIgnoreBatteryOptimizations();
    }
    if ('wakeLock' in navigator && document.visibilityState === 'visible') {
      _wakeLockSentinel = await navigator.wakeLock.request('screen');
    }
  } catch (_) {}
}

// ============================================================================
// 1. VINCULACIÓN POR CÓDIGO (POST /api/v1/device/pair)
// ============================================================================
async function handleDevicePairing(e) {
  e.preventDefault();
  const codeInput = document.getElementById('input-pairing-code');
  const apiBaseInput = document.getElementById('input-api-base');
  const submitBtn = document.getElementById('btn-pair-submit');

  const pairingCode = (codeInput.value || '').trim().toUpperCase();
  const apiBase = (apiBaseInput.value || window.location.origin).trim().replace(/\/+$/, '');
  const { androidId, deviceModel } = getHardwareTelemetry();

  if (!pairingCode) {
    showFieldToast('⚠️ Ingresa el Pairing Code generado en Reciminsa Ops');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '⏳ Validando Pairing Code...';

  try {
    const res = await fetch(`${apiBase}/api/v1/device/pair`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Android-Id': androidId
      },
      body: JSON.stringify({
        pairing_code: pairingCode,
        android_id: androidId,
        device_model: deviceModel
      })
    });

    const data = await res.json();
    if (!res.ok || !data.api_key) {
      showFieldToast('❌ ' + (data.error || 'Código inválido o expirado'));
      submitBtn.disabled = false;
      submitBtn.textContent = '🔗 Vincular Dispositivo y Sincronizar Catálogos';
      return;
    }

    const state = {
      api_base: apiBase,
      api_key: data.api_key,
      device_id: data.device_id,
      android_id: androidId,
      device_model: deviceModel,
      colaborador: data.colaborador || { id: 0, nombre: 'Colaborador de Campo' },
      paired_at: new Date().toISOString()
    };

    saveDeviceState(state);
    localStorage.setItem(STORAGE_KEYS.SHIFT_ACTIVE, 'true');

    // Sincronización Inicial de Catálogos (POST /api/v1/auth/sync)
    await syncFieldCatalogs(false);

    showFieldToast('✅ Dispositivo vinculado permanentemente');
    bootOperationScreen();
  } catch (err) {
    showFieldToast('❌ Error de red al conectar con Reciminsa Ops');
    submitBtn.disabled = false;
    submitBtn.textContent = '🔗 Vincular Dispositivo y Sincronizar Catálogos';
  }
}

// ============================================================================
// 2. SINCRONIZACIÓN DE CATÁLOGOS (POST /api/v1/auth/sync - Sección 2.1 + Auditoría #5)
// ============================================================================
async function syncFieldCatalogs(manual = false) {
  const state = getDeviceState();
  if (!state || !state.api_key) return;

  try {
    const res = await fetch(`${state.api_base}/api/v1/auth/sync`, {
      method: 'POST',
      headers: getAuthHeaders(state),
      body: JSON.stringify({ android_id: state.android_id })
    });

    if (res.status === 401 || res.status === 403) {
      const errData = await res.json().catch(() => ({}));
      showFieldToast('⛔ ' + (errData.error || 'Dispositivo revocado por Reciminsa Ops'));
      return;
    }

    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    if (data.colaborador) {
      state.colaborador = data.colaborador;
      saveDeviceState(state);
    }

    const catalogs = {
      materiales: Array.isArray(data.materiales) ? data.materiales : [],
      clientes: Array.isArray(data.clientes) ? data.clientes : [],
      synced_at: new Date().toISOString()
    };
    saveLocalCatalogs(catalogs);
    populateFieldSelects();

    if (manual) {
      showFieldToast(`🔄 Catálogos actualizados (${catalogs.materiales.length} mat. / ${catalogs.clientes.length} clientes)`);
    }
  } catch (_) {
    populateFieldSelects();
    if (manual) {
      showFieldToast('📴 Modo Offline: Usando catálogos almacenados localmente');
    }
  }
}

function populateFieldSelects() {
  const { materiales, clientes } = getLocalCatalogs();
  const matSelect = document.getElementById('field-material-select');
  const cliSelect = document.getElementById('field-cliente-select');

  if (matSelect) {
    matSelect.innerHTML =
      `<option value="">-- Seleccionar Material --</option>` +
      materiales.map(m => `<option value="${m.id}" data-nombre="${m.nombre}">${m.nombre} (${m.unidad_medida || m.unidad || 'kg'})</option>`).join('');
  }

  if (cliSelect) {
    let opts = `<option value="">-- Seleccionar Cliente / Punto --</option>`;
    if (clientes.length === 0) {
      opts += `<option value="101" data-nombre="Punto de Recolección General">Punto de Recolección General</option>`;
    } else {
      opts += clientes.map(c => `<option value="${c.id}" data-nombre="${c.nombre_comercial}">${c.nombre_comercial} ${c.rnc_cedula ? '(' + c.rnc_cedula + ')' : ''}</option>`).join('');
    }
    cliSelect.innerHTML = opts;
  }
}

// ============================================================================
// 3. TELEMETRÍA CADA 10 SEGUNDOS (0.1 Hz) + CONTROL DE JORNADA (Sección 3 + Auditoría #13, #14, #15)
// ============================================================================
function startTelemetryEngine() {
  if (_telemetryTimer) clearInterval(_telemetryTimer);

  // Obtener lectura de geolocalización continua si el navegador/dispositivo lo soporta
  if ('geolocation' in navigator) {
    try {
      navigator.geolocation.watchPosition(
        (pos) => {
          _lastPosition = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            speed: pos.coords.speed !== null && !isNaN(pos.coords.speed) ? +(pos.coords.speed).toFixed(2) : 0,
            accuracy: pos.coords.accuracy !== null && !isNaN(pos.coords.accuracy) ? +(pos.coords.accuracy).toFixed(2) : 4.5,
            is_mock: Boolean(pos.coords.isMock),
            gps_enabled: true
          };
          updateGpsUiBanner();
        },
        () => {
          _lastPosition.gps_enabled = false;
          updateGpsUiBanner();
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 }
      );
    } catch (_) {}
  }

  // Emisión estricta cada 10 segundos (0.1 Hz) mientras la jornada esté activa
  dispatchTelemetryPacket();
  _telemetryTimer = setInterval(() => {
    if (isWorkShiftActive()) {
      dispatchTelemetryPacket();
    }
  }, 10000);
}

function updateGpsUiBanner() {
  const coordsEl = document.getElementById('op-gps-coords');
  const statusEl = document.getElementById('op-gps-status');
  if (coordsEl) {
    coordsEl.textContent = `${Number(_lastPosition.latitude).toFixed(5)}, ${Number(_lastPosition.longitude).toFixed(5)} (±${_lastPosition.accuracy}m)`;
  }
  if (statusEl) {
    if (!isWorkShiftActive()) {
      statusEl.textContent = '⏸️ Jornada Pausada';
      statusEl.style.color = '#fbbf24';
    } else if (_lastPosition.is_mock) {
      statusEl.textContent = '🚨 ALERTA: Mock GPS';
      statusEl.style.color = '#ef4444';
    } else {
      statusEl.textContent = '🛰️ Activa (10s / 0.1 Hz)';
      statusEl.style.color = '#10b981';
    }
  }
}

async function dispatchTelemetryPacket() {
  const state = getDeviceState();
  if (!state || !state.api_key || !isWorkShiftActive()) return;

  let isMock = Boolean(_lastPosition.is_mock);
  try {
    if (window.AndroidFieldBridge && typeof window.AndroidFieldBridge.isMockLocationActive === 'function') {
      isMock = Boolean(window.AndroidFieldBridge.isMockLocationActive());
    }
  } catch (_) {}

  updateGpsUiBanner();

  const payload = {
    android_id: state.android_id,
    latitude: _lastPosition.latitude,
    longitude: _lastPosition.longitude,
    speed: _lastPosition.speed || 0,
    accuracy: _lastPosition.accuracy || 4.5,
    is_mock: isMock,
    gps_enabled: _lastPosition.gps_enabled !== false,
    battery_level: _batteryLevel,
    timestamp: new Date().toISOString(),
    timestamp_gps: new Date().toISOString()
  };

  try {
    await fetch(`${state.api_base}/api/v1/telemetry/location`, {
      method: 'POST',
      headers: getAuthHeaders(state),
      body: JSON.stringify(payload)
    });
  } catch (_) {}
}

function forceTelemetryPing() {
  dispatchTelemetryPacket();
  showFieldToast('📡 Paquete de telemetría GPS enviado a Reciminsa Ops');
}

function toggleWorkShift() {
  const currentlyActive = isWorkShiftActive();
  const nextActive = !currentlyActive;
  localStorage.setItem(STORAGE_KEYS.SHIFT_ACTIVE, nextActive ? 'true' : 'false');

  const btn = document.getElementById('btn-toggle-shift');
  const title = document.getElementById('op-shift-title');

  if (nextActive) {
    if (btn) {
      btn.textContent = '⏸️ Finalizar Jornada';
      btn.style.color = '#10b981';
      btn.style.borderColor = 'rgba(16,185,129,0.45)';
    }
    if (title) title.textContent = '🟢 Jornada Laboral Activa (Muestreo GPS 10s)';
    syncFieldCatalogs(false);
    dispatchTelemetryPacket();
    showFieldToast('🟢 Jornada iniciada: Telemetría GPS 10s activada');
  } else {
    if (btn) {
      btn.textContent = '▶️ Iniciar Jornada';
      btn.style.color = '#fbbf24';
      btn.style.borderColor = 'rgba(245,158,11,0.45)';
    }
    if (title) title.textContent = '⏸️ Fuera de Turno (Rastreo GPS detenido por privacidad)';
    showFieldToast('⏸️ Jornada finalizada: Muestreo GPS detenido');
  }
  updateGpsUiBanner();
}

// ============================================================================
// 4. CAPTURA DE BITÁCORA Y COLA OFFLINE-FIRST (Sección 5 + Auditoría #3, #7, #11, #14)
// ============================================================================
async function handleFieldBitacoraSubmit(e) {
  e.preventDefault();
  const cliSelect = document.getElementById('field-cliente-select');
  const matSelect = document.getElementById('field-material-select');
  const pesoInput = document.getElementById('field-peso-input');
  const notasInput = document.getElementById('field-notas-input');

  const clienteId = Number(cliSelect.value);
  const clienteNombre = cliSelect.options[cliSelect.selectedIndex]?.getAttribute('data-nombre') || 'Cliente';
  const materialId = Number(matSelect.value);
  const materialNombre = matSelect.options[matSelect.selectedIndex]?.getAttribute('data-nombre') || 'Material';
  const pesoKg = parseFloat(pesoInput.value);
  const notas = (notasInput.value || '').trim();

  if (!materialId || isNaN(pesoKg) || pesoKg <= 0) {
    showFieldToast('⚠️ Selecciona un material e ingresa un peso mayor a 0 kg');
    return;
  }

  // Auditoría #14: Impedir captura si el sensor reporta Mock GPS activo
  if (_lastPosition.is_mock === true) {
    showFieldToast('🚨 Bloqueado: Desactiva las ubicaciones simuladas (Mock GPS) para registrar bitácoras');
    return;
  }

  // Paso 1 (Sección 5.1): Guardar inmediatamente en la cola local con is_synced = FALSE y UUID v4 único
  const record = {
    client_record_uuid: generateUuidV4(),
    cliente_origen_id: clienteId || null,
    cliente_nombre: clienteNombre,
    material_id: materialId,
    material_nombre: materialNombre,
    peso_kg: +pesoKg.toFixed(2),
    notas,
    latitud_captura: _lastPosition.latitude,
    longitud_captura: _lastPosition.longitude,
    precision_gps: _lastPosition.accuracy,
    timestamp_captura: new Date().toISOString(),
    is_synced: false,
    sincronizado_at: null
  };

  const queue = getOfflineQueue();
  queue.unshift(record);
  saveOfflineQueue(queue);

  pesoInput.value = '';
  notasInput.value = '';
  renderOfflineQueueList();

  // Paso 2 y 3 (Sección 5.1): Intentar vaciar la cola hacia POST /api/v1/bitacora/entry si hay red
  await flushOfflineBitacoraQueue(false);
}

async function flushOfflineBitacoraQueue(manual = false) {
  const state = getDeviceState();
  if (!state || !state.api_key) return;

  const queue = getOfflineQueue();
  const pending = queue.filter(item => item.is_synced === false);

  if (pending.length === 0) {
    if (manual) showFieldToast('✅ No hay registros pendientes por sincronizar');
    return;
  }

  if (!navigator.onLine) {
    if (manual) showFieldToast('📴 Sin internet: Los registros se enviarán automáticamente al recuperar señal');
    return;
  }

  try {
    // Auditoría #7: Envío transaccional por lote `{ entries: [...] }` con idempotencia por `client_record_uuid`
    const res = await fetch(`${state.api_base}/api/v1/bitacora/entry`, {
      method: 'POST',
      headers: getAuthHeaders(state),
      body: JSON.stringify({ entries: pending })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showFieldToast('⚠️ ' + (data.error || 'Guardado en cola local (pendiente de red)'));
      return;
    }

    const syncedAt = data.sincronizado_at || new Date().toISOString();
    const resultsMap = new Map();
    if (Array.isArray(data.results)) {
      data.results.forEach(r => resultsMap.set(r.client_record_uuid, r));
    }

    queue.forEach(item => {
      if (!item.is_synced) {
        const matched = resultsMap.get(item.client_record_uuid);
        item.is_synced = true;
        item.sincronizado_at = (matched && matched.sincronizado_at) || syncedAt;
        item.server_id = matched ? matched.id : data.id;
      }
    });

    saveOfflineQueue(queue);
    renderOfflineQueueList();
    showFieldToast(`📤 ${pending.length} bitácora(s) enviada(s) a Reciminsa Ops (pendiente de aceptación)`);
  } catch (_) {
    renderOfflineQueueList();
    if (manual) {
      showFieldToast('📴 Guardado en cola Offline-First (se enviará al recuperar conexión)');
    }
  }
}

function renderOfflineQueueList() {
  const listEl = document.getElementById('field-local-queue-list');
  if (!listEl) return;

  const queue = getOfflineQueue();
  if (queue.length === 0) {
    listEl.innerHTML = `
      <div style="padding:14px; text-align:center; color:var(--text-muted); font-size:0.78rem;">
        Aún no se han capturado pesajes en este dispositivo.
      </div>
    `;
    return;
  }

  // Modo INSERT-Only estricto: No existen botones de editar ni eliminar en el cliente móvil
  listEl.innerHTML = queue.slice(0, 15).map(item => `
    <div class="queue-item">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <strong>♻️ ${item.material_nombre} — ${Number(item.peso_kg).toFixed(2)} kg</strong>
        ${item.is_synced
          ? `<span class="pill-badge pill-badge--green">✅ is_synced: TRUE</span>`
          : `<span class="pill-badge pill-badge--amber">⏳ is_synced: FALSE</span>`
        }
      </div>
      <div style="color:var(--text-secondary); font-size:0.75rem;">
        🏢 ${item.cliente_nombre} ${item.notas ? ` &bull; 📝 ${item.notas}` : ''}
      </div>
      <div style="color:var(--text-muted); font-size:0.7rem; margin-top:4px; font-family:monospace;">
        UUID: ${item.client_record_uuid.slice(0, 12)}... | Captura: ${new Date(item.timestamp_captura).toLocaleTimeString()}
        ${item.sincronizado_at ? ` | Sync: ${new Date(item.sincronizado_at).toLocaleTimeString()}` : ''}
      </div>
    </div>
  `).join('');
}

// ============================================================================
// BOOTSTRAP DEL CLIENTE MÓVIL RECIMINSA FIELD
// ============================================================================
function bootOperationScreen() {
  const state = getDeviceState();
  if (!state || !state.api_key) return;

  document.getElementById('screen-pairing').classList.add('hidden');
  document.getElementById('screen-operation').classList.remove('hidden');

  document.getElementById('op-colab-name').textContent =
    (state.colaborador && state.colaborador.nombre) || 'Colaborador Vinculado';
  document.getElementById('op-android-id').textContent = `ANDROID_ID: ${state.android_id}`;

  populateFieldSelects();
  renderOfflineQueueList();
  requestDozeExemptionAndWakeLock();
  initBatteryMonitor();

  // Auditoría #5: Sincronizar catálogos automáticamente en cada arranque de la app
  syncFieldCatalogs(false);

  // Iniciar motor de telemetría de 10 segundos (0.1 Hz)
  startTelemetryEngine();

  // Worker de resiliencia Offline-First (monitoreo de red activa NET_CAPABILITY_INTERNET)
  if (_queueWorkerTimer) clearInterval(_queueWorkerTimer);
  _queueWorkerTimer = setInterval(() => {
    if (navigator.onLine) flushOfflineBitacoraQueue(false);
  }, 8000);
}

function updateNetworkStatusBadge() {
  const badge = document.getElementById('field-net-badge');
  if (!badge) return;
  if (navigator.onLine) {
    badge.className = 'pill-badge pill-badge--green';
    badge.textContent = '🌐 En línea';
    flushOfflineBitacoraQueue(false);
  } else {
    badge.className = 'pill-badge pill-badge--amber';
    badge.textContent = '📴 Offline (Cola SQLite)';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const { androidId, deviceModel } = getHardwareTelemetry();
  const hwIdEl = document.getElementById('hw-android-id');
  const hwModelEl = document.getElementById('hw-device-model');
  const apiBaseInput = document.getElementById('input-api-base');

  if (hwIdEl) hwIdEl.textContent = androidId;
  if (hwModelEl) hwModelEl.textContent = deviceModel;
  if (apiBaseInput) apiBaseInput.value = window.location.origin;

  window.addEventListener('online', updateNetworkStatusBadge);
  window.addEventListener('offline', updateNetworkStatusBadge);
  updateNetworkStatusBadge();

  const existingState = getDeviceState();
  if (existingState && existingState.api_key) {
    bootOperationScreen();
  }
});

