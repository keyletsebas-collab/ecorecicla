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
    const title = isEmpresa && invoice.ncf ? 'FACTURA DE CRÉDITO FISCAL' : 'FACTURA COMERCIAL';

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

/**
 * Función centralizada para generar y descargar/compartir el PDF de una factura.
 * @param {Object} invoice - El objeto de factura guardado.
 */
function generateInvoicePDF(invoice) {
    if (!invoice) return;

    if (typeof html2pdf === 'undefined') {
        showToast('Error: html2pdf.js no está cargado', 'error');
        return;
    }

    const isBasica = invoice.type === 'basica';
    const htmlContent = isBasica ? getBasicaHTML(invoice) : getNormalHTML(invoice);
    
    // Configuración óptica. Las facturas normales van en apaisado, las básicas en vertical.
    const opt = {
        margin: isBasica ? [10, 10] : 10,
        filename: \`Factura_\${invoice.id}.pdf\`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, windowWidth: isBasica ? 800 : 1000, scrollX: 0, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: isBasica ? 'portrait' : 'landscape' }
    };

    // Crear contenedor temporal
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '0';
    container.style.top = '0';
    container.style.width = isBasica ? '800px' : '1000px';
    container.style.height = '0';
    container.style.overflow = 'hidden';
    container.style.zIndex = '-9999';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);

    const wrapper = document.createElement('div');
    wrapper.style.width = isBasica ? '800px' : '1000px';
    wrapper.style.background = '#fff';
    wrapper.innerHTML = htmlContent;
    container.appendChild(wrapper);

    showToast('Generando PDF...', 'info');

    html2pdf().set(opt).from(wrapper).output('datauristring').then(async function (pdfBase64) {
        if (container.parentNode) {
            container.parentNode.removeChild(container);
        }

        const base64Data = pdfBase64.split(',')[1];

        // 1. Android MAUI (vía AddJavascriptInterface)
        if (window.AndroidNative && window.AndroidNative.DownloadFile) {
            try {
                window.AndroidNative.DownloadFile(opt.filename, base64Data);
                showToast('📄 PDF guardado en Descargas y abriendo...', 'success');
            } catch (err) {
                console.error('AndroidNative Error:', err);
                showToast('❌ Error usando el puente nativo Android', 'error');
            }
        } 
        // 2. Windows MAUI (WebView2)
        else if (window.chrome && window.chrome.webview) {
            window.chrome.webview.postMessage(JSON.stringify({
                action: 'download',
                filename: opt.filename,
                data: base64Data
            }));
            showToast('📄 Factura abierta en tu programa predeterminado', 'success');
        } 
        // 3. Web Estándar / Fallback
        else {
            try {
                // Convertir Base64 a Blob manualmente (fetch falla en muchos WebViews con data URI grandes)
                const byteCharacters = atob(base64Data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/pdf' });
                
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
                console.error('Error creando Blob manual:', err);
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
