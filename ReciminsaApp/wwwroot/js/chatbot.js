/* ==========================================================================
   CHATBOT.JS – ReciBot Dual-Model Conversational & Legal Assistant
   - Powered by js/recibot-models.js v2 (42 intents: 32 app + 10 corporate legal,
     768-token vocab, MAX_SEQ_LEN=32, 75-doc Hybrid BM25 + 64D Vector RAG).
   - ReciBot Neo: Multi-clause decomposition, rolling conversation memory,
     scenario & legal analyzer, customizable clause drafter, live compliance
     verification across 13 tools, and collapsible reasoning trace.
   - ReciBot Flash: Ultra-fast distilled single-pass responses & calculators.
   ========================================================================== */

const CHATBOT_API_CONFIG = {
  provider: 'local-dual-neural',
  endpoint: '',
  apiKey: '',
  defaultModel: 'neo',
  models: {
    neo: 'recibot-neo (Transformer+LoRA+DPO+HybridRAG v2)',
    flash: 'recibot-flash (Distilled FastNet+HybridRAG v2)',
  },
};

const RECIBOT_STORAGE_KEY = 'recibot_active_model';

const INTENT_DEFAULT_PAGE = {
  audit_full_app: 'historial',
  audit_dgii_ncf: 'manejo_dgii',
  dgii_reports_606_607_608: 'manejo_dgii',
  dgii_rnc_lookup: 'manejo_dgii',
  invoice_create_help: { page: 'facturas', subTab: 'facturas', label: 'Facturas' },
  invoice_summary_live: 'historial',
  bitacora_create_help: 'bitacoras',
  bitacora_summary_live: 'bitacoras',
  quote_help_and_live: { page: 'facturas', subTab: 'cotizaciones', label: 'Cotizaciones' },
  dispatch_conduce_help: { page: 'facturas', subTab: 'despachos', label: 'Despachos' },
  returns_credit_debit_notes: 'nota_credito',
  branches_overview_live: 'historial',
  clients_manage_live: 'clientes',
  materials_families_audit: 'codigos',
  market_prices_margin: 'codigos',
  finance_cashflow_live: 'ingresos',
  tax_math_calculator: { page: 'facturas', subTab: 'facturas', label: 'Facturas' },
  unit_converter: 'bitacoras',
  routes_agenda_live: 'rutas',
  collaborators_roles_live: 'colaboradores',
  pdf_printing_layout: 'ajustes',
  android_control_center: 'ajustes',
  supabase_sync_delete: 'ajustes',
  gdrive_backup_excel: 'ajustes',
  security_biometric_legal: 'ajustes',
  white_label_settings: 'parametrizaciones_empresa',
  ecology_impact_live: 'ecologia',
  system_health_check: 'ajustes',
  navigate_or_open_tool: { page: 'facturas', subTab: 'facturas', label: 'Facturas' },
  // 10 Corporate & Business Legal Intents
  legal_tax_code_ncf: 'manejo_dgii',
  legal_ecf_electronic_invoicing: 'manejo_dgii',
  legal_retentions_itbis_isr: 'manejo_dgii',
  legal_environmental_waste: 'bitacoras',
  legal_corporate_branches_rnc: 'parametrizaciones_empresa',
  legal_commercial_contracts_docs: { page: 'facturas', subTab: 'facturas', label: 'Facturas y Cotizaciones' },
  legal_labor_tss_safety: 'colaboradores',
  legal_data_privacy_cyber: 'ajustes',
  legal_aml_scrap_compliance: 'bitacoras',
  legal_audit_risk_scenario: 'manejo_dgii',
};

const VALID_APP_PAGES = [
  'historial',
  'bitacoras',
  'rutas',
  'facturas',
  'nota_credito',
  'nota_debito',
  'manejo_dgii',
  'codigos',
  'clientes',
  'ingresos',
  'egresos',
  'ecologia',
  'colaboradores',
  'parametrizaciones_empresa',
  'ajustes',
];

const RECIBOT_MEMORY = {
  turns: [],
  activeTopic: null,
  activeTitle: null,
  activeLawRefs: [],
  activeEntities: {},
  usedFactIds: new Set(),
};

function clearReciBotMemory() {
  RECIBOT_MEMORY.turns = [];
  RECIBOT_MEMORY.activeTopic = null;
  RECIBOT_MEMORY.activeTitle = null;
  RECIBOT_MEMORY.activeLawRefs = [];
  RECIBOT_MEMORY.activeEntities = {};
  RECIBOT_MEMORY.usedFactIds = new Set();
}

