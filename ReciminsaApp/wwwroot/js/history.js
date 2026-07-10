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

function applyDateFilter(items) {
  window.currentHistoryDateFilter = window.currentHistoryDateFilter || 'all';
  if (window.currentHistoryDateFilter === 'all') return items;
  
  const today = new Date();
  today.setHours(0,0,0,0);
  
  return items.filter(i => {
      if (!i.date) return false;
      const parts = i.date.split('-');
      const itemDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      itemDate.setHours(0,0,0,0);
      
      if (window.currentHistoryDateFilter === 'today') {
          return itemDate.getTime() === today.getTime();
      } else if (window.currentHistoryDateFilter === 'week') {
          const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          return itemDate >= oneWeekAgo && itemDate <= today;
      } else if (window.currentHistoryDateFilter === 'month') {
          return itemDate.getMonth() === today.getMonth() && itemDate.getFullYear() === today.getFullYear();
      } else if (window.currentHistoryDateFilter === 'last_month') {
          const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          return itemDate.getMonth() === lastMonth.getMonth() && itemDate.getFullYear() === lastMonth.getFullYear();
      }
      return true;
  });
}

function setHistoryDateFilter(filterName) {
  window.currentHistoryDateFilter = filterName;
  const container = document.getElementById('page-historial');
  if (container) {
    renderHistoryPage(container);
  }
}
window.setHistoryDateFilter = setHistoryDateFilter;

