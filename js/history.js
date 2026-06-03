/* =============================================
   HISTORY.JS – Historial de facturas
   ============================================= */

function renderHistoryPage(container) {
  const invoices = getAllInvoices();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="section-title">${t('hist.title')}<span class="version-indicator-mobile">v1.0.5</span></h2>
        <p class="section-subtitle">${t('hist.subtitle')}</p>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">${t('hist.total_inv')}</div>
        <div class="stat-value stat-value--blue">${invoices.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Bitácoras</div>
        <div class="stat-value stat-value--green">${invoices.filter(i => i.type === 'basica').length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Fact. Locales</div>
        <div class="stat-value stat-value--blue">${invoices.filter(i => i.type === 'local').length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Fact. Empresas</div>
        <div class="stat-value stat-value--yellow">${invoices.filter(i => i.type === 'empresa').length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${t('hist.total_val')}</div>
        <div class="stat-value stat-value--green">${formatMoney(invoices.reduce((s, i) => s + i.total, 0))}</div>
      </div>
    </div>

    <div class="history-filters">
      <select id="history-filter-type" class="form-select" style="width:auto;" onchange="filterHistory()">
        <option value="all">${t('hist.all_types')}</option>
        <option value="basica">Bitácoras</option>
        <option value="local">Facturas Locales</option>
        <option value="empresa">Facturas Empresariales</option>
      </select>
      <input id="history-search" type="text" class="form-input" style="width:auto;min-width:200px;" placeholder="${t('hist.search')}" oninput="filterHistory()" />
      <button class="btn-secondary" onclick="exportFilteredHistoryToExcel()">📊 Exportar Excel</button>
      <button class="btn-danger" onclick="clearHistory()">${t('hist.clear_all')}</button>
    </div>

    <div id="history-list">
      ${renderInvoiceCards(invoices)}
    </div>
  `;
}

function renderInvoiceCards(invoices) {
  if (invoices.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <p class="empty-state-text">${t('hist.no_inv')}<br>${t('hist.go_create')} <b>${t('nav.facturas')}</b>.</p>
      </div>`;
  }

  // Sort by date (desc) and then by creation time (desc)
  const sorted = [...invoices].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return b.createdAt.localeCompare(a.createdAt);
  });

  // Group by Month and then by Day
  const groups = {};
  sorted.forEach(inv => {
    const [y, m, d] = inv.date.split('-');
    const monthKey = `${y}-${m}`;
    const dayKey = inv.date;
    if (!groups[monthKey]) groups[monthKey] = {};
    if (!groups[monthKey][dayKey]) groups[monthKey][dayKey] = [];
    groups[monthKey][dayKey].push(inv);
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
    html += `<div class="history-month-header">${monthNames[m]} ${y}</div>`;

    // Iterate days (desc)
    Object.keys(groups[mKey]).sort((a, b) => b.localeCompare(a)).forEach(dKey => {
      const dayInvoices = groups[mKey][dKey];
      html += `<div class="history-day-header">${formatDate(dKey)}</div>`;

      dayInvoices.forEach(inv => {
        html += renderSingleInvoiceCard(inv);
      });
    });
  });

  return html;
}

function renderSingleInvoiceCard(inv) {
  const isBasica = inv.type === 'basica';
  const isLocal = inv.type === 'local';
  
  let badge, icon;
  if (isBasica) {
    badge = `<span class="badge badge--green">Bitácora</span>`;
    icon = '🚛';
  } else if (isLocal) {
    badge = `<span class="badge badge--blue">Fact. Local</span>`;
    icon = '🏠';
  } else {
    badge = `<span class="badge badge--yellow">Fact. Empresa</span>`;
    icon = '🏢';
  }

  const itemRows = isBasica
    ? (inv.items || []).map(item => `
        <tr>
          <td>${item.icon} ${item.name}</td>
          <td>${item.qty} ${item.unit}</td>
          <td>${formatMoney(item.priceBuy || 0)}</td>
          <td><b>${formatMoney(item.totalCompra || 0)}</b></td>
        </tr>`).join('')
    : (inv.items || []).map(item => `
        <tr>
          <td>${item.desc}</td>
          <td>${item.qty}</td>
          <td>${formatMoney(item.uprice)}</td>
          <td><b>${formatMoney(item.subtotal)}</b></td>
        </tr>`).join('');

  const detailRows = isBasica ? `
    <p><b>${t('hist.client')}</b> ${inv.client || '—'}</p>
  ` : `
    <div class="form-row" style="margin-bottom:12px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
      <p><b>${t('hist.company')}</b> ${inv.company || '—'}</p>
      <p><b>${t('hist.nit')}</b> ${inv.nit || '—'}</p>
      <p><b>${t('hist.contact')}</b> ${inv.contact || '—'}</p>
      <p><b>${t('hist.address')}</b> ${inv.address || '—'}</p>
    </div>`;

  const totalsSection = isBasica ? `
    <div class="invoice-summary" style="margin-top:12px;">
      <div class="invoice-summary-row">
        <span class="invoice-summary-label">Total Compra (Egreso)</span>
        <span class="invoice-summary-value" style="color:#f87171;">-${formatMoney(inv.totalCompra)}</span>
      </div>
      <div class="invoice-summary-row total">
        <span class="invoice-summary-label">Balance Neto</span>
        <span class="invoice-summary-value" style="color:${inv.balance >= 0 ? 'var(--clr-primary-light)' : '#f87171'}">${formatMoney(inv.balance)}</span>
      </div>
    </div>` : `
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

  return `
  <div class="history-card" id="hcard-${inv.id}">
    <div class="history-card-header" onclick="toggleHistoryCard('${inv.id}')">
      <div class="history-card-icon">${icon}</div>
      <div class="history-card-info">
        <div class="history-card-title">${inv.id} &nbsp; ${badge}</div>
        <div class="history-card-meta">
          ${inv.client || inv.company || '—'} &bull; ${t('hist.created')} ${formatDateTime(inv.createdAt)}
        </div>
      </div>
      <div class="history-card-total">${formatMoney(inv.total)}</div>
      <span class="history-card-chevron">▼</span>
    </div>
    <div class="history-card-body">
      <div id="pdf-content-${inv.id}" class="pdf-export-container">
        <div class="pdf-only-header" style="display:none; text-align:center; padding-bottom:20px; border-bottom:2px solid #3b82f6; margin-bottom:20px;">
           <h1 style="color:#3b82f6; margin:0;">RECIMINSA</h1>
           <p style="margin:5px 0;">Gestión de Materiales Reciclables</p>
           <h2 style="margin:15px 0 5px 0;">FACTURA ${inv.typeName.toUpperCase()}</h2>
           <p>ID: ${inv.id} | Fecha: ${formatDate(inv.date)}</p>
        </div>
        ${detailRows}
        <div style="overflow-x:auto; margin-top:10px;">
          <table class="data-table">
            <thead><tr>
              <th>${t('hist.col_desc')}</th><th>${t('hist.col_qty')}</th><th>${t('hist.col_unit')}</th><th>${t('hist.col_total')}</th>
            </tr></thead>
            <tbody>${itemRows}</tbody>
          </table>
        </div>
        ${totalsSection}
        ${inv.notes ? `<p style="margin-top:12px; font-size:0.83rem; color:var(--clr-text-secondary);">📝 ${inv.notes}</p>` : ''}
      </div>
      <div style="margin-top:14px; display:flex; justify-content:flex-end; gap:8px;">
        ${!isBasica ? `<button class="btn-secondary" onclick="generatePDFInvoice(getAllInvoices().find(i => i.id === '${inv.id}'))">📄 PDF</button>` : ''}
        <button class="btn-danger" onclick="deleteInvoice('${inv.id}')">${t('hist.del_inv')}</button>
      </div>
    </div>
  </div>`;
}

// generatePDFInvoice is called from invoices.js

function toggleHistoryCard(id) {
  const card = document.getElementById(`hcard-${id}`);
  if (card) card.classList.toggle('expanded');
}

function filterHistory() {
  const typeFilter = document.getElementById('history-filter-type')?.value || 'all';
  const searchQuery = (document.getElementById('history-search')?.value || '').toLowerCase().trim();
  let invoices = getAllInvoices();

  if (typeFilter !== 'all') invoices = invoices.filter(i => i.type === typeFilter);
  if (searchQuery) invoices = invoices.filter(i =>
    (i.id || '').toLowerCase().includes(searchQuery) ||
    (i.client || '').toLowerCase().includes(searchQuery) ||
    (i.company || '').toLowerCase().includes(searchQuery)
  );

  const list = document.getElementById('history-list');
  if (list) list.innerHTML = renderInvoiceCards(invoices);
}

function deleteInvoice(id) {
  if (!confirm(t('confirm.del_inv'))) return;
  const invoices = getAllInvoices().filter(i => i.id !== id);
  // Use setItem (not removeItem) so the sync.js localStorage override fires and pushes to Firebase
  localStorage.setItem(userKey('recim_invoices'), JSON.stringify(invoices));
  showToast(t('toast.del_inv'), 'success');
  rerenderCurrentPage();
}

function clearHistory() {
  if (!confirm(t('confirm.clear_hist'))) return;
  // Write empty array so sync.js can detect the change and push null to Firebase
  localStorage.setItem(userKey('recim_invoices'), JSON.stringify([]));
  // Also force an immediate sync to ensure cloud is cleared
  if (typeof forceSync === 'function') forceSync();
  showToast(t('toast.clear_hist'), 'success');
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
    let invoices = getAllInvoices();

    if (typeFilter !== 'all') invoices = invoices.filter(i => i.type === typeFilter);
    if (searchQuery) invoices = invoices.filter(i =>
        (i.id || '').toLowerCase().includes(searchQuery) ||
        (i.client || '').toLowerCase().includes(searchQuery) ||
        (i.company || '').toLowerCase().includes(searchQuery)
    );

    if (invoices.length === 0) {
        showToast('⚠️ No hay datos para exportar', 'warning');
        return;
    }

    // Si solo hay bitácoras, usamos el exportador específico
    if (typeFilter === 'basica') {
        exportBitacorasListToExcel(invoices);
    } else {
        // Para otros tipos o mixto, usamos el exportador general
        exportSelectedDataToExcel({ invoices: true }); 
        // Nota: exportSelectedDataToExcel exporta TODO de localStorage. 
        // Deberíamos pasarle el arreglo filtrado si quisiéramos ser exactos.
        // Pero para no complicar excel-utils.js ahora, si es bitacora usamos el nuevo.
        // Si el usuario quiere exportar todo lo demás, ya existe la opción en ajustes.
    }
}