function _cbEscapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _cbEscapeJsArg(str) {
  return String(str == null ? '' : str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')
    .replace(/\n/g, ' ');
}

function _getModelsApi() {
  if (typeof window !== 'undefined' && window.ReciBotModels) return window.ReciBotModels;
  if (typeof globalThis !== 'undefined' && globalThis.ReciBotModels) return globalThis.ReciBotModels;
  return null;
}

function _cbNormText(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function _cbReadJson(baseKey, fallback) {
  try {
    const scopedKey = typeof userKey === 'function' ? userKey(baseKey) : baseKey;
    const raw =
      (typeof localStorage !== 'undefined' && localStorage.getItem(scopedKey)) ||
      (typeof localStorage !== 'undefined' && localStorage.getItem(baseKey));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch (_) {
    return fallback;
  }
}

function _cbFormatMoney(amount) {
  const num = Number(amount) || 0;
  if (typeof formatMoney === 'function') {
    try {
      return formatMoney(num);
    } catch (_) {}
  }
  return `RD$ ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function _cbTodayIso() {
  return new Date().toISOString().split('T')[0];
}

function _getCompanyIdentity() {
  let name = '';
  let rnc = '';
  if (typeof getCompanyInfoForInvoices === 'function') {
    try {
      const info = getCompanyInfoForInvoices() || {};
      name = info.name || info.companyName || '';
      rnc = info.formattedRnc || info.rnc || info.companyRNC || '';
    } catch (_) {}
  }
  if (!name || !rnc) {
    const s = typeof getSettings === 'function' ? (getSettings() || {}) : _cbReadJson('recim_settings', {});
    const shared = _cbReadJson('recim_company_shared_settings', {});
    const cs = _cbReadJson('recim_company_settings', {});
    name = name || shared.companyName || cs.companyName || s.companyName || '';
    rnc = rnc || shared.companyRNC || cs.companyRNC || s.companyRNC || s.rnc || s.companyRnc || '';
  }
  return {
    name: String(name || '').trim() || '[Nombre / Razón Social de tu Empresa]',
    rnc: String(rnc || '').trim() || '[RNC 9 dígitos]',
    hasConfiguredName: Boolean(String(name || '').trim()),
    hasValidRnc: (() => {
      const d = String(rnc || '').replace(/\D/g, '');
      return d.length === 9 || d.length === 11;
    })(),
  };
}

function getReciBotModel() {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(RECIBOT_STORAGE_KEY) : null;
    if (saved === 'flash' || saved === 'neo') return saved;
  } catch (_) {}
  return CHATBOT_API_CONFIG.defaultModel || 'neo';
}

function _getModelIdentity(mode) {
  const models = _getModelsApi();
  const fromBundle = models && models.IDENTITIES && models.IDENTITIES[mode];
  if (mode === 'flash') {
    return Object.assign(
      {
        name: 'ReciBot Flash',
        codename: 'Pulso-Ágil',
        role: 'Ejecución Ultrarrápida y Asistencia Directa',
        greeting:
          'Soy ReciBot Flash (Pulso-Ágil), tu asistente de respuesta instantánea y ejecución ágil en ReciminsaApp.',
        style:
          'Directo, veloz y concreto; priorizo darte métricas clave, atajos operativos y respuestas breves sin rodeos.',
        traits: [
          'Inferencia ligera destilada desde ReciBot Neo en milisegundos',
          'Consultas rápidas de balance, facturas, rutas, envases y recordatorios legales',
          'Respuestas compactas optimizadas para operación continua en campo y oficina',
        ],
      },
      fromBundle || {}
    );
  }
  return Object.assign(
    {
      name: 'ReciBot Neo',
      codename: 'Argón-Auditor',
      role: 'Auditoría Profunda y Razonamiento Corporativo',
      greeting:
        'Soy ReciBot Neo (Argón-Auditor), tu asistente de razonamiento profundo, auditoría legal y control operativo en ReciminsaApp.',
      style:
        'Analítico, verificador en multi-paso y exhaustivo; valido consistencia financiera, comprobantes NCF/DGII y cumplimiento legal antes de concluir.',
      traits: [
        'Razonamiento multi-paso con Transformer GPT + LoRA + DPO',
        'Verificación cruzada de finanzas, inventario y cumplimiento DGII/TSS',
        'Análisis jurídico empresarial y redacción estructurada de cláusulas',
      ],
    },
    fromBundle || {}
  );
}

function _formatParamCount(n) {
  const num = Number(n || 0);
  if (!Number.isFinite(num)) return '0';
  return Math.round(num)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function _isIdentityOrSpecQuery(queryText, intent) {
  const norm = _cbNormText(queryText);
  const explicitOpOrAudit = /\b(ncf|rnc|b01|b02|b03|b04|e31|dgii|sucursal|sucursales|factura|facturas|audita|auditoria|revisa mi empresa|bitacora|cotizacion|ruta|rutas|supabase|drive|respaldo|sincroniz|inventario|envases|chofer|colaborador|cliente|clientes|itbis|isr|ley\s+\d|chatarra|cobre|metales|balance|ingresos|egresos|gastos|centro de control|ajustes|mini factura|conduce|nota de credito|nota de debito|libras|kilos|lbs|kg)\b/i.test(
    norm
  );
  if (explicitOpOrAudit) return false;
  if (intent === 'identity_capabilities') return true;
  return /\b(quien eres|tu identidad|como te llamas|cual es tu nombre|presentate|argon\s*auditor|pulso\s*agil|cuantos parametros|parametros tienes|parametros tiene|cuantos tokens|tu vocabulario|hablame de ti|cuentame de ti|que sabes sobre ti|que sabes de ti|cosas sobre ti|sobre ti mismo|que modelo eres|diferencia entre neo y flash|quien te creo|quien te hizo|quien te programo|quien es tu creador|para que app fuiste|para que fuiste creado|de que empresa eres|como te entrenaron|como fuiste entrenado|en que lenguajes|que lenguajes usas|tu arquitectura|como funcionas|necesitas internet|funcionas sin internet|eres offline|donde corres|donde vives|tienes sentimientos|tienes conciencia|eres humano|eres una persona|estas vivo|cuales son tus limites|tus limitaciones|que no puedes hacer|cual es tu precision|que tan inteligente eres|cual es tu version|tienes memoria|cuantos turnos recuerdas)\b/i.test(
    norm
  );
}

function buildIdentityResponseHtml(mode, queryText, models) {
  const activeMode = mode === 'flash' ? 'flash' : 'neo';
  const ident = _getModelIdentity(activeMode);
  const neoMeta = (models && models.NEO_METRICS) || {};
  const flashMeta = (models && models.FLASH_METRICS) || {};
  const tax = (models && models.TAXONOMY) || {};
  const ragMeta = (models && models.RAG_METRICS) || {};

  const vocabSize = neoMeta.vocab_size || tax.vocab_size || 2000;
  const maxSeqLen = neoMeta.max_seq_len || tax.max_seq_len || 32;
  const numIntents = Array.isArray(tax.intents) ? tax.intents.length : 42;
  const kbDocsCount = ragMeta.kb_docs_count || 77;

  const neoInf = Number(neoMeta.inference_parameters || 444762);
  const neoLora = Number(neoMeta.lora_trainable_parameters || 260410);
  const neoTotal = Number(neoMeta.total_params_with_lora || 690266);
  const flashParams = Number(flashMeta.parameters || 111671);
  const combinedInf = neoInf + flashParams;
  const combinedTotal = neoTotal + flashParams;

  const neoValAcc = (Number(neoMeta.val_intent_acc || 0.9966) * 100).toFixed(2);
  const flashValAcc = (Number(flashMeta.val_intent_acc || 1.0) * 100).toFixed(0);
  const neoDepthAcc = (Number(neoMeta.val_depth_acc || 1.0) * 100).toFixed(0);
  const flashAgreement = (Number(flashMeta.teacher_agreement || 0.9966) * 100).toFixed(2);
  const flashReduction = Number(flashMeta.param_reduction_vs_neo || neoInf / Math.max(1, flashParams)).toFixed(2);
  const neoRagHit3 = ((Number(((neoMeta.rag_eval || {}).hybrid_hit_rate_at_3) || 0.9365)) * 100).toFixed(2);
  const flashRagHit3 = ((Number(((flashMeta.rag_eval || {}).hybrid_hit_rate_at_3) || 0.9592)) * 100).toFixed(2);
  const neoLatUs = Number(neoMeta.python_fp32_latency_us || 1277.53).toFixed(2);
  const flashLatUs = Number(flashMeta.python_fp32_latency_us || 147.89).toFixed(2);

  const q = _cbNormText(queryText);
  const asksOrigin = /\b(quien te creo|creador|quien te hizo|quien te programo|de donde vienes|para que app|para que fuiste creado|de que empresa|proposito|por que existes)\b/i.test(
    q
  );
  const asksTraining = /\b(como te entrenaron|como fuiste entrenado|entrenamiento|arquitectura|como funcionas|como estas hecho|en que lenguajes|que lenguajes|pytorch|transformer|lora|dpo|destilacion|rag|redes neuronales|repositorios)\b/i.test(
    q
  );
  const asksParams = /\b(parametro|parametros|token|tokens|vocabulario|cuanto pesas|tamano|intenciones|documentos|cuantos datos|cuantas capas)\b/i.test(
    q
  );
  const asksOfflineMem = /\b(internet|offline|sin conexion|donde corres|donde vives|nube|servidor|privacidad|guardas mis datos|memoria|recuerdas|cuantos turnos)\b/i.test(
    q
  );
  const asksLimits = /\b(sentimiento|sentimientos|conciencia|emocion|emociones|eres humano|eres persona|estas vivo|piensas|limites|limitaciones|que no puedes|errores|te equivocas|abogado|sustituyes)\b/i.test(
    q
  );
  const asksBench = /\b(precision|exactitud|inteligente|que tan bueno|benchmark|latencia|velocidad|rapido|version|evaluacion)\b/i.test(
    q
  );
  const asksCompare = /\b(diferencia|hermano|comparacion|comparar|cual es mejor|cual elijo|neo o flash|neo y flash)\b/i.test(
    q
  );
  const asksExplicitGeneral = /\b(quien eres|tu identidad|como te llamas|cual es tu nombre|presentate|hablame de ti|cuentame de ti|que sabes sobre ti|que sabes de ti|cosas sobre ti|sobre ti mismo|que puedes hacer|argon\s*auditor|pulso\s*agil)\b/i.test(
    q
  );
  const hasNarrowFacet =
    asksOrigin || asksTraining || asksParams || asksOfflineMem || asksLimits || asksBench || asksCompare;
  const asksGeneral = asksExplicitGeneral || !hasNarrowFacet;

  const sections = [];

  if (asksGeneral) {
    const traitsHtml = Array.isArray(ident.traits)
      ? ident.traits.map((tr) => `<li>${_cbEscapeHtml(tr)}</li>`).join('')
      : '';
    sections.push(`<p>${_cbEscapeHtml(ident.greeting)}</p>`);
    sections.push(`<p><small><strong>Mi enfoque:</strong> ${_cbEscapeHtml(ident.style)}</small></p>`);
    if (traitsHtml) sections.push(`<ul>${traitsHtml}</ul>`);
    sections.push(
      `<p><small><strong>Sobre mí en resumen:</strong> Nací exclusivamente para <strong>ReciminsaApp</strong> (gestión de reciclaje, facturación NCF/DGII y derecho empresarial RD), corro <strong>100% local/offline</strong> en formato Int8 dentro del dispositivo con memoria de 6 turnos y soy una IA técnica sin sentimientos ni conciencia.</small></p>`
    );
  }

  if (asksOrigin) {
    sections.push(
      `<p><strong>🏭 Origen y propósito:</strong> Fui diseñado y entrenado específicamente para <strong>ReciminsaApp</strong> (<code>reciminsaapp</code>), la aplicación principal de gestión de reciclaje, facturación NCF/DGII, inventario, rutas y cumplimiento corporativo en República Dominicana. Estoy separado de las variantes operativas <em>Reciminsa Field</em> y <em>Reciminsa Ops</em>, y como <strong>${_cbEscapeHtml(ident.codename)}</strong> mi misión es ${
        activeMode === 'neo'
          ? 'auditar datos, razonar escenarios legales y verificar coherencia antes de responder.'
          : 'entregarte métricas operativas, cálculos y orientación legal rápida en milisegundos.'
      }</p>`
    );
  }

  if (asksTraining) {
    const trainDetail =
      activeMode === 'neo'
        ? `Mi núcleo es un Transformer causal tipo GPT de 2 capas (4 cabezales, <code>d_model=112</code>, FFN <code>224</code>) construido en <strong>PyTorch</strong> (<code>LLMs-from-scratch</code>), entrenado secuencialmente en 3 fases (12 épocas Pretrain + 28 épocas <strong>LoRA</strong> <code>r=8</code> + 10 épocas <strong>DPO</strong>, siguiendo <code>llm-course</code>), acoplado a un motor <strong>RAG Híbrido</strong> BM25 + Vectores 64D (<code>llm-zoomcamp</code>). El ecosistema del proyecto reúne código en 9 lenguajes (Python, C++, Rust, Java, Scala, R, JavaScript, Julia y Mojo) y me ejecuto en tu navegador cuantizado en <strong>Int8</strong>.`
        : `Fui creado mediante <strong>Destilación de Conocimiento</strong> (temperatura <code>T=2.5</code>, 40 épocas) desde el maestro <strong>ReciBot Neo (Argón-Auditor)</strong> entrenado en <strong>PyTorch</strong> con <strong>LoRA</strong> y <strong>DPO</strong>. Mi arquitectura compacta combina embeddings <code>(${vocabSize}, 48)</code>, pooling Mean+Max (96D) y capa oculta ReLU (72 neuronas), desplegada en JavaScript <strong>Int8</strong> dentro de un ecosistema políglota de 9 lenguajes (Python, C++, Rust, Java, Scala, R, JS, Julia y Mojo).`;
    sections.push(`<p><strong>🧪 Arquitectura y entrenamiento:</strong> ${trainDetail}</p>`);
  }

  if (asksOfflineMem) {
    const toolCap =
      activeMode === 'neo'
        ? 'hasta 13 herramientas de auditoría en vivo en una sola consulta'
        : '1 chequeo rápido en vivo en modo lectura';
    sections.push(
      `<p><strong>🔒 Ejecución offline y memoria:</strong> Funciono <strong>100% offline / local</strong> dentro de tu navegador o WebView usando el bundle <code>js/recibot-models.js</code> en <strong>Int8</strong>, sin enviar tus consultas a APIs de IA externas de pago. Durante la sesión mantengo una memoria conversacional activa (<code>RECIBOT_MEMORY</code>) de hasta <strong>6 turnos</strong> para recordar de qué ley, NCF o módulo estamos hablando y consultar ${toolCap} sobre <code>APP_DATA</code> sin alterar tus registros.</p>`
    );
  }

  if (asksLimits) {
    const extraLimit =
      activeMode === 'neo'
        ? 'Mis auditorías dependen de los datos que ya estén registrados en tu <code>APP_DATA</code> local o sincronizados.'
        : 'Además, como modelo ágil me limito a 1 comprobación rápida por turno; cuando necesites auditorías profundas de 12 módulos, lo mejor es pasar a <strong>ReciBot Neo</strong>.';
    sections.push(
      `<p><strong>🧭 Mis límites y naturaleza:</strong> Soy una inteligencia artificial especializada, <strong>no soy humano</strong> y <strong>no tengo sentimientos, emociones ni conciencia</strong>. Tampoco navego internet en tiempo real ni reemplazo a un abogado o CPA autorizado ante litigios o fiscalizaciones oficiales de la DGII, MIMARENA o TSS: mi análisis es estrictamente orientativo. ${extraLimit}</p>`
    );
  }

  if (asksBench) {
    sections.push(
      `<p><strong>📈 Versión y rendimiento (v4 · ${_formatParamCount(vocabSize)} tokens):</strong> Alcanzo <strong>${
        activeMode === 'neo' ? neoValAcc : flashValAcc
      }% de precisión</strong> en validación (FP32 e Int8 sobre 882 casos), con recuperación RAG Híbrido Hit@3 de <strong>${
        activeMode === 'neo' ? neoRagHit3 : flashRagHit3
      }%</strong>${
        activeMode === 'flash'
          ? ` y <strong>${flashAgreement}% de acuerdo</strong> con mi maestro Neo.`
          : ` y <strong>${neoDepthAcc}%</strong> de precisión en profundidad.`
      } Mi latencia medida en Python FP32 es de ${activeMode === 'neo' ? neoLatUs : flashLatUs} µs (y aún menor tras cuantización Int8 / C++ nativo).</p>`
    );
  }

  if (asksCompare) {
    const compareText =
      activeMode === 'neo'
        ? `Como <strong>ReciBot Neo (Argón-Auditor)</strong> cuento con ${_formatParamCount(neoInf)} parámetros de inferencia (${_formatParamCount(neoTotal)} con LoRA), memoria de 6 turnos, razonamiento multi-cláusula y 13 herramientas de verificación; mi hermano <strong>ReciBot Flash (Pulso-Ágil)</strong> usa ${_formatParamCount(flashParams)} parámetros destilados para darte respuestas instantáneas.`
        : `Como <strong>ReciBot Flash (Pulso-Ágil)</strong> soy ${flashReduction}x más compacto (${_formatParamCount(flashParams)} parámetros) que mi hermano <strong>ReciBot Neo (Argón-Auditor)</strong> (${_formatParamCount(neoInf)} parámetros en inferencia) para responderte en milisegundos, mientras Neo se encarga de auditorías profundas multi-módulo y análisis jurídico extenso.`;
    sections.push(`<p><strong>⚖️ Neo vs Flash:</strong> ${compareText}</p>`);
  }

  if (asksParams || asksGeneral) {
    sections.push(`
      <div class="recibot-identity-specs">
        <strong>🧬 Especificaciones exactas (${_formatParamCount(vocabSize)} tokens):</strong>
        <ul>
          <li><strong>Vocabulario compartido:</strong> ${_formatParamCount(vocabSize)} tokens (<code>MAX_SEQ_LEN=${maxSeqLen}</code>, ${numIntents} intenciones, ${kbDocsCount} documentos KB).</li>
          <li><strong>ReciBot Neo (Argón-Auditor):</strong> ${_formatParamCount(neoInf)} parámetros de inferencia (${_formatParamCount(neoTotal)} totales con LoRA durante entrenamiento; ${_formatParamCount(neoLora)} entrenables LoRA).</li>
          <li><strong>ReciBot Flash (Pulso-Ágil):</strong> ${_formatParamCount(flashParams)} parámetros de inferencia (destilado desde Neo).</li>
          <li><strong>Total combinado (ambos modelos):</strong> ${_formatParamCount(combinedInf)} parámetros en inferencia (${_formatParamCount(combinedTotal)} totales incluyendo adaptadores LoRA).</li>
        </ul>
      </div>
    `);
  }

  if (!asksCompare && asksGeneral) {
    const distinction =
      activeMode === 'neo'
        ? 'Como <strong>Argón-Auditor</strong>, priorizo rigor y verificación antes de concluir; mi hermano <strong>ReciBot Flash (Pulso-Ágil)</strong> está destilado desde mí para responder en ~1 milisegundo.'
        : 'Como <strong>Pulso-Ágil</strong>, priorizo inmediatez; cuando requieras auditoría legal profunda o análisis multi-módulo puedes cambiar a <strong>ReciBot Neo (Argón-Auditor)</strong>.';
    sections.push(`<p><small>${distinction}</small></p>`);
  }

  return `
    <div class="recibot-identity-card recibot-identity-card--${activeMode}">
      <div class="recibot-identity-header">
        <strong>${activeMode === 'neo' ? '🧠' : '⚡'} ${_cbEscapeHtml(ident.name)} (${_cbEscapeHtml(ident.codename)})</strong>
        <span class="recibot-identity-tag">${_cbEscapeHtml(ident.role)}</span>
      </div>
      ${sections.join('')}
    </div>
  `;
}

function _syncReciBotHeaderUI(mode) {
  if (typeof document === 'undefined') return;
  const win = document.getElementById('chatbot-window');
  const neoBtn = document.getElementById('recibot-model-neo');
  const flashBtn = document.getElementById('recibot-model-flash');
  const headerName = document.getElementById('recibot-header-name');
  const subtitle = document.getElementById('recibot-header-subtitle');
  const models = _getModelsApi();
  const vocabSize = (models && models.NEO_METRICS && models.NEO_METRICS.vocab_size) || 2000;
  const tokLabel = _formatParamCount(vocabSize);

  if (win) win.setAttribute('data-recibot-model', mode);
  if (neoBtn) {
    neoBtn.classList.toggle('active', mode === 'neo');
    neoBtn.setAttribute('aria-pressed', mode === 'neo' ? 'true' : 'false');
  }
  if (flashBtn) {
    flashBtn.classList.toggle('active', mode === 'flash');
    flashBtn.setAttribute('aria-pressed', mode === 'flash' ? 'true' : 'false');
  }
  if (headerName) {
    headerName.textContent = mode === 'neo' ? 'ReciBot Neo' : 'ReciBot Flash';
  }
  if (subtitle) {
    subtitle.textContent =
      mode === 'neo'
        ? `Argón-Auditor · ${tokLabel} tok · Legal + Verificación`
        : `Pulso-Ágil · ${tokLabel} tok · Respuesta Instantánea`;
  }
}

function setReciBotModel(mode, announce = false) {
  const normalized = mode === 'flash' ? 'flash' : 'neo';
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(RECIBOT_STORAGE_KEY, normalized);
    }
  } catch (_) {}
  _syncReciBotHeaderUI(normalized);

  if (announce && typeof document !== 'undefined') {
    const models = _getModelsApi();
    const ident = _getModelIdentity(normalized);
    const neoInf = Number((models && models.NEO_METRICS && models.NEO_METRICS.inference_parameters) || 444762);
    const flashParams = Number((models && models.FLASH_METRICS && models.FLASH_METRICS.parameters) || 111671);
    const vocabSize = (models && models.NEO_METRICS && models.NEO_METRICS.vocab_size) || 2000;
    const notice =
      normalized === 'neo'
        ? `<span class="recibot-mode-badge recibot-mode-badge--neo">🧠 ${_cbEscapeHtml(ident.name)} (${_cbEscapeHtml(ident.codename)}) activado</span><br>Hola, soy <strong>${_cbEscapeHtml(ident.codename)}</strong> (${_formatParamCount(neoInf)} parámetros en inferencia, vocabulario de ${_formatParamCount(vocabSize)} tokens). Listo para auditoría profunda, memoria multi-turno y derecho empresarial.`
        : `<span class="recibot-mode-badge recibot-mode-badge--flash">⚡ ${_cbEscapeHtml(ident.name)} (${_cbEscapeHtml(ident.codename)}) activado</span><br>Hola, soy <strong>${_cbEscapeHtml(ident.codename)}</strong> (${_formatParamCount(flashParams)} parámetros destilados, vocabulario de ${_formatParamCount(vocabSize)} tokens). Respuestas instantáneas y cálculos al vuelo.`;
    appendMessage('bot', notice);
  }
  return normalized;
}

/* ==========================================================================
   CALCULATORS & ACTION ROUTERS (Exact Deterministic Tools)
   ========================================================================== */

function _safeEvalArithmetic(expr) {
  const clean = String(expr || '').replace(/,/g, '').replace(/x/gi, '*').replace(/[^0-9+\-*/().\s]/g, '').trim();
  if (!clean || !/\d/.test(clean)) return null;
  let pos = 0;

  function skipWs() {
    while (pos < clean.length && clean[pos] === ' ') pos++;
  }
  function parseExpr() {
    let val = parseTerm();
    if (val === null) return null;
    while (true) {
      skipWs();
      const ch = clean[pos];
      if (ch === '+' || ch === '-') {
        pos++;
        const rhs = parseTerm();
        if (rhs === null) return null;
        val = ch === '+' ? val + rhs : val - rhs;
      } else {
        break;
      }
    }
    return val;
  }
  function parseTerm() {
    let val = parseFactor();
    if (val === null) return null;
    while (true) {
      skipWs();
      const ch = clean[pos];
      if (ch === '*' || ch === '/') {
        pos++;
        const rhs = parseFactor();
        if (rhs === null || (ch === '/' && rhs === 0)) return null;
        val = ch === '*' ? val * rhs : val / rhs;
      } else {
        break;
      }
    }
    return val;
  }
  function parseFactor() {
    skipWs();
    if (clean[pos] === '+') {
      pos++;
      return parseFactor();
    }
    if (clean[pos] === '-') {
      pos++;
      const f = parseFactor();
      return f === null ? null : -f;
    }
    if (clean[pos] === '(') {
      pos++;
      const inner = parseExpr();
      skipWs();
      if (inner === null || clean[pos] !== ')') return null;
      pos++;
      return inner;
    }
    const start = pos;
    let dots = 0;
    while (pos < clean.length && (/[0-9]/.test(clean[pos]) || clean[pos] === '.')) {
      if (clean[pos] === '.') dots++;
      if (dots > 1) return null;
      pos++;
    }
    if (pos === start) return null;
    const num = Number(clean.slice(start, pos));
    return Number.isFinite(num) ? num : null;
  }

  const out = parseExpr();
  skipWs();
  if (out === null || pos !== clean.length || !Number.isFinite(out)) return null;
  return out;
}

function _parseFlexibleNumber(raw) {
  const s = String(raw || '').trim();
  if (!s) return NaN;
  let normalized = s;
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(s)) {
    normalized = s.replace(/,/g, '');
  } else if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(s)) {
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = s.replace(',', '.');
  }
  return parseFloat(normalized);
}

function tryRunDeterministicCalculator(queryText) {
  const norm = _cbNormText(queryText);

  // 1) Unit conversions: lb <-> kg <-> ton <-> g
  const convMatch = norm.match(
    /(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)\s*(lb|lbs|libra|libras|kg|kilo|kilos|kilogramo|kilogramos|ton|tons|tonelada|toneladas|g|gr|gramo|gramos)\b(?:\s+(?:a|en|to)\s+(lb|lbs|libra|libras|kg|kilo|kilos|kilogramo|kilogramos|ton|tons|tonelada|toneladas|g|gr|gramo|gramos)\b)?/
  );
  if (convMatch && /(conv|cuant|a\s+|en\s+|peso|equiv|lb|kg|ton)/.test(norm)) {
    const val = _parseFlexibleNumber(convMatch[1]);
    if (Number.isFinite(val)) {
      const unitNorm = (u) => {
        if (!u) return null;
        if (u.startsWith('lb') || u.startsWith('libr')) return 'lb';
        if (u.startsWith('kg') || u.startsWith('kilo')) return 'kg';
        if (u.startsWith('ton')) return 'ton';
        if (u === 'g' || u === 'gr' || u.startsWith('gram')) return 'g';
        return null;
      };
      const from = unitNorm(convMatch[2]);
      let to = unitNorm(convMatch[3]);
      if (!to) {
        if (from === 'lb') to = 'kg';
        else if (from === 'kg') to = 'lb';
        else if (from === 'ton') to = 'kg';
        else to = 'kg';
      }
      const toKg = { lb: 0.45359237, kg: 1.0, ton: 1000.0, g: 0.001 };
      if (from && to && toKg[from] && toKg[to]) {
        const kgVal = val * toKg[from];
        const resVal = kgVal / toKg[to];
        const fmt = (n) => Number(n.toFixed(4)).toLocaleString('en-US', { maximumFractionDigits: 4 });
        return {
          kind: 'unit_conversion',
          summary: `${fmt(val)} ${from} = ${fmt(resVal)} ${to}`,
          detail: `${fmt(val)} ${from} equivalen a ${fmt(kgVal)} kg · ${fmt(kgVal / toKg.lb)} lb · ${fmt(kgVal / 1000)} ton.`,
        };
      }
    }
  }

  // 2) Profit margin calculation: compro a X y vendo a Y
  const marginMatch = norm.match(
    /compr\w*\s+(?:a|en)\s+(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?).*?vend\w*\s+(?:a|en)\s+(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)/
  );
  if (marginMatch) {
    const buy = _parseFlexibleNumber(marginMatch[1]);
    const sell = _parseFlexibleNumber(marginMatch[2]);
    if (Number.isFinite(buy) && Number.isFinite(sell) && sell > 0) {
      const profit = sell - buy;
      const marginPct = (profit / sell) * 100;
      const markupPct = buy > 0 ? (profit / buy) * 100 : 0;
      return {
        kind: 'margin',
        summary: `Ganancia neta: ${_cbFormatMoney(profit)} por unidad (${marginPct.toFixed(2)}% de margen sobre venta)`,
        detail: `Compra: ${_cbFormatMoney(buy)} → Venta: ${_cbFormatMoney(sell)} · Markup sobre costo: ${markupPct.toFixed(2)}%.`,
      };
    }
  }

  // 3) ITBIS & retenciones / percentage calculation (avoid hijacking conceptual legal questions)
  const pctMatch = norm.match(
    /(\d+(?:[.,]\d+)?)\s*(?:%|por\s*ciento)\s*(?:de|sobre)\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)/
  );
  if (pctMatch) {
    const pct = _parseFlexibleNumber(pctMatch[1]);
    const base = _parseFlexibleNumber(pctMatch[2]);
    if (Number.isFinite(pct) && Number.isFinite(base)) {
      const part = (base * pct) / 100;
      return {
        kind: 'percentage',
        summary: `${pct}% de ${_cbFormatMoney(base)} = ${_cbFormatMoney(part)}`,
        detail: `Base + ${pct}% = ${_cbFormatMoney(base + part)} · Base - ${pct}% = ${_cbFormatMoney(base - part)}.`,
      };
    }
  }

  if (/(itbis|retencion|isr)/.test(norm) && !/(despues de|dias|ley|norma|b04|devuelve)/.test(norm)) {
    const numMatch =
      norm.match(/(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)\s*(?:pesos|rd|usd|dop)?\s*$/) ||
      norm.match(/(?:de|sobre|monto|total)\s+(?:rd\$?\s*)?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)/);
    if (numMatch) {
      const amount = _parseFlexibleNumber(numMatch[1]);
      if (Number.isFinite(amount) && amount > 0) {
        if (/desglos|incluido|extraer/.test(norm)) {
          const base = amount / 1.18;
          const itbis = amount - base;
          return {
            kind: 'itbis_breakdown',
            summary: `Desglose de ${_cbFormatMoney(amount)} (ITBIS 18% incluido): Base ${_cbFormatMoney(base)} + ITBIS ${_cbFormatMoney(itbis)}`,
            detail: `Retención referencia 30% del ITBIS (Norma 02-05 persona jurídica): ${_cbFormatMoney(itbis * 0.30)} · 100% ITBIS (persona física): ${_cbFormatMoney(itbis)}.`,
          };
        }
        const itbis = amount * 0.18;
        const total = amount + itbis;
        return {
          kind: 'itbis_add',
          summary: `Base ${_cbFormatMoney(amount)} + ITBIS (18%: ${_cbFormatMoney(itbis)}) = Total ${_cbFormatMoney(total)}`,
          detail: `Si aplica retención ISR 2% servicio técnico o 10% honorarios (Art. 309): ${_cbFormatMoney(amount * 0.02)} / ${_cbFormatMoney(amount * 0.10)}.`,
        };
      }
    }
  }

  // 4) Direct arithmetic expressions like "calcula (1500 + 500) * 1.18"
  const exprCandidate = norm
    .replace(/^(calcula|cuanto es|resultado de|resuelve)\s+/i, '')
    .trim();
  if (/^[0-9+\-*/().\sx,]+$/.test(exprCandidate) && /[+\-*/]/.test(exprCandidate)) {
    const calc = _safeEvalArithmetic(exprCandidate);
    if (calc !== null) {
      const formatted = Number(calc.toFixed(4)).toLocaleString('en-US', { maximumFractionDigits: 4 });
      return {
        kind: 'arithmetic',
        summary: `${exprCandidate} = ${formatted}`,
        detail: `Cálculo exacto evaluado sin redondeo intermedio (${formatted}).`,
      };
    }
  }

  return null;
}

function detectExplicitActionCommand(queryText) {
  const norm = _cbNormText(queryText);

  if (/(abre|abrir|iniciar|lanzar|crear|nueva)\s+(?:la\s+)?mini\s*factura|factura\s+rapida/.test(norm)) {
    return { type: 'quick_tool', tool: 'factura', label: '⚡ Mini Factura Rápida' };
  }
  if (/(abre|abrir|iniciar|lanzar|crear|nueva)\s+(?:la\s+)?mini\s*bitacora|bitacora\s+rapida/.test(norm)) {
    return { type: 'quick_tool', tool: 'bitacora', label: '🚛 Mini Bitácora Rápida' };
  }
  if (/ver\s+todas\s+las\s+sucursales|datos\s+de\s+todas\s+las\s+sucursales/.test(norm) && /(ir|abre|abrir|muestra|ver|llevame|ir a)/.test(norm)) {
    return { type: 'all_branches_history', label: '🏢 Ver Todas las Sucursales en Historial' };
  }
  if (/(sincroniz|force\s*sync)\s+ahora/.test(norm)) {
    return { type: 'force_sync', label: '☁️ Sincronizar con Supabase' };
  }

  const wantsNav = /\b(ir a|abre|abrir|llevame|navegar|muestrame la pantalla|ve a)\b/.test(norm);
  if (!wantsNav) return null;

  const pageMap = [
    { page: 'nota_credito', regex: /(nota de credito|notas de credito|b04|devolucion)/ },
    { page: 'nota_debito', regex: /(nota de debito|notas de debito|b03)/ },
    { page: 'manejo_dgii', regex: /(manejo dgii|dgii|606|607|608|ncf|rnc)/ },
    { page: 'parametrizaciones_empresa', regex: /(parametrizaciones de empresa|parametrizaciones|empresa y sucursales|marca blanca|sucursal)/ },
    { page: 'colaboradores', regex: /(colaborador|empleado|empleados|personal)/ },
    { page: 'facturas', subTab: 'cotizaciones', label: 'Cotizaciones', regex: /(cotizacion|cotizaciones)/ },
    { page: 'facturas', subTab: 'despachos', label: 'Despachos', regex: /(despacho|despachos|conduce|conduces)/ },
    { page: 'bitacoras', regex: /(bitacora|bitacoras|recogida)/ },
    { page: 'facturas', subTab: 'facturas', label: 'Facturas', regex: /(factura|facturas|facturar)/ },
    { page: 'historial', regex: /(historial)/ },
    { page: 'rutas', regex: /(ruta|rutas|agenda)/ },
    { page: 'codigos', regex: /(codigo|codigos|material|materiales|precios)/ },
    { page: 'clientes', regex: /(cliente|clientes)/ },
    { page: 'ingresos', regex: /(ingreso|ingresos|finanza|finanzas)/ },
    { page: 'egresos', regex: /(egreso|egresos|gasto|gastos)/ },
    { page: 'ecologia', regex: /(ecologia|ecologico|impacto|co2|arbol)/ },
    { page: 'ajustes', regex: /(ajuste|ajustes|configuracion|centro de control|google drive)/ },
  ];

  for (const item of pageMap) {
    if (item.regex.test(norm)) {
      return {
        type: 'navigate',
        page: item.page,
        subTab: item.subTab || null,
        label: item.label || item.page,
      };
    }
  }
  return null;
}

/* ==========================================================================
   LIVE VERIFICATION ENGINE (13 App + Corporate Legal Compliance Tools)
   ========================================================================== */

function runLiveToolCheck(toolName) {
  const today = _cbTodayIso();

  switch (toolName) {
    case 'check_ncf_dgii': {
      const seqs = typeof getNcfSequences === 'function' ? getNcfSequences() : _cbReadJson('recim_ncf_sequences', {});
      const entries = Object.entries(seqs || {}).filter(([, v]) => v && typeof v === 'object');
      const cancelled608 = _cbReadJson('recim_ncf_cancelled', []);
      const invoices = typeof getAllInvoices === 'function' ? getAllInvoices() : _cbReadJson('recim_invoices', []);

      const activeList = [];
      const exhaustedList = [];
      const expiredList = [];
      const lowStockList = [];

      entries.forEach(([code, item]) => {
        if (!item.active) return;
        const info = typeof getNextNcfInfo === 'function'
          ? getNextNcfInfo(code)
          : (() => {
              const cur = parseInt(item.current, 10) || 1;
              const to = parseInt(item.to, 10) || 1;
              const rem = to - cur + 1;
              return {
                ncf: `${code}${cur}`,
                remaining: rem,
                exhausted: cur > to,
                isExpired: item.dueDate ? today > item.dueDate : false,
                alertThreshold: parseInt(item.alertThreshold, 10) || 10,
              };
            })();
        activeList.push({ code, info, dueDate: item.dueDate || '' });
        if (info.exhausted) exhaustedList.push(code);
        if (info.isExpired) expiredList.push(`${code} (vencida ${item.dueDate})`);
        if (!info.exhausted && info.remaining != null && info.remaining <= (info.alertThreshold || 10)) {
          lowStockList.push(`${code} (${info.remaining} disp.)`);
        }
      });

      const fiscalNoRnc = (Array.isArray(invoices) ? invoices : []).filter((inv) => {
        if (!inv || inv.type === 'basica') return false;
        const t = String(inv.ncfType || '').toUpperCase();
        if (!t || t === 'B02' || t === 'SIN_NCF' || t === 'CONSUMO') return false;
        const digits = String(inv.nit || inv.rnc || inv.clientRnc || '').replace(/\D/g, '');
        return digits.length !== 9 && digits.length !== 11;
      });

      const alerts = [];
      if (activeList.length === 0) alerts.push('No hay secuencias NCF activas configuradas.');
      if (exhaustedList.length > 0) alerts.push(`Secuencias agotadas: ${exhaustedList.join(', ')}.`);
      if (expiredList.length > 0) alerts.push(`Secuencias vencidas por fecha DGII: ${expiredList.join(', ')}.`);
      if (lowStockList.length > 0) alerts.push(`Stock bajo en secuencias: ${lowStockList.join(', ')}.`);
      if (fiscalNoRnc.length > 0) alerts.push(`${fiscalNoRnc.length} factura(s) fiscal(es) sin RNC/Cédula válido (9 u 11 dígitos).`);

      const status =
        exhaustedList.length > 0 || expiredList.length > 0 || fiscalNoRnc.length > 0
          ? 'warn'
          : activeList.length === 0
            ? 'warn'
            : 'ok';

      return {
        tool: toolName,
        label: 'Secuencias NCF y Cumplimiento DGII',
        status,
        summary:
          activeList.length > 0
            ? `${activeList.length} secuencia(s) NCF activa(s) · 608 anulados: ${Array.isArray(cancelled608) ? cancelled608.length : 0}`
            : `Sin secuencias NCF activas · 608 anulados: ${Array.isArray(cancelled608) ? cancelled608.length : 0}`,
        details: activeList.map(
          (s) => `${s.code}: próx. ${s.info.ncf || '—'} · ${s.info.remaining ?? 0} restantes${s.dueDate ? ` · vence ${s.dueDate}` : ''}`
        ),
        alerts,
      };
    }

    case 'check_legal_compliance': {
      const ncfRes = runLiveToolCheck('check_ncf_dgii');
      const company = _getCompanyIdentity();
      const creditNotes = typeof getAllCreditNotes === 'function' ? getAllCreditNotes() : _cbReadJson('recim_credit_notes', []);
      const clients = typeof getClients === 'function' ? getClients() : _cbReadJson('recim_clients', []);
      const gdriveFolder =
        (typeof localStorage !== 'undefined' &&
          (localStorage.getItem(typeof userKey === 'function' ? userKey('recim_gdrive_folder') : 'recim_gdrive_folder') ||
            localStorage.getItem('recim_gdrive_folder'))) ||
        '';

      const cnList = Array.isArray(creditNotes) ? creditNotes : [];
      const cnNoRef = cnList.filter((cn) => {
        if (!cn || (cn.ncfType !== 'B04' && !cn.ncf)) return false;
        const ref = String(cn.ncfModified || cn.ncfAfectado || cn.affectedNcf || cn.originalNcf || '').trim();
        return !ref;
      });

      const clientList = Array.isArray(clients) ? clients : [];
      const clientsWithId = clientList.filter((c) => {
        const d = String((c && (c.nit || c.rnc || c.cedula || c.taxId)) || '').replace(/\D/g, '');
        return d.length === 9 || d.length === 11;
      });
      const idCoveragePct = clientList.length > 0 ? Math.round((clientsWithId.length / clientList.length) * 100) : 100;

      const alerts = [...(ncfRes.alerts || [])];
      let score = 100;
      if (ncfRes.status === 'warn') score -= 22;
      if (!company.hasConfiguredName || !company.hasValidRnc) {
        score -= 18;
        alerts.push('Empresa sin Razón Social o RNC válido (9 u 11 dígitos) en Parametrizaciones (Ley 479-08 / DGII).');
      }
      if (cnNoRef.length > 0) {
        score -= 15;
        alerts.push(`${cnNoRef.length} nota(s) de crédito B04 sin NCF modificado referenciado.`);
      }
      if (clientList.length > 0 && idCoveragePct < 60) {
        score -= 12;
        alerts.push(`Solo ${idCoveragePct}% de tus clientes tienen RNC/Cédula registrado (riesgo KYC Ley 155-17 y B01).`);
      }
      if (!gdriveFolder) {
        score -= 8;
        alerts.push('Respaldo automático en Google Drive no vinculado (recomendado para retención de 10 años Art. 50 Ley 11-92).');
      }
      score = Math.max(15, score);

      return {
        tool: toolName,
        label: 'Auditoría de Cumplimiento Legal Empresarial',
        status: alerts.length > 0 ? 'warn' : 'ok',
        summary: `Índice estimado: ${score}/100 · Empresa: ${company.hasValidRnc ? `${company.name} (RNC ${company.rnc})` : 'RNC pendiente'} · Clientes identificados: ${idCoveragePct}% · Drive: ${gdriveFolder ? 'Activo' : 'Sin vincular'}`,
        details: [
          `NCF DGII: ${ncfRes.summary}`,
          `Notas B04 con NCF afectado: ${cnList.length - cnNoRef.length}/${cnList.length}`,
        ],
        alerts,
      };
    }

    case 'check_branches': {
      const branches =
        typeof getCompanyBranches === 'function'
          ? getCompanyBranches()
          : _cbReadJson('recim_company_branches', [{ id: 'SUC-PRINCIPAL', name: 'Sede Principal', isDefault: true }]);
      const activeId = typeof getActiveBranchId === 'function' ? getActiveBranchId() : 'SUC-PRINCIPAL';
      const activeName =
        typeof resolveBranchNameById === 'function'
          ? resolveBranchNameById(activeId)
          : ((branches.find((b) => b && b.id === activeId) || {}).name || activeId);

      const allInvoices = typeof getAllInvoices === 'function' ? getAllInvoices() : _cbReadJson('recim_invoices', []);
      const perBranch = new Map();
      (Array.isArray(branches) ? branches : []).forEach((b) => {
        if (b && b.id) perBranch.set(b.id, { name: b.name || b.id, invoices: 0, bitacoras: 0 });
      });
      (Array.isArray(allInvoices) ? allInvoices : []).forEach((inv) => {
        if (!inv) return;
        const bid = String(inv.branchId || 'SUC-PRINCIPAL').trim() || 'SUC-PRINCIPAL';
        if (!perBranch.has(bid)) perBranch.set(bid, { name: inv.branchName || bid, invoices: 0, bitacoras: 0 });
        const slot = perBranch.get(bid);
        if (inv.type === 'basica') slot.bitacoras += 1;
        else slot.invoices += 1;
      });

      const details = Array.from(perBranch.entries()).map(
        ([id, d]) => `${d.name}${id === activeId ? ' (Activa)' : ''}: ${d.invoices} fact. / ${d.bitacoras} bitác.`
      );

      return {
        tool: toolName,
        label: 'Sucursales y Sedes',
        status: 'ok',
        summary: `${perBranch.size} sucursal(es) · Activa: ${activeName}`,
        details,
        alerts: [],
      };
    }

    case 'check_finances': {
      const ingresos = _cbReadJson('recim_ingresos', []);
      const egresos = _cbReadJson('recim_egresos', []);
      const sumEntries = (arr) =>
        (Array.isArray(arr) ? arr : []).reduce((acc, item) => {
          if (!item) return acc;
          const val =
            typeof getConvertedAmount === 'function'
              ? getConvertedAmount(item.amount, item.currency)
              : (Number(item.amount) || 0);
          return acc + (Number.isFinite(val) ? val : 0);
        }, 0);

      const totalIn = sumEntries(ingresos);
      const totalOut = sumEntries(egresos);
      const balance = totalIn - totalOut;
      const alerts = [];
      if (balance < 0) alerts.push(`Balance neto negativo (${_cbFormatMoney(balance)}): egresos superan ingresos.`);

      return {
        tool: toolName,
        label: 'Finanzas (Ingresos y Egresos)',
        status: balance < 0 ? 'warn' : 'ok',
        summary: `Ingresos: ${_cbFormatMoney(totalIn)} (${ingresos.length}) · Egresos: ${_cbFormatMoney(totalOut)} (${egresos.length}) · Neto: ${_cbFormatMoney(balance)}`,
        details: [],
        alerts,
      };
    }

    case 'check_invoices_bitacoras': {
      const all = typeof getAllInvoices === 'function' ? getAllInvoices() : _cbReadJson('recim_invoices', []);
      const extraBit = _cbReadJson('recim_bitacoras', []);
      const list = Array.isArray(all) ? all : [];
      const facturas = list.filter((i) => i && i.type !== 'basica');
      const bitacoras = list.filter((i) => i && i.type === 'basica');
      const seenIds = new Set(bitacoras.map((b) => b.id));
      (Array.isArray(extraBit) ? extraBit : []).forEach((b) => {
        if (b && !seenIds.has(b.id)) bitacoras.push(b);
      });

      const totalFacturado = facturas.reduce((s, inv) => s + (Number(inv.total) || 0), 0);
      const todayFact = facturas.filter((inv) => String(inv.date || '').startsWith(today)).length;
      const todayBit = bitacoras.filter((b) => String(b.date || '').startsWith(today)).length;

      let ecoSummary = '';
      if (typeof calculateEcoImpact === 'function' && list.length > 0) {
        try {
          const eco = calculateEcoImpact(list);
          ecoSummary = `${Number(eco.totalWeight || 0).toFixed(1)} kg reciclados · ${Number(eco.co2Avoided || 0).toFixed(1)} kg CO2 evitado · ${Number(eco.treesSaved || 0).toFixed(1)} árboles`;
        } catch (_) {}
      }

      return {
        tool: toolName,
        label: 'Facturas y Bitácoras',
        status: 'ok',
        summary: `${facturas.length} factura(s) (${_cbFormatMoney(totalFacturado)} total, ${todayFact} hoy) · ${bitacoras.length} bitácora(s) (${todayBit} hoy)`,
        details: ecoSummary ? [ecoSummary] : [],
        alerts: [],
      };
    }

    case 'check_clients': {
      const clients = typeof getClients === 'function' ? getClients() : _cbReadJson('recim_clients', []);
      const list = Array.isArray(clients) ? clients : [];
      const withRnc = list.filter((c) => {
        const digits = String((c && (c.nit || c.rnc || c.cedula || c.taxId)) || '').replace(/\D/g, '');
        return digits.length === 9 || digits.length === 11;
      });
      const withoutRnc = list.length - withRnc.length;
      return {
        tool: toolName,
        label: 'Clientes y Debida Diligencia',
        status: 'ok',
        summary: `${list.length} cliente(s) en la sucursal activa (${withRnc.length} con RNC/Cédula válido)`,
        details: withoutRnc > 0 ? [`${withoutRnc} cliente(s) sin RNC/Cédula (solo consumidor final B02 / requiere identificación en efectivo alto).`] : [],
        alerts: [],
      };
    }

    case 'check_materials_prices': {
      const codes = typeof getMaterialCodes === 'function'
        ? getMaterialCodes()
        : (typeof getCustomCodes === 'function' ? getCustomCodes() : _cbReadJson('recim_material_codes', []));
      const families = typeof getMaterialFamilies === 'function' ? getMaterialFamilies() : _cbReadJson('recim_material_families', []);
      const market = typeof getMarketPrices === 'function' ? getMarketPrices() : [];

      const zeroPrice = (Array.isArray(codes) ? codes : []).filter((m) => m && !(Number(m.price) > 0));
      const alerts = [];
      if ((Array.isArray(codes) ? codes.length : 0) === 0) {
        alerts.push('No hay códigos de materiales configurados todavía.');
      } else if (zeroPrice.length > 0) {
        alerts.push(`${zeroPrice.length} código(s) de material tienen precio RD$ 0.00.`);
      }

      return {
        tool: toolName,
        label: 'Materiales, Familias y Precios',
        status: zeroPrice.length > 0 ? 'warn' : 'ok',
        summary: `${(codes || []).length} código(s) · ${(families || []).length} familia(s) · ${(market || []).length} precio(s) de mercado`,
        details: [],
        alerts,
      };
    }

    case 'check_quotes_docs': {
      const quotes = typeof getAllQuotes === 'function' ? getAllQuotes() : _cbReadJson('recim_quotes', []);
      const dispatches = _cbReadJson('recim_dispatches', []);
      const returns = _cbReadJson('recim_returns', []);
      const creditNotes = _cbReadJson('recim_credit_notes', []);
      const debitNotes = _cbReadJson('recim_debit_notes', []);
      return {
        tool: toolName,
        label: 'Cotizaciones, Despachos y Notas B03/B04',
        status: 'ok',
        summary: `Cotizaciones: ${quotes.length} · Despachos/Conduces: ${dispatches.length} · Devoluciones: ${returns.length} · Notas Crédito B04: ${creditNotes.length} · Notas Débito B03: ${debitNotes.length}`,
        details: [],
        alerts: [],
      };
    }

    case 'check_routes': {
      const routes = _cbReadJson('recim_pickup_routes', []);
      const list = Array.isArray(routes) ? routes : [];
      const pending = list.filter((r) => r && r.status !== 'completed' && r.status !== 'completada').length;
      const completed = list.length - pending;
      return {
        tool: toolName,
        label: 'Rutas de Recogida y Agenda',
        status: 'ok',
        summary: `${list.length} ruta(s)/parada(s) programada(s) · ${pending} pendiente(s) · ${completed} completada(s)`,
        details: [],
        alerts: [],
      };
    }

    case 'check_collaborators': {
      const colabs = _cbReadJson('recim_collaborators', []);
      const list = Array.isArray(colabs) ? colabs : [];
      const active = list.filter((c) => c && c.active !== false).length;
      return {
        tool: toolName,
        label: 'Colaboradores',
        status: 'ok',
        summary: `${list.length} colaborador(es) registrado(s) (${active} activo(s))`,
        details: [],
        alerts: [],
      };
    }

    case 'check_system_sync': {
      const session = _cbReadJson('recim_session', {});
      const tombstones = _cbReadJson('recim_deleted_tombstones', []);
      const gdriveFolder =
        (typeof localStorage !== 'undefined' &&
          (localStorage.getItem(typeof userKey === 'function' ? userKey('recim_gdrive_folder') : 'recim_gdrive_folder') ||
            localStorage.getItem('recim_gdrive_folder'))) ||
        '';
      const online = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;

      let storageBytes = 0;
      if (typeof localStorage !== 'undefined') {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('recim_')) storageBytes += (localStorage.getItem(k) || '').length * 2;
          }
        } catch (_) {}
      }
      const storageKb = (storageBytes / 1024).toFixed(1);
      const alerts = [];
      if (!online) alerts.push('Dispositivo en modo Offline: los cambios quedarán en cola local hasta recuperar red.');

      return {
        tool: toolName,
        label: 'Sincronización Supabase, Drive y Salud Local',
        status: online ? 'ok' : 'warn',
        summary: `Red: ${online ? 'Online' : 'Offline'} · Sesión: ${session.email || session.username || 'Local'} · Tombstones: ${Array.isArray(tombstones) ? tombstones.length : 0} · Drive: ${gdriveFolder ? 'Configurado' : 'No vinculado'} · Uso local: ${storageKb} KB`,
        details: [],
        alerts,
      };
    }

    case 'check_control_center': {
      const settings = typeof getSettings === 'function' ? getSettings() : _cbReadJson('recim_settings', {});
      let nativeState = null;
      if (typeof window !== 'undefined' && window.AndroidNative && typeof window.AndroidNative.GetControlCenterTilesState === 'function') {
        try {
          nativeState = JSON.parse(window.AndroidNative.GetControlCenterTilesState() || 'null');
        } catch (_) {}
      }
      const bitEnabled = settings.controlCenterBitacora === true || (nativeState && nativeState.bitacora === true);
      const facEnabled = settings.controlCenterFactura === true || (nativeState && nativeState.factura === true);
      return {
        tool: toolName,
        label: 'Centro de Control Android y Herramientas Rápidas',
        status: 'ok',
        summary: `Mini Bitácora: ${bitEnabled ? 'Activada ✅' : 'Desactivada ⏸️'} · Mini Factura: ${facEnabled ? 'Activada ✅' : 'Desactivada ⏸️'} · Puente Android: ${nativeState ? 'Conectado' : 'Web/Simulación'}`,
        details: [],
        alerts: [],
      };
    }

    default:
      return null;
  }
}

/* ==========================================================================
   DYNAMIC CONVERSATIONAL REASONER, MULTI-TURN MEMORY & CLAUSE SYNTHESIS
   ========================================================================== */

function isFollowUpQuery(rawText, mem = RECIBOT_MEMORY) {
  if (!mem || !mem.activeTopic) return false;
  const norm = _cbNormText(rawText);
  const words = norm.split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;

  const hasNewDomainTopic = /\b(sucursal|sucursales|centro de control|google drive|bluetooth|biometria|ecologia|arboles|ruta|agenda|nota de debito|b03|ley 32 23|ley 64 00|ley 225 20|ley 479 08|ley 16 92|ley 172 13)\b/.test(norm);
  if (hasNewDomainTopic) return false;

  const startsWithContinuation = /^(?:y\b|pero\b|entonces\b|ok\b|vale\b|como\b|cuando\b|donde\b|por que\b|cual\b|explica|profundiza|dame|redacta|que pasa|que multa|cuanto tiempo|me protejo|lo hago|dentro de la app)/.test(norm);
  const hasAnaphoricRef = /\b(eso|esto|ese|esa|ese caso|este caso|lo mismo|protejo|me protejo|dentro de la app|en la app|que multa|que sancion|como lo hago|como lo evito|y si pasan|mas detalles|mas ejemplos|redacta)\b/.test(norm);

  if (startsWithContinuation || hasAnaphoricRef) return true;
  if (words.length <= 5 && !/\b(hola|buenas|gracias|adios|auditoria)\b/.test(norm)) return true;
  return false;
}

function _enrichQueryWithMemory(rawText, mem = RECIBOT_MEMORY) {
  if (!mem || !mem.activeTopic) return rawText;
  const parts = [rawText];
  if (mem.activeTitle) parts.push(mem.activeTitle);
  if (Array.isArray(mem.activeLawRefs) && mem.activeLawRefs.length > 0) {
    parts.push(mem.activeLawRefs.slice(0, 2).join(' '));
  }
  if (mem.activeEntities && Array.isArray(mem.activeEntities.keywords) && mem.activeEntities.keywords.length > 0) {
    parts.push(mem.activeEntities.keywords.slice(0, 5).join(' '));
  }
  return parts.join(' ');
}

function splitSemanticClauses(text) {
  const clean = String(text || '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < 9) return [clean];

  let parts = clean
    .replace(/\?/g, '?|')
    .replace(/;\s+/g, '|')
    .replace(/\b(y ademas|ademas|por otro lado|pero dime|y tambien|tambien dime)\b/gi, '|$1')
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).filter(Boolean).length >= 3);

  // Split "A y B" only when both sides look like meaningful independent clauses (>=4 words each)
  if (parts.length === 1) {
    const m = clean.match(/^(.{15,}?)\s+y\s+(.{15,})$/i);
    if (m) {
      const lw = m[1].trim().split(/\s+/).filter(Boolean).length;
      const rw = m[2].trim().split(/\s+/).filter(Boolean).length;
      if (lw >= 4 && rw >= 4) parts = [m[1].trim(), m[2].trim()];
    }
  }

  return parts.length > 1 ? parts.slice(0, 3) : [clean];
}

function _buildDynamicClauseDraft(norm, scenario) {
  const company = _getCompanyIdentity();
  const cName = _cbEscapeHtml(company.name);
  const cRnc = _cbEscapeHtml(company.rnc);

  if (/(cobre|chatarra|metales|origen|licito|ley 155|receptacion|compra)/.test(norm) || scenario.scrapMetals) {
    return {
      title: 'Borrador de Declaración de Origen Lícito (Compra de Metales / Ley 155-17)',
      body: `Yo, [Nombre completo del vendedor], portador(a) de la Cédula No. [___________], declaro bajo fe de juramento que los materiales reciclables detallados en la Bitácora entregada a ${cName} (RNC ${cRnc}) son de mi legítima propiedad y procedencia lícita, exonerando a la compradora de responsabilidad por ocultamiento previo. Vehículo/Ficha: [_____] · Peso neto verificado en báscula: [_____].`,
    };
  }
  if (/(privacidad|datos|ley 172|cliente|aviso)/.test(norm)) {
    return {
      title: 'Borrador de Aviso Corto de Privacidad (Ley 172-13)',
      body: `${cName} (RNC ${cRnc}) informa que los datos de RNC, cédula, teléfono y dirección recolectados se utilizan exclusivamente para facturación fiscal DGII, coordinación de recogidas y soporte comercial. Conforme a la Ley 172-13, el titular puede solicitar rectificación o supresión de datos no sujetos a conservación legal tributaria (Art. 50 Ley 11-92).`,
    };
  }
  if (/(factura|mora|credito|cobro|conduce|despacho|pago)/.test(norm)) {
    return {
      title: 'Borrador de Cláusula de Pago, Mora y Conformidad de Pesaje (Facturas / Conduces)',
      body: `El cliente declara haber recibido conforme el material y peso neto consignado en el presente documento emitido por ${cName} (RNC ${cRnc}). Las facturas a crédito devengarán un cargo por mora convencional del [__]% mensual tras su fecha de vencimiento. Para reclamos por diferencia de peso solo serán válidos al momento de la descarga/báscula con Conduce firmado.`,
    };
  }
  // Default: Quote legal validity & price fluctuation clause
  return {
    title: 'Borrador de Cláusula Legal de Validez para Cotizaciones',
    body: `Cotización comercial emitida por ${cName} (RNC ${cRnc}). Este documento constituye oferta comercial válida por [5 / 7] días calendario y NO sustituye comprobante fiscal (NCF/e-CF). Los precios de materiales reciclables (metales, papel, plástico) quedan sujetos a verificación de calidad, limpieza y peso neto final en báscula al momento de la recogida o entrega.`,
  };
}

function analyzeLegalAndBusinessScenario(queryText, mem = RECIBOT_MEMORY) {
  const norm = _cbNormText(queryText);
  const inherited = isFollowUpQuery(queryText, mem) ? (mem.activeEntities || {}) : {};

  const daysMatch = norm.match(/\b(\d+)\s*(?:dias?|dia)\b/);
  const daysMentioned = daysMatch ? parseInt(daysMatch[1], 10) : null;
  const ncfCodes = Array.from(new Set((norm.toUpperCase().match(/\b(?:B01|B02|B03|B04|B11|B14|B15|E31|E32|E33|E34|E41|E44|E45)\b/g) || [])));

  const scrapMetals = inherited.scrapMetals || /(cobre|aluminio|hierro|acero|bronce|chatarra|cable)/.test(norm);
  const cashPayment = inherited.cashPayment || /(efectivo|cash)/.test(norm);
  const missingId = inherited.missingId || /(sin cedula|sin rnc|sin identificacion|sin documento)/.test(norm);
  const branchQuery = /(sucursal|sucursales|local|locales|establecimiento)/.test(norm);
  const expiredOrZero = /(vencida|vencido|vencidas|agotada|agotado|agotadas|expirada|en cero)/.test(norm);
  const fullAppScope = /(toda mi empresa|toda la app|toda la aplicacion|todo el sistema|auditoria completa|auditoria total|chequeo profundo)/.test(norm);
  const mentionsB04Return = ncfCodes.includes('B04') || /(nota de credito|devolucion|devuelve|anula)/.test(norm);

  const asksRisk = /(riesgo|riesgos|multa|multas|sancion|ilegal|pueden multar|penal|que pasa si|pierdo|consecuencia)/.test(norm);
  const asksHowTo = /(como hago|como lo hago|como me protejo|como evito|como configuro|paso a paso|en la app|dentro de la app|que botones|solucion)/.test(norm);
  const asksCompare = /(diferencia|vs|compar|mejor|sustituye|necesito otro)/.test(norm);
  const asksDraftClause = /(redacta|redactame|escribe|prepara|borrador|clausula|terminos y condiciones|aviso de privacidad|declaracion)/.test(norm);
  const asksAudit = fullAppScope || /(revisa|audita|auditoria|comprueba|verifica|chequea|inspector|fiscalizacion)/.test(norm);

  const deductions = [];

  // Scenario 1: B04 Credit Note ITBIS 30-day window (Reglamento 293-11)
  if (mentionsB04Return && daysMentioned !== null) {
    if (daysMentioned > 30) {
      deductions.push({
        tag: `Regl. 293-11 · Plazo ${daysMentioned}d vs 30d`,
        text: `Con **${daysMentioned} días** transcurridos (${daysMentioned - 30} días por encima del límite legal de **30 días calendario**), puedes emitir el ajuste comercial en B04 vinculando el NCF original, pero **NO puedes deducir/recuperar ese ITBIS** en el IT-1 del período.`,
      });
    } else {
      deductions.push({
        tag: `Regl. 293-11 · Dentro de ${daysMentioned}d <= 30d`,
        text: `Con **${daysMentioned} días** estás dentro del límite legal de **30 días calendario**: al emitir la Nota de Crédito B04 referenciando el NCF original podrás ajustar la venta y recuperar/deducir el ITBIS en el IT-1.`,
      });
    }
  }

  // Scenario 2: Opening branches -> same parent RNC vs new entity
  if (branchQuery && /(rnc|otro rnc|mismo rnc|necesito|abro|abrir)/.test(norm)) {
    deductions.push({
      tag: 'Ley 479-08 & DGII · Sucursales vs RNC',
      text: `No necesitas un RNC distinto: las sucursales de una misma sociedad comparten el **mismo RNC y Razón Social matriz**, notificando cada nuevo domicilio ante DGII y separando cada sede en Parametrizaciones de Empresa.`,
    });
  }

  // Scenario 3: Scrap purchase in cash without Cedula/ID (Ley 155-17 + Penal Art. 460)
  if (scrapMetals && (cashPayment || missingId)) {
    if (asksHowTo) {
      deductions.push({
        tag: 'Protección en ReciminsaApp · Ley 155-17',
        text: `Para blindarte dentro de la app: 1) Registra al proveedor en **Clientes** con su cédula (11 dígitos) o RNC, 2) Documenta placa del vehículo, peso exacto y tipo de metal (${scrapMetals ? 'cobre/chatarra' : 'residuo'}) en **Bitácoras**, y 3) Evita pagos altos en efectivo priorizando transferencia o comprobante B11.`,
      });
    } else {
      deductions.push({
        tag: 'Riesgo Alto · Ley 155-17 & Art. 460 Código Penal',
        text: `Comprar metales (especialmente cobre/cables) en efectivo y sin cédula te expone a **receptación penal (Art. 460)**, comiso del material si resulta sustraído, alertas **Ley 155-17** e impugnación del gasto deducible ante DGII.`,
      });
    }
  }

  // Scenario 4: Expired or exhausted NCF emission
  if (expiredOrZero && (ncfCodes.length > 0 || /\bncf\b/.test(norm))) {
    deductions.push({
      tag: 'Ley 11-92 & Norma 06-2018 · Secuencias NCF',
      text: `Emitir un comprobante fiscal con secuencia vencida o agotada es una infracción formal tributaria (Art. 257 Ley 11-92) que invalida el crédito fiscal al cliente; la app exige lote vigente o emisión explícita Sin Comprobante Fiscal.`,
    });
  }

  const clauseDraft = asksDraftClause ? _buildDynamicClauseDraft(norm, { scrapMetals }) : null;

  const keywords = [];
  if (scrapMetals) keywords.push('cobre chatarra metales');
  if (cashPayment) keywords.push('efectivo');
  if (missingId) keywords.push('cedula rnc');
  if (branchQuery) keywords.push('sucursal rnc');
  if (ncfCodes.length) keywords.push(ncfCodes.join(' '));

  return {
    daysMentioned,
    ncfCodes,
    scrapMetals,
    cashPayment,
    missingId,
    branchQuery,
    expiredOrZero,
    fullAppScope,
    asksRisk,
    asksHowTo,
    asksCompare,
    asksDraftClause,
    asksAudit,
    deductions,
    clauseDraft,
    isFollowUp: isFollowUpQuery(queryText, mem),
    entities: { scrapMetals, cashPayment, missingId, keywords },
  };
}

function selectDynamicFacts(ragDocs, queryText, scenario, mem = RECIBOT_MEMORY, limit = 4) {
  const normTokens = _cbNormText(queryText).split(/\s+/).filter((t) => t.length >= 3);
  const candidates = [];
  const seenText = new Set();

  (ragDocs || []).forEach((doc, docRank) => {
    const factsList =
      Array.isArray(doc.facts) && doc.facts.length > 0
        ? doc.facts
        : String(doc.content || '').split('. ').map((s) => s.trim()).filter(Boolean);

    factsList.forEach((factText, fIdx) => {
      const cleanFact = factText.endsWith('.') ? factText : `${factText}.`;
      if (seenText.has(cleanFact)) return;
      seenText.add(cleanFact);

      const factKey = `${doc.id}#${fIdx}`;
      const fNorm = _cbNormText(cleanFact);
      let score = (doc.hybridScore || 0.5) * 1.15 - docRank * 0.08;

      normTokens.forEach((tok) => {
        if (fNorm.includes(tok)) score += 0.14;
      });
      if (scenario.asksHowTo && /(reciminsaapp|en la app|bitacora|clientes|ajustes|parametrizaciones|facturas|historial|supabase|drive)/.test(fNorm)) {
        score += 0.35;
      }
      if (scenario.asksRisk && /(multa|sancion|riesgo|ilegal|penal|invalida|art\.|articulo|responsable|pierde)/.test(fNorm)) {
        score += 0.32;
      }
      if (scenario.asksCompare && /(diferencia|no sustituye|mientras|a diferencia|pero no|solo)/.test(fNorm)) {
        score += 0.25;
      }
      if (mem && mem.usedFactIds && mem.usedFactIds.has(factKey)) {
        score -= 0.55; // Strong novelty preference so follow-ups surface new facets!
      }

      candidates.push({
        factKey,
        docId: doc.id,
        title: doc.title,
        lawRef: doc.law_ref || '',
        category: doc.category || 'app',
        text: cleanFact,
        score,
      });
    });
  });

  candidates.sort((a, b) => b.score - a.score);
  const chosen = candidates.slice(0, limit);
  if (mem && mem.usedFactIds) {
    chosen.forEach((c) => mem.usedFactIds.add(c.factKey));
  }
  return chosen;
}

