/* =============================================
   FINANCE.JS – Ingresos y Egresos
   ============================================= */

const INCOME_CATEGORIES_KEYS = ['Materiales', 'Empresarial', 'Otros'];
const EXPENSE_CATEGORIES_KEYS = ['Operación', 'Transporte', 'Salarios', 'Mantenimiento', 'Servicios', 'Otros'];

function addFinanceEntry(type, entry) {
  const baseKey = type === 'ingreso' ? 'recim_ingresos' : 'recim_egresos';
  const list = JSON.parse(localStorage.getItem(userKey(baseKey)) || '[]');
  const newEntry = {
    id: `${type.toUpperCase().slice(0, 3)}-${Date.now()}`,
    currency: (typeof getCurrency === 'function') ? getCurrency().code : 'DOP',
    ...entry,
    createdAt: new Date().toISOString()
  };
  list.unshift(newEntry);
  localStorage.setItem(userKey(baseKey), JSON.stringify(list));
}

// NOTE: Firebase sync is handled centrally by sync.js (syncPushData / syncPullData).
// Do NOT add on('value') listeners here — they bypass delete logic and restore deleted data.

// ---- Category breakdown renderer ----
function renderCategoryBreakdown(entries, isIncome) {
  if (entries.length === 0) return '';
  const totals = {};
  let grand = 0;
  entries.forEach(e => {
    const cat = e.category || '—';
    const converted = typeof getConvertedAmount === 'function' ? getConvertedAmount(e.amount, e.currency) : (e.amount || 0);
    totals[cat] = (totals[cat] || 0) + converted;
    grand += converted;
  });
  if (grand === 0) return '';
  const color = isIncome ? 'var(--clr-primary)' : '#ef4444';
  const rows = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => {
      const pct = Math.round((amt / grand) * 100);
      return `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:4px;">
          <span style="font-weight:600;">${t('cat.' + cat) || cat}</span>
          <span style="color:var(--clr-text-muted);">${formatMoney(amt)} <span style="font-size:0.75rem;">(${pct}%)</span></span>
        </div>
        <div style="background:var(--clr-surface-3);border-radius:4px;height:7px;overflow:hidden;">
          <div style="height:100%;background:${color};width:${pct}%;transition:width .4s;"></div>
        </div>
      </div>`;
    }).join('');
  return `
    <div class="card" style="margin-bottom:16px;">
      <h3 class="section-title" style="margin-bottom:14px;font-size:0.95rem;">📊 ${t('fin.by_category')}</h3>
      ${rows}
    </div>`;
}


// =============================================
// INGRESOS PAGE
// =============================================

