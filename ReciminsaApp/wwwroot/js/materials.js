/* =============================================
   MATERIALS.JS – Códigos de Materiales
   ============================================= */

const DEFAULT_MATERIALS = [];

function getCustomCodes() {
  const local = JSON.parse(localStorage.getItem(userKey('recim_material_codes')) || '[]');
  return local;
}

function saveCustomCodes(codes) {
  // localStorage override in sync.js automatically pushes to Firebase
  localStorage.setItem(userKey('recim_material_codes'), JSON.stringify(codes));
}

// NOTE: Firebase sync is handled centrally by sync.js (syncPushData / syncPullData).
// Do NOT add on('value') listeners here — they bypass delete logic and restore deleted data.

function getMaterialCodes() {
  const custom = getCustomCodes();
  return custom.length > 0 ? [...custom, ...DEFAULT_MATERIALS] : DEFAULT_MATERIALS;
}

function addMaterialCode(name, code) {
  const codes = getCustomCodes();
  if (codes.some(c => c.code === code.toUpperCase())) {
    showToast(t('err.dup_code'), 'error'); return false;
  }
  const id = `mat-${Date.now()}`;
  codes.push({ id, code: code.toUpperCase(), name, icon: '♻️', unit: 'kg' });
  saveCustomCodes(codes);
  showToast(t('toast.code_add'), 'success');
  return true;
}

function deleteMaterialCode(id) {
  const codes = getCustomCodes().filter(c => c.id !== id);
  saveCustomCodes(codes);
  showToast(t('toast.code_del'), 'success');
}

function updateMaterialCode(id, name, code) {
  const codes = getCustomCodes();
  const idx = codes.findIndex(c => c.id === id);
  if (idx === -1) return;
  // Check duplicate code among OTHER entries
  const dup = codes.find((c, i) => c.code === code.toUpperCase() && i !== idx);
  if (dup) { showToast(t('err.dup_code'), 'error'); return; }
  codes[idx] = { ...codes[idx], name, code: code.toUpperCase() };
  saveCustomCodes(codes);
  showToast(t('toast.code_updated'), 'success');
}

// =============================================
// RENDER CÓDIGOS PAGE
// =============================================