function buildContextualFollowUpPrompts(intent, scenario) {
  const prompts = [];
  if (intent === 'legal_aml_scrap_compliance' || scenario.scrapMetals) {
    prompts.push('¿Cómo me protejo dentro de la app al comprar metales?');
    prompts.push('Redacta una declaración de origen lícito para chatarra');
  } else if (intent === 'legal_tax_code_ncf') {
    prompts.push('¿Qué sanciones tributarias aplica el Código Tributario?');
    prompts.push('Revisa ahora mis secuencias NCF en la app');
  } else if (intent === 'legal_corporate_branches_rnc') {
    prompts.push('¿Qué documentos deben llevar las facturas de mis sucursales?');
    prompts.push('Resumen de todas mis sucursales en la app');
  } else if (intent === 'legal_labor_tss_safety') {
    prompts.push('¿Qué EPP es obligatorio para choferes y patio de acopio?');
    prompts.push('Cuántos colaboradores tengo registrados');
  } else if (intent === 'legal_environmental_waste') {
    prompts.push('¿Cómo respaldo trazabilidad MIMARENA con bitácoras?');
    prompts.push('Redacta términos generales para cotizaciones de reciclaje');
  } else if (intent === 'legal_data_privacy_cyber') {
    prompts.push('Redacta un aviso corto de privacidad de datos');
    prompts.push('¿Cómo protege Supabase los registros eliminados?');
  } else if (intent === 'legal_commercial_contracts_docs') {
    prompts.push('Redacta una cláusula legal de validez para cotizaciones');
    prompts.push('¿Qué valor tiene un conduce frente a una factura?');
  } else if (intent === 'audit_full_app' || intent === 'legal_audit_risk_scenario') {
    prompts.push('¿Cómo corrijo mis alertas NCF y de RNC prioritarias?');
    prompts.push('Redacta cláusula de mora para facturas a crédito');
  } else if (intent === 'identity_capabilities') {
    prompts.push('¿Cómo fuiste entrenado y en qué lenguajes estás hecho?');
    prompts.push('¿Necesitas internet, tienes memoria o cuáles son tus límites?');
  }
  return prompts.slice(0, 2);
}

