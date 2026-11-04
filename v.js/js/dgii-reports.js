/* =============================================
   DGII-REPORTS.JS – Módulo de Manejo DGII (Serie B)
   Formatos de Envío Oficiales: 606, 607 y 608
   Conexión exclusiva con los datos reales del usuario
   ============================================= */

// Estado activo del módulo
let currentDgiiTab = '606';
// Período activo inicial: Mes y año actual del sistema (o 'ALL' para todos los períodos)
let currentDgiiPeriod = new Date().toISOString().slice(0, 7); // 'AAAA-MM' o 'ALL'
let _dgiiUserManuallyChangedPeriod = false;

/**
 * Lee una lista de localStorage combinando la clave del usuario activo y la clave global de respaldo
 */
function _getDgiiStorageList(baseKey) {
  const combined = [];
  const seenIds = new Set();
  const keys = [];
  if (typeof userKey === 'function') {
    try { keys.push(userKey(baseKey)); } catch (_) {}
  }
  keys.push(baseKey);

  // También buscar cualquier clave en localStorage que empiece con baseKey por si pertenece a la sesión/familia activa
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k === baseKey || k.startsWith(baseKey + '_'))) {
        if (!keys.includes(k)) keys.push(k);
      }
    }
  } catch (_) {}

  keys.forEach(k => {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((item, idx) => {
          if (!item || typeof item !== 'object') return;
          const uid = item.id || `${k}_${item.date || ''}_${item.ncf || ''}_${item.amount || item.total || item.totalCompra || idx}`;
          if (!seenIds.has(String(uid))) {
            seenIds.add(String(uid));
            combined.push(item);
          }
        });
      }
    } catch (_) {}
  });

  return combined;
}

/**
 * Normaliza la fecha de cualquier registro a formato 'YYYY-MM-DD'
 */
function _normalizeDgiiDate(item) {
  if (!item) return '';
  let raw = item.date || item.fecha || item.paymentDate || item.createdAt || item.created_at || '';
  if (!raw || typeof raw !== 'string') return '';
  let clean = raw.trim();
  if (clean.includes('T')) clean = clean.split('T')[0];
  if (clean.includes(' ')) clean = clean.split(' ')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/.test(clean)) {
    const parts = clean.split(/[\/-]/);
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return clean;
}

/**
 * Verifica si un registro coincide con el período fiscal seleccionado ('AAAA-MM' o 'ALL')
 */
function _matchesDgiiPeriod(item) {
  if (!currentDgiiPeriod || currentDgiiPeriod === 'ALL') return true;
  const normDate = _normalizeDgiiDate(item);
  if (!normDate) return true;
  return normDate.startsWith(currentDgiiPeriod);
}

/**
 * Si el mes actual (ej. inicio de mes) no tiene registros pero existen compras/ventas en meses previos,
 * selecciona automáticamente el período más reciente con datos para que 606 y 607 no aparezcan vacíos.
 */
function _autoSelectMostRecentDgiiPeriodIfEmpty() {
  if (_dgiiUserManuallyChangedPeriod || currentDgiiPeriod === 'ALL') return;

  const hasCurrent606 = getDgii606Records().length > 0;
  const hasCurrent607 = getDgii607Records().length > 0;
  if (hasCurrent606 || hasCurrent607) return;

  const allItems = [
    ..._getDgiiStorageList('recim_invoices'),
    ..._getDgiiStorageList('recim_egresos'),
    ..._getDgiiStorageList('recim_ingresos'),
    ..._getDgiiStorageList('recim_credit_notes'),
    ..._getDgiiStorageList('recim_debit_notes'),
    ..._getDgiiStorageList('recim_batches')
  ];

  const periods = new Set();
  allItems.forEach(it => {
    const d = _normalizeDgiiDate(it);
    if (d && /^\d{4}-\d{2}/.test(d)) {
      periods.add(d.slice(0, 7));
    }
  });

  if (periods.size > 0) {
    const sorted = Array.from(periods).sort().reverse();
    currentDgiiPeriod = sorted[0];
  }
}

/**
 * Obtiene el RNC de la empresa del usuario actual (desde Ajustes o configuración compartida)
 */
function getDgiiCompanyRnc() {
  const settings = (typeof getSettings === 'function') ? getSettings() : {};
  let rnc = settings.companyRNC || settings.rnc || settings.companyRnc || '';
  if (!rnc) {
    try {
      const sharedKey = typeof userKey === 'function' ? userKey('recim_company_shared_settings') : 'recim_company_shared_settings';
      const shared = JSON.parse(localStorage.getItem(sharedKey) || localStorage.getItem('recim_shared_company_settings') || '{}');
      if (shared.companyRNC) rnc = shared.companyRNC;
    } catch (_) {}
  }
  return rnc ? String(rnc).replace(/\D/g, '') : '';
}

/**
 * Función principal llamada por el router para renderizar la página de Manejo DGII
 */
function renderManejoDgiiPage(container) {
  if (!container) container = document.getElementById('page-manejo_dgii');
  if (!container) return;

  _autoSelectMostRecentDgiiPeriodIfEmpty();

  const companyRnc = getDgiiCompanyRnc();
  const rncDisplay = companyRnc 
    ? `<code style="font-weight:800; color:#10b981; font-size:0.95rem;">${companyRnc}</code>`
    : `<span style="font-size:0.8rem; color:#f59e0b; font-weight:600;">⚠️ Sin RNC (configurar en Ajustes)</span>`;

  const monthValue = currentDgiiPeriod === 'ALL' ? new Date().toISOString().slice(0, 7) : currentDgiiPeriod;

  container.innerHTML = `
    <div class="dgii-header-container">
      <div class="dgii-header-text">
        <h2 class="section-title">🏛️ Manejo DGII – Comprobantes Serie B</h2>
        <p class="section-subtitle">Formatos oficiales de envío mensual a la DGII basados en las operaciones reales de la empresa</p>
      </div>
      <div class="dgii-meta-panel">
        <div class="dgii-rnc-card" title="RNC Emisor configurado en Ajustes">
          <span style="font-size: 1rem;">🛡️</span>
          <span class="dgii-rnc-label">RNC EMISOR:</span>
          ${rncDisplay}
        </div>
        <div class="dgii-period-card" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span style="font-size: 1rem;">📅</span>
          <label class="dgii-period-label" for="dgii-period-picker">Período Fiscal:</label>
          <input type="month" id="dgii-period-picker" class="dgii-period-input" value="${monthValue}" onchange="onDgiiPeriodChange(this.value)" />
          <button type="button" class="btn-secondary" onclick="toggleDgiiAllPeriods()" style="padding:4px 10px; font-size:0.76rem; font-weight:700; border-radius:6px; ${currentDgiiPeriod === 'ALL' ? 'background:#10b981; color:#fff; border-color:#10b981;' : ''}">
            ${currentDgiiPeriod === 'ALL' ? '✓ Todos los meses' : 'Ver Todos'}
          </button>
        </div>
      </div>
    </div>

    <!-- Barra de Pestañas Serie B DGII (606, 607, 608) -->
    <div class="dgii-tabs-bar">
      <button class="dgii-tab-btn ${currentDgiiTab === '606' ? 'active' : ''}" data-tab="606" onclick="switchDgiiTab('606')">
        <span style="font-weight: 800;">606</span>
        <span class="dgii-tab-sublabel">Compras</span>
      </button>
      <button class="dgii-tab-btn ${currentDgiiTab === '607' ? 'active' : ''}" data-tab="607" onclick="switchDgiiTab('607')">
        <span style="font-weight: 800;">607</span>
        <span class="dgii-tab-sublabel">Ventas</span>
      </button>
      <button class="dgii-tab-btn ${currentDgiiTab === '608' ? 'active' : ''}" data-tab="608" onclick="switchDgiiTab('608')">
        <span style="font-weight: 800;">608</span>
        <span class="dgii-tab-sublabel">Anulados</span>
      </button>
    </div>

    <!-- Contenedor del contenido del reporte activo -->
    <div id="dgii-tab-content-container"></div>
  `;

  renderCurrentDgiiContent();
}

