/* =============================================
   HISTORY.JS – Historial de facturas, ingresos y egresos
   ============================================= */

function getAllHistoryItems() {
  const invoices = getAllInvoices();
  const ingresos = JSON.parse(localStorage.getItem(userKey('recim_ingresos')) || '[]');
  const egresos = JSON.parse(localStorage.getItem(userKey('recim_egresos')) || '[]');

  const normInvoices = invoices.map(i => ({
    ...i,
    itemType: 'invoice',
    total: i.total !== undefined ? i.total : (i.totalVenta || 0)
  }));
  const normIngresos = ingresos.map(i => ({
    ...i,
    itemType: 'ingreso',
    type: 'ingreso',
    typeName: 'Ingreso',
    total: i.amount,
    createdAt: i.createdAt || new Date(i.date + 'T12:00:00Z').toISOString()
  }));
  const normEgresos = egresos.map(e => ({
    ...e,
    itemType: 'egreso',
    type: 'egreso',
    typeName: 'Egreso',
    total: e.amount,
    createdAt: e.createdAt || new Date(e.date + 'T12:00:00Z').toISOString()
  }));

  return [...normInvoices, ...normIngresos, ...normEgresos];
}

function renderHistoryPage(container) {
  const items = getAllHistoryItems();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="section-title">${t('hist.title')}<span class="version-indicator-mobile">v1.1.0</span></h2>
        <p class="section-subtitle">${t('hist.subtitle')}</p>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">${t('hist.total_inv')}</div>
        <div class="stat-value stat-value--blue">${items.filter(i => i.itemType === 'invoice').length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Ingresos</div>
        <div class="stat-value stat-value--green">${items.filter(i => i.type === 'ingreso').length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Egresos</div>
        <div class="stat-value stat-value--red">${items.filter(i => i.type === 'egreso').length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Bitácoras</div>
        <div class="stat-value stat-value--green">${items.filter(i => i.type === 'basica').length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${t('hist.total_val')}</div>
        <div class="stat-value stat-value--green">${formatMoney(items.filter(i => i.itemType === 'invoice').reduce((s, i) => s + i.total, 0))}</div>
      </div>
    </div>

    <div class="history-filters">
      <select id="history-filter-type" class="form-select" style="width:auto;" onchange="filterHistory()">
        <option value="all">${t('hist.all_types')}</option>
        <option value="basica">Bitácoras</option>
        <option value="local">Facturas Locales</option>
        <option value="empresa">Facturas Empresariales</option>
        <option value="ingreso">Ingresos Financieros</option>
        <option value="egreso">Egresos Financieros</option>
      </select>
      <input id="history-search" type="text" class="form-input" style="width:auto;min-width:200px;" placeholder="${t('hist.search')}" oninput="filterHistory()" />
      <button class="btn-secondary" onclick="exportFilteredHistoryToExcel()">📊 Exportar Excel</button>
      <input type="file" id="history-import-excel-input" accept=".xlsx, .xls" style="display:none;" onchange="handleHistoryImportExcel(this)" />
      <button class="btn-secondary" onclick="document.getElementById('history-import-excel-input').click()">📥 Importar Excel</button>
      <button class="btn-danger" onclick="clearHistory()">${t('hist.clear_all')}</button>
    </div>

    <div id="history-list">
      ${renderInvoiceCards(items)}
    </div>
  `;
}

function renderInvoiceCards(items) {
  if (items.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <p class="empty-state-text">${t('hist.no_inv')}<br>${t('hist.go_create')} <b>${t('nav.facturas')}</b>.</p>
      </div>`;
  }

  // Sort by date (desc) and then by creation time (desc)
  const sorted = [...items].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    const timeA = a.createdAt || '';
    const timeB = b.createdAt || '';
    return timeB.localeCompare(timeA);
  });

  // Group by Month and then by Day
  const groups = {};
  sorted.forEach(item => {
    if (!item.date) return;
    const [y, m, d] = item.date.split('-');
    const monthKey = `${y}-${m}`;
    const dayKey = item.date;
    if (!groups[monthKey]) groups[monthKey] = {};
    if (!groups[monthKey][dayKey]) groups[monthKey][dayKey] = [];
    groups[monthKey][dayKey].push(item);
  });

  const monthNames = {
    '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
    '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
    '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
  };

  let html = '';
  // Iterate months (desc)
  Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(mKey => {
    const [y, m] = mKey.split('-');
    html += `<div class="history-month-header">${monthNames[m] || m} ${y}</div>`;

    // Iterate days (desc)
    Object.keys(groups[mKey]).sort((a, b) => b.localeCompare(a)).forEach(dKey => {
      const dayItems = groups[mKey][dKey];
      html += `<div class="history-day-header">${formatDate(dKey)}</div>`;

      dayItems.forEach(item => {
        html += renderSingleInvoiceCard(item);
      });
    });
  });

  return html;
}

function renderSingleInvoiceCard(inv) {
  const isBasica = inv.type === 'basica';
  const isLocal = inv.type === 'local';
  const isIngreso = inv.type === 'ingreso';
  const isEgreso = inv.type === 'egreso';
  
  let badge, icon;
  if (isBasica) {
    badge = `<span class="badge badge--green">Bitácora</span>`;
    icon = '🚛';
  } else if (isLocal) {
    badge = `<span class="badge badge--blue">Fact. Local</span>`;
    icon = '🏠';
  } else if (isIngreso) {
    badge = `<span class="badge badge--green">Ingreso</span>`;
    icon = '💰';
  } else if (isEgreso) {
    badge = `<span class="badge badge--red">Egreso</span>`;
    icon = '💸';
  } else {
    badge = `<span class="badge badge--yellow">Fact. Empresa</span>`;
    icon = '🏢';
  }

  let itemRows = '';
  if (isIngreso || isEgreso) {
    itemRows = `
      <tr>
        <td><b>Concepto</b></td>
        <td colspan="3">${inv.concept}</td>
      </tr>
      ${inv.category ? `
      <tr>
        <td><b>Categoría</b></td>
        <td colspan="3">${inv.category}</td>
      </tr>` : ''}
    `;
  } else if (isBasica) {
    itemRows = (inv.items || []).map(item => `
        <tr>
          <td>${item.icon || '📦'} ${item.name}</td>
          <td>${item.qty} ${item.unit}</td>
          <td>${formatMoney(item.priceBuy || 0)}</td>
          <td><b>${formatMoney(item.totalCompra || 0)}</b></td>
        </tr>`).join('');
  } else {
    itemRows = (inv.items || []).map(item => `
        <tr>
          <td>${item.desc}</td>
          <td>${item.qty}</td>
          <td>${formatMoney(item.uprice)}</td>
          <td><b>${formatMoney(item.subtotal)}</b></td>
        </tr>`).join('');
  }

  let detailRows = '';
  if (isIngreso || isEgreso) {
    detailRows = `
      <div style="margin-bottom:12px;">
        <p style="margin: 4px 0;"><b>Concepto:</b> ${inv.concept || '—'}</p>
        <p style="margin: 4px 0;"><b>Categoría:</b> ${inv.category || 'General'}</p>
        ${inv.notes ? `<p style="margin: 4px 0;"><b>Notas:</b> ${inv.notes}</p>` : ''}
      </div>
    `;
  } else if (isBasica) {
    detailRows = `<p><b>${t('hist.client')}</b> ${inv.client || '—'}</p>`;
  } else {
    detailRows = `
      <div class="form-row" style="margin-bottom:12px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <p style="margin:0;"><b>${t('hist.company')}</b> ${inv.company || '—'}</p>
        <p style="margin:0;"><b>${t('hist.nit')}</b> ${inv.nit || '—'}</p>
        <p style="margin:0;"><b>${t('hist.contact')}</b> ${inv.contact || '—'}</p>
        <p style="margin:0;"><b>${t('hist.address')}</b> ${inv.address || '—'}</p>
      </div>`;
  }

  let totalsSection = '';
  if (isIngreso || isEgreso) {
    totalsSection = `
      <div class="invoice-summary" style="margin-top:12px;">
        <div class="invoice-summary-row total">
          <span class="invoice-summary-label">Monto</span>
          <span class="invoice-summary-value" style="color:${isIngreso ? 'var(--clr-primary-light)' : '#f87171'}; font-size:1.2rem; font-weight:700;">
            ${isIngreso ? '+' : '-'}${formatMoney(inv.total, inv.currency || 'DOP')}
          </span>
        </div>
      </div>
    `;
  } else if (isBasica) {
    totalsSection = `
      <div class="invoice-summary" style="margin-top:12px;">
        <div class="invoice-summary-row">
          <span class="invoice-summary-label">Total Compra (Egreso)</span>
          <span class="invoice-summary-value" style="color:#f87171;">-${formatMoney(inv.totalCompra)}</span>
        </div>
        <div class="invoice-summary-row total">
          <span class="invoice-summary-label">Balance Neto</span>
          <span class="invoice-summary-value" style="color:${inv.balance >= 0 ? 'var(--clr-primary-light)' : '#f87171'}">${formatMoney(inv.balance)}</span>
        </div>
      </div>`;
  } else {
    totalsSection = `
      <div class="invoice-summary" style="margin-top:12px;">
        <div class="invoice-summary-row">
          <span class="invoice-summary-label">${t('lbl.subtotal')}</span>
          <span class="invoice-summary-value">${formatMoney(inv.subtotal)}</span>
        </div>
        <div class="invoice-summary-row">
          <span class="invoice-summary-label">${t('inv.iva')} (${inv.taxRate}%)</span>
          <span class="invoice-summary-value">${formatMoney(inv.taxAmount)}</span>
        </div>
        <div class="invoice-summary-row total">
          <span class="invoice-summary-label">${t('lbl.total')}</span>
          <span class="invoice-summary-value">${formatMoney(inv.total)}</span>
        </div>
      </div>`;
  }

  const cardTitle = (isIngreso || isEgreso) ? (inv.concept) : (inv.id);
  let cardMeta = (isIngreso || isEgreso) ? (`Finanzas &bull; Categoría: ${inv.category || 'General'}`) : (`${inv.client || inv.company || '—'} &bull; ${t('hist.created')} ${formatDateTime(inv.createdAt)}`);
  if (inv.collaborator) {
    cardMeta += ` &bull; 👤 Colaborador: ${inv.collaborator}`;
  }
  const displayTotal = isEgreso ? `-${formatMoney(inv.total, inv.currency || 'DOP')}` : (isIngreso ? `+${formatMoney(inv.total, inv.currency || 'DOP')}` : formatMoney(inv.total, inv.currency || 'DOP'));
  const totalColor = isEgreso ? '#f87171' : (isIngreso ? 'var(--clr-primary-light)' : 'inherit');

  return `
  <div class="history-card" id="hcard-${inv.id}">
    <div class="history-card-header" onclick="toggleHistoryCard('${inv.id}')">
      <div class="history-card-icon">${icon}</div>
      <div class="history-card-info">
        <div class="history-card-title">${cardTitle} &nbsp; ${badge}</div>
        <div class="history-card-meta">
          ${cardMeta}
        </div>
      </div>
      <div style="display:flex; align-items:center;">
        <div class="history-card-total" style="color:${totalColor};">${displayTotal}</div>
        ${(!isIngreso && !isEgreso) ? `
          <div style="display: flex; flex-direction: column; gap: 4px; margin-left: 12px;">
            <button class="btn-secondary" onclick="event.stopPropagation(); exportarExcelResiduos(${isBasica ? 'getAllHistoryItems' : 'getAllInvoices'}().find(i => i.id === '${inv.id}'))" style="padding: 4px 8px; font-size: 0.75rem; font-weight: 600; min-width: 65px;" title="Descargar Excel">📊 Excel</button>
            <button class="btn-secondary" onclick="event.stopPropagation(); generateInvoicePDF(${isBasica ? 'getAllHistoryItems' : 'getAllInvoices'}().find(i => i.id === '${inv.id}'))" style="padding: 4px 8px; font-size: 0.75rem; font-weight: 600; min-width: 65px;" title="Descargar PDF">📄 PDF</button>
          </div>
        ` : ''}
      </div>
      <span class="history-card-chevron" style="margin-left: 12px;">▼</span>
    </div>
    <div class="history-card-body">
      <div id="pdf-content-${inv.id}" class="pdf-export-container">
        <div class="pdf-only-header" style="display:none; text-align:center; padding-bottom:20px; border-bottom:2px solid #3b82f6; margin-bottom:20px;">
           <h1 style="color:#3b82f6; margin:0;">RECIMINSA</h1>
           <p style="margin:5px 0;">Gestión de Materiales Reciclables</p>
           <h2 style="margin:15px 0 5px 0;">${inv.typeName || inv.type.toUpperCase()}</h2>
           <p>ID: ${inv.id} | Fecha: ${formatDate(inv.date)}</p>
        </div>
        ${detailRows}
        <div style="overflow-x:auto; margin-top:10px;">
          <table class="data-table">
            <thead><tr>
              <th>Detalle</th><th>Cantidad / Info</th><th></th><th></th>
            </tr></thead>
            <tbody>${itemRows}</tbody>
          </table>
        </div>
        ${totalsSection}
        ${inv.notes ? `<p style="margin-top:12px; font-size:0.83rem; color:var(--clr-text-secondary);">📝 ${inv.notes}</p>` : ''}
      </div>
      <div style="margin-top:14px; display:flex; justify-content:flex-end; gap:8px;">
        ${(!isIngreso && !isEgreso) ? `
          <button class="btn-secondary" onclick="exportarExcelResiduos(${isBasica ? 'getAllHistoryItems' : 'getAllInvoices'}().find(i => i.id === '${inv.id}'))">📊 Excel</button>
          <button class="btn-secondary" onclick="generateInvoicePDF(${isBasica ? 'getAllHistoryItems' : 'getAllInvoices'}().find(i => i.id === '${inv.id}'))">📄 PDF</button>
        ` : ''}
        <button class="btn-danger" onclick="deleteHistoryItem('${inv.type}', '${inv.id}')">${t('hist.del_inv')}</button>
      </div>
    </div>
  </div>`;
}

function toggleHistoryCard(id) {
  const card = document.getElementById(`hcard-${id}`);
  if (card) card.classList.toggle('expanded');
}

function filterHistory() {
  const typeFilter = document.getElementById('history-filter-type')?.value || 'all';
  const searchQuery = (document.getElementById('history-search')?.value || '').toLowerCase().trim();
  let items = getAllHistoryItems();

  if (typeFilter !== 'all') items = items.filter(i => i.type === typeFilter);
  if (searchQuery) items = items.filter(i =>
    (i.id || '').toLowerCase().includes(searchQuery) ||
    (i.client || '').toLowerCase().includes(searchQuery) ||
    (i.company || '').toLowerCase().includes(searchQuery) ||
    (i.concept || '').toLowerCase().includes(searchQuery) ||
    (i.category || '').toLowerCase().includes(searchQuery)
  );

  const list = document.getElementById('history-list');
  if (list) list.innerHTML = renderInvoiceCards(items);
}

function deleteHistoryItem(type, id) {
  if (type === 'ingreso' || type === 'egreso') {
    if (!confirm('¿Estás seguro de que deseas eliminar este registro financiero?')) return;
    const baseKey = type === 'ingreso' ? 'recim_ingresos' : 'recim_egresos';
    const list = JSON.parse(localStorage.getItem(userKey(baseKey)) || '[]').filter(e => e.id !== id);
    localStorage.setItem(userKey(baseKey), JSON.stringify(list));
    showToast('Registro financiero eliminado con éxito', 'success');
  } else {
    if (!confirm(t('confirm.del_inv'))) return;
    const invoices = getAllInvoices().filter(i => i.id !== id);
    localStorage.setItem(userKey('recim_invoices'), JSON.stringify(invoices));
    showToast(t('toast.del_inv'), 'success');
  }
  rerenderCurrentPage();
}

function clearHistory() {
  if (!confirm('¿Estás seguro de que deseas limpiar todo el historial (Facturas, Bitácoras, Ingresos y Egresos)?')) return;
  localStorage.setItem(userKey('recim_invoices'), JSON.stringify([]));
  localStorage.setItem(userKey('recim_ingresos'), JSON.stringify([]));
  localStorage.setItem(userKey('recim_egresos'), JSON.stringify([]));
  if (typeof forceSync === 'function') forceSync();
  showToast('Todo el historial ha sido limpiado', 'success');
  rerenderCurrentPage();
}

// ---- Date formatters (Global) ----
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateTime(isoStr) {
  if (!isoStr) return '—';
  const lang = (getSettings().language) || 'es';
  const d = new Date(isoStr);
  return d.toLocaleDateString(lang, { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
}

function exportFilteredHistoryToExcel() {
    const typeFilter = document.getElementById('history-filter-type')?.value || 'all';
    const searchQuery = (document.getElementById('history-search')?.value || '').toLowerCase().trim();
    let items = getAllHistoryItems();

    if (typeFilter !== 'all') items = items.filter(i => i.type === typeFilter);
    if (searchQuery) items = items.filter(i =>
        (i.id || '').toLowerCase().includes(searchQuery) ||
        (i.client || '').toLowerCase().includes(searchQuery) ||
        (i.company || '').toLowerCase().includes(searchQuery) ||
        (i.concept || '').toLowerCase().includes(searchQuery)
    );

    if (items.length === 0) {
        showToast('⚠️ No hay datos para exportar', 'warning');
        return;
    }

    if (typeFilter === 'basica') {
        exportBitacorasListToExcel(items.filter(i => i.type === 'basica'));
    } else {
        exportSelectedDataToExcel({ invoices: true }); 
    }
}

function handleHistoryImportExcel(input) {
  const file = input.files[0];
  if (!file) return;
  
  if (confirm('¿Importar datos desde este archivo? Los datos actuales de ingresos, egresos y facturas podrían ser sobrescritos.')) {
    if (typeof importExcelData === 'function') {
      importExcelData(file);
    } else {
      showToast('❌ Error: Función de importación no disponible.', 'error');
    }
  }
  input.value = '';
}
