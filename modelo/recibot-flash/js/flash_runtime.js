#!/usr/bin/env node
/**
 * ReciBot Flash Quantized Int8 JS Runtime (Node verification + latency benchmark)
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
  const oovStart = vocab.oov_bucket_start || 1872;
  const oovMask = Math.max(1, (vocab.oov_num_buckets || 128) - 1);
  const clean = normalizeAscii(text);
  const tokens = clean ? clean.split(/\s+/) : [];
  const ids = new Int32Array(maxSeqLen);
  ids[0] = 2;
  let len = 1;
  for (const tok of tokens) {
    if (len >= maxSeqLen - 1) break;
    ids[len++] = (wordToId[tok] !== undefined) ? wordToId[tok] : (oovStart + (fnv1a32(tok) & oovMask));
  }
  if (len < maxSeqLen) ids[len++] = 3;
  return { ids, activeLen: len };
}

function decodeInt8Tensor(entry) {
  const raw = Buffer.from(entry.q_b64, 'base64');
  const out = new Float32Array(raw.length);
  const s = entry.scale;
  for (let i = 0; i < raw.length; i++) {
    out[i] = (raw[i] > 127 ? raw[i] - 256 : raw[i]) * s;
  }
  return out;
}

function runStandalone() {
  const root = path.resolve(__dirname, '../..');
  const weightsJson = JSON.parse(fs.readFileSync(path.join(root, 'recibot-flash/artifacts/weights_int8.json'), 'utf8'));
  const vocab = JSON.parse(fs.readFileSync(path.join(root, 'shared/vocab.json'), 'utf8'));
  const tax = JSON.parse(fs.readFileSync(path.join(root, 'shared/taxonomy.json'), 'utf8'));

  const tokEmb = decodeInt8Tensor(weightsJson['tok_emb.weight']);
  const fc1W = decodeInt8Tensor(weightsJson['fc1.weight']);
  const fc1B = decodeInt8Tensor(weightsJson['fc1.bias']);
  const intW = decodeInt8Tensor(weightsJson['intent_head.weight']);
  const intB = decodeInt8Tensor(weightsJson['intent_head.bias']);

  const T = vocab.max_seq_len || tax.max_seq_len || 32;
  const D = weightsJson['tok_emb.weight'].shape[1] || 48;
  const F = D * 2;
  const H = weightsJson['fc1.weight'].shape[0] || 72;
  const C = tax.intents.length;

  function infer(text) {
    const t0 = performance.now();
    const { ids, activeLen } = encodeText(text, vocab, T);
    const feat = new Float32Array(F);
    for (let d = 0; d < D; d++) feat[D + d] = -1e9;
    for (let t = 0; t < activeLen; t++) {
      const off = ids[t] * D;
      for (let d = 0; d < D; d++) {
        const v = tokEmb[off + d];
        feat[d] += v;
        if (v > feat[D + d]) feat[D + d] = v;
      }
    }
    const inv = 1.0 / Math.max(1, activeLen);
    for (let d = 0; d < D; d++) feat[d] *= inv;

    const hid = new Float32Array(H);
    for (let h = 0; h < H; h++) {
      const wOff = h * F;
      let acc = fc1B[h];
      for (let i = 0; i < F; i++) acc += feat[i] * fc1W[wOff + i];
      hid[h] = acc > 0 ? acc : 0;
    }

    let bestI = 0, maxL = -1e9;
    const logits = new Float32Array(C);
    for (let c = 0; c < C; c++) {
      const wOff = c * H;
      let acc = intB[c];
      for (let h = 0; h < H; h++) acc += hid[h] * intW[wOff + h];
      logits[c] = acc;
      if (acc > maxL) { maxL = acc; bestI = c; }
    }
    let se = 0;
    for (let c = 0; c < C; c++) se += Math.exp(logits[c] - maxL);
    return {
      intent: tax.intents[bestI].name,
      confidence: Number((1.0 / se).toFixed(4)),
      latencyMs: Number((performance.now() - t0).toFixed(3)),
    };
  }

  console.log('=== RECIBOT FLASH JS INT8 FAST RUNTIME ===');
  for (const q of [
    'quien eres pulso agil y cuantos tokens y parametros tienes',
    'auditar toda la aplicacion y secuencias ncf',
    'ver los datos de todas las sucursales',
    'convierte 5000 lbs a kg',
    'si un cliente devuelve mercancia a los 45 dias pierdo el itbis en b04',
    'que riesgos legales tengo si compro cobre en efectivo sin cedula',
  ]) {
    console.log(q, '=>', infer(q));
  }
}

if (require.main === module) runStandalone();