function onDgiiPeriodChange(val) {
  if (val) {
    _dgiiUserManuallyChangedPeriod = true;
    currentDgiiPeriod = val;
    renderManejoDgiiPage();
  }
}

function toggleDgiiAllPeriods() {
  _dgiiUserManuallyChangedPeriod = true;
  if (currentDgiiPeriod === 'ALL') {
    currentDgiiPeriod = new Date().toISOString().slice(0, 7);
    _dgiiUserManuallyChangedPeriod = false;
    _autoSelectMostRecentDgiiPeriodIfEmpty();
  } else {
    currentDgiiPeriod = 'ALL';
  }
  renderManejoDgiiPage();
}
window.toggleDgiiAllPeriods = toggleDgiiAllPeriods;

function switchDgiiTab(tabKey) {
  currentDgiiTab = tabKey;
  document.querySelectorAll('.dgii-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabKey);
  });
  renderCurrentDgiiContent();
}

function renderCurrentDgiiContent() {
  const container = document.getElementById('dgii-tab-content-container');
  if (!container) return;

  switch (currentDgiiTab) {
    case '606': renderDgii606(container); break;
    case '607': renderDgii607(container); break;
    case '608': renderDgii608(container); break;
    default: renderDgii606(container); break;
  }
}

/**
 * Botón Recargar: Escanea toda la aplicación en busca de datos asociados a la secuencia seleccionada
 */
async function reloadDgiiSequence(seq) {
  showToast(`🔍 Buscando datos de la secuencia ${seq} en toda la app...`, 'info');

  // Si existe sincronización central en la nube, hacer pull primero
  try {
    if (typeof window.syncPullData === 'function') {
      await window.syncPullData();
    } else if (typeof syncPullData === 'function') {
      await syncPullData();
    }
  } catch (_) {}

  // Si es 608, auto-escanear documentos cancelados en toda la app
  if (seq === '608') {
    autoScanCancelledDocuments();
  }

  // Si el período activo está vacío pero hay registros en otro mes, seleccionarlo automáticamente
  let count = 0;
  if (seq === '606') count = getDgii606Records().length;
  else if (seq === '607') count = getDgii607Records().length;
  else if (seq === '608') count = getDgii608Records().length;

  if (count === 0 && currentDgiiPeriod !== 'ALL') {
    _dgiiUserManuallyChangedPeriod = false;
    _autoSelectMostRecentDgiiPeriodIfEmpty();
    if (seq === '606') count = getDgii606Records().length;
    else if (seq === '607') count = getDgii607Records().length;
    else if (seq === '608') count = getDgii608Records().length;
    if (count === 0) {
      currentDgiiPeriod = 'ALL';
      if (seq === '606') count = getDgii606Records().length;
      else if (seq === '607') count = getDgii607Records().length;
      else if (seq === '608') count = getDgii608Records().length;
    }
  }

  // Re-renderizar la página completa para sincronizar el selector de período y la tabla
  renderManejoDgiiPage();

  const periodLabel = currentDgiiPeriod === 'ALL' ? 'todos los períodos' : currentDgiiPeriod;
  showToast(`✅ Secuencia ${seq} recargada: ${count} registro(s) encontrados (${periodLabel})`, 'success');
}

/**
 * Auto-escanea facturas, notas de crédito y notas de débito que hayan sido marcadas como anuladas
 */
function autoScanCancelledDocuments() {
  const cancelled = _getDgiiStorageList('recim_ncf_cancelled');
  const existingNcfs = new Set(cancelled.map(c => (c.ncf || '').trim().toUpperCase()));

  const invoices = _getDgiiStorageList('recim_invoices');
  const creditNotes = _getDgiiStorageList('recim_credit_notes');
  const debitNotes = _getDgiiStorageList('recim_debit_notes');

  let added = false;
  [...invoices, ...creditNotes, ...debitNotes].forEach(item => {
    const isCancelled = item.status === 'anulado' || item.status === 'anulada' || item.isCancelled === true || item.cancelled === true;
    const ncf = (item.ncf || '').trim().toUpperCase();
    if (isCancelled && ncf && !existingNcfs.has(ncf)) {
      cancelled.push({
        ncf: ncf,
        code: '02',
        reason: '02: Errores de impresión / Corrección',
        date: _normalizeDgiiDate(item) || new Date().toISOString().slice(0, 10),
        notes: `Auto-detectado de ${item.id || 'documento anulado'}`
      });
      existingNcfs.add(ncf);
      added = true;
    }
  });

  if (added) {
    const key = typeof userKey === 'function' ? userKey('recim_ncf_cancelled') : 'recim_ncf_cancelled';
    localStorage.setItem(key, JSON.stringify(cancelled));
  }
}

/**
 * Busca el RNC/Cédula de un cliente o proveedor en el directorio de clientes registrados
 */
function _resolvePartyRnc(partyId, partyName, directRnc) {
  if (directRnc && String(directRnc).trim()) return String(directRnc).trim();
  const clients = _getDgiiStorageList('recim_clients');
  if (partyId) {
    const foundById = clients.find(c => String(c.id) === String(partyId));
    if (foundById && foundById.nit) return String(foundById.nit).trim();
  }
  if (partyName) {
    const normName = String(partyName).trim().toLowerCase();
    const foundByName = clients.find(c => c.name && String(c.name).trim().toLowerCase() === normName);
    if (foundByName && foundByName.nit) return String(foundByName.nit).trim();
  }
  return '';
}

// =============================================
// 1. FORMATO 606: COMPRAS DE BIENES Y SERVICIOS
// =============================================

/**
 * Obtiene las compras reales del usuario actual para el período seleccionado
 * Escanea: Bitácoras de compra (en recim_invoices con type='basica' y recim_batches) + Egresos (recim_egresos)
 */