function _updateMemoryAfterTurn(rawText, intent, intentTitle, ragDocs, scenario) {
  if (intent === 'greeting' || intent === 'thanks_farewell') return;
  const lawRefs = Array.from(
    new Set((ragDocs || []).map((d) => d.law_ref).filter(Boolean))
  );
  RECIBOT_MEMORY.activeTopic = intent;
  RECIBOT_MEMORY.activeTitle = intentTitle;
  RECIBOT_MEMORY.activeLawRefs = lawRefs.length > 0 ? lawRefs : RECIBOT_MEMORY.activeLawRefs;
  RECIBOT_MEMORY.activeEntities = scenario.entities || {};
  RECIBOT_MEMORY.turns.push({
    user: rawText,
    intent,
    lawRefs,
    timestamp: Date.now(),
  });
  if (RECIBOT_MEMORY.turns.length > 6) {
    RECIBOT_MEMORY.turns = RECIBOT_MEMORY.turns.slice(-6);
  }
}

/* ==========================================================================
   RESPONSE BUILDERS (Action Buttons, Trace & Dual Engine Execution)
   ========================================================================== */

function buildActionButtonsForIntent(intent, hasAlerts) {
  const buttons = [];
  const addPageBtn = (label, page, subTab = null) => {
    const subTabArg = subTab ? `,'${_cbEscapeJsArg(subTab)}'` : '';
    buttons.push(`<button type="button" class="chatbot-action-btn" onclick="if(typeof navigate==='function')navigate('${_cbEscapeJsArg(page)}'${subTabArg})">${label}</button>`);
  };

  if (intent === 'audit_full_app' || intent === 'branches_overview_live' || intent === 'legal_corporate_branches_rnc') {
    buttons.push(`<button type="button" class="chatbot-action-btn" onclick="if(typeof navigate==='function')navigate('historial');if(typeof viewAllBranchesDataInHistory==='function')setTimeout(()=>viewAllBranchesDataInHistory(),80);">🏢 Ver Todas las Sucursales</button>`);
  }
  if (
    intent === 'audit_dgii_ncf' ||
    intent === 'audit_full_app' ||
    intent === 'legal_tax_code_ncf' ||
    intent === 'legal_ecf_electronic_invoicing' ||
    intent === 'legal_retentions_itbis_isr' ||
    intent === 'legal_audit_risk_scenario' ||
    hasAlerts
  ) {
    buttons.push(`<button type="button" class="chatbot-action-btn" onclick="if(typeof openParametrizacionesModal==='function'){openParametrizacionesModal('facturas');}else if(typeof navigate==='function'){navigate('manejo_dgii');}">🧾 Secuencias NCF</button>`);
    addPageBtn('📋 Manejo DGII', 'manejo_dgii');
  }
  if (intent === 'legal_aml_scrap_compliance' || intent === 'legal_environmental_waste') {
    addPageBtn('🚛 Ir a Bitácoras', 'bitacoras');
    addPageBtn('👥 Clientes (RNC/Cédula)', 'clientes');
  }
  if (intent === 'legal_labor_tss_safety') {
    addPageBtn('👷 Colaboradores', 'colaboradores');
  }
  if (intent === 'android_control_center' || intent === 'navigate_or_open_tool') {
    buttons.push(`<button type="button" class="chatbot-action-btn" onclick="if(typeof openQuickControlTool==='function')openQuickControlTool('bitacora');">🚛 Mini Bitácora</button>`);
    buttons.push(`<button type="button" class="chatbot-action-btn" onclick="if(typeof openQuickControlTool==='function')openQuickControlTool('factura');">⚡ Mini Factura</button>`);
    addPageBtn('🎛️ Ajustes Control Center', 'ajustes');
  }
  if (intent === 'supabase_sync_delete' || intent === 'system_health_check' || intent === 'legal_data_privacy_cyber') {
    buttons.push(`<button type="button" class="chatbot-action-btn" onclick="if(typeof forceSync==='function')forceSync();">☁️ Sincronizar Ahora</button>`);
    addPageBtn('⚙️ Ajustes', 'ajustes');
  }

  if (buttons.length === 0) {
    const defaultTarget = INTENT_DEFAULT_PAGE[intent];
    const targetPage = typeof defaultTarget === 'string' ? defaultTarget : (defaultTarget && defaultTarget.page);
    const targetSubTab = defaultTarget && typeof defaultTarget === 'object' ? defaultTarget.subTab : null;
    const targetLabel =
      (defaultTarget && typeof defaultTarget === 'object' && defaultTarget.label) ||
      (targetPage ? targetPage.replace(/_/g, ' ') : '');
    if (targetPage && VALID_APP_PAGES.includes(targetPage)) {
      addPageBtn(`📲 Ir a ${targetLabel}`, targetPage, targetSubTab);
    }
  }
  return buttons.slice(0, 3).join('');
}

