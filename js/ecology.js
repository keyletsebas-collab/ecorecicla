/* =============================================
   ECOLOGY.JS – Environmental Impact Dashboard & PDF Certificates
   Depends on: invoices.js, clients.js, html2pdf
   ============================================= */

// Basic HTML escaping
function escapeHTMLString(str) {
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

function escapeHTMLString(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
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

  const registeredClients = typeof getClients === 'function' ? getClients() : [];

  container.innerHTML = filtered.map(c => {
    const isEmp = c.type === 'empresa';
    const totalTons = (c.stats.totalWeight / 1000).toFixed(2);
    const isRegistered = registeredClients.some(rc => (rc.name || '').trim().toLowerCase() === (c.name || '').trim().toLowerCase());
    
    return `
      <div class="card card--elevated eco-client-card" style="display:flex; flex-direction:column; justify-content:space-between; padding: 16px; border-top: 4px solid ${isEmp ? '#047857' : '#3b82f6'}; position:relative; background: var(--clr-surface-1); cursor: pointer;" onclick="openEcoClientDetailsModal('${escapeHTMLString(c.name)}', '${escapeHTMLString(c.nit || '')}', '${c.type}')">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px; flex-wrap:wrap; gap:4px;">
            <div style="display:flex; gap: 4px; align-items:center;">
              <span style="background:${isEmp ? 'rgba(4,120,87,0.15)' : 'rgba(59,130,246,0.15)'}; color:${isEmp ? '#047857' : '#3b82f6'}; font-weight:800; font-size:0.68rem; padding: 3px 9px; border-radius: 12px; letter-spacing: 0.5px; text-transform: uppercase;">
                ${isEmp ? '🏢 EMPRESA' : '👤 PERSONA'}
              </span>
              ${isRegistered ? `
                <span style="background:rgba(16,185,129,0.15); color:#10b981; font-weight:800; font-size:0.65rem; padding: 3px 7px; border-radius: 10px;" title="Registrado en el directorio de clientes">
                  ✓ Registrado
                </span>
              ` : `
                <span style="background:rgba(245,158,11,0.15); color:#d97706; font-weight:800; font-size:0.65rem; padding: 3px 7px; border-radius: 10px;" title="No registrado en clientes. Haz clic para crearlo.">
                  ➕ No Registrado
                </span>
              `}
            </div>
            <span style="font-size:0.72rem; color:var(--clr-primary); font-weight:700; background:var(--clr-surface-3); padding:2px 8px; border-radius:6px; font-family: monospace;" title="Código de Validación del Diploma">
              🔑 ${c.certCode}
            </span>
          </div>

          <h4 style="font-size: 1.05rem; font-weight: 800; color: var(--clr-text-main); margin: 0 0 6px 0; line-height: 1.3;">${c.name}</h4>
          ${c.nit ? `<div style="font-size:0.72rem; color:var(--clr-text-muted); font-weight:600; margin-bottom:6px;">RNC / Cédula: ${c.nit}</div>` : ''}

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

        <div style="display:flex; gap: 8px; margin-top:8px;" onclick="event.stopPropagation();">
          ${!isRegistered ? `
            <button class="btn-secondary" onclick="event.stopPropagation(); openEcoClientDetailsModal('${escapeHTMLString(c.name)}', '${escapeHTMLString(c.nit || '')}', '${c.type}')" style="flex:1; justify-content:center; gap:4px; font-weight:700; padding: 8px 10px; font-size: 0.78rem; border-radius: var(--r-md); cursor: pointer;">
              ➕ Crear Cliente
            </button>
          ` : ''}
          <button class="btn-primary" onclick="event.stopPropagation(); generateEcoImpactPDFEngine({ clientName: '${escapeHTMLString(c.name)}', certCode: '${c.certCode}' })" style="flex:1; justify-content:center; gap:6px; background: linear-gradient(135deg, #10b981, #059669); border-color:#059669; font-weight:700; padding: 8px 12px; font-size: 0.82rem; border-radius: var(--r-md); cursor: pointer;">
            📜 Diploma PDF
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
              ${ecoClientsList.map(c => `<option value="${escapeHTMLString(c.name)}">${c.name} (${c.type === 'empresa' ? 'Empresa' : 'Persona'})</option>`).join('')}
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

          <button class="btn-primary" onclick="generateEcoCertificatePDF()" style="background: linear-gradient(135deg, #10b981, #059669); border-color: #059669; color: white; justify-content: center; gap: 8px; margin-top: 10px; font-weight: 700;">
            ${t('eco.generate_btn')}
          </button>
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

function generateEcoImpactPDFEngine(options = {}) {
    const {
        clientName = null,
        startDate = null,
        endDate = null,
        invoices = [],
        customTitle = null,
        onSuccess = null,
        onError = null
    } = options;

    // 1. Obtener estadísticas de impacto ecológico
    const targetInvoices = invoices && invoices.length > 0 ? invoices : (typeof getAllInvoices === 'function' ? getAllInvoices() : []);
    const stats = typeof calculateEcoImpact === 'function' ? calculateEcoImpact(targetInvoices, clientName, startDate, endDate) : null;

    if (!stats || stats.totalWeight === 0) {
        if (typeof showToast === 'function') {
            const msg = typeof t === 'function' ? t('eco.toast_no_invoices') : '⚠️ No hay datos registrados para este cliente en el rango seleccionado';
            showToast(msg, 'warning');
        }
        if (onError) onError('No hay datos');
        return;
    }

    if (typeof showToast === 'function') {
        showToast('🌱 Generando Certificado Oficial de Impacto Ambiental...', 'info', 3000);
    }

    // 2. Obtener la configuración corporativa (Registro de Empresa: Nombre, Logo, RNC, Teléfono, Correo, Dirección)
    let settings = {};
    if (typeof getSettings === 'function') {
        settings = getSettings();
    } else {
        try {
            const sessionStr = localStorage.getItem('recim_session');
            let accountId = 'default';
            if (sessionStr) accountId = JSON.parse(sessionStr).accountId || 'default';
            const key = typeof userKey === 'function' ? userKey('recim_settings') : `recim_settings_${accountId}`;
            settings = JSON.parse(localStorage.getItem(key) || '{}');
            if (!settings.companyName) {
                settings = JSON.parse(localStorage.getItem('recim_settings') || '{}');
            }
        } catch (_) {}
    }

    let companyName = settings.companyName || 'RECIMINSA';
    let companyLogo = settings.companyLogo || settings.logoUrl || (typeof window !== 'undefined' ? window.DEFAULT_APP_LOGO : '') || '';
    let rnc = settings.companyRNC || settings.rnc || settings.companyRnc || '';
    let phone = settings.companyPhone || settings.phone || settings.userPhone || '';
    let email = settings.companyEmail || settings.userEmail || '';
    let address = settings.companyAddress || '';

    if (typeof userKey === 'function') {
        try {
            const sharedSettings = JSON.parse(localStorage.getItem(userKey('recim_company_shared_settings')) || '{}');
            if (sharedSettings.companyName) companyName = sharedSettings.companyName;
            if (sharedSettings.companyRNC) rnc = sharedSettings.companyRNC;
            if (sharedSettings.companyPhone) phone = sharedSettings.companyPhone;
            if (sharedSettings.companyEmail) email = sharedSettings.companyEmail;
            if (sharedSettings.companyAddress) address = sharedSettings.companyAddress;
            if (sharedSettings.companyLogo) companyLogo = sharedSettings.companyLogo;
        } catch (e) {}
    }

    const certId = `CERT-ECO-${Date.now().toString(36).toUpperCase()}`;

    // 3. Fechas formateadas
    const formatTextDate = (dStr) => {
        if (!dStr) return '';
        const parts = dStr.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    const periodText = startDate && endDate 
        ? `Período del ${formatTextDate(startDate)} al ${formatTextDate(endDate)}`
        : 'Período acumulado al presente';

    const targetClient = clientName || 'TODOS LOS CLIENTES (CERTIFICADO GENERAL)';
    const issueDate = new Date().toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' });

    // 4. Calcular porcentajes y peso por tipo de material
    const totalW = stats.totalWeight || 1;
    const materialsBreakdown = [
        { name: 'Papel y Cartón', weight: stats.paperWeight, color: [16, 185, 129] },
        { name: 'Plásticos (PET/HDPE/Film)', weight: stats.plasticWeight, color: [59, 130, 246] },
        { name: 'Metales (Aluminio/Cobre/Hierro)', weight: stats.metalWeight, color: [245, 158, 11] },
        { name: 'Vidrio', weight: stats.glassWeight, color: [139, 92, 246] },
        { name: 'Otros / Mezclados', weight: stats.otherWeight, color: [100, 116, 139] }
    ].map(m => ({
        ...m,
        pct: ((m.weight / totalW) * 100).toFixed(1)
    }));

    // 5. Obtener constructor jsPDF usando getJsPDFConstructor (idéntico a pdf-utils.js)
    const jsPDFConstructor = typeof getJsPDFConstructor === 'function' 
        ? getJsPDFConstructor() 
        : (window.jsPDF || (window.jspdf && window.jspdf.jsPDF) || (window.html2pdf && window.html2pdf.jsPDF));

    if (!jsPDFConstructor) {
        console.error('jsPDF NOT FOUND');
        if (typeof showToast === 'function') showToast('❌ Error: Librería jsPDF no disponible', 'error');
        if (onError) onError('jsPDF not found');
        return;
    }

    // 6. Instanciar documento Carta Apaisado (279.4mm x 215.9mm)
    const doc = new jsPDFConstructor({
        orientation: 'landscape',
        unit: 'mm',
        format: 'letter'
    });

    const pageWidth = 279.4;
    const pageHeight = 215.9;

    // --- A. FONDO Y MARCO DE HONOR (Doble Borde Verde Esmeralda) ---
    doc.setFillColor(240, 253, 244);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Borde exterior
    doc.setDrawColor(5, 150, 105); // Verde esmeralda #059669
    doc.setLineWidth(1.2);
    doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

    // Borde interior
    doc.setDrawColor(52, 211, 153); // #34d399
    doc.setLineWidth(0.4);
    doc.rect(10.5, 10.5, pageWidth - 21, pageHeight - 21);

    // Fondo blanco del cuerpo interno
    doc.setFillColor(255, 255, 255);
    doc.rect(12, 12, pageWidth - 24, pageHeight - 24, 'F');

    // --- B. CABECERA INSTITUCIONAL ---
    let logoDrawn = false;
    if (companyLogo && (companyLogo.startsWith('data:image/') || companyLogo.includes('base64'))) {
        try {
            let logoFormat = 'PNG';
            if (companyLogo.includes('image/jpeg') || companyLogo.includes('image/jpg')) logoFormat = 'JPEG';
            doc.addImage(companyLogo, logoFormat, 16, 16, 32, 14);
            logoDrawn = true;
        } catch (e) {
            console.error('Error dibujando logo en certificado:', e);
        }
    }

    const textLeftX = logoDrawn ? 52 : 16;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(6, 95, 70);
    doc.text(companyName, textLeftX, 20);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(4, 120, 87);
    doc.text("Gestión Integral de Reciclaje & Desarrollo Sostenible", textLeftX, 24.5);

    const contactParts = [];
    if (rnc) contactParts.push(`RNC: ${rnc}`);
    if (phone) contactParts.push(`Tel: ${phone}`);
    if (email) contactParts.push(`Email: ${email}`);

    if (contactParts.length > 0) {
        doc.setFontSize(6.8);
        doc.setTextColor(100, 116, 139);
        doc.text(contactParts.join(' | '), textLeftX, 28.5);
    }



    // Línea divisoria cabecera
    doc.setDrawColor(167, 243, 208);
    doc.setLineWidth(0.5);
    doc.line(16, 33, 263.4, 33);

    // --- C. TÍTULO PRINCIPAL Y OTORGAMIENTO ---
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(5, 150, 105);
    doc.text(customTitle || 'CERTIFICADO DE IMPACTO MEDIOAMBIENTAL', pageWidth / 2, 40, { align: 'center' });

    doc.setFont('Times', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(6, 78, 59);
    doc.text("Reconocimiento de Excelencia Verde", pageWidth / 2, 49, { align: 'center' });

    // Barrita decorativa central
    doc.setFillColor(16, 185, 129);
    doc.roundedRect((pageWidth / 2) - 25, 52, 50, 1.2, 0.6, 0.6, 'F');

    doc.setFont('Helvetica', 'oblique');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Otorgado solemnemente a la entidad o corporación:", pageWidth / 2, 59, { align: 'center' });

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(4, 120, 87);
    doc.text(targetClient.toUpperCase(), pageWidth / 2, 67, { align: 'center' });

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(51, 65, 85);
    doc.text(`Por su valiosa contribución al desarrollo sostenible y la economía circular durante el ${periodText},`, pageWidth / 2, 73, { align: 'center' });
    doc.text(`canalizando un total de ${stats.totalWeight.toLocaleString('es-DO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg (${(stats.totalWeight / 1000).toFixed(2)} Toneladas) de material reciclable devuelto al ciclo productivo.`, pageWidth / 2, 77.5, { align: 'center' });

    // --- D. 5 TARJETAS DE IMPACTO ECOLÓGICO ---
    const cardsY = 82;
    const cardW = 46.8;
    const cardH = 26;
    const cardGap = 3.1;
    const startX = 16;

    const cardsData = [
        { label: 'TOTAL RECICLADO', val: `${stats.totalWeight.toFixed(1)} kg`, color: [4, 120, 87] },
        { label: 'ÁRBOLES SALVADOS', val: `${Math.ceil(stats.treesSaved)}`, color: [5, 150, 105] },
        { label: 'AGUA CONSERVADA', val: `${Math.round(stats.waterSaved).toLocaleString()} L`, color: [2, 132, 199] },
        { label: 'ENERGÍA AHORRADA', val: `${Math.round(stats.energySaved).toLocaleString()} kWh`, color: [217, 119, 6] },
        { label: 'CO2 EVITADO', val: `${Math.round(stats.co2Avoided).toLocaleString()} kg`, color: [124, 58, 237] }
    ];

    cardsData.forEach((c, idx) => {
        const cx = startX + idx * (cardW + cardGap);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(167, 243, 208);
        doc.setLineWidth(0.3);
        doc.roundedRect(cx, cardsY, cardW, cardH, 2, 2, 'FD');

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(c.color[0], c.color[1], c.color[2]);
        doc.text(c.val, cx + (cardW / 2), cardsY + 12, { align: 'center' });

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(6.2);
        doc.setTextColor(100, 116, 139);
        doc.text(c.label, cx + (cardW / 2), cardsY + 20, { align: 'center' });
    });

    // --- E. TABLA DE COMPOSICIÓN Y SELLO/FIRMAS ---
    const boxY = 112;
    const boxH = 60;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(16, boxY, 247.4, boxH, 2.5, 2.5, 'FD');

    // Columna Izquierda: Desglose de Materiales
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(4, 120, 87);
    doc.text("COMPOSICIÓN DEL MATERIAL PROCESADO:", 22, boxY + 8);

    let rowY = boxY + 14;
    materialsBreakdown.forEach(m => {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(51, 65, 85);
        doc.text(m.name, 22, rowY);
        doc.text(`${m.weight.toFixed(1)} kg (${m.pct}%)`, 135, rowY, { align: 'right' });

        // Bar Track
        doc.setFillColor(226, 232, 240);
        doc.roundedRect(22, rowY + 1.5, 113, 3, 1, 1, 'F');

        // Bar Fill
        const fillW = Math.max(1, (parseFloat(m.pct) / 100) * 113);
        doc.setFillColor(m.color[0], m.color[1], m.color[2]);
        doc.roundedRect(22, rowY + 1.5, fillW, 3, 1, 1, 'F');

        rowY += 9;
    });

    // Separador vertical discontinuo
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(143, boxY + 5, 143, boxY + boxH - 5);
    doc.setLineDashPattern([], 0);

    // Sello Oficial de Empresa
    const sealCx = 168;
    const sealCy = boxY + 25;
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(5, 150, 105);
    doc.setLineWidth(0.8);
    doc.circle(sealCx, sealCy, 14, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(5.2);
    doc.setTextColor(4, 120, 87);
    doc.text("SELLO OFICIAL", sealCx, sealCy - 1.5, { align: 'center' });
    doc.setFontSize(4.8);
    doc.setTextColor(5, 150, 105);
    doc.text("DE EMPRESA", sealCx, sealCy + 2.5, { align: 'center' });

    // Firma de Dirección
    const sigX = 202;
    const sigY = boxY + 34;
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.3);
    doc.line(sigX, sigY, sigX + 50, sigY);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(companyName, sigX + 25, sigY + 4.5, { align: 'center' });
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Dirección de Sostenibilidad", sigX + 25, sigY + 8, { align: 'center' });

    // Metadatos
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Emisión: ${issueDate}`, 150, boxY + 53);
    doc.text(`Código Validación: ${certId.slice(-8)}`, 255, boxY + 53, { align: 'right' });

    // --- F. PIE DE PÁGINA AUDITABLE ---
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(16, 178, 263.4, 178);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Este certificado auditable valida que los materiales fueron clasificados y procesados mediante métodos de reciclaje ecológicos.", 16, 183);

    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(5, 150, 105);
    doc.text("Página 1 de 1 • Certificado Ecológico Oficial", 263.4, 183, { align: 'right' });

    // 7. Exportación y Descarga Multiplataforma (Copiado de la lógica de pdf-utils.js)
    const filename = `Certificado_Impacto_${(targetClient || 'General').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

    let base64Data = '';
    try {
        base64Data = doc.output('datauristring').split(',')[1] || '';
    } catch (_) {}

    // PUENTE NATIVO WINDOWS / MAUI WEBVIEW2
    if (window.chrome && window.chrome.webview) {
        try {
            window.chrome.webview.postMessage(JSON.stringify({
                action: 'download',
                filename: filename,
                data: base64Data
            }));
            if (typeof showToast === 'function') showToast('✅ Certificado enviado a descargas', 'success');
            if (onSuccess) onSuccess(doc.output('blob'));
            return;
        } catch (e) {
            console.warn('WebView bridge error:', e);
        }
    }

    // DESCARGA ESTÁNDAR
    try {
        doc.save(filename);
        if (typeof showToast === 'function') showToast('✅ Certificado PDF descargado con éxito', 'success');
        if (onSuccess) onSuccess(doc.output('blob'));
    } catch (err) {
        console.error('Error guardando PDF:', err);
        if (typeof showToast === 'function') showToast('❌ Error al guardar el certificado PDF', 'error');
        if (onError) onError(err);
    }
}

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

// =============================================
// MODAL DE DETALLE Y REGISTRO DE CLIENTES DESDE IMPACTO AMBIENTAL
// =============================================
function openEcoClientDetailsModal(clientName, clientNit = '', clientType = 'persona') {
  closeEcoClientDetailsModal();

  const registeredClients = typeof getClients === 'function' ? getClients() : [];
  const existingClient = registeredClients.find(rc => (rc.name || '').trim().toLowerCase() === (clientName || '').trim().toLowerCase());

  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'eco-client-modal-overlay';
  modalOverlay.className = 'modal-overlay';
  modalOverlay.onclick = (e) => { if (e.target === modalOverlay) closeEcoClientDetailsModal(); };

  let modalBodyContent = '';

  if (existingClient) {
    // EL CLIENTE YA EXISTE EN EL DIRECTORIO: El formulario NO aparece
    modalBodyContent = `
      <div class="modal" style="max-width: 500px; width: 90%;">
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h3 class="modal-title" style="margin:0; font-size:1.1rem; display:flex; align-items:center; gap:8px;">
            <span>👤 ${escapeHTMLString(existingClient.name)}</span>
          </h3>
          <button class="modal-close" onclick="closeEcoClientDetailsModal()" style="background:none; border:none; font-size:1.2rem; cursor:pointer; color:var(--clr-text-muted);">✕</button>
        </div>
        
        <div class="modal-body" style="padding:16px 0; display:flex; flex-direction:column; gap:14px;">
          <div style="background: rgba(16, 185, 129, 0.12); border-left: 4px solid #10b981; padding: 12px; border-radius: 6px; font-size: 0.85rem; color: var(--clr-text-main);">
            <strong style="color:#059669; display:block; margin-bottom:2px;">✓ Cliente ya registrado</strong>
            <span style="font-size:0.78rem; color:var(--clr-text-secondary);">Este cliente se encuentra guardado formalmente en el apartado de Clientes.</span>
          </div>

          <div style="background: var(--clr-surface-2); padding: 14px; border-radius: 8px; border: 1px solid var(--clr-border); display:flex; flex-direction:column; gap:8px; font-size:0.85rem;">
            <div><strong>Nombre:</strong> ${escapeHTMLString(existingClient.name)}</div>
            <div><strong>Tipo:</strong> ${existingClient.type === 'empresa' ? '🏢 Empresa' : '👤 Persona'}</div>
            <div><strong>RNC / Cédula:</strong> ${escapeHTMLString(existingClient.nit || 'No especificado')}</div>
            <div><strong>Correo Electrónico:</strong> ${escapeHTMLString(existingClient.email || 'No especificado')}</div>
            <div><strong>Dirección:</strong> ${escapeHTMLString(existingClient.address || 'No especificada')}</div>
            <div><strong>Teléfono:</strong> ${escapeHTMLString(existingClient.contact || 'No especificado')}</div>
          </div>
        </div>

        <div class="modal-footer" style="display:flex; justify-content:flex-end; padding-top:12px; border-top:1px solid var(--clr-border);">
          <button class="btn-secondary" onclick="closeEcoClientDetailsModal()">Cerrar</button>
        </div>
      </div>
    `;
  } else {
    // EL CLIENTE NO EXISTE: Aparece el formulario para RNC, Correo, Dirección y Teléfono
    modalBodyContent = `
      <div class="modal" style="max-width: 520px; width: 90%;">
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h3 class="modal-title" style="margin:0; font-size:1.1rem; display:flex; align-items:center; gap:8px;">
            <span>➕ Registrar Cliente en Directorio</span>
          </h3>
          <button class="modal-close" onclick="closeEcoClientDetailsModal()" style="background:none; border:none; font-size:1.2rem; cursor:pointer; color:var(--clr-text-muted);">✕</button>
        </div>

        <div class="modal-body" style="padding:16px 0; display:flex; flex-direction:column; gap:14px;">
          <div style="background: rgba(245, 158, 11, 0.12); border-left: 4px solid #f59e0b; padding: 12px; border-radius: 6px; font-size: 0.85rem; color: var(--clr-text-main);">
            <strong style="color:#d97706; display:block; margin-bottom:2px;">⚠️ Cliente no registrado en el directorio</strong>
            <span style="font-size:0.78rem; color:var(--clr-text-secondary);">
              Este cliente proviene de bitácoras o facturas. Completa el RNC, correo, dirección y teléfono para crearlo en el apartado de Clientes:
            </span>
          </div>

          <form id="eco-client-form" onsubmit="event.preventDefault(); submitEcoClientRegistration();" style="display:flex; flex-direction:column; gap:12px;">
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="font-weight:700; font-size:0.8rem;">Nombre del Cliente</label>
              <input id="eco-modal-name" type="text" class="form-input" value="${escapeHTMLString(clientName)}" required />
            </div>

            <div class="form-group" style="margin:0;">
              <label class="form-label" style="font-weight:700; font-size:0.8rem;">Tipo de Registro</label>
              <select id="eco-modal-type" class="form-select">
                <option value="persona" ${clientType === 'persona' ? 'selected' : ''}>👤 Persona (Particular)</option>
                <option value="empresa" ${clientType === 'empresa' ? 'selected' : ''}>🏢 Empresa (Corporativo)</option>
              </select>
            </div>

            <div class="form-group" style="margin:0;">
              <label class="form-label" style="font-weight:700; font-size:0.8rem;">RNC / Cédula / NIT</label>
              <input id="eco-modal-nit" type="text" class="form-input" placeholder="Ej. 131-XXXXX-X" value="${escapeHTMLString(clientNit || '')}" />
            </div>

            <div class="form-group" style="margin:0;">
              <label class="form-label" style="font-weight:700; font-size:0.8rem;">Correo Electrónico</label>
              <input id="eco-modal-email" type="email" class="form-input" placeholder="ejemplo@correo.com" />
            </div>

            <div class="form-group" style="margin:0;">
              <label class="form-label" style="font-weight:700; font-size:0.8rem;">Dirección</label>
              <input id="eco-modal-address" type="text" class="form-input" placeholder="Ej. Av. 27 de Febrero #10, Santo Domingo" />
            </div>

            <div class="form-group" style="margin:0;">
              <label class="form-label" style="font-weight:700; font-size:0.8rem;">Teléfono / Contacto</label>
              <input id="eco-modal-contact" type="text" class="form-input" placeholder="Ej. (809) 555-0199" />
            </div>

            <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px; padding-top:12px; border-top:1px solid var(--clr-border);">
              <button type="button" class="btn-outline" onclick="closeEcoClientDetailsModal()">Cancelar</button>
              <button type="submit" class="btn-primary" style="background:linear-gradient(135deg, #10b981, #059669); border-color:#059669;">💾 Guardar y Crear Cliente</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  modalOverlay.innerHTML = modalBodyContent;
  document.body.appendChild(modalOverlay);
}

function closeEcoClientDetailsModal() {
  const overlay = document.getElementById('eco-client-modal-overlay');
  if (overlay) overlay.remove();
}

function submitEcoClientRegistration() {
  const nameEl = document.getElementById('eco-modal-name');
  const typeEl = document.getElementById('eco-modal-type');
  const nitEl = document.getElementById('eco-modal-nit');
  const emailEl = document.getElementById('eco-modal-email');
  const addressEl = document.getElementById('eco-modal-address');
  const contactEl = document.getElementById('eco-modal-contact');

  if (!nameEl || !nameEl.value.trim()) {
    if (typeof showToast === 'function') showToast('❌ Ingresa un nombre para el cliente', 'error');
    return;
  }

  const name = nameEl.value.trim();
  const type = typeEl ? typeEl.value : 'persona';
  const nit = nitEl ? nitEl.value.trim() : '';
  const email = emailEl ? emailEl.value.trim() : '';
  const address = addressEl ? addressEl.value.trim() : '';
  const contact = contactEl ? contactEl.value.trim() : '';

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (typeof showToast === 'function') showToast('❌ Ingresa un correo electrónico válido (ejemplo@correo.com)', 'error');
    return;
  }

  if (typeof addClient === 'function') {
    addClient(name, nit, address, contact, type, false, email);
  } else {
    const clients = JSON.parse(localStorage.getItem(userKey('recim_clients')) || '[]');
    clients.push({ id: `cli-${Date.now()}`, name, nit, address, contact, email, type });
    localStorage.setItem(userKey('recim_clients'), JSON.stringify(clients));
    if (typeof showToast === 'function') showToast('✅ Cliente creado correctamente', 'success');
  }

  closeEcoClientDetailsModal();

  // Refrescar lista de Impacto Ambiental
  const invoices = typeof getAllInvoices === 'function' ? getAllInvoices() : [];
  const clients = typeof getClients === 'function' ? getClients() : [];
  window._cachedEcoClients = getEcoClientsList(clients, invoices);
  renderEcoClientCards(window._cachedEcoClients);
}

window.openEcoClientDetailsModal = openEcoClientDetailsModal;
window.closeEcoClientDetailsModal = closeEcoClientDetailsModal;
window.submitEcoClientRegistration = submitEcoClientRegistration;


