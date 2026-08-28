/* =============================================
   PORTAL DE CLIENTES - JavaScript
   Code + Device fingerprint access
   ============================================= */


(function() {
  'use strict';

  var API_BASE = window.location.origin;

  var codeScreen = document.getElementById('code-screen');
  var portalRoot = document.getElementById('portal-root');
  var codeInput = document.getElementById('portal-code-input');
  var codeError = document.getElementById('code-error');
  var codeBtn = document.getElementById('btn-access-portal');
  var deviceIdDisplay = document.getElementById('device-id-display');

  // ---- Device Fingerprint ----
  // Generates a deterministic hash from hardware/browser properties
  // This is NOT a MAC address, but a unique identifier per device+browser combo
  function generateDeviceFingerprint() {
    var components = [];

    // Screen
    components.push('S:' + screen.width + 'x' + screen.height + 'x' + screen.colorDepth);
    components.push('AV:' + screen.availWidth + 'x' + screen.availHeight);

    // Timezone
    components.push('TZ:' + Intl.DateTimeFormat().resolvedOptions().timeZone);
    components.push('TZO:' + new Date().getTimezoneOffset());

    // Language
    components.push('L:' + navigator.language);
    components.push('LS:' + (navigator.languages || []).join(','));

    // Platform
    components.push('P:' + navigator.platform);
    components.push('HW:' + navigator.hardwareConcurrency);
    components.push('DM:' + navigator.deviceMemory);

    // Touch
    components.push('T:' + navigator.maxTouchPoints);

    // WebGL renderer (GPU)
    try {
      var canvas = document.createElement('canvas');
      var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        var dbg = gl.getExtension('WEBGL_debug_renderer_info');
        if (dbg) {
          components.push('GPU:' + gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL));
          components.push('GPUV:' + gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL));
        }
      }
    } catch (e) {}

    // Canvas fingerprint
    try {
      var c2 = document.createElement('canvas');
      c2.width = 200; c2.height = 50;
      var ctx = c2.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 200, 50);
      ctx.fillStyle = '#069';
      ctx.fillText('DeviceID_FP!@#$%', 2, 15);
      components.push('CV:' + c2.toDataURL().slice(-50));
    } catch (e) {}

    // Hash all components
    var raw = components.join('|');
    return hashFNV1a(raw);
  }

  // FNV-1a hash → hex string
  function hashFNV1a(str) {
    var hash = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    // Generate a longer hash by running multiple rounds
    var h2 = hash;
    for (var j = 0; j < str.length; j++) {
      h2 ^= str.charCodeAt(str.length - 1 - j);
      h2 = (h2 * 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
  }

  // Get or cache device ID
  var DEVICE_ID = localStorage.getItem('_portal_device_id');
  if (!DEVICE_ID) {
    DEVICE_ID = generateDeviceFingerprint();
    localStorage.setItem('_portal_device_id', DEVICE_ID);
  }

  // Show device ID in the UI
  if (deviceIdDisplay) {
    deviceIdDisplay.textContent = DEVICE_ID;
  }

  // Format input
  codeInput.addEventListener('input', function() {
    this.value = this.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  });

  codeInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') accessPortal();
  });


  // ---- Session History ----
  var HISTORY_KEY = '_portal_session_history';

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch(e) { return []; }
  }

  function saveHistory(hist) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
  }

  function addToHistory(code, clientName) {
    var hist = getHistory();
    // Remove existing entry with same code
    hist = hist.filter(function(h) { return h.code !== code; });
    // Add to top
    hist.unshift({ code: code, name: clientName, lastAccess: new Date().toISOString() });
    // Keep max 20
    if (hist.length > 20) hist = hist.slice(0, 20);
    saveHistory(hist);
  }

  function toggleHistory() {
    var panel = document.getElementById('history-panel');
    var btn = document.getElementById('btn-toggle-history');
    if (panel.style.display === 'none') {
      panel.style.display = 'block';
      btn.classList.add('active');
      renderHistory();
    } else {
      panel.style.display = 'none';
      btn.classList.remove('active');
    }
  }

  function renderHistory() {
    var hist = getHistory();
    var listEl = document.getElementById('history-list');
    var actionsEl = document.getElementById('history-actions');
    var emptyEl = document.getElementById('history-empty');

    if (hist.length === 0) {
      listEl.innerHTML = '';
      actionsEl.style.display = 'none';
      emptyEl.style.display = 'block';
      return;
    }

    emptyEl.style.display = 'none';
    actionsEl.style.display = 'block';

    listEl.innerHTML = hist.map(function(h, i) {
      var dateStr = '';
      try {
        var d = new Date(h.lastAccess);
        dateStr = d.toLocaleDateString('es-DO', { day:'numeric', month:'short', year:'numeric' }) + ' ' + d.toLocaleTimeString('es-DO', { hour:'2-digit', minute:'2-digit' });
      } catch(e) {}

      return '<div class="history-item" onclick="useHistoryCode(\'' + h.code + '\')">' +
        '<div class="history-item-info">' +
          '<div class="history-item-name">' + (h.name || 'Cliente') + '</div>' +
          '<div class="history-item-code">' + h.code + '</div>' +
          (dateStr ? '<div class="history-item-date">' + dateStr + '</div>' : '') +
        '</div>' +
        '<button class="history-delete-btn" onclick="event.stopPropagation(); deleteHistoryItem(' + i + ')">✕</button>' +
      '</div>';
    }).join('');
  }

  function deleteHistoryItem(index) {
    var hist = getHistory();
    if (index >= 0 && index < hist.length) {
      hist.splice(index, 1);
      saveHistory(hist);
      renderHistory();
    }
  }

  function clearAllHistory() {
    if (!confirm('¿Eliminar todo el historial de sesiones?')) return;
    saveHistory([]);
    renderHistory();
  }

  function useHistoryCode(code) {
    codeInput.value = code;
    accessPortal();
  }

  function accessPortal() {
    var code = codeInput.value.trim().toUpperCase();
    codeError.style.display = 'none';

    if (!code || code.length < 5) {
      showError('⚠️ Ingresa un código válido.');
      return;
    }

    codeBtn.textContent = 'Verificando...';
    codeBtn.disabled = true;

    // Fetch from API with device ID
    fetch(API_BASE + '/api/portal/' + encodeURIComponent(code) + '?deviceId=' + encodeURIComponent(DEVICE_ID))
      .then(function(res) {
        if (res.status === 404) throw new Error('NOT_FOUND');
        if (res.status === 400) return res.json().then(function(d) { throw new Error(d.error || 'BAD_REQUEST'); });
        if (!res.ok) throw new Error('SERVER_ERROR');
        return res.json();
      })
      .then(function(data) {
        // Save to session history
        addToHistory(code, data.client ? data.client.name : 'Cliente');
        codeScreen.style.display = 'none';
        portalRoot.style.display = 'block';
        renderPortal(data, code);
      })
      .catch(function(err) {
        codeBtn.textContent = 'Acceder al Portal';
        codeBtn.disabled = false;

        if (err.message === 'NOT_FOUND') {
          showError('⚠️ Código no encontrado. Verifica tu código e intenta de nuevo.');
        } else if (err.message.includes('dispositivo')) {
          showError('⚠️ ' + err.message);
        } else {
          showError('⚠️ Error de conexión. Verifica que el servidor esté activo.');
        }
        codeInput.focus();
        codeInput.select();
      });
  }

  function showError(msg) {
    codeError.style.display = 'block';
    codeError.querySelector('span').textContent = msg;
  }


  /**
   * Main render function
   */
  function renderPortal(data, portalCode) {
    var client = data.client || {};
    var company = data.company || {};
    var invoices = data.invoices || [];
    var materials = data.materials || [];
    var eco = data.ecoStats || { totalWeight: 0, treesSaved: 0, co2Avoided: 0, waterSaved: 0, energySaved: 0 };
    var cur = data.currency || { symbol: 'RD$' };
    var generatedDate = data.generatedDate || '';

    document.title = 'Portal — ' + client.name + ' | ' + (company.name || 'EcoRecicla');

    // Invoice rows
    var invoiceRows = invoices.slice(0, 50).map(function(inv) {
      var date = (inv.date || inv.fecha || '').split('T')[0];
      var total = parseFloat(inv.total || inv.totalCompra || 0);
      var items = (inv.items || []).length;
      return '<tr>' +
        '<td>' + date + '</td>' +
        '<td>' + (inv.id || 'N/A') + '</td>' +
        '<td>' + items + ' material(es)</td>' +
        '<td class="text-right font-bold">' + cur.symbol + ' ' + total.toLocaleString('es-DO', {minimumFractionDigits:2}) + '</td>' +
      '</tr>';
    }).join('');

    // Material rows
    var materialRows = materials.map(function(mat) {
      return '<tr>' +
        '<td>' + mat.name + '</td>' +
        '<td class="text-right">' + mat.qty.toLocaleString() + '</td>' +
        '<td class="text-right">' + mat.peso.toLocaleString('es-DO', {maximumFractionDigits:1}) + ' kg</td>' +
        '<td class="text-right font-bold">' + cur.symbol + ' ' + mat.total.toLocaleString('es-DO', {minimumFractionDigits:2}) + '</td>' +
      '</tr>';
    }).join('');

    var totalOperated = 0;
    invoices.forEach(function(inv) {
      totalOperated += parseFloat(inv.total || inv.totalCompra || 0);
    });

    var html = '';

    // Back + device info bar
    html += '<div class="back-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">' +
      '<button class="back-btn" onclick="location.reload()">← Cambiar código</button>' +
      '<span style="font-size:0.65rem; color:var(--text-muted); font-family:monospace;">📱 ' + DEVICE_ID + '</span>' +
    '</div>';

    // Hero
    html += '<div class="hero">' +
      '<div class="hero-company">♻️ ' + (company.name || 'EcoRecicla') + (company.rnc ? ' — RNC: ' + company.rnc : '') + '</div>' +
      '<div class="hero-client">' + client.name + '</div>' +
      '<div class="hero-meta">' +
        (client.nit ? 'RNC/Cédula: <strong>' + client.nit + '</strong> · ' : '') +
        (client.type === 'empresa' ? '🏢 Empresa' : '👤 Persona') +
        ' · Código: <strong style="color:var(--primary-light);letter-spacing:1px;">' + portalCode + '</strong>' +
        ' · Actualizado: ' + generatedDate +
      '</div>' +
    '</div>';

    // Stats
    html += '<div class="stats-grid">' +
      '<div class="stat-card"><div class="stat-icon">🧾</div><div class="stat-value">' + invoices.length + '</div><div class="stat-label">Transacciones</div></div>' +
      '<div class="stat-card"><div class="stat-icon">⚖️</div><div class="stat-value">' + eco.totalWeight.toLocaleString('es-DO', {maximumFractionDigits:0}) + '</div><div class="stat-label">Kg Reciclados</div></div>' +
      '<div class="stat-card"><div class="stat-icon">🏷️</div><div class="stat-value">' + materials.length + '</div><div class="stat-label">Tipos de Material</div></div>' +
      '<div class="stat-card"><div class="stat-icon">💰</div><div class="stat-value money">' + cur.symbol + ' ' + totalOperated.toLocaleString('es-DO', {maximumFractionDigits:0}) + '</div><div class="stat-label">Total Operado</div></div>' +
    '</div>';

    // Eco Banner
    if (eco.totalWeight > 0) {
      html += '<div class="eco-banner">' +
        '<div class="eco-title">🌱 Certificado de Impacto Ecológico</div>' +
        '<div class="eco-subtitle">Gracias a la colaboración de <strong>' + client.name + '</strong>, se ha contribuido positivamente al medio ambiente:</div>' +
        '<div class="eco-grid">' +
          '<div class="eco-item"><div class="eco-val">🌳 ' + Math.ceil(eco.treesSaved) + '</div><div class="eco-lbl">Árboles Salvados</div></div>' +
          '<div class="eco-item"><div class="eco-val">💨 ' + Math.round(eco.co2Avoided).toLocaleString() + '</div><div class="eco-lbl">Kg CO₂ Evitado</div></div>' +
          '<div class="eco-item"><div class="eco-val">💧 ' + Math.round(eco.waterSaved).toLocaleString() + '</div><div class="eco-lbl">Litros Agua</div></div>' +
          '<div class="eco-item"><div class="eco-val">⚡ ' + Math.round(eco.energySaved).toLocaleString() + '</div><div class="eco-lbl">kWh Energía</div></div>' +
        '</div>' +
      '</div>';
    }

    // Materials Table
    if (materials.length > 0) {
      html += '<div class="section">' +
        '<div class="section-title">🏷️ Desglose por Material</div>' +
        '<table><thead><tr><th>Material</th><th class="text-right">Cantidad</th><th class="text-right">Peso</th><th class="text-right">Total</th></tr></thead>' +
        '<tbody>' + materialRows + '</tbody></table>' +
      '</div>';
    }

    // Invoices Table
    if (invoices.length > 0) {
      html += '<div class="section">' +
        '<div class="section-title">🧾 Historial de Transacciones</div>' +
        '<table><thead><tr><th>Fecha</th><th>ID</th><th>Materiales</th><th class="text-right">Total</th></tr></thead>' +
        '<tbody>' + invoiceRows + '</tbody></table>' +
      '</div>';
    } else {
      html += '<div class="section"><p style="color:var(--text-muted);">No hay transacciones registradas.</p></div>';
    }

    // Footer
    html += '<div class="footer">' +
      '<div class="footer-divider"></div>' +
      '<p>Portal generado por <a href="#">' + (company.name || 'EcoRecicla') + '</a></p>' +
      '<p style="margin-top:4px;">Última actualización: ' + generatedDate + '</p>' +
    '</div>';

    portalRoot.innerHTML = html;
  }

  // Expose functions globally
  window.accessPortal = accessPortal;
  window.toggleHistory = toggleHistory;
  window.clearAllHistory = clearAllHistory;
  window.deleteHistoryItem = deleteHistoryItem;
  window.useHistoryCode = useHistoryCode;

})();