function formatReasoningTrace(neoRes, checks, calcRes, scenario, totalMs) {
  const toolLines = checks.map((c) => {
    const icon = c.status === 'warn' || c.status === 'error' ? '⚠️' : '✅';
    return `<li>${icon} <strong>${_cbEscapeHtml(c.label)}:</strong> ${_cbEscapeHtml(c.summary)}</li>`;
  });
  if (calcRes) {
    toolLines.push(`<li>🧮 <strong>Motor Matemático:</strong> ${_cbEscapeHtml(calcRes.summary)}</li>`);
  }
  const ragLines = (neoRes.ragTopDocs || []).slice(0, 4).map(
    (doc, i) =>
      `<li>#${i + 1} <code>${_cbEscapeHtml(doc.module)}</code> · ${_cbEscapeHtml(doc.title)}${doc.law_ref ? ` [${_cbEscapeHtml(doc.law_ref)}]` : ''} (Híbrido ${(doc.hybridScore * 100).toFixed(0)}%)</li>`
  );
  const secondNote =
    neoRes.secondIntent && neoRes.secondConfidence >= 0.08
      ? ` · Secundaria: <code>${_cbEscapeHtml(neoRes.secondIntent)}</code> (${(neoRes.secondConfidence * 100).toFixed(1)}%)`
      : '';
  const contextNote = scenario.isFollowUp ? ' · <strong>Memoria:</strong> Seguimiento multi-turno activo' : '';

  return `
    <details class="recibot-trace">
      <summary>🔬 Razonamiento y comprobaciones de Neo (${checks.length} chequeo${checks.length === 1 ? '' : 's'} · ${totalMs.toFixed(1)} ms)</summary>
      <div class="recibot-trace-body">
        <div><strong>Intent neuronal:</strong> <code>${_cbEscapeHtml(neoRes.intent)}</code> (${(neoRes.confidence * 100).toFixed(1)}%)${secondNote}</div>
        <div><strong>Profundidad:</strong> <code>${_cbEscapeHtml(neoRes.depth)}</code> (${(neoRes.depthConfidence * 100).toFixed(1)}%) · <strong>Transformer:</strong> ${neoRes.latencyMs} ms${contextNote}</div>
        ${toolLines.length ? `<div><strong>Comprobaciones ejecutadas:</strong><ul>${toolLines.join('')}</ul></div>` : ''}
        ${ragLines.length ? `<div><strong>RAG Híbrido (BM25 + Vector 64D):</strong><ul>${ragLines.join('')}</ul></div>` : ''}
      </div>
    </details>
  `;
}

