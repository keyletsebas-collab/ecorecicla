/* =============================================
   DGII-REPORTS.JS – Módulo de Manejo DGII (Serie B)
   Formatos de Envío Oficiales: 606, 607 y 608
   Conexión exclusiva con los datos reales del usuario
   ============================================= */

// Estado activo del módulo
let currentDgiiTab = '606';
// Período activo inicial: Mes y año actual del sistema
let currentDgiiPeriod = new Date().toISOString().slice(0, 7); // 'AAAA-MM'

/**
 * Obtiene el RNC de la empresa del usuario actual (desde Ajustes o configuración compartida)
 */
function getDgiiCompanyRnc() {
  const settings = (typeof getSettings === 'function') ? getSettings() : {};
  let rnc = settings.companyRNC || settings.rnc || settings.companyRnc || '';
  if (!rnc) {
    try {
      const shared = JSON.parse(localStorage.getItem('recim_shared_company_settings') || '{}');
      if (shared.companyRNC) rnc = shared.companyRNC;
    } catch (_) {}
  }
  return rnc ? rnc.replace(/\D/g, '') : '';
}

/**
 * Función principal llamada por el router para renderizar la página de Manejo DGII
 */
function renderManejoDgiiPage(container) {
  if (!container) container = document.getElementById('page-manejo_dgii');
  if (!container) return;

  const companyRnc = getDgiiCompanyRnc();
  const rncDisplay = companyRnc 
    ? `<code style="font-weight:800; color:#10b981; font-size:0.95rem;">${companyRnc}</code>`
    : `<span style="font-size:0.8rem; color:#f59e0b; font-weight:600;">⚠️ Sin RNC (configurar en Ajustes)</span>`;

  container.innerHTML = `
    <div class="page-header" style="margin-bottom: 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; width:100%; box-sizing:border-box;">
      <div style="min-width:250px; flex:1;">
        <h2 class="section-title">🏛️ Manejo DGII – Comprobantes Serie B</h2>
        <p class="section-subtitle">Formatos oficiales de envío mensual a la DGII basados en las operaciones reales de la empresa</p>
      </div>
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <div style="background:var(--clr-surface-2); border:1px solid var(--clr-border); padding:6px 12px; border-radius:var(--r-md); display:flex; align-items:center; gap:8px;">
          <span style="font-size:0.78rem; color:var(--clr-text-muted); font-weight:700;">RNC EMISOR:</span>
          ${rncDisplay}
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <label style="font-size:0.82rem; color:var(--clr-text-muted); font-weight:600; white-space:nowrap;">Período Fiscal:</label>
          <input type="month" id="dgii-period-picker" class="form-input" style="padding:6px 10px; font-size:0.88rem; width:155px; min-width:145px;" value="${currentDgiiPeriod}" onchange="onDgiiPeriodChange(this.value)" />
        </div>
      </div>
    </div>

    <!-- Barra de Pestañas Serie B DGII (606, 607, 608) -->
    <div class="dgii-tabs-bar">
      <button class="dgii-tab-btn ${currentDgiiTab === '606' ? 'active' : ''}" data-tab="606" onclick="switchDgiiTab('606')">606</button>
      <button class="dgii-tab-btn ${currentDgiiTab === '607' ? 'active' : ''}" data-tab="607" onclick="switchDgiiTab('607')">607</button>
      <button class="dgii-tab-btn ${currentDgiiTab === '608' ? 'active' : ''}" data-tab="608" onclick="switchDgiiTab('608')">608</button>
    </div>

    <!-- Contenedor del contenido del reporte activo -->
    <div id="dgii-tab-content-container"></div>
  `;

  renderCurrentDgiiContent();
}

