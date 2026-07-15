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

// Families of materials helper functions
function getMaterialFamilies() {
  const local = JSON.parse(localStorage.getItem(userKey('recim_material_families')) || '[]');
  return local;
}

function saveMaterialFamilies(families) {
  localStorage.setItem(userKey('recim_material_families'), JSON.stringify(families));
  if (window.syncPushData) {
    window.syncPushData(true);
  }
}

function addMaterialFamily(name) {
  if (!name || name.trim() === '') return false;
  const families = getMaterialFamilies();
  if (families.some(f => f.name.toLowerCase() === name.toLowerCase().trim())) {
    showToast('❌ Ya existe una familia con ese nombre', 'error');
    return false;
  }
  const id = `fam-${Date.now()}`;
  families.push({ id, name: name.trim() });
  saveMaterialFamilies(families);
  showToast('📁 Familia de materiales creada con éxito', 'success');
  return true;
}

function deleteMaterialFamily(id) {
  let families = getMaterialFamilies();
  families = families.filter(f => f.id !== id);
  saveMaterialFamilies(families);

  const codes = getCustomCodes();
  let updated = false;
  codes.forEach(c => {
    if (c.familyId === id) {
      c.familyId = '';
      updated = true;
    }
  });
  if (updated) {
    saveCustomCodes(codes);
  }
  showToast('🗑️ Familia eliminada con éxito', 'success');
}

function getMaterialCodes() {
  const custom = getCustomCodes();
  return custom.length > 0 ? [...custom, ...DEFAULT_MATERIALS] : DEFAULT_MATERIALS;
}

function addMaterialCode(name, code, familyId = '') {
  const codes = getCustomCodes();
  if (codes.some(c => c.code === code.toUpperCase())) {
    showToast(t('err.dup_code'), 'error'); return false;
  }
  const id = `mat-${Date.now()}`;
  codes.push({ id, code: code.toUpperCase(), name, icon: '♻️', unit: 'kg', familyId });
  saveCustomCodes(codes);
  showToast(t('toast.code_add'), 'success');
  return true;
}

function deleteMaterialCode(id) {
  const codes = getCustomCodes().filter(c => c.id !== id);
  saveCustomCodes(codes);
  showToast(t('toast.code_del'), 'success');
}

function updateMaterialCode(id, name, code, familyId = '') {
  const codes = getCustomCodes();
  const idx = codes.findIndex(c => c.id === id);
  if (idx === -1) return;
  const dup = codes.find((c, i) => c.code === code.toUpperCase() && i !== idx);
  if (dup) { showToast(t('err.dup_code'), 'error'); return; }
  codes[idx] = { ...codes[idx], name, code: code.toUpperCase(), familyId };
  saveCustomCodes(codes);
  showToast('✅ Código actualizado', 'success');
}

// =============================================
// RENDER CÓDIGOS PAGE
// =============================================

