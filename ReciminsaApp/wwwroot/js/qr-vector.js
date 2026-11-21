/* =========================================================================
   QR-VECTOR.JS – Generador Vectorial ISO/IEC 18004 QR Code (Byte UTF-8, ECC M)
   Sin dependencias externas. Renderiza módulos vectoriales nítidos en jsPDF
   y calcula códigos deterministas de verificación offline para certificados.
   ========================================================================= */

(function initVectorQRModule() {
    const GF_EXP = new Uint8Array(512);
    const GF_LOG = new Uint8Array(256);

    (function buildGaloisTables() {
        let x = 1;
        for (let i = 0; i < 255; i++) {
            GF_EXP[i] = x;
            GF_LOG[x] = i;
            x <<= 1;
            if (x & 0x100) x ^= 0x11d;
        }
        for (let i = 255; i < 512; i++) {
            GF_EXP[i] = GF_EXP[i - 255];
        }
    })();

    function gfMul(a, b) {
        if (a === 0 || b === 0) return 0;
        return GF_EXP[GF_LOG[a] + GF_LOG[b]];
    }

    function computeReedSolomonRemainder(dataBytes, ecCount) {
        let gen = [1];
        for (let i = 0; i < ecCount; i++) {
            const next = new Array(gen.length + 1).fill(0);
            const root = GF_EXP[i];
            for (let j = 0; j < gen.length; j++) {
                next[j] ^= gen[j];
                next[j + 1] ^= gfMul(gen[j], root);
            }
            gen = next;
        }

        const work = new Uint8Array(dataBytes.length + ecCount);
        work.set(dataBytes, 0);

        for (let i = 0; i < dataBytes.length; i++) {
            const factor = work[i];
            if (factor !== 0) {
                for (let j = 0; j < gen.length; j++) {
                    work[i + j] ^= gfMul(gen[j], factor);
                }
            }
        }
        return Array.from(work.slice(dataBytes.length));
    }

    // Tablas ISO/IEC 18004 para Nivel de Corrección M (15% recuperación), Versiones 1..12
    const QR_LEVEL_M_SPECS = {
        1:  { ec: 10, groups: [[1, 16]], rem: 0, align: [] },
        2:  { ec: 16, groups: [[1, 28]], rem: 7, align: [6, 18] },
        3:  { ec: 26, groups: [[1, 44]], rem: 7, align: [6, 22] },
        4:  { ec: 18, groups: [[2, 32]], rem: 7, align: [6, 26] },
        5:  { ec: 24, groups: [[2, 43]], rem: 7, align: [6, 30] },
        6:  { ec: 16, groups: [[4, 27]], rem: 7, align: [6, 34] },
        7:  { ec: 18, groups: [[4, 31]], rem: 0, align: [6, 22, 38] },
        8:  { ec: 22, groups: [[2, 38], [2, 39]], rem: 0, align: [6, 24, 42] },
        9:  { ec: 22, groups: [[3, 36], [2, 37]], rem: 0, align: [6, 26, 46] },
        10: { ec: 26, groups: [[4, 43], [1, 44]], rem: 0, align: [6, 28, 50] },
        11: { ec: 30, groups: [[1, 50], [4, 51]], rem: 0, align: [6, 30, 54] },
        12: { ec: 22, groups: [[6, 36], [2, 37]], rem: 0, align: [6, 32, 58] }
    };

    function encodeUtf8Bytes(str) {
        const text = String(str ?? '');
        if (typeof TextEncoder !== 'undefined') {
            return Array.from(new TextEncoder().encode(text));
        }
        const utf8 = unescape(encodeURIComponent(text));
        const out = [];
        for (let i = 0; i < utf8.length; i++) {
            out.push(utf8.charCodeAt(i) & 0xff);
        }
        return out;
    }

    function chooseVersionForBytePayload(byteLen) {
        for (let v = 1; v <= 12; v++) {
            const spec = QR_LEVEL_M_SPECS[v];
            const dataCap = spec.groups.reduce((sum, [count, size]) => sum + count * size, 0);
            const lenBits = v >= 10 ? 16 : 8;
            const requiredBits = 4 + lenBits + byteLen * 8;
            if (requiredBits <= dataCap * 8) {
                return { version: v, spec, dataCap, lenBits };
            }
        }
        throw new Error(`QR payload (${byteLen} bytes) exceeds Version 12 Level M capacity`);
    }

    function pushBits(target, value, bitCount) {
        for (let i = bitCount - 1; i >= 0; i--) {
            target.push((value >>> i) & 1);
        }
    }

    function buildInterleavedBitStream(bytes, version, spec, dataCap, lenBits) {
        const bits = [];
        pushBits(bits, 0b0100, 4); // Modo Byte
        pushBits(bits, bytes.length, lenBits);
        bytes.forEach(b => pushBits(bits, b, 8));

        const maxDataBits = dataCap * 8;
        const termLen = Math.min(4, maxDataBits - bits.length);
        for (let i = 0; i < termLen; i++) bits.push(0);
        while (bits.length % 8 !== 0) bits.push(0);

        const dataCodewords = [];
        for (let i = 0; i < bits.length; i += 8) {
            let byteVal = 0;
            for (let b = 0; b < 8; b++) {
                byteVal = (byteVal << 1) | bits[i + b];
            }
            dataCodewords.push(byteVal);
        }

        const pads = [0xec, 0x11];
        let padIdx = 0;
        while (dataCodewords.length < dataCap) {
            dataCodewords.push(pads[padIdx % 2]);
            padIdx++;
        }

        const blocks = [];
        let offset = 0;
        spec.groups.forEach(([count, blockDataLen]) => {
            for (let i = 0; i < count; i++) {
                const slice = dataCodewords.slice(offset, offset + blockDataLen);
                offset += blockDataLen;
                blocks.push({
                    data: slice,
                    ec: computeReedSolomonRemainder(slice, spec.ec)
                });
            }
        });

        const maxBlockDataLen = Math.max(...blocks.map(b => b.data.length));
        const finalBits = [];

        for (let i = 0; i < maxBlockDataLen; i++) {
            for (const blk of blocks) {
                if (i < blk.data.length) pushBits(finalBits, blk.data[i], 8);
            }
        }
        for (let i = 0; i < spec.ec; i++) {
            for (const blk of blocks) {
                pushBits(finalBits, blk.ec[i], 8);
            }
        }
        for (let i = 0; i < spec.rem; i++) {
            finalBits.push(0);
        }
        return finalBits;
    }

    function createEmptyMatrix(size, fill) {
        return Array.from({ length: size }, () => Array(size).fill(fill));
    }

    function setFunctionModule(modules, isFunc, r, c, dark) {
        if (r < 0 || c < 0 || r >= modules.length || c >= modules.length) return;
        modules[r][c] = Boolean(dark);
        isFunc[r][c] = true;
    }

    function drawFinderWithSeparator(modules, isFunc, topR, leftC) {
        const size = modules.length;
        for (let dr = -1; dr <= 7; dr++) {
            for (let dc = -1; dc <= 7; dc++) {
                const r = topR + dr;
                const c = leftC + dc;
                if (r < 0 || c < 0 || r >= size || c >= size) continue;
                const inFinder = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
                const dark = inFinder && (
                    dr === 0 || dr === 6 || dc === 0 || dc === 6 ||
                    (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4)
                );
                setFunctionModule(modules, isFunc, r, c, dark);
            }
        }
    }

    function drawAlignmentPattern(modules, isFunc, centerR, centerC) {
        for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
                const dist = Math.max(Math.abs(dr), Math.abs(dc));
                setFunctionModule(modules, isFunc, centerR + dr, centerC + dc, dist !== 1);
            }
        }
    }

    function getFormatInfoBits(maskId) {
        // Nivel M = 0b00
        const data = (0b00 << 3) | (maskId & 0x7);
        let rem = data << 10;
        for (let i = 14; i >= 10; i--) {
            if ((rem >>> i) & 1) rem ^= (0x537 << (i - 10));
        }
        return ((data << 10) | rem) ^ 0x5412;
    }

    function writeFormatInfo(modules, isFunc, maskId) {
        const size = modules.length;
        const fmt = getFormatInfoBits(maskId);

        for (let i = 0; i < 15; i++) {
            const dark = ((fmt >>> i) & 1) === 1;
            // Primera copia (alrededor del finder superior izquierdo, LSB a MSB)
            if (i < 6) setFunctionModule(modules, isFunc, i, 8, dark);
            else if (i < 8) setFunctionModule(modules, isFunc, i + 1, 8, dark);
            else if (i === 8) setFunctionModule(modules, isFunc, 8, 7, dark);
            else setFunctionModule(modules, isFunc, 8, 14 - i, dark);

            // Segunda copia (vertical inferior-izq + horizontal superior-der)
            if (i < 8) setFunctionModule(modules, isFunc, 8, size - 1 - i, dark);
            else setFunctionModule(modules, isFunc, size - 15 + i, 8, dark);
        }
    }

    function writeVersionInfo(modules, isFunc, version) {
        if (version < 7) return;
        const size = modules.length;
        let rem = version << 12;
        for (let i = 17; i >= 12; i--) {
            if ((rem >>> i) & 1) rem ^= (0x1f25 << (i - 12));
        }
        const verBits = (version << 12) | rem;

        for (let i = 0; i < 18; i++) {
            const dark = ((verBits >>> i) & 1) === 1;
            const a = Math.floor(i / 3);
            const b = size - 11 + (i % 3);
            setFunctionModule(modules, isFunc, b, a, dark);
            setFunctionModule(modules, isFunc, a, b, dark);
        }
    }

    const MASK_FNS = [
        (r, c) => (r + c) % 2 === 0,
        (r) => r % 2 === 0,
        (_, c) => c % 3 === 0,
        (r, c) => (r + c) % 3 === 0,
        (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
        (r, c) => ((r * c) % 2 + (r * c) % 3) === 0,
        (r, c) => (((r * c) % 2 + (r * c) % 3) % 2) === 0,
        (r, c) => (((r + c) % 2 + (r * c) % 3) % 2) === 0
    ];

    function applyMask(baseModules, isFunc, maskId) {
        const size = baseModules.length;
        const maskFn = MASK_FNS[maskId];
        const masked = baseModules.map((row, r) => row.map((val, c) => (
            isFunc[r][c] ? val : (maskFn(r, c) ? !val : val)
        )));
        writeFormatInfo(masked, createEmptyMatrix(size, false), maskId);
        return masked;
    }

    function scorePenalty(modules) {
        const size = modules.length;
        let penalty = 0;

        // N1 + N3 por filas y columnas
        for (let dir = 0; dir < 2; dir++) {
            for (let i = 0; i < size; i++) {
                let runColor = null;
                let runLen = 0;
                const line = [];
                for (let j = 0; j < size; j++) {
                    const bit = dir === 0 ? modules[i][j] : modules[j][i];
                    line.push(bit ? 1 : 0);
                    if (bit === runColor) {
                        runLen++;
                    } else {
                        if (runLen >= 5) penalty += 3 + (runLen - 5);
                        runColor = bit;
                        runLen = 1;
                    }
                }
                if (runLen >= 5) penalty += 3 + (runLen - 5);

                const s = line.join('');
                for (let k = 0; k <= s.length - 11; k++) {
                    const sub = s.slice(k, k + 11);
                    if (sub === '10111010000' || sub === '00001011101') penalty += 40;
                }
            }
        }

        // N2: bloques 2x2 iguales
        for (let r = 0; r < size - 1; r++) {
            for (let c = 0; c < size - 1; c++) {
                const v = modules[r][c];
                if (modules[r][c + 1] === v && modules[r + 1][c] === v && modules[r + 1][c + 1] === v) {
                    penalty += 3;
                }
            }
        }

        // N4: proporción de módulos oscuros respecto a 50%
        let darkCount = 0;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (modules[r][c]) darkCount++;
            }
        }
        const pct = (darkCount * 100) / (size * size);
        const k = Math.floor(Math.abs(pct - 50) / 5);
        penalty += k * 10;

        return penalty;
    }

    /**
     * Genera la matriz booleana de un código QR ISO/IEC 18004 (Byte UTF-8, ECC Nivel M).
     * @param {string} text Texto o payload a codificar.
     * @returns {{ version: number, size: number, mask: number, modules: boolean[][] }}
     */
    function generateQRMatrix(text) {
        const bytes = encodeUtf8Bytes(text);
        const { version, spec, dataCap, lenBits } = chooseVersionForBytePayload(bytes.length);
        const finalBits = buildInterleavedBitStream(bytes, version, spec, dataCap, lenBits);

        const size = 17 + 4 * version;
        const base = createEmptyMatrix(size, false);
        const isFunc = createEmptyMatrix(size, false);

        // Finders + separadores
        drawFinderWithSeparator(base, isFunc, 0, 0);
        drawFinderWithSeparator(base, isFunc, 0, size - 7);
        drawFinderWithSeparator(base, isFunc, size - 7, 0);

        // Patrones de alineamiento
        const pts = spec.align;
        for (const cr of pts) {
            for (const cc of pts) {
                const nearTopLeft = cr <= 8 && cc <= 8;
                const nearTopRight = cr <= 8 && cc >= size - 8;
                const nearBottomLeft = cr >= size - 8 && cc <= 8;
                if (!nearTopLeft && !nearTopRight && !nearBottomLeft) {
                    drawAlignmentPattern(base, isFunc, cr, cc);
                }
            }
        }

        // Patrones de sincronización (timing)
        for (let i = 8; i < size - 8; i++) {
            setFunctionModule(base, isFunc, 6, i, i % 2 === 0);
            setFunctionModule(base, isFunc, i, 6, i % 2 === 0);
        }

        // Módulo oscuro fijo
        setFunctionModule(base, isFunc, size - 8, 8, true);

        // Reservar formato y versión antes de colocar los datos
        writeFormatInfo(base, isFunc, 0);
        writeVersionInfo(base, isFunc, version);

        // Colocación en zigzag de datos + ECC
        let bitIdx = 0;
        for (let right = size - 1; right >= 1; right -= 2) {
            if (right === 6) right = 5;
            for (let vert = 0; vert < size; vert++) {
                const upward = ((right + 1) & 2) === 0;
                const r = upward ? (size - 1 - vert) : vert;
                for (let j = 0; j < 2; j++) {
                    const c = right - j;
                    if (!isFunc[r][c]) {
                        base[r][c] = bitIdx < finalBits.length ? (finalBits[bitIdx] === 1) : false;
                        bitIdx++;
                    }
                }
            }
        }

        // Evaluar las 8 máscaras y elegir la de menor penalización
        let bestMask = 0;
        let bestScore = Infinity;
        let bestModules = null;
        for (let mask = 0; mask < 8; mask++) {
            const candidate = applyMask(base, isFunc, mask);
            const score = scorePenalty(candidate);
            if (score < bestScore) {
                bestScore = score;
                bestMask = mask;
                bestModules = candidate;
            }
        }

        return {
            version,
            size,
            mask: bestMask,
            modules: bestModules
        };
    }

    /**
     * Dibuja un código QR vectorial en un documento jsPDF con zona tranquila blanca.
     */
    function drawVectorQRCode(doc, text, x, y, sizeMm, opts = {}) {
        if (!doc || typeof doc.rect !== 'function') return null;
        const qr = generateQRMatrix(text);
        const quietModules = typeof opts.quietModules === 'number' ? opts.quietModules : 2;
        const bgColor = opts.bgColor || [255, 255, 255];
        const fgColor = opts.fgColor || [15, 23, 42];

        const totalModules = qr.size + quietModules * 2;
        const modSize = sizeMm / totalModules;

        doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
        doc.rect(x, y, sizeMm, sizeMm, 'F');

        doc.setFillColor(fgColor[0], fgColor[1], fgColor[2]);
        for (let r = 0; r < qr.size; r++) {
            const row = qr.modules[r];
            let runStart = -1;
            for (let c = 0; c <= qr.size; c++) {
                const isDark = c < qr.size && row[c];
                if (isDark && runStart === -1) {
                    runStart = c;
                } else if (!isDark && runStart !== -1) {
                    const runCols = c - runStart;
                    doc.rect(
                        x + (quietModules + runStart) * modSize,
                        y + (quietModules + r) * modSize,
                        runCols * modSize + 0.01,
                        modSize + 0.01,
                        'F'
                    );
                    runStart = -1;
                }
            }
        }

        return qr;
    }

    /**
     * Genera un sello determinista de integridad (VER-XXXXXXXX) a partir del contenido.
     */
    function computeVerificationCode(payload) {
        const bytes = encodeUtf8Bytes(payload);
        let h1 = 0x811c9dc5;
        let h2 = 0x9e3779b1;
        for (let i = 0; i < bytes.length; i++) {
            const b = bytes[i];
            h1 ^= b;
            h1 = Math.imul(h1, 0x01000193) >>> 0;
            h2 = Math.imul(h2 ^ (b + ((i * 17) & 0xff)), 0x85ebca6b) >>> 0;
        }
        const combined = ((h1 >>> 0).toString(36) + (h2 >>> 0).toString(36)).toUpperCase();
        return `VER-${combined.padStart(8, '0').slice(0, 8)}`;
    }

    if (typeof window !== 'undefined') {
        window.generateQRMatrix = generateQRMatrix;
        window.drawVectorQRCode = drawVectorQRCode;
        window.computeVerificationCode = computeVerificationCode;
    }
})();
