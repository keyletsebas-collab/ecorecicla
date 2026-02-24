/* =============================================
   EXCEL-UTILS.JS – Exportación a XLSX (SheetJS)
   Modelo: Registro de Residuos – 3 hojas
   ============================================= */

/**
 * Exporta un registro de factura/residuos a un archivo .xlsx
 * con 3 hojas: Registros_Diarios, Resumen_Diario, Catalogo_Codigos
 * @param {Object} invoice  - objeto de factura guardado en invoices.js
 */
function exportarExcelResiduos(invoice) {
    if (!invoice) return;
    if (typeof XLSX === 'undefined') {
        showToast('❌ Librería Excel no disponible', 'error');
        return;
    }

    try {
        showToast('📊 Generando Excel...', 'info');

        const wb = XLSX.utils.book_new();

        /* ─────────────────────────────────────────
           HOJA 1: Registros_Diarios
        ───────────────────────────────────────── */
        const encabezados = [
            'Fecha', 'Hora', 'Código', 'Nombre del residuo',
            'Proveedor / Procedencia', 'Cantidad', 'Unidad de medida',
            'Precio de compra', 'Precio de venta',
            'Total compra', 'Total venta', 'Ganancia',
            'Usuario', 'Observaciones'
        ];

        // Obtener datos del usuario actual
        const currentUser = firebase && firebase.auth && firebase.auth().currentUser;
        const usuarioNombre = currentUser
            ? (currentUser.displayName || currentUser.email || 'Usuario')
            : 'Usuario';

        // Convertir fecha ISO → DD/MM/YYYY
        function fmtFecha(dateStr) {
            if (!dateStr) return '';
            const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            return `${dd}/${mm}/${yyyy}`;
        }

        // Hora actual del registro
        const horaActual = (() => {
            const d = new Date(invoice.createdAt || Date.now());
            const hh = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            return `${hh}:${min}`;
        })();

        // Construir filas de datos (una fila por material)
        const items = invoice.items || [];
        const dataRows = items.map((item, idx) => {
            // Fila en Excel empieza en 2 (1 = encabezados)
            const rowNum = idx + 2;
            // Código del material
            const codigo = item.matId || item.code || '';

            // Usamos fórmulas para Total compra, Total venta y Ganancia
            return [
                fmtFecha(invoice.date),                           // A – Fecha
                horaActual,                                        // B – Hora
                codigo,                                            // C – Código
                item.name || item.desc || '',                      // D – Nombre del residuo
                invoice.client || invoice.company || '—',          // E – Proveedor / Procedencia
                item.qty || 0,                                     // F – Cantidad
                item.unit || 'kg',                                 // G – Unidad de medida
                item.priceBuy || item.uprice || 0,                 // H – Precio de compra
                item.priceSell || 0,                               // I – Precio de venta
                { f: `F${rowNum}*H${rowNum}` },                   // J – Total compra (fórmula)
                { f: `F${rowNum}*I${rowNum}` },                   // K – Total venta (fórmula)
                { f: `K${rowNum}-J${rowNum}` },                   // L – Ganancia (fórmula)
                usuarioNombre,                                     // M – Usuario
                invoice.notes || ''                                // N – Observaciones
            ];
        });

        // Si es factura empresarial (sin priceSell), completar precio venta = 0
        // Los datos ya lo manejan arriba con `|| 0`

        const ws1Data = [encabezados, ...dataRows];
        const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);

        // Anchos de columna sugeridos
        ws1['!cols'] = [
            { wch: 12 }, // A Fecha
            { wch: 8 }, // B Hora
            { wch: 10 }, // C Código
            { wch: 22 }, // D Nombre residuo
            { wch: 25 }, // E Proveedor
            { wch: 10 }, // F Cantidad
            { wch: 12 }, // G Unidad
            { wch: 14 }, // H P. Compra
            { wch: 14 }, // I P. Venta
            { wch: 14 }, // J Total Compra
            { wch: 14 }, // K Total Venta
            { wch: 14 }, // L Ganancia
            { wch: 20 }, // M Usuario
            { wch: 30 }, // N Observaciones
        ];

        // Congelar fila 1
        ws1['!freeze'] = { xSplit: 0, ySplit: 1 };

        // Estilo de encabezados (negrita + fondo verde)
        const headerStyle = {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '16A34A' } },
            alignment: { horizontal: 'center' }
        };
        const colLetters = 'ABCDEFGHIJKLMN'.split('');
        colLetters.forEach(col => {
            const cellRef = `${col}1`;
            if (ws1[cellRef]) {
                ws1[cellRef].s = headerStyle;
            }
        });

        // Obtener divisa actual
        const cur = (typeof getCurrency === 'function') ? getCurrency() : { symbol: 'RD$', code: 'DOP' };
        const curSymbol = cur.symbol.replace(/"/g, '""'); // Escapar comillas para formato Excel

        // Formato de moneda para columnas H, I, J, K, L
        const moneyCols = ['H', 'I', 'J', 'K', 'L'];
        for (let r = 2; r <= dataRows.length + 1; r++) {
            moneyCols.forEach(col => {
                const ref = `${col}${r}`;
                if (ws1[ref]) {
                    ws1[ref].z = `"${curSymbol}"#,##0.00`;
                }
            });
        }

        XLSX.utils.book_append_sheet(wb, ws1, 'Registros_Diarios');

        /* ─────────────────────────────────────────
           HOJA 2: Resumen_Diario
        ───────────────────────────────────────── */
        const totalKg = items.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);
        const totalCompra = items.reduce((s, i) => s + ((i.qty || 0) * (i.priceBuy || i.uprice || 0)), 0);
        const totalVenta = items.reduce((s, i) => s + ((i.qty || 0) * (i.priceSell || 0)), 0);
        const gananciaTotal = totalVenta - totalCompra;

        // Residuo principal (el de mayor cantidad)
        const principal = items.reduce((max, i) => {
            return (parseFloat(i.qty) || 0) > (parseFloat(max.qty) || 0) ? i : max;
        }, items[0] || {});

        const ws2Data = [
            ['Campo', 'Valor'],
            ['Fecha', fmtFecha(invoice.date)],
            ['ID Factura', invoice.id],
            ['Proveedor', invoice.client || invoice.company || '—'],
            ['Total cantidad recibida', totalKg],
            [`Total comprado ${cur.code}`, totalCompra],
            [`Total vendido ${cur.code}`, totalVenta],
            [`Ganancia total ${cur.code}`, gananciaTotal],
            ['Residuo principal', principal.name || '—'],
            ['Usuario', usuarioNombre],
        ];

        const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
        ws2['!cols'] = [{ wch: 28 }, { wch: 30 }];

        // Estilo encabezado hoja 2
        ['A1', 'B1'].forEach(ref => {
            if (ws2[ref]) {
                ws2[ref].s = headerStyle;
            }
        });

        // Formato moneda en filas de moneda (6, 7, 8 → 0-indexed 5, 6, 7)
        ['B6', 'B7', 'B8'].forEach(ref => {
            if (ws2[ref]) ws2[ref].z = `"${curSymbol}"#,##0.00`;
        });

        XLSX.utils.book_append_sheet(wb, ws2, 'Resumen_Diario');

        /* ─────────────────────────────────────────
           HOJA 3: Catalogo_Codigos
        ───────────────────────────────────────── */
        const catalogoHeader = ['Código', 'Residuo', 'Unidad'];
        const mats = (typeof getMaterialCodes === 'function') ? getMaterialCodes() : [];
        const catalogoRows = mats.map(m => [m.id || m.code || '', m.name || '', m.unit || 'kg']);

        const ws3Data = [catalogoHeader, ...catalogoRows];
        const ws3 = XLSX.utils.aoa_to_sheet(ws3Data);
        ws3['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 10 }];

        ['A1', 'B1', 'C1'].forEach(ref => {
            if (ws3[ref]) ws3[ref].s = headerStyle;
        });

        XLSX.utils.book_append_sheet(wb, ws3, 'Catalogo_Codigos');

        /* ─────────────────────────────────────────
           DESCARGAR ARCHIVO
        ───────────────────────────────────────── */
        const fileName = `Residuos_${invoice.id}_${(invoice.date || '').replace(/-/g, '')}.xlsx`;
        XLSX.writeFile(wb, fileName);

        showToast('✅ Excel descargado correctamente', 'success');

    } catch (err) {
        console.error('Excel Export Error:', err);
        showToast('❌ Error al generar Excel', 'error');
    }
}
