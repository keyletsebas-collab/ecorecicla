#!/usr/bin/env node
/**
 * ReciBot Neo Quantized Int8 JS Runtime (Node verification + parity check)
 */
const fs = require('fs');
const path = require('path');

function fnv1a32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function normalizeAscii(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function encodeText(text, vocab, maxSeqLen = 32) {
  const wordToId = vocab.word_to_id;
  const oovStart = vocab.oov_bucket_start || 11808;
  const oovMask = Math.max(1, (vocab.oov_num_buckets || 8192) - 1);
  const clean = normalizeAscii(text);
  const tokens = clean ? clean.split(/\s+/) : [];
  const ids = new Int32Array(maxSeqLen);
  const mask = new Int32Array(maxSeqLen);
  ids[0] = 2; // <CLS>
  mask[0] = 1;
  let len = 1;
  for (const tok of tokens) {
    if (len >= maxSeqLen - 1) break;
    ids[len] = (wordToId[tok] !== undefined) ? wordToId[tok] : (oovStart + (fnv1a32(tok) & oovMask));
    mask[len] = 1;
    len++;
  }
  if (len < maxSeqLen) {
    ids[len] = 3; // <SEP>
    mask[len] = 1;
  }
  return { ids, mask };
}

function decodeInt8Tensor(entry) {
  const raw = Buffer.from(entry.q_b64, 'base64');
  const out = new Float32Array(raw.length);
  const s = entry.scale;
  for (let i = 0; i < raw.length; i++) {
    const signed = raw[i] > 127 ? raw[i] - 256 : raw[i];
    out[i] = signed * s;
  }
  return out;
}

function geluTanh(x) {
  return 0.5 * x * (1.0 + Math.tanh(0.7978845608028654 * (x + 0.044715 * x * x * x)));
}

function layerNormSeq(input, w, b, T, D) {
  const out = new Float32Array(T * D);
  for (let t = 0; t < T; t++) {
    const off = t * D;
    let mean = 0;
    for (let d = 0; d < D; d++) mean += input[off + d];
    mean /= D;
    let varSum = 0;
    for (let d = 0; d < D; d++) {
      const df = input[off + d] - mean;
      varSum += df * df;
    }
    const inv = 1.0 / Math.sqrt(varSum / D + 1e-5);
    for (let d = 0; d < D; d++) {
      out[off + d] = ((input[off + d] - mean) * inv) * w[d] + b[d];
    }
  }
  return out;
}

function linearSeq(input, W, b, T, inD, outD) {
  const out = new Float32Array(T * outD);
  for (let t = 0; t < T; t++) {
    const xOff = t * inD;
    const yOff = t * outD;
    for (let o = 0; o < outD; o++) {
      const wOff = o * inD;
      let acc = b[o];
      for (let i = 0; i < inD; i++) acc += input[xOff + i] * W[wOff + i];
      out[yOff + o] = acc;
    }
  }
  return out;
}

function runStandalone() {
  const root = path.resolve(__dirname, '../..');
  const weightsJson = JSON.parse(fs.readFileSync(path.join(root, 'recibot-neo/artifacts/weights_int8.json'), 'utf8'));
  const vocab = JSON.parse(fs.readFileSync(path.join(root, 'shared/vocab.json'), 'utf8'));
  const tax = JSON.parse(fs.readFileSync(path.join(root, 'shared/taxonomy.json'), 'utf8'));

  const dec = {};
  for (const [k, v] of Object.entries(weightsJson)) dec[k] = decodeInt8Tensor(v);

  const T = vocab.max_seq_len || tax.max_seq_len || 32;
  const tokShape = weightsJson['tok_emb.weight'].shape;
  const posShape = weightsJson['pos_emb.weight'].shape;
  const ffnShape = weightsJson['blocks.0.ffn1.weight'].shape;
  const E = tokShape[1] || 14;
  const D = posShape[1] || 112;
  const H = 4;
  const HD = Math.floor(D / H);
  const F = ffnShape[0] || 220;
  const L_N = Object.keys(weightsJson).filter(k => k.endsWith('.ln1.weight')).length || 2;

  function infer(text) {
    const t0 = performance.now();
    const { ids, mask } = encodeText(text, vocab, T);
    const x = new Float32Array(T * D);
    const tokEmb = dec['tok_emb.weight'];
    const tokProj = dec['tok_proj.weight'];
    const posEmb = dec['pos_emb.weight'];
    for (let t = 0; t < T; t++) {
      const tid = ids[t];
      if (tokProj) {
        const eOff = tid * E;
        for (let d = 0; d < D; d++) {
          const pOff = d * E;
          let acc = 0;
          for (let e = 0; e < E; e++) acc += tokEmb[eOff + e] * tokProj[pOff + e];
          x[t * D + d] = acc + posEmb[t * D + d];
        }
      } else {
        for (let d = 0; d < D; d++) x[t * D + d] = tokEmb[tid * D + d] + posEmb[t * D + d];
      }
    }

    for (let l = 0; l < L_N; l++) {
      const xn = layerNormSeq(x, dec[`blocks.${l}.ln1.weight`], dec[`blocks.${l}.ln1.bias`], T, D);
      const Q = linearSeq(xn, dec[`blocks.${l}.wq.weight`], dec[`blocks.${l}.wq.bias`], T, D, D);
      const K = linearSeq(xn, dec[`blocks.${l}.wk.weight`], dec[`blocks.${l}.wk.bias`], T, D, D);
      const V = linearSeq(xn, dec[`blocks.${l}.wv.weight`], dec[`blocks.${l}.wv.bias`], T, D, D);
      const cat = new Float32Array(T * D);
      const sc = new Float32Array(T);
      const invSqrt = 1.0 / Math.sqrt(HD);
      for (let t1 = 0; t1 < T; t1++) {
        for (let h = 0; h < H; h++) {
          const hOff = h * HD;
          let maxS = -1e9;
          for (let t2 = 0; t2 < T; t2++) {
            if (!mask[t2]) {
              sc[t2] = -1e9;
            } else {
              let dot = 0;
              for (let k = 0; k < HD; k++) dot += Q[t1 * D + hOff + k] * K[t2 * D + hOff + k];
              sc[t2] = dot * invSqrt;
            }
            if (sc[t2] > maxS) maxS = sc[t2];
          }
          let sumE = 0;
          for (let t2 = 0; t2 < T; t2++) {
            sc[t2] = Math.exp(sc[t2] - maxS);
            sumE += sc[t2];
          }
          const invE = 1.0 / sumE;
          for (let t2 = 0; t2 < T; t2++) {
            const wt = sc[t2] * invE;
            for (let k = 0; k < HD; k++) cat[t1 * D + hOff + k] += wt * V[t2 * D + hOff + k];
          }
        }
      }
      const wo = linearSeq(cat, dec[`blocks.${l}.wo.weight`], dec[`blocks.${l}.wo.bias`], T, D, D);
      for (let i = 0; i < x.length; i++) x[i] += wo[i];

      const xn2 = layerNormSeq(x, dec[`blocks.${l}.ln2.weight`], dec[`blocks.${l}.ln2.bias`], T, D);
      const ff1 = linearSeq(xn2, dec[`blocks.${l}.ffn1.weight`], dec[`blocks.${l}.ffn1.bias`], T, D, F);
      for (let i = 0; i < ff1.length; i++) ff1[i] = geluTanh(ff1[i]);
      const ff2 = linearSeq(ff1, dec[`blocks.${l}.ffn2.weight`], dec[`blocks.${l}.ffn2.bias`], T, F, D);
      for (let i = 0; i < x.length; i++) x[i] += ff2[i];
    }

    const xOut = layerNormSeq(x, dec['norm_out.weight'], dec['norm_out.bias'], T, D);
    let actCnt = 0;
    for (let t = 0; t < T; t++) actCnt += mask[t];
    const invCnt = 1.0 / Math.max(1, actCnt);
    const pooled = new Float32Array(D);
    for (let d = 0; d < D; d++) {
      let sm = 0;
      for (let t = 0; t < T; t++) if (mask[t]) sm += xOut[t * D + d];
      pooled[d] = 0.5 * xOut[d] + 0.5 * (sm * invCnt);
    }

    const ilog = linearSeq(pooled, dec['intent_head.weight'], dec['intent_head.bias'], 1, D, tax.intents.length);
    let bestIdx = 0;
    for (let i = 1; i < ilog.length; i++) if (ilog[i] > ilog[bestIdx]) bestIdx = i;
    let sumExp = 0;
    for (let i = 0; i < ilog.length; i++) sumExp += Math.exp(ilog[i] - ilog[bestIdx]);
    return {
      intent: tax.intents[bestIdx].name,
      confidence: Number((1.0 / sumExp).toFixed(4)),
      latencyMs: Number((performance.now() - t0).toFixed(3)),
    };
  }

  console.log('=== RECIBOT NEO JS INT8 TRANSFORMER RUNTIME ===');
  for (const q of [
    'quien eres argon auditor y cuantos parametros tienes',
    'auditar toda la aplicacion y secuencias ncf',
    'ver los datos de todas las sucursales',
    'activar los 2 botones del centro de control en ajustes',
    'si un cliente devuelve mercancia a los 45 dias pierdo el itbis en b04',
    'que riesgos legales tengo si compro cobre en efectivo sin cedula',
  ]) {
    console.log(q, '=>', infer(q));
  }
}

if (require.main === module) runStandalone();
