/* =============================================
   HISTORY.JS – Historial de facturas, ingresos y egresos
   ============================================= */

function getAllHistoryItems() {
  if (typeof sanitizeFinancialData === 'function') {
    sanitizeFinancialData();
  }
  const invoices = getAllInvoices();
  const ingresos = JSON.parse(localStorage.getItem(userKey('recim_ingresos')) || '[]');
  const egresos = JSON.parse(localStorage.getItem(userKey('recim_egresos')) || '[]');

  const normInvoices = invoices.map(i => ({
    ...i,
    date: i.date || (i.createdAt ? i.createdAt.split('T')[0] : (i.fecha ? i.fecha.split('T')[0] : new Date().toISOString().split('T')[0])),
    itemType: 'invoice',
    total: i.total !== undefined ? i.total : (i.totalVenta || 0)
  }));
  const normIngresos = ingresos.map(i => ({
    ...i,
    date: i.date || (i.createdAt ? i.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
    itemType: 'ingreso',
    type: 'ingreso',
    typeName: 'Ingreso',
    total: i.amount,
    createdAt: i.createdAt || new Date((i.date || new Date().toISOString().split('T')[0]) + 'T12:00:00Z').toISOString()
  }));
  const normEgresos = egresos.map(e => ({
    ...e,
    date: e.date || (e.createdAt ? e.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
    itemType: 'egreso',
    type: 'egreso',
    typeName: 'Egreso',
    total: e.amount,
    createdAt: e.createdAt || new Date((e.date || new Date().toISOString().split('T')[0]) + 'T12:00:00Z').toISOString()
  }));

  return [...normInvoices, ...normIngresos, ...normEgresos];
}

function getUnifiedFinancialSummary(items) {
  let totalIncome = 0;
  let totalExpense = 0;

  items.forEach(i => {
    if (i.itemType === 'egreso' || i.type === 'egreso') {
      totalExpense += (i.amount || i.total || 0);
    } else if (i.itemType === 'ingreso' || i.type === 'ingreso') {
      totalIncome += (i.amount || i.total || 0);
    } else if (i.itemType === 'invoice' && (i.type === 'empresa' || i.type === 'local')) {
      const hasIncomeRef = items.some(ing => (ing.itemType === 'ingreso' || ing.type === 'ingreso') && String(ing.ref) === String(i.id));
      if (!hasIncomeRef) {
        totalIncome += (i.total !== undefined ? i.total : (i.totalVenta || 0));
      }
    }
  });

  const netBalance = totalIncome - totalExpense;
  return { totalIncome, totalExpense, netBalance };
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

function applyMaterialFilter(items) {
  const matFilter = window.currentHistoryMaterialFilter || 'all';
  if (matFilter === 'all') return items;

  const [filterKind, filterId] = matFilter.split('_');
  let targetMaterials = [];
  let selectedFamilyName = '';
  let selectedMaterialName = '';
  
  const allMaterials = (typeof getMaterialCodes === 'function') ? getMaterialCodes() : [];
  
  if (filterKind === 'family') {
    const allFamilies = (typeof getMaterialFamilies === 'function') ? getMaterialFamilies() : [];
    const fam = allFamilies.find(f => f.id === filterId);
    if (fam) {
      selectedFamilyName = fam.name.toLowerCase().trim();
      targetMaterials = allMaterials.filter(m => m.familyId === filterId);
    }
  } else if (filterKind === 'material') {
    const mat = allMaterials.find(m => m.id === filterId);
    if (mat) {
      selectedMaterialName = mat.name.toLowerCase().trim();
      targetMaterials = [mat];
    }
  }
  
  const matchableNames = targetMaterials.map(m => m.name.toLowerCase().trim());
  const matchableCodes = targetMaterials.map(m => m.code.toLowerCase().trim());
  
  return items.filter(i => {
    const isBasica = i.type === 'basica';
    const isIngreso = i.type === 'ingreso';
    const isEgreso = i.type === 'egreso';
    const isInvoice = i.itemType === 'invoice' && !isBasica;
    
    if (isBasica || isInvoice) {
      return (i.items || []).some(item => {
        const itemMatName = (item.name || item.desc || '').toLowerCase().trim();
        const itemMatCode = (item.matId || item.code || '').toLowerCase().trim();
        
        const matchesMaterial = matchableNames.some(name => itemMatName.includes(name) || name.includes(itemMatName)) ||
                                matchableCodes.some(code => itemMatCode === code || itemMatName.includes(code));
        if (matchesMaterial) return true;
        
        if (filterKind === 'family' && selectedFamilyName) {
          const matConfig = allMaterials.find(m => 
            m.name.toLowerCase().trim() === itemMatName || 
            m.code.toLowerCase().trim() === itemMatCode
          );
          if (matConfig && matConfig.familyId === filterId) return true;
          if (itemMatName.includes(selectedFamilyName)) return true;
        }
        return false;
      });
    } else if (isIngreso || isEgreso) {
      const textToSearch = `${i.concept || ''} ${i.category || ''} ${i.notes || ''}`.toLowerCase();
      
      const matchesMaterial = matchableNames.some(name => textToSearch.includes(name)) ||
                              matchableCodes.some(code => textToSearch.includes(code));
      if (matchesMaterial) return true;
      
      if (filterKind === 'family' && selectedFamilyName) {
        if (textToSearch.includes(selectedFamilyName)) return true;
        if ((i.category || '').toLowerCase().trim() === selectedFamilyName) return true;
      }
      
      if (filterKind === 'material' && selectedMaterialName) {
        const mat = allMaterials.find(m => m.id === filterId);
        if (mat && mat.familyId) {
          const allFamilies = (typeof getMaterialFamilies === 'function') ? getMaterialFamilies() : [];
          const fam = allFamilies.find(f => f.id === mat.familyId);
          if (fam) {
            const famName = fam.name.toLowerCase().trim();
            if (textToSearch.includes(famName)) return true;
          }
        }
      }
      return false;
    }
    return false;
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
  const filteredByDate = applyDateFilter(allItems);
  const items = applyMaterialFilter(filteredByDate);
  const finSummary = getUnifiedFinancialSummary(items);
  const isEn = (getSettings().language === 'en');

  const currentFilter = window.currentHistoryDateFilter || 'all';
  const currentMatFilter = window.currentHistoryMaterialFilter || 'all';

  const families = (typeof getMaterialFamilies === 'function') ? getMaterialFamilies() : [];
  const materials = (typeof getMaterialCodes === 'function') ? getMaterialCodes() : [];

  let materialSelectHtml = `
    <select id="history-filter-material" class="form-select" style="width:auto;max-width:200px;" onchange="window.currentHistoryMaterialFilter = this.value; filterHistory();">
      <option value="all" ${currentMatFilter === 'all' ? 'selected' : ''}>${isEn ? 'Filter by Material/Family (All)' : 'Filtrar por Material/Familia (Todo)'}</option>
  `;

  if (families.length > 0) {
    materialSelectHtml += `<optgroup label="${isEn ? 'Families' : 'Familias'}">`;
    families.forEach(f => {
      const val = `family_${f.id}`;
      materialSelectHtml += `<option value="${val}" ${currentMatFilter === val ? 'selected' : ''}>${f.name}</option>`;
    });
    materialSelectHtml += `</optgroup>`;
  }

  if (materials.length > 0) {
    materialSelectHtml += `<optgroup label="${isEn ? 'Materials' : 'Materiales'}">`;
    materials.forEach(m => {
      const val = `material_${m.id}`;
      materialSelectHtml += `<option value="${val}" ${currentMatFilter === val ? 'selected' : ''}>${m.name} (${m.code})</option>`;
    });
    materialSelectHtml += `</optgroup>`;
  }
  materialSelectHtml += `</select>`;

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
          <div class="stat-value stat-value--green" style="font-size:1.1rem;">${formatMoney(finSummary.totalIncome)} <span style="font-size:0.75rem; opacity:0.7; font-weight:normal;">(${items.filter(i => i.type === 'ingreso').length})</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${t('hist.expense_count')}</div>
          <div class="stat-value stat-value--red" style="font-size:1.1rem;">${formatMoney(finSummary.totalExpense)} <span style="font-size:0.75rem; opacity:0.7; font-weight:normal;">(${items.filter(i => i.type === 'egreso').length})</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${t('hist.logs_count')}</div>
          <div class="stat-value stat-value--green">${items.filter(i => i.type === 'basica').length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${t('hist.total_val')}</div>
          <div class="stat-value ${finSummary.netBalance < 0 ? 'stat-value--red' : 'stat-value--green'}">${formatMoney(finSummary.netBalance)}</div>
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
        ${materialSelectHtml}
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
    const dateA = a.date || (a.createdAt ? a.createdAt.split('T')[0] : '');
    const dateB = b.date || (b.createdAt ? b.createdAt.split('T')[0] : '');
    if (dateB !== dateA) return dateB.localeCompare(dateA);
    const timeA = a.createdAt || '';
    const timeB = b.createdAt || '';
    return timeB.localeCompare(timeA);
  });

  // Group by Month and then by Day
  const groups = {};
  sorted.forEach(item => {
    const rawDate = item.date || (item.createdAt ? item.createdAt.split('T')[0] : (item.fecha ? item.fecha.split('T')[0] : new Date().toISOString().split('T')[0]));
    item.date = rawDate;
    const parts = rawDate.split('-');
    const y = parts[0] || '2026';
    const m = parts[1] || '01';
    const monthKey = `${y}-${m}`;
    const dayKey = rawDate;
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
  } else if (isIngreso) {
    badge = `<span class="badge badge--green">${t('hist.badge_income')}</span>`;
    icon = '💰';
  } else if (isEgreso) {
    badge = `<span class="badge badge--red">${t('hist.badge_expense')}</span>`;
    icon = '💸';
  } else {
    // Facturas de venta con comprobante o estándar
    let detectedType = inv.ncfType || '';
    if (!detectedType && inv.ncf && typeof inv.ncf === 'string') {
      const match = inv.ncf.match(/^([BE]\d{2})/);
      if (match) detectedType = match[1];
    }

    if (detectedType === 'B01' || detectedType === 'E31') {
      badge = `<span class="badge badge--yellow" style="font-weight:600;">${detectedType} - Crédito Fiscal</span>`;
      icon = '🏢';
    } else if (detectedType === 'B02' || detectedType === 'E32') {
      badge = `<span class="badge badge--blue" style="font-weight:600;">${detectedType} - Consumidor Final</span>`;
      icon = '🏠';
    } else if (detectedType === 'B03' || detectedType === 'E33') {
      badge = `<span class="badge badge--red" style="font-weight:600;">${detectedType} - Nota Débito</span>`;
      icon = '📈';
    } else if (detectedType === 'B04' || detectedType === 'E34') {
      badge = `<span class="badge badge--orange" style="font-weight:600;">${detectedType} - Nota Crédito</span>`;
      icon = '📉';
    } else if (detectedType === 'B14' || detectedType === 'E44') {
      badge = `<span class="badge badge--purple" style="font-weight:600;">${detectedType} - Reg. Especial</span>`;
      icon = '⚖️';
    } else if (detectedType === 'B15' || detectedType === 'E45') {
      badge = `<span class="badge badge--orange" style="font-weight:600;">${detectedType} - Gubernamental</span>`;
      icon = '🏛️';
    } else if (detectedType) {
      badge = `<span class="badge badge--blue" style="font-weight:600;">${detectedType} - ${inv.typeName || 'Comprobante'}</span>`;
      icon = '📄';
    } else if (inv.typeName && inv.typeName.toLowerCase() !== 'factura estándar') {
      badge = `<span class="badge badge--blue" style="font-weight:600;">${inv.typeName}</span>`;
      icon = '📄';
    } else if (isLocal) {
      badge = `<span class="badge badge--blue">${t('hist.badge_local')}</span>`;
      icon = '🏠';
    } else {
      badge = `<span class="badge badge--yellow">${t('hist.badge_biz')}</span>`;
      icon = '🏢';
    }
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
    const payMap = {
      'Efectivo': '💵 Efectivo',
      'Transferencia': '🏦 Transferencia Bancaria',
      'Cheque': '📜 Cheque',
      'Crédito': '⏳ Crédito'
    };
    const paymentDisplay = payMap[inv.payMethod] || payMap[inv.paymentMethod] || (inv.payMethod || inv.paymentMethod || '💵 Efectivo');
    const colabDisplay = inv.collaborator ? `👤 ${inv.collaborator}` : '— (No asignado)';

    detailRows = `
      <div class="form-row" style="margin-bottom:12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; background: rgba(255,255,255,0.02); padding: 12px; border-radius: var(--r-sm); border: 1px solid var(--clr-border);">
        <p style="margin:0;"><b>${t('hist.client')}:</b> ${inv.client || '—'}</p>
        ${inv.nit ? `<p style="margin:0;"><b>RNC / Cédula:</b> ${inv.nit}</p>` : ''}
        ${inv.ncf ? `<p style="margin:0;"><b>NCF:</b> <code style="font-weight:bold; color:var(--clr-primary-light);">${inv.ncf}</code></p>` : ''}
        <p style="margin:0;"><b>Método de Pago:</b> ${paymentDisplay}</p>
        <p style="margin:0;"><b>Colaborador:</b> ${colabDisplay}</p>
      </div>`;
  } else {
    // Determinar etiqueta clara y oficial del tipo de comprobante
    let ncfTypeCode = inv.ncfType || '';
    if (!ncfTypeCode && inv.ncf && typeof inv.ncf === 'string') {
      const match = inv.ncf.match(/^([BE]\d{2})/);
      if (match) ncfTypeCode = match[1];
    }

    const ncfOfficialNames = {
      'B01': 'B01 - Factura de Crédito Fiscal',
      'B02': 'B02 - Factura de Consumo (Consumidor Final)',
      'B03': 'B03 - Nota de Débito',
      'B04': 'B04 - Nota de Crédito',
      'B11': 'B11 - Registro de Proveedores Informales',
      'B12': 'B12 - Registro Único de Ingresos',
      'B13': 'B13 - Gastos Menores',
      'B14': 'B14 - Regímenes Especiales de Tributación',
      'B15': 'B15 - Comprobante Gubernamental',
      'B16': 'B16 - Comprobante para Exportaciones',
      'E31': 'E31 - Factura de Crédito Fiscal Electrónica',
      'E32': 'E32 - Factura de Consumo Electrónica',
      'E33': 'E33 - Nota de Débito Electrónica',
      'E34': 'E34 - Nota de Crédito Electrónica',
      'E41': 'E41 - Proveedores Informales Electrónico',
      'E44': 'E44 - Regímenes Especiales Electrónico',
      'E45': 'E45 - Comprobante Gubernamental Electrónico'
    };

    let voucherTypeLabel = ncfOfficialNames[ncfTypeCode] || inv.typeName || (inv.ncf ? `Comprobante ${inv.ncf}` : 'Factura Estándar (Sin Comprobante Fiscal)');

    // Método de pago con icono
    const payMap = {
      'Efectivo': '💵 Efectivo',
      'Transferencia': '🏦 Transferencia Bancaria',
      'Cheque': '📜 Cheque',
      'Crédito': '⏳ Crédito'
    };
    const paymentDisplay = payMap[inv.payMethod] || payMap[inv.paymentMethod] || (inv.payMethod || inv.paymentMethod || '💵 Efectivo');
    const colabDisplay = inv.collaborator ? `👤 ${inv.collaborator}` : '— (No asignado)';

    detailRows = `
      <div class="form-row" style="margin-bottom:12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; background: rgba(255,255,255,0.02); padding: 12px; border-radius: var(--r-sm); border: 1px solid var(--clr-border);">
        <p style="margin:0;"><b>${t('hist.company', 'Empresa / Cliente:')}</b> ${inv.company || inv.client || '—'}</p>
        <p style="margin:0;"><b>RNC / Cédula:</b> ${inv.nit || '—'}</p>
        <p style="margin:0;"><b>Tipo de Comprobante:</b> <span class="badge badge--blue" style="font-size:0.82rem; font-weight:700;">${voucherTypeLabel}</span></p>
        ${inv.ncf ? `<p style="margin:0;"><b>NCF Asignado:</b> <code style="font-weight:bold; color:var(--clr-primary-light); font-size:0.95rem;">${inv.ncf}</code></p>` : '<p style="margin:0;"><b>NCF:</b> <span class="text-muted" style="font-size:0.85rem;">(Sin NCF fiscal)</span></p>'}
        <p style="margin:0;"><b>Método de Pago:</b> ${paymentDisplay}</p>
        <p style="margin:0;"><b>Colaborador:</b> ${colabDisplay}</p>
        <p style="margin:0;"><b>${t('hist.contact', 'Contacto:')}</b> ${inv.contact || '—'}</p>
        <p style="margin:0; grid-column: 1 / -1;"><b>${t('hist.address', 'Dirección:')}</b> ${inv.address || '—'}</p>
      </div>`;
  }

  let totalsSection = '';
  if (isIngreso || isEgreso) {
    totalsSection = `
      <div class="invoice-summary" style="margin-top:12px;">
        <div class="invoice-summary-row total">
          <span class="invoice-summary-label">Monto</span>
          <span class="invoice-summary-value" style="color:${isIngreso ? 'var(--clr-primary-light)' : '#f87171'}; font-size:1.2rem; font-weight:700;">
            ${inv.total > 0 ? (isIngreso ? '+' : '-') : ''}${formatMoney(inv.total, inv.currency || 'DOP')}
          </span>
        </div>
      </div>
    `;
  } else if (isBasica) {
    totalsSection = `
      <div class="invoice-summary" style="margin-top:12px;">
        <div class="invoice-summary-row">
          <span class="invoice-summary-label">Total Compra (Egreso)</span>
          <span class="invoice-summary-value" style="color:#f87171;">${inv.totalCompra > 0 ? '-' : ''}${formatMoney(inv.totalCompra)}</span>
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
  if (!isIngreso && !isEgreso && (inv.payMethod || inv.paymentMethod)) {
    cardMeta += ` &bull; 💳 ${inv.payMethod || inv.paymentMethod}`;
  }
  const displayTotal = (isEgreso && inv.total > 0) ? `-${formatMoney(inv.total, inv.currency || 'DOP')}` : ((isIngreso && inv.total > 0) ? `+${formatMoney(inv.total, inv.currency || 'DOP')}` : formatMoney(inv.total, inv.currency || 'DOP'));
  const totalColor = isEgreso ? '#f87171' : (isIngreso ? 'var(--clr-primary-light)' : 'inherit');

  const isEn = (getSettings().language === 'en');
  let headersHtml = '';
  if (isIngreso || isEgreso) {
    headersHtml = `<th colspan="4">${isEn ? 'Transaction Details' : 'Detalles de Transacción'}</th>`;
  } else if (isBasica) {
    headersHtml = `
      <th>${isEn ? 'Detail' : 'Detalle'}</th>
      <th>${isEn ? 'Quantity / Info' : 'Cantidad / Info'}</th>
      <th>${isEn ? 'Purchase Price' : 'Precio Compra'}</th>
      <th>${isEn ? 'Total Compra' : 'Total Compra'}</th>
    `;
  } else {
    headersHtml = `
      <th>${isEn ? 'Detail' : 'Detalle'}</th>
      <th>${isEn ? 'Quantity / Info' : 'Cantidad / Info'}</th>
      <th>${isEn ? 'Unit Price' : 'Precio Unitario'}</th>
      <th>${isEn ? 'Subtotal' : 'Subtotal'}</th>
    `;
  }

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
              ${headersHtml}
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
  items = applyMaterialFilter(items);

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

async function deleteHistoryItem(type, id) {
  if (type === 'ingreso' || type === 'egreso') {
    const ok = await window.AppDialog.confirm('¿Estás seguro de que deseas eliminar este registro financiero?', 'Eliminar Registro');
    if (!ok) return;
    const baseKey = type === 'ingreso' ? 'recim_ingresos' : 'recim_egresos';
    const list = JSON.parse(localStorage.getItem(userKey(baseKey)) || '[]').filter(e => e.id !== id);
    localStorage.setItem(userKey(baseKey), JSON.stringify(list));
    showToast('Registro financiero eliminado con éxito', 'success');
  } else {
    const ok = await window.AppDialog.confirm(t('confirm.del_inv'), 'Eliminar Factura');
    if (!ok) return;
    const invoices = getAllInvoices().filter(i => i.id !== id);
    localStorage.setItem(userKey('recim_invoices'), JSON.stringify(invoices));
    showToast(t('toast.del_inv'), 'success');
  }
  if (window.forceSync) {
    try { await window.forceSync(); } catch (_) {}
  }
  rerenderCurrentPage();
}

async function clearHistory() {
  // 1ª Confirmación
  const ok1 = await window.AppDialog.confirm('⚠️ PRIMERA CONFIRMACIÓN: ¿Estás seguro de que deseas limpiar todo el historial (Facturas, Bitácoras, Ingresos y Egresos)?', 'Limpiar Historial');
  if (!ok1) return;
  // 2ª Confirmación
  const ok2 = await window.AppDialog.confirm('🚨 SEGUNDA CONFIRMACIÓN: ¡ADVERTENCIA! Esta acción borrará todo el historial de forma permanente. ¿Deseas continuar?', 'Confirmación Definitiva');
  if (!ok2) return;
  localStorage.setItem(userKey('recim_invoices'), JSON.stringify([]));
  localStorage.setItem(userKey('recim_ingresos'), JSON.stringify([]));
  localStorage.setItem(userKey('recim_egresos'), JSON.stringify([]));
  if (window.forceSync) {
    try { await window.forceSync(); } catch (_) {}
  }

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

  if (window.AndroidNative && typeof window.AndroidNative.ShareText === 'function') {
    window.AndroidNative.ShareText(text, "Enviar Recibo");
  } else if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.Plugins && Capacitor.Plugins.Share) {
    Capacitor.Plugins.Share.share({
      text: text,
      title: 'Compartir Recibo',
      dialogTitle: 'Compartir por WhatsApp / App'
    }).catch(err => console.error(err));
  } else {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    if (typeof openExternalLink === 'function') {
      openExternalLink(url);
    } else {
      window.open(url, '_blank');
    }
  }
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

window.updateFinanzasRecordsTable = function() {
  const container = document.getElementById('finanzas-records-table-body');
  const badge = document.getElementById('finanzas-total-badge');
  const filterVal = document.getElementById('finanzas-flow-filter')?.value || 'all';
  const query = (document.getElementById('finanzas-search-input')?.value || '').toLowerCase().trim();

  if (!container || !window._currentFinanzasItems) return;

  let items = [...window._currentFinanzasItems];

  // 1. Sort chronologically (Newest first)
  items.sort((a, b) => {
    const timeA = new Date(a.createdAt || a.date).getTime() || 0;
    const timeB = new Date(b.createdAt || b.date).getTime() || 0;
    return timeB - timeA;
  });

  // 2. Filter by flow type
  if (filterVal === 'ingresos') {
    items = items.filter(i => i.type === 'ingreso' || i.itemType === 'invoice');
  } else if (filterVal === 'egresos') {
    items = items.filter(i => i.type === 'egreso');
  } else if (filterVal === 'facturas') {
    items = items.filter(i => i.itemType === 'invoice' || i.type === 'local' || i.type === 'empresa');
  }

  // 3. Search query filter
  if (query) {
    items = items.filter(i =>
      (i.id || '').toLowerCase().includes(query) ||
      (i.client || '').toLowerCase().includes(query) ||
      (i.company || '').toLowerCase().includes(query) ||
      (i.concept || '').toLowerCase().includes(query) ||
      (i.category || '').toLowerCase().includes(query)
    );
  }

  // Calculate Net Total for current filter using unified summary
  const finSummary = getUnifiedFinancialSummary(items);
  const totalSum = finSummary.netBalance;

  if (badge) {
    const isNegative = totalSum < 0;
    badge.style.borderColor = isNegative ? '#ff0055' : '#00ffcc';
    badge.style.color = isNegative ? '#ff4d79' : '#00ffcc';
    badge.innerHTML = `Total: ${safeFormatMoney(totalSum)}`;
  }

  if (items.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:#64748b; padding:35px; font-size:0.9rem;">No se encontraron registros que coincidan con los filtros seleccionados.</div>`;
    return;
  }

  container.innerHTML = items.map(i => {
    const isEgreso = i.type === 'egreso';
    const isInvoice = i.itemType === 'invoice' || i.type === 'local' || i.type === 'empresa';
    
    let typeBadge = '';
    if (isInvoice) {
      typeBadge = `<span style="background:rgba(59,130,246,0.15); color:#60a5fa; border:1px solid rgba(59,130,246,0.3); padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:700;">🧾 Factura</span>`;
    } else if (isEgreso) {
      typeBadge = `<span style="background:rgba(255,0,85,0.15); color:#ff4d79; border:1px solid rgba(255,0,85,0.3); padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:700;">🔴 Egreso</span>`;
    } else {
      typeBadge = `<span style="background:rgba(0,255,204,0.15); color:#00ffcc; border:1px solid rgba(0,255,204,0.3); padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:700;">🟢 Ingreso</span>`;
    }

    const title = i.id ? `N.º ${i.id}` : (i.concept || 'Registro financiero');
    const subtitle = i.client || i.company || i.category || (isInvoice ? 'Venta de Material' : 'Movimiento de Caja');
    
    let dateStr = i.createdAt ? new Date(i.createdAt).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' }) : (i.date || '—');

    const amountColor = isEgreso ? '#ff4d79' : '#00ffcc';
    const amountPrefix = isEgreso ? '- ' : '+ ';

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; background:#0f172a; border:1px solid #1e293b; border-radius:10px; padding:12px 16px; gap:12px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:200px;">
          ${typeBadge}
          <div style="display:flex; flex-direction:column; min-width:0;">
            <span style="font-weight:700; color:#f8fafc; font-size:0.92rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${title}</span>
            <span style="font-size:0.78rem; color:#94a3b8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${subtitle}</span>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:20px; flex-shrink:0;">
          <div style="display:flex; flex-direction:column; align-items:flex-end;">
            <span style="font-size:0.75rem; color:#64748b; font-family:monospace;">📅 Creación: ${dateStr}</span>
            <span style="font-size:1.05rem; font-weight:800; color:${amountColor}; font-family:monospace;">${amountPrefix}${safeFormatMoney(i.total)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

function drawTradingFinanzasChart(items) {
  const container = document.getElementById('trading-chart-container');
  if (!container) return;

  window._currentFinanzasItems = items;

  const monthly = {};
  items.forEach(i => {
    if (!i.date) return;
    const monthKey = i.date.substring(0, 7); // 'YYYY-MM'
    if (!monthly[monthKey]) monthly[monthKey] = { income: 0, expense: 0 };

    if (i.itemType === 'egreso' || i.type === 'egreso') {
      monthly[monthKey].expense += (i.amount || i.total || 0);
    } else if (i.itemType === 'ingreso' || i.type === 'ingreso') {
      monthly[monthKey].income += (i.amount || i.total || 0);
    } else if (i.itemType === 'invoice' && (i.type === 'empresa' || i.type === 'local')) {
      const hasIncomeRef = items.some(ing => (ing.itemType === 'ingreso' || ing.type === 'ingreso') && String(ing.ref) === String(i.id));
      if (!hasIncomeRef) {
        monthly[monthKey].income += (i.total !== undefined ? i.total : (i.totalVenta || 0));
      }
    }
  });

  const sortedMonths = Object.keys(monthly).sort().slice(-6);
  if (sortedMonths.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:#9ca3af; padding:60px; font-size:1.05rem;">No hay datos financieros registrados en este rango de fechas.</div>`;
    return;
  }

  let maxVal = 1000;
  sortedMonths.forEach(m => {
    maxVal = Math.max(maxVal, monthly[m].income, monthly[m].expense);
  });

  let barSvgContent = '';
  const startX = 85;
  const spacingX = 110;
  const graphHeight = 230;
  const zeroY = 300;
  const barWidth = 32;

  sortedMonths.forEach((m, idx) => {
    const xPos = startX + idx * spacingX;
    const incVal = monthly[m].income;
    const expVal = monthly[m].expense;
    
    const incHeight = Math.max(4, (incVal / maxVal) * graphHeight);
    const expHeight = Math.max(4, (expVal / maxVal) * graphHeight);
    
    const incY = zeroY - incHeight;
    const expY = zeroY - expHeight;
    
    const [y, mm] = m.split('-');
    const label = t('hist.month_' + mm).substring(0, 3).toUpperCase();
    
    const incText = safeFormatMoney(incVal).replace('RD$', '').trim();
    const expText = safeFormatMoney(expVal).replace('RD$', '').trim();
    
    barSvgContent += `
      <!-- Income Bar -->
      <rect x="${xPos}" y="${incY}" width="${barWidth}" height="${incHeight}" rx="6" fill="url(#neonGreenGrad)" filter="url(#glow)" />
      <!-- Expense Bar -->
      <rect x="${xPos + barWidth + 8}" y="${expY}" width="${barWidth}" height="${expHeight}" rx="6" fill="url(#neonRedGrad)" filter="url(#glow)" />
      
      <!-- Income Value Tag -->
      <g transform="translate(${xPos + barWidth/2}, ${incY - 10})">
        <text font-size="11" fill="#00ffcc" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="700">${incText}</text>
      </g>

      <!-- Expense Value Tag -->
      <g transform="translate(${xPos + barWidth + 8 + barWidth/2}, ${expY - 10})">
        <text font-size="11" fill="#ff4d79" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="700">${expText}</text>
      </g>
      
      <!-- X Axis Month Label -->
      <text x="${xPos + barWidth + 4}" y="335" font-size="13" fill="#e5e7eb" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" letter-spacing="0.05em">${label}</text>
    `;
  });

  const chartHtml = `
    <div style="display:flex; flex-direction:column; gap:20px; width:100%;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1f2937; padding-bottom:16px; flex-wrap:wrap; gap:12px;">
        <div>
          <h4 style="margin:0; font-size:1.3rem; font-weight:800; color:#fff; letter-spacing:-0.02em;">📊 Balance de Caja (Últimos 6 meses)</h4>
          <span style="font-size:0.85rem; color:#9ca3af; font-weight:500;">Comparativo mensual de flujos financieros</span>
        </div>
        <div style="display:flex; gap:20px; font-size:0.9rem; font-weight:700;">
          <span style="display:inline-flex; align-items:center; gap:8px; color:#00ffcc; background:rgba(0,255,204,0.1); padding:6px 14px; border-radius:20px; border:1px solid rgba(0,255,204,0.2);">
            <span style="width:12px; height:12px; border-radius:4px; background:#00ffcc; display:inline-block; box-shadow: 0 0 10px #00ffcc;"></span>Ingresos
          </span>
          <span style="display:inline-flex; align-items:center; gap:8px; color:#ff0055; background:rgba(255,0,85,0.1); padding:6px 14px; border-radius:20px; border:1px solid rgba(255,0,85,0.2);">
            <span style="width:12px; height:12px; border-radius:4px; background:#ff0055; display:inline-block; box-shadow: 0 0 10px #ff0055;"></span>Egresos
          </span>
        </div>
      </div>

      <svg width="100%" height="360" viewBox="0 0 760 360" style="background:#090d16; border:1px solid #1e293b; border-radius:16px; overflow:visible; padding:10px;">
        <defs>
          <linearGradient id="neonGreenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#00ffcc" />
            <stop offset="100%" stop-color="#059669" />
          </linearGradient>
          <linearGradient id="neonRedGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#ff3366" />
            <stop offset="100%" stop-color="#be123c" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        <!-- Y-Axis Gridlines & Labels -->
        <line x1="70" y1="70" x2="740" y2="70" stroke="#1e293b" stroke-width="1" stroke-dasharray="4,4" />
        <line x1="70" y1="147" x2="740" y2="147" stroke="#1e293b" stroke-width="1" stroke-dasharray="4,4" />
        <line x1="70" y1="223" x2="740" y2="223" stroke="#1e293b" stroke-width="1" stroke-dasharray="4,4" />
        <line x1="70" y1="300" x2="740" y2="300" stroke="#334155" stroke-width="2" />
        
        <text x="60" y="74" font-size="11" fill="#64748b" text-anchor="end" font-family="monospace" font-weight="600">${safeFormatMoney(maxVal).replace('RD$', '').trim()}</text>
        <text x="60" y="151" font-size="11" fill="#64748b" text-anchor="end" font-family="monospace" font-weight="600">${safeFormatMoney(maxVal*0.66).replace('RD$', '').trim()}</text>
        <text x="60" y="227" font-size="11" fill="#64748b" text-anchor="end" font-family="monospace" font-weight="600">${safeFormatMoney(maxVal*0.33).replace('RD$', '').trim()}</text>
        <text x="60" y="304" font-size="11" fill="#64748b" text-anchor="end" font-family="monospace" font-weight="600">0</text>
        
        ${barSvgContent}
      </svg>

      <!-- Tabla Detallada de Facturas, Ingresos y Egresos -->
      <div style="margin-top:12px; background:#090d16; border:1px solid #1e293b; border-radius:16px; padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; margin-bottom:16px; border-bottom:1px solid #1e293b; padding-bottom:14px;">
          <div>
            <h5 style="margin:0; font-size:1.15rem; font-weight:800; color:#fff;">📋 Registro Cronológico de Facturas y Movimientos</h5>
            <span style="font-size:0.8rem; color:#9ca3af;">Listado ordenado con desglose de totales por tipo de flujo</span>
          </div>

          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <input type="text" id="finanzas-search-input" placeholder="🔍 Buscar por ID, cliente..." 
                   style="background:#111827; border:1px solid #374151; color:#fff; padding:8px 12px; border-radius:8px; font-size:0.85rem; width:180px;"
                   oninput="updateFinanzasRecordsTable()" />

            <select id="finanzas-flow-filter" style="background:#111827; border:1px solid #374151; color:#fff; padding:8px 12px; border-radius:8px; font-size:0.85rem;"
                    onchange="updateFinanzasRecordsTable()">
              <option value="all">🌐 Todos los Movimientos</option>
              <option value="ingresos">🟢 Solo Ingresos</option>
              <option value="egresos">🔴 Solo Egresos</option>
              <option value="facturas">🧾 Solo Facturas</option>
            </select>

            <div id="finanzas-total-badge" style="background:#0f172a; border:1px solid #00ffcc; padding:6px 14px; border-radius:20px; font-size:0.9rem; font-weight:800; color:#00ffcc; font-family:monospace;">
              Total: RD$ 0.00
            </div>
          </div>
        </div>

        <div id="finanzas-records-table-body" style="max-height:420px; overflow-y:auto; display:flex; flex-direction:column; gap:8px; padding-right:4px;">
        </div>
      </div>
    </div>
  `;

  container.innerHTML = chartHtml;
  setTimeout(window.updateFinanzasRecordsTable, 0);
}

window.updateMaterialesRecordsTable = function() {
  const container = document.getElementById('materiales-records-table-body');
  const badge = document.getElementById('materiales-total-badge');
  const query = (document.getElementById('materiales-search-input')?.value || '').toLowerCase().trim();
  const selectedMatId = document.getElementById('material-filter-select')?.value || 'all';

  if (!container || !window._currentMaterialesItems) return;

  const familySelect = document.getElementById('trading-family-select');
  const familyId = familySelect?.value;
  const customCodes = (typeof getCustomCodes === 'function') ? getCustomCodes() : [];
  const familyMaterials = customCodes.filter(c => c.familyId === familyId);

  let materialEntries = [];
  window._currentMaterialesItems.forEach(i => {
    if (i.type === 'basica' && Array.isArray(i.items)) {
      i.items.forEach(item => {
        const match = familyMaterials.find(fm => fm.id === item.matId || fm.name.toLowerCase() === item.name.toLowerCase());
        if (match || familyMaterials.length === 0) {
          materialEntries.push({
            matId: match ? match.id : item.matId,
            bitacoraId: i.id,
            date: i.date || i.createdAt,
            createdAt: i.createdAt || i.date,
            matName: item.name,
            matCode: match ? match.code : 'GEN',
            qty: parseFloat(item.qty || 0),
            unit: item.unit || match?.unit || 'kg',
            collaborator: i.collaborator || '—'
          });
        }
      });
    }
  });

  // Filter exclusively by selected material if a specific material is chosen
  if (selectedMatId !== 'all') {
    materialEntries = materialEntries.filter(m => m.matId === selectedMatId);
  }

  materialEntries.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

  if (query) {
    materialEntries = materialEntries.filter(m =>
      m.matName.toLowerCase().includes(query) ||
      m.matCode.toLowerCase().includes(query) ||
      m.bitacoraId.toLowerCase().includes(query) ||
      m.collaborator.toLowerCase().includes(query)
    );
  }

  const totalWeight = materialEntries.reduce((sum, m) => sum + m.qty, 0);
  if (badge) {
    badge.innerHTML = `Peso Acumulado: ${totalWeight.toLocaleString('es-DO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
  }

  if (materialEntries.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:#64748b; padding:35px; font-size:0.9rem;">No hay registros de pesaje para el material seleccionado.</div>`;
    return;
  }

  container.innerHTML = materialEntries.map(m => {
    const dateStr = m.createdAt ? new Date(m.createdAt).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' }) : (m.date || '—');
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; background:#0f172a; border:1px solid #1e293b; border-radius:10px; padding:12px 16px; gap:12px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:200px;">
          <span style="background:rgba(0,255,255,0.15); color:#00ffff; border:1px solid rgba(0,255,255,0.3); padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:700;">📦 ${m.matCode}</span>
          <div style="display:flex; flex-direction:column; min-width:0;">
            <span style="font-weight:700; color:#f8fafc; font-size:0.92rem;">${m.matName}</span>
            <span style="font-size:0.78rem; color:#94a3b8;">Bitácora: N.º ${m.bitacoraId} • Colaborador: ${m.collaborator}</span>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:20px; flex-shrink:0;">
          <div style="display:flex; flex-direction:column; align-items:flex-end;">
            <span style="font-size:0.75rem; color:#64748b; font-family:monospace;">📅 ${dateStr}</span>
            <span style="font-size:1.05rem; font-weight:800; color:#00ffff; font-family:monospace;">${m.qty.toFixed(1)} ${m.unit}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

function drawTradingMaterialesChart(items) {
  const container = document.getElementById('trading-chart-container');
  const familySelect = document.getElementById('trading-family-select');
  if (!container || !familySelect) return;

  window._currentMaterialesItems = items;

  const familyId = familySelect.value;
  if (!familyId) {
    container.innerHTML = `<div style="text-align:center; color:#9ca3af; padding:60px; font-size:1.05rem;">Por favor, selecciona o crea una familia de materiales primero.</div>`;
    return;
  }

  const families = (typeof getMaterialFamilies === 'function') ? getMaterialFamilies() : [];
  const family = families.find(f => f.id === familyId);
  const familyName = family ? family.name : 'Familia';

  const customCodes = (typeof getCustomCodes === 'function') ? getCustomCodes() : [];
  const familyMaterials = customCodes.filter(c => c.familyId === familyId);

  if (familyMaterials.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:#9ca3af; padding:60px; font-size:1.05rem;">No hay materiales asociados a la familia <b>${familyName}</b>. Ve a la sección de Códigos de Materiales para asociar códigos a esta familia.</div>`;
    return;
  }

  const totals = {};
  familyMaterials.forEach(m => {
    totals[m.id] = { id: m.id, name: m.name, code: m.code, qty: 0, unit: m.unit || 'kg' };
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
    container.innerHTML = `<div style="text-align:center; color:#9ca3af; padding:60px; font-size:1.05rem;">No se registran transacciones de bitácoras para los materiales de la familia <b>${familyName}</b> en este período.</div>`;
    return;
  }

  let maxQty = Math.max(...chartData.map(d => d.qty), 1);
  let chartRowsSvg = '';
  const rowHeight = 78;
  const chartHeight = chartData.length * rowHeight + 60;
  const startY = 30;
  const labelWidth = 270;
  const graphWidth = 500;

  chartData.forEach((d, idx) => {
    const yPos = startY + idx * rowHeight;
    const barWidth = Math.max(18, (d.qty / maxQty) * graphWidth);
    
    chartRowsSvg += `
      <!-- Label -->
      <text x="${labelWidth - 20}" y="${yPos + 26}" font-size="16" fill="#f8fafc" text-anchor="end" font-family="system-ui, -apple-system, sans-serif" font-weight="800">${d.name} (${d.code})</text>
      
      <!-- Bar Background -->
      <rect x="${labelWidth}" y="${yPos + 4}" width="${graphWidth}" height="32" rx="16" fill="#1e293b" />
      <!-- Bar Foreground (Cyan glow) -->
      <rect x="${labelWidth}" y="${yPos + 4}" width="${barWidth}" height="32" rx="16" fill="url(#cyanGlowGrad)" filter="url(#cyanGlow)" />
      
      <!-- Value Tag -->
      <text x="${labelWidth + barWidth + 18}" y="${yPos + 26}" font-size="17" fill="#00ffff" font-family="system-ui, -apple-system, sans-serif" font-weight="900" letter-spacing="0.02em">${d.qty.toLocaleString('es-DO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${d.unit}</text>
    `;
  });

  const materialOptionsHtml = familyMaterials.map(m => `<option value="${m.id}">📦 ${m.name} (${m.code})</option>`).join('');

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:20px; width:100%;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1f2937; padding-bottom:16px;">
        <h4 style="margin:0; font-size:1.45rem; font-weight:900; color:#fff; letter-spacing:-0.02em;">📦 Volumen por Material: Familia ${familyName}</h4>
        <span style="font-size:0.95rem; color:#9ca3af; font-weight:600;">Pesaje acumulado en Bitácoras</span>
      </div>

      <svg width="100%" height="${chartHeight}" viewBox="0 0 960 ${chartHeight}" style="background:#090d16; border:1px solid #1e293b; border-radius:16px; overflow:visible; padding:12px;">
        <defs>
          <linearGradient id="cyanGlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#3b82f6" />
            <stop offset="100%" stop-color="#00ffff" />
          </linearGradient>
          <filter id="cyanGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        <line x1="${labelWidth}" y1="10" x2="${labelWidth}" y2="${chartHeight - 20}" stroke="#334155" stroke-width="2" />
        
        ${chartRowsSvg}
      </svg>

      <!-- Tabla Detallada de Pesajes -->
      <div style="margin-top:12px; background:#090d16; border:1px solid #1e293b; border-radius:16px; padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; margin-bottom:16px; border-bottom:1px solid #1e293b; padding-bottom:14px;">
          <div>
            <h5 style="margin:0; font-size:1.15rem; font-weight:800; color:#fff;">📋 Pesaje Detallado por Material y Bitácora</h5>
            <span style="font-size:0.8rem; color:#9ca3af;">Filtrado exclusivo por tipo de material</span>
          </div>

          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <select id="material-filter-select" 
                    style="background:#111827; border:1px solid #374151; color:#00ffff; padding:8px 14px; border-radius:8px; font-size:0.88rem; font-weight:700;"
                    onchange="updateMaterialesRecordsTable()">
              <option value="all">🌐 Todos los Materiales</option>
              ${materialOptionsHtml}
            </select>

            <input type="text" id="materiales-search-input" placeholder="🔍 Buscar por código, Bitácora..." 
                   style="background:#111827; border:1px solid #374151; color:#fff; padding:8px 12px; border-radius:8px; font-size:0.85rem; width:200px;"
                   oninput="updateMaterialesRecordsTable()" />

            <div id="materiales-total-badge" style="background:#0f172a; border:1px solid #00ffff; padding:6px 14px; border-radius:20px; font-size:0.9rem; font-weight:800; color:#00ffff; font-family:monospace;">
              Peso Acumulado: 0.0 kg
            </div>
          </div>
        </div>

        <div id="materiales-records-table-body" style="max-height:420px; overflow-y:auto; display:flex; flex-direction:column; gap:8px; padding-right:4px;">
        </div>
      </div>
    </div>
  `;
  setTimeout(window.updateMaterialesRecordsTable, 0);
}

window.updateColaboradoresRecordsTable = function() {
  const container = document.getElementById('colab-records-table-body');
  const badge = document.getElementById('colab-total-badge');
  const colabFilter = document.getElementById('colab-name-filter')?.value || 'all';
  const query = (document.getElementById('colab-search-input')?.value || '').toLowerCase().trim();

  if (!container || !window._currentColabItems) return;

  let items = window._currentColabItems.filter(i => i.collaborator);

  items.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

  if (colabFilter !== 'all') {
    items = items.filter(i => i.collaborator === colabFilter);
  }

  if (query) {
    items = items.filter(i =>
      (i.id || '').toLowerCase().includes(query) ||
      (i.collaborator || '').toLowerCase().includes(query) ||
      (i.client || '').toLowerCase().includes(query) ||
      (i.company || '').toLowerCase().includes(query)
    );
  }

  if (badge) {
    badge.innerHTML = `Actividades Realizadas: ${items.length}`;
  }

  if (items.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:#64748b; padding:35px; font-size:0.9rem;">No hay actividades registradas para este colaborador.</div>`;
    return;
  }

  container.innerHTML = items.map(i => {
    const isBitacora = i.type === 'basica';
    const typeBadge = isBitacora
      ? `<span style="background:rgba(192,132,252,0.15); color:#c084fc; border:1px solid rgba(192,132,252,0.3); padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:700;">🚛 Bitácora</span>`
      : `<span style="background:rgba(59,130,246,0.15); color:#60a5fa; border:1px solid rgba(59,130,246,0.3); padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:700;">🧾 Factura</span>`;
    
    const title = `N.º ${i.id}`;
    const subtitle = `👤 ${i.collaborator} • ${i.client || i.company || 'Recolección'}`;
    const dateStr = i.createdAt ? new Date(i.createdAt).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' }) : (i.date || '—');

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; background:#0f172a; border:1px solid #1e293b; border-radius:10px; padding:12px 16px; gap:12px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:200px;">
          ${typeBadge}
          <div style="display:flex; flex-direction:column; min-width:0;">
            <span style="font-weight:700; color:#f8fafc; font-size:0.92rem;">${title}</span>
            <span style="font-size:0.78rem; color:#94a3b8;">${subtitle}</span>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:20px; flex-shrink:0;">
          <div style="display:flex; flex-direction:column; align-items:flex-end;">
            <span style="font-size:0.75rem; color:#64748b; font-family:monospace;">📅 ${dateStr}</span>
            <span style="font-size:1rem; font-weight:800; color:#c084fc; font-family:monospace;">${i.total ? safeFormatMoney(i.total) : 'Completado'}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

function drawTradingColaboradoresChart(items) {
  const container = document.getElementById('trading-chart-container');
  if (!container) return;

  window._currentColabItems = items;

  const colabs = JSON.parse(localStorage.getItem(userKey('recim_collaborators')) || '[]');
  if (colabs.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:#9ca3af; padding:60px; font-size:1.05rem;">No hay colaboradores registrados para analizar su rendimiento.</div>`;
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
    container.innerHTML = `<div style="text-align:center; color:#9ca3af; padding:60px; font-size:1.05rem;">Los colaboradores registrados no tienen actividades registradas en el historial de este período.</div>`;
    return;
  }

  let maxActivity = Math.max(...activeColabs.map(d => d.total), 1);
  let barSvgContent = '';
  const startX = 70;
  const spacingX = 110;
  const graphHeight = 220;
  const zeroY = 280;
  const barWidth = 44;

  activeColabs.forEach((d, idx) => {
    const xPos = startX + idx * spacingX;
    const h = (d.total / maxActivity) * graphHeight;
    const y = zeroY - h;
    const initialName = d.name.split(' ')[0] || d.name;
    
    barSvgContent += `
      <rect x="${xPos}" y="${y}" width="${barWidth}" height="${h}" rx="8" fill="url(#colabBarGrad)" filter="url(#colabGlow)" />
      <text x="${xPos + barWidth/2}" y="${y - 10}" font-size="13" fill="#c084fc" text-anchor="middle" font-family="monospace" font-weight="bold">${d.total}</text>
      <text x="${xPos + barWidth/2}" y="310" font-size="13" fill="#e5e7eb" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="700">${initialName}</text>
    `;
  });

  const barChartHtml = `
    <div style="flex:1.4; min-width:340px; display:flex; flex-direction:column; gap:12px;">
      <h5 style="margin:0; font-size:1.15rem; font-weight:800; color:#fff;">📊 Actividad Total por Colaborador</h5>
      <svg width="100%" height="340" viewBox="0 0 480 340" style="background:#090d16; border:1px solid #1e293b; border-radius:16px; overflow:visible; padding:10px;">
        <defs>
          <linearGradient id="colabBarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#c084fc" />
            <stop offset="100%" stop-color="#6366f1" />
          </linearGradient>
          <filter id="colabGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <line x1="45" y1="60" x2="450" y2="60" stroke="#1e293b" stroke-width="1" stroke-dasharray="3,3" />
        <line x1="45" y1="170" x2="450" y2="170" stroke="#1e293b" stroke-width="1" stroke-dasharray="3,3" />
        <line x1="45" y1="280" x2="450" y2="280" stroke="#334155" stroke-width="2" />
        
        <text x="38" y="64" font-size="11" fill="#64748b" text-anchor="end" font-family="monospace" font-weight="600">${maxActivity}</text>
        <text x="38" y="174" font-size="11" fill="#64748b" text-anchor="end" font-family="monospace" font-weight="600">${Math.round(maxActivity/2)}</text>
        <text x="38" y="284" font-size="11" fill="#64748b" text-anchor="end" font-family="monospace" font-weight="600">0</text>
        
        ${barSvgContent}
      </svg>
    </div>
  `;

  const colors = ['#00ffcc', '#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6', '#10b981'];

  const bitList = activeColabs.filter(d => d.bitacoras > 0);
  const totalBit = bitList.reduce((s, d) => s + d.bitacoras, 0);
  let donut1Html = '';

  if (totalBit === 0) {
    donut1Html = `
      <div style="flex:1; min-width:260px; display:flex; flex-direction:column; gap:10px;">
        <h5 style="margin:0; font-size:1.1rem; font-weight:800; color:#fff;">🚛 Bitácoras</h5>
        <div style="display:flex; align-items:center; justify-content:center; height:240px; background:#090d16; border:1px solid #1e293b; border-radius:16px; font-size:0.9rem; color:#64748b;">
          Sin bitácoras registradas.
        </div>
      </div>
    `;
  } else {
    let stroke1 = '';
    let accumulated1 = 0;
    const perimeter = 2 * Math.PI * 50; // 314.15
    
    bitList.forEach((d, idx) => {
      const pct = d.bitacoras / totalBit;
      const strokeLen = pct * perimeter;
      const strokeOffset = perimeter - (accumulated1 * perimeter);
      const color = colors[idx % colors.length];
      
      stroke1 += `
        <circle cx="75" cy="75" r="50" fill="transparent" stroke="${color}" stroke-width="16" 
                stroke-dasharray="${strokeLen} ${perimeter}" stroke-dashoffset="${strokeOffset}" 
                transform="rotate(-90 75 75)" style="filter: drop-shadow(0 0 3px ${color});" />
      `;
      accumulated1 += pct;
    });

    const legend1 = bitList.map((d, idx) => {
      const color = colors[idx % colors.length];
      const pctVal = Math.round((d.bitacoras / totalBit) * 100);
      return `
        <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.85rem; gap:12px;">
          <span style="display:inline-flex; align-items:center; gap:6px; font-weight:600; color:#fff;"><span style="width:8px; height:8px; border-radius:2px; background:${color}; display:inline-block;"></span>${d.name.split(' ')[0]}</span>
          <span style="color:#9ca3af; font-family:monospace; font-weight:600;">${d.bitacoras} (${pctVal}%)</span>
        </div>
      `;
    }).join('');

    donut1Html = `
      <div style="flex:1; min-width:260px; display:flex; flex-direction:column; gap:10px;">
        <h5 style="margin:0; font-size:1.1rem; font-weight:800; color:#fff;">🚛 Bitácoras (Total: ${totalBit})</h5>
        <div style="display:flex; gap:16px; align-items:center; background:#090d16; border:1px solid #1e293b; border-radius:16px; padding:20px; min-height:240px; justify-content:center;">
          <svg width="150" height="150" viewBox="0 0 150 150" style="flex-shrink:0;">
            <circle cx="75" cy="75" r="50" fill="transparent" stroke="#1e293b" stroke-width="16" />
            ${stroke1}
            <circle cx="75" cy="75" r="40" fill="#090d16" />
          </svg>
          <div style="flex:1; display:flex; flex-direction:column; gap:6px; min-width:130px;">
            ${legend1}
          </div>
        </div>
      </div>
    `;
  }

  const facList = activeColabs.filter(d => d.invoices > 0);
  const totalFac = facList.reduce((s, d) => s + d.invoices, 0);
  let donut2Html = '';

  if (totalFac === 0) {
    donut2Html = `
      <div style="flex:1; min-width:260px; display:flex; flex-direction:column; gap:10px;">
        <h5 style="margin:0; font-size:1.1rem; font-weight:800; color:#fff;">🧾 Facturas</h5>
        <div style="display:flex; align-items:center; justify-content:center; height:240px; background:#090d16; border:1px solid #1e293b; border-radius:16px; font-size:0.9rem; color:#64748b;">
          Sin facturas registradas.
        </div>
      </div>
    `;
  } else {
    let stroke2 = '';
    let accumulated2 = 0;
    const perimeter = 2 * Math.PI * 50;
    
    facList.forEach((d, idx) => {
      const pct = d.invoices / totalFac;
      const strokeLen = pct * perimeter;
      const strokeOffset = perimeter - (accumulated2 * perimeter);
      const color = colors[(idx + 2) % colors.length];
      
      stroke2 += `
        <circle cx="75" cy="75" r="50" fill="transparent" stroke="${color}" stroke-width="16" 
                stroke-dasharray="${strokeLen} ${perimeter}" stroke-dashoffset="${strokeOffset}" 
                transform="rotate(-90 75 75)" style="filter: drop-shadow(0 0 3px ${color});" />
      `;
      accumulated2 += pct;
    });

    const legend2 = facList.map((d, idx) => {
      const color = colors[(idx + 2) % colors.length];
      const pctVal = Math.round((d.invoices / totalFac) * 100);
      return `
        <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.85rem; gap:12px;">
          <span style="display:inline-flex; align-items:center; gap:6px; font-weight:600; color:#fff;"><span style="width:8px; height:8px; border-radius:2px; background:${color}; display:inline-block;"></span>${d.name.split(' ')[0]}</span>
          <span style="color:#9ca3af; font-family:monospace; font-weight:600;">${d.invoices} (${pctVal}%)</span>
        </div>
      `;
    }).join('');

    donut2Html = `
      <div style="flex:1; min-width:260px; display:flex; flex-direction:column; gap:10px;">
        <h5 style="margin:0; font-size:1.1rem; font-weight:800; color:#fff;">🧾 Facturas (Total: ${totalFac})</h5>
        <div style="display:flex; gap:16px; align-items:center; background:#090d16; border:1px solid #1e293b; border-radius:16px; padding:20px; min-height:240px; justify-content:center;">
          <svg width="150" height="150" viewBox="0 0 150 150" style="flex-shrink:0;">
            <circle cx="75" cy="75" r="50" fill="transparent" stroke="#1e293b" stroke-width="16" />
            ${stroke2}
            <circle cx="75" cy="75" r="40" fill="#090d16" />
          </svg>
          <div style="flex:1; display:flex; flex-direction:column; gap:6px; min-width:130px;">
            ${legend2}
          </div>
        </div>
      </div>
    `;
  }

  const colabOptionsHtml = colabs.map(c => `<option value="${c.name}">👤 ${c.name}</option>`).join('');

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:24px; width:100%;">
      <div style="border-bottom:1px solid #1f2937; padding-bottom:16px;">
        <h4 style="margin:0; font-size:1.3rem; font-weight:800; color:#fff;">👥 Rendimiento y Actividad de Colaboradores</h4>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:24px; width:100%;">
        ${barChartHtml}
        <div style="flex:2; display:flex; flex-wrap:wrap; gap:24px; min-width:300px;">
          ${donut1Html}
          ${donut2Html}
        </div>
      </div>

      <!-- Tabla Detallada de Actividades por Colaborador -->
      <div style="margin-top:12px; background:#090d16; border:1px solid #1e293b; border-radius:16px; padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; margin-bottom:16px; border-bottom:1px solid #1e293b; padding-bottom:14px;">
          <div>
            <h5 style="margin:0; font-size:1.15rem; font-weight:800; color:#fff;">📋 Historial de Actividades por Colaborador</h5>
            <span style="font-size:0.8rem; color:#9ca3af;">Recogidas y transacciones asignadas</span>
          </div>

          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <input type="text" id="colab-search-input" placeholder="🔍 Buscar por ID..." 
                   style="background:#111827; border:1px solid #374151; color:#fff; padding:8px 12px; border-radius:8px; font-size:0.85rem; width:180px;"
                   oninput="updateColaboradoresRecordsTable()" />

            <select id="colab-name-filter" style="background:#111827; border:1px solid #374151; color:#fff; padding:8px 12px; border-radius:8px; font-size:0.85rem;"
                    onchange="updateColaboradoresRecordsTable()">
              <option value="all">🌐 Todos los Colaboradores</option>
              ${colabOptionsHtml}
            </select>

            <div id="colab-total-badge" style="background:#0f172a; border:1px solid #c084fc; padding:6px 14px; border-radius:20px; font-size:0.9rem; font-weight:800; color:#c084fc; font-family:monospace;">
              Actividades Realizadas: 0
            </div>
          </div>
        </div>

        <div id="colab-records-table-body" style="max-height:420px; overflow-y:auto; display:flex; flex-direction:column; gap:8px; padding-right:4px;">
        </div>
      </div>
    </div>
  `;
  setTimeout(window.updateColaboradoresRecordsTable, 0);
}

window.updateVolumeRecordsTable = function() {
  const container = document.getElementById('volume-records-table-body');
  const badge = document.getElementById('volume-total-badge');
  const query = (document.getElementById('volume-search-input')?.value || '').toLowerCase().trim();

  if (!container || !window._currentVolumeItems) return;

  const type = window._currentVolumeType;
  const filterType = type === 'bitacoras' ? ['basica'] : ['local', 'empresa'];
  let items = window._currentVolumeItems.filter(i => filterType.includes(i.type));

  items.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

  if (query) {
    items = items.filter(i =>
      (i.id || '').toLowerCase().includes(query) ||
      (i.client || '').toLowerCase().includes(query) ||
      (i.company || '').toLowerCase().includes(query) ||
      (i.collaborator || '').toLowerCase().includes(query)
    );
  }

  if (badge) {
    badge.innerHTML = `Total Registros: ${items.length}`;
  }

  if (items.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:#64748b; padding:35px; font-size:0.9rem;">No hay registros para mostrar.</div>`;
    return;
  }

  const neonColor = type === 'bitacoras' ? '#00ffcc' : '#3b82f6';
  const labelPrefix = type === 'bitacoras' ? '🚛 Bitácora' : '🧾 Factura';

  container.innerHTML = items.map(i => {
    const title = `N.º ${i.id}`;
    const subtitle = i.client || i.company || (type === 'bitacoras' ? 'Pesaje de Residuos' : 'Venta de Material');
    const dateStr = i.createdAt ? new Date(i.createdAt).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' }) : (i.date || '—');

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; background:#0f172a; border:1px solid #1e293b; border-radius:10px; padding:12px 16px; gap:12px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:200px;">
          <span style="background:rgba(0,255,204,0.15); color:${neonColor}; border:1px solid rgba(0,255,204,0.3); padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:700;">${labelPrefix}</span>
          <div style="display:flex; flex-direction:column; min-width:0;">
            <span style="font-weight:700; color:#f8fafc; font-size:0.92rem;">${title}</span>
            <span style="font-size:0.78rem; color:#94a3b8;">${subtitle}</span>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:20px; flex-shrink:0;">
          <div style="display:flex; flex-direction:column; align-items:flex-end;">
            <span style="font-size:0.75rem; color:#64748b; font-family:monospace;">📅 ${dateStr}</span>
            <span style="font-size:1.05rem; font-weight:800; color:${neonColor}; font-family:monospace;">${i.total ? safeFormatMoney(i.total) : 'Registrado'}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

function drawTradingVolumeChart(items, type) {
  const container = document.getElementById('trading-chart-container');
  if (!container) return;

  window._currentVolumeItems = items;
  window._currentVolumeType = type;

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
    container.innerHTML = `<div style="text-align:center; color:#9ca3af; padding:60px; font-size:1.05rem;">No hay registros de ${type === 'bitacoras' ? 'bitácoras' : 'facturas'} para mostrar en este rango de fechas.</div>`;
    return;
  }

  const maxVal = Math.max(...Object.values(monthly), 5);

  let barSvgContent = '';
  const startX = 85;
  const spacingX = 110;
  const graphHeight = 230;
  const zeroY = 300;
  const barWidth = 48;

  sortedMonths.forEach((m, idx) => {
    const xPos = startX + idx * spacingX;
    const val = monthly[m];
    const h = (val / maxVal) * graphHeight;
    const y = zeroY - h;
    const [year, mm] = m.split('-');
    const label = t('hist.month_' + mm).substring(0, 3).toUpperCase();

    barSvgContent += `
      <rect x="${xPos}" y="${y}" width="${barWidth}" height="${h}" rx="8" fill="${neonGrad}" filter="url(#glow)" />
      <text x="${xPos + barWidth/2}" y="${y - 10}" font-size="13" fill="${neonColor}" text-anchor="middle" font-family="monospace" font-weight="bold">${val}</text>
      <text x="${xPos + barWidth/2}" y="335" font-size="13" fill="#e5e7eb" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" letter-spacing="0.05em">${label}</text>
    `;
  });

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:20px; width:100%;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1f2937; padding-bottom:16px; flex-wrap:wrap; gap:12px;">
        <h4 style="margin:0; font-size:1.3rem; font-weight:800; color:#fff;">${title}</h4>
        <span style="font-size:0.9rem; color:#9ca3af; font-weight:500;">${subtitle}</span>
      </div>

      <svg width="100%" height="360" viewBox="0 0 760 360" style="background:#090d16; border:1px solid #1e293b; border-radius:16px; overflow:visible; padding:10px;">
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
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        <line x1="70" y1="70" x2="740" y2="70" stroke="#1e293b" stroke-width="1" stroke-dasharray="4,4" />
        <line x1="70" y1="185" x2="740" y2="185" stroke="#1e293b" stroke-width="1" stroke-dasharray="4,4" />
        <line x1="70" y1="300" x2="740" y2="300" stroke="#334155" stroke-width="2" />
        
        <text x="60" y="74" font-size="11" fill="#64748b" text-anchor="end" font-family="monospace" font-weight="600">${maxVal}</text>
        <text x="60" y="189" font-size="11" fill="#64748b" text-anchor="end" font-family="monospace" font-weight="600">${Math.round(maxVal/2)}</text>
        <text x="60" y="304" font-size="11" fill="#64748b" text-anchor="end" font-family="monospace" font-weight="600">0</text>
        
        ${barSvgContent}
      </svg>

      <!-- Tabla Detallada de Registros -->
      <div style="margin-top:12px; background:#090d16; border:1px solid #1e293b; border-radius:16px; padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; margin-bottom:16px; border-bottom:1px solid #1e293b; padding-bottom:14px;">
          <div>
            <h5 style="margin:0; font-size:1.15rem; font-weight:800; color:#fff;">📋 Listado Cronológico de Registros</h5>
            <span style="font-size:0.8rem; color:#9ca3af;">${type === 'bitacoras' ? 'Recogidas registradas' : 'Facturas emitidas'}</span>
          </div>

          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <input type="text" id="volume-search-input" placeholder="🔍 Buscar..." 
                   style="background:#111827; border:1px solid #374151; color:#fff; padding:8px 12px; border-radius:8px; font-size:0.85rem; width:200px;"
                   oninput="updateVolumeRecordsTable()" />

            <div id="volume-total-badge" style="background:#0f172a; border:1px solid ${neonColor}; padding:6px 14px; border-radius:20px; font-size:0.9rem; font-weight:800; color:${neonColor}; font-family:monospace;">
              Total Registros: 0
            </div>
          </div>
        </div>

        <div id="volume-records-table-body" style="max-height:420px; overflow-y:auto; display:flex; flex-direction:column; gap:8px; padding-right:4px;">
        </div>
      </div>
    </div>
  `;
  setTimeout(window.updateVolumeRecordsTable, 0);
}