function onDgiiPeriodChange(val) {
  if (val) {
    currentDgiiPeriod = val;
    renderCurrentDgiiContent();
  }
}

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

  // Re-renderizar la vista activa
  renderCurrentDgiiContent();

  let count = 0;
  if (seq === '606') count = getDgii606Records().length;
  else if (seq === '607') count = getDgii607Records().length;
  else if (seq === '608') count = getDgii608Records().length;

  showToast(`✅ Secuencia ${seq} recargada: ${count} registro(s) encontrados para ${currentDgiiPeriod}`, 'success');
}

/**
 * Auto-escanea facturas, notas de crédito y notas de débito que hayan sido marcadas como anuladas
 */
function autoScanCancelledDocuments() {
  const cancelled = JSON.parse(localStorage.getItem(userKey('recim_ncf_cancelled')) || '[]');
  const existingNcfs = new Set(cancelled.map(c => (c.ncf || '').trim().toUpperCase()));

  const invoices = JSON.parse(localStorage.getItem(userKey('recim_invoices')) || '[]');
  const creditNotes = JSON.parse(localStorage.getItem(userKey('recim_credit_notes')) || '[]');
  const debitNotes = JSON.parse(localStorage.getItem(userKey('recim_debit_notes')) || '[]');

  let added = false;
  [...invoices, ...creditNotes, ...debitNotes].forEach(item => {
    const isCancelled = item.status === 'anulado' || item.status === 'anulada' || item.isCancelled === true || item.cancelled === true;
    const ncf = (item.ncf || '').trim().toUpperCase();
    if (isCancelled && ncf && !existingNcfs.has(ncf)) {
      cancelled.push({
        ncf: ncf,
        code: '02',
        reason: '02: Errores de impresión / Corrección',
        date: item.date || new Date().toISOString().slice(0, 10),
        notes: `Auto-detectado de ${item.id || 'documento anulado'}`
      });
      existingNcfs.add(ncf);
      added = true;
    }
  });

  if (added) {
    localStorage.setItem(userKey('recim_ncf_cancelled'), JSON.stringify(cancelled));
  }
}

// =============================================
// 1. FORMATO 606: COMPRAS DE BIENES Y SERVICIOS
// =============================================

/**
 * Obtiene las compras reales del usuario actual para el período seleccionado
 * Escanea: Egresos (gastos) y Bitácoras (compras de reciclaje y materia prima)
 */