function renderCodigosPage(container) {
  const codes = getCustomCodes();
  const families = getMaterialFamilies();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="section-title">${t('mat.title')}</h2>
        <p class="section-subtitle">${t('mat.subtitle')}</p>
      </div>
    </div>

    <div class="finance-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; align-items: start;">
      <!-- Left Column: Forms -->
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <!-- Material Form -->
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

        <!-- Family Form -->
        <div class="card card--elevated">
          <h3 class="section-title" style="margin-bottom:16px;">📁 Nueva Familia de Materiales</h3>
          <div style="display:flex;flex-direction:column;gap:14px;">
            <div class="form-group">
              <label class="form-label">Nombre de la Familia</label>
              <input id="fam-name-input" type="text" class="form-input" placeholder="Ej: Cartón, Plástico..." />
            </div>
            <button class="btn-primary" onclick="handleCreateFamilyFromForm()">💾 Guardar Familia</button>
          </div>
        </div>
      </div>

      <!-- Right Column: Lists -->
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <!-- Materials List -->
        <div class="card card--elevated">
          <h3 class="section-title" style="margin-bottom:12px;font-size:1rem;">
            ${t('mat.my_codes')}
            <span class="badge badge--green" style="margin-left:8px;">${codes.length} ${t('mat.custom_count')}</span>
          </h3>
          <div id="custom-codes-list">
            ${renderCustomCodesList(codes)}
          </div>
        </div>

        <!-- Families List -->
        <div class="card card--elevated">
          <h3 class="section-title" style="margin-bottom:12px;font-size:1rem;">
            📁 Familias de Materiales
            <span class="badge badge--green" style="margin-left:8px;">${families.length}</span>
          </h3>
          <div id="material-families-list">
            ${renderMaterialFamiliesList(families, codes)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderCustomCodesList(codes) {
  if (codes.length === 0) {
    return `<p style="color:var(--clr-text-muted);font-size:0.85rem;">No tienes códigos creados.</p>`;
  }

  const families = getMaterialFamilies();

  return codes.map(c => {
    const family = families.find(f => f.id === c.familyId);
    const familyBadge = family ? `<span class="badge badge--blue" style="font-size:0.75rem; margin-left: 8px;">📁 ${family.name}</span>` : '';
    return `
      <div class="material-item" id="mat-row-${c.id}" style="gap:10px;flex-wrap:wrap; align-items: center; justify-content: flex-start; display: flex; padding: 10px 14px; background: var(--clr-surface-2); border: 1px solid var(--clr-border); border-radius: var(--r-md); margin-bottom: 8px;">
        <span style="font-size:1.2rem;">♻️</span>
        <span class="material-item-name" style="font-weight: 600;">${c.name}</span>
        <span class="badge badge--green" style="font-family: monospace;">${c.code}</span>
        ${familyBadge}
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
      </div>`;
  }).join('');
}

function renderMaterialFamiliesList(families, codes) {
  if (families.length === 0) {
    return `<p style="color:var(--clr-text-muted);font-size:0.85rem;">No tienes familias de materiales creadas.</p>`;
  }

  return families.map(f => {
    const associatedCount = codes.filter(c => c.familyId === f.id).length;
    return `
      <div class="material-item" id="fam-row-${f.id}" style="gap:10px;flex-wrap:wrap;padding: 10px 14px; background: var(--clr-surface-2); border: 1px solid var(--clr-border); border-radius: var(--r-md); margin-bottom: 8px; display: flex; align-items: center;">
        <span style="font-size:1.2rem;">📁</span>
        <span class="material-item-name" style="font-weight: 600;">${f.name}</span>
        <span class="badge badge--blue" style="margin-left:8px; font-size: 0.72rem;">${associatedCount} códigos</span>
        <div style="margin-left:auto;display:flex;gap:6px;">
          <button class="btn-danger" style="padding:5px 10px;font-size:0.8rem;"
                  onclick="handleDeleteFamily('${f.id}')">
            🗑
          </button>
        </div>
      </div>`;
  }).join('');
}

// ---- Inline edit row ----
function showEditRow(id, currentName, currentCode) {
  const row = document.getElementById(`mat-row-${id}`);
  if (!row) return;

  const codes = getCustomCodes();
  const mat = codes.find(c => c.id === id) || {};
  const currentFamilyId = mat.familyId || '';
  const families = getMaterialFamilies();

  let familyOptions = `<option value="">-- Sin Familia --</option>`;
  families.forEach(f => {
    familyOptions += `<option value="${f.id}" ${f.id === currentFamilyId ? 'selected' : ''}>📁 ${f.name}</option>`;
  });

  row.innerHTML = `
    <span style="font-size:1.2rem;">✏️</span>
    <input id="edit-name-${id}" type="text" class="form-input"
           value="${currentName}" style="flex:2;min-width:120px;padding:6px 10px;" />
    <input id="edit-code-${id}" type="text" class="form-input"
           value="${currentCode}" maxlength="6"
           style="flex:1;min-width:70px;max-width:90px;padding:6px 10px;text-transform:uppercase;" />
    <select id="edit-family-${id}" class="form-select" style="flex:1.5;min-width:120px;padding:6px 10px; height: 38px; background: var(--clr-surface-3);">
      ${familyOptions}
    </select>
    <div style="display:flex;gap:6px;margin-left:auto;">
      <button class="btn-primary" style="padding:6px 14px;font-size:0.82rem;"
              onclick="saveEditRow('${id}')">✓ Guardar</button>
      <button class="btn-secondary" style="padding:6px 10px;font-size:0.82rem;"
              onclick="cancelEditRow()">✕</button>
    </div>
  `;

  setTimeout(() => document.getElementById(`edit-name-${id}`)?.focus(), 50);
}

function saveEditRow(id) {
  const nameEl = document.getElementById(`edit-name-${id}`);
  const codeEl = document.getElementById(`edit-code-${id}`);
  const familyEl = document.getElementById(`edit-family-${id}`);
  const name = nameEl?.value.trim() || '';
  const code = codeEl?.value.trim().toUpperCase() || '';
  const familyId = familyEl?.value || '';

  if (!name || !code) { showToast(t('err.fill_code'), 'error'); return; }

  updateMaterialCode(id, name, code, familyId);
  
  // Refresh only the list, not the whole page
  const listEl = document.getElementById('custom-codes-list');
  if (listEl) listEl.innerHTML = renderCustomCodesList(getCustomCodes());
  
  // Also refresh page so count in families list updates
  const container = document.getElementById('page-codigos');
  if (container) renderCodigosPage(container);
}

function cancelEditRow() {
  const listEl = document.getElementById('custom-codes-list');
  if (listEl) listEl.innerHTML = renderCustomCodesList(getCustomCodes());
}

// ---- Handlers ----
function handleCreateFamilyFromForm() {
  const nameEl = document.getElementById('fam-name-input');
  if (!nameEl) return;
  const name = nameEl.value.trim();
  if (!name) {
    showToast('❌ El nombre de la familia no puede estar vacío', 'error');
    return;
  }
  if (addMaterialFamily(name)) {
    nameEl.value = '';
    const container = document.getElementById('page-codigos');
    if (container) renderCodigosPage(container);
  }
}

function handleDeleteFamily(id) {
  if (!confirm('¿Estás seguro de eliminar esta familia? Los materiales asociados quedarán sin familia.')) return;
  deleteMaterialFamily(id);
  const container = document.getElementById('page-codigos');
  if (container) renderCodigosPage(container);
}

function askMaterialFamilyAssignment(name, code) {
  const families = getMaterialFamilies();
  
  const overlay = document.createElement('div');
  overlay.id = 'family-assign-modal';
  overlay.className = 'modal-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.background = 'rgba(0,0,0,0.6)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '1000';
  
  let modalContent = '';
  
  if (families.length === 0) {
    modalContent = `
      <div class="modal" style="max-width: 400px; padding: 24px; background: var(--clr-surface); border: 1px solid var(--clr-border); border-radius: var(--r-lg); display: flex; flex-direction: column; gap: 16px;">
        <h3 class="section-title" style="margin:0; font-size:1.2rem; font-weight:700;">Asignar Familia</h3>
        <p style="font-size:0.88rem; color:var(--clr-text-secondary); margin:0;">
          No tienes familias de materiales creadas. ¿Deseas crear una nueva familia para el material <b>${name}</b>?
        </p>
        <div class="form-group" style="margin:0;">
          <label class="form-label">Nombre de la nueva familia</label>
          <input type="text" id="modal-new-fam-name" class="form-input" placeholder="Ej: Cartón, Vidrio..." style="width:100%;" />
        </div>
        <div style="display:flex; gap:10px; margin-top:8px;">
          <button class="btn-primary" id="btn-modal-create-fam" style="flex:1; justify-content:center;">Crear y Asignar</button>
          <button class="btn-secondary" id="btn-modal-skip-fam" style="flex:1; justify-content:center; margin:0;">Crear sin Familia</button>
        </div>
      </div>
    `;
  } else {
    let familySelectOptions = '';
    families.forEach(f => {
      familySelectOptions += `<option value="${f.id}">📁 ${f.name}</option>`;
    });
    
    modalContent = `
      <div class="modal" style="max-width: 420px; padding: 24px; background: var(--clr-surface); border: 1px solid var(--clr-border); border-radius: var(--r-lg); display: flex; flex-direction: column; gap: 16px;">
        <h3 class="section-title" style="margin:0; font-size:1.2rem; font-weight:700;">Asignar Familia</h3>
        <p style="font-size:0.88rem; color:var(--clr-text-secondary); margin:0;">
          Selecciona una familia para el material <b>${name}</b> o crea una nueva.
        </p>
        
        <div class="form-group" style="margin:0;">
          <label class="form-label">Familia Existente</label>
          <select id="modal-select-fam-id" class="form-select" style="width:100%;">
            ${familySelectOptions}
          </select>
        </div>
        
        <div style="text-align: center; font-size: 0.8rem; color: var(--clr-text-muted); font-weight: bold; margin: 4px 0;">ó</div>
        
        <div class="form-group" style="margin:0;">
          <label class="form-label">Nueva Familia</label>
          <input type="text" id="modal-new-fam-name" class="form-input" placeholder="Ej: Metales, Papel..." style="width:100%;" />
        </div>
        
        <div style="display:flex; flex-direction: column; gap:8px; margin-top:8px;">
          <div style="display: flex; gap: 10px;">
            <button class="btn-primary" id="btn-modal-assign-exist" style="flex:1; justify-content:center;">Asignar Seleccionada</button>
            <button class="btn-primary" id="btn-modal-create-fam" style="flex:1; justify-content:center; background-color: var(--clr-primary-light); color: #0a0f1d;">Crear y Asignar</button>
          </div>
          <button class="btn-secondary" id="btn-modal-skip-fam" style="width:100%; justify-content:center; margin:0;">Crear sin Familia</button>
        </div>
      </div>
    `;
  }
  
  overlay.innerHTML = modalContent;
  document.body.appendChild(overlay);
  
  const modalClose = () => {
    overlay.remove();
  };
  
  const finishAddMaterial = (familyId) => {
    if (addMaterialCode(name, code, familyId)) {
      document.getElementById('mat-name').value = '';
      document.getElementById('mat-code').value = '';
      const container = document.getElementById('page-codigos');
      if (container) renderCodigosPage(container);
      modalClose();
    }
  };
  
  overlay.querySelector('#btn-modal-skip-fam').onclick = () => {
    finishAddMaterial('');
  };
  
  overlay.querySelector('#btn-modal-create-fam').onclick = () => {
    const newNameEl = overlay.querySelector('#modal-new-fam-name');
    const newName = newNameEl ? newNameEl.value.trim() : '';
    if (!newName) {
      showToast('❌ Escribe el nombre de la nueva familia', 'error');
      if (newNameEl) newNameEl.focus();
      return;
    }
    const targetFamId = `fam-${Date.now()}`;
    const familiesList = getMaterialFamilies();
    if (familiesList.some(f => f.name.toLowerCase() === newName.toLowerCase())) {
      showToast('❌ Ya existe una familia con ese nombre', 'error');
      return;
    }
    familiesList.push({ id: targetFamId, name: newName });
    saveMaterialFamilies(familiesList);
    showToast('📁 Familia de materiales creada con éxito', 'success');
    finishAddMaterial(targetFamId);
  };
  
  const existBtn = overlay.querySelector('#btn-modal-assign-exist');
  if (existBtn) {
    existBtn.onclick = () => {
      const selectedFamId = overlay.querySelector('#modal-select-fam-id').value;
      finishAddMaterial(selectedFamId);
    };
  }
}

function handleAddCode() {
  const name = document.getElementById('mat-name').value.trim();
  const code = document.getElementById('mat-code').value.trim().toUpperCase();
  if (!name || !code) { showToast(t('err.fill_code'), 'error'); return; }
  
  const codes = getCustomCodes();
  if (codes.some(c => c.code === code)) {
    showToast(t('err.dup_code'), 'error');
    return;
  }
  
  askMaterialFamilyAssignment(name, code);
}

function handleDeleteCode(id) {
  if (!confirm('¿Eliminar este código?')) return;
  deleteMaterialCode(id);
  const listEl = document.getElementById('custom-codes-list');
  if (listEl) {
    const codes = getCustomCodes();
    const header = listEl.closest('.card')?.querySelector('h3 .badge');
    if (header) header.textContent = `${codes.length} ${t('mat.custom_count')}`;
    listEl.innerHTML = renderCustomCodesList(codes);
  }
  // Also refresh page so count in families list updates
  const container = document.getElementById('page-codigos');
  if (container) renderCodigosPage(container);
}

// Window registrations
window.renderCodigosPage = renderCodigosPage;
window.renderCustomCodesList = renderCustomCodesList;
window.renderMaterialFamiliesList = renderMaterialFamiliesList;
window.showEditRow = showEditRow;
window.saveEditRow = saveEditRow;
window.cancelEditRow = cancelEditRow;
window.handleAddCode = handleAddCode;
window.handleDeleteCode = handleDeleteCode;
window.handleCreateFamilyFromForm = handleCreateFamilyFromForm;
window.handleDeleteFamily = handleDeleteFamily;
window.askMaterialFamilyAssignment = askMaterialFamilyAssignment;
window.getCustomCodes = getCustomCodes;
window.saveCustomCodes = saveCustomCodes;
window.getMaterialCodes = getMaterialCodes;
window.addMaterialCode = addMaterialCode;
window.deleteMaterialCode = deleteMaterialCode;
window.updateMaterialCode = updateMaterialCode;
window.getMaterialFamilies = getMaterialFamilies;
window.saveMaterialFamilies = saveMaterialFamilies;
window.addMaterialFamily = addMaterialFamily;
window.deleteMaterialFamily = deleteMaterialFamily;