function executeActionCommandIfAny(cmd) {
  if (!cmd) return '';
  if (cmd.type === 'quick_tool' && typeof openQuickControlTool === 'function') {
    setTimeout(() => {
      try {
        openQuickControlTool(cmd.tool);
      } catch (_) {}
    }, 80);
    return `⚡ Abriendo <strong>${_cbEscapeHtml(cmd.label)}</strong>...`;
  }
  if (cmd.type === 'all_branches_history') {
    setTimeout(() => {
      try {
        if (typeof navigate === 'function') navigate('historial');
        if (typeof viewAllBranchesDataInHistory === 'function') viewAllBranchesDataInHistory();
      } catch (_) {}
    }, 80);
    return `🏢 Abriendo <strong>Historial Consolidado de Todas las Sucursales</strong>...`;
  }
  if (cmd.type === 'force_sync' && typeof forceSync === 'function') {
    setTimeout(() => {
      try {
        forceSync();
      } catch (_) {}
    }, 80);
    return `☁️ Ejecutando sincronización bidireccional con Supabase...`;
  }
  if (cmd.type === 'navigate' && typeof navigate === 'function') {
    setTimeout(() => {
      try {
        if (cmd.subTab) navigate(cmd.page, cmd.subTab);
        else navigate(cmd.page);
      } catch (_) {}
    }, 80);
    return `📲 Navegando a <strong>${_cbEscapeHtml(cmd.label || cmd.page)}</strong>...`;
  }
  return '';
}