function getDgii606Records() {
  const egresos = _getDgiiStorageList('recim_egresos');
  const allInvoices = _getDgiiStorageList('recim_invoices');
  const legacyBatches = _getDgiiStorageList('recim_batches');

  // Bitácoras reales guardadas en recim_invoices (type === 'basica' o id con prefijo 'BIT-') + legacy recim_batches
  const bitacorasFromInvoices = allInvoices.filter(inv => inv && (inv.type === 'basica' || String(inv.id || '').startsWith('BIT-')));
  const bitacoras = [...bitacorasFromInvoices, ...legacyBatches];
  const bitacoraIds = new Set(bitacoras.map(b => String(b.id || '')).filter(Boolean));

  // 1. Bitácoras de compra de material reciclado a proveedores / recicladores
  const comprasBitacoras = bitacoras.filter(b => _matchesDgiiPeriod(b)).map((b, idx) => {
    const normDate = _normalizeDgiiDate(b);
    const itemsCost = (b.items || []).reduce((acc, it) => {
      const itemCost = parseFloat(it.totalCompra ?? it.cost ?? ((parseFloat(it.qty) || 0) * (parseFloat(it.priceBuy || it.uprice) || 0))) || 0;
      return acc + itemCost;
    }, 0);
    const totalCost = parseFloat(b.totalCompra) || itemsCost || parseFloat(b.amount) || 0;

    const supplierName = b.supplier || b.client || b.company || 'Proveedor de Reciclaje';
    const resolvedNit = _resolvePartyRnc(b.clientId || b.supplierId, supplierName, b.supplierNit || b.nit || b.rnc);
    const rawNit = resolvedNit.replace(/\D/g, '');
    let tipoId = 99;
    if (rawNit.length === 9) tipoId = 1;
    else if (rawNit.length === 11) tipoId = 2;

    return {
      rnc_cedula: resolvedNit || b.supplierId || b.id || `PROV-${(idx + 1).toString().padStart(4, '0')}`,
      nombre_suplidor: supplierName,
      tipo_id: tipoId,
      ncf: b.ncf || '',
      ncf_modificado: '',
      tipo_bienes_servicios: '02',
      fecha_comprobante: normDate.replace(/\D/g, ''),
      fecha_pago: normDate.replace(/\D/g, ''),
      monto_servicios: 0,
      monto_bienes: totalCost,
      total_facturado: totalCost,
      itbis_facturado: parseFloat(b.taxAmount || b.itbis) || 0,
      itbis_retenido: 0,
      retencion_renta: 0,
      propina_legal: 0,
      monto_isc: 0,
      monto_otros_imp: 0,
      itbis_sujeto_prop: 0,
      itbis_llevado_costo: 0,
      tipo_gasto: '09', // 09 = Compras y Gastos que forman parte del Costo de Venta
      origen: 'BITACORA',
      forma_pago: '01'
    };
  }).filter(r => r.total_facturado > 0);

  // 2. Egresos y gastos operacionales (excluyendo asientos automáticos duplicados de bitácoras ya listadas)
  const comprasEgresos = egresos.filter(e => {
    if (!_matchesDgiiPeriod(e)) return false;
    if (e.ref && bitacoraIds.has(String(e.ref))) return false;
    const conceptStr = String(e.concept || '');
    for (const bitId of bitacoraIds) {
      if (bitId && conceptStr.includes(bitId)) return false;
    }
    return true;
  }).map((e, idx) => {
    const normDate = _normalizeDgiiDate(e);
    const payDate = _normalizeDgiiDate({ date: e.paymentDate }) || normDate;
    const supplierName = e.supplier || e.beneficiary || e.concept || 'Suplidor Comercial';
    const resolvedRnc = _resolvePartyRnc(e.supplierId || e.clientId, supplierName, e.rnc || e.supplierNit || e.supplierRnc || e.nit);
    const rawRnc = resolvedRnc.replace(/\D/g, '');
    let tipoId = 99;
    if (rawRnc.length === 9) tipoId = 1;
    else if (rawRnc.length === 11) tipoId = 2;

    const montoTotal = parseFloat(e.amount || e.total) || 0;
    const itbisFact = parseFloat(e.itbis || e.taxAmount) || 0;
    const servAmount = parseFloat(e.serviceAmount) || 0;
    const bienesAmount = servAmount > 0 ? Math.max(0, montoTotal - servAmount) : montoTotal;

    return {
      rnc_cedula: resolvedRnc || (e.supplierId ? 'PROV-' + e.supplierId : `PROV-${(idx + 1).toString().padStart(3, '0')}`),
      nombre_suplidor: supplierName,
      tipo_id: tipoId,
      ncf: e.ncf || e.invoiceNumber || '',
      ncf_modificado: e.ncfModified || '',
      tipo_bienes_servicios: e.expenseType || '02',
      fecha_comprobante: normDate.replace(/\D/g, ''),
      fecha_pago: payDate.replace(/\D/g, ''),
      monto_servicios: servAmount,
      monto_bienes: bienesAmount,
      total_facturado: montoTotal,
      itbis_facturado: itbisFact,
      itbis_retenido: parseFloat(e.itbisRetenido) || 0,
      retencion_renta: parseFloat(e.isrRetenido) || 0,
      propina_legal: parseFloat(e.tip) || 0,
      monto_isc: parseFloat(e.isc) || 0,
      monto_otros_imp: 0,
      itbis_sujeto_prop: 0,
      itbis_llevado_costo: 0,
      tipo_gasto: e.expenseType || '02',
      origen: e.origin || e.category || 'EGRESO',
      forma_pago: e.paymentMethodCode || '01'
    };
  }).filter(r => r.total_facturado > 0);

  return [...comprasBitacoras, ...comprasEgresos];
}

