/* =============================================
   ECOLOGY.JS – Environmental Impact Dashboard & PDF Certificates
   Depends on: invoices.js, clients.js, html2pdf
   ============================================= */

// HTML escaping (delegates to global helper if loaded)
function escapeHTMLString(str) {
  if (typeof window !== 'undefined' && typeof window.escapeHtml === 'function') {
    return window.escapeHtml(str);
  }
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g,
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Coefficients for environmental savings per 1 kg of material
const ECO_COEFFICIENTS = {
  paper:   { name: 'Papel/Cartón', trees: 0.017, water: 26,  energy: 4.0,  co2: 0.9 },
  plastic: { name: 'Plástico',     oil: 2.0,     water: 2,   energy: 5.7,  co2: 1.5 },
  glass:   { name: 'Vidrio',       raw: 1.2,     water: 0.5, energy: 0.35, co2: 0.3 },
  metal:   { name: 'Metal',        raw: 1.5,     water: 5,   energy: 14.0, co2: 9.0 },
  other:   { name: 'Otros',        raw: 0.8,     water: 1,   energy: 1.5,  co2: 1.0 }
};

function getWeightInKg(qty, unit) {
  const u = (unit || 'kg').toLowerCase().trim();
  if (u.includes('lb') || u.includes('libra')) {
    return qty * 0.453592;
  }
  if (u.includes('ton') || u.includes('t') || u.includes('tm')) {
    return qty * 1000;
  }
  return qty; // default kg
}

function classifyMaterial(desc) {
  const d = (desc || '').toLowerCase();
  if (d.includes('carton') || d.includes('cartón') || d.includes('papel') || d.includes('pape') || d.includes('periódico') || d.includes('diario')) {
    return 'paper';
  }
  if (d.includes('plastico') || d.includes('plástico') || d.includes('plas') || d.includes('pet') || d.includes('botella') || d.includes('film')) {
    return 'plastic';
  }
  if (d.includes('vidrio') || d.includes('cristal') || d.includes('botellas de vidrio')) {
    return 'glass';
  }
  if (d.includes('aluminio') || d.includes('cobre') || d.includes('hierro') || d.includes('acero') || d.includes('metal') || d.includes('alum') || d.includes('cobr') || d.includes('hier') || d.includes('chatarra') || d.includes('plomo')) {
    return 'metal';
  }
  return 'other';
}

function calculateEcoImpact(invoices, clientName = null, startDate = null, endDate = null) {
  let stats = {
    paperWeight: 0,
    plasticWeight: 0,
    glassWeight: 0,
    metalWeight: 0,
    otherWeight: 0,
    totalWeight: 0,
    treesSaved: 0,
    waterSaved: 0,
    energySaved: 0,
    co2Avoided: 0,
    oilSaved: 0
  };

  invoices.forEach(inv => {
    if (!inv) return;
    const invCompany = (inv.company || inv.client || '').trim().toLowerCase();
    
    // Filter by client name if provided
    if (clientName && invCompany !== clientName.trim().toLowerCase()) return;
    
    // Filter by date range
    if (startDate && inv.date < startDate) return;
    if (endDate && inv.date > endDate) return;

    (inv.items || []).forEach(item => {
      const weight = getWeightInKg(item.qty, item.unit);
      const cat = classifyMaterial(item.desc);

      stats.totalWeight += weight;
      
      if (cat === 'paper') {
        stats.paperWeight += weight;
        stats.treesSaved += weight * ECO_COEFFICIENTS.paper.trees;
        stats.waterSaved += weight * ECO_COEFFICIENTS.paper.water;
        stats.energySaved += weight * ECO_COEFFICIENTS.paper.energy;
        stats.co2Avoided += weight * ECO_COEFFICIENTS.paper.co2;
      } else if (cat === 'plastic') {
        stats.plasticWeight += weight;
        stats.oilSaved += weight * ECO_COEFFICIENTS.plastic.oil;
        stats.waterSaved += weight * ECO_COEFFICIENTS.plastic.water;
        stats.energySaved += weight * ECO_COEFFICIENTS.plastic.energy;
        stats.co2Avoided += weight * ECO_COEFFICIENTS.plastic.co2;
      } else if (cat === 'glass') {
        stats.glassWeight += weight;
        stats.waterSaved += weight * ECO_COEFFICIENTS.glass.water;
        stats.energySaved += weight * ECO_COEFFICIENTS.glass.energy;
        stats.co2Avoided += weight * ECO_COEFFICIENTS.glass.co2;
      } else if (cat === 'metal') {
        stats.metalWeight += weight;
        stats.waterSaved += weight * ECO_COEFFICIENTS.metal.water;
        stats.energySaved += weight * ECO_COEFFICIENTS.metal.energy;
        stats.co2Avoided += weight * ECO_COEFFICIENTS.metal.co2;
      } else {
        stats.otherWeight += weight;
        stats.waterSaved += weight * ECO_COEFFICIENTS.other.water;
        stats.energySaved += weight * ECO_COEFFICIENTS.other.energy;
        stats.co2Avoided += weight * ECO_COEFFICIENTS.other.co2;
      }
    });
  });

  return stats;
}

let currentEcoTypeFilter = 'all';

function escapeAttrSingleQuote(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function generateClientCertCode(clientName) {
  if (!clientName) return 'MSSZQ5MI';
  let hash = 5381;
  const str = clientName.trim().toUpperCase();
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  const positive = Math.abs(hash).toString(36).toUpperCase();
  return (positive + 'RECIMINSA').slice(0, 8);
}

function getEcoClientsList(clientsDB, invoices) {
    const materials = typeof getCustomCodes === 'function' ? getCustomCodes() : [];
    const materialNames = new Set(materials.map(m => (m.name || '').trim().toLowerCase()));

    const clientMap = new Map();

    // 1. Procesar clientes de la base de datos
    clientsDB.forEach(c => {
        if (!c.name) return;
        const cleanName = c.name.trim();
        const lower = cleanName.toLowerCase();
        if (materialNames.has(lower)) return;
        if (/^(alambre|cobre|carton|cartón|papel|plastico|plástico|vidrio|metal|hierro|aluminio|bronce|chatarra)/i.test(cleanName)) return;

        clientMap.set(lower, {
            name: cleanName,
            type: c.type === 'empresa' ? 'empresa' : 'persona',
            nit: c.nit || ''
        });
    });

    // 2. Procesar clientes extraídos de facturas
    invoices.forEach(inv => {
        const rawName = (inv.company || inv.client || '').trim();
        if (!rawName) return;
        const lower = rawName.toLowerCase();
        if (materialNames.has(lower)) return;
        if (/^(alambre|cobre|carton|cartón|papel|plastico|plástico|vidrio|metal|hierro|aluminio|bronce|chatarra)/i.test(rawName)) return;

        let detectedType = 'persona';
        if (inv.ncfType === 'B01' || inv.ncfType === 'B14' || inv.typeName === 'empresa' || (inv.rnc && inv.rnc.length >= 9)) {
            detectedType = 'empresa';
        }

        if (!clientMap.has(lower)) {
            clientMap.set(lower, {
                name: rawName,
                type: detectedType,
                nit: inv.rnc || inv.nit || ''
            });
        } else {
            const existing = clientMap.get(lower);
            if (detectedType === 'empresa' && existing.type !== 'empresa') {
                existing.type = 'empresa';
            }
            if (!existing.nit && (inv.rnc || inv.nit)) {
                existing.nit = inv.rnc || inv.nit;
            }
        }
    });

    // 3. Calcular impacto individual por cliente y asignar código de validación único
    return Array.from(clientMap.values()).map(c => {
        const cStats = calculateEcoImpact(invoices, c.name);
        const certCode = generateClientCertCode(c.name);
        return {
            ...c,
            certCode: certCode,
            stats: cStats
        };
    }).filter(c => c.stats && c.stats.totalWeight > 0)
      .sort((a, b) => b.stats.totalWeight - a.stats.totalWeight);
}

function renderEcoClientCards(clientList) {
  const container = document.getElementById('eco-cards-grid');
  if (!container) return;

  const searchInput = document.getElementById('eco-search-input');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const filtered = clientList.filter(c => {
    if (currentEcoTypeFilter === 'persona' && c.type !== 'persona') return false;
    if (currentEcoTypeFilter === 'empresa' && c.type !== 'empresa') return false;

    if (query) {
      const matchName = c.name.toLowerCase().includes(query);
      const matchNit = c.nit ? c.nit.toLowerCase().includes(query) : false;
      const matchCode = c.certCode ? c.certCode.toLowerCase().includes(query) : false;
      if (!matchName && !matchNit && !matchCode) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 36px 16px; color: var(--clr-text-muted); background: var(--clr-surface-2); border-radius: var(--r-md); border: 1px dashed var(--clr-border);">
        <div style="font-size: 2rem; margin-bottom: 8px;">🔍</div>
        <div style="font-weight: 700; font-size: 0.95rem;">No se encontraron diplomas para esta búsqueda</div>
        <p style="font-size: 0.8rem; margin-top: 4px;">Prueba buscando por nombre, RNC o código de validación (ej. MSSZQ5MI).</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(c => {
    const isEmp = c.type === 'empresa';
    const totalTons = (c.stats.totalWeight / 1000).toFixed(2);
    
    return `
      <div class="card card--elevated eco-client-card" style="display:flex; flex-direction:column; justify-content:space-between; padding: 16px; border-top: 4px solid ${isEmp ? '#047857' : '#3b82f6'}; position:relative; background: var(--clr-surface-1);">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px; flex-wrap:wrap; gap:4px;">
            <span style="background:${isEmp ? 'rgba(4,120,87,0.15)' : 'rgba(59,130,246,0.15)'}; color:${isEmp ? '#047857' : '#3b82f6'}; font-weight:800; font-size:0.68rem; padding: 3px 9px; border-radius: 12px; letter-spacing: 0.5px; text-transform: uppercase;">
              ${isEmp ? '🏢 EMPRESA' : '👤 PERSONA'}
            </span>
            <span style="font-size:0.72rem; color:var(--clr-primary); font-weight:700; background:var(--clr-surface-3); padding:2px 8px; border-radius:6px; font-family: monospace;" title="Código de Validación del Diploma">
              🔑 ${escapeHTMLString(c.certCode)}
            </span>
          </div>

          <h4 style="font-size: 1.05rem; font-weight: 800; color: var(--clr-text-main); margin: 0 0 6px 0; line-height: 1.3;">${escapeHTMLString(c.name)}</h4>
          ${c.nit ? `<div style="font-size:0.72rem; color:var(--clr-text-muted); font-weight:600; margin-bottom:6px;">RNC / Cédula: ${escapeHTMLString(c.nit)}</div>` : ''}

          <div style="font-size: 1.35rem; font-weight: 900; color: #10b981; margin-bottom: 10px; display:flex; align-items:baseline; gap: 6px;">
            <span>${c.stats.totalWeight.toLocaleString('es-DO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg</span>
            <span style="font-size:0.75rem; color:var(--clr-text-muted); font-weight:600;">(${totalTons} Ton)</span>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; font-size:0.72rem; color:var(--clr-text-secondary); margin-bottom: 14px;">
            <div style="background:var(--clr-surface-3); padding:5px 8px; border-radius:6px;">🌳 Árboles: <strong>${Math.ceil(c.stats.treesSaved)}</strong></div>
            <div style="background:var(--clr-surface-3); padding:5px 8px; border-radius:6px;">💧 Agua: <strong>${Math.round(c.stats.waterSaved).toLocaleString()}L</strong></div>
            <div style="background:var(--clr-surface-3); padding:5px 8px; border-radius:6px;">⚡ Energía: <strong>${Math.round(c.stats.energySaved).toLocaleString()}kWh</strong></div>
            <div style="background:var(--clr-surface-3); padding:5px 8px; border-radius:6px;">💨 CO₂: <strong>${Math.round(c.stats.co2Avoided).toLocaleString()}kg</strong></div>
          </div>
        </div>

        <div style="display:flex; gap:8px;">
          <button class="btn-primary" onclick="generateEcoImpactPDFEngine({ clientName: '${escapeAttrSingleQuote(c.name)}', certCode: '${escapeAttrSingleQuote(c.certCode)}' })" style="flex:1; justify-content:center; gap:6px; background: linear-gradient(135deg, #10b981, #059669); border-color:#059669; font-weight:700; padding: 8px 10px; font-size: 0.8rem; border-radius: var(--r-md); cursor: pointer;">
            📜 Constancia Estimada (PDF)
          </button>
          <button class="btn-secondary" onclick="shareEcoCertificateViaWhatsApp({ clientName: '${escapeAttrSingleQuote(c.name)}', certCode: '${escapeAttrSingleQuote(c.certCode)}' })" title="Enviar certificado por WhatsApp" style="justify-content:center; gap:5px; background:#25d366; color:#ffffff; border-color:#25d366; font-weight:700; padding: 8px 12px; font-size: 0.8rem; border-radius: var(--r-md); cursor: pointer;">
            💬
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function setEcoTypeFilter(type) {
  currentEcoTypeFilter = type;
  ['all', 'empresa', 'persona'].forEach(tKey => {
    const btn = document.getElementById(`btn-eco-filter-${tKey}`);
    if (btn) {
      if (tKey === type) {
        btn.style.background = 'var(--clr-primary)';
        btn.style.color = '#ffffff';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--clr-text-muted)';
      }
    }
  });
  if (window._cachedEcoClients) {
    renderEcoClientCards(window._cachedEcoClients);
  }
}

function handleEcoSearchInput() {
  if (window._cachedEcoClients) {
    renderEcoClientCards(window._cachedEcoClients);
  }
}

function renderEcologyPage(container) {
  const invoices = getAllInvoices();
  const stats = calculateEcoImpact(invoices);
  const clients = getClients();

  const ecoClientsList = getEcoClientsList(clients, invoices);
  window._cachedEcoClients = ecoClientsList;
  currentEcoTypeFilter = 'all';

  const empresaCount = ecoClientsList.filter(c => c.type === 'empresa').length;
  const personaCount = ecoClientsList.filter(c => c.type === 'persona').length;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="section-title">${t('eco.title')}</h2>
        <p class="section-subtitle">${t('eco.subtitle')}</p>
      </div>
    </div>

    <!-- Overview Statistics Dashboard -->
    <div class="finance-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
      
      <div class="card card--elevated" style="border-left: 5px solid #22c55e;">
        <div style="font-size: 0.7rem; color: var(--clr-text-muted); font-weight: 700; text-transform: uppercase;">${t('eco.total_recycled')}</div>
        <div style="font-size: 1.8rem; font-weight: 800; color: #22c55e; margin: 8px 0;">${stats.totalWeight.toFixed(1)} <span style="font-size:0.9rem;">kg</span></div>
        <p style="font-size: 0.72rem; color: var(--clr-text-muted); margin:0;">${t('eco.recycled_desc')}</p>
      </div>

      <div class="card card--elevated" style="border-left: 5px solid #10b981;">
        <div style="font-size: 0.7rem; color: var(--clr-text-muted); font-weight: 700; text-transform: uppercase;">${t('eco.trees_saved')}</div>
        <div style="font-size: 1.8rem; font-weight: 800; color: #10b981; margin: 8px 0;">🌳 ${Math.ceil(stats.treesSaved)}</div>
        <p style="font-size: 0.72rem; color: var(--clr-text-muted); margin:0;">${t('eco.trees_desc')}</p>
      </div>

      <div class="card card--elevated" style="border-left: 5px solid #3b82f6;">
        <div style="font-size: 0.7rem; color: var(--clr-text-muted); font-weight: 700; text-transform: uppercase;">${t('eco.water_saved')}</div>
        <div style="font-size: 1.8rem; font-weight: 800; color: #3b82f6; margin: 8px 0;">💧 ${Math.round(stats.waterSaved).toLocaleString()} <span style="font-size:0.9rem;">L</span></div>
        <p style="font-size: 0.72rem; color: var(--clr-text-muted); margin:0;">${t('eco.water_desc').replace('{count}', Math.ceil(stats.waterSaved / 19))}</p>
      </div>

      <div class="card card--elevated" style="border-left: 5px solid #fbbf24;">
        <div style="font-size: 0.7rem; color: var(--clr-text-muted); font-weight: 700; text-transform: uppercase;">${t('eco.energy_saved')}</div>
        <div style="font-size: 1.8rem; font-weight: 800; color: #fbbf24; margin: 8px 0;">⚡ ${Math.round(stats.energySaved).toLocaleString()} <span style="font-size:0.9rem;">kWh</span></div>
        <p style="font-size: 0.72rem; color: var(--clr-text-muted); margin:0;">${t('eco.energy_desc').replace('{count}', Math.ceil(stats.energySaved / 6))}</p>
      </div>

      <div class="card card--elevated" style="border-left: 5px solid #ec4899;">
        <div style="font-size: 0.7rem; color: var(--clr-text-muted); font-weight: 700; text-transform: uppercase;">${t('eco.co2_avoided')}</div>
        <div style="font-size: 1.8rem; font-weight: 800; color: #ec4899; margin: 8px 0;">💨 ${Math.round(stats.co2Avoided).toLocaleString()} <span style="font-size:0.9rem;">kg</span></div>
        <p style="font-size: 0.72rem; color: var(--clr-text-muted); margin:0;">${t('eco.co2_desc')}</p>
      </div>
    </div>

    <!-- Charts & Certificate Panel Grid -->
    <div class="finance-grid" style="grid-template-columns: 1fr 1fr; gap: 20px;">
      
      <!-- Left side: Material distribution & progress chart -->
      <div class="card card--elevated">
        <h3 class="section-title" style="margin-bottom: 16px; font-size: 1.05rem;">${t('eco.mat_distribution')}</h3>
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${renderMaterialProgressRow(t('eco.cat_paper'), stats.paperWeight, stats.totalWeight, '#fbbf24')}
          ${renderMaterialProgressRow(t('eco.cat_plastics'), stats.plasticWeight, stats.totalWeight, '#10b981')}
          ${renderMaterialProgressRow(t('eco.cat_metals'), stats.metalWeight, stats.totalWeight, '#ef4444')}
          ${renderMaterialProgressRow(t('eco.cat_glass'), stats.glassWeight, stats.totalWeight, '#3b82f6')}
          ${renderMaterialProgressRow(t('eco.cat_others'), stats.otherWeight, stats.totalWeight, '#6b7280')}
        </div>
        
        <div style="margin-top: 24px; padding: 12px; background: var(--clr-surface-3); border-radius: var(--r-md); font-size:0.78rem; line-height: 1.4; color: var(--clr-text-secondary);">
          ${t('eco.did_you_know')}
        </div>
      </div>

      <!-- Right side: Green certificate generator -->
      <div class="card card--elevated">
        <h3 class="section-title" style="margin-bottom: 8px; font-size: 1.05rem;">${t('eco.generator_title')}</h3>
        <p style="font-size:0.75rem; color:var(--clr-text-muted); margin-bottom: 16px;">
          ${t('eco.generator_desc')}
        </p>

        <div style="display:flex; flex-direction:column; gap:14px;">
          <div class="form-group">
            <label class="form-label">${t('eco.select_client')}</label>
            <select id="eco-client-select" class="form-select">
              <option value="">${t('eco.all_clients')}</option>
              ${ecoClientsList.map(c => `<option value="${escapeHTMLString(c.name)}">${escapeHTMLString(c.name)} (${c.type === 'empresa' ? 'Empresa' : 'Persona'})</option>`).join('')}
            </select>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div class="form-group">
              <label class="form-label">${t('eco.start_date')}</label>
              <input type="date" id="eco-start-date" class="form-input" value="${new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]}" />
            </div>
            <div class="form-group">
              <label class="form-label">${t('eco.end_date')}</label>
              <input type="date" id="eco-end-date" class="form-input" value="${new Date().toISOString().split('T')[0]}" />
            </div>
          </div>

          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top: 10px;">
            <button class="btn-primary" onclick="generateEcoCertificatePDF()" style="flex:1; min-width:170px; background: linear-gradient(135deg, #10b981, #059669); border-color: #059669; color: white; justify-content: center; gap: 8px; font-weight: 700;">
              ${t('eco.generate_btn')}
            </button>
            <button class="btn-secondary" onclick="shareEcoCertificateViaWhatsApp()" style="background:#25d366; border-color:#25d366; color:#ffffff; justify-content:center; gap:6px; font-weight:700; padding:10px 14px; cursor:pointer;">
              💬 Enviar por WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- SECCIÓN: Buscador y Catálogo de Diplomas por Cliente -->
    <div class="card card--elevated" style="margin-top: 24px;">
      <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap: 14px; margin-bottom: 16px; border-bottom: 1px solid var(--clr-border); padding-bottom: 14px;">
        <div>
          <h3 class="section-title" style="font-size: 1.1rem; margin-bottom: 4px;">📜 Buscador de Diplomas por Cliente</h3>
          <p style="font-size: 0.78rem; color: var(--clr-text-muted); margin: 0;">Filtra e inspecciona diplomas de impacto ecológico divididos entre empresas y clientes individuales.</p>
        </div>
        
        <!-- Pestañas de Filtro por Categoría -->
        <div style="display:flex; gap: 6px; background: var(--clr-surface-3); padding: 4px; border-radius: var(--r-md);">
          <button id="btn-eco-filter-all" class="btn-secondary" onclick="setEcoTypeFilter('all')" style="padding: 6px 14px; font-size: 0.78rem; font-weight: 700; border: none; background: var(--clr-primary); color: #ffffff; cursor: pointer; border-radius: 6px;">🌐 Todos (${ecoClientsList.length})</button>
          <button id="btn-eco-filter-empresa" class="btn-secondary" onclick="setEcoTypeFilter('empresa')" style="padding: 6px 14px; font-size: 0.78rem; font-weight: 700; border: none; background: transparent; color: var(--clr-text-muted); cursor: pointer; border-radius: 6px;">🏢 Empresas (${empresaCount})</button>
          <button id="btn-eco-filter-persona" class="btn-secondary" onclick="setEcoTypeFilter('persona')" style="padding: 6px 14px; font-size: 0.78rem; font-weight: 700; border: none; background: transparent; color: var(--clr-text-muted); cursor: pointer; border-radius: 6px;">👤 Personas (${personaCount})</button>
        </div>
      </div>

      <!-- Buscador por Texto (Nombre / RNC / Código) -->
      <div style="margin-bottom: 20px;">
        <input id="eco-search-input" type="text" class="form-input" placeholder="🔍 Buscar por cliente, RNC o código de validación (ej. MSSZQ5MI)..." oninput="handleEcoSearchInput()" style="width:100%; font-size:0.88rem; padding: 11px 16px; background: var(--clr-surface-2);" />
      </div>

      <!-- Rejilla Dinámica de Tarjetas de Diplomas -->
      <div id="eco-cards-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
      </div>

      <div style="margin-top: 16px; padding: 10px 14px; border-radius: 8px; background: rgba(16, 185, 129, 0.06); border: 1px solid var(--clr-border); font-size: 0.75rem; color: var(--clr-text-muted); line-height: 1.45;">
        ℹ️ <strong>Nota metodológica:</strong> Los cálculos de árboles, agua, energía y CO₂ evitado son <b>estimaciones informativas basadas en factores promedio estándar</b> aplicadas sobre los pesos registrados por la empresa. Las constancias emitidas son de uso interno/informativo y no constituyen certificaciones gubernamentales oficiales ni créditos de carbono negociables.
      </div>
    </div>
  `;

  // Renderizar las tarjetas iniciales de clientes
  setTimeout(() => {
    renderEcoClientCards(ecoClientsList);
  }, 50);
}

function renderMaterialProgressRow(name, weight, total, color) {
  const pct = total > 0 ? (weight / total) * 100 : 0;
  return `
    <div>
      <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:600; margin-bottom:4px;">
        <span>${name}</span>
        <span>${weight.toFixed(1)} kg (${pct.toFixed(1)}%)</span>
      </div>
      <div style="width:100%; height:8px; background:var(--clr-border); border-radius:4px; overflow:hidden;">
        <div style="width:${pct}%; height:100%; background:${color}; border-radius:4px; transition: width 0.3s ease;"></div>
      </div>
    </div>
  `;
}

// Motor generateEcoImpactPDFEngine centralizado en js/eco-pdf-engine.js (con QR ISO 18004 offline)

function generateEcoCertificatePDF() {
  try {
    const clientSelect = document.getElementById('eco-client-select');
    const startDateInput = document.getElementById('eco-start-date');
    const endDateInput = document.getElementById('eco-end-date');

    const clientName = clientSelect ? clientSelect.value : null;
    const startDate = startDateInput ? startDateInput.value : null;
    const endDate = endDateInput ? endDateInput.value : null;

    generateEcoImpactPDFEngine({
      clientName: clientName,
      startDate: startDate,
      endDate: endDate,
      invoices: typeof getAllInvoices === 'function' ? getAllInvoices() : []
    });
  } catch (e) {
    console.error('Error al hacer clic en Generar Certificado:', e);
    if (typeof showToast === 'function') {
      showToast('❌ Error al procesar la solicitud de certificado: ' + e.message, 'error');
    }
  }
}

