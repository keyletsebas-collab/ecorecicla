/* =============================================
   PRICES.JS – Material Price Index & Neon Historic Trends Chart
   Depends on: materials.js, i18n.js, app.js
   ============================================= */

function getMaterialName(matCode, fallbackName) {
  const key = `mat.name_${matCode.toLowerCase()}`;
  const val = t(key);
  if (val !== key) return val;
  return fallbackName || matCode;
}

// Default historic prices (last 6 months: Jan - Jun) for visual analysis
const HISTORIC_PRICES_MOCK = {
  'CART':   [5.2, 5.0, 4.8, 4.5, 4.6, 4.9],
  'PLAS':   [10.5, 11.2, 11.0, 11.5, 12.2, 12.8],
  'VIDRIO': [2.1, 2.0, 2.0, 2.1, 2.0, 2.1],
  'ALUM':   [72.0, 70.5, 68.0, 65.0, 62.5, 60.0],
  'COBR':   [240.0, 248.0, 255.0, 262.0, 270.0, 285.0],
  'HIER':   [9.5, 9.2, 8.8, 8.5, 8.7, 8.6],
  'PAPE':   [7.5, 7.2, 6.8, 6.5, 6.2, 5.9],
  'ELEC':   [38.0, 37.5, 37.0, 36.8, 37.2, 37.0]
};

const TRENDS_DATA_KEY = 'recim_market_prices';

function getMarketPrices() {
  const local = localStorage.getItem(userKey(TRENDS_DATA_KEY));
  if (local) return JSON.parse(local);

  // Default current prices if not configured
  const defaults = {
    'CART':   { code: 'CART',   name: 'Cartón',       purchase: 4.50,  sell: 6.80,  trend: 'up' },
    'PLAS':   { code: 'PLAS',   name: 'Plástico',     purchase: 12.00, sell: 18.50, trend: 'up' },
    'VIDRIO': { code: 'VIDRIO', name: 'Vidrio',       purchase: 2.00,  sell: 3.50,  trend: 'stable' },
    'ALUM':   { code: 'ALUM',   name: 'Aluminio',     purchase: 45.00, sell: 60.00, trend: 'down' },
    'COBR':   { code: 'COBR',   name: 'Cobre',        purchase: 220.0, sell: 285.0, trend: 'up' },
    'HIER':   { code: 'HIER',   name: 'Hierro/Acero', purchase: 8.00,  sell: 11.50, trend: 'stable' },
    'PAPE':   { code: 'PAPE',   name: 'Papel blanco', purchase: 5.50,  sell: 8.50,  trend: 'down' },
    'ELEC':   { code: 'ELEC',   name: 'Electrónicos', purchase: 35.00, sell: 50.00, trend: 'stable' }
  };
  localStorage.setItem(userKey(TRENDS_DATA_KEY), JSON.stringify(defaults));
  return defaults;
}

function saveMarketPrices(prices) {
  localStorage.setItem(userKey(TRENDS_DATA_KEY), JSON.stringify(prices));
}

let activePriceChartCode = 'PLAS'; // Default material selected for trend view

