# ReciBot Dual Neural Models (v5 · 20,000 Tokens · 500,530 Params Neo) — `recibot-neo` (`Argón-Auditor`) & `recibot-flash` (`Pulso-Ágil`)

Arquitectura dual conversacional y legal empresarial con identidad propia en primera persona, autoconocimiento por facetas, **embeddings factorizados tipo ALBERT**, vocabulario de **20,000 tokens** y **`500,530` parámetros en inferencia para ReciBot Neo** (`172,087` para ReciBot Flash) para **ReciminsaApp (`reciminsaapp`)**, integrando metodologías de:
1. **`rasbt/LLMs-from-scratch`**: Transformer GPT causal Pre-LN desde cero (embeddings factorizados `20,000×14→112` + atención multi-cabeza causal + FFN GELU) y preentrenamiento autorregresivo sobre corpus operativo, identidad y jurídico-empresarial dominicano.
2. **`mlabonne/llm-course`**: Adaptación **LoRA (Rank-8)** en atención completa (`wq/wk/wv/wo`) y FFN, alineamiento por preferencias **DPO (Direct Preference Optimization)** con resguardo de validación, **Knowledge Distillation** (`T=2.5`) de Neo hacia Flash y **cuantización Int8 simétrica**.
3. **`DataTalksClub/llm-zoomcamp`**: Motor **RAG Híbrido** combinando **BM25** (`k1=1.5`, `b=0.75`) + similitud coseno **Dense Vector 64D** con evaluación Hit-Rate@1/3 y MRR sobre **77 documentos atómicos** (44 de app e identidades + 33 legales/híbridos con cláusulas atómicas `facts` y referencias normativas `law_ref`).

---

## 1. Identidades, Vocabulario (20,000 Tokens) y Entrenamiento por Etapas (PC-Safe)

Para cuidar el rendimiento de CPU y RAM (`OMP_NUM_THREADS=2 MKL_NUM_THREADS=2 nice -n 15`), ambos modelos se entrenaron de forma **estrictamente secuencial y por etapas guardando checkpoints parciales**: primero `recibot-neo` (`Argón-Auditor`, 5 etapas) y luego `recibot-flash` (`Pulso-Ágil`, 2 etapas).

- **Identidad `recibot-neo` (`Argón-Auditor`):** Auditoría profunda, razonamiento multi-paso y verificación cruzada financiera, NCF/DGII y jurídica.
- **Identidad `recibot-flash` (`Pulso-Ágil`):** Respuesta instantánea, cálculos exactos y orientación operativa concisa destilada desde Neo.
- **Vocabulario compartido:** `20,000` tokens reales (`MAX_SEQ_LEN=32`), tokenizador determinístico UTF-8 con plegado de acentos (`11,804` palabras de dominio, códigos DGII/flota y expansiones morfológicas + `4` especiales + `8,192` buckets OOV FNV-1a `11808..19999`; `0` slots `<RESERVED_...>`).
- **Taxonomía ReciminsaApp + Legal RD:** `42` intenciones (`32` operativas de `reciminsaapp` incluida `identity_capabilities` + `10` de derecho empresarial vinculado: Código Tributario `Ley 11-92`/NCF/B04 `30` días, Facturación Electrónica `Ley 32-23`, Retenciones `Norma 02-05`/`07-07`/calendario DGII, Medio Ambiente `Ley 64-00` & Residuos `Ley 225-20`, Sociedades y sucursales bajo mismo RNC `Ley 479-08`, Contratos mercantiles/cotizaciones/conduces, Laboral/TSS/EPP `Ley 16-92` & `Ley 87-01`, Datos y Ciberseguridad `Ley 172-13`/`126-02`/`53-07`, Antilavado y origen lícito de chatarra `Ley 155-17`, y Auditoría de riesgos jurídicos), `13` herramientas de verificación en vivo (incluyendo `check_legal_compliance`) y `3` niveles de profundidad.
- **Corpus y dataset:** `4,032` muestras de entrenamiento y `1,008` de validación (`target_per_intent=120`), `910` oraciones de preentrenamiento causal, `74` pares DPO de preferencia y `77` documentos KB ([reciminsa_kb.json](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/shared/reciminsa_kb.json)).

---

## 2. Comparativa de Modelos, Parámetros y Benchmarks Medidos (v5 · 20,000 Tokens)

| Métrica | `modelo/recibot-neo` (`Argón-Auditor`) | `modelo/recibot-flash` (`Pulso-Ágil`) |
| :--- | :--- | :--- |
| **Identidad / Rol** | `Argón-Auditor`: Razonamiento multi-cláusula, memoria multi-turno, análisis legal y 13 chequeos en vivo | `Pulso-Ágil`: Respuestas ultrarrápidas, cálculos exactos y enrutamiento directo |
| **Arquitectura** | `GPT-Factorized(20000x14->112,2L,4H,ffn=220)+LoRA(r=8)+DPO+RAG(d=64)` | `Embedding(20000,8)+MeanMaxPool(16)+ReLU(88)+DistillFromNeo(T=2.5)` |
| **Parámetros (inferencia)** | **`500,530`** (`525,490` totales con LoRA durante SFT; `325,018` entrenables LoRA) | **`172,087`** (`2.91x` menos parámetros que Neo en inferencia) |
| **Total combinado (Neo + Flash)** | **`672,617` parámetros en inferencia** (`697,577` incluyendo LoRA de entrenamiento) | ← Suma de ambos modelos a `20,000` tokens |
| **Entrenamiento por etapas** | 15 ep Pretrain (`PPL 290.15`) + 40 ep LoRA SFT + 10 ep DPO (`431.163 s` en 5 etapas) | 60 epochs destilación desde `recibot_neo.pt` congelado (`37.632 s` en 2 etapas) |
| **Val Intent Accuracy (FP32)** | `0.9960` (F1 macro `0.9960`) | `0.9990` (F1 macro `0.9990`) |
| **Val Intent Accuracy (Int8)** | `0.9950` | `0.9980` |
| **Val Tool Macro F1** | `0.9910` | `0.9982` |
| **Val Depth Accuracy** | `0.9980` | N/A (ruta directa) |
| **Teacher Agreement (Flash vs Neo)** | — | `0.9960` |
| **Hybrid RAG Hit@1 / Hit@3 / MRR** | `0.6786` / `0.8591` / `0.7790` | `0.7044` / `0.8661` / `0.7922` |
| **Dense / BM25 RAG Hit@1** | `0.5030` / `0.6171` | `0.5536` / `0.6171` |
| **Latencia Python FP32** | `1379.67 µs` | `141.24 µs` (`9.77x` más rápido en Python) |
| **Latencia C++ Nativo (`-O3`)** | `4126.68 µs` (`RNE3` factorizado) | `3.18 µs` |

