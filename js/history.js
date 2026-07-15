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
  const isEn = (getSettings().language === 'en');

  const currentFilter = window.currentHistoryDateFilter || 'all';

  container.innerHTML = `
    <!-- MAIN VIEW -->
    <div id="history-main-view" style="display: block;">
      <div class="page-header">
        <div>
          <h2 class="section-title">${t('hist.title')}<span class="version-indicator-mobile">v1.1.0</span></h2>
          <p class="section-subtitle">${t('hist.subtitle')}</p>
        </div>
      </div>

      <!-- Quick Date Filters -->
      <div class="history-date-filters" style="display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap; background:var(--clr-surface-2); padding:10px; border:1px solid var(--clr-border); border-radius:var(--r-md);">
        <button class="btn-secondary" style="padding:6px 12px; font-size:0.8rem; border-radius:6px; cursor:pointer; font-weight:600; border:1px solid var(--clr-border); ${currentFilter === 'all' ? 'background:var(--clr-primary);color:white;border-color:var(--clr-primary);' : 'background:var(--clr-surface-3);color:var(--clr-text);'}" onclick="setHistoryDateFilter('all')">${t('hist.filter_all')}</button>
        <button class="btn-secondary" style="padding:6px 12px; font-size:0.8rem; border-radius:6px; cursor:pointer; font-weight:600; border:1px solid var(--clr-border); ${currentFilter === 'today' ? 'background:var(--clr-primary);color:white;border-color:var(--clr-primary);' : 'background:var(--clr-surface-3);color:var(--clr-text);'}" onclick="setHistoryDateFilter('today')">${t('hist.filter_today')}</button>
        <button class="btn-secondary" style="padding:6px 12px; font-size:0.8rem; border-radius:6px; cursor:pointer; font-weight:600; border:1px solid var(--clr-border); ${currentFilter === 'week' ? 'background:var(--clr-primary);color:white;border-color:var(--clr-primary);' : 'background:var(--clr-surface-3);color:var(--clr-text);'}" onclick="setHistoryDateFilter('week')">${t('hist.filter_week')}</button>
        <button class="btn-secondary" style="padding:6px 12px; font-size:0.8rem; border-radius:6px; cursor:pointer; font-weight:600; border:1px solid var(--clr-border); ${currentFilter === 'month' ? 'background:var(--clr-primary);color:white;border-color:var(--clr-primary);' : 'background:var(--clr-surface-3);color:var(--clr-text);'}" onclick="setHistoryDateFilter('month')">${t('hist.filter_month')}</button>
        <button class="btn-secondary" style="padding:6px 12px; font-size:0.8rem; border-radius:6px; cursor:pointer; font-weight:600; border:1px solid var(--clr-border); ${currentFilter === 'last_month' ? 'background:var(--clr-primary);color:white;border-color:var(--clr-primary);' : 'background:var(--clr-surface-3);color:var(--clr-text);'}" onclick="setHistoryDateFilter('last_month')">${t('hist.filter_last_month')}</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">${t('hist.total_inv')}</div>
          <div class="stat-value stat-value--blue">${items.filter(i => i.itemType === 'invoice').length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${t('hist.income_count')}</div>
          <div class="stat-value stat-value--green">${items.filter(i => i.type === 'ingreso').length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${t('hist.expense_count')}</div>
          <div class="stat-value stat-value--red">${items.filter(i => i.type === 'egreso').length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${t('hist.logs_count')}</div>
          <div class="stat-value stat-value--green">${items.filter(i => i.type === 'basica').length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${t('hist.total_val')}</div>
          <div class="stat-value stat-value--green">${formatMoney(items.filter(i => i.itemType === 'invoice').reduce((s, i) => s + i.total, 0))}</div>
        </div>
      </div>

      <!-- Trading Dashboard Button (Premium Styling) -->
      <div style="margin-bottom:14px;">
        <button class="btn-primary" onclick="showTradingDashboard()" style="width:100%; justify-content:center; font-weight:700; padding:12px 14px; cursor:pointer; display:flex; align-items:center; gap:8px; border-radius:8px; background:linear-gradient(135deg, #3b82f6, #8b5cf6); border:none; color:white; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);">
          📈 Gráficos Estadísticos
        </button>
      </div>

      <div class="history-filters">
        <select id="history-filter-type" class="form-select" style="width:auto;" onchange="filterHistory()">
          <option value="all">${isEn ? 'Show All' : 'Ver Todo'}</option>
          <option value="bitacoras">${isEn ? 'Bitacoras (Logs)' : 'Bitácoras'}</option>
          <option value="facturas">${isEn ? 'Invoices' : 'Facturas'}</option>
          <option value="finanzas">${isEn ? 'Finances' : 'Finanzas'}</option>
        </select>
        <input id="history-search" type="text" class="form-input" style="width:auto;min-width:200px;" placeholder="${t('hist.search')}" oninput="filterHistory()" />
        <button class="btn-secondary" onclick="exportFilteredHistoryToExcel()">${t('hist.export_excel')}</button>
        <input type="file" id="history-import-excel-input" accept=".xlsx, .xls" style="display:none;" onchange="handleHistoryImportExcel(this)" />
        <button class="btn-secondary" onclick="document.getElementById('history-import-excel-input').click()">${t('hist.import_excel')}</button>
        <button class="btn-danger" onclick="clearHistory()">${t('hist.clear_all')}</button>
      </div>

      <div id="history-list">
        ${renderInvoiceCards(items)}
      </div>
    </div>

    <!-- TRADING VIEW (Hidden initially) -->
    <div id="history-trading-view" style="display: none; flex-direction: column; gap: 20px; width: 100%;">
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

  const monthNames = {};
  for (let i = 1; i <= 12; i++) {
    const k = String(i).padStart(2, '0');
    monthNames[k] = t('hist.month_' + k);
  }

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
    badge = `<span class="badge badge--green">${t('hist.badge_log')}</span>`;
    icon = '🚛';
  } else if (isLocal) {
    badge = `<span class="badge badge--blue">${t('hist.badge_local')}</span>`;
    icon = '🏠';
  } else if (isIngreso) {
    badge = `<span class="badge badge--green">${t('hist.badge_income')}</span>`;
    icon = '💰';
  } else if (isEgreso) {
    badge = `<span class="badge badge--red">${t('hist.badge_expense')}</span>`;
    icon = '💸';
  } else {
    badge = `<span class="badge badge--yellow">${t('hist.badge_biz')}</span>`;
    icon = '🏢';
  }

  let itemRows = '';
  if (isIngreso || isEgreso) {
    itemRows = `
      <tr>
        <td><b>${t('lbl.concept')}</b></td>
        <td colspan="3">${inv.concept}</td>
      </tr>
      ${inv.category ? `
      <tr>
        <td><b>${t('lbl.category')}</b></td>
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
        <p style="margin: 4px 0;"><b>${t('lbl.concept')}:</b> ${inv.concept || '—'}</p>
        <p style="margin: 4px 0;"><b>${t('lbl.category')}:</b> ${inv.category || t('hist.category_general')}</p>
        ${inv.notes ? `<p style="margin: 4px 0;"><b>${t('lbl.notes')}:</b> ${inv.notes}</p>` : ''}
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

  if (typeFilter === 'bitacoras') {
    items = items.filter(i => i.type === 'basica');
  } else if (typeFilter === 'facturas') {
    items = items.filter(i => i.type === 'local' || i.type === 'empresa');
  } else if (typeFilter === 'finanzas') {
    items = items.filter(i => i.itemType === 'ingreso' || i.itemType === 'egreso');
  }
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

    if (typeFilter === 'bitacoras') {
        items = items.filter(i => i.type === 'basica');
    } else if (typeFilter === 'facturas') {
        items = items.filter(i => i.type === 'local' || i.type === 'empresa');
    } else if (typeFilter === 'finanzas') {
        items = items.filter(i => i.itemType === 'ingreso' || i.itemType === 'egreso');
    }
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

    if (typeFilter === 'bitacoras') {
        exportBitacorasListToExcel(items);
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
    toggleText.textContent = t('hist.hide_charts');
    renderVisualDashboardCharts();
  } else {
    card.style.display = 'none';
    toggleText.textContent = t('hist.show_charts');
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

  if (typeFilter === 'bitacoras') {
    items = items.filter(i => i.type === 'basica');
  } else if (typeFilter === 'facturas') {
    items = items.filter(i => i.type === 'local' || i.type === 'empresa');
  } else if (typeFilter === 'finanzas') {
    items = items.filter(i => i.itemType === 'ingreso' || i.itemType === 'egreso');
  }
  if (searchQuery) items = items.filter(i =>
    (i.id || '').toLowerCase().includes(searchQuery) ||
    (i.client || '').toLowerCase().includes(searchQuery) ||
    (i.company || '').toLowerCase().includes(searchQuery) ||
    (i.concept || '').toLowerCase().includes(searchQuery) ||
    (i.category || '').toLowerCase().includes(searchQuery)
  );

  if (items.length === 0) {
    card.innerHTML = `<div style="text-align:center; color:var(--clr-text-muted); padding:20px; font-size:0.85rem;">${t('hist.no_chart_data')}</div>`;
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
    const label = t('hist.month_' + mm).substring(0, 3);
    
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
      <h4 style="margin:0; font-size:0.9rem; font-weight:700; color:var(--clr-text);">📈 ${t('hist.income_vs_expenses')}</h4>
      <div style="display:flex; gap:12px; font-size:0.75rem; font-weight:600; margin-bottom:4px;">
        <span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:10px; height:10px; border-radius:3px; background:#10b981; display:inline-block;"></span>${t('hist.income')}</span>
        <span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:10px; height:10px; border-radius:3px; background:#ef4444; display:inline-block;"></span>${t('hist.expenses')}</span>
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

// =============================================
// TRADING VIEW DASHBOARD (VERSION 1.16.0)
// =============================================

function safeFormatMoney(val) {
  if (typeof formatMoney === 'function') {
    return formatMoney(val);
  }
  return 'RD$ ' + parseFloat(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showTradingDashboard() {
  const mainView = document.getElementById('history-main-view');
  const tradingView = document.getElementById('history-trading-view');
  if (mainView && tradingView) {
    mainView.style.display = 'none';
    tradingView.style.display = 'flex';
    renderTradingDashboardShell();
  }
}
window.showTradingDashboard = showTradingDashboard;

function hideTradingDashboard() {
  const mainView = document.getElementById('history-main-view');
  const tradingView = document.getElementById('history-trading-view');
  if (mainView && tradingView) {
    tradingView.style.display = 'none';
    mainView.style.display = 'block';
  }
}
window.hideTradingDashboard = hideTradingDashboard;

function renderTradingDashboardShell() {
  const container = document.getElementById('history-trading-view');
  if (!container) return;

  const families = (typeof getMaterialFamilies === 'function') ? getMaterialFamilies() : [];
  let familyOptions = '';
  families.forEach((f, idx) => {
    familyOptions += `<option value="${f.id}" ${idx === 0 ? 'selected' : ''}>📁 ${f.name}</option>`;
  });

  container.innerHTML = `
    <div style="width:100%; display:flex; flex-direction:column; gap:20px;">
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap: 10px;">
        <div>
          <h2 class="section-title">📊 Panel de Estadísticas (Trading Style)</h2>
          <p class="section-subtitle">Visualización analítica premium de tu negocio en tiempo real</p>
        </div>
        <button class="btn-secondary" onclick="hideTradingDashboard()" style="padding:8px 14px; font-weight:600; font-size:0.85rem; border-radius: 8px;">
          ⬅️ Volver al Historial
        </button>
      </div>

      <div class="card card--elevated" style="background:#0b0f19; border:1px solid #1f2937; padding:24px; border-radius:16px; color:#f3f4f6; display:flex; flex-direction:column; gap:20px;">
        <!-- Controls row -->
        <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
          <div class="form-group" style="margin:0; width:250px;">
            <label class="form-label" style="color:#9ca3af; font-size:0.78rem; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">Categoría Analítica</label>
            <select id="trading-main-select" class="form-select" style="background:#111827; border-color:#374151; color:#fff; height:42px;" onchange="onTradingMainSelectChange(this.value)">
              <option value="finanzas">📈 Finanzas (Ingresos vs Egresos)</option>
              <option value="materiales">🏷️ Materiales por Familias</option>
              <option value="colaboradores">👥 Actividad de Colaboradores</option>
              <option value="bitacoras">🚛 Registro de Bitácoras</option>
              <option value="facturas">🧾 Registro de Facturas</option>
            </select>
          </div>

          <!-- Secondary select for families, shown ONLY when main select is "materiales" -->
          <div id="trading-family-select-group" class="form-group" style="margin:0; width:250px; display:none;">
            <label class="form-label" style="color:#9ca3af; font-size:0.78rem; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">Seleccionar Familia</label>
            <select id="trading-family-select" class="form-select" style="background:#111827; border-color:#374151; color:#fff; height:42px;" onchange="renderTradingChart('materiales')">
              ${familyOptions || '<option value="">-- No hay familias --</option>'}
            </select>
          </div>
        </div>

        <!-- Chart Screen Area -->
        <div id="trading-chart-container" style="background:#111827; border:1px solid #1f2937; border-radius:12px; padding:24px; min-height:420px; display:flex; flex-direction:column; justify-content:center;">
          <!-- Dynamic Chart Content -->
        </div>
      </div>
    </div>
  `;

  renderTradingChart('finanzas');
}
window.renderTradingDashboardShell = renderTradingDashboardShell;

function onTradingMainSelectChange(val) {
  const familyGroup = document.getElementById('trading-family-select-group');
  if (familyGroup) {
    familyGroup.style.display = (val === 'materiales') ? 'block' : 'none';
  }
  renderTradingChart(val);
}
window.onTradingMainSelectChange = onTradingMainSelectChange;

function renderTradingChart(category) {
  const allItems = getAllHistoryItems();
  const items = applyDateFilter(allItems);

  if (category === 'finanzas') {
    drawTradingFinanzasChart(items);
  } else if (category === 'materiales') {
    drawTradingMaterialesChart(items);
  } else if (category === 'colaboradores') {
    drawTradingColaboradoresChart(items);
  } else if (category === 'bitacoras') {
    drawTradingVolumeChart(items, 'bitacoras');
  } else if (category === 'facturas') {
    drawTradingVolumeChart(items, 'facturas');
  }
}
window.renderTradingChart = renderTradingChart;

function drawTradingFinanzasChart(items) {
  const container = document.getElementById('trading-chart-container');
  if (!container) return;

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

  const sortedMonths = Object.keys(monthly).sort().slice(-6);
  if (sortedMonths.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:#9ca3af; padding:40px;">No hay datos financieros registrados en este rango de fechas.</div>`;
    return;
  }

  let maxVal = 1000;
  sortedMonths.forEach(m => {
    maxVal = Math.max(maxVal, monthly[m].income, monthly[m].expense);
  });

  let barSvgContent = '';
  const startX = 60;
  const spacingX = 80;
  const graphHeight = 150;
  const zeroY = 200;

  sortedMonths.forEach((m, idx) => {
    const xPos = startX + idx * spacingX;
    const incVal = monthly[m].income;
    const expVal = monthly[m].expense;
    
    const incHeight = Math.max(3, (incVal / maxVal) * graphHeight);
    const expHeight = Math.max(3, (expVal / maxVal) * graphHeight);
    
    const incY = zeroY - incHeight;
    const expY = zeroY - expHeight;
    
    const [y, mm] = m.split('-');
    const label = t('hist.month_' + mm).substring(0, 3).toUpperCase();
    
    barSvgContent += `
      <!-- Income Bar (Neon Green with glow) -->
      <rect x="${xPos}" y="${incY}" width="18" height="${incHeight}" rx="4" fill="url(#neonGreenGrad)" filter="url(#glow)" />
      <!-- Expense Bar (Neon Red/Pink with glow) -->
      <rect x="${xPos + 24}" y="${expY}" width="18" height="${expHeight}" rx="4" fill="url(#neonRedGrad)" filter="url(#glow)" />
      
      <!-- Value Labels -->
      <text x="${xPos + 9}" y="${incY - 6}" font-size="8" fill="#00ffcc" text-anchor="middle" font-family="monospace">${safeFormatMoney(incVal).replace('RD$', '').trim()}</text>
      <text x="${xPos + 33}" y="${expY - 6}" font-size="8" fill="#ff0055" text-anchor="middle" font-family="monospace">${safeFormatMoney(expVal).replace('RD$', '').trim()}</text>
      
      <!-- X Axis Labels -->
      <text x="${xPos + 21}" y="225" font-size="9" fill="#9ca3af" text-anchor="middle" font-family="monospace" font-weight="bold">${label}</text>
    `;
  });

  const chartHtml = `
    <div style="display:flex; flex-direction:column; gap:16px; width:100%;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1f2937; padding-bottom:12px; flex-wrap:wrap; gap:10px;">
        <h4 style="margin:0; font-size:1.1rem; font-weight:700; color:#fff;">📊 Balance de Caja (Últimos 6 meses)</h4>
        <div style="display:flex; gap:16px; font-size:0.8rem; font-weight:600;">
          <span style="display:inline-flex; align-items:center; gap:6px; color:#00ffcc;"><span style="width:10px; height:10px; border-radius:3px; background:#00ffcc; display:inline-block; box-shadow: 0 0 8px #00ffcc;"></span>Ingresos</span>
          <span style="display:inline-flex; align-items:center; gap:6px; color:#ff0055;"><span style="width:10px; height:10px; border-radius:3px; background:#ff0055; display:inline-block; box-shadow: 0 0 8px #ff0055;"></span>Egresos</span>
        </div>
      </div>

      <svg width="100%" height="250" viewBox="0 0 600 250" style="background:#0e1321; border-radius:12px; overflow:visible;">
        <defs>
          <linearGradient id="neonGreenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#00ffcc" />
            <stop offset="100%" stop-color="#00aa88" />
          </linearGradient>
          <linearGradient id="neonRedGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#ff0055" />
            <stop offset="100%" stop-color="#990033" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        <line x1="50" y1="50" x2="560" y2="50" stroke="#1f2937" stroke-width="0.5" stroke-dasharray="3,3" />
        <line x1="50" y1="125" x2="560" y2="125" stroke="#1f2937" stroke-width="0.5" stroke-dasharray="3,3" />
        <line x1="50" y1="200" x2="560" y2="200" stroke="#374151" stroke-width="1.5" />
        
        <text x="40" y="53" font-size="8" fill="#6b7280" text-anchor="end" font-family="monospace">${safeFormatMoney(maxVal).replace('RD$', '').trim()}</text>
        <text x="40" y="128" font-size="8" fill="#6b7280" text-anchor="end" font-family="monospace">${safeFormatMoney(maxVal/2).replace('RD$', '').trim()}</text>
        <text x="40" y="203" font-size="8" fill="#6b7280" text-anchor="end" font-family="monospace">0</text>
        
        ${barSvgContent}
      </svg>
    </div>
  `;

  container.innerHTML = chartHtml;
}

