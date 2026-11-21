/* =========================================================================
   WHATSAPP-SHARE.JS – Compartir PDFs + Resumen Directo por WhatsApp
   Soporta Facturas, Bitácoras, Cotizaciones y Certificados Ecológicos QR.
   ========================================================================= */

(function initWhatsAppShareModule() {
    /** Normaliza un teléfono al formato numérico internacional de WhatsApp (RD +1 para 809/829/849). */
    function normalizeWhatsAppPhone(raw) {
        let digits = String(raw ?? '').replace(/\D/g, '');
        if (digits.startsWith('00')) digits = digits.slice(2);
        if (digits.length < 7) return '';
        if (digits.length === 10 && /^(809|829|849)/.test(digits)) {
            digits = `1${digits}`;
        }
        return digits;
    }

    /** Busca el teléfono registrado del cliente respetando preferiblemente su sucursal. */
    function lookupClientPhone(name, branchId = '') {
        const needle = String(name ?? '').trim().toLowerCase();
        if (!needle || needle === 'consumidor final' || needle.startsWith('todos los clientes')) return '';

        let allClients = [];
        try {
            if (typeof getAllClientsRaw === 'function') allClients = getAllClientsRaw();
            else if (typeof getClients === 'function') allClients = getClients(branchId || undefined);
        } catch (_) {}
        if (!Array.isArray(allClients) || allClients.length === 0) return '';

        const normBranch = String(branchId || '').trim();
        const matchesByName = allClients.filter(c => String(c.name || '').trim().toLowerCase() === needle);
        const preferred = (normBranch
            ? matchesByName.find(c => String(c.branchId || '').trim() === normBranch)
            : null) || matchesByName[0];

        if (!preferred) return '';
        return (
            normalizeWhatsAppPhone(preferred.phone) ||
            normalizeWhatsAppPhone(preferred.tel) ||
            normalizeWhatsAppPhone(preferred.whatsapp) ||
            normalizeWhatsAppPhone(preferred.contact) ||
            ''
        );
    }

    function _formatAmount(val, currency = 'DOP') {
        if (typeof formatMoney === 'function') {
            try { return formatMoney(val, currency); } catch (_) {}
        }
        return `${currency === 'USD' ? 'US$' : 'RD$'} ${parseFloat(val || 0).toFixed(2)}`;
    }

    function _getIssuerDisplayName() {
        try {
            if (typeof getActiveCompanyIssuerInfo === 'function') {
                const info = getActiveCompanyIssuerInfo();
                if (info && info.name) return info.name;
            }
            if (typeof getSettings === 'function') {
                const s = getSettings();
                if (s && s.companyName) return s.companyName;
            }
        } catch (_) {}
        return 'Reciminsaap';
    }

    function _summarizeItems(items, limit = 4) {
        if (!Array.isArray(items) || items.length === 0) return '';
        const lines = items.slice(0, limit).map(it => {
            const name = it.materialName || it.desc || it.name || 'Material';
            const qty = it.qty != null ? it.qty : 0;
            const unit = it.unit || 'lb';
            return `• ${name}: ${qty} ${unit}`;
        });
        if (items.length > limit) {
            lines.push(`• ... y ${items.length - limit} ítem(s) adicional(es)`);
        }
        return lines.join('\n');
    }

    function triggerDesktopPdfDownload({ filename, base64Data, blob }) {
        try {
            if (window.electronAPI && typeof window.electronAPI.savePDF === 'function' && base64Data) {
                window.electronAPI.savePDF(base64Data, filename);
                return true;
            }
        } catch (_) {}

        try {
            if (window.NativeBridge && typeof window.NativeBridge.post === 'function' && base64Data) {
                const posted = window.NativeBridge.post({ action: 'download', filename, data: base64Data });
                if (posted) return true;
            }
        } catch (_) {}

        try {
            if (blob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' && typeof document !== 'undefined') {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(url), 500);
                return true;
            }
        } catch (_) {}

        return false;
    }

    async function sharePdfAndSummaryViaWhatsApp({ filename, base64Data, blob, text, phone, title }) {
        // 1. Puente Nativo Android: Intent directo con archivo PDF adjunto + resumen hacia WhatsApp / WhatsApp Business
        if (window.AndroidNative && typeof window.AndroidNative.ShareFileToWhatsApp === 'function' && base64Data) {
            window.AndroidNative.ShareFileToWhatsApp(filename, base64Data, text || '', phone || '');
            if (typeof showToast === 'function') {
                showToast('💬 Abriendo WhatsApp con el PDF adjunto...', 'success');
            }
            return { channel: 'android_native', ok: true };
        }

        // 2. Web Share API con soporte real de archivos (Android Chrome / PWA / Móvil)
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && blob && typeof File !== 'undefined') {
            try {
                const pdfFile = new File([blob], filename, { type: 'application/pdf' });
                if (navigator.canShare({ files: [pdfFile] })) {
                    await navigator.share({
                        title: title || filename,
                        text: text || '',
                        files: [pdfFile]
                    });
                    if (typeof showToast === 'function') {
                        showToast('💬 Documento PDF compartido correctamente', 'success');
                    }
                    return { channel: 'web_share', ok: true };
                }
            } catch (shareErr) {
                if (shareErr && shareErr.name === 'AbortError') {
                    return { channel: 'web_share', ok: false, aborted: true };
                }
                console.warn('Web Share API fallback hacia descarga + wa.me:', shareErr);
            }
        }

        // 3. Fallback Desktop / Windows MAUI / Web sin Web Share de archivos: guarda PDF y abre WhatsApp con el resumen
        triggerDesktopPdfDownload({ filename, base64Data, blob });

        const params = [];
        if (phone) params.push(`phone=${encodeURIComponent(phone)}`);
        if (text) params.push(`text=${encodeURIComponent(text)}`);
        const waUrl = `https://api.whatsapp.com/send?${params.join('&')}`;

        if (typeof window !== 'undefined' && typeof window.openExternalLink === 'function') {
            window.openExternalLink(waUrl);
        } else if (typeof window !== 'undefined' && typeof window.open === 'function') {
            window.open(waUrl, '_blank', 'noopener,noreferrer');
        }

        if (typeof showToast === 'function') {
            showToast('📄 PDF guardado en Descargas y WhatsApp abierto con el resumen. Adjunta el PDF en el chat.', 'success', 4500);
        }

        return { channel: 'wa_fallback', ok: true };
    }

    async function shareInvoiceViaWhatsApp(invoiceId) {
        try {
            const list = typeof getAllHistoryItems === 'function'
                ? getAllHistoryItems()
                : (typeof getAllInvoices === 'function' ? getAllInvoices() : []);
            const inv = list.find(i => i.id === invoiceId);
            if (!inv) {
                if (typeof showToast === 'function') showToast('⚠️ Documento no encontrado', 'warning');
                return null;
            }

            if (typeof generateInvoicePDF !== 'function') {
                if (typeof showToast === 'function') showToast('❌ Generador de PDF no disponible', 'error');
                return null;
            }

            const pdfRes = await generateInvoicePDF(inv, null, { returnResult: true });
            if (!pdfRes || (!pdfRes.base64Data && !pdfRes.blob)) {
                if (typeof showToast === 'function') showToast('❌ No se pudo generar el PDF para compartir', 'error');
                return null;
            }

            const issuer = _getIssuerDisplayName();
            const docLabel = inv.type === 'basica' ? 'Bitácora de Recogida' : 'Factura';
            const clientName = inv.company || inv.client || 'Consumidor Final';
            const branchLabel = inv.branchName || (inv.branchId && typeof resolveBranchNameById === 'function' ? resolveBranchNameById(inv.branchId) : '');
            const totalFmt = _formatAmount(inv.total, inv.currency || 'DOP');
            const itemsSummary = _summarizeItems(inv.items, 4);

            const lines = [
                `Hola *${clientName}*,`,
                `Te compartimos tu *${docLabel}* de *${issuer}*:`,
                ``,
                `• *Comprobante:* ${inv.id}`,
                ...(inv.ncf ? [`• *NCF:* ${inv.ncf}`] : []),
                ...(branchLabel ? [`• *Sucursal:* ${branchLabel}`] : []),
                ...(inv.date ? [`• *Fecha:* ${inv.date}`] : []),
                `• *Total:* ${totalFmt}`,
                ...(inv.payMethod || inv.paymentMethod ? [`• *Forma de pago:* ${inv.payMethod || inv.paymentMethod}`] : []),
                ...(itemsSummary ? ['', '*Resumen de materiales:*', itemsSummary] : []),
                ``,
                `📎 Adjuntamos el PDF oficial del documento.`
            ];

            const phone = normalizeWhatsAppPhone(inv.contact) || lookupClientPhone(clientName, inv.branchId);
            return await sharePdfAndSummaryViaWhatsApp({
                ...pdfRes,
                text: lines.join('\n'),
                phone,
                title: `${docLabel} ${inv.id}`
            });
        } catch (err) {
            console.error('Error compartiendo documento por WhatsApp:', err);
            if (typeof showToast === 'function') showToast('❌ Error al compartir por WhatsApp', 'error');
            return null;
        }
    }

    async function shareQuoteViaWhatsApp(quoteId) {
        try {
            const quotes = typeof getAllQuotes === 'function' ? getAllQuotes() : [];
            const q = quotes.find(item => item.id === quoteId);
            if (!q) {
                if (typeof showToast === 'function') showToast('⚠️ Cotización no encontrada', 'warning');
                return null;
            }

            if (typeof generateQuotePDF !== 'function') {
                if (typeof showToast === 'function') showToast('❌ Generador de PDF no disponible', 'error');
                return null;
            }

            const pdfRes = await Promise.resolve(generateQuotePDF(q, { returnResult: true }));
            if (!pdfRes || (!pdfRes.base64Data && !pdfRes.blob)) {
                if (typeof showToast === 'function') showToast('❌ No se pudo generar la cotización PDF', 'error');
                return null;
            }

            const issuer = _getIssuerDisplayName();
            const clientName = q.client || 'Cliente';
            const branchLabel = q.branchName || (q.branchId && typeof resolveBranchNameById === 'function' ? resolveBranchNameById(q.branchId) : '');
            const totalFmt = _formatAmount(q.total, q.currency || 'DOP');
            const itemsSummary = _summarizeItems(q.items, 4);

            const lines = [
                `Hola *${clientName}*,`,
                `Te enviamos la *Cotización ${q.id}* de *${issuer}*:`,
                ``,
                ...(branchLabel ? [`• *Sucursal:* ${branchLabel}`] : []),
                ...(q.date ? [`• *Fecha:* ${q.date}`] : []),
                `• *Validez:* ${q.validityDays || 15} día(s)`,
                `• *Total estimado:* ${totalFmt}`,
                ...(itemsSummary ? ['', '*Detalle cotizado:*', itemsSummary] : []),
                ``,
                `📎 Adjuntamos la cotización en PDF.`
            ];

            const phone = normalizeWhatsAppPhone(q.contact) || lookupClientPhone(clientName, q.branchId);
            return await sharePdfAndSummaryViaWhatsApp({
                ...pdfRes,
                text: lines.join('\n'),
                phone,
                title: `Cotización ${q.id}`
            });
        } catch (err) {
            console.error('Error compartiendo cotización por WhatsApp:', err);
            if (typeof showToast === 'function') showToast('❌ Error al compartir cotización por WhatsApp', 'error');
            return null;
        }
    }

    async function shareEcoCertificateViaWhatsApp(opts = {}) {
        try {
            if (typeof generateEcoImpactPDFEngine !== 'function') {
                if (typeof showToast === 'function') showToast('❌ Motor de Certificado Ecológico no disponible', 'error');
                return null;
            }

            let clientName = opts.clientName;
            let startDate = opts.startDate;
            let endDate = opts.endDate;

            if (clientName === undefined && typeof document !== 'undefined') {
                const clientSel = document.getElementById('eco-client-select');
                const startEl = document.getElementById('eco-start-date');
                const endEl = document.getElementById('eco-end-date');
                clientName = clientSel ? clientSel.value : null;
                if (startDate === undefined && startEl) startDate = startEl.value;
                if (endDate === undefined && endEl) endDate = endEl.value;
            }

            const invoices = Array.isArray(opts.invoices) && opts.invoices.length > 0
                ? opts.invoices
                : (typeof getAllInvoices === 'function' ? getAllInvoices() : []);

            const pdfRes = await Promise.resolve(generateEcoImpactPDFEngine({
                ...opts,
                clientName: clientName || null,
                startDate: startDate || null,
                endDate: endDate || null,
                invoices,
                returnResult: true
            }));

            if (!pdfRes) return null;

            const stats = pdfRes.stats || {};
            const lines = [
                `🌱 *Constancia de Impacto Medioambiental*`,
                `Emitida por *${pdfRes.companyName || _getIssuerDisplayName()}* para *${pdfRes.targetClient}*:`,
                ``,
                `• *Período:* ${pdfRes.periodText}`,
                `• *Material reciclado:* ${Number(stats.totalWeight || 0).toFixed(1)} kg`,
                `• *CO₂ evitado:* ${Math.round(stats.co2Avoided || 0).toLocaleString()} kg`,
                `• *Árboles salvados:* ${Math.ceil(stats.treesSaved || 0)}`,
                `• *Agua conservada:* ${Math.round(stats.waterSaved || 0).toLocaleString()} L`,
                `• *Energía ahorrada:* ${Math.round(stats.energySaved || 0).toLocaleString()} kWh`,
                `• *Validación QR:* ${pdfRes.certId} / ${pdfRes.verificationCode}`,
                ``,
                `📎 Adjuntamos el certificado PDF con código QR verificable offline.`
            ];

            const phone = lookupClientPhone(pdfRes.targetClient);
            return await sharePdfAndSummaryViaWhatsApp({
                ...pdfRes,
                text: lines.join('\n'),
                phone,
                title: `Certificado Verde ${pdfRes.certId}`
            });
        } catch (err) {
            console.error('Error compartiendo certificado ecológico por WhatsApp:', err);
            if (typeof showToast === 'function') showToast('❌ Error al compartir certificado por WhatsApp', 'error');
            return null;
        }
    }

    if (typeof window !== 'undefined') {
        window.normalizeWhatsAppPhone = normalizeWhatsAppPhone;
        window.lookupClientPhone = lookupClientPhone;
        window.sharePdfAndSummaryViaWhatsApp = sharePdfAndSummaryViaWhatsApp;
        window.shareInvoiceViaWhatsApp = shareInvoiceViaWhatsApp;
        window.shareQuoteViaWhatsApp = shareQuoteViaWhatsApp;
        window.shareEcoCertificateViaWhatsApp = shareEcoCertificateViaWhatsApp;
    }
})();