---

## 3. Arquitectura Políglota (9 Lenguajes)

### Runtimes compilados y ejecutados en este entorno local
- **Python (`python3`):** [train_neo.py](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-neo/python/train_neo.py), [train_flash.py](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-flash/python/train_flash.py), [reciminsa_dataset.py](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/shared/reciminsa_dataset.py), [rag_engine.py](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/shared/rag_engine.py), [export_js_bundle.py](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/shared/export_js_bundle.py).
- **C++ (`g++ -O3 -std=c++17`):** [neo_inference.cpp](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-neo/cpp/neo_inference.cpp) y [flash_inference.cpp](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-flash/cpp/flash_inference.cpp).
- **Java (`javac` / `java`):** [NeoVerifier.java](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-neo/java/NeoVerifier.java) (incluye invariantes DGII, ventana B04 `30` días y KYC compra en efectivo chatarra) y [FlashRunner.java](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-flash/java/FlashRunner.java).
- **JavaScript (`node` + WebView):** [neo_runtime.js](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-neo/js/neo_runtime.js), [flash_runtime.js](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-flash/js/flash_runtime.js), [recibot-models.js](file:///home/keylet/Documentos/Proyectos/ecorecicla/js/recibot-models.js) (`1291.23 KB`) y [chatbot.js](file:///home/keylet/Documentos/Proyectos/ecorecicla/js/chatbot.js).

### Módulos escritos listos para compilar (toolchains no instalados localmente)
- **Rust (`rustc`):** [neo/rust/src/main.rs](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-neo/rust/src/main.rs), [flash/rust/src/main.rs](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-flash/rust/src/main.rs).
- **Scala (`scalac`):** [NeoReasoningPipeline.scala](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-neo/scala/NeoReasoningPipeline.scala), [FlashFastRouter.scala](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-flash/scala/FlashFastRouter.scala).
- **R (`Rscript`):** [evaluate_neo.R](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-neo/r/evaluate_neo.R), [evaluate_flash.R](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-flash/r/evaluate_flash.R).
- **Julia (`julia`):** [neo_tensor_verify.jl](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-neo/julia/neo_tensor_verify.jl), [flash_tensor_verify.jl](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-flash/julia/flash_tensor_verify.jl).
- **Mojo (`mojo`):** [neo_simd_kernel.mojo](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-neo/mojo/neo_simd_kernel.mojo), [flash_simd_kernel.mojo](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-flash/mojo/flash_simd_kernel.mojo).

---

## 4. Motor Conversacional Dinámico en `reciminsaapp`

* **Memoria multi-turno (`RECIBOT_MEMORY`) y anti-repetición:** Conserva contexto hasta 6 turnos y penaliza hechos atómicos (`facts`) ya mostrados (`usedFactIds`), respondiendo repreguntas cortas sin repetir párrafos precreados.
* **Descomposición multi-cláusula (`splitSemanticClauses`):** Separa consultas compuestas (normativa + auditoría en vivo) para unificar herramientas y cláusulas RAG relevantes.
* **Razonamiento de escenarios y generador de borradores (`analyzeLegalAndBusinessScenario`):** Evalúa plazos reales (`> 30` días en B04), RNC compartido en sucursales, riesgos de compra en efectivo sin cédula y genera borradores legales rellenos con razón social y RNC de la empresa.
* **Auditoria legal en vivo (`check_legal_compliance`):** Calcula un índice estimado de cumplimiento revisando NCF vencidos/agotados, facturas B01/E31 sin RNC válido, notas B04 sin `ncfModified`, cobertura de identificación en clientes (`nit`/`rnc`) y respaldo Google Drive.
* **Identidad y Autoconocimiento Conversacional (`buildIdentityResponseHtml`):** Tanto **ReciBot Neo (`Argón-Auditor`)** como **ReciBot Flash (`Pulso-Ágil`)** responden dinámicamente en primera persona sobre sí mismos según la faceta consultada (origen y propósito en `ReciminsaApp`, arquitectura factorizada ALBERT/Transformer/LoRA/DPO/Destilación y pila políglota de 9 lenguajes, conteo exacto en vivo de `20,000` tokens y parámetros `500,530` / `172,087`, ejecución 100% local/offline Int8 con memoria de `6` turnos, límites éticos/técnicos sin sentimientos ni conciencia, benchmarks `v5` y comparación entre Neo y Flash).
