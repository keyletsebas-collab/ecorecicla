/* =============================================
   QUICK-CONTROL-TOOLS.JS – Herramientas Rápidas del Centro de Control Android
   1) Mini sección para registrar Bitácoras de Recogida (guardando en Supabase)
   2) Mini sección para emitir Facturas con validación DGII (guardando en Supabase)
   ============================================= */

(function () {
  function _qctEscape(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _qctNormBranchId(branchId) {
    if (typeof normalizeBranchId === 'function') return normalizeBranchId(branchId);
    const val = String(branchId || '').trim();
    return val || 'SUC-PRINCIPAL';
  }

  function _qctResolveBranchName(branchId) {
    const cleanId = _qctNormBranchId(branchId);
    if (typeof resolveBranchNameById === 'function') return resolveBranchNameById(cleanId);
    if (typeof getCompanyBranches === 'function') {
      const found = getCompanyBranches().find(b => b && b.id === cleanId);
      if (found) return found.name || 'Sede Principal';
    }
    return 'Sede Principal';
  }

  function _qctGetBranchOptionsHtml(selectedId) {
    const branches = typeof getCompanyBranches === 'function'
      ? getCompanyBranches()
      : [{ id: 'SUC-PRINCIPAL', name: 'Sede Principal', isDefault: true }];
    const activeId = _qctNormBranchId(
      selectedId || (typeof getActiveBranchId === 'function' ? getActiveBranchId() : 'SUC-PRINCIPAL')
    );
    const canSwitch = typeof canCurrentUserSwitchBranches === 'function'
      ? canCurrentUserSwitchBranches()
      : true;

    const filtered = (!canSwitch && branches.length > 0)
      ? branches.filter(b => b.id === activeId || b.id === 'SUC-PRINCIPAL').slice(0, 1)
      : branches;

    return {
      disabled: !canSwitch,
      activeId,
      optionsHtml: (filtered.length > 0 ? filtered : branches).map(b => {
        const sel = b.id === activeId ? 'selected' : '';
        return `<option value="${_qctEscape(b.id)}" ${sel}>${_qctEscape(b.name)}${b.isDefault ? ' (Principal)' : ''}</option>`;
      }).join('')
    };
  }

  function _qctGetClientOptionsHtml(branchId) {
    const clients = typeof getClients === 'function'
      ? getClients(branchId)
      : JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
    if (!Array.isArray(clients) || clients.length === 0) {
      return '<option value="">-- Cliente General / Manual --</option>';
    }
    return `<option value="">-- Seleccionar cliente registrado --</option>` +
      clients.map(c => `<option value="${_qctEscape(c.id)}">${_qctEscape(c.name)}${c.rnc ? ' (' + _qctEscape(c.rnc) + ')' : ''}</option>`).join('');
  }

  function _qctGetColabOptionsHtml() {
    let colabs = [];
    try {
      colabs = JSON.parse(localStorage.getItem(userKey('recim_collaborators')) || '[]');
    } catch (_) {
      colabs = [];
    }
    const list = Array.isArray(colabs) ? colabs.filter(c => c && c.active !== false) : [];
    return `<option value="">-- Sin asignar --</option>` +
      list.map(c => `<option value="${_qctEscape(c.name || '')}">${_qctEscape(c.name || '')}${c.role ? ' (' + _qctEscape(c.role) + ')' : ''}</option>`).join('');
  }

  function _qctGetMaterials(branchId) {
    return typeof getMaterialCodes === 'function'
      ? getMaterialCodes(branchId)
      : JSON.parse(localStorage.getItem(userKey('recim_material_codes')) || '[]');
  }

  function _qctMoney(val) {
    return typeof formatMoney === 'function' ? formatMoney(val || 0) : `$${Number(val || 0).toFixed(2)}`;
  }

  function _qctCurrencySymbol() {
    return typeof getCurrency === 'function' ? (getCurrency().symbol || 'RD$') : 'RD$';
  }

  function _qctIsNativeAndroid() {
    return !!(window.AndroidNative && typeof window.AndroidNative.RequestAddControlCenterTile === 'function');
  }

  function closeQuickControlTool() {
    const modal = document.getElementById('quick-control-tool-modal');
    if (modal) modal.remove();
  }

  function openQuickControlTool(mode = 'bitacora') {
    const safeMode = mode === 'factura' ? 'factura' : 'bitacora';

    let activeUser = null;
    try {
      activeUser = typeof getCurrentUser === 'function'
        ? getCurrentUser()
        : JSON.parse(localStorage.getItem('recim_session') || 'null');
    } catch (_) {
      activeUser = null;
    }
    if (!activeUser || !activeUser.accountId) {
      window.__PENDING_QUICK_TOOL__ = safeMode;
      return;
    }

    window.__PENDING_QUICK_TOOL__ = '';
    if (window.AndroidNative && typeof window.AndroidNative.ConsumePendingQuickTool === 'function') {
      try { window.AndroidNative.ConsumePendingQuickTool(); } catch (_) {}
    }

    closeQuickControlTool();

    const modal = document.createElement('div');
    modal.id = 'quick-control-tool-modal';
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.style.zIndex = '9999';
    modal.onclick = (ev) => {
      if (ev.target === modal) closeQuickControlTool();
    };

    const nativePinBanner = _qctIsNativeAndroid()
      ? `<div style="display:inline-flex; align-items:center; gap:6px; flex-wrap:wrap;">
           <button type="button" onclick="window.requestAndroidControlCenterTiles('bitacora')" style="background:rgba(59,130,246,0.16); color:#93c5fd; border:1px solid rgba(59,130,246,0.35); border-radius:8px; padding:6px 10px; font-size:0.76rem; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:5px;" title="Agrega el botón Bitácora junto al Bluetooth, Wi-Fi y Linterna">
             📲 + Botón Bitácora en Centro de Control
           </button>
           <button type="button" onclick="window.requestAndroidControlCenterTiles('factura')" style="background:rgba(34,197,94,0.16); color:#86efac; border:1px solid rgba(34,197,94,0.35); border-radius:8px; padding:6px 10px; font-size:0.76rem; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:5px;" title="Agrega el botón Nueva Factura junto al Bluetooth, Wi-Fi y Linterna">
             📲 + Botón Factura en Centro de Control
           </button>
         </div>`
      : `<span style="font-size:0.76rem; color:var(--clr-text-muted); padding:4px 8px; border:1px solid rgba(34,197,94,0.2); border-radius:8px;">
           ⚡ Botones rápidos del Centro de Control (junto a Wi-Fi, Bluetooth y Linterna)
         </span>`;

    modal.innerHTML = `
      <div class="modal" style="max-width:860px; width:96%; max-height:92vh; display:flex; flex-direction:column; overflow:hidden; background:linear-gradient(160deg, #101c13 0%, #09100b 100%) !important; color:var(--clr-text, #f0fdf4) !important; border:1px solid rgba(34,197,94,0.35) !important; border-radius:16px !important; box-shadow:0 24px 64px rgba(0,0,0,0.85);">
        <div style="padding:16px 20px; border-bottom:1px solid rgba(34,197,94,0.2); display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; background:rgba(0,0,0,0.28);">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <span style="font-size:1.35rem;">🎛️</span>
            <div>
              <h3 style="margin:0; font-size:1.08rem; font-weight:800;">Centro de Control Rápido</h3>
              <p style="margin:2px 0 0; font-size:0.76rem; color:var(--clr-text-muted);">Registra directo con sincronización en la nube Supabase</p>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            ${nativePinBanner}
            <button type="button" class="modal-close" onclick="closeQuickControlTool()" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.14); color:var(--clr-text-muted); border-radius:50%; width:32px; height:32px; cursor:pointer; font-weight:bold;">✕</button>
          </div>
        </div>

        <div style="display:flex; gap:8px; padding:12px 20px; border-bottom:1px solid rgba(255,255,255,0.06); background:rgba(0,0,0,0.18);">
          <button type="button" id="qct-tab-bitacora" onclick="openQuickControlTool('bitacora')" style="flex:1; padding:10px 14px; border-radius:10px; font-weight:800; font-size:0.86rem; cursor:pointer; border:1px solid ${safeMode === 'bitacora' ? '#22c55e' : 'rgba(255,255,255,0.12)'}; background:${safeMode === 'bitacora' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.04)'}; color:${safeMode === 'bitacora' ? '#86efac' : 'var(--clr-text-secondary)'};">
            🚛 Mini Bitácora de Recogida
          </button>
          <button type="button" id="qct-tab-factura" onclick="openQuickControlTool('factura')" style="flex:1; padding:10px 14px; border-radius:10px; font-weight:800; font-size:0.86rem; cursor:pointer; border:1px solid ${safeMode === 'factura' ? '#22c55e' : 'rgba(255,255,255,0.12)'}; background:${safeMode === 'factura' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.04)'}; color:${safeMode === 'factura' ? '#86efac' : 'var(--clr-text-secondary)'};">
            🧾 Mini Factura Rápida
          </button>
        </div>

        <div id="qct-modal-body" style="padding:18px 20px; overflow-y:auto; flex:1;">
          ${safeMode === 'bitacora' ? _renderQuickBitacoraBody() : _renderQuickFacturaBody()}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    if (safeMode === 'bitacora') {
      addQuickBitacoraRow();
      calcQuickBitacoraTotals();
    } else {
      onQuickFacNcfChange();
      addQuickFacturaRow();
      calcQuickFacturaTotals();
    }
  }

  // =============================================
  // HERRAMIENTA 1: MINI BITÁCORA DE RECOGIDA
  // =============================================

  function _renderQuickBitacoraBody() {
    const today = new Date().toISOString().split('T')[0];
    const branchMeta = _qctGetBranchOptionsHtml();
    return `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div class="form-row" style="grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:12px;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">🏢 Sucursal de Recogida</label>
            <select id="qct-bit-branch" class="form-select" ${branchMeta.disabled ? 'disabled' : ''} onchange="onQuickBitBranchChange(this.value)">
              ${branchMeta.optionsHtml}
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">📅 Fecha</label>
            <input id="qct-bit-date" type="date" class="form-input" value="${today}" />
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">👷 Chofer / Colaborador</label>
            <select id="qct-bit-colab" class="form-select">
              ${_qctGetColabOptionsHtml()}
            </select>
          </div>
        </div>

        <div class="form-row" style="grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">👤 Seleccionar Cliente / Proveedor</label>
            <select id="qct-bit-client-select" class="form-select" onchange="onQuickBitClientSelect(this.value)">
              ${_qctGetClientOptionsHtml(branchMeta.activeId)}
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">✏️ Nombre del Cliente / Generador</label>
            <input id="qct-bit-client" type="text" class="form-input" placeholder="Cliente General o nombre..." />
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-top:4px;">
          <span style="font-weight:800; font-size:0.9rem; color:var(--clr-primary-light);">♻️ Materiales Recogidos</span>
          <button type="button" class="btn-secondary" style="padding:6px 12px; font-size:0.8rem;" onclick="addQuickBitacoraRow()">+ Añadir Material</button>
        </div>

        <div id="qct-bit-rows" style="display:flex; flex-direction:column; gap:10px;"></div>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">📝 Notas de recogida (opcional)</label>
          <input id="qct-bit-notes" type="text" class="form-input" placeholder="Ej. Recogida rápida desde Centro de Control..." />
        </div>

        <div id="qct-bit-summary" style="padding:12px 14px; border-radius:10px; background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.25); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="font-size:0.86rem;">
            Compra total: <b id="qct-bit-total-compra" style="color:#f87171;">${_qctMoney(0)}</b> &bull;
            Balance estimado: <b id="qct-bit-balance" style="color:#6ee7b7;">${_qctMoney(0)}</b>
          </div>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn-secondary" onclick="closeQuickControlTool()">Cancelar</button>
            <button type="button" id="qct-bit-save-btn" class="btn-primary" onclick="saveQuickControlBitacora()">💾 Guardar Bitácora en Supabase</button>
          </div>
        </div>
      </div>
    `;
  }

  function onQuickBitBranchChange(branchId) {
    const cleanBranch = _qctNormBranchId(branchId);
    const cliSel = document.getElementById('qct-bit-client-select');
    if (cliSel) cliSel.innerHTML = _qctGetClientOptionsHtml(cleanBranch);
    const mats = _qctGetMaterials(cleanBranch);
    const matOpts = `<option value="" disabled selected>Seleccionar material...</option>` +
      mats.map(m => `<option value="${_qctEscape(m.id)}">${_qctEscape(m.icon || '♻️')} ${_qctEscape(m.name)}</option>`).join('');
    document.querySelectorAll('#qct-bit-rows .qct-bit-mat').forEach(sel => {
      const prev = sel.value;
      sel.innerHTML = matOpts;
      if (prev && mats.some(m => m.id === prev)) sel.value = prev;
    });
  }

  function onQuickBitClientSelect(clientId) {
    const input = document.getElementById('qct-bit-client');
    if (!input) return;
    if (!clientId) {
      input.value = '';
      return;
    }
    const branchId = _qctNormBranchId(document.getElementById('qct-bit-branch')?.value);
    const clients = typeof getClients === 'function' ? getClients(branchId) : [];
    const found = clients.find(c => c.id === clientId);
    if (found) input.value = found.name || '';
  }

  function addQuickBitacoraRow() {
    const container = document.getElementById('qct-bit-rows');
    if (!container) return;
    const branchId = _qctNormBranchId(document.getElementById('qct-bit-branch')?.value);
    const mats = _qctGetMaterials(branchId);
    const matOpts = `<option value="" disabled selected>Seleccionar material...</option>` +
      mats.map(m => `<option value="${_qctEscape(m.id)}">${_qctEscape(m.icon || '♻️')} ${_qctEscape(m.name)}</option>`).join('');

    const rowId = `qct-bit-row-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const row = document.createElement('div');
    row.id = rowId;
    row.className = 'qct-bit-row';
    row.style.cssText = 'background:var(--clr-surface-2); border:1px solid var(--clr-border); border-radius:10px; padding:12px; position:relative;';

    row.innerHTML = `
      <button type="button" onclick="const el=document.getElementById('${rowId}'); if(el){el.remove(); calcQuickBitacoraTotals();}" style="position:absolute; top:8px; right:8px; background:rgba(239,68,68,0.14); color:#fca5a5; border:none; border-radius:6px; padding:2px 8px; cursor:pointer; font-size:0.75rem;">✕</button>
      <div class="form-row" style="grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:10px; padding-right:28px;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-size:0.76rem;">Material</label>
          <select class="form-select qct-bit-mat" onchange="onQuickBitMatChange(this)">${matOpts}</select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-size:0.76rem;">Cantidad / Peso</label>
          <input type="number" class="form-input qct-bit-qty" placeholder="0" min="0" step="0.01" oninput="calcQuickBitacoraTotals()" />
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-size:0.76rem;">Unidad</label>
          <select class="form-select qct-bit-unit">
            <option value="lb" selected>libra (lb)</option>
            <option value="kg">kilogramo (kg)</option>
            <option value="ton">tonelada (ton)</option>
            <option value="unidad">unidad</option>
            <option value="litros">litros</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-size:0.76rem;">Costo Compra (${_qctCurrencySymbol()})</label>
          <input type="number" class="form-input qct-bit-pbuy" placeholder="0" min="0" step="0.01" oninput="calcQuickBitacoraTotals()" />
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-size:0.76rem;">Prec. Venta (${_qctCurrencySymbol()})</label>
          <input type="number" class="form-input qct-bit-psell" placeholder="0" min="0" step="0.01" oninput="calcQuickBitacoraTotals()" />
        </div>
      </div>
    `;
    container.appendChild(row);
  }

  function onQuickBitMatChange(selectEl) {
    const row = selectEl?.closest('.qct-bit-row');
    if (!row) return;
    const branchId = _qctNormBranchId(document.getElementById('qct-bit-branch')?.value);
    const mat = _qctGetMaterials(branchId).find(m => m.id === selectEl.value);
    const prices = typeof getMarketPrices === 'function' ? getMarketPrices() : {};
    const mp = mat ? (prices[mat.code] || { purchase: 0, sell: 0 }) : { purchase: 0, sell: 0 };
    const pbuyEl = row.querySelector('.qct-bit-pbuy');
    const psellEl = row.querySelector('.qct-bit-psell');
    if (pbuyEl) pbuyEl.value = mp.purchase || 0;
    if (psellEl) psellEl.value = mp.sell || 0;
    calcQuickBitacoraTotals();
  }

  function calcQuickBitacoraTotals() {
    let totalCompra = 0;
    let totalVenta = 0;
    document.querySelectorAll('#qct-bit-rows .qct-bit-row').forEach(row => {
      const qty = parseFloat(row.querySelector('.qct-bit-qty')?.value) || 0;
      const pbuy = parseFloat(row.querySelector('.qct-bit-pbuy')?.value) || 0;
      const psell = parseFloat(row.querySelector('.qct-bit-psell')?.value) || 0;
      totalCompra += qty * pbuy;
      totalVenta += qty * psell;
    });
    const balance = totalVenta - totalCompra;
    const tcEl = document.getElementById('qct-bit-total-compra');
    const balEl = document.getElementById('qct-bit-balance');
    if (tcEl) tcEl.textContent = _qctMoney(totalCompra);
    if (balEl) {
      balEl.textContent = _qctMoney(balance);
      balEl.style.color = balance >= 0 ? '#6ee7b7' : '#fca5a5';
    }
  }

  async function saveQuickControlBitacora() {
    const branchId = _qctNormBranchId(document.getElementById('qct-bit-branch')?.value);
    const branchName = _qctResolveBranchName(branchId);
    const mats = _qctGetMaterials(branchId);
    const rows = document.querySelectorAll('#qct-bit-rows .qct-bit-row');
    const items = [];

    rows.forEach(row => {
      const matId = row.querySelector('.qct-bit-mat')?.value || '';
      const qty = parseFloat(row.querySelector('.qct-bit-qty')?.value) || 0;
      const unit = row.querySelector('.qct-bit-unit')?.value || 'lb';
      const pbuy = parseFloat(row.querySelector('.qct-bit-pbuy')?.value) || 0;
      const psell = parseFloat(row.querySelector('.qct-bit-psell')?.value) || 0;
      if (matId && qty > 0 && pbuy >= 0) {
        const mat = mats.find(m => m.id === matId) || { name: 'Material', icon: '♻️' };
        let peso = 0;
        if (unit === 'kg' || unit === 'kilos') peso = qty;
        else if (unit === 'lb') peso = qty * 0.453592;
        else if (unit === 'ton') peso = qty * 1000;
        const totalCompra = qty * pbuy;
        const totalVenta = qty * psell;
        items.push({
          id: Date.now() + Math.random(),
          matId,
          name: mat.name,
          icon: mat.icon || '♻️',
          qty,
          peso,
          unit,
          priceBuy: pbuy,
          priceSell: psell,
          totalCompra,
          totalVenta,
          balance: totalVenta - totalCompra
        });
      }
    });

    if (items.length === 0) {
      if (typeof showToast === 'function') showToast('❌ Selecciona al menos un material y cantidad mayor a 0', 'error');
      return;
    }

    const clientId = document.getElementById('qct-bit-client-select')?.value || '';
    const client = (document.getElementById('qct-bit-client')?.value || '').trim() || 'Cliente General';
    const date = document.getElementById('qct-bit-date')?.value || new Date().toISOString().split('T')[0];
    const notes = (document.getElementById('qct-bit-notes')?.value || '').trim();
    const collaborator = document.getElementById('qct-bit-colab')?.value || '';

    const totalCompra = items.reduce((s, i) => s + i.totalCompra, 0);
    const totalVenta = items.reduce((s, i) => s + i.totalVenta, 0);
    const balance = totalVenta - totalCompra;

    const invoice = {
      id: `BIT-${Date.now()}`,
      type: 'basica',
      typeName: 'Bitácora',
      client,
      clientId,
      date,
      notes,
      items,
      totalCompra,
      totalVenta,
      balance,
      collaborator,
      branchId,
      branchName,
      source: 'android_control_center',
      createdAt: new Date().toISOString()
    };

    const btn = document.getElementById('qct-bit-save-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Guardando en Supabase...';
    }

    try {
      if (typeof saveInvoice === 'function') {
        saveInvoice(invoice);
      } else {
        const list = JSON.parse(localStorage.getItem(userKey('recim_invoices')) || '[]');
        list.unshift(invoice);
        localStorage.setItem(userKey('recim_invoices'), JSON.stringify(list));
      }

      if (totalCompra > 0 && typeof addFinanceEntry === 'function') {
        addFinanceEntry('egreso', {
          concept: `Compra Bitácora: ${invoice.id} – ${client}`,
          amount: totalCompra,
          date,
          category: 'Materiales',
          ref: invoice.id,
          branchId,
          branchName
        });
      }

      if (typeof window.forceSync === 'function') {
        await window.forceSync();
      }

      if (typeof showToast === 'function') {
        showToast(`✅ Bitácora ${invoice.id} guardada y sincronizada en Supabase`, 'success');
      }
      closeQuickControlTool();
      if (typeof rerenderCurrentPage === 'function') rerenderCurrentPage();
    } finally {
      if (btn && document.body.contains(btn)) {
        btn.disabled = false;
        btn.textContent = '💾 Guardar Bitácora en Supabase';
      }
    }
    return invoice;
  }

  // =============================================
  // HERRAMIENTA 2: MINI FACTURA CON VALIDACIÓN DGII
  // =============================================

  function _renderQuickFacturaBody() {
    const today = new Date().toISOString().split('T')[0];
    const branchMeta = _qctGetBranchOptionsHtml();
    const ncfOpts = typeof getNcfTypeSelectOptionsHtml === 'function'
      ? getNcfTypeSelectOptionsHtml('')
      : '<option value="">Sin Comprobante Fiscal</option>';

    return `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div class="form-row" style="grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:12px;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">🏢 Sucursal que Factura</label>
            <select id="qct-fac-branch" class="form-select" ${branchMeta.disabled ? 'disabled' : ''} onchange="onQuickFacBranchChange(this.value)">
              ${branchMeta.optionsHtml}
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">📅 Fecha</label>
            <input id="qct-fac-date" type="date" class="form-input" value="${today}" />
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">💳 Método de Pago</label>
            <select id="qct-fac-pay-method" class="form-select">
              <option value="Efectivo">💵 Efectivo</option>
              <option value="Transferencia">🏦 Transferencia</option>
              <option value="Cheque">🧾 Cheque</option>
              <option value="Tarjeta">💳 Tarjeta</option>
              <option value="Crédito">⏳ A Crédito</option>
            </select>
          </div>
        </div>

        <div class="form-row" style="grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">👤 Cliente Registrado</label>
            <select id="qct-fac-client-select" class="form-select" onchange="onQuickFacClientSelect(this.value)">
              ${_qctGetClientOptionsHtml(branchMeta.activeId)}
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">🧾 Tipo de Comprobante (NCF / DGII)</label>
            <select id="qct-fac-ncf-type" class="form-select" onchange="onQuickFacNcfChange()">
              ${ncfOpts}
            </select>
            <div id="qct-fac-ncf-preview" style="font-size:0.75rem; margin-top:4px; color:var(--clr-text-muted);"></div>
          </div>
        </div>

        <div class="form-row" style="grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:12px;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">🏢 Nombre / Razón Social *</label>
            <div style="display:flex; gap:6px;">
              <input id="qct-fac-company" type="text" class="form-input" placeholder="Nombre del cliente o empresa..." />
              <button type="button" class="btn-secondary" style="padding:0 10px;" title="Buscar en DGII" onclick="quickFacLookupDGIIByName()">🔍</button>
            </div>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">🪪 RNC / Cédula</label>
            <div style="display:flex; gap:6px;">
              <input id="qct-fac-nit" type="text" class="form-input" placeholder="RNC (9 dígitos) o Cédula (11)..." />
              <button type="button" class="btn-secondary" style="padding:0 10px;" title="Validar RNC en DGII" onclick="quickFacLookupDGIIByRnc()">🔍</button>
            </div>
          </div>
        </div>

        <div class="form-row" style="grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:12px;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">📞 Teléfono / Contacto</label>
            <input id="qct-fac-contact" type="text" class="form-input" placeholder="Teléfono o email..." />
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">📍 Dirección</label>
            <input id="qct-fac-address" type="text" class="form-input" placeholder="Dirección del cliente..." />
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-top:4px;">
          <span style="font-weight:800; font-size:0.9rem; color:var(--clr-primary-light);">📦 Detalle de Facturación</span>
          <button type="button" class="btn-secondary" style="padding:6px 12px; font-size:0.8rem;" onclick="addQuickFacturaRow()">+ Añadir Ítem</button>
        </div>

        <div id="qct-fac-rows" style="display:flex; flex-direction:column; gap:10px;"></div>

        <div class="form-row" style="grid-template-columns:160px 1fr; gap:12px;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">📊 ITBIS (%)</label>
            <select id="qct-fac-tax" class="form-select" onchange="calcQuickFacturaTotals()">
              <option value="18" selected>18% ITBIS</option>
              <option value="16">16% ITBIS Red.</option>
              <option value="0">0% Exento</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">📝 Notas (opcional)</label>
            <input id="qct-fac-notes" type="text" class="form-input" placeholder="Observaciones de la factura..." />
          </div>
        </div>

        <div style="padding:12px 14px; border-radius:10px; background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.25); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="font-size:0.86rem;">
            Subtotal: <b id="qct-fac-subtotal">${_qctMoney(0)}</b> &bull;
            ITBIS: <b id="qct-fac-itbis">${_qctMoney(0)}</b> &bull;
            Total: <b id="qct-fac-total" style="color:#6ee7b7; font-size:1rem;">${_qctMoney(0)}</b>
          </div>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn-secondary" onclick="closeQuickControlTool()">Cancelar</button>
            <button type="button" id="qct-fac-save-btn" class="btn-primary" onclick="saveQuickControlFactura()">🧾 Emitir y Guardar en Supabase</button>
          </div>
        </div>
      </div>
    `;
  }

  function onQuickFacBranchChange(branchId) {
    const cleanBranch = _qctNormBranchId(branchId);
    const cliSel = document.getElementById('qct-fac-client-select');
    if (cliSel) cliSel.innerHTML = _qctGetClientOptionsHtml(cleanBranch);
  }

  function onQuickFacClientSelect(clientId) {
    if (!clientId) return;
    const branchId = _qctNormBranchId(document.getElementById('qct-fac-branch')?.value);
    const clients = typeof getClients === 'function' ? getClients(branchId) : [];
    const found = clients.find(c => c.id === clientId);
    if (!found) return;
    const nameEl = document.getElementById('qct-fac-company');
    const nitEl = document.getElementById('qct-fac-nit');
    const addrEl = document.getElementById('qct-fac-address');
    const contactEl = document.getElementById('qct-fac-contact');
    if (nameEl) nameEl.value = found.name || '';
    if (nitEl) nitEl.value = found.rnc || '';
    if (addrEl) addrEl.value = found.address || '';
    if (contactEl) contactEl.value = found.phone || found.email || '';
  }

  function onQuickFacNcfChange() {
    const ncfType = document.getElementById('qct-fac-ncf-type')?.value || '';
    const previewEl = document.getElementById('qct-fac-ncf-preview');
    if (!previewEl) return;
    if (!ncfType) {
      previewEl.innerHTML = '<span style="color:#9ca3af;">Factura comercial interna sin NCF.</span>';
      return;
    }
    const info = typeof getNextNcfInfo === 'function' ? getNextNcfInfo(ncfType) : null;
    if (!info || !info.isConfigured) {
      previewEl.innerHTML = `<span style="color:#f87171;">⚠️ Secuencia ${ncfType} no configurada.</span>`;
    } else if (info.exhausted) {
      previewEl.innerHTML = `<span style="color:#f87171;">⛔ Secuencia ${ncfType} agotada (0 disponibles). Solicita más NCF en DGII.</span>`;
    } else if (info.isExpired) {
      previewEl.innerHTML = `<span style="color:#f87171;">⛔ Secuencia ${ncfType} vencida (${_qctEscape(info.seq?.dueDate || '')}).</span>`;
    } else {
      previewEl.innerHTML = `<span style="color:#6ee7b7;">✅ Próximo NCF: <b>${_qctEscape(info.ncf)}</b> (${info.remaining} disponibles)</span>`;
    }
  }

  async function quickFacLookupDGIIByRnc() {
    const nitEl = document.getElementById('qct-fac-nit');
    const nameEl = document.getElementById('qct-fac-company');
    const addrEl = document.getElementById('qct-fac-address');
    const val = (nitEl?.value || '').trim();
    if (!val) {
      if (nameEl?.value.trim()) return quickFacLookupDGIIByName();
      if (typeof showToast === 'function') showToast('Ingresa un RNC o Cédula primero', 'warning');
      return;
    }
    if (typeof fetchDGIIData !== 'function') return;
    const data = await fetchDGIIData(val);
    if (data) {
      if (data.rnc && nitEl) nitEl.value = data.rnc;
      if (data.name && nameEl) nameEl.value = data.name;
      if (data.address && addrEl) addrEl.value = data.address;
      if (typeof showToast === 'function') showToast('✅ Datos DGII completados', 'success');
    }
  }

  async function quickFacLookupDGIIByName() {
    const nameEl = document.getElementById('qct-fac-company');
    const nitEl = document.getElementById('qct-fac-nit');
    const val = (nameEl?.value || '').trim();
    if (!val) {
      if (typeof showToast === 'function') showToast('Ingresa el nombre de la empresa para buscar', 'warning');
      return;
    }
    if (typeof searchDGIICompanies !== 'function') return;
    const results = await searchDGIICompanies(val);
    if (!results || results.length === 0) return;
    const apply = (selected) => {
      if (nameEl) nameEl.value = selected.name || '';
      if (nitEl) nitEl.value = selected.rnc || '';
      if (typeof showToast === 'function') showToast(`✅ RNC: ${selected.rnc}`, 'success');
    };
    if (results.length === 1 || typeof openDGIICompanyPickerModal !== 'function') {
      apply(results[0]);
    } else {
      openDGIICompanyPickerModal(results, apply);
    }
  }

  function addQuickFacturaRow() {
    const container = document.getElementById('qct-fac-rows');
    if (!container) return;
    const branchId = _qctNormBranchId(document.getElementById('qct-fac-branch')?.value);
    const mats = _qctGetMaterials(branchId);
    const matOpts = `<option value="">-- Material opcional --</option>` +
      mats.map(m => `<option value="${_qctEscape(m.id)}">${_qctEscape(m.icon || '♻️')} ${_qctEscape(m.name)}</option>`).join('');

    const rowId = `qct-fac-row-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const row = document.createElement('div');
    row.id = rowId;
    row.className = 'qct-fac-row';
    row.style.cssText = 'background:var(--clr-surface-2); border:1px solid var(--clr-border); border-radius:10px; padding:12px; position:relative;';

    row.innerHTML = `
      <button type="button" onclick="const el=document.getElementById('${rowId}'); if(el){el.remove(); calcQuickFacturaTotals();}" style="position:absolute; top:8px; right:8px; background:rgba(239,68,68,0.14); color:#fca5a5; border:none; border-radius:6px; padding:2px 8px; cursor:pointer; font-size:0.75rem;">✕</button>
      <div class="form-row" style="grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:10px; padding-right:28px;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-size:0.76rem;">Preset Material</label>
          <select class="form-select qct-fac-mat-preset" onchange="onQuickFacMatPreset(this)">${matOpts}</select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-size:0.76rem;">Descripción *</label>
          <input type="text" class="form-input qct-fac-desc" placeholder="Material o servicio..." />
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-size:0.76rem;">Cantidad</label>
          <input type="number" class="form-input qct-fac-qty" placeholder="1" min="0" step="0.01" oninput="calcQuickFacturaTotals()" />
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-size:0.76rem;">Unidad</label>
          <select class="form-select qct-fac-unit">
            <option value="lb" selected>lb</option>
            <option value="kg">kg</option>
            <option value="ton">ton</option>
            <option value="unidad">unidad</option>
            <option value="servicio">servicio</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-size:0.76rem;">Precio Unit. (${_qctCurrencySymbol()})</label>
          <input type="number" class="form-input qct-fac-uprice" placeholder="0" min="0" step="0.01" oninput="calcQuickFacturaTotals()" />
        </div>
      </div>
    `;
    container.appendChild(row);
  }

  function onQuickFacMatPreset(selectEl) {
    const row = selectEl?.closest('.qct-fac-row');
    if (!row || !selectEl.value) return;
    const branchId = _qctNormBranchId(document.getElementById('qct-fac-branch')?.value);
    const mat = _qctGetMaterials(branchId).find(m => m.id === selectEl.value);
    if (!mat) return;
    const prices = typeof getMarketPrices === 'function' ? getMarketPrices() : {};
    const mp = prices[mat.code] || { sell: 0 };
    const descEl = row.querySelector('.qct-fac-desc');
    const upriceEl = row.querySelector('.qct-fac-uprice');
    const qtyEl = row.querySelector('.qct-fac-qty');
    if (descEl) descEl.value = mat.name || '';
    if (upriceEl && (!upriceEl.value || parseFloat(upriceEl.value) === 0)) upriceEl.value = mp.sell || 0;
    if (qtyEl && (!qtyEl.value || parseFloat(qtyEl.value) === 0)) qtyEl.value = 1;
    calcQuickFacturaTotals();
  }

  function calcQuickFacturaTotals() {
    let subtotal = 0;
    document.querySelectorAll('#qct-fac-rows .qct-fac-row').forEach(row => {
      const qty = parseFloat(row.querySelector('.qct-fac-qty')?.value) || 0;
      const uprice = parseFloat(row.querySelector('.qct-fac-uprice')?.value) || 0;
      subtotal += qty * uprice;
    });
    const taxRate = parseFloat(document.getElementById('qct-fac-tax')?.value) || 0;
    const itbis = subtotal * (taxRate / 100);
    const total = subtotal + itbis;
    const subEl = document.getElementById('qct-fac-subtotal');
    const itbEl = document.getElementById('qct-fac-itbis');
    const totEl = document.getElementById('qct-fac-total');
    if (subEl) subEl.textContent = _qctMoney(subtotal);
    if (itbEl) itbEl.textContent = _qctMoney(itbis);
    if (totEl) totEl.textContent = _qctMoney(total);
  }

  async function saveQuickControlFactura() {
    const company = (document.getElementById('qct-fac-company')?.value || '').trim();
    const date = document.getElementById('qct-fac-date')?.value || new Date().toISOString().split('T')[0];
    if (!company) {
      if (typeof showToast === 'function') showToast('❌ Ingresa el nombre o razón social del cliente', 'error');
      return;
    }

    const items = [];
    document.querySelectorAll('#qct-fac-rows .qct-fac-row').forEach(row => {
      const desc = (row.querySelector('.qct-fac-desc')?.value || '').trim();
      const qty = parseFloat(row.querySelector('.qct-fac-qty')?.value) || 0;
      const unit = row.querySelector('.qct-fac-unit')?.value || 'lb';
      const uprice = parseFloat(row.querySelector('.qct-fac-uprice')?.value) || 0;
      if (desc && qty > 0) {
        items.push({ id: Date.now() + Math.random(), desc, qty, unit, uprice, subtotal: qty * uprice });
      }
    });

    if (items.length === 0) {
      if (typeof showToast === 'function') showToast('❌ Agrega al menos un ítem con descripción y cantidad > 0', 'error');
      return;
    }

    const nit = (document.getElementById('qct-fac-nit')?.value || '').trim();
    const ncfType = document.getElementById('qct-fac-ncf-type')?.value || '';
    let ncf = '';
    let ncfDueDate = '';

    if (ncfType) {
      if (typeof getNextNcfInfo !== 'function') {
        if (typeof showToast === 'function') showToast('❌ Módulo NCF no disponible', 'error');
        return;
      }
      const ncfInfo = getNextNcfInfo(ncfType);
      if (!ncfInfo.isConfigured) {
        if (typeof showToast === 'function') showToast(`❌ No tienes secuencia ${ncfType} configurada. Solicita NCF en la DGII o usa Sin Comprobante.`, 'error');
        return;
      }
      if (ncfInfo.exhausted) {
        if (typeof showToast === 'function') showToast(`❌ Secuencia ${ncfType} agotada (0 disp.). Solicita más NCF en la DGII o cambia a Sin Comprobante.`, 'error');
        return;
      }
      if (ncfInfo.isExpired) {
        if (typeof showToast === 'function') showToast(`❌ La secuencia ${ncfType} venció el ${ncfInfo.seq?.dueDate || ''}.`, 'error');
        return;
      }
      ncf = ncfInfo.ncf || '';
      if (!/^B\d{10}$/.test(ncf) && !/^E\d{12}$/.test(ncf)) {
        if (typeof showToast === 'function') showToast(`❌ NCF inválido (${ncf}). Verifica ⚙️ Parametrizaciones NCF.`, 'error');
        return;
      }
      ncfDueDate = ncfInfo.seq?.dueDate || '';

      if (ncfType === 'B01' || ncfType === 'E31' || ncfType === 'B14' || ncfType === 'E44' || ncfType === 'B15' || ncfType === 'E45') {
        const cleanNit = nit.replace(/\D/g, '');
        if (cleanNit.length !== 9 && cleanNit.length !== 11) {
          if (typeof showToast === 'function') showToast(`❌ Para comprobantes ${ncfType} el RNC (9 dígitos) o Cédula (11 dígitos) es obligatorio según la DGII.`, 'error');
          return;
        }
      }

      const existingInvoices = typeof getAllInvoices === 'function' ? getAllInvoices() : [];
      if (existingInvoices.some(inv => inv.ncf && inv.ncf.toUpperCase() === ncf.toUpperCase())) {
        if (typeof showToast === 'function') showToast(`❌ El NCF ${ncf} ya existe en otra factura.`, 'error');
        return;
      }
    }

    const branchId = _qctNormBranchId(document.getElementById('qct-fac-branch')?.value);
    const branchName = _qctResolveBranchName(branchId);
    const address = (document.getElementById('qct-fac-address')?.value || '').trim();
    const contact = (document.getElementById('qct-fac-contact')?.value || '').trim();
    const payMethod = document.getElementById('qct-fac-pay-method')?.value || 'Efectivo';
    const notes = (document.getElementById('qct-fac-notes')?.value || '').trim();
    const taxRate = parseFloat(document.getElementById('qct-fac-tax')?.value) || 0;
    const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    const typeName = (function () {
      if (!ncfType) return 'Factura Comercial (Sin Comprobante Fiscal)';
      if (ncfType === 'B01') return 'Factura de Crédito Fiscal';
      if (ncfType === 'B02') return 'Factura de Consumo (Consumidor Final)';
      if (ncfType === 'B14') return 'Regímenes Especiales de Tributación';
      if (ncfType === 'B15') return 'Comprobante Gubernamental';
      if (typeof getNcfTypeName === 'function') {
        return getNcfTypeName(ncfType).replace(/^\d+\s*-\s*/, '').replace(/\s*\([BE]\d+\)$/, '').trim();
      }
      return `Factura ${ncfType}`;
    })();

    const invoice = {
      id: `FAC-${Date.now()}`,
      type: ncfType === 'B01' ? 'empresa' : 'local',
      typeName,
      company,
      nit,
      ncfType,
      ncf,
      ncfDueDate,
      address,
      contact,
      date,
      notes,
      payMethod,
      items,
      subtotal,
      taxRate,
      taxAmount,
      iscRate: 0,
      iscAmount: 0,
      retIsrRate: 0,
      retIsrAmount: 0,
      retItbisRate: 0,
      retItbisAmount: 0,
      total,
      collaborator: '',
      branchId,
      branchName,
      source: 'android_control_center',
      createdAt: new Date().toISOString()
    };

    const btn = document.getElementById('qct-fac-save-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Emitiendo en Supabase...';
    }

    try {
      if (typeof saveInvoice === 'function') {
        saveInvoice(invoice);
      } else {
        const list = JSON.parse(localStorage.getItem(userKey('recim_invoices')) || '[]');
        list.unshift(invoice);
        localStorage.setItem(userKey('recim_invoices'), JSON.stringify(list));
      }

      if (ncfType && typeof consumeNcfSequence === 'function') {
        consumeNcfSequence(ncfType);
      }

      if (typeof addFinanceEntry === 'function') {
        addFinanceEntry('ingreso', {
          concept: `Venta Factura ${invoice.id} – ${company}${ncf ? ' (' + ncf + ')' : ''}`,
          amount: total,
          date,
          category: 'Ventas',
          ref: invoice.id,
          branchId,
          branchName
        });
      }

      if (typeof window.forceSync === 'function') {
        await window.forceSync();
      }

      if (typeof showToast === 'function') {
        showToast(`✅ Factura ${invoice.id} guardada y sincronizada en Supabase`, 'success');
      }
      closeQuickControlTool();
      if (typeof rerenderCurrentPage === 'function') rerenderCurrentPage();
      if (typeof showInvoicePostSaveModal === 'function') {
        showInvoicePostSaveModal(invoice);
      }
    } finally {
      if (btn && document.body.contains(btn)) {
        btn.disabled = false;
        btn.textContent = '🧾 Emitir y Guardar en Supabase';
      }
    }
    return invoice;
  }

  function requestAndroidControlCenterTiles(toolType = 'bitacora') {
    if (window.AndroidNative && typeof window.AndroidNative.RequestAddControlCenterTile === 'function') {
      try {
        const res = window.AndroidNative.RequestAddControlCenterTile(toolType);
        if (typeof showToast === 'function') {
          showToast(res || '📲 Accesos enviados al Centro de Control Android', 'success');
        }
        return;
      } catch (_) {}
    }
    if (typeof showToast === 'function') {
      showToast('Usa el panel de notificaciones o Centro de Control en Android para abrir estos botones.', 'info');
    }
  }

  function checkPendingAndroidQuickTool() {
    let tool = '';
    if (window.__PENDING_QUICK_TOOL__) {
      tool = String(window.__PENDING_QUICK_TOOL__).trim();
      window.__PENDING_QUICK_TOOL__ = '';
    }
    if (!tool && window.AndroidNative && typeof window.AndroidNative.ConsumePendingQuickTool === 'function') {
      try {
        tool = String(window.AndroidNative.ConsumePendingQuickTool() || '').trim();
      } catch (_) {}
    }
    if (!tool) {
      try {
        const params = new URLSearchParams(window.location.search);
        tool = String(params.get('quick_tool') || '').trim();
      } catch (_) {}
    }
    if (tool === 'bitacora' || tool === 'factura') {
      setTimeout(() => openQuickControlTool(tool), 180);
    }
  }

  function onAndroidControlCenterTileResult(toolType, code, msg) {
    const normalized = String(toolType || '').toLowerCase() === 'factura' ? 'factura' : 'bitacora';
    const numCode = Number(code);
    const statusVal = numCode === -100
      ? 'disabled'
      : ((numCode === 1 || numCode === 2) ? 'added' : 'enabled');

    if (typeof saveSetting === 'function') {
      saveSetting(normalized === 'factura' ? 'controlCenterFactura' : 'controlCenterBitacora', numCode !== -100);
      saveSetting(normalized === 'factura' ? 'controlCenterFacturaStatus' : 'controlCenterBitacoraStatus', statusVal);
    }

    if (msg && typeof showToast === 'function') {
      showToast(msg, (numCode === 1 || numCode === 2) ? 'success' : 'info');
    }

    if (typeof window.syncControlCenterSettingsUI === 'function') {
      try { window.syncControlCenterSettingsUI(); } catch (_) {}
    }
  }

  window.openQuickControlTool = openQuickControlTool;
  window.closeQuickControlTool = closeQuickControlTool;
  window.onAndroidControlCenterTileResult = onAndroidControlCenterTileResult;
  window.onQuickBitBranchChange = onQuickBitBranchChange;
  window.onQuickBitClientSelect = onQuickBitClientSelect;
  window.addQuickBitacoraRow = addQuickBitacoraRow;
  window.onQuickBitMatChange = onQuickBitMatChange;
  window.calcQuickBitacoraTotals = calcQuickBitacoraTotals;
  window.saveQuickControlBitacora = saveQuickControlBitacora;
  window.onQuickFacBranchChange = onQuickFacBranchChange;
  window.onQuickFacClientSelect = onQuickFacClientSelect;
  window.onQuickFacNcfChange = onQuickFacNcfChange;
  window.quickFacLookupDGIIByRnc = quickFacLookupDGIIByRnc;
  window.quickFacLookupDGIIByName = quickFacLookupDGIIByName;
  window.addQuickFacturaRow = addQuickFacturaRow;
  window.onQuickFacMatPreset = onQuickFacMatPreset;
  window.calcQuickFacturaTotals = calcQuickFacturaTotals;
  window.saveQuickControlFactura = saveQuickControlFactura;
  window.requestAndroidControlCenterTiles = requestAndroidControlCenterTiles;
  window.checkPendingAndroidQuickTool = checkPendingAndroidQuickTool;
})();