function renderPricesPage(container) {
  const prices = getMarketPrices();
  const materials = getMaterialCodes(); // from materials.js

  // Filter prices to match materials currently active in settings
  const priceList = materials.map(mat => {
    if (prices[mat.code]) {
      return { ...mat, ...prices[mat.code] };
    }
    // Fallback default values for custom created codes
    return {
      ...mat,
      purchase: 5.00,
      sell: 8.00,
      trend: 'stable'
    };
  });

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="section-title">${t('prc.title')}</h2>
        <p class="section-subtitle">${t('prc.subtitle')}</p>
      </div>
    </div>

    <div class="finance-grid" style="grid-template-columns: 1.1fr 0.9fr; gap: 20px;">
      
      <!-- Left side: Price list and settings -->
      <div class="card card--elevated" style="padding: 18px;">
        <h3 class="section-title" style="margin-bottom: 12px; font-size: 1.05rem;">${t('prc.table_title')}</h3>
        <p style="font-size:0.75rem; color:var(--clr-text-muted); margin-bottom:16px;">
          ${t('prc.table_desc')}
        </p>

        <div style="display:flex; flex-direction:column; gap:8px; max-height: 480px; overflow-y:auto; padding-right:4px;">
          ${priceList.map(mat => {
            const isSelected = mat.code === activePriceChartCode;
            const trendLabel = mat.trend === 'up' ? t('prc.trend_up') : (mat.trend === 'down' ? t('prc.trend_down') : t('prc.trend_stable'));
            const trendColor = mat.trend === 'up' ? '#22c55e' : (mat.trend === 'down' ? '#ef4444' : '#fbbf24');
            const displayName = getMaterialName(mat.code, mat.name);
            
            return `
              <div style="display:flex; justify-content:space-between; align-items:center; background:${isSelected ? 'var(--clr-primary-glow)' : 'var(--clr-surface-2)'}; border:1px solid ${isSelected ? 'var(--clr-primary)' : 'var(--clr-border)'}; border-radius:12px; padding:12px 14px; cursor:pointer; transition:all 0.2s;" onclick="selectTrendMaterial('${mat.code}')">
                <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                  <span style="font-size:1.4rem; flex-shrink:0;">${mat.icon || '♻️'}</span>
                  <div style="min-width:0;">
                    <strong style="font-size:0.85rem; color:white; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block;">${displayName}</strong>
                    <span style="font-size:0.72rem; color:var(--clr-text-muted); font-family:monospace; font-weight:700;">${mat.code}</span>
                  </div>
                </div>
                
                <div style="display:flex; align-items:center; gap:20px;">
                  <div style="text-align:right;">
                    <div style="font-size:0.65rem; color:var(--clr-text-muted); text-transform:uppercase; font-weight:700;">${t('prc.buy_sell')}</div>
                    <strong style="font-size:0.82rem; color:white; font-family:monospace;">
                      ${formatMoney(mat.purchase)} / ${formatMoney(mat.sell)}
                    </strong>
                  </div>
                  <span style="font-size:0.72rem; color:${trendColor}; font-weight:700; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:4px 8px; border-radius:8px; white-space:nowrap;">
                    ${trendLabel}
                  </span>
                  <button class="btn-secondary" style="padding: 4px 8px; font-size:0.72rem; margin:0;" onclick="openEditPriceModal('${mat.code}', '${escapeHTMLString(displayName)}', ${mat.purchase}, ${mat.sell}, '${mat.trend}', event)">
                    ${t('prc.edit_btn')}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Right side: Trend line charts and recommendations -->
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <!-- Live Neon Chart Container -->
        <div class="card card--elevated" style="padding:18px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3 class="section-title" style="font-size: 1.05rem;" id="trend-chart-title"></h3>
            <span style="font-size: 0.72rem; color: var(--clr-primary); font-weight: 700; text-transform: uppercase;">${t('prc.history_title')}</span>
          </div>

          <!-- Chart Canvas Frame -->
          <div style="background:#09130e; border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 12px; padding: 12px; position:relative; overflow:hidden;">
            <canvas id="trend-line-canvas" width="320" height="180" style="width:100%; display:block;"></canvas>
            <div id="chart-tooltip" style="display:none; position:absolute; z-index:100; pointer-events:none; background:rgba(13,23,17,0.95); border:1px solid var(--clr-primary); border-radius:6px; padding:4px 8px; font-size:0.7rem; color:white; font-family:monospace; font-weight:700;"></div>
          </div>
        </div>

        <!-- Smart Advisory Box -->
        <div class="card card--elevated" style="border-left:5px solid #22c55e;" id="trend-advisor-box"></div>
      </div>
    </div>

    <!-- Edit Price Modal Overlay -->
    <div id="price-edit-modal" class="modal-overlay" style="display:none; z-index: 1020;">
      <div class="modal" style="max-width: 320px; padding: 20px;">
        <h3 class="section-title" id="price-modal-title" style="margin-bottom: 15px;">${t('prc.edit_title')}</h3>
        <div style="display:flex; flex-direction:column; gap:12px;">
          <input type="hidden" id="edit-price-code" />
          <div class="form-group">
            <label class="form-label">${t('prc.edit_buy').replace('{symbol}', getCurrency().symbol)}</label>
            <input type="number" id="edit-price-purchase" class="form-input" min="0" step="0.01" />
          </div>
          <div class="form-group">
            <label class="form-label">${t('prc.edit_sell').replace('{symbol}', getCurrency().symbol)}</label>
            <input type="number" id="edit-price-sell" class="form-input" min="0" step="0.01" />
          </div>
          <div class="form-group">
            <label class="form-label">${t('prc.recent_trend')}</label>
            <select id="edit-price-trend" class="form-select">
              <option value="up">${t('prc.trend_up_opt')}</option>
              <option value="stable">${t('prc.trend_stable_opt')}</option>
              <option value="down">${t('prc.trend_down_opt')}</option>
            </select>
          </div>
          <div style="display:flex; gap:8px; margin-top:10px;">
            <button class="btn-primary" onclick="saveEditedPrice()" style="flex:1; justify-content:center;">${t('btn.save')}</button>
            <button class="btn-secondary" onclick="closeEditPriceModal()" style="flex:1; justify-content:center; margin:0;">${t('pdf.cancel_btn')}</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Draw chart for selected material immediately
  initTrendLineChart();
}

function selectTrendMaterial(code) {
  activePriceChartCode = code;
  
  // Refresh page container to highlight selection
  const page = document.getElementById('page-precios');
  if (page) renderPricesPage(page);
}

function openEditPriceModal(code, name, purchase, sell, trend, event) {
  if (event) event.stopPropagation();

  document.getElementById('edit-price-code').value = code;
  document.getElementById('price-modal-title').textContent = `Cotización: ${name}`;
  document.getElementById('edit-price-purchase').value = purchase;
  document.getElementById('edit-price-sell').value = sell;
  document.getElementById('edit-price-trend').value = trend;

  document.getElementById('price-edit-modal').style.display = 'flex';
}

function closeEditPriceModal() {
  document.getElementById('price-edit-modal').style.display = 'none';
}

function saveEditedPrice() {
  const code = document.getElementById('edit-price-code').value;
  const purchase = parseFloat(document.getElementById('edit-price-purchase').value) || 0;
  const sell = parseFloat(document.getElementById('edit-price-sell').value) || 0;
  const trend = document.getElementById('edit-price-trend').value;

  const prices = getMarketPrices();
  prices[code] = {
    code,
    name: prices[code] ? prices[code].name : code,
    purchase,
    sell,
    trend
  };

  saveMarketPrices(prices);
  closeEditPriceModal();
  showToast(t('prc.toast_saved'), 'success');

  // Rerender page view
  const page = document.getElementById('page-precios');
  if (page) renderPricesPage(page);
}

// ---- Historic Canvas Neon Chart Drawer ----
function initTrendLineChart() {
  const canvas = document.getElementById('trend-line-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const code = activePriceChartCode;
  
  const prices = getMarketPrices();
  const materialInfo = prices[code];
  const matName = materialInfo ? materialInfo.name : code;
  const displayName = getMaterialName(code, matName);
  
  // Update header title
  const title = document.getElementById('trend-chart-title');
  if (title) title.textContent = t('prc.chart_title').replace('{name}', displayName);

  // Get mock history or generate random path for custom created codes
  let history = HISTORIC_PRICES_MOCK[code];
  if (!history) {
    // Generate synthetic stable trend matching the current purchase price
    const base = materialInfo ? materialInfo.purchase : 5.0;
    history = [
      base * 0.95,
      base * 0.98,
      base * 0.96,
      base * 1.02,
      base * 1.0,
      base
    ];
  }

  // Draw advisor recommendation
  drawTrendAdvisor(materialInfo, history);

  // Canvas drawing dimensions
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const months = [
    t('hist.month_01').substring(0, 3),
    t('hist.month_02').substring(0, 3),
    t('hist.month_03').substring(0, 3),
    t('hist.month_04').substring(0, 3),
    t('hist.month_05').substring(0, 3),
    t('hist.month_06').substring(0, 3)
  ];
  
  // Margins
  const paddingX = 40;
  const paddingY = 25;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  // Min and Max values of price history to scale line
  const minVal = Math.min(...history) * 0.9;
  const maxVal = Math.max(...history) * 1.1;
  const valRange = maxVal - minVal;

  // Draw Grid Lines (Y axis milestones)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const yVal = minVal + (valRange / 3) * i;
    const yPos = height - paddingY - (chartHeight / 3) * i;
    
    // Line
    ctx.beginPath();
    ctx.moveTo(paddingX, yPos);
    ctx.lineTo(width - paddingX, yPos);
    ctx.stroke();

    // Text label
    ctx.fillStyle = '#6b7b6b';
    ctx.font = '7px monospace';
    ctx.fillText(`RD$${yVal.toFixed(1)}`, 4, yPos + 3);
  }

  // Map coordinate nodes [x, y]
  const points = history.map((val, idx) => {
    const x = paddingX + (chartWidth / 5) * idx;
    const y = height - paddingY - ((val - minVal) / valRange) * chartHeight;
    return { x, y, val, month: months[idx] };
  });

  // Draw Chart Neon Gradient Underlay (shaded green area below line)
  const grad = ctx.createLinearGradient(0, paddingY, 0, height - paddingY);
  grad.addColorStop(0, 'rgba(34, 197, 94, 0.25)');
  grad.addColorStop(1, 'rgba(34, 197, 94, 0.0)');
  
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(points[0].x, height - paddingY);
  
  // Trace curved boundary path for fill
  for (let i = 0; i < points.length; i++) {
    if (i === 0) {
      ctx.lineTo(points[i].x, points[i].y);
    } else {
      const prev = points[i-1];
      const cpX1 = prev.x + (points[i].x - prev.x) / 2;
      const cpY1 = prev.y;
      const cpX2 = prev.x + (points[i].x - prev.x) / 2;
      const cpY2 = points[i].y;
      ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, points[i].x, points[i].y);
    }
  }
  ctx.lineTo(points[points.length - 1].x, height - paddingY);
  ctx.closePath();
  ctx.fill();

  // Draw Line Curve Core (Neon Green Solid Core)
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 3;
  ctx.shadowColor = 'rgba(34, 197, 94, 0.5)';
  ctx.shadowBlur = 8;
  
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    if (i === 0) {
      ctx.moveTo(points[i].x, points[i].y);
    } else {
      const prev = points[i-1];
      const cpX1 = prev.x + (points[i].x - prev.x) / 2;
      const cpY1 = prev.y;
      const cpX2 = prev.x + (points[i].x - prev.x) / 2;
      const cpY2 = points[i].y;
      ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, points[i].x, points[i].y);
    }
  }
  ctx.stroke();

  // Reset shadow effects to keep rest of elements sharp
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Draw interactive dots & X labels
  points.forEach((pt, idx) => {
    // Circle Node
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    // X Axis Months label
    ctx.fillStyle = '#6b7b6b';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pt.month, pt.x, height - 10);
  });

  // Track hover/mouse move to show interactive tooltips
  setupCanvasInteractiveTooltip(canvas, points);
}

function drawTrendAdvisor(info, history) {
  const advisor = document.getElementById('trend-advisor-box');
  if (!advisor) return;

  const current = history[history.length - 1];
  const prev = history[history.length - 2] || current;
  const pctChange = prev > 0 ? ((current - prev) / prev) * 100 : 0;
  
  const trend = info ? info.trend : 'stable';
  
  let icon = '⚖️';
  let title = t('prc.advisory_stable_title');
  let text = t('prc.advisory_stable_text');
  let border = '5px solid #fbbf24';
  let color = '#fbbf24';

  if (trend === 'up') {
    icon = '📈';
    title = t('prc.advisory_up_title').replace('{change}', pctChange.toFixed(1));
    text = t('prc.advisory_up_text');
    border = '5px solid #22c55e';
    color = '#22c55e';
  } else if (trend === 'down') {
    icon = '📉';
    title = t('prc.advisory_down_title').replace('{change}', pctChange.toFixed(1));
    text = t('prc.advisory_down_text');
    border = '5px solid #ef4444';
    color = '#ef4444';
  }

  advisor.style.borderLeft = border;
  advisor.innerHTML = `
    <h3 class="section-title" style="font-size: 0.95rem; color:${color}; display:flex; align-items:center; gap:8px; margin-bottom:8px;">
      <span>${icon}</span>
      <span>${title}</span>
    </h3>
    <p style="font-size:0.78rem; line-height:1.4; color:var(--clr-text-secondary); margin:0;">
      ${text}
    </p>
  `;
}

function setupCanvasInteractiveTooltip(canvas, points) {
  const tooltip = document.getElementById('chart-tooltip');
  if (!tooltip) return;

  canvas.onmousemove = function(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Scale factor between CSS layout and raw Canvas resolution
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const mouseX = x * scaleX;
    const mouseY = y * scaleY;

    // Find nearest point along horizontal axis
    let nearest = null;
    let minDist = 30; // Max hover distance threshold
    
    points.forEach(pt => {
      const d = Math.abs(pt.x - mouseX);
      if (d < minDist) {
        minDist = d;
        nearest = pt;
      }
    });

    if (nearest) {
      const containerRect = canvas.offsetParent.getBoundingClientRect();
      const ptLeft = (nearest.x / canvas.width) * rect.width;
      const ptTop = (nearest.y / canvas.height) * rect.height;

      tooltip.style.display = 'block';
      tooltip.style.left = `${ptLeft - 25}px`;
      tooltip.style.top = `${ptTop - 35}px`;
      tooltip.innerHTML = `${nearest.month}: RD$${nearest.val.toFixed(2)}`;
    } else {
      tooltip.style.display = 'none';
    }
  };

  canvas.onmouseleave = function() {
    tooltip.style.display = 'none';
  };
}
