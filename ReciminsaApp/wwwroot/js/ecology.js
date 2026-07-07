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
        <h2 class="section-title">🌱 Impacto medioambiental e Impacto Verde</h2>
        <p class="section-subtitle">Visualiza el ahorro de recursos naturales y genera Certificados de Impacto Medioambiental para tus clientes.</p>
      </div>
    </div>

    <!-- Overview Statistics Dashboard -->
    <div class="finance-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
      
      <div class="card card--elevated" style="border-left: 5px solid #22c55e;">
        <div style="font-size: 0.7rem; color: var(--clr-text-muted); font-weight: 700; text-transform: uppercase;">Total Reciclado</div>
        <div style="font-size: 1.8rem; font-weight: 800; color: #22c55e; margin: 8px 0;">${stats.totalWeight.toFixed(1)} <span style="font-size:0.9rem;">kg</span></div>
        <p style="font-size: 0.72rem; color: var(--clr-text-muted); margin:0;">Materia prima devuelta al ciclo productivo.</p>
      </div>

      <div class="card card--elevated" style="border-left: 5px solid #10b981;">
        <div style="font-size: 0.7rem; color: var(--clr-text-muted); font-weight: 700; text-transform: uppercase;">Árboles Salvados</div>
        <div style="font-size: 1.8rem; font-weight: 800; color: #10b981; margin: 8px 0;">🌳 ${Math.ceil(stats.treesSaved)}</div>
        <p style="font-size: 0.72rem; color: var(--clr-text-muted); margin:0;">Evita la deforestación de bosques.</p>
      </div>

      <div class="card card--elevated" style="border-left: 5px solid #3b82f6;">
        <div style="font-size: 0.7rem; color: var(--clr-text-muted); font-weight: 700; text-transform: uppercase;">Agua Conservada</div>
        <div style="font-size: 1.8rem; font-weight: 800; color: #3b82f6; margin: 8px 0;">💧 ${Math.round(stats.waterSaved).toLocaleString()} <span style="font-size:0.9rem;">L</span></div>
        <p style="font-size: 0.72rem; color: var(--clr-text-muted); margin:0;">Equivale a <strong>${Math.ceil(stats.waterSaved / 19)}</strong> botellones de agua.</p>
      </div>

      <div class="card card--elevated" style="border-left: 5px solid #fbbf24;">
        <div style="font-size: 0.7rem; color: var(--clr-text-muted); font-weight: 700; text-transform: uppercase;">Energía Ahorrada</div>
        <div style="font-size: 1.8rem; font-weight: 800; color: #fbbf24; margin: 8px 0;">⚡ ${Math.round(stats.energySaved).toLocaleString()} <span style="font-size:0.9rem;">kWh</span></div>
        <p style="font-size: 0.72rem; color: var(--clr-text-muted); margin:0;">Hogar encendido por <strong>${Math.ceil(stats.energySaved / 6)}</strong> días.</p>
      </div>

      <div class="card card--elevated" style="border-left: 5px solid #ec4899;">
        <div style="font-size: 0.7rem; color: var(--clr-text-muted); font-weight: 700; text-transform: uppercase;">CO2 Evitado</div>
        <div style="font-size: 1.8rem; font-weight: 800; color: #ec4899; margin: 8px 0;">💨 ${Math.round(stats.co2Avoided).toLocaleString()} <span style="font-size:0.9rem;">kg</span></div>
        <p style="font-size: 0.72rem; color: var(--clr-text-muted); margin:0;">Reducción de huella de carbono directa.</p>
      </div>
    </div>

    <!-- Charts & Certificate Panel Grid -->
    <div class="finance-grid" style="grid-template-columns: 1fr 1fr; gap: 20px;">
      
      <!-- Left side: Material distribution & progress chart -->
      <div class="card card--elevated">
        <h3 class="section-title" style="margin-bottom: 16px; font-size: 1.05rem;">📦 Distribución de Materiales</h3>
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${renderMaterialProgressRow('Cartón / Papel', stats.paperWeight, stats.totalWeight, '#fbbf24')}
          ${renderMaterialProgressRow('Plásticos', stats.plasticWeight, stats.totalWeight, '#10b981')}
          ${renderMaterialProgressRow('Metales (Aluminio/Cobre/Hierro)', stats.metalWeight, stats.totalWeight, '#ef4444')}
          ${renderMaterialProgressRow('Vidrio', stats.glassWeight, stats.totalWeight, '#3b82f6')}
          ${renderMaterialProgressRow('Otros / Mezclados', stats.otherWeight, stats.totalWeight, '#6b7280')}
        </div>
        
        <div style="margin-top: 24px; padding: 12px; background: var(--clr-surface-3); border-radius: var(--r-md); font-size:0.78rem; line-height: 1.4; color: var(--clr-text-secondary);">
          🌳 <strong>Sabías que:</strong> Reciclar 1,000 kg de papel salva 17 árboles maduros y ahorra suficiente energía para mantener encendida una bombilla LED estándar durante más de 40 años seguidos.
        </div>
      </div>

      <!-- Right side: Green certificate generator -->
      <div class="card card--elevated">
        <h3 class="section-title" style="margin-bottom: 8px; font-size: 1.05rem;">📄 Generador de Certificado de Impacto Medioambiental</h3>
        <p style="font-size:0.75rem; color:var(--clr-text-muted); margin-bottom: 16px;">
          Emite certificados oficiales de impacto verde para tus clientes corporativos o particulares para sus auditorías RSE.
        </p>

        <div style="display:flex; flex-direction:column; gap:14px;">
          <div class="form-group">
            <label class="form-label">Seleccionar Cliente/Empresa</label>
            <select id="eco-client-select" class="form-select">
              <option value="">-- Todos los Clientes (General) --</option>
              ${activeClientNames.map(name => `<option value="${escapeHTMLString(name)}">${name}</option>`).join('')}
            </select>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div class="form-group">
              <label class="form-label">Fecha Inicio</label>
              <input type="date" id="eco-start-date" class="form-input" value="${new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]}" />
            </div>
            <div class="form-group">
              <label class="form-label">Fecha Fin</label>
              <input type="date" id="eco-end-date" class="form-input" value="${new Date().toISOString().split('T')[0]}" />
            </div>
          </div>

          <button class="btn-primary" onclick="generateEcoCertificatePDF()" style="background: linear-gradient(135deg, #10b981, #059669); border-color: #059669; color: white; justify-content: center; gap: 8px; margin-top: 10px; font-weight: 700;">
            🌱 Generar Certificado PDF
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
    showToast('❌ No se encontraron facturas o impactos medioambientales registrados en el periodo seleccionado.', 'error');
    return;
  }

  // Get current white label settings if configured
  let appName = 'Reciminsaap';
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
    ? `desde el ${formatTextDate(startDate)} hasta el ${formatTextDate(endDate)}`
    : 'histórico acumulado';

  const clientText = clientName || 'NUESTROS CLIENTES Y COLABORADORES';

  // HTML content for Certificate
  const htmlContent = `
    <div style="width: 1056px; height: 816px; background: #ffffff; padding: 50px; box-sizing: border-box; font-family: 'Inter', sans-serif; color: #1f2937; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
      <div style="width: 100%; height: 100%; border: 8px double #10b981; border-radius: 12px; padding: 40px 60px; position: relative; background: #fafdfb; text-align: center; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
        
        <!-- Decorative Ornaments -->
        <div style="position: absolute; top: 20px; left: 20px; font-size: 1.8rem; color: #10b981; opacity: 0.6;">🌿</div>
        <div style="position: absolute; top: 20px; right: 20px; font-size: 1.8rem; color: #10b981; opacity: 0.6;">🌿</div>
        <div style="position: absolute; bottom: 20px; left: 20px; font-size: 1.8rem; color: #10b981; opacity: 0.6;">🌿</div>
        <div style="position: absolute; bottom: 20px; right: 20px; font-size: 1.8rem; color: #10b981; opacity: 0.6;">🌿</div>

        <!-- Top Block (Header, Title, Line) -->
        <div>
          <div style="font-size: 0.8rem; letter-spacing: 5px; font-weight: 700; color: #047857; text-transform: uppercase; margin-top: 10px; margin-bottom: 15px;">
            Certificado de Impacto medioambiental
          </div>
          <h1 style="font-size: 2.8rem; font-weight: 800; color: #065f46; margin: 0 0 10px 0; font-family: Georgia, serif;">
            RECONOCIMIENTO VERDE
          </h1>
          <div style="width: 200px; height: 4px; background: #10b981; margin: 15px auto; border-radius: 2px;"></div>
        </div>

        <!-- Middle Block (Recipient, Text) -->
        <div>
          <p style="font-size: 1.1rem; color: #4b5563; font-style: italic; margin: 0 0 12px 0;">
            Otorgado con orgullo y gratitud a:
          </p>
          <h2 style="font-size: 2.2rem; font-weight: 800; color: #111827; margin: 0 0 20px 0; border-bottom: 2px dashed #d1d5db; display: inline-block; padding-bottom: 8px; min-width: 500px; letter-spacing: 1px;">
            ${clientText.toUpperCase()}
          </h2>
          <p style="font-size: 1.05rem; line-height: 1.6; color: #374151; max-width: 720px; margin: 0 auto;">
            Por su valiosa contribución al cuidado de nuestro planeta a través del reciclaje de materiales y desechos sólidos ${periodText}, procesando un total de <strong>${stats.totalWeight.toFixed(1)} kg</strong> de residuos aprovechables.
          </p>
        </div>

        <!-- Eco metrics grid -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px auto; width: 100%; max-width: 760px;">
          
          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
            <div style="font-size: 2rem; margin-bottom: 6px;">🌳</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: #047857;">${Math.ceil(stats.treesSaved)}</div>
            <div style="font-size: 0.72rem; color: #6b7280; font-weight: 700; text-transform: uppercase; margin-top: 4px;">Árboles Salvados</div>
          </div>

          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
            <div style="font-size: 2rem; margin-bottom: 6px;">💧</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: #047857;">${Math.round(stats.waterSaved).toLocaleString()} L</div>
            <div style="font-size: 0.72rem; color: #6b7280; font-weight: 700; text-transform: uppercase; margin-top: 4px;">Agua Ahorrada</div>
          </div>

          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
            <div style="font-size: 2rem; margin-bottom: 6px;">⚡</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: #047857;">${Math.round(stats.energySaved).toLocaleString()}</div>
            <div style="font-size: 0.72rem; color: #6b7280; font-weight: 700; text-transform: uppercase; margin-top: 4px;">kWh Ahorrados</div>
          </div>

          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
            <div style="font-size: 2rem; margin-bottom: 6px;">💨</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: #047857;">${Math.round(stats.co2Avoided).toLocaleString()} kg</div>
            <div style="font-size: 0.72rem; color: #6b7280; font-weight: 700; text-transform: uppercase; margin-top: 4px;">CO2 Evitado</div>
          </div>

        </div>

        <!-- Footer / ODS Text -->
        <p style="font-size: 0.8rem; color: #6b7280; line-height: 1.5; max-width: 650px; margin: 0 auto;">
          Este impacto medioambiental contribuye directamente a los Objetivos de Desarrollo Sostenible (ODS) y mitiga la degradación de recursos naturales vitales de nuestra región.
        </p>

        <!-- Signature Spot -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 0 40px; margin-bottom: 10px;">
          <div style="text-align: left;">
            <div style="font-size: 0.75rem; color: #9ca3af; text-transform: uppercase; font-weight: 600;">Fecha de Emisión</div>
            <div style="font-size: 0.9rem; font-weight: 700; color: #374151; margin-top: 4px;">${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
          </div>
          
          <div style="text-align: center; border-top: 1px solid #9ca3af; width: 220px; padding-top: 8px;">
            <div style="font-size: 0.9rem; font-weight: 700; color: #111827;">${appName}</div>
            <div style="font-size: 0.68rem; color: #6b7280; text-transform: uppercase; font-weight: 600; margin-top: 2px;">Gestión de Reciclaje</div>
          </div>
        </div>

      </div>
    </div>
  `;

  // Generate PDF via html2pdf
  const opt = {
    margin:       0,
    filename:     `Certificado_Impacto_${clientName || 'General'}_${new Date().toISOString().split('T')[0]}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
  };

  html2pdf().from(htmlContent).set(opt).output('blob').then((pdfBlob) => {
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
            showToast('✅ Certificado abierto en tu programa predeterminado', 'success');
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
        showToast('✅ Certificado descargado con éxito', 'success');
    }
  }).catch((err) => {
    console.error(err);
    showToast('❌ Error al generar el PDF del certificado', 'error');
  });
}