function renderHistoryPage(container) {
  const allItems = getAllHistoryItems();
  const items = applyDateFilter(allItems);

  const currentFilter = window.currentHistoryDateFilter || 'all';

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="section-title">${t('hist.title')}<span class="version-indicator-mobile">v1.1.0</span></h2>
        <p class="section-subtitle">${t('hist.subtitle')}</p>
      </div>
    </div>

    <!-- Quick Date Filters -->
    <div class="history-date-filters" style="display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap; background:var(--clr-surface-2); padding:10px; border:1px solid var(--clr-border); border-radius:var(--r-md);">
      <button class="btn-secondary" style="padding:6px 12px; font-size:0.8rem; border-radius:6px; cursor:pointer; font-weight:600; border:1px solid var(--clr-border); ${currentFilter === 'all' ? 'background:var(--clr-primary);color:white;border-color:var(--clr-primary);' : 'background:var(--clr-surface-3);color:var(--clr-text);'}" onclick="setHistoryDateFilter('all')">Todos</button>
      <button class="btn-secondary" style="padding:6px 12px; font-size:0.8rem; border-radius:6px; cursor:pointer; font-weight:600; border:1px solid var(--clr-border); ${currentFilter === 'today' ? 'background:var(--clr-primary);color:white;border-color:var(--clr-primary);' : 'background:var(--clr-surface-3);color:var(--clr-text);'}" onclick="setHistoryDateFilter('today')">Hoy</button>
      <button class="btn-secondary" style="padding:6px 12px; font-size:0.8rem; border-radius:6px; cursor:pointer; font-weight:600; border:1px solid var(--clr-border); ${currentFilter === 'week' ? 'background:var(--clr-primary);color:white;border-color:var(--clr-primary);' : 'background:var(--clr-surface-3);color:var(--clr-text);'}" onclick="setHistoryDateFilter('week')">Esta semana</button>
      <button class="btn-secondary" style="padding:6px 12px; font-size:0.8rem; border-radius:6px; cursor:pointer; font-weight:600; border:1px solid var(--clr-border); ${currentFilter === 'month' ? 'background:var(--clr-primary);color:white;border-color:var(--clr-primary);' : 'background:var(--clr-surface-3);color:var(--clr-text);'}" onclick="setHistoryDateFilter('month')">Este mes</button>
      <button class="btn-secondary" style="padding:6px 12px; font-size:0.8rem; border-radius:6px; cursor:pointer; font-weight:600; border:1px solid var(--clr-border); ${currentFilter === 'last_month' ? 'background:var(--clr-primary);color:white;border-color:var(--clr-primary);' : 'background:var(--clr-surface-3);color:var(--clr-text);'}" onclick="setHistoryDateFilter('last_month')">Mes anterior</button>
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

    <!-- Visual Dashboard Toggle Button -->
    <div style="margin-bottom:14px;">
      <button class="btn-secondary" onclick="toggleVisualDashboard()" style="width:100%; justify-content:center; font-weight:600; padding:10px 14px; cursor:pointer; display:flex; align-items:center; gap:8px; border-radius:8px; border:1px solid var(--clr-border); background:var(--clr-surface-2); color:var(--clr-text);">
        📊 <span id="visual-dashboard-toggle-text">Ver Análisis Visual (Gráficos)</span>
      </button>
    </div>

    <!-- Visual Dashboard Card (collapsible) -->
    <div id="visual-dashboard-card" class="card" style="display:none; flex-direction:column; gap:24px; margin-bottom:14px; padding:20px; border-radius:12px; border:1px solid var(--clr-border); background:var(--clr-surface);">
      <!-- SVG Charts injected here dynamically -->
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
          <button class="btn-secondary" onclick="event.stopPropagation(); exportarExcelResiduos(${isBasica ? 'getAllHistoryItems' : 'getAllInvoices'}().find(i => i.id === '${inv.id}'))">📊 Excel</button>
          <button class="btn-secondary" onclick="event.stopPropagation(); generateInvoicePDF(${isBasica ? 'getAllHistoryItems' : 'getAllInvoices'}().find(i => i.id === '${inv.id}'))">📄 PDF</button>
          <button class="btn-secondary btn-whatsapp" onclick="event.stopPropagation(); shareInvoiceViaWhatsApp('${inv.id}')" style="padding: 4px 8px; font-size: 0.75rem; font-weight: 600; min-width: 65px; background:#25d366; color:white; border-color:#25d366;" title="Enviar por WhatsApp">💬 WhatsApp</button>
        ` : ''}
        <button class="btn-danger" onclick="event.stopPropagation(); deleteHistoryItem('${inv.type}', '${inv.id}')">${t('hist.del_inv')}</button>
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
  let items = applyDateFilter(getAllHistoryItems());

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

function shareInvoiceViaWhatsApp(invoiceId) {
  const allItems = getAllHistoryItems();
  const inv = allItems.find(i => i.id === invoiceId);
  if (!inv) return;

  const clientName = inv.company || inv.client || 'Consumidor Final';
  const totalVal = inv.total;
  
  // Format money safely
  let totalFmt = '';
  if (typeof formatMoney === 'function') {
    totalFmt = formatMoney(totalVal);
  } else {
    totalFmt = 'RD$ ' + parseFloat(totalVal || 0).toFixed(2);
  }

  const text = `Hola *${clientName}*,\n\nGracias por reciclar con nosotros. Aquí tienes el detalle de tu recibo/factura *${inv.id}* por un monto de *${totalFmt}*.\n\n_Un respiro al planeta, un residuo a la vez._`;

  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}
window.shareInvoiceViaWhatsApp = shareInvoiceViaWhatsApp;

function toggleVisualDashboard() {
  const card = document.getElementById('visual-dashboard-card');
  const toggleText = document.getElementById('visual-dashboard-toggle-text');
  if (!card || !toggleText) return;
  
  const isHidden = card.style.display === 'none';
  if (isHidden) {
    card.style.display = 'flex';
    toggleText.textContent = 'Ocultar Análisis Visual (Gráficos)';
    renderVisualDashboardCharts();
  } else {
    card.style.display = 'none';
    toggleText.textContent = 'Ver Análisis Visual (Gráficos)';
  }
}
window.toggleVisualDashboard = toggleVisualDashboard;

function renderVisualDashboardCharts() {
  const card = document.getElementById('visual-dashboard-card');
  if (!card) return;
  
  // Get active filtered items
  const typeFilter = document.getElementById('history-filter-type')?.value || 'all';
  const searchQuery = (document.getElementById('history-search')?.value || '').toLowerCase().trim();
  let items = applyDateFilter(getAllHistoryItems());

  if (typeFilter !== 'all') items = items.filter(i => i.type === typeFilter);
  if (searchQuery) items = items.filter(i =>
    (i.id || '').toLowerCase().includes(searchQuery) ||
    (i.client || '').toLowerCase().includes(searchQuery) ||
    (i.company || '').toLowerCase().includes(searchQuery) ||
    (i.concept || '').toLowerCase().includes(searchQuery) ||
    (i.category || '').toLowerCase().includes(searchQuery)
  );

  if (items.length === 0) {
    card.innerHTML = `<div style="text-align:center; color:var(--clr-text-muted); padding:20px; font-size:0.85rem;">No hay registros para mostrar gráficos de análisis.</div>`;
    return;
  }

  // --- 1. Bar Chart Data Aggregation (Monthly Income vs Expense) ---
  const monthly = {};
  items.forEach(i => {
    if (!i.date) return;
    const monthKey = i.date.substring(0, 7); // 'YYYY-MM'
    if (!monthly[monthKey]) monthly[monthKey] = { income: 0, expense: 0 };
    if (i.type === 'ingreso' || i.itemType === 'invoice') {
      monthly[monthKey].income += i.total || 0;
    } else if (i.type === 'egreso') {
      monthly[monthKey].expense += i.total || 0;
    }
  });

  const sortedMonths = Object.keys(monthly).sort().slice(-6); // last 6 months
  let maxVal = 1000;
  sortedMonths.forEach(m => {
    maxVal = Math.max(maxVal, monthly[m].income, monthly[m].expense);
  });

  // Render month names helper
  const monthNamesFmt = {
    '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun',
    '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic'
  };

  // Generate Bar SVG Rectangles
  let barSvgContent = '';
  const startX = 40;
  const spacingX = 55;
  const graphHeight = 120;
  const zeroY = 140;

  sortedMonths.forEach((m, idx) => {
    const xPos = startX + idx * spacingX;
    const incVal = monthly[m].income;
    const expVal = monthly[m].expense;
    
    const incHeight = Math.max(2, (incVal / maxVal) * graphHeight);
    const expHeight = Math.max(2, (expVal / maxVal) * graphHeight);
    
    const incY = zeroY - incHeight;
    const expY = zeroY - expHeight;
    
    const [y, mm] = m.split('-');
    const label = monthNamesFmt[mm] || mm;
    
    barSvgContent += `
      <!-- Income Bar -->
      <rect x="${xPos}" y="${incY}" width="14" height="${incHeight}" rx="3" fill="url(#incomeGrad)" />
      <!-- Expense Bar -->
      <rect x="${xPos + 18}" y="${expY}" width="14" height="${expHeight}" rx="3" fill="url(#expenseGrad)" />
      <!-- Labels -->
      <text x="${xPos + 16}" y="160" font-size="9" fill="var(--clr-text-muted)" text-anchor="middle" font-family="sans-serif">${label}</text>
    `;
  });

  // Bar Chart Title and Legend
  const barChartHtml = `
    <div style="flex:1; min-width:280px; display:flex; flex-direction:column; gap:10px;">
      <h4 style="margin:0; font-size:0.9rem; font-weight:700; color:var(--clr-text);">📈 Ingresos vs. Egresos (Mensual)</h4>
      <div style="display:flex; gap:12px; font-size:0.75rem; font-weight:600; margin-bottom:4px;">
        <span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:10px; height:10px; border-radius:3px; background:#10b981; display:inline-block;"></span>Ingresos</span>
        <span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:10px; height:10px; border-radius:3px; background:#ef4444; display:inline-block;"></span>Egresos</span>
      </div>
      <svg width="100%" viewBox="0 0 380 180" style="background:var(--clr-surface-2); border:1px solid var(--clr-border); border-radius:8px;">
        <defs>
          <linearGradient id="incomeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#10b981" />
            <stop offset="100%" stop-color="#059669" />
          </linearGradient>
          <linearGradient id="expenseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#ef4444" />
            <stop offset="100%" stop-color="#dc2626" />
          </linearGradient>
        </defs>
        
        <!-- Y-Axis Grid Lines -->
        <line x1="35" y1="20" x2="360" y2="20" stroke="var(--clr-border)" stroke-width="0.5" stroke-dasharray="2,2" />
        <line x1="35" y1="80" x2="360" y2="80" stroke="var(--clr-border)" stroke-width="0.5" stroke-dasharray="2,2" />
        <line x1="35" y1="140" x2="360" y2="140" stroke="var(--clr-border)" stroke-width="1" />
        
        <!-- Y-Axis labels -->
        <text x="30" y="23" font-size="8" fill="var(--clr-text-muted)" text-anchor="end" font-family="sans-serif">${safeFormatMoney(maxVal).replace('RD$', '').trim()}</text>
        <text x="30" y="83" font-size="8" fill="var(--clr-text-muted)" text-anchor="end" font-family="sans-serif">${safeFormatMoney(maxVal/2).replace('RD$', '').trim()}</text>
        <text x="30" y="143" font-size="8" fill="var(--clr-text-muted)" text-anchor="end" font-family="sans-serif">0</text>
        
        ${barSvgContent}
      </svg>
    </div>
  `;

  // --- 2. Donut Chart Data Aggregation (Expenses Categories) ---
  const catTotals = {};
  let totalExpenses = 0;
  items.forEach(i => {
    if (i.type === 'egreso') {
      const cat = i.category || 'Otros';
      catTotals[cat] = (catTotals[cat] || 0) + i.total;
      totalExpenses += i.total;
    }
  });

  const sortedCats = Object.entries(catTotals).sort((a,b) => b[1]-a[1]);
  const catColors = ['#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#10b981', '#6b7280'];

  let donutSvgContent = '';
  let accumulatedPct = 0;
  const perimeter = 2 * Math.PI * 60; // 376.99

  sortedCats.forEach(([cat, amt], idx) => {
    const pct = amt / totalExpenses;
    const strokeLen = pct * perimeter;
    const strokeOffset = perimeter - (accumulatedPct * perimeter);
    const color = catColors[idx % catColors.length];
    
    donutSvgContent += `
      <circle cx="100" cy="100" r="60" fill="transparent" stroke="${color}" stroke-width="18" 
              stroke-dasharray="${strokeLen} ${perimeter}" stroke-dashoffset="${strokeOffset}" 
              transform="rotate(-90 100 100)" />
    `;
    accumulatedPct += pct;
  });

  // Fallback if no expenses
  let expenseChartHtml = '';
  if (totalExpenses === 0) {
    expenseChartHtml = `
      <div style="flex:1; min-width:280px; display:flex; flex-direction:column; gap:10px;">
        <h4 style="margin:0; font-size:0.9rem; font-weight:700; color:var(--clr-text);">💸 Gastos por Categoría</h4>
        <div style="display:flex; align-items:center; justify-content:center; height:180px; background:var(--clr-surface-2); border:1px solid var(--clr-border); border-radius:8px; font-size:0.8rem; color:var(--clr-text-muted);">
          No hay gastos registrados en este rango de fechas.
        </div>
      </div>
    `;
  } else {
    // Generate Legend Rows
    const legendRows = sortedCats.map(([cat, amt], idx) => {
      const pct = Math.round((amt / totalExpenses) * 100);
      const color = catColors[idx % catColors.length];
      return `
        <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.75rem; gap:12px;">
          <span style="display:inline-flex; align-items:center; gap:6px; font-weight:600;"><span style="width:8px; height:8px; border-radius:2px; background:${color}; display:inline-block;"></span>${cat}</span>
          <span style="color:var(--clr-text-muted);">${formatMoney(amt)} (${pct}%)</span>
        </div>
      `;
    }).join('');

    expenseChartHtml = `
      <div style="flex:1; min-width:280px; display:flex; flex-direction:column; gap:10px;">
        <h4 style="margin:0; font-size:0.9rem; font-weight:700; color:var(--clr-text);">💸 Gastos por Categoría (Total: ${formatMoney(totalExpenses)})</h4>
        <div style="display:flex; flex-wrap:wrap; gap:16px; align-items:center; background:var(--clr-surface-2); border:1px solid var(--clr-border); border-radius:8px; padding:12px;">
          <svg width="150" height="150" viewBox="0 0 200 200" style="flex-shrink:0;">
            <!-- Background base circle -->
            <circle cx="100" cy="100" r="60" fill="transparent" stroke="var(--clr-border)" stroke-width="18" />
            ${donutSvgContent}
            <!-- Inner white cut-out -->
            <circle cx="100" cy="100" r="50" fill="var(--clr-surface-2)" />
          </svg>
          <div style="flex:1; display:flex; flex-direction:column; gap:6px; min-width:140px;">
            ${legendRows}
          </div>
        </div>
      </div>
    `;
  }

  // Combine Grid HTML
  card.innerHTML = `
    <div style="display:flex; flex-wrap:wrap; gap:20px;">
      ${barChartHtml}
      ${expenseChartHtml}
    </div>
  `;
}
window.renderVisualDashboardCharts = renderVisualDashboardCharts;