function getDgii606Records() {
  const egresos = JSON.parse(localStorage.getItem(userKey('recim_egresos')) || '[]');
  const bitacoras = JSON.parse(localStorage.getItem(userKey('recim_batches')) || '[]');

  const [year, month] = currentDgiiPeriod.split('-');
  const filterPrefix = `${year}-${month}`;

  // 1. Egresos y gastos operacionales con comprobante o factura del usuario
  const comprasEgresos = egresos.filter(e => (e.date || '').startsWith(filterPrefix)).map((e, idx) => {
    const rawRnc = (e.rnc || e.supplierNit || e.supplierRnc || e.supplierId || '').replace(/\D/g, '');
    let tipoId = 99;
    if (rawRnc.length === 9) tipoId = 1;
    else if (rawRnc.length === 11) tipoId = 2;

    const montoTotal = parseFloat(e.amount) || 0;
    const itbisFact = parseFloat(e.itbis) || 0;
    const servAmount = parseFloat(e.serviceAmount) || 0;
    const bienesAmount = servAmount > 0 ? Math.max(0, montoTotal - servAmount) : montoTotal;

    return {
      rnc_cedula: e.rnc || e.supplierNit || (e.supplierId ? 'PROV-' + e.supplierId : 'PROV-001'),
      nombre_suplidor: e.supplier || e.beneficiary || e.concept || 'Suplidor Comercial',
      tipo_id: tipoId,
      ncf: e.ncf || e.invoiceNumber || '',
      ncf_modificado: e.ncfModified || '',
      tipo_bienes_servicios: e.expenseType || '02',
      fecha_comprobante: (e.date || '').replace(/\D/g, ''),
      fecha_pago: (e.paymentDate || e.date || '').replace(/\D/g, ''),
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
      origen: e.origin || 'EGRESO',
      forma_pago: e.paymentMethodCode || '01'
    };
  });

  // 2. Bitácoras de compra de material reciclado a proveedores / recicladores
  const comprasBitacoras = bitacoras.filter(b => (b.date || '').startsWith(filterPrefix)).map((b, idx) => {
    const totalCost = (b.items || []).reduce((acc, it) => acc + (parseFloat(it.cost) || 0), 0);
    const rawNit = (b.supplierNit || '').replace(/\D/g, '');
    let tipoId = 99;
    if (rawNit.length === 9) tipoId = 1;
    else if (rawNit.length === 11) tipoId = 2;

    return {
      rnc_cedula: b.supplierNit || b.supplierId || `PROV-${(idx + 1).toString().padStart(4, '0')}`,
      nombre_suplidor: b.supplier || 'Proveedor de Reciclaje',
      tipo_id: tipoId,
      ncf: b.ncf || '',
      ncf_modificado: '',
      tipo_bienes_servicios: '02',
      fecha_comprobante: (b.date || '').replace(/\D/g, ''),
      fecha_pago: (b.date || '').replace(/\D/g, ''),
      monto_servicios: 0,
      monto_bienes: totalCost,
      total_facturado: totalCost,
      itbis_facturado: 0,
      itbis_retenido: 0,
      retencion_renta: 0,
      propina_legal: 0,
      monto_isc: 0,
      monto_otros_imp: 0,
      itbis_sujeto_prop: 0,
      itbis_llevado_costo: 0,
      tipo_gasto: '01',
      origen: 'BITACORA',
      forma_pago: '01'
    };
  });

  return [...comprasEgresos, ...comprasBitacoras];
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
 * Escanea: Facturas, Notas de Crédito emitidas, Notas de Débito e Ingresos con NCF
 */
function getDgii607Records() {
  const invoices = JSON.parse(localStorage.getItem(userKey('recim_invoices')) || '[]');
  const creditNotes = JSON.parse(localStorage.getItem(userKey('recim_credit_notes')) || '[]');
  const debitNotes = JSON.parse(localStorage.getItem(userKey('recim_debit_notes')) || '[]');
  const ingresos = JSON.parse(localStorage.getItem(userKey('recim_ingresos')) || '[]');

  const [year, month] = currentDgiiPeriod.split('-');
  const filterPrefix = `${year}-${month}`;

  // 1. Facturas normales
  const listInvoices = invoices.filter(inv => (inv.date || '').startsWith(filterPrefix)).map(inv => {
    const rawNit = (inv.nit || inv.rnc || '').replace(/\D/g, '');
    let tipoId = 1;
    if (rawNit.length === 11) tipoId = 2;
    else if (!rawNit || rawNit === '000000000') tipoId = 3;

    const montoFact = parseFloat(inv.subtotal || (parseFloat(inv.total || 0) - parseFloat(inv.taxAmount || 0))) || 0;
    const itbisFact = parseFloat(inv.taxAmount) || 0;

    return {
      rnc_cedula_cliente: inv.nit || inv.rnc || (tipoId === 3 ? '000000000' : ''),
      nombre_cliente: inv.company || inv.client || 'Cliente Contado',
      tipo_identificacion: tipoId,
      ncf: inv.ncf || '',
      ncf_modificado: inv.ncfModified || inv.ncfMod || '',
      tipo_ingreso: '01',
      fecha_comprobante: (inv.date || '').replace(/\D/g, ''),
      fecha_retencion: (inv.retentionDate || '').replace(/\D/g, ''),
      monto_facturado: montoFact,
      itbis_facturado: itbisFact,
      itbis_retenido_terceros: parseFloat(inv.retItbisAmount) || 0,
      itbis_percibido: 0,
      retencion_renta: parseFloat(inv.retIsrAmount) || 0,
      isr_percibido: 0,
      monto_isc: parseFloat(inv.iscAmount) || 0,
      monto_otros_imp: 0,
      monto_propina_legal: 0,
      forma_pago: inv.payMethod || inv.paymentMethod || 'Efectivo',
      total: parseFloat(inv.total) || (montoFact + itbisFact)
    };
  });

  // 2. Notas de Crédito emitidas (B04 / E34)
  const listCreditNotes = creditNotes.filter(cn => (cn.date || '').startsWith(filterPrefix)).map(cn => {
    const rawNit = (cn.nit || cn.rnc || '').replace(/\D/g, '');
    let tipoId = 1;
    if (rawNit.length === 11) tipoId = 2;
    else if (!rawNit || rawNit === '000000000') tipoId = 3;

    const montoFact = parseFloat(cn.subtotal || cn.amount || cn.total || 0);
    const itbisFact = parseFloat(cn.taxAmount || cn.itbis || 0);

    return {
      rnc_cedula_cliente: cn.nit || cn.rnc || (tipoId === 3 ? '000000000' : ''),
      nombre_cliente: cn.company || cn.client || 'Cliente',
      tipo_identificacion: tipoId,
      ncf: cn.ncf || '',
      ncf_modificado: cn.ncfMod || cn.invoiceNcf || '',
      tipo_ingreso: '01',
      fecha_comprobante: (cn.date || '').replace(/\D/g, ''),
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
  const listDebitNotes = debitNotes.filter(dn => (dn.date || '').startsWith(filterPrefix)).map(dn => {
    const rawNit = (dn.nit || dn.rnc || '').replace(/\D/g, '');
    let tipoId = 1;
    if (rawNit.length === 11) tipoId = 2;
    else if (!rawNit || rawNit === '000000000') tipoId = 3;

    const montoFact = parseFloat(dn.subtotal || dn.amount || dn.total || 0);
    const itbisFact = parseFloat(dn.taxAmount || dn.itbis || 0);

    return {
      rnc_cedula_cliente: dn.nit || dn.rnc || (tipoId === 3 ? '000000000' : ''),
      nombre_cliente: dn.company || dn.client || 'Cliente',
      tipo_identificacion: tipoId,
      ncf: dn.ncf || '',
      ncf_modificado: dn.ncfMod || dn.invoiceNcf || '',
      tipo_ingreso: '01',
      fecha_comprobante: (dn.date || '').replace(/\D/g, ''),
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

  // 4. Ingresos directos con NCF asignado
  const listIngresos = ingresos.filter(ing => (ing.date || '').startsWith(filterPrefix) && ing.ncf).map(ing => ({
    rnc_cedula_cliente: ing.rnc || '000000000',
    nombre_cliente: ing.client || ing.concept || 'Ingreso con NCF',
    tipo_identificacion: (ing.rnc && ing.rnc.length === 9) ? 1 : ((ing.rnc && ing.rnc.length === 11) ? 2 : 3),
    ncf: ing.ncf,
    ncf_modificado: '',
    tipo_ingreso: '01',
    fecha_comprobante: (ing.date || '').replace(/\D/g, ''),
    fecha_retencion: '',
    monto_facturado: parseFloat(ing.amount || 0),
    itbis_facturado: parseFloat(ing.itbis || 0),
    itbis_retenido_terceros: 0,
    itbis_percibido: 0,
    retencion_renta: 0,
    isr_percibido: 0,
    monto_isc: 0,
    monto_otros_imp: 0,
    monto_propina_legal: 0,
    forma_pago: ing.payMethod || 'Efectivo',
    total: parseFloat(ing.amount || 0)
  }));

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
  const cancelled = JSON.parse(localStorage.getItem(userKey('recim_ncf_cancelled')) || '[]');
  const [year, month] = currentDgiiPeriod.split('-');
  const filterPrefix = `${year}-${month}`;
  return cancelled.filter(c => (c.date || '').startsWith(filterPrefix)).map(c => ({
    ncf: c.ncf,
    fecha_anulacion: (c.date || '').replace(/\D/g, ''),
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
