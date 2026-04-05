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

/**
 * Exporta todos los datos de la app (Facturas, Ingresos, Egresos, Materiales) 
 * en un solo archivo Excel con múltiples pestañas.
 */
function exportAllDataToExcel() {
    exportSelectedDataToExcel({
        invoices: true,
        income: true,
        expenses: true,
        materials: true
    });
}

/**
 * Exporta datos seleccionados de la app en un solo archivo Excel.
 * @param {Object} selection - { invoices: bool, income: bool, expenses: bool, materials: bool }
 */
function exportSelectedDataToExcel(selection = {}) {
    if (typeof XLSX === 'undefined') {
        showToast('❌ Librería Excel no disponible', 'error');
        return;
    }

    try {
        showToast('📊 Generando Excel...', 'info');
        const wb = XLSX.utils.book_new();
        let sheetsAdded = 0;

        // 1. Facturas
        if (selection.invoices) {
            const invoices = JSON.parse(localStorage.getItem(userKey('recim_invoices')) || '[]');
            if (invoices.length > 0) {
                const invRows = [];
                invoices.forEach(inv => {
                    const items = inv.items || [];
                    items.forEach(item => {
                        invRows.push({
                            ID: inv.id,
                            Fecha: inv.date,
                            Cliente: inv.client || inv.company || '—',
                            Tipo: inv.type || 'basic',
                            Material: item.name || item.desc || '',
                            Cantidad: item.qty || 0,
                            Unidad: item.unit || 'kg',
                            Precio_Compra: item.priceBuy || item.uprice || 0,
                            Precio_Venta: item.priceSell || 0,
                            Subtotal: (item.qty || 0) * (item.priceBuy || item.uprice || 0),
                            Notas: inv.notes || ''
                        });
                    });
                });
                if (invRows.length > 0) {
                    const wsInv = XLSX.utils.json_to_sheet(invRows);
                    XLSX.utils.book_append_sheet(wb, wsInv, 'Facturas');
                    sheetsAdded++;
                }
            }
        }

        // 2. Ingresos
        if (selection.income) {
            const ingresos = JSON.parse(localStorage.getItem(userKey('recim_ingresos')) || '[]');
            if (ingresos.length > 0) {
                const wsInc = XLSX.utils.json_to_sheet(ingresos.map(i => ({
                    ID: i.id,
                    Fecha: i.date,
                    Concepto: i.concept,
                    Monto: i.amount,
                    Categoria: i.category || 'General'
                })));
                XLSX.utils.book_append_sheet(wb, wsInc, 'Ingresos');
                sheetsAdded++;
            }
        }

        // 3. Egresos
        if (selection.expenses) {
            const egresos = JSON.parse(localStorage.getItem(userKey('recim_egresos')) || '[]');
            if (egresos.length > 0) {
                const wsExp = XLSX.utils.json_to_sheet(egresos.map(e => ({
                    ID: e.id,
                    Fecha: e.date,
                    Concepto: e.concept,
                    Monto: e.amount,
                    Categoria: e.category || 'General'
                })));
                XLSX.utils.book_append_sheet(wb, wsExp, 'Egresos');
                sheetsAdded++;
            }
        }

        // 4. Materiales
        if (selection.materials) {
            const mats = (typeof getMaterialCodes === 'function') ? getMaterialCodes() : [];
            if (mats.length > 0) {
                const wsMat = XLSX.utils.json_to_sheet(mats.map(m => ({
                    Código: m.id || m.code || '',
                    Nombre: m.name || '',
                    Unidad: m.unit || 'kg'
                })));
                XLSX.utils.book_append_sheet(wb, wsMat, 'Catálogo_Materiales');
                sheetsAdded++;
            }
        }

        if (sheetsAdded === 0) {
            showToast('⚠️ No hay datos para exportar en las categorías seleccionadas', 'warning');
            return;
        }

        const fileName = `Reciminsa_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        showToast('✅ Excel generado correctamente', 'success');

    } catch (err) {
        console.error('Custom Export Error:', err);
        showToast('❌ Error al exportar datos', 'error');
    }
}

/**
 * Importa datos desde un archivo Excel y los guarda en la app.
 * @param {File} file - El archivo subido por el usuario.
 */
function importExcelData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            let importedCount = 0;

            // Procesar cada pestaña conocida
            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(sheet);

                if (sheetName === 'Facturas') {
                    // Agrupar filas por ID para reconstruir facturas
                    const invMap = {};
                    rows.forEach(r => {
                        if (!invMap[r.ID]) {
                            invMap[r.ID] = {
                                id: r.ID,
                                date: r.Fecha,
                                client: r.Cliente,
                                type: r.Tipo,
                                notes: r.Notas,
                                items: [],
                                createdAt: new Date().toISOString()
                            };
                        }
                        invMap[r.ID].items.push({
                            name: r.Material,
                            qty: parseFloat(r.Cantidad),
                            unit: r.Unidad,
                            priceBuy: parseFloat(r.Precio_Compra),
                            priceSell: parseFloat(r.Precio_Venta)
                        });
                    });
                    localStorage.setItem('recim_invoices', JSON.stringify(Object.values(invMap)));
                    importedCount++;
                }

                if (sheetName === 'Ingresos') {
                    const mapped = rows.map(r => ({
                        id: r.ID || 'INC-' + Date.now() + Math.random(),
                        date: r.Fecha,
                        concept: r.Concepto,
                        amount: parseFloat(r.Monto),
                        category: r.Categoria || 'Importado'
                    }));
                    localStorage.setItem('recim_ingresos', JSON.stringify(mapped));
                    importedCount++;
                }

                if (sheetName === 'Egresos') {
                    const mapped = rows.map(r => ({
                        id: r.ID || 'EXP-' + Date.now() + Math.random(),
                        date: r.Fecha,
                        concept: r.Concepto,
                        amount: parseFloat(r.Monto),
                        category: r.Categoria || 'Importado'
                    }));
                    localStorage.setItem('recim_egresos', JSON.stringify(mapped));
                    importedCount++;
                }
            }

            if (importedCount > 0) {
                // Forzar sincronización con la nube
                if (window.forceSync) await window.forceSync();
                showToast(t('toast.import_success'), 'success');
                // Recargar página actual para ver cambios
                if (typeof rerenderCurrentPage === 'function') rerenderCurrentPage();
            } else {
                showToast('⚠️ No se encontraron pestañas válidas para importar', 'warning');
            }

        } catch (err) {
            console.error('Import Error:', err);
            showToast(t('toast.import_error'), 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}