function drawTradingMaterialesChart(items) {
  const container = document.getElementById('trading-chart-container');
  const familySelect = document.getElementById('trading-family-select');
  if (!container || !familySelect) return;

  const familyId = familySelect.value;
  if (!familyId) {
    container.innerHTML = `<div style="text-align:center; color:#9ca3af; padding:40px;">Por favor, selecciona o crea una familia de materiales primero.</div>`;
    return;
  }

  const families = (typeof getMaterialFamilies === 'function') ? getMaterialFamilies() : [];
  const family = families.find(f => f.id === familyId);
  const familyName = family ? family.name : 'Familia';

  const customCodes = (typeof getCustomCodes === 'function') ? getCustomCodes() : [];
  const familyMaterials = customCodes.filter(c => c.familyId === familyId);

  if (familyMaterials.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:#9ca3af; padding:40px;">No hay materiales asociados a la familia <b>${familyName}</b>. Ve a la sección de Códigos de Materiales para asociar códigos a esta familia.</div>`;
    return;
  }

  const totals = {};
  familyMaterials.forEach(m => {
    totals[m.id] = { name: m.name, code: m.code, qty: 0, unit: m.unit || 'kg' };
  });

  items.forEach(i => {
    if (i.type === 'basica' && Array.isArray(i.items)) {
      i.items.forEach(item => {
        const match = familyMaterials.find(fm => fm.id === item.matId || fm.name.toLowerCase() === item.name.toLowerCase());
        if (match) {
          totals[match.id].qty += parseFloat(item.qty || 0);
          if (item.unit) totals[match.id].unit = item.unit;
        }
      });
    }
  });

  const chartData = Object.values(totals).filter(t => t.qty > 0);

  if (chartData.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:#9ca3af; padding:40px;">No se registran transacciones de bitácoras para los materiales de la familia <b>${familyName}</b> en este período.</div>`;
    return;
  }

  let maxQty = Math.max(...chartData.map(d => d.qty), 1);
  let chartRowsSvg = '';
  const rowHeight = 45;
  const chartHeight = chartData.length * rowHeight + 40;
  const startY = 20;
  const labelWidth = 150;
  const graphWidth = 360;

  chartData.forEach((d, idx) => {
    const yPos = startY + idx * rowHeight;
    const barWidth = Math.max(6, (d.qty / maxQty) * graphWidth);
    
    chartRowsSvg += `
      <!-- Label -->
      <text x="${labelWidth - 15}" y="${yPos + 18}" font-size="10" fill="#fff" text-anchor="end" font-family="sans-serif" font-weight="600">${d.name} (${d.code})</text>
      
      <!-- Bar Background -->
      <rect x="${labelWidth}" y="${yPos + 8}" width="${graphWidth}" height="14" rx="7" fill="#1f2937" />
      <!-- Bar Foreground (Cyan glow) -->
      <rect x="${labelWidth}" y="${yPos + 8}" width="${barWidth}" height="14" rx="7" fill="url(#cyanGlowGrad)" filter="url(#cyanGlow)" />
      
      <!-- Value -->
      <text x="${labelWidth + barWidth + 10}" y="${yPos + 19}" font-size="10" fill="#00ffff" font-family="monospace" font-weight="bold">${d.qty.toFixed(1)} ${d.unit}</text>
    `;
  });

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px; width:100%;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1f2937; padding-bottom:12px;">
        <h4 style="margin:0; font-size:1.1rem; font-weight:700; color:#fff;">📦 Volumen por Material: Familia ${familyName}</h4>
        <span style="font-size:0.8rem; color:#9ca3af;">Pesaje acumulado en Bitácoras</span>
      </div>

      <svg width="100%" height="${chartHeight}" viewBox="0 0 600 ${chartHeight}" style="background:#0e1321; border-radius:12px; overflow:visible;">
        <defs>
          <linearGradient id="cyanGlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#3b82f6" />
            <stop offset="100%" stop-color="#00ffff" />
          </linearGradient>
          <filter id="cyanGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        <line x1="${labelWidth}" y1="10" x2="${labelWidth}" y2="${chartHeight - 20}" stroke="#374151" stroke-width="1.5" />
        
        ${chartRowsSvg}
      </svg>
    </div>
  `;
}

function drawTradingColaboradoresChart(items) {
  const container = document.getElementById('trading-chart-container');
  if (!container) return;

  const colabs = JSON.parse(localStorage.getItem(userKey('recim_collaborators')) || '[]');
  if (colabs.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:#9ca3af; padding:40px;">No hay colaboradores registrados para analizar su rendimiento.</div>`;
    return;
  }

  const stats = {};
  colabs.forEach(c => {
    stats[c.name] = { name: c.name, role: c.role, invoices: 0, bitacoras: 0, total: 0 };
  });

  items.forEach(i => {
    if (i.collaborator && stats[i.collaborator]) {
      if (i.type === 'basica') {
        stats[i.collaborator].bitacoras++;
      } else if (i.type === 'local' || i.type === 'empresa') {
        stats[i.collaborator].invoices++;
      }
      stats[i.collaborator].total++;
    }
  });

  const dataList = Object.values(stats);
  const activeColabs = dataList.filter(d => d.total > 0);

  if (activeColabs.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:#9ca3af; padding:40px;">Los colaboradores registrados no tienen actividades registradas en el historial de este período.</div>`;
    return;
  }

  // 1. Vertical bar chart: Activity total
  let maxActivity = Math.max(...activeColabs.map(d => d.total), 1);
  let barSvgContent = '';
  const startX = 60;
  const spacingX = 80;
  const graphHeight = 100;
  const zeroY = 140;

  activeColabs.forEach((d, idx) => {
    const xPos = startX + idx * spacingX;
    const h = (d.total / maxActivity) * graphHeight;
    const y = zeroY - h;
    const initialName = d.name.split(' ')[0] || d.name;
    
    barSvgContent += `
      <rect x="${xPos}" y="${y}" width="24" height="${h}" rx="4" fill="url(#colabBarGrad)" filter="url(#colabGlow)" />
      <text x="${xPos + 12}" y="${y - 6}" font-size="9" fill="#8b5cf6" text-anchor="middle" font-family="monospace">${d.total}</text>
      <text x="${xPos + 12}" y="156" font-size="9" fill="#9ca3af" text-anchor="middle" font-family="sans-serif">${initialName}</text>
    `;
  });

  const barChartHtml = `
    <div style="flex:1.2; min-width:280px; display:flex; flex-direction:column; gap:8px;">
      <h5 style="margin:0; font-size:0.95rem; font-weight:700; color:#fff;">📊 Actividad Total por Colaborador</h5>
      <svg width="100%" height="170" viewBox="0 0 350 170" style="background:#0e1321; border-radius:12px; overflow:visible;">
        <defs>
          <linearGradient id="colabBarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#a855f7" />
            <stop offset="100%" stop-color="#6366f1" />
          </linearGradient>
          <filter id="colabGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <line x1="40" y1="40" x2="330" y2="40" stroke="#1f2937" stroke-width="0.5" stroke-dasharray="2,2" />
        <line x1="40" y1="90" x2="330" y2="90" stroke="#1f2937" stroke-width="0.5" stroke-dasharray="2,2" />
        <line x1="40" y1="140" x2="330" y2="140" stroke="#374151" stroke-width="1.5" />
        
        <text x="35" y="43" font-size="8" fill="#6b7280" text-anchor="end">${maxActivity}</text>
        <text x="35" y="93" font-size="8" fill="#6b7280" text-anchor="end">${Math.round(maxActivity/2)}</text>
        <text x="35" y="143" font-size="8" fill="#6b7280" text-anchor="end">0</text>
        
        ${barSvgContent}
      </svg>
    </div>
  `;

  // Donut charts colors
  const colors = ['#00ffcc', '#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6', '#10b981'];

  // Donut Chart 1: Bitacoras
  const bitList = activeColabs.filter(d => d.bitacoras > 0);
  const totalBit = bitList.reduce((s, d) => s + d.bitacoras, 0);
  let donut1Html = '';

  if (totalBit === 0) {
    donut1Html = `
      <div style="flex:1; min-width:240px; display:flex; flex-direction:column; gap:8px;">
        <h5 style="margin:0; font-size:0.95rem; font-weight:700; color:#fff;">🚛 Bitácoras</h5>
        <div style="display:flex; align-items:center; justify-content:center; height:150px; background:#0e1321; border-radius:12px; font-size:0.8rem; color:#6b7280;">
          Sin bitácoras registradas.
        </div>
      </div>
    `;
  } else {
    let stroke1 = '';
    let accumulated1 = 0;
    const perimeter = 2 * Math.PI * 30; // 188.49
    
    bitList.forEach((d, idx) => {
      const pct = d.bitacoras / totalBit;
      const strokeLen = pct * perimeter;
      const strokeOffset = perimeter - (accumulated1 * perimeter);
      const color = colors[idx % colors.length];
      
      stroke1 += `
        <circle cx="50" cy="50" r="30" fill="transparent" stroke="${color}" stroke-width="10" 
                stroke-dasharray="${strokeLen} ${perimeter}" stroke-dashoffset="${strokeOffset}" 
                transform="rotate(-90 50 50)" style="filter: drop-shadow(0 0 2px ${color});" />
      `;
      accumulated1 += pct;
    });

    const legend1 = bitList.map((d, idx) => {
      const color = colors[idx % colors.length];
      const pctVal = Math.round((d.bitacoras / totalBit) * 100);
      return `
        <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.72rem; gap:10px;">
          <span style="display:inline-flex; align-items:center; gap:4px; font-weight:600; color:#fff;"><span style="width:6px; height:6px; border-radius:1.5px; background:${color}; display:inline-block;"></span>${d.name.split(' ')[0]}</span>
          <span style="color:#9ca3af; font-family:monospace;">${d.bitacoras} (${pctVal}%)</span>
        </div>
      `;
    }).join('');

    donut1Html = `
      <div style="flex:1; min-width:240px; display:flex; flex-direction:column; gap:8px;">
        <h5 style="margin:0; font-size:0.95rem; font-weight:700; color:#fff;">🚛 Bitácoras (Total: ${totalBit})</h5>
        <div style="display:flex; gap:10px; align-items:center; background:#0e1321; border-radius:12px; padding:12px; min-height:150px; justify-content:center;">
          <svg width="80" height="80" viewBox="0 0 100 100" style="flex-shrink:0;">
            <circle cx="50" cy="50" r="30" fill="transparent" stroke="#1f2937" stroke-width="10" />
            ${stroke1}
            <circle cx="50" cy="50" r="25" fill="#0e1321" />
          </svg>
          <div style="flex:1; display:flex; flex-direction:column; gap:4px; min-width:110px;">
            ${legend1}
          </div>
        </div>
      </div>
    `;
  }

  // Donut Chart 2: Invoices
  const facList = activeColabs.filter(d => d.invoices > 0);
  const totalFac = facList.reduce((s, d) => s + d.invoices, 0);
  let donut2Html = '';

  if (totalFac === 0) {
    donut2Html = `
      <div style="flex:1; min-width:240px; display:flex; flex-direction:column; gap:8px;">
        <h5 style="margin:0; font-size:0.95rem; font-weight:700; color:#fff;">🧾 Facturas</h5>
        <div style="display:flex; align-items:center; justify-content:center; height:150px; background:#0e1321; border-radius:12px; font-size:0.8rem; color:#6b7280;">
          Sin facturas registradas.
        </div>
      </div>
    `;
  } else {
    let stroke2 = '';
    let accumulated2 = 0;
    const perimeter = 2 * Math.PI * 30; // 188.49
    
    facList.forEach((d, idx) => {
      const pct = d.invoices / totalFac;
      const strokeLen = pct * perimeter;
      const strokeOffset = perimeter - (accumulated2 * perimeter);
      const color = colors[(idx + 2) % colors.length];
      
      stroke2 += `
        <circle cx="50" cy="50" r="30" fill="transparent" stroke="${color}" stroke-width="10" 
                stroke-dasharray="${strokeLen} ${perimeter}" stroke-dashoffset="${strokeOffset}" 
                transform="rotate(-90 50 50)" style="filter: drop-shadow(0 0 2px ${color});" />
      `;
      accumulated2 += pct;
    });

    const legend2 = facList.map((d, idx) => {
      const color = colors[(idx + 2) % colors.length];
      const pctVal = Math.round((d.invoices / totalFac) * 100);
      return `
        <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.72rem; gap:10px;">
          <span style="display:inline-flex; align-items:center; gap:4px; font-weight:600; color:#fff;"><span style="width:6px; height:6px; border-radius:1.5px; background:${color}; display:inline-block;"></span>${d.name.split(' ')[0]}</span>
          <span style="color:#9ca3af; font-family:monospace;">${d.invoices} (${pctVal}%)</span>
        </div>
      `;
    }).join('');

    donut2Html = `
      <div style="flex:1; min-width:240px; display:flex; flex-direction:column; gap:8px;">
        <h5 style="margin:0; font-size:0.95rem; font-weight:700; color:#fff;">🧾 Facturas (Total: ${totalFac})</h5>
        <div style="display:flex; gap:10px; align-items:center; background:#0e1321; border-radius:12px; padding:12px; min-height:150px; justify-content:center;">
          <svg width="80" height="80" viewBox="0 0 100 100" style="flex-shrink:0;">
            <circle cx="50" cy="50" r="30" fill="transparent" stroke="#1f2937" stroke-width="10" />
            ${stroke2}
            <circle cx="50" cy="50" r="25" fill="#0e1321" />
          </svg>
          <div style="flex:1; display:flex; flex-direction:column; gap:4px; min-width:110px;">
            ${legend2}
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:20px; width:100%;">
      <div style="border-bottom:1px solid #1f2937; padding-bottom:12px;">
        <h4 style="margin:0; font-size:1.1rem; font-weight:700; color:#fff;">👥 Rendimiento y Actividad de Colaboradores</h4>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:20px; width:100%;">
        ${barChartHtml}
        <div style="flex:2; display:flex; flex-wrap:wrap; gap:20px; min-width:280px;">
          ${donut1Html}
          ${donut2Html}
        </div>
      </div>
    </div>
  `;
}