function renderIngresosPage(container) {
  const entries = JSON.parse(localStorage.getItem(userKey('recim_ingresos')) || '[]');
  const total = entries.reduce((s, e) => s + (typeof getConvertedAmount === 'function' ? getConvertedAmount(e.amount, e.currency) : (e.amount || 0)), 0);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="section-title">${t('inc.title')}</h2>
        <p class="section-subtitle">${t('inc.subtitle')}</p>
      </div>
    </div>

    <div class="finance-grid">
      <!-- Form -->
      <div class="card card--elevated">
        <h3 class="section-title" style="margin-bottom:16px;">${t('inc.new')}</h3>
        <form onsubmit="handleAddIncome(event)" style="display:flex;flex-direction:column;gap:14px;">
          <div class="form-group">
            <label class="form-label">${t('lbl.concept')}</label>
            <input id="inc-concept" type="text" class="form-input" placeholder="${t('inc.concept_ph')}" required />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">${t('lbl.amount')} (${getCurrency().symbol})</label>
              <input id="inc-amount" type="number" class="form-input" placeholder="0.00" min="0" step="0.01" required />
            </div>
            <div class="form-group">
              <label class="form-label">${t('lbl.date')}</label>
              <input id="inc-date" type="date" class="form-input" value="${new Date().toISOString().split('T')[0]}" required />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">${t('lbl.category')}</label>
            <select id="inc-category" class="form-select">
              ${INCOME_CATEGORIES_KEYS.map(c => `<option value="${c}">${t('cat.' + c)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">${t('lbl.notes')} (${t('fin.optional')})</label>
            <input id="inc-notes" type="text" class="form-input" placeholder="${t('fin.observations_ph')}" />
          </div>
          <button type="submit" class="btn-primary">${t('inc.btn')}</button>
        </form>
      </div>

      <!-- Summary + List -->
      <div>
        <div class="stat-card" style="margin-bottom:16px;">
          <div class="stat-label">${t('inc.total')}</div>
          <div class="stat-value stat-value--green">${formatMoney(total)}</div>
          <div class="stat-sub">${entries.length} ${t('inc.records')}</div>
        </div>

        ${renderCategoryBreakdown(entries, true)}

        <div class="card">
          <h3 class="section-title" style="margin-bottom:12px; font-size:1rem;">${t('inc.last')}</h3>
          ${renderFinanceList(entries, 'ingreso')}
        </div>
      </div>
    </div>
  `;
}

function handleAddIncome(evt) {
  evt.preventDefault();
  const concept = document.getElementById('inc-concept').value.trim();
  const amount = parseFloat(document.getElementById('inc-amount').value) || 0;
  const date = document.getElementById('inc-date').value;
  const category = document.getElementById('inc-category').value;
  const notes = document.getElementById('inc-notes').value.trim();

  if (!concept || amount <= 0) { showToast(t('err.fill_fields'), 'error'); return; }

  addFinanceEntry('ingreso', { concept, amount, date, category, notes });
  showToast(t('toast.inc_saved'), 'success');
  navigate('ingresos');
}

// =============================================
// EGRESOS PAGE
// =============================================

function renderEgresosPage(container) {
  const entries = JSON.parse(localStorage.getItem(userKey('recim_egresos')) || '[]');
  const total = entries.reduce((s, e) => s + (typeof getConvertedAmount === 'function' ? getConvertedAmount(e.amount, e.currency) : (e.amount || 0)), 0);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="section-title">${t('exp.title')}</h2>
        <p class="section-subtitle">${t('exp.subtitle')}</p>
      </div>
    </div>

    <div class="finance-grid">
      <!-- Form -->
      <div class="card card--elevated">
        <h3 class="section-title" style="margin-bottom:16px;">${t('exp.new')}</h3>
        <form onsubmit="handleAddExpense(event)" style="display:flex;flex-direction:column;gap:14px;">
          <div class="form-group">
            <label class="form-label">${t('lbl.concept')}</label>
            <input id="exp-concept" type="text" class="form-input" placeholder="${t('exp.concept_ph')}" required />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">${t('lbl.amount')} (${getCurrency().symbol})</label>
              <input id="exp-amount" type="number" class="form-input" placeholder="0.00" min="0" step="0.01" required />
            </div>
            <div class="form-group">
              <label class="form-label">${t('lbl.date')}</label>
              <input id="exp-date" type="date" class="form-input" value="${new Date().toISOString().split('T')[0]}" required />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">${t('lbl.category')}</label>
            <select id="exp-category" class="form-select">
              ${EXPENSE_CATEGORIES_KEYS.map(c => `<option value="${c}">${t('cat.' + c)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">${t('lbl.notes')} (${t('fin.optional')})</label>
            <input id="exp-notes" type="text" class="form-input" placeholder="${t('fin.observations_ph')}" />
          </div>
          <button type="submit" class="btn-primary" style="background:linear-gradient(135deg,#ef4444,#b91c1c);box-shadow:0 4px 15px rgba(239,68,68,0.3);">${t('exp.btn')}</button>
        </form>
      </div>

      <!-- Summary + List -->
      <div>
        <div class="stat-card" style="margin-bottom:16px;border-color:rgba(239,68,68,0.2);">
          <div class="stat-label">${t('exp.total')}</div>
          <div class="stat-value stat-value--red">${formatMoney(total)}</div>
          <div class="stat-sub">${entries.length} ${t('inc.records')}</div>
        </div>

        ${renderCategoryBreakdown(entries, false)}

        <div class="card">
          <h3 class="section-title" style="margin-bottom:12px; font-size:1rem;">${t('exp.last')}</h3>
          ${renderFinanceList(entries, 'egreso')}
        </div>
      </div>
    </div>
  `;
}

function handleAddExpense(evt) {
  evt.preventDefault();
  const concept = document.getElementById('exp-concept').value.trim();
  const amount = parseFloat(document.getElementById('exp-amount').value) || 0;
  const date = document.getElementById('exp-date').value;
  const category = document.getElementById('exp-category').value;
  const notes = document.getElementById('exp-notes').value.trim();

  if (!concept || amount <= 0) { showToast(t('err.fill_fields'), 'error'); return; }

  addFinanceEntry('egreso', { concept, amount, date, category, notes });
  showToast(t('toast.exp_saved'), 'success');
  navigate('egresos');
}

// ---- Shared list renderer ----
function renderFinanceList(entries, type) {
  if (entries.length === 0) {
    return `<div class="empty-state">
      <div class="empty-state-icon">${type === 'ingreso' ? '💰' : '💸'}</div>
      <p class="empty-state-text">${t('empty.no_records')}</p>
    </div>`;
  }

  const isIncome = type === 'ingreso';

  return `<div style="display:flex;flex-direction:column;gap:8px;max-height:420px;overflow-y:auto;">
    ${entries.map(e => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--clr-surface-3);border-radius:var(--r-sm);border:1px solid var(--clr-border);">
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.88rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.concept}</div>
          <div style="font-size:0.75rem;color:var(--clr-text-muted);">${formatDate(e.date)} &bull; ${(t('cat.' + e.category) !== 'cat.' + e.category ? t('cat.' + e.category) : e.category) || '—'}${e.notes ? ' &bull; ' + e.notes : ''}</div>
        </div>
        <div style="font-weight:700;color:${isIncome ? 'var(--clr-primary-light)' : '#f87171'};white-space:nowrap;">
          ${isIncome ? '+' : '-'}${formatMoney(e.amount, e.currency || 'DOP')}
        </div>
        <button class="btn-danger" style="padding:5px 8px;font-size:0.75rem;" onclick="deleteFinanceEntry('${type}','${e.id}')">✕</button>
      </div>`).join('')}
  </div>`;
}

function deleteFinanceEntry(type, id) {
  const baseKey = type === 'ingreso' ? 'recim_ingresos' : 'recim_egresos';
  const list = JSON.parse(localStorage.getItem(userKey(baseKey)) || '[]').filter(e => e.id !== id);
  // localStorage override in sync.js automatically pushes deletion to Firebase
  localStorage.setItem(userKey(baseKey), JSON.stringify(list));
  showToast(t('toast.del_entry'), 'success');
  rerenderCurrentPage();
}