function renderCodigosPage(container) {
  const codes = getCustomCodes();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="section-title">${t('mat.title')}</h2>
        <p class="section-subtitle">${t('mat.subtitle')}</p>
      </div>
    </div>

    <div class="finance-grid">
      <!-- Form -->
      <div class="card card--elevated">
        <h3 class="section-title" style="margin-bottom:16px;">${t('mat.new_code')}</h3>
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div class="form-group">
            <label class="form-label">${t('mat.mat_name')}</label>
            <input id="mat-name" type="text" class="form-input" placeholder="${t('mat.name_ph')}" />
          </div>
          <div class="form-group">
            <label class="form-label">${t('lbl.code')}</label>
            <input id="mat-code" type="text" class="form-input" placeholder="${t('mat.code_ph')}" maxlength="6" style="text-transform:uppercase;" />
          </div>
          <button class="btn-primary" onclick="handleAddCode()">${t('mat.btn')}</button>
        </div>
      </div>

      <!-- Lists -->
      <div>
        <div class="card card--elevated" style="margin-bottom:16px;">
          <h3 class="section-title" style="margin-bottom:12px;font-size:1rem;">
            ${t('mat.my_codes')}
            <span class="badge badge--green" style="margin-left:8px;">${codes.length} ${t('mat.custom_count')}</span>
          </h3>
          <div id="custom-codes-list">
            ${renderCustomCodesList(codes)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderCustomCodesList(codes) {
  if (codes.length === 0) {
    return `<p style="color:var(--clr-text-muted);font-size:0.85rem;">${t('mat.no_codes')}</p>`;
  }

  return codes.map(c => `
    <div class="material-item" id="mat-row-${c.id}" style="gap:10px;flex-wrap:wrap;">
      <span style="font-size:1.2rem;">♻️</span>
      <span class="material-item-name">${c.name}</span>
      <span class="badge badge--green">${c.code}</span>
      <div style="margin-left:auto;display:flex;gap:6px;">
        <button class="btn-secondary" style="padding:5px 10px;font-size:0.8rem;"
                onclick="showEditRow('${c.id}','${c.name.replace(/'/g, "\\'")}','${c.code}')">
          ✏️
        </button>
        <button class="btn-danger" style="padding:5px 10px;font-size:0.8rem;"
                onclick="handleDeleteCode('${c.id}')">
          🗑
        </button>
      </div>
    </div>`).join('');
}

// ---- Inline edit row ----
function showEditRow(id, currentName, currentCode) {
  const row = document.getElementById(`mat-row-${id}`);
  if (!row) return;

  row.innerHTML = `
    <span style="font-size:1.2rem;">✏️</span>
    <input id="edit-name-${id}" type="text" class="form-input"
           value="${currentName}" style="flex:2;min-width:120px;padding:6px 10px;" />
    <input id="edit-code-${id}" type="text" class="form-input"
           value="${currentCode}" maxlength="6"
           style="flex:1;min-width:70px;max-width:90px;padding:6px 10px;text-transform:uppercase;"
           onkeydown="if(event.key==='Enter') saveEditRow('${id}')" />
    <div style="display:flex;gap:6px;margin-left:auto;">
      <button class="btn-primary" style="padding:6px 14px;font-size:0.82rem;"
              onclick="saveEditRow('${id}')">✓ ${t('btn.save')}</button>
      <button class="btn-secondary" style="padding:6px 10px;font-size:0.82rem;"
              onclick="cancelEditRow()">✕</button>
    </div>
  `;

  setTimeout(() => document.getElementById(`edit-name-${id}`)?.focus(), 50);
}

function saveEditRow(id) {
  const nameEl = document.getElementById(`edit-name-${id}`);
  const codeEl = document.getElementById(`edit-code-${id}`);
  const name = nameEl?.value.trim() || '';
  const code = codeEl?.value.trim().toUpperCase() || '';

  if (!name || !code) { showToast(t('err.fill_code'), 'error'); return; }

  updateMaterialCode(id, name, code);
  // Refresh only the list, not the whole page
  const listEl = document.getElementById('custom-codes-list');
  if (listEl) listEl.innerHTML = renderCustomCodesList(getCustomCodes());
}

function cancelEditRow() {
  const listEl = document.getElementById('custom-codes-list');
  if (listEl) listEl.innerHTML = renderCustomCodesList(getCustomCodes());
}

// ---- Handlers ----
function handleAddCode() {
  const name = document.getElementById('mat-name').value.trim();
  const code = document.getElementById('mat-code').value.trim().toUpperCase();
  if (!name || !code) { showToast(t('err.fill_code'), 'error'); return; }
  if (addMaterialCode(name, code)) {
    document.getElementById('mat-name').value = '';
    document.getElementById('mat-code').value = '';
    // Refresh only the list
    const listEl = document.getElementById('custom-codes-list');
    if (listEl) {
      const codes = getCustomCodes();
      const header = listEl.closest('.card')?.querySelector('h3 .badge');
      if (header) header.textContent = `${codes.length} ${t('mat.custom_count')}`;
      listEl.innerHTML = renderCustomCodesList(codes);
    }
  }
}

function handleDeleteCode(id) {
  if (!confirm(t('confirm.del_code'))) return;
  deleteMaterialCode(id);
  const listEl = document.getElementById('custom-codes-list');
  if (listEl) {
    const codes = getCustomCodes();
    const header = listEl.closest('.card')?.querySelector('h3 .badge');
    if (header) header.textContent = `${codes.length} ${t('mat.custom_count')}`;
    listEl.innerHTML = renderCustomCodesList(codes);
  }
}