function drawTradingVolumeChart(items, type) {
  const container = document.getElementById('trading-chart-container');
  if (!container) return;

  const title = type === 'bitacoras' ? '🚛 Registro Histórico de Bitácoras' : '🧾 Registro Histórico de Facturas';
  const subtitle = type === 'bitacoras' ? 'Cantidad de recogidas completadas por mes' : 'Cantidad de facturas emitidas por mes';
  const filterType = type === 'bitacoras' ? ['basica'] : ['local', 'empresa'];
  const neonColor = type === 'bitacoras' ? '#00ffcc' : '#3b82f6';
  const neonGrad = type === 'bitacoras' ? 'url(#neonGreenGrad)' : 'url(#cyanGlowGrad)';

  const monthly = {};
  items.forEach(i => {
    if (i.date && filterType.includes(i.type)) {
      const monthKey = i.date.substring(0, 7);
      monthly[monthKey] = (monthly[monthKey] || 0) + 1;
    }
  });

  const sortedMonths = Object.keys(monthly).sort().slice(-6);
  if (sortedMonths.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:#9ca3af; padding:40px;">No hay registros de ${type === 'bitacoras' ? 'bitácoras' : 'facturas'} para mostrar en este rango de fechas.</div>`;
    return;
  }

  const maxVal = Math.max(...Object.values(monthly), 5);

  let barSvgContent = '';
  const startX = 60;
  const spacingX = 80;
  const graphHeight = 140;
  const zeroY = 180;

  sortedMonths.forEach((m, idx) => {
    const xPos = startX + idx * spacingX;
    const val = monthly[m];
    const h = (val / maxVal) * graphHeight;
    const y = zeroY - h;
    const [year, mm] = m.split('-');
    const label = t('hist.month_' + mm).substring(0, 3).toUpperCase();

    barSvgContent += `
      <rect x="${xPos + 10}" y="${y}" width="28" height="${h}" rx="5" fill="${neonGrad}" filter="url(#glow)" />
      <text x="${xPos + 24}" y="${y - 8}" font-size="9" fill="${neonColor}" text-anchor="middle" font-family="monospace" font-weight="bold">${val}</text>
      <text x="${xPos + 24}" y="200" font-size="9" fill="#9ca3af" text-anchor="middle" font-family="monospace">${label}</text>
    `;
  });

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px; width:100%;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1f2937; padding-bottom:12px; flex-wrap:wrap; gap:10px;">
        <h4 style="margin:0; font-size:1.1rem; font-weight:700; color:#fff;">${title}</h4>
        <span style="font-size:0.85rem; color:#9ca3af;">${subtitle}</span>
      </div>

      <svg width="100%" height="220" viewBox="0 0 600 220" style="background:#0e1321; border-radius:12px; overflow:visible;">
        <defs>
          <linearGradient id="neonGreenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#00ffcc" />
            <stop offset="100%" stop-color="#00aa88" />
          </linearGradient>
          <linearGradient id="cyanGlowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#3b82f6" />
            <stop offset="100%" stop-color="#00ffff" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        <line x1="50" y1="40" x2="560" y2="40" stroke="#1f2937" stroke-width="0.5" stroke-dasharray="3,3" />
        <line x1="50" y1="110" x2="560" y2="110" stroke="#1f2937" stroke-width="0.5" stroke-dasharray="3,3" />
        <line x1="50" y1="180" x2="560" y2="180" stroke="#374151" stroke-width="1.5" />
        
        <text x="40" y="43" font-size="8" fill="#6b7280" text-anchor="end" font-family="monospace">${maxVal}</text>
        <text x="40" y="113" font-size="8" fill="#6b7280" text-anchor="end" font-family="monospace">${Math.round(maxVal/2)}</text>
        <text x="40" y="183" font-size="8" fill="#6b7280" text-anchor="end" font-family="monospace">0</text>
        
        ${barSvgContent}
      </svg>
    </div>
  `;
}
