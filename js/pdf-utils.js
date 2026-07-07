/* =============================================
   PDF-UTILS.JS – Generación de PDF Global
   ============================================= */

function getBasicaHTML(invoice) {
    const itemRows = (invoice.items || []).map(item => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding:10px;">${item.icon || '📦'} ${item.name}</td>
      <td style="padding:10px;">${item.qty} ${item.unit}</td>
      <td style="padding:10px;">${formatMoney(item.priceBuy || 0)}</td>
      <td style="padding:10px; text-align:right; font-weight:bold;">${formatMoney(item.totalCompra || 0)}</td>
    </tr>`).join('');

    const detailRows = `<p><b>Cliente:</b> ${invoice.client || '—'}</p>`;

    const totalsSection = `
    <div style="border-top: 2px solid #e2e8f0; padding-top:10px; margin-top:12px;">
      <div style="display:flex; justify-content:space-between; padding:5px 0;">
        <span class="invoice-summary-label">Total Compra</span>
        <span class="invoice-summary-value" style="color:#f87171;">-${formatMoney(invoice.totalCompra)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; padding:10px 0; font-size:1.2rem; font-weight:bold; color:#3b82f6;">
        <span class="invoice-summary-label">Balance Neto</span>
        <span class="invoice-summary-value" style="color:${invoice.balance >= 0 ? '#3b82f6' : '#f87171'}">${formatMoney(invoice.balance)}</span>
      </div>
    </div>`;

    return `
    <div style="padding: 20px; font-family: sans-serif; color: #1e293b; background: white; width: 100%; box-sizing: border-box;">
      <div style="text-align:center; padding-bottom:20px; border-bottom:2px solid #3b82f6; margin-bottom:20px;">
         <h1 style="color:#3b82f6; margin:0;">RECIMINSA</h1>
         <p style="margin:5px 0;">Gestión de Materiales Reciclables</p>
         <h2 style="margin:15px 0 5px 0;">FACTURA BÁSICA</h2>
         <p>ID: ${invoice.id} | Fecha: ${invoice.date}</p>
      </div>
      ${detailRows}
      <div style="margin-top:10px;">
        <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <th style="text-align:left; padding:10px;">Descripción</th>
              <th style="text-align:left; padding:10px;">Cant.</th>
              <th style="text-align:left; padding:10px;">P.Unit</th>
              <th style="text-align:right; padding:10px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>
      </div>
      ${totalsSection}
      ${invoice.notes ? `<div style="margin-top:20px; padding:10px; background:#f8fafc; border-radius:4px; font-size:0.85rem;">📝 <b>Notas:</b> ${invoice.notes}</div>` : ''}
    </div>
  `;
}
function getNormalHTML(invoice) {
    const isEmpresa = invoice.type === 'empresa';
    let title = 'FACTURA COMERCIAL';
    if (isEmpresa && invoice.ncf) {
        const cleanNcf = invoice.ncf.toUpperCase();
        if (cleanNcf.startsWith('B02')) {
            title = 'FACTURA DE CONSUMO';
        } else if (cleanNcf.startsWith('B14')) {
            title = 'FACTURA DE RÉGIMEN ESPECIAL';
        } else if (cleanNcf.startsWith('B15')) {
            title = 'FACTURA GUBERNAMENTAL';
        } else {
            title = 'FACTURA DE CRÉDITO FISCAL';
        }
    }

    const itemsHtml = (invoice.items || []).map(item => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px; color: #374151;">${item.qty} ${item.unit || ''}</td>
      <td style="padding: 10px; color: #111827; font-weight: 500;">${item.desc || item.name}</td>
      <td style="padding: 10px; text-align:right; color: #374151;">${formatMoney(item.uprice || item.priceSell || 0)}</td>
      <td style="padding: 10px; text-align:right; color: #111827; font-weight: 600;">${formatMoney(item.subtotal || item.totalVenta || 0)}</td>
    </tr>
    `).join('');

    // Leer configuraciones de marca blanca
    const settings = JSON.parse(localStorage.getItem('recim_settings') || '{}');
    const customCompanyName = settings.companyName || 'RECIMINSA';
    const customCompanyRNC = settings.companyRNC ? `<p style="margin:2px 0; font-size: 14px; color: #666;"><strong>RNC:</strong> ${settings.companyRNC}</p>` : '';
    const customCompanyLogo = settings.companyLogo 
      ? `<img src="${settings.companyLogo}" style="max-width: 180px; max-height: 70px; object-fit: contain;" />` 
      : `<img src="logo-no-white-lines.png" style="max-width: 180px; max-height: 70px; object-fit: contain; border-radius: 6px;" />`;

    return `
    <div style="box-sizing: border-box; width: 100%; font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px 30px; color: #333; background: #fff;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; border-bottom: 2px solid #22c55e; padding-bottom: 20px;">
        <tr>
          <td style="vertical-align: middle; text-align: left; padding-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 20px;">
              ${customCompanyLogo}
              <div>
                <h1 style="margin: 0; font-size: 28px; color: #15803d; font-weight: 700; line-height: 1.2;">${customCompanyName}</h1>
                ${customCompanyRNC}
                <p style="margin: 4px 0 0 0; font-size: 14px; color: #666; font-weight: 500;">Gestión de Reciclaje</p>
              </div>
            </div>
          </td>
          <td style="vertical-align: middle; text-align: right; padding-bottom: 20px; width: 350px;">
            <h2 style="margin: 0 0 8px 0; font-size: 24px; color: #333; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${title}</h2>
            <p style="margin: 4px 0; font-size: 14px; color: #444;"><strong>Factura N°:</strong> <span style="font-family: monospace; font-size: 15px; font-weight: 600;">${invoice.id}</span></p>
            <p style="margin: 4px 0; font-size: 14px; color: #444;"><strong>Fecha:</strong> ${invoice.date}</p>
            ${invoice.ncf ? `<p style="margin: 4px 0; font-size: 14px; color: #444;"><strong>NCF:</strong> <span style="font-family: monospace; font-size: 15px; font-weight: 600;">${invoice.ncf}</span></p>` : ''}
          </td>
        </tr>
      </table>

      <div style="margin-bottom: 30px; background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
        <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">INFORMACIÓN DEL CLIENTE / PROVEEDOR</h3>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; line-height: 1.5;">
          <tr>
            <td style="padding: 4px 0; width: 180px; color: #6b7280; font-weight: 600;">Nombre / Razón Social:</td>
            <td style="padding: 4px 0; color: #111827; font-weight: 500;">${invoice.company || invoice.client || '—'}</td>
          </tr>
          ${invoice.nit ? `
          <tr>
            <td style="padding: 4px 0; color: #6b7280; font-weight: 600;">RNC / Cédula:</td>
            <td style="padding: 4px 0; color: #111827; font-family: monospace; font-size: 14px; font-weight: 600;">${invoice.nit}</td>
          </tr>` : ''}
          ${invoice.address ? `
          <tr>
            <td style="padding: 4px 0; color: #6b7280; font-weight: 600;">Dirección:</td>
            <td style="padding: 4px 0; color: #111827;">${invoice.address}</td>
          </tr>` : ''}
          ${invoice.contact ? `
          <tr>
            <td style="padding: 4px 0; color: #6b7280; font-weight: 600;">Representante / Teléfono:</td>
            <td style="padding: 4px 0; color: #111827;">${invoice.contact}</td>
          </tr>` : ''}
        </table>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
        <thead>
          <tr style="background: #22c55e; color: #fff;">
            <th style="padding: 12px 10px; text-align: left; font-weight: 600; border-top-left-radius: 6px; border-bottom-left-radius: 6px; width: 120px;">CANTIDAD</th>
            <th style="padding: 12px 10px; text-align: left; font-weight: 600;">DESCRIPCIÓN</th>
            <th style="padding: 12px 10px; text-align: right; font-weight: 600; width: 150px;">PRECIO UNITARIO</th>
            <th style="padding: 12px 10px; text-align: right; font-weight: 600; border-top-right-radius: 6px; border-bottom-right-radius: 6px; width: 150px;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
        <div style="width: 350px; background: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; text-align: left; color: #4b5563;">Subtotal:</td>
              <td style="padding: 6px 0; text-align: right; color: #111827; font-weight: 600;">${formatMoney(invoice.subtotal || invoice.totalVenta || 0)}</td>
            </tr>
            ${invoice.iscAmount > 0 ? `
            <tr>
              <td style="padding: 6px 0; text-align: left; color: #4b5563;">ISC (${invoice.iscRate || 0}%):</td>
              <td style="padding: 6px 0; text-align: right; color: #111827; font-weight: 600;">+${formatMoney(invoice.iscAmount)}</td>
            </tr>
            ` : ''}
            ${invoice.taxAmount > 0 ? `
            <tr>
              <td style="padding: 6px 0; text-align: left; color: #4b5563;">ITBIS (${invoice.taxRate || 0}%):</td>
              <td style="padding: 6px 0; text-align: right; color: #111827; font-weight: 600;">+${formatMoney(invoice.taxAmount)}</td>
            </tr>
            ` : ''}
            ${invoice.retIsrAmount > 0 ? `
            <tr>
              <td style="padding: 6px 0; text-align: left; color: #dc2626;">Retención ISR (${invoice.retIsrRate || 0}%):</td>
              <td style="padding: 6px 0; text-align: right; color: #dc2626; font-weight: 600;">-${formatMoney(invoice.retIsrAmount)}</td>
            </tr>
            ` : ''}
            ${invoice.retItbisAmount > 0 ? `
            <tr>
              <td style="padding: 6px 0; text-align: left; color: #dc2626;">Retención ITBIS (${invoice.retItbisRate || 0}%):</td>
              <td style="padding: 6px 0; text-align: right; color: #dc2626; font-weight: 600;">-${formatMoney(invoice.retItbisAmount)}</td>
            </tr>
            ` : ''}
            <tr style="border-top: 1.5px solid #e5e7eb;">
              <td style="padding: 10px 0 0 0; text-align: left; font-size: 18px; font-weight: 700; color: #111827;">TOTAL:</td>
              <td style="padding: 10px 0 0 0; text-align: right; font-size: 20px; font-weight: 700; color: #15803d;">${formatMoney(invoice.total || invoice.totalVenta || invoice.totalCompra || 0)}</td>
            </tr>
          </table>
        </div>
      </div>

      ${invoice.notes ? `
      <div style="margin-top: 30px; font-size: 13px; color: #4b5563; border-top: 1px solid #e5e7eb; padding-top: 12px; line-height: 1.5;">
        <strong style="color: #1f2937; display: block; margin-bottom: 4px;">Notas / Condiciones:</strong>
        ${invoice.notes}
      </div>
      ` : ''}
    </div>
  `;
}

function base64ToBlob(base64, mimeType = 'application/pdf') {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

function numeroALetras(num) {
    const cur = typeof getCurrency === 'function' ? getCurrency() : { code: 'DOP' };
    const currencyName = cur.code === 'USD' ? 'DÓLARES' : 'PESOS';
    const centavosName = cur.code === 'USD' ? 'USD' : 'DOP';

    const unidades = ['UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const decenas = ['DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const especiales = {
        11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
        16: 'DIECISEIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE'
    };
    const centenas = ['CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
    
    function convCentena(n) {
        if (n === 0) return '';
        if (n === 100) return 'CIEN';
        const c = Math.floor(n / 100);
        const rest = n % 100;
        let s = '';
        if (c > 0) s += centenas[c - 1] + ' ';
        if (rest > 0) {
            if (rest < 10) {
                s += unidades[rest - 1];
            } else if (rest >= 11 && rest <= 19) {
                s += especiales[rest];
            } else {
                const d = Math.floor(rest / 10);
                const u = rest % 10;
                s += decenas[d - 1];
                if (u > 0) s += ' Y ' + unidades[u - 1];
            }
        }
        return s.trim();
    }

    if (num === 0) return `CERO ${currencyName}`;
    
    const entero = Math.floor(num);
    const centavos = Math.round((num - entero) * 100);
    
    let letras = '';
    if (entero < 1000) {
        letras = convCentena(entero);
    } else if (entero < 1000000) {
        const miles = Math.floor(entero / 1000);
        const resto = entero % 1000;
        letras = (miles === 1 ? 'MIL' : convCentena(miles) + ' MIL') + ' ' + convCentena(resto);
    } else {
        letras = 'MONTO MUY GRANDE';
    }
    
    const centavosStr = String(centavos).padStart(2, '0');
    return `SON: ${letras.trim()} ${currencyName} CON ${centavosStr}/100 ${centavosName}`;
}

function getConsumidorFinalHTML(invoice) {
    const settings = JSON.parse(localStorage.getItem('recim_settings') || '{}');
    const companyName = settings.companyName || 'RECIMINSA';
    const companyRNC = settings.companyRNC || '0515-241087-106-0';
    const companyPhone = settings.userPhone || '—';
    const companyEmail = settings.userEmail || '—';

    const customCompanyLogo = settings.companyLogo 
      ? `<img src="${settings.companyLogo}" style="max-width: 130px; max-height: 60px; object-fit: contain;" />` 
      : `<img src="logo-no-white-lines.png" style="max-width: 130px; max-height: 60px; object-fit: contain; border-radius: 6px;" />`;

    // Parse date
    let day = '', month = '', year = '';
    if (invoice.date) {
        const parts = invoice.date.split('-');
        if (parts.length === 3) {
            year = parts[0];
            month = parts[1];
            day = parts[2];
        }
    }

    const isExempt = invoice.taxRate === 0;

    // Render items rows
    const items = invoice.items || [];
    const maxRows = 10;
    let tableRowsHtml = '';

    for (let i = 0; i < Math.max(items.length, maxRows); i++) {
        if (i < items.length) {
            const item = items[i];
            const sub = item.subtotal || item.totalVenta || 0;
            tableRowsHtml += `
                <tr style="border-bottom: 1px solid #bbb; height: 35px;">
                    <td style="border-right: 1px solid #bbb; padding: 4px; text-align: center; font-size: 13px;">${item.qty} ${item.unit || ''}</td>
                    <td style="border-right: 1px solid #bbb; padding: 4px 8px; font-size: 13px;">${item.desc || item.name}</td>
                    <td style="border-right: 1px solid #bbb; padding: 4px; text-align: right; font-size: 13px; font-family: monospace;">${formatMoney(item.uprice || item.priceSell || 0)}</td>
                    <td style="border-right: 1px solid #bbb; padding: 4px; text-align: right; font-size: 13px; font-family: monospace;"></td>
                    <td style="border-right: 1px solid #bbb; padding: 4px; text-align: right; font-size: 13px; font-family: monospace;">${isExempt ? formatMoney(sub) : ''}</td>
                    <td style="padding: 4px; text-align: right; font-size: 13px; font-family: monospace;">${!isExempt ? formatMoney(sub) : ''}</td>
                </tr>
            `;
        } else {
            // Padding empty rows to match look of pre-printed invoices
            tableRowsHtml += `
                <tr style="border-bottom: 1px solid #bbb; height: 35px;">
                    <td style="border-right: 1px solid #bbb; padding: 4px;"></td>
                    <td style="border-right: 1px solid #bbb; padding: 4px;"></td>
                    <td style="border-right: 1px solid #bbb; padding: 4px;"></td>
                    <td style="border-right: 1px solid #bbb; padding: 4px;"></td>
                    <td style="border-right: 1px solid #bbb; padding: 4px;"></td>
                    <td style="padding: 4px;"></td>
                </tr>
            `;
        }
    }

    const subtotalVal = invoice.subtotal || invoice.totalVenta || 0;
    const totalVal = invoice.total || invoice.totalVenta || 0;
    const retIvaVal = invoice.retItbisAmount || 0;

    const amountInWords = numeroALetras(totalVal);

    // Sales superiors to $200.00 autofill if client name matches
    const superiorClientName = totalVal >= 200 ? (invoice.company || invoice.client || '') : '';
    const superiorClientNit = totalVal >= 200 ? (invoice.nit || '') : '';

    return `
    <div style="box-sizing: border-box; width: 100%; font-family: 'Inter', 'Helvetica', sans-serif; padding: 30px; color: #111; background: #fff; border: 2px solid #555; border-radius: 8px;">
      
      <!-- HEADER -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
        <tr>
          <!-- Logo & Company info -->
          <td style="vertical-align: top; text-align: left; padding-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 15px;">
              ${customCompanyLogo}
              <div>
                <h1 style="margin: 0; font-size: 24px; color: #22c55e; font-weight: 800; text-transform: uppercase;">${companyName}</h1>
                <p style="margin: 2px 0; font-size: 12px; color: #333; font-weight: 600;">Dirección: Calle Central, Santo Domingo, Rep. Dom.</p>
                <p style="margin: 2px 0; font-size: 12px; color: #555;"><strong>Tel:</strong> ${companyPhone} | <strong>Email:</strong> ${companyEmail}</p>
                <p style="margin: 2px 0; font-size: 12px; color: #777; font-style: italic;">Giro: Gestión de materiales reciclables y servicios medioambientales</p>
              </div>
            </div>
          </td>
          
          <!-- Boxed Factura Title -->
          <td style="vertical-align: top; text-align: right; width: 260px;">
            <div style="border: 2px solid #22c55e; border-radius: 8px; padding: 12px; text-align: center; background: #f9fbf9;">
              <h2 style="margin: 0 0 4px 0; font-size: 20px; color: #15803d; font-weight: 800; letter-spacing: 1px;">FACTURA</h2>
              <p style="margin: 2px 0; font-size: 13px; font-family: monospace; font-weight: bold; color: #e11d48;">N° ${invoice.id}</p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #444; font-weight: 500;">RNC: ${companyRNC}</p>
            </div>
            
            <!-- Date boxes -->
            <table style="width: 100%; border-collapse: collapse; margin-top: 8px; border: 1px solid #777; text-align: center; font-size: 11px;">
              <tr style="background: #eee; font-weight: bold; border-bottom: 1px solid #777;">
                <td style="border-right: 1px solid #777; width: 33%;">DIA</td>
                <td style="border-right: 1px solid #777; width: 33%;">MES</td>
                <td style="width: 34%;">AÑO</td>
              </tr>
              <tr style="height: 22px; font-family: monospace; font-weight: bold; font-size: 12px;">
                <td style="border-right: 1px solid #777;">${day}</td>
                <td style="border-right: 1px solid #777;">${month}</td>
                <td>${year}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- CLIENT DETAILS SECTION -->
      <div style="border: 1px solid #777; border-radius: 6px; padding: 12px; margin-bottom: 15px; background: #fff; font-size: 12px;">
        <table style="width: 100%; border-collapse: collapse; line-height: 1.6;">
          <tr>
            <td style="font-weight: bold; color: #444; width: 120px;">Cliente:</td>
            <td style="border-bottom: 1px dotted #777; color: #111;" colspan="3">${invoice.company || invoice.client || '—'}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #444;">Dirección:</td>
            <td style="border-bottom: 1px dotted #777; color: #111;" colspan="3">${invoice.address || '—'}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #444;">Venta a cuenta de:</td>
            <td style="border-bottom: 1px dotted #777; color: #111; width: 40%;">${invoice.contact || '—'}</td>
            <td style="font-weight: bold; color: #444; text-align: right; padding-right: 8px; width: 100px;">RNC / Cédula:</td>
            <td style="border-bottom: 1px dotted #777; color: #111; font-family: monospace;">${invoice.nit || '—'}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #444;">Forma de Pago:</td>
            <td colspan="3" style="padding-top: 4px;">
              <span style="margin-right: 20px;"><input type="checkbox" checked disabled /> Contado</span>
              <span><input type="checkbox" disabled /> Crédito</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- ITEMS TABLE -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #555; font-size: 12px;">
        <thead>
          <tr style="background: #22c55e; color: #fff; border-bottom: 1.5px solid #333;">
            <th style="padding: 8px 4px; text-align: center; border-right: 1px solid #fff; width: 90px; font-weight: bold;">CANT.</th>
            <th style="padding: 8px 10px; text-align: left; border-right: 1px solid #fff; font-weight: bold;">DESCRIPCIÓN</th>
            <th style="padding: 8px 4px; text-align: right; border-right: 1px solid #fff; width: 110px; font-weight: bold;">P. UNITARIO</th>
            <th style="padding: 8px 4px; text-align: right; border-right: 1px solid #fff; width: 110px; font-weight: bold;">NO SUJETAS</th>
            <th style="padding: 8px 4px; text-align: right; border-right: 1px solid #fff; width: 110px; font-weight: bold;">EXENTAS</th>
            <th style="padding: 8px 4px; text-align: right; width: 110px; font-weight: bold;">GRAVADAS</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>

      <!-- FOOTER & TOTALS -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px;">
        <tr>
          <!-- Left side conditions & words -->
          <td style="vertical-align: top; padding-right: 20px;">
            <div style="border: 1px solid #777; border-radius: 6px; padding: 10px; background: #fafafa; min-height: 80px; margin-bottom: 10px;">
              <span style="font-weight: bold; color: #444; font-size: 11px; display: block; margin-bottom: 4px;">VALOR EN LETRAS:</span>
              <span style="font-weight: bold; color: #111; font-size: 12px; line-height: 1.4;">${amountInWords}</span>
            </div>
            
            <!-- Box for sales >= $200.00 -->
            <div style="border: 1px solid #777; border-radius: 6px; padding: 8px; background: #fff; font-size: 10px; line-height: 1.4;">
              <div style="font-weight: bold; font-size: 10px; border-bottom: 1px solid #bbb; padding-bottom: 2px; margin-bottom: 4px; text-transform: uppercase;">Llenar si la venta es igual o superior a $200.00</div>
              Nombre: <span style="border-bottom: 1px dotted #555; display: inline-block; width: 220px; font-weight: bold;">${superiorClientName}</span><br/>
              NIT/DUI: <span style="border-bottom: 1px dotted #555; display: inline-block; width: 218px; font-weight: bold; font-family: monospace;">${superiorClientNit}</span><br/>
              Pasaporte/Carnet Extranjero: <span style="border-bottom: 1px dotted #555; display: inline-block; width: 130px;"></span>
            </div>
          </td>
          <td style="vertical-align: top; width: 280px;">
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #555; font-size: 12px;">
              <tr style="border-bottom: 1px solid #555;">
                <td style="padding: 6px 8px; font-weight: bold; background: #eee; border-right: 1px solid #555;">SUMAS:</td>
                <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: bold;">${formatMoney(subtotalVal)}</td>
              </tr>
              ${invoice.iscAmount > 0 ? `
              <tr style="border-bottom: 1px solid #555;">
                <td style="padding: 6px 8px; font-weight: bold; background: #eee; border-right: 1px solid #555;">ISC (${invoice.iscRate || 0}%):</td>
                <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: bold;">+${formatMoney(invoice.iscAmount)}</td>
              </tr>
              ` : ''}
              ${invoice.taxAmount > 0 ? `
              <tr style="border-bottom: 1px solid #555;">
                <td style="padding: 6px 8px; font-weight: bold; background: #eee; border-right: 1px solid #555;">ITBIS (${invoice.taxRate || 0}%):</td>
                <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: bold;">+${formatMoney(invoice.taxAmount)}</td>
              </tr>
              ` : ''}
              ${invoice.retIsrAmount > 0 ? `
              <tr style="border-bottom: 1px solid #555;">
                <td style="padding: 6px 8px; font-weight: bold; background: #eee; border-right: 1px solid #555;">(-) RET. ISR (${invoice.retIsrRate || 0}%):</td>
                <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #ef4444; font-weight: bold;">-${formatMoney(invoice.retIsrAmount)}</td>
              </tr>
              ` : ''}
              ${invoice.retItbisAmount > 0 ? `
              <tr style="border-bottom: 1px solid #555;">
                <td style="padding: 6px 8px; font-weight: bold; background: #eee; border-right: 1px solid #555;">(-) IVA RETENIDO (${invoice.retItbisRate || 0}%):</td>
                <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #ef4444; font-weight: bold;">-${formatMoney(invoice.retItbisAmount)}</td>
              </tr>
              ` : ''}
              <tr style="border-bottom: 1px solid #555;">
                <td style="padding: 6px 8px; font-weight: bold; background: #eee; border-right: 1px solid #555;">SUB-TOTAL:</td>
                <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: bold;">${formatMoney(totalVal)}</td>
              </tr>
              <tr style="border-bottom: 1px solid #555;">
                <td style="padding: 6px 8px; font-weight: bold; background: #eee; border-right: 1px solid #555;">VENTAS NO SUJETAS:</td>
                <td style="padding: 6px 8px; text-align: right; font-family: monospace;">RD$0.00</td>
              </tr>
              <tr style="border-bottom: 1px solid #555;">
                <td style="padding: 6px 8px; font-weight: bold; background: #eee; border-right: 1px solid #555;">VENTAS EXENTAS:</td>
                <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: bold;">${isExempt ? formatMoney(subtotalVal) : 'RD$0.00'}</td>
              </tr>
              <tr style="font-weight: bold; background: #f0fdf4; border-top: 1.5px solid #333;">
                <td style="padding: 8px 8px; font-size: 13px; color: #15803d; border-right: 1px solid #555;">TOTAL:</td>
                <td style="padding: 8px 8px; text-align: right; font-size: 14px; color: #15803d; font-family: monospace;">${formatMoney(totalVal)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Bottom validation -->
      <div style="margin-top: 15px; font-size: 11px; text-align: center; border-top: 1px solid #bbb; padding-top: 8px; color: #555;">
        Cancelado: ____________ de ____________________ de ________ &bull; Firma Cliente: _________________________
      </div>
      
    </div>
    `;
}

function generateInvoicePDF(invoice, format = null) {
    if (!invoice) return;

    if (invoice.type === 'basica') {
        proceedWithPDF(invoice, 'basica');
        return;
    }

    if (format) {
        proceedWithPDF(invoice, format);
        return;
    }

    // Modal selector popup for PDF layout type
    const modalId = 'pdf-format-selector-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-overlay';
        modal.style.position = 'fixed';
        modal.style.left = '0';
        modal.style.top = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.backgroundColor = 'rgba(0,0,0,0.6)';
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '99999';
        
        const card = document.createElement('div');
        card.style.background = 'var(--clr-surface-1, #fff)';
        card.style.border = '1px solid var(--clr-border, #ccc)';
        card.style.borderRadius = 'var(--r-md, 8px)';
        card.style.padding = '24px';
        card.style.width = '350px';
        card.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
        card.style.textAlign = 'center';
        card.style.color = 'var(--clr-text, #333)';
        
        card.innerHTML = `
            <h3 style="margin-top:0; margin-bottom:12px; font-size:1.15rem; color:var(--clr-primary, #22c55e); font-weight: 700;">📄 Descargar PDF</h3>
            <p style="font-size:0.85rem; color:var(--clr-text-muted, #666); margin-bottom:20px;">Elige el formato de impresión para tu factura:</p>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button class="btn-primary" id="btn-pdf-normal" style="padding:10px; font-weight:600; width: 100%; justify-content: center;">Factura Comercial (Normal)</button>
                <button class="btn-secondary" id="btn-pdf-consumidor" style="padding:10px; font-weight:600; width: 100%; justify-content: center; border: 1px solid var(--clr-primary, #22c55e);">Factura Consumidor Final</button>
                <button class="btn-outline" id="btn-pdf-cancel" style="padding:10px; margin-top:10px; width: 100%; justify-content: center;">Cancelar</button>
            </div>
        `;
        modal.appendChild(card);
        document.body.appendChild(modal);
    }

    modal.style.display = 'flex';

    const cleanUp = () => {
        modal.style.display = 'none';
    };

    document.getElementById('btn-pdf-normal').onclick = () => {
        cleanUp();
        proceedWithPDF(invoice, 'normal');
    };
    document.getElementById('btn-pdf-consumidor').onclick = () => {
        cleanUp();
        proceedWithPDF(invoice, 'consumidor');
    };
    document.getElementById('btn-pdf-cancel').onclick = () => {
        cleanUp();
    };
}

function proceedWithPDF(invoice, format) {
    if (typeof html2pdf === 'undefined') {
        showToast('Error: html2pdf.js no está cargado', 'error');
        return;
    }

    const isBasica = format === 'basica';
    const isConsumidor = format === 'consumidor';
    
    let htmlContent = '';
    if (isBasica) {
        htmlContent = getBasicaHTML(invoice);
    } else if (isConsumidor) {
        htmlContent = getConsumidorFinalHTML(invoice);
    } else {
        htmlContent = getNormalHTML(invoice);
    }
    
    const opt = {
        margin: isBasica ? [10, 10] : 10,
        filename: `Factura_${invoice.id}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, windowWidth: (isBasica || isConsumidor) ? 800 : 1000, scrollX: 0, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: (isBasica || isConsumidor) ? 'portrait' : 'landscape' }
    };

    // Crear contenedor temporal
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '0';
    container.style.top = '0';
    container.style.width = (isBasica || isConsumidor) ? '800px' : '1000px';
    container.style.height = '0';
    container.style.overflow = 'hidden';
    container.style.zIndex = '-9999';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);

    const wrapper = document.createElement('div');
    wrapper.style.width = (isBasica || isConsumidor) ? '800px' : '1000px';
    wrapper.style.background = '#fff';
    wrapper.innerHTML = htmlContent;
    container.appendChild(wrapper);

    showToast('Generando PDF...', 'info');

    html2pdf().set(opt).from(wrapper).output('datauristring').then(async function (pdfBase64) {
        if (container.parentNode) {
            container.parentNode.removeChild(container);
        }

        // Integración Capacitor para Móviles
        if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
            try {
                const base64Data = pdfBase64.split(',')[1];
                const fileName = `Factura_${invoice.id}.pdf`;
                
                const result = await Capacitor.Plugins.Filesystem.writeFile({
                    path: fileName,
                    data: base64Data,
                    directory: Capacitor.Plugins.Filesystem.Directory.Documents
                });
                
                await Capacitor.Plugins.Share.share({
                    title: 'Factura',
                    text: 'Adjunto factura generada.',
                    url: result.uri,
                    dialogTitle: 'Compartir Factura'
                });
                showToast('📄 Factura lista', 'success');
            } catch (err) {
                console.error('Error guardando PDF en Android', err);
                showToast('❌ Error guardando el PDF en tu móvil', 'error');
            }
        } else if (window.chrome && window.chrome.webview) {
            // WebView2 (Windows Desktop App)
            const base64Data = pdfBase64.split(',')[1];
            window.chrome.webview.postMessage(JSON.stringify({
                action: 'download',
                filename: opt.filename,
                data: base64Data
            }));
            showToast('📄 Factura abierta en tu programa predeterminado', 'success');
        } else {
            // Descarga Web / PC normal (Convertimos base64 a Blob directamente sin usar fetch para evitar bloqueos CSP)
            try {
                const base64Data = pdfBase64.split(',')[1];
                const blob = base64ToBlob(base64Data, 'application/pdf');
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = opt.filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(url), 100);
                showToast('📄 PDF descargado', 'success');
            } catch (err) {
                console.error('Error al guardar PDF:', err);
                showToast('❌ Error al guardar PDF', 'error');
            }
        }
    }).catch(err => {
        if (container.parentNode) {
            container.parentNode.removeChild(container);
        }
        console.error('PDF error:', err);
        showToast('❌ Error al generar PDF', 'error');
    });
}
