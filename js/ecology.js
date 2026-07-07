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
    // Filter by client name if provided
    if (clientName && inv.company.trim().toLowerCase() !== clientName.trim().toLowerCase()) return;
    
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

function renderEcologyPage(container) {
  const invoices = getAllInvoices();
  const stats = calculateEcoImpact(invoices);
  const clients = getClients();

  // Get unique client names from both the client list and existing invoices
  const clientNamesFromDB = clients.map(c => c.name ? c.name.trim() : '');
  const clientNamesFromInvoices = invoices.map(inv => inv.company ? inv.company.trim() : '');
  const activeClientNames = [...new Set([...clientNamesFromDB, ...clientNamesFromInvoices])].filter(Boolean).sort();

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
              ${activeClientNames.map(name => `<option value="${escapeHTMLString(name)}">${name}</option>`).join('')}
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
  `;
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

function generateEcoCertificatePDF() {
  const clientName = document.getElementById('eco-client-select').value;
  const startDate = document.getElementById('eco-start-date').value;
  const endDate = document.getElementById('eco-end-date').value;

  const invoices = getAllInvoices();
  const stats = calculateEcoImpact(invoices, clientName, startDate, endDate);

  if (stats.totalWeight === 0) {
    showToast(t('eco.toast_no_invoices'), 'error');
    return;
  }

  showToast(t('eco.toast_generating'), 'info');

  // Get current white label settings if configured
  let appName = 'Reciminsa';
  try {
    const settings = JSON.parse(localStorage.getItem(userKey('recim_settings')) || '{}');
    if (settings.companyName) appName = settings.companyName;
  } catch (_) {}

  // Formatting dates
  const formatTextDate = (dStr) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const periodText = startDate && endDate 
    ? t('eco.cert_period_desc').replace('{start}', formatTextDate(startDate)).replace('{end}', formatTextDate(endDate))
    : t('eco.cert_period_accum');

  const clientText = clientName || t('eco.cert_all_clients');

  // HTML content for Certificate with compact dimensions and flex spacing to guarantee a single page
  const htmlContent = `
    <div style="width: 800px; height: 570px; background: #ffffff; padding: 20px; box-sizing: border-box; font-family: 'Inter', sans-serif; color: #1f2937;">
      <div style="height: 100%; border: 8px double #10b981; border-radius: 12px; padding: 20px 30px; position: relative; background: #fafdfb; text-align: center; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
        
        <!-- Decorative Ornaments -->
        <div style="position: absolute; top: 12px; left: 12px; font-size: 1.2rem; color: #10b981; opacity: 0.6;">🌿</div>
        <div style="position: absolute; top: 12px; right: 12px; font-size: 1.2rem; color: #10b981; opacity: 0.6;">🌿</div>
        <div style="position: absolute; bottom: 12px; left: 12px; font-size: 1.2rem; color: #10b981; opacity: 0.6;">🌿</div>
        <div style="position: absolute; bottom: 12px; right: 12px; font-size: 1.2rem; color: #10b981; opacity: 0.6;">🌿</div>

        <!-- Upper Section -->
        <div>
          <!-- Header -->
          <div style="font-size: 0.7rem; letter-spacing: 4px; font-weight: 700; color: #047857; text-transform: uppercase; margin-top: 10px; margin-bottom: 8px;">
            ${t('eco.cert_title')}
          </div>
          
          <h1 style="font-size: 1.8rem; font-weight: 800; color: #065f46; margin: 0; font-family: Georgia, serif; letter-spacing: 1px;">
            ${t('eco.cert_recognition')}
          </h1>
          
          <div style="width: 120px; height: 3px; background: #10b981; margin: 8px auto; border-radius: 2px;"></div>

          <p style="font-size: 0.85rem; color: #4b5563; font-style: italic; margin-bottom: 8px;">
            ${t('eco.cert_given_to')}
          </p>

          <h2 style="font-size: 1.4rem; font-weight: 800; color: #111827; margin: 0 0 10px 0; border-bottom: 1px dashed #d1d5db; display: inline-block; padding-bottom: 4px; min-width: 350px; text-transform: uppercase;">
            ${clientText}
          </h2>

          <p style="font-size: 0.82rem; line-height: 1.5; color: #374151; max-width: 620px; margin: 0 auto;">
            ${t('eco.cert_desc').replace('{period}', periodText).replace('{weight}', stats.totalWeight.toFixed(1))}
          </p>
        </div>

        <!-- Middle Section: Metrics Grid -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 15px auto; width: 100%; max-width: 620px;">
          
          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
            <div style="font-size: 1.2rem; margin-bottom: 2px;">🌳</div>
            <div style="font-size: 1rem; font-weight: 800; color: #047857;">${Math.ceil(stats.treesSaved)}</div>
            <div style="font-size: 0.6rem; color: #6b7280; font-weight: 600; text-transform: uppercase;">${t('eco.trees_saved')}</div>
          </div>

          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
            <div style="font-size: 1.2rem; margin-bottom: 2px;">💧</div>
            <div style="font-size: 1rem; font-weight: 800; color: #047857;">${Math.round(stats.waterSaved).toLocaleString()} L</div>
            <div style="font-size: 0.6rem; color: #6b7280; font-weight: 600; text-transform: uppercase;">${t('eco.cert_water_saved')}</div>
          </div>

          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
            <div style="font-size: 1.2rem; margin-bottom: 2px;">⚡</div>
            <div style="font-size: 1rem; font-weight: 800; color: #047857;">${Math.round(stats.energySaved).toLocaleString()}</div>
            <div style="font-size: 0.6rem; color: #6b7280; font-weight: 600; text-transform: uppercase;">${t('eco.cert_kwh_saved')}</div>
          </div>

          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
            <div style="font-size: 1.2rem; margin-bottom: 2px;">💨</div>
            <div style="font-size: 1rem; font-weight: 800; color: #047857;">${Math.round(stats.co2Avoided).toLocaleString()} kg</div>
            <div style="font-size: 0.6rem; color: #6b7280; font-weight: 600; text-transform: uppercase;">${t('eco.co2_avoided')}</div>
          </div>

        </div>

        <!-- Lower Section -->
        <div>
          <p style="font-size: 0.68rem; color: #6b7280; line-height: 1.4; max-width: 540px; margin: 0 auto 15px auto;">
            ${t('eco.cert_footer_desc')}
          </p>

          <!-- Signature and Date info -->
          <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 0 30px; margin-bottom: 5px;">
            <div style="text-align: left;">
              <div style="font-size: 0.62rem; color: #9ca3af; text-transform: uppercase; font-weight: 600;">${t('eco.cert_issue_date')}</div>
              <div style="font-size: 0.75rem; font-weight: 700; color: #374151; margin-top: 2px;">
                ${new Date().toLocaleDateString(getSettings().language === 'en' ? 'en-US' : 'es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            </div>
            
            <div style="text-align: center; border-top: 1px solid #9ca3af; width: 160px; padding-top: 4px;">
              <div style="font-size: 0.72rem; font-weight: 700; color: #111827;">${appName}</div>
              <div style="font-size: 0.55rem; color: #6b7280; text-transform: uppercase; font-weight: 600; margin-top: 1px;">${t('eco.cert_mgmt')}</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  // Generate PDF via html2pdf using offscreen temporary wrapper for pixel accuracy
  const opt = {
    margin:       0.1, // Small margin to prevent page break issues
    filename:     `Certificado_Impacto_${clientName || 'General'}_${new Date().toISOString().split('T')[0]}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, windowWidth: 800, scrollX: 0, scrollY: 0 },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
  };

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = '800px';
  container.style.height = '0';
  container.style.overflow = 'hidden';
  container.style.zIndex = '-9999';
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);

  const wrapper = document.createElement('div');
  wrapper.style.width = '800px';
  wrapper.style.background = '#fff';
  wrapper.innerHTML = htmlContent;
  container.appendChild(wrapper);

  html2pdf().from(wrapper).set(opt).output('blob').then((pdfBlob) => {
    if (window.chrome && window.chrome.webview) {
        const reader = new FileReader();
        reader.readAsDataURL(pdfBlob);
        reader.onloadend = () => {
            const base64data = reader.result.split(',')[1];
            window.chrome.webview.postMessage(JSON.stringify({
                action: 'download',
                filename: opt.filename,
                data: base64data
            }));
            showToast(t('eco.toast_ready'), 'success');
        };
    } else {
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = opt.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
        showToast(t('eco.toast_downloaded'), 'success');
    }
  }).catch((err) => {
    console.error(err);
    showToast(t('eco.toast_error'), 'error');
  }).finally(() => {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  });
}