function renderDgii606(container) {
  const records = getDgii606Records();

  const totalFacturado = records.reduce((acc, r) => acc + (r.total_facturado || r.monto_bienes || 0), 0);
  const totalBienes = records.reduce((acc, r) => acc + (r.monto_bienes || 0), 0);
  const totalServicios = records.reduce((acc, r) => acc + (r.monto_servicios || 0), 0);
  const totalItbis = records.reduce((acc, r) => acc + (r.itbis_facturado || 0), 0);

  container.innerHTML = `
    <div class="card" style="margin-bottom: 20px; width:100%; box-sizing:border-box;">
      <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px;">
        <div style="min-width:240px; flex:1;">
          <h3 class="card-title">Formato 606: Compras de Bienes y Servicios</h3>
          <p class="card-subtitle">Período Fiscal: <b>${currentDgiiPeriod}</b> | Total Registros: <b>${records.length}</b></p>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <button class="btn-secondary" onclick="reloadDgiiSequence('606')" type="button" style="padding:8px 14px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px; font-weight:600; border-color:rgba(16,185,129,0.3); color:#10b981;" title="Escanear toda la app en busca de compras de este período">
            <span style="font-size:1rem;">🔄</span> Recargar
          </button>
          <button class="btn-primary" onclick="exportDgii606Excel()" type="button" style="padding:8px 14px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px;">
            <span>📊</span> Exportar Excel (Modelo 606)
          </button>
          <button class="btn-secondary" onclick="exportDgiiTxt('606')" type="button" style="padding:8px 14px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px;">
            <span>📄</span> Generar TXT DGII (Serie B)
          </button>
        </div>
      </div>

      <!-- Resumen Métricas 606 -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-bottom:20px; width:100%; box-sizing:border-box;">
        <div style="background:var(--clr-surface-2); padding:14px; border-radius:var(--r-md); border-left:4px solid #ef4444;">
          <div style="font-size:0.75rem; color:var(--clr-text-muted); text-transform:uppercase; font-weight:700;">Total Facturado</div>
          <div style="font-size:1.25rem; font-weight:800; color:#ef4444; margin-top:4px;">RD$ ${totalFacturado.toLocaleString('es-DO', {minimumFractionDigits:2})}</div>
        </div>
        <div style="background:var(--clr-surface-2); padding:14px; border-radius:var(--r-md); border-left:4px solid #f59e0b;">
          <div style="font-size:0.75rem; color:var(--clr-text-muted); text-transform:uppercase; font-weight:700;">Monto en Bienes</div>
          <div style="font-size:1.25rem; font-weight:800; color:#f59e0b; margin-top:4px;">RD$ ${totalBienes.toLocaleString('es-DO', {minimumFractionDigits:2})}</div>
        </div>
        <div style="background:var(--clr-surface-2); padding:14px; border-radius:var(--r-md); border-left:4px solid #3b82f6;">
          <div style="font-size:0.75rem; color:var(--clr-text-muted); text-transform:uppercase; font-weight:700;">ITBIS Facturado</div>
          <div style="font-size:1.25rem; font-weight:800; color:#3b82f6; margin-top:4px;">RD$ ${totalItbis.toLocaleString('es-DO', {minimumFractionDigits:2})}</div>
        </div>
        <div style="background:var(--clr-surface-2); padding:14px; border-radius:var(--r-md); border-left:4px solid #10b981;">
          <div style="font-size:0.75rem; color:var(--clr-text-muted); text-transform:uppercase; font-weight:700;">Comprobantes</div>
          <div style="font-size:1.25rem; font-weight:800; color:#10b981; margin-top:4px;">${records.length}</div>
        </div>
      </div>

      <!-- Tabla de Datos 606 -->
      <div class="table-responsive">
        <table class="table" style="width:100%; min-width:920px; font-size:0.83rem;">
          <thead>
            <tr>
              <th>RNC / Cédula</th>
              <th>Nombre Suplidor</th>
              <th>Tipo ID</th>
              <th>NCF (Serie B)</th>
              <th>Tipo Bienes/Serv.</th>
              <th>Fecha Comp.</th>
              <th style="text-align:right;">Monto Bienes</th>
              <th style="text-align:right;">Monto Servicios</th>
              <th style="text-align:right;">ITBIS Facturado</th>
              <th>Origen</th>
              <th style="text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${records.length === 0 ? `
              <tr><td colspan="11" style="text-align:center; padding:36px; color:var(--clr-text-muted); font-size:0.92rem;">🔍 No hay compras ni egresos registrados para este usuario en el período fiscal <b>${currentDgiiPeriod}</b>.<br><small style="opacity:0.75;">Tus egresos y bitácoras de recogida del mes aparecerán aquí de forma automática al presionar "Recargar".</small></td></tr>
            ` : records.map(r => `
              <tr>
                <td><b>${r.rnc_cedula}</b></td>
                <td>${r.nombre_suplidor || '---'}</td>
                <td><span class="badge" style="background:rgba(255,255,255,0.06); font-size:0.75rem;">${r.tipo_id === 1 ? 'RNC (1)' : (r.tipo_id === 2 ? 'Cédula (2)' : 'Otro (99)')}</span></td>
                <td>${r.ncf ? `<code style="color:#10b981; font-weight:700;">${r.ncf}</code>` : `<span style="color:var(--clr-text-muted); font-style:italic;">Sin NCF</span>`}</td>
                <td><small style="color:var(--clr-text-muted);">${r.tipo_bienes_servicios || '02'}</small></td>
                <td>${r.fecha_comprobante}</td>
                <td style="text-align:right; color:#f59e0b;">RD$ ${(r.monto_bienes || 0).toLocaleString('es-DO', {minimumFractionDigits:2})}</td>
                <td style="text-align:right;">RD$ ${(r.monto_servicios || 0).toLocaleString('es-DO', {minimumFractionDigits:2})}</td>
                <td style="text-align:right; color:#3b82f6; font-weight:600;">RD$ ${(r.itbis_facturado || 0).toLocaleString('es-DO', {minimumFractionDigits:2})}</td>
                <td><span class="badge" style="background:rgba(16,185,129,0.12); color:#10b981;">${r.origen || 'EGRESO'}</span></td>
                <td style="text-align:right; font-weight:700;">RD$ ${(r.total_facturado || (r.monto_bienes + r.monto_servicios) || 0).toLocaleString('es-DO', {minimumFractionDigits:2})}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// =============================================
// 2. FORMATO 607: VENTAS DE BIENES Y SERVICIOS
// =============================================

/**
 * Obtiene las ventas reales del usuario actual para el período seleccionado
 * Escanea: Facturas de venta, Ventas en Bitácoras, Notas de Crédito emitidas, Notas de Débito e Ingresos
 */
function getDgii607Records() {
  const invoices = _getDgiiStorageList('recim_invoices');
  const creditNotes = _getDgiiStorageList('recim_credit_notes');
  const debitNotes = _getDgiiStorageList('recim_debit_notes');
  const ingresos = _getDgiiStorageList('recim_ingresos');

  const includedDocIds = new Set();

  // 1. Facturas de venta y Bitácoras con monto de venta proyectada/facturada
  const listInvoices = invoices.filter(inv => _matchesDgiiPeriod(inv)).map(inv => {
    const isBitacora = inv.type === 'basica' || String(inv.id || '').startsWith('BIT-');
    if (inv.id) includedDocIds.add(String(inv.id));

    const clientName = inv.company || inv.client || 'Cliente Contado';
    const resolvedNit = _resolvePartyRnc(inv.clientId, clientName, inv.nit || inv.rnc);
    const rawNit = resolvedNit.replace(/\D/g, '');
    let tipoId = 1;
    if (rawNit.length === 11) tipoId = 2;
    else if (!rawNit || rawNit === '000000000') tipoId = 3;

    const itbisFact = parseFloat(inv.taxAmount || inv.itbis) || 0;
    let montoFact = 0;
    if (isBitacora) {
      const itemsVenta = (inv.items || []).reduce((acc, it) => {
        const itemSell = parseFloat(it.totalVenta ?? ((parseFloat(it.qty) || 0) * (parseFloat(it.priceSell || it.uprice) || 0))) || 0;
        return acc + itemSell;
      }, 0);
      montoFact = parseFloat(inv.totalVenta) || itemsVenta || 0;
    } else {
      const rawTotal = parseFloat(inv.total ?? inv.totalVenta ?? 0) || 0;
      montoFact = parseFloat(inv.subtotal) || Math.max(0, rawTotal - itbisFact);
    }

    const normDate = _normalizeDgiiDate(inv);
    const retDate = _normalizeDgiiDate({ date: inv.retentionDate });

    return {
      rnc_cedula_cliente: resolvedNit || (tipoId === 3 ? '000000000' : ''),
      nombre_cliente: clientName,
      tipo_identificacion: tipoId,
      ncf: inv.ncf || '',
      ncf_modificado: inv.ncfModified || inv.ncfMod || '',
      tipo_ingreso: '01',
      fecha_comprobante: normDate.replace(/\D/g, ''),
      fecha_retencion: retDate.replace(/\D/g, ''),
      monto_facturado: montoFact,
      itbis_facturado: itbisFact,
      itbis_retenido_terceros: parseFloat(inv.retItbisAmount) || 0,
      itbis_percibido: 0,
      retencion_renta: parseFloat(inv.retIsrAmount) || 0,
      isr_percibido: 0,
      monto_isc: parseFloat(inv.iscAmount) || 0,
      monto_otros_imp: 0,
      monto_propina_legal: 0,
      forma_pago: isBitacora ? 'Bitácora (Venta)' : (inv.payMethod || inv.paymentMethod || 'Efectivo'),
      total: parseFloat(inv.total) || (montoFact + itbisFact)
    };
  }).filter(r => r.monto_facturado > 0 || r.total > 0);

  // 2. Notas de Crédito emitidas (B04 / E34)
  const listCreditNotes = creditNotes.filter(cn => _matchesDgiiPeriod(cn)).map(cn => {
    if (cn.id) includedDocIds.add(String(cn.id));
    const clientName = cn.company || cn.client || 'Cliente';
    const resolvedNit = _resolvePartyRnc(cn.clientId, clientName, cn.nit || cn.rnc);
    const rawNit = resolvedNit.replace(/\D/g, '');
    let tipoId = 1;
    if (rawNit.length === 11) tipoId = 2;
    else if (!rawNit || rawNit === '000000000') tipoId = 3;

    const normDate = _normalizeDgiiDate(cn);
    const montoFact = parseFloat(cn.subtotal || cn.amount || cn.total || 0);
    const itbisFact = parseFloat(cn.taxAmount || cn.itbis || 0);

    return {
      rnc_cedula_cliente: resolvedNit || (tipoId === 3 ? '000000000' : ''),
      nombre_cliente: clientName,
      tipo_identificacion: tipoId,
      ncf: cn.ncf || '',
      ncf_modificado: cn.ncfMod || cn.invoiceNcf || '',
      tipo_ingreso: '01',
      fecha_comprobante: normDate.replace(/\D/g, ''),
      fecha_retencion: '',
      monto_facturado: montoFact,
      itbis_facturado: itbisFact,
      itbis_retenido_terceros: 0,
      itbis_percibido: 0,
      retencion_renta: 0,
      isr_percibido: 0,
      monto_isc: 0,
      monto_otros_imp: 0,
      monto_propina_legal: 0,
      forma_pago: 'Nota de Crédito',
      total: montoFact + itbisFact
    };
  });

  // 3. Notas de Débito emitidas (B03 / E33)
  const listDebitNotes = debitNotes.filter(dn => _matchesDgiiPeriod(dn)).map(dn => {
    if (dn.id) includedDocIds.add(String(dn.id));
    const clientName = dn.company || dn.client || 'Cliente';
    const resolvedNit = _resolvePartyRnc(dn.clientId, clientName, dn.nit || dn.rnc);
    const rawNit = resolvedNit.replace(/\D/g, '');
    let tipoId = 1;
    if (rawNit.length === 11) tipoId = 2;
    else if (!rawNit || rawNit === '000000000') tipoId = 3;

    const normDate = _normalizeDgiiDate(dn);
    const montoFact = parseFloat(dn.subtotal || dn.amount || dn.total || 0);
    const itbisFact = parseFloat(dn.taxAmount || dn.itbis || 0);

    return {
      rnc_cedula_cliente: resolvedNit || (tipoId === 3 ? '000000000' : ''),
      nombre_cliente: clientName,
      tipo_identificacion: tipoId,
      ncf: dn.ncf || '',
      ncf_modificado: dn.ncfMod || dn.invoiceNcf || '',
      tipo_ingreso: '01',
      fecha_comprobante: normDate.replace(/\D/g, ''),
      fecha_retencion: '',
      monto_facturado: montoFact,
      itbis_facturado: itbisFact,
      itbis_retenido_terceros: 0,
      itbis_percibido: 0,
      retencion_renta: 0,
      isr_percibido: 0,
      monto_isc: 0,
      monto_otros_imp: 0,
      monto_propina_legal: 0,
      forma_pago: dn.payMethod || 'Efectivo',
      total: montoFact + itbisFact
    };
  });

  // 4. Ingresos directos registrados en Finanzas (excluyendo asientos automáticos ya contados por Factura/ND)
  const listIngresos = ingresos.filter(ing => {
    if (!_matchesDgiiPeriod(ing)) return false;
    if (ing.ref && includedDocIds.has(String(ing.ref))) return false;
    const conceptStr = String(ing.concept || '');
    for (const docId of includedDocIds) {
      if (docId && conceptStr.includes(docId)) return false;
    }
    return true;
  }).map(ing => {
    const normDate = _normalizeDgiiDate(ing);
    const clientName = ing.client || ing.company || ing.concept || 'Ingreso Comercial';
    const resolvedNit = _resolvePartyRnc(ing.clientId, clientName, ing.rnc || ing.nit);
    const rawNit = resolvedNit.replace(/\D/g, '');
    let tipoId = 3;
    if (rawNit.length === 9) tipoId = 1;
    else if (rawNit.length === 11) tipoId = 2;

    const montoFact = parseFloat(ing.amount || ing.total || 0);
    const itbisFact = parseFloat(ing.itbis || ing.taxAmount || 0);

    return {
      rnc_cedula_cliente: resolvedNit || '000000000',
      nombre_cliente: clientName,
      tipo_identificacion: tipoId,
      ncf: ing.ncf || '',
      ncf_modificado: '',
      tipo_ingreso: '01',
      fecha_comprobante: normDate.replace(/\D/g, ''),
      fecha_retencion: '',
      monto_facturado: montoFact,
      itbis_facturado: itbisFact,
      itbis_retenido_terceros: 0,
      itbis_percibido: 0,
      retencion_renta: 0,
      isr_percibido: 0,
      monto_isc: 0,
      monto_otros_imp: 0,
      monto_propina_legal: 0,
      forma_pago: ing.payMethod || ing.category || 'Efectivo',
      total: montoFact + itbisFact
    };
  }).filter(r => r.monto_facturado > 0);

  return [...listInvoices, ...listCreditNotes, ...listDebitNotes, ...listIngresos];
}

function renderDgii607(container) {
  const records = getDgii607Records();

  const totalVentas = records.reduce((a, b) => a + (b.monto_facturado || 0), 0);
  const totalItbis = records.reduce((a, b) => a + (b.itbis_facturado || 0), 0);
  const totalRetItbis = records.reduce((a, b) => a + (b.itbis_retenido_terceros || 0), 0);

  container.innerHTML = `
    <div class="card" style="margin-bottom: 20px; width:100%; box-sizing:border-box;">
      <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px;">
        <div style="min-width:240px; flex:1;">
          <h3 class="card-title">Formato 607: Ventas de Bienes y Servicios</h3>
          <p class="card-subtitle">Período Fiscal: <b>${currentDgiiPeriod}</b> | Facturas emitidas: <b>${records.length}</b></p>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <button class="btn-secondary" onclick="reloadDgiiSequence('607')" type="button" style="padding:8px 14px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px; font-weight:600; border-color:rgba(16,185,129,0.3); color:#10b981;" title="Escanear toda la app en busca de ventas de este período">
            <span style="font-size:1rem;">🔄</span> Recargar
          </button>
          <button class="btn-primary" onclick="exportDgii607Excel()" type="button" style="padding:8px 14px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px;">
            <span>📊</span> Exportar Excel (Modelo 607)
          </button>
          <button class="btn-secondary" onclick="exportDgiiTxt('607')" type="button" style="padding:8px 14px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px;">
            <span>📄</span> Generar TXT DGII (Serie B)
          </button>
        </div>
      </div>

      <!-- Resumen Métricas 607 -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-bottom:20px; width:100%; box-sizing:border-box;">
        <div style="background:var(--clr-surface-2); padding:14px; border-radius:var(--r-md); border-left:4px solid #10b981;">
          <div style="font-size:0.75rem; color:var(--clr-text-muted); text-transform:uppercase; font-weight:700;">Total Facturado (Ventas)</div>
          <div style="font-size:1.25rem; font-weight:800; color:#10b981; margin-top:4px;">RD$ ${totalVentas.toLocaleString('es-DO', {minimumFractionDigits:2})}</div>
        </div>
        <div style="background:var(--clr-surface-2); padding:14px; border-radius:var(--r-md); border-left:4px solid #3b82f6;">
          <div style="font-size:0.75rem; color:var(--clr-text-muted); text-transform:uppercase; font-weight:700;">ITBIS Facturado</div>
          <div style="font-size:1.25rem; font-weight:800; color:#3b82f6; margin-top:4px;">RD$ ${totalItbis.toLocaleString('es-DO', {minimumFractionDigits:2})}</div>
        </div>
        <div style="background:var(--clr-surface-2); padding:14px; border-radius:var(--r-md); border-left:4px solid #f59e0b;">
          <div style="font-size:0.75rem; color:var(--clr-text-muted); text-transform:uppercase; font-weight:700;">ITBIS Retenido Terceros</div>
          <div style="font-size:1.25rem; font-weight:800; color:#f59e0b; margin-top:4px;">RD$ ${totalRetItbis.toLocaleString('es-DO', {minimumFractionDigits:2})}</div>
        </div>
      </div>

      <!-- Tabla de Datos 607 -->
      <div class="table-responsive">
        <table class="table" style="width:100%; min-width:920px; font-size:0.83rem;">
          <thead>
            <tr>
              <th>RNC / Cédula Cliente</th>
              <th>Nombre Cliente</th>
              <th>Tipo ID</th>
              <th>NCF (Serie B)</th>
              <th>Tipo Ingreso</th>
              <th>Fecha Comp.</th>
              <th style="text-align:right;">Monto Facturado</th>
              <th style="text-align:right;">ITBIS Facturado</th>
              <th style="text-align:right;">Retención ITBIS</th>
              <th>Forma Pago</th>
              <th style="text-align:right;">Total General</th>
            </tr>
          </thead>
          <tbody>
            ${records.length === 0 ? `
              <tr><td colspan="11" style="text-align:center; padding:36px; color:var(--clr-text-muted); font-size:0.92rem;">🔍 No hay facturas ni ventas emitidas por este usuario en el período fiscal <b>${currentDgiiPeriod}</b>.<br><small style="opacity:0.75;">Las facturas que generes en Facturación aparecerán aquí de forma automática al presionar "Recargar".</small></td></tr>
            ` : records.map(r => `
              <tr>
                <td><b>${r.rnc_cedula_cliente || '000000000'}</b></td>
                <td>${r.nombre_cliente}</td>
                <td><span class="badge" style="background:rgba(255,255,255,0.06); font-size:0.75rem;">${r.tipo_identificacion === 1 ? 'RNC (1)' : (r.tipo_identificacion === 2 ? 'Cédula (2)' : 'Final (3)')}</span></td>
                <td>${r.ncf ? `<code style="color:#10b981; font-weight:700;">${r.ncf}</code>` : `<span style="color:var(--clr-text-muted); font-style:italic;">Sin NCF</span>`}</td>
                <td>${r.tipo_ingreso || '01'}</td>
                <td>${r.fecha_comprobante}</td>
                <td style="text-align:right; font-weight:600;">RD$ ${(r.monto_facturado || 0).toLocaleString('es-DO', {minimumFractionDigits:2})}</td>
                <td style="text-align:right; color:#3b82f6;">RD$ ${(r.itbis_facturado || 0).toLocaleString('es-DO', {minimumFractionDigits:2})}</td>
                <td style="text-align:right; color:#f59e0b;">RD$ ${(r.itbis_retenido_terceros || 0).toLocaleString('es-DO', {minimumFractionDigits:2})}</td>
                <td><span class="badge" style="background:rgba(255,255,255,0.08);">${r.forma_pago || 'Efectivo'}</span></td>
                <td style="text-align:right; font-weight:700; color:#10b981;">RD$ ${(r.total || (r.monto_facturado + r.itbis_facturado) || 0).toLocaleString('es-DO', {minimumFractionDigits:2})}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// =============================================
// 3. FORMATO 608: COMPROBANTES FISCALES ANULADOS
// =============================================

/**
 * Obtiene los NCF anulados registrados por el usuario para el período seleccionado
 */
function getDgii608Records() {
  const cancelled = _getDgiiStorageList('recim_ncf_cancelled');
  return cancelled.filter(c => _matchesDgiiPeriod(c)).map(c => ({
    ncf: c.ncf,
    fecha_anulacion: _normalizeDgiiDate(c).replace(/\D/g, ''),
    tipo_anulacion: c.code || '02',
    reasonLabel: c.reason || '02: Errores de impresión',
    comentario: c.notes || 'Comprobante anulado según normativa DGII'
  }));
}

function renderDgii608(container) {
  const records = getDgii608Records();

  container.innerHTML = `
    <div class="card" style="margin-bottom: 20px; width:100%; box-sizing:border-box;">
      <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px;">
        <div style="min-width:240px; flex:1;">
          <h3 class="card-title">Formato 608: Comprobantes Fiscales Anulados (Serie B)</h3>
          <p class="card-subtitle">Registro legal de NCFs anulados por deterioro, error o duplicidad | Período: <b>${currentDgiiPeriod}</b></p>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <button class="btn-secondary" onclick="reloadDgiiSequence('608')" type="button" style="padding:8px 14px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px; font-weight:600; border-color:rgba(16,185,129,0.3); color:#10b981;" title="Escanear toda la app en busca de comprobantes anulados">
            <span style="font-size:1rem;">🔄</span> Recargar
          </button>
          <button class="btn-primary" onclick="openAddCancelledNcfModal()" type="button" style="padding:8px 14px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px;">
            <span>➕</span> Anular NCF
          </button>
          <button class="btn-primary" onclick="exportDgii608Excel()" type="button" style="padding:8px 14px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px; background:#059669;">
            <span>📊</span> Exportar Excel (Modelo 608)
          </button>
          <button class="btn-secondary" onclick="exportDgiiTxt('608')" type="button" style="padding:8px 14px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px;">
            <span>📄</span> Generar TXT 608
          </button>
        </div>
      </div>

      <!-- Resumen Métricas 608 -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-bottom:20px; width:100%; box-sizing:border-box;">
        <div style="background:var(--clr-surface-2); padding:14px; border-radius:var(--r-md); border-left:4px solid #ef4444;">
          <div style="font-size:0.75rem; color:var(--clr-text-muted); text-transform:uppercase; font-weight:700;">Comprobantes Anulados</div>
          <div style="font-size:1.25rem; font-weight:800; color:#ef4444; margin-top:4px;">${records.length}</div>
        </div>
        <div style="background:var(--clr-surface-2); padding:14px; border-radius:var(--r-md); border-left:4px solid #10b981;">
          <div style="font-size:0.75rem; color:var(--clr-text-muted); text-transform:uppercase; font-weight:700;">Estatus Formato 608</div>
          <div style="font-size:1.05rem; font-weight:800; color:#10b981; margin-top:4px;">${records.length === 0 ? 'Sin anulaciones en este mes' : 'Listo para envío a DGII'}</div>
        </div>
      </div>

      <!-- Tabla de Datos 608 -->
      <div class="table-responsive">
        <table class="table" style="width:100%; min-width:750px; font-size:0.83rem;">
          <thead>
            <tr>
              <th>NCF Anulado</th>
              <th>Fecha de Anulación</th>
              <th>Tipo de Anulación (DGII)</th>
              <th>Comentario / Observación</th>
              <th style="text-align:center;">Acción</th>
            </tr>
          </thead>
          <tbody>
            ${records.length === 0 ? `
              <tr><td colspan="5" style="text-align:center; padding:36px; color:var(--clr-text-muted); font-size:0.92rem;">🔍 No hay comprobantes anulados registrados por este usuario en el período fiscal <b>${currentDgiiPeriod}</b>.</td></tr>
            ` : records.map((c, i) => `
              <tr>
                <td><code style="color:#ef4444; font-weight:800; font-size:0.9rem;">${c.ncf}</code></td>
                <td>${c.fecha_anulacion}</td>
                <td><b>${c.reasonLabel}</b></td>
                <td><small>${c.comentario || 'Sin observaciones'}</small></td>
                <td style="text-align:center;">
                  <button class="btn-danger" onclick="deleteCancelledNcf(${i})" style="padding:3px 8px; font-size:0.75rem;" type="button" title="Eliminar anulación">🗑️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Modal para registrar NCF Anulado
function openAddCancelledNcfModal() {
  const ncf = prompt('Ingresa el NCF a anular (ej: B0100000005 o B0200000010):');
  if (!ncf) return;
  const reason = prompt('Motivo Oficial DGII:\n01: Deterioro de factura\n02: Errores de impresión\n03: Impresión defectuosa\n04: Duplicidad de factura\n05: Corrección de la información\n06: Cambio de productos\n07: Devolución de productos\n08: Omisión de productos\n09: Errores en secuencias NCF', '02: Errores de impresión');
  if (!reason) return;

  const codeMatch = reason.match(/^(\d{2})/);
  const code = codeMatch ? codeMatch[1] : '02';

  const cancelled = JSON.parse(localStorage.getItem(userKey('recim_ncf_cancelled')) || '[]');
  cancelled.unshift({
    ncf: ncf.trim().toUpperCase(),
    code: code,
    reason: reason.trim(),
    date: new Date().toISOString().slice(0, 10),
    notes: 'Registrado desde módulo Manejo DGII'
  });
  localStorage.setItem(userKey('recim_ncf_cancelled'), JSON.stringify(cancelled));
  showToast('✅ Comprobante marcado como anulado para el Formato 608', 'success');
  renderCurrentDgiiContent();
}

function deleteCancelledNcf(index) {
  if (!confirm('¿Deseas eliminar este registro de anulación?')) return;
  const cancelled = JSON.parse(localStorage.getItem(userKey('recim_ncf_cancelled')) || '[]');
  cancelled.splice(index, 1);
  localStorage.setItem(userKey('recim_ncf_cancelled'), JSON.stringify(cancelled));
  renderCurrentDgiiContent();
}

// =============================================
// EXPORTACIÓN A EXCEL (MODELOS OFICIALES DGII)
// =============================================

function exportDgii606Excel() {
  if (typeof XLSX === 'undefined') {
    showToast('⚠️ Librería Excel no disponible', 'warning');
    return;
  }
  const records = getDgii606Records();
  const periodClean = currentDgiiPeriod.replace(/\D/g, '');

  if (records.length === 0) {
    showToast('⚠️ No hay registros de compras en el período seleccionado para exportar', 'warning');
    return;
  }

  // Encabezados oficiales aprendidos del modelo ejmplos dgi/606/DGII_F606_202610.xlsx
  const rows = records.map(r => ({
    'rnc_cedula': r.rnc_cedula,
    'nombre_suplidor': r.nombre_suplidor,
    'tipo_id': r.tipo_id,
    'ncf': r.ncf,
    'ncf_modificado': r.ncf_modificado || '',
    'tipo_bienes_servicios': r.tipo_bienes_servicios || '02',
    'fecha_comprobante': r.fecha_comprobante,
    'fecha_pago': r.fecha_pago || r.fecha_comprobante,
    'monto_servicios': r.monto_servicios || 0,
    'monto_bienes': r.monto_bienes || 0,
    'itbis_facturado': r.itbis_facturado || 0,
    'itbis_retenido': r.itbis_retenido || 0,
    'retencion_renta': r.retencion_renta || 0,
    'propina_legal': r.propina_legal || 0,
    'monto_isc': r.monto_isc || 0,
    'monto_otros_imp': r.monto_otros_imp || 0,
    'itbis_sujeto_prop': r.itbis_sujeto_prop || 0,
    'itbis_llevado_costo': r.itbis_llevado_costo || 0,
    'tipo_gasto': r.tipo_gasto || '',
    'origen': r.origen || 'EGRESO'
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '606');
  XLSX.writeFile(wb, `DGII_F606_${periodClean}.xlsx`);
  showToast('✅ Formato 606 exportado exitosamente', 'success');
}

function exportDgii607Excel() {
  if (typeof XLSX === 'undefined') {
    showToast('⚠️ Librería Excel no disponible', 'warning');
    return;
  }
  const records = getDgii607Records();
  const periodClean = currentDgiiPeriod.replace(/\D/g, '');

  if (records.length === 0) {
    showToast('⚠️ No hay facturas en el período seleccionado para exportar', 'warning');
    return;
  }

  // Encabezados oficiales aprendidos del modelo ejmplos dgi/607/DGII_F607_202610.xlsx
  const rows = records.map(r => ({
    'rnc_cedula_cliente': r.rnc_cedula_cliente,
    'nombre_cliente': r.nombre_cliente,
    'tipo_identificacion': r.tipo_identificacion,
    'ncf': r.ncf,
    'ncf_modificado': r.ncf_modificado || '',
    'tipo_ingreso': r.tipo_ingreso || '01',
    'fecha_comprobante': r.fecha_comprobante,
    'fecha_retencion': r.fecha_retencion || '',
    'monto_facturado': r.monto_facturado,
    'itbis_facturado': r.itbis_facturado,
    'itbis_retenido_terceros': r.itbis_retenido_terceros || 0,
    'itbis_percibido': r.itbis_percibido || 0,
    'retencion_renta': r.retencion_renta || 0,
    'isr_percibido': r.isr_percibido || 0,
    'monto_isc': r.monto_isc || 0,
    'monto_otros_imp': r.monto_otros_imp || 0,
    'monto_propina_legal': r.monto_propina_legal || 0,
    'forma_pago': r.forma_pago || 'Efectivo'
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '607');
  XLSX.writeFile(wb, `DGII_F607_${periodClean}.xlsx`);
  showToast('✅ Formato 607 exportado exitosamente', 'success');
}

function exportDgii608Excel() {
  if (typeof XLSX === 'undefined') {
    showToast('⚠️ Librería Excel no disponible', 'warning');
    return;
  }
  const records = getDgii608Records();
  const periodClean = currentDgiiPeriod.replace(/\D/g, '');

  // Encabezados oficiales de ejmplos dgi/608/DGII_F608_202610.xlsx
  const rows = records.map(r => ({
    'ncf': r.ncf,
    'fecha_anulacion': r.fecha_anulacion,
    'tipo_anulacion': r.tipo_anulacion,
    'comentario': r.comentario || ''
  }));

  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'ncf': '', 'fecha_anulacion': '', 'tipo_anulacion': '', 'comentario': '' }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '608');
  XLSX.writeFile(wb, `DGII_F608_${periodClean}.xlsx`);
  showToast('✅ Formato 608 exportado exitosamente', 'success');
}

// =============================================
// EXPORTACIÓN A TXT (ESTRUCTURAS EXACTAS DGII)
// =============================================

function exportDgiiTxt(tipo) {
  const companyRnc = getDgiiCompanyRnc() || '000000000';
  const periodClean = currentDgiiPeriod.replace(/\D/g, '');

  let fileContent = '';

  if (tipo === '606') {
    const records = getDgii606Records();
    let header = `606|${companyRnc}|${periodClean}|${records.length}\n`;
    let body = records.map(r => {
      const rncClean = (r.rnc_cedula || '').replace(/\D/g, '') || r.rnc_cedula;
      const fComp = (r.fecha_comprobante || '').replace(/\D/g, '');
      const fPago = (r.fecha_pago || r.fecha_comprobante || '').replace(/\D/g, '');
      const mServ = (parseFloat(r.monto_servicios) || 0).toFixed(2);
      const mBienes = (parseFloat(r.monto_bienes) || 0).toFixed(2);
      const mTotal = (parseFloat(r.total_facturado) || (parseFloat(r.monto_bienes) + parseFloat(r.monto_servicios)) || 0).toFixed(2);
      const itbFact = (parseFloat(r.itbis_facturado) || 0).toFixed(2);
      const itbRet = (parseFloat(r.itbis_retenido) || 0).toFixed(2);
      const retRenta = (parseFloat(r.retencion_renta) || 0).toFixed(2);
      const fPagoCode = r.forma_pago || '01';

      return `${rncClean}|${r.tipo_id}|${r.tipo_bienes_servicios || '02'}|${r.ncf}|${r.ncf_modificado || 'None'}|${fComp}|${fPago}|${mServ}|${mBienes}|${mTotal}|${itbFact}|${itbRet}|0.00|0.00|${itbFact}|0.00||${retRenta}|0.00|0.00|0.00|0.00|${fPagoCode}`;
    }).join('\n');
    fileContent = header + body;
  } else if (tipo === '607') {
    const records = getDgii607Records();
    let header = `607|${companyRnc}|${periodClean}|${records.length}\n`;
    let body = records.map(r => {
      const rncClean = (r.rnc_cedula_cliente || '').replace(/\D/g, '') || '000000000';
      const fComp = (r.fecha_comprobante || '').replace(/\D/g, '');
      const mFact = (parseFloat(r.monto_facturado) || 0).toFixed(2);
      const itbFact = (parseFloat(r.itbis_facturado) || 0).toFixed(2);
      const itbRet = (parseFloat(r.itbis_retenido_terceros) || 0).toFixed(2);
      const retRenta = (parseFloat(r.retencion_renta) || 0).toFixed(2);

      let ef = '0', ch = '0', tar = '0', cred = '0';
      if (r.forma_pago === 'Efectivo') ef = mFact;
      else if (r.forma_pago === 'Tarjeta') tar = mFact;
      else if (r.forma_pago === 'Credito') cred = mFact;

      return `${rncClean}|${r.tipo_identificacion}|${r.ncf}|${r.ncf_modificado || ''}|${r.tipo_ingreso || '01'}|${fComp}||${mFact}|${itbFact}|${itbRet}||${retRenta}||0.00|0.00|0.00|${ef}|${ch}|${tar}|${cred}|0|0|0|${mFact}`;
    }).join('\n');
    fileContent = header + body;
  } else if (tipo === '608') {
    const records = getDgii608Records();
    let header = `608|${companyRnc}|${periodClean}|${records.length}\n`;
    let body = records.map(r => `${r.ncf}|${r.fecha_anulacion}|${r.tipo_anulacion}`).join('\n');
    fileContent = header + body;
  }

  if (window.AndroidNative && typeof window.AndroidNative.DownloadFile === 'function') {
    try {
      const base64Data = btoa(unescape(encodeURIComponent(fileContent)));
      window.AndroidNative.DownloadFile(`DGII_F${tipo}_${periodClean}.txt`, base64Data);
      showToast(`✅ Archivo TXT Formato ${tipo} guardado en Descargas`, 'success');
      return;
    } catch (e) {
      console.warn('Android native bridge error:', e);
    }
  }

  const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `DGII_F${tipo}_${periodClean}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`✅ Archivo TXT Formato ${tipo} descargado según modelo oficial`, 'success');
}

// Exportar globalmente al objeto window
window.renderManejoDgiiPage = renderManejoDgiiPage;
window.switchDgiiTab = switchDgiiTab;
window.onDgiiPeriodChange = onDgiiPeriodChange;
window.reloadDgiiSequence = reloadDgiiSequence;
window.openAddCancelledNcfModal = openAddCancelledNcfModal;
window.deleteCancelledNcf = deleteCancelledNcf;
window.exportDgii606Excel = exportDgii606Excel;
window.exportDgii607Excel = exportDgii607Excel;
window.exportDgii608Excel = exportDgii608Excel;
window.exportDgiiTxt = exportDgiiTxt;