function runReciBotNeo(queryText) {
  const models = _getModelsApi();
  if (!models || typeof models.inferNeo !== 'function') {
    return getChatbotResponse(queryText);
  }
  const tStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const scenario = analyzeLegalAndBusinessScenario(queryText, RECIBOT_MEMORY);
  const calcRes = tryRunDeterministicCalculator(queryText);
  const actionCmd = detectExplicitActionCommand(queryText);
  const isRawIdentity = !calcRes && _isIdentityOrSpecQuery(queryText, '');

  const effectiveText =
    !isRawIdentity && scenario.isFollowUp ? _enrichQueryWithMemory(queryText, RECIBOT_MEMORY) : queryText;
  const clauses = isRawIdentity ? [queryText] : splitSemanticClauses(effectiveText);
  const clauseResults = clauses.map((cl) => models.inferNeo(cl));
  const neoRes = clauseResults[0];

  const isIdentityQuery = !calcRes && _isIdentityOrSpecQuery(queryText, neoRes.intent);
  const isSocialSmallTalk =
    !isIdentityQuery && (neoRes.intent === 'greeting' || neoRes.intent === 'thanks_farewell');

  // Merge RAG docs across primary enriched query + any extra semantic clauses (deduplicated, sorted by hybridScore)
  const ragMap = new Map();
  const extraRag =
    typeof models.retrieveRag === 'function' ? models.retrieveRag(effectiveText, 'neo', 5) : neoRes.ragTopDocs || [];
  [...(neoRes.ragTopDocs || []), ...extraRag, ...clauseResults.slice(1).flatMap((r) => r.ragTopDocs || [])].forEach(
    (doc) => {
      if (!doc) return;
      const prev = ragMap.get(doc.id);
      if (!prev || doc.hybridScore > prev.hybridScore) ragMap.set(doc.id, doc);
    }
  );
  const mergedRagDocs = Array.from(ragMap.values())
    .sort((a, b) => b.hybridScore - a.hybridScore)
    .slice(0, 6);
  neoRes.ragTopDocs = mergedRagDocs;

  // Map intents -> default tool sets
  const intentToolsMap = new Map();
  (models.TAXONOMY.intents || []).forEach((it) => {
    intentToolsMap.set(it.name, it.tools || []);
  });

  const selectedToolNames = [];
  const addTool = (t) => {
    if (t && t !== 'run_calculator_or_nav' && !selectedToolNames.includes(t)) {
      selectedToolNames.push(t);
    }
  };

  if (!isIdentityQuery && !isSocialSmallTalk) {
    if (neoRes.intent === 'audit_full_app' || scenario.fullAppScope) {
      [
        'check_legal_compliance',
        'check_ncf_dgii',
        'check_branches',
        'check_finances',
        'check_invoices_bitacoras',
        'check_clients',
        'check_materials_prices',
        'check_quotes_docs',
        'check_routes',
        'check_collaborators',
        'check_system_sync',
        'check_control_center',
      ].forEach(addTool);
    } else {
      clauseResults.forEach((cr) => {
        (cr.tools || []).forEach((t) => addTool(t.name));
        (intentToolsMap.get(cr.intent) || []).forEach(addTool);
        if (cr.secondIntent && (cr.confidence < 0.85 || cr.depth === 'deep_multi_check')) {
          (intentToolsMap.get(cr.secondIntent) || []).slice(0, 2).forEach(addTool);
        }
      });
      if (scenario.branchQuery) addTool('check_branches');
      if (scenario.expiredOrZero || scenario.ncfCodes.length > 0) addTool('check_ncf_dgii');
      if (neoRes.intent.startsWith('legal_') || scenario.asksRisk) addTool('check_legal_compliance');
    }
  }

  const checks = [];
  const allAlerts = [];
  selectedToolNames.forEach((toolName) => {
    const res = runLiveToolCheck(toolName);
    if (res) {
      checks.push(res);
      (res.alerts || []).forEach((a) => {
        if (!allAlerts.includes(a)) allAlerts.push(a);
      });
    }
  });

  const hasLegalContext =
    !isIdentityQuery &&
    !isSocialSmallTalk &&
    (clauseResults.some((cr) => cr.intent.startsWith('legal_')) ||
      mergedRagDocs.slice(0, 2).some((d) => d.category === 'legal' || d.category === 'hybrid') ||
      scenario.deductions.length > 0 ||
      Boolean(scenario.clauseDraft));

  const selectedFacts =
    isSocialSmallTalk || isIdentityQuery
      ? []
      : selectDynamicFacts(mergedRagDocs, effectiveText, scenario, RECIBOT_MEMORY, clauses.length > 1 ? 5 : 4);

  const parts = [];
  parts.push(`<span class="recibot-mode-badge recibot-mode-badge--neo">🧠 ReciBot Neo · Argón-Auditor</span>`);

  const actionNote = executeActionCommandIfAny(actionCmd);
  if (actionNote) parts.push(`<div class="recibot-section-line">${actionNote}</div>`);

  if (calcRes) {
    parts.push(
      `<div class="recibot-highlight-box"><strong>🧮 Resultado verificado:</strong> ${_cbEscapeHtml(calcRes.summary)}<br><small>${_cbEscapeHtml(calcRes.detail)}</small></div>`
    );
  }

  if (isIdentityQuery) {
    parts.push(buildIdentityResponseHtml('neo', queryText, models));
  } else if (isSocialSmallTalk) {
    const tokLabel = _formatParamCount((models && models.NEO_METRICS && models.NEO_METRICS.vocab_size) || 2000);
    const intro =
      neoRes.intent === 'thanks_farewell'
        ? '¡A tu orden! Soy <strong>ReciBot Neo (Argón-Auditor)</strong>. Cuando necesites otra auditoría financiera, fiscal DGII o consulta legal en ReciminsaApp, aquí estaré.'
        : `¡Hola! Soy <strong>ReciBot Neo (Argón-Auditor)</strong>, tu asistente de razonamiento profundo, auditoría de datos y derecho empresarial RD (${tokLabel} tokens). ¿Qué módulo o tema legal verificamos hoy?`;
    parts.push(`<div class="recibot-rag-answer">${intro}</div>`);
  } else {
    // Law citations pills when legal context applies
    const lawRefs = Array.from(
      new Set(selectedFacts.map((f) => f.lawRef).concat(scenario.deductions.map((d) => d.tag)).filter(Boolean))
    );
    if (hasLegalContext && lawRefs.length > 0) {
      const pills = lawRefs
        .slice(0, 4)
        .map((l) => `<span class="recibot-law-pill">⚖️ ${_cbEscapeHtml(l)}</span>`)
        .join('');
      parts.push(`<div class="recibot-law-pills">${pills}</div>`);
    }

    // Dynamic scenario analytical conclusions (e.g. >30d B04, same RNC per branch, Ley 155-17 cash copper protection)
    if (scenario.deductions.length > 0) {
      const dedHtml = scenario.deductions
        .map(
          (d) =>
            `<li><strong>${_cbEscapeHtml(d.tag)}:</strong> ${_cbEscapeHtml(d.text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</li>`
        )
        .join('');
      parts.push(`<div class="recibot-legal-box"><strong>⚖️ Análisis del escenario:</strong><ul>${dedHtml}</ul></div>`);
    }

    // Customizable dynamic legal clause box if user asked to draft one
    if (scenario.clauseDraft) {
      parts.push(
        `<div class="recibot-clause-box"><strong>📝 ${_cbEscapeHtml(scenario.clauseDraft.title)}:</strong><p>${_cbEscapeHtml(scenario.clauseDraft.body)}</p></div>`
      );
    }

    // Compositional synthesis of selected non-redundant atomic facts
    if (selectedFacts.length > 0) {
      const heading = scenario.isFollowUp
        ? `Continuando sobre <strong>${_cbEscapeHtml(RECIBOT_MEMORY.activeTitle || neoRes.intentTitle)}</strong>:`
        : `<strong>${_cbEscapeHtml(neoRes.intentTitle)}</strong>`;
      const factLis = selectedFacts.map((f) => `<li>${_cbEscapeHtml(f.text)}</li>`).join('');
      parts.push(`<div class="recibot-rag-answer">${heading}<ul>${factLis}</ul></div>`);
    } else if (mergedRagDocs[0]) {
      parts.push(
        `<div class="recibot-rag-answer"><strong>${_cbEscapeHtml(mergedRagDocs[0].title)}</strong><br>${_cbEscapeHtml(mergedRagDocs[0].content)}</div>`
      );
    }
  }

  // Live verified findings
  if (checks.length > 0 && !isSocialSmallTalk && !isIdentityQuery) {
    const bulletItems = checks.map((c) => {
      const icon = c.status === 'warn' || c.status === 'error' ? '⚠️' : '✅';
      const subDetails =
        c.details && c.details.length > 0 ? `<br><small>${_cbEscapeHtml(c.details.slice(0, 3).join(' · '))}</small>` : '';
      return `<li>${icon} <strong>${_cbEscapeHtml(c.label)}:</strong> ${_cbEscapeHtml(c.summary)}${subDetails}</li>`;
    });
    parts.push(
      `<div class="recibot-live-box"><strong>📊 Verificación en vivo (${checks.length} módulo${checks.length === 1 ? '' : 's'}):</strong><ul>${bulletItems.join('')}</ul></div>`
    );
  }

  // Alerts highlighted prominently
  if (allAlerts.length > 0 && !isSocialSmallTalk && !isIdentityQuery) {
    const alertItems = allAlerts.slice(0, 12).map((a) => `<li>⚠️ ${_cbEscapeHtml(a)}</li>`).join('');
    parts.push(`<div class="recibot-alert-box"><strong>Alertas detectadas al verificar:</strong><ul>${alertItems}</ul></div>`);
  }

  const actionsHtml = !isIdentityQuery ? buildActionButtonsForIntent(neoRes.intent, allAlerts.length > 0) : '';
  if (actionsHtml) {
    parts.push(`<div class="recibot-action-row">${actionsHtml}</div>`);
  }

  // Contextual follow-up chips (safe data-recibot-query attribute)
  if (!isSocialSmallTalk) {
    const followUps = buildContextualFollowUpPrompts(isIdentityQuery ? 'identity_capabilities' : neoRes.intent, scenario);
    if (followUps.length > 0) {
      const chips = followUps
        .map(
          (fq) =>
            `<button type="button" class="recibot-followup-btn" data-recibot-query="${_cbEscapeHtml(fq)}" onclick="if(typeof sendQuickPrompt==='function')sendQuickPrompt(this.getAttribute('data-recibot-query')||'');">${_cbEscapeHtml(fq)}</button>`
        )
        .join('');
      parts.push(`<div class="recibot-followups">${chips}</div>`);
    }
  }

  if (hasLegalContext) {
    parts.push(
      `<div class="recibot-disclaimer">⚖️ Orientación jurídica-empresarial basada en normativa RD y datos de tu app; para litigios o decisiones de alto impacto valida con un abogado o contador autorizado.</div>`
    );
  }

  _updateMemoryAfterTurn(queryText, neoRes.intent, neoRes.intentTitle, mergedRagDocs, scenario);

  const tEnd = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  parts.push(formatReasoningTrace(neoRes, checks, calcRes, scenario, Math.max(0.1, tEnd - tStart)));

  return parts.join('');
}

function runReciBotFlash(queryText) {
  const models = _getModelsApi();
  if (!models || typeof models.inferFlash !== 'function') {
    return getChatbotResponse(queryText);
  }
  const scenario = analyzeLegalAndBusinessScenario(queryText, RECIBOT_MEMORY);
  const calcRes = tryRunDeterministicCalculator(queryText);
  const actionCmd = detectExplicitActionCommand(queryText);
  const isRawIdentity = !calcRes && _isIdentityOrSpecQuery(queryText, '');
  const effectiveText =
    !isRawIdentity && scenario.isFollowUp ? _enrichQueryWithMemory(queryText, RECIBOT_MEMORY) : queryText;
  const flashRes = models.inferFlash(effectiveText);

  const isIdentityQuery = !calcRes && _isIdentityOrSpecQuery(queryText, flashRes.intent);
  const isSocialSmallTalk =
    !isIdentityQuery && (flashRes.intent === 'greeting' || flashRes.intent === 'thanks_farewell');

  // Flash performs at most 1 fast single-pass check
  let singleCheck = null;
  const candidateTool =
    flashRes.topTool && flashRes.topTool !== 'run_calculator_or_nav'
      ? flashRes.topTool
      : ((flashRes.tools || []).find((t) => t.name !== 'run_calculator_or_nav') || {}).name;

  if (candidateTool && !calcRes && !isIdentityQuery && !isSocialSmallTalk) {
    singleCheck = runLiveToolCheck(candidateTool);
  }

  const ragDocs = flashRes.ragTopDocs || (flashRes.ragTopDoc ? [flashRes.ragTopDoc] : []);
  const isLegal =
    !isIdentityQuery &&
    !isSocialSmallTalk &&
    (flashRes.intent.startsWith('legal_') ||
      (ragDocs[0] && (ragDocs[0].category === 'legal' || ragDocs[0].category === 'hybrid')) ||
      scenario.deductions.length > 0 ||
      Boolean(scenario.clauseDraft));

  const parts = [];
  parts.push(`<span class="recibot-mode-badge recibot-mode-badge--flash">⚡ ReciBot Flash · Pulso-Ágil · ${flashRes.latencyMs} ms</span>`);

  const actionNote = executeActionCommandIfAny(actionCmd);
  if (actionNote) parts.push(`<div class="recibot-section-line">${actionNote}</div>`);

  if (calcRes) {
    parts.push(
      `<div class="recibot-highlight-box"><strong>🧮 ${_cbEscapeHtml(calcRes.summary)}</strong><br><small>${_cbEscapeHtml(calcRes.detail)}</small></div>`
    );
  } else if (isIdentityQuery) {
    parts.push(buildIdentityResponseHtml('flash', queryText, models));
  } else if (isSocialSmallTalk) {
    const tokLabel = _formatParamCount((models && models.NEO_METRICS && models.NEO_METRICS.vocab_size) || 2000);
    const msg =
      flashRes.intent === 'thanks_farewell'
        ? '¡Con gusto! Soy <strong>ReciBot Flash (Pulso-Ágil)</strong>, listo para responderte al instante cuando me necesites.'
        : `¡Hola! Soy <strong>ReciBot Flash (Pulso-Ágil)</strong> (${tokLabel} tokens · respuesta en milisegundos). Pídeme un balance, conversión o consulta rápida.`;
    parts.push(`<div class="recibot-rag-answer">${msg}</div>`);
  } else if (scenario.clauseDraft) {
    parts.push(
      `<div class="recibot-clause-box"><strong>📝 ${_cbEscapeHtml(scenario.clauseDraft.title)}:</strong><p>${_cbEscapeHtml(scenario.clauseDraft.body)}</p></div>`
    );
  } else if (scenario.deductions.length > 0) {
    const d0 = scenario.deductions[0];
    parts.push(
      `<div class="recibot-legal-box"><strong>⚖️ ${_cbEscapeHtml(d0.tag)}:</strong> ${_cbEscapeHtml(d0.text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>`
    );
  } else if (ragDocs.length > 0) {
    const facts = selectDynamicFacts(ragDocs.slice(0, 2), effectiveText, scenario, RECIBOT_MEMORY, 2);
    if (facts.length > 0) {
      parts.push(
        `<div class="recibot-rag-answer"><strong>${_cbEscapeHtml(ragDocs[0].title)}${ragDocs[0].law_ref ? ` (${_cbEscapeHtml(ragDocs[0].law_ref)})` : ''}:</strong> ${facts.map((f) => _cbEscapeHtml(f.text)).join(' ')}</div>`
      );
    } else {
      parts.push(
        `<div class="recibot-rag-answer"><strong>${_cbEscapeHtml(ragDocs[0].title)}:</strong> ${_cbEscapeHtml(ragDocs[0].content)}</div>`
      );
    }
  }

  if (singleCheck) {
    const icon = singleCheck.status === 'warn' ? '⚠️' : '✅';
    parts.push(`<div class="recibot-live-box">${icon} <strong>${_cbEscapeHtml(singleCheck.label)}:</strong> ${_cbEscapeHtml(singleCheck.summary)}</div>`);
    if (singleCheck.alerts && singleCheck.alerts.length > 0) {
      parts.push(`<div class="recibot-alert-box">⚠️ ${_cbEscapeHtml(singleCheck.alerts[0])}</div>`);
    }
  }

  if (isLegal || (!isIdentityQuery && (flashRes.intent === 'audit_full_app' || (flashRes.confidence < 0.60 && !calcRes)))) {
    parts.push(
      `<div class="recibot-action-row"><button type="button" class="chatbot-action-btn" data-recibot-query="${_cbEscapeHtml(queryText)}" onclick="if(typeof setReciBotModel==='function')setReciBotModel('neo',false);if(typeof sendQuickPrompt==='function')sendQuickPrompt(this.getAttribute('data-recibot-query')||'');">🧠 Profundizar con Neo</button></div>`
    );
  } else if (!isIdentityQuery) {
    const actionsHtml = buildActionButtonsForIntent(flashRes.intent, Boolean(singleCheck && singleCheck.alerts && singleCheck.alerts.length));
    if (actionsHtml) parts.push(`<div class="recibot-action-row">${actionsHtml}</div>`);
  }

  if (isLegal) {
    parts.push(
      `<div class="recibot-disclaimer">⚖️ Orientación jurídica-empresarial basada en normativa RD y datos de tu app; para litigios o decisiones de alto impacto valida con un abogado o contador autorizado.</div>`
    );
  }

  _updateMemoryAfterTurn(queryText, flashRes.intent, flashRes.intentTitle, ragDocs, scenario);

  parts.push(
    `<div class="recibot-flash-meta"><small>⚡ Pulso-Ágil (Flash) · ${_cbEscapeHtml(flashRes.intent)} (${(flashRes.confidence * 100).toFixed(0)}%)</small></div>`
  );
  return parts.join('');
}

function getChatbotResponse(userText, overrideMode = null) {
  const clean = String(userText || '').trim();
  if (!clean) return '';

  const models = _getModelsApi();
  if (!models) {
    const calcOnly = tryRunDeterministicCalculator(clean);
    if (calcOnly) {
      return `<strong>🧮 ${_cbEscapeHtml(calcOnly.summary)}</strong><br><small>${_cbEscapeHtml(calcOnly.detail)}</small>`;
    }
    return '⚠️ Los pesos neuronales de <code>recibot-models.js</code> aún no están cargados. Recarga la app o verifica <code>js/recibot-models.js</code>.';
  }

  const mode = overrideMode || getReciBotModel();
  return mode === 'flash' ? runReciBotFlash(clean) : runReciBotNeo(clean);
}

/* ==========================================================================
   DOM INITIALIZATION & MESSAGE RENDERING
   ========================================================================== */

function getWelcomeHtml() {
  const models = _getModelsApi();
  const neoInf = _formatParamCount((models && models.NEO_METRICS && models.NEO_METRICS.inference_parameters) || 444762);
  const flashParams = _formatParamCount((models && models.FLASH_METRICS && models.FLASH_METRICS.parameters) || 111671);
  const vocabSize = _formatParamCount((models && models.NEO_METRICS && models.NEO_METRICS.vocab_size) || 2000);
  return `
    <span class="recibot-mode-badge recibot-mode-badge--neo">🧠 Argón-Auditor (Neo) + ⚡ Pulso-Ágil (Flash) · ${vocabSize} Tokens</span>
    ¡Hola! Somos los modelos duales entrenados para <strong>ReciminsaApp</strong> y normativa legal empresarial RD (DGII/NCF, Ley 32-23, Ley 225-20/64-00, Ley 479-08, Ley 16-92/TSS, Ley 172-13 y Ley 155-17):<br>
    • <strong>🧠 ReciBot Neo (Argón-Auditor · ${neoInf} páram.):</strong> Razonamiento profundo, memoria multi-turno, borradores legales y comprobaciones en vivo.<br>
    • <strong>⚡ ReciBot Flash (Pulso-Ágil · ${flashParams} páram.):</strong> Respuestas instantáneas, métricas directas y cálculos exactos.<br>
    <em>Nota: Nuestras respuestas, auditorías y cálculos son orientativos según los datos actuales en tu aplicación.</em>
    <div class="recibot-quick-chips">
      <button type="button" class="recibot-chip" onclick="sendQuickPrompt('Quién eres y cuántos parámetros tienes')">🤖 ¿Quién eres?</button>
      <button type="button" class="recibot-chip" onclick="sendQuickPrompt('Hazme una auditoría completa de toda la app')">🔍 Auditoría Total</button>
      <button type="button" class="recibot-chip" onclick="sendQuickPrompt('Revisa mi cumplimiento legal empresarial y riesgos DGII')">⚖️ Riesgo Legal</button>
      <button type="button" class="recibot-chip" onclick="sendQuickPrompt('Revisa mis secuencias NCF de la DGII y si hay vencidas')">🧾 NCF DGII</button>
      <button type="button" class="recibot-chip" onclick="sendQuickPrompt('Resumen de todas mis sucursales')">🏢 Sucursales</button>
      <button type="button" class="recibot-chip" onclick="sendQuickPrompt('Cuál es mi balance de ingresos y egresos ahora mismo')">💰 Balance</button>
      <button type="button" class="recibot-chip" onclick="sendQuickPrompt('Cómo activo los botones del centro de control en Android')">🎛️ Centro Control</button>
      <button type="button" class="recibot-chip" onclick="sendQuickPrompt('Abrir mini factura rápida')">⚡ Mini Factura</button>
    </div>
  `;
}

function appendMessage(sender, text) {
  const messagesContainer = document.getElementById('chatbot-messages');
  if (!messagesContainer) return;

  let cleanText = String(text == null ? '' : text);
  if (sender === 'bot' && cleanText.includes('[NAVIGATE:')) {
    const match = cleanText.match(/\[NAVIGATE:([a-z0-9_]+)\]/i);
    if (match) {
      const targetPage = match[1].toLowerCase();
      cleanText = cleanText.replace(match[0], '').trim();
      setTimeout(() => {
        if (typeof navigate === 'function') navigate(targetPage);
      }, 150);
    }
  }

  const msgDiv = document.createElement('div');
  msgDiv.className = `chatbot-msg chatbot-msg--${sender}`;

  if (sender === 'user') {
    msgDiv.textContent = cleanText;
  } else {
    const looksLikeHtml =
      cleanText.includes('<details') ||
      cleanText.includes('<button') ||
      cleanText.includes('<div') ||
      cleanText.includes('<strong>') ||
      cleanText.includes('<br>') ||
      cleanText.includes('<span') ||
      cleanText.includes('<small');
    if (looksLikeHtml) {
      msgDiv.innerHTML = cleanText;
    } else {
      msgDiv.innerHTML = _cbEscapeHtml(cleanText)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
    }
  }

  messagesContainer.appendChild(msgDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTypingIndicator() {
  const messagesContainer = document.getElementById('chatbot-messages');
  if (!messagesContainer) return null;
  const typing = document.createElement('div');
  typing.className = 'chatbot-typing';
  typing.id = 'chatbot-typing-indicator';
  typing.innerHTML = '<span></span><span></span><span></span>';
  messagesContainer.appendChild(typing);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return typing;
}

function removeTypingIndicator() {
  const existing = document.getElementById('chatbot-typing-indicator');
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
}

function handleChatSubmit(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const input = document.getElementById('chatbot-input');
  if (!input) return;

  const userText = input.value.trim();
  if (!userText) return;

  input.value = '';
  appendMessage('user', userText);

  const mode = getReciBotModel();
  if (mode === 'flash') {
    const reply = getChatbotResponse(userText, 'flash');
    appendMessage('bot', reply);
    return;
  }

  showTypingIndicator();
  setTimeout(() => {
    removeTypingIndicator();
    const reply = getChatbotResponse(userText, 'neo');
    appendMessage('bot', reply);
  }, 140);
}

const _cbGlobalRoot = typeof window !== 'undefined' ? window : globalThis;

_cbGlobalRoot.sendQuickPrompt = function sendQuickPrompt(promptText) {
  if (typeof document === 'undefined') return;
  const win = document.getElementById('chatbot-window');
  if (win && !win.classList.contains('open')) {
    win.classList.add('open');
  }
  const input = document.getElementById('chatbot-input');
  const form = document.getElementById('chatbot-form');
  if (input && form) {
    input.value = promptText;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  } else if (input) {
    input.value = promptText;
    handleChatSubmit(null);
  }
};

_cbGlobalRoot.setReciBotModel = setReciBotModel;
_cbGlobalRoot.getReciBotModel = getReciBotModel;
_cbGlobalRoot.clearReciBotMemory = clearReciBotMemory;
_cbGlobalRoot.recibotRunQuery = function recibotRunQuery(query, mode = null) {
  return getChatbotResponse(query, mode);
};

function initChatbot() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('chatbot-fab')) return;

  const fab = document.createElement('button');
  fab.id = 'chatbot-fab';
  fab.className = 'chatbot-fab';
  fab.type = 'button';
  fab.title = 'Abrir asistente ReciBot (Neo / Flash)';
  fab.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5A2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5a2.5 2.5 0 0 0 2.5 2.5a2.5 2.5 0 0 0 2.5-2.5a2.5 2.5 0 0 0-2.5-2.5Z"/></svg>`;

  const chatWindow = document.createElement('div');
  chatWindow.id = 'chatbot-window';
  chatWindow.className = 'chatbot-window';
  chatWindow.innerHTML = `
    <div class="chatbot-header">
      <div class="chatbot-title">
        <div class="chatbot-status-dot"></div>
        <div class="chatbot-title-text">
          <span id="recibot-header-name">ReciBot Neo</span>
          <small id="recibot-header-subtitle">Argón-Auditor · 2,000 tok · Legal + Verificación</small>
        </div>
      </div>
      <div class="recibot-model-switch" role="group" aria-label="Selector de modelo ReciBot">
        <button type="button" id="recibot-model-neo" class="recibot-model-btn" data-model="neo" title="ReciBot Neo: Transformer profundo, memoria multi-turno y análisis legal">🧠 Neo</button>
        <button type="button" id="recibot-model-flash" class="recibot-model-btn" data-model="flash" title="ReciBot Flash: Modelo destilado ultrarrápido">⚡ Flash</button>
      </div>
      <button id="chatbot-close" class="chatbot-close" type="button" title="Cerrar chat">✕</button>
    </div>
    <div id="chatbot-messages" class="chatbot-messages"></div>
    <form id="chatbot-form" class="chatbot-footer">
      <input type="text" id="chatbot-input" class="chatbot-input" placeholder="Consulta de la app, leyes RD o auditoría..." autocomplete="off" />
      <button type="submit" id="chatbot-send" class="chatbot-send" title="Enviar mensaje">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    </form>
  `;

  document.body.appendChild(fab);
  document.body.appendChild(chatWindow);

  const neoBtn = document.getElementById('recibot-model-neo');
  const flashBtn = document.getElementById('recibot-model-flash');
  const closeBtn = document.getElementById('chatbot-close');
  const form = document.getElementById('chatbot-form');
  const input = document.getElementById('chatbot-input');

  _syncReciBotHeaderUI(getReciBotModel());
  appendMessage('bot', getWelcomeHtml());

  fab.addEventListener('click', () => {
    chatWindow.classList.toggle('open');
    if (chatWindow.classList.contains('open') && input) {
      setTimeout(() => input.focus(), 120);
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      chatWindow.classList.remove('open');
    });
  }

  if (neoBtn) {
    neoBtn.addEventListener('click', () => setReciBotModel('neo', true));
  }
  if (flashBtn) {
    flashBtn.addEventListener('click', () => setReciBotModel('flash', true));
  }
  if (form) {
    form.addEventListener('submit', handleChatSubmit);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbot);
  } else {
    initChatbot();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CHATBOT_API_CONFIG,
    RECIBOT_MEMORY,
    clearReciBotMemory,
    getReciBotModel,
    setReciBotModel,
    getChatbotResponse,
    runReciBotNeo,
    runReciBotFlash,
    runLiveToolCheck,
    tryRunDeterministicCalculator,
    detectExplicitActionCommand,
    analyzeLegalAndBusinessScenario,
    splitSemanticClauses,
    isFollowUpQuery,
    initChatbot,
  };
}
