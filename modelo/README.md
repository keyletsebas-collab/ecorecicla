# ReciBot Dual Neural Models (v4 · 2,000 Tokens) — `recibot-neo` (`Argón-Auditor`) & `recibot-flash` (`Pulso-Ágil`)

Arquitectura dual conversacional y legal empresarial con identidad propia en primera persona, autoconocimiento por facetas y vocabulario expandido a **2,000 tokens** para **ReciminsaApp (`reciminsaapp`)**, integrando metodologías de:
1. **`rasbt/LLMs-from-scratch`**: Transformer GPT causal Pre-LN desde cero (atención multi-cabeza causal + FFN GELU) y preentrenamiento autorregresivo sobre corpus operativo, identidad y jurídico-empresarial dominicano.
2. **`mlabonne/llm-course`**: Adaptación **LoRA (Rank-8)** multi-tarea, alineamiento por preferencias **DPO (Direct Preference Optimization)**, **Knowledge Distillation** (`T=2.5`) de Neo hacia Flash y **cuantización Int8 simétrica**.
3. **`DataTalksClub/llm-zoomcamp`**: Motor **RAG Híbrido** combinando **BM25** (`k1=1.5`, `b=0.75`) + similitud coseno **Dense Vector 64D** con evaluación Hit-Rate@1/3 y MRR sobre **77 documentos atómicos** (44 de app e identidades + 33 legales/híbridos con cláusulas atómicas `facts` y referencias normativas `law_ref`).

---

## 1. Identidades, Corpus (2,000 Tokens) y Entrenamiento Secuencial (CPU-Safe)

Para evitar picos de CPU/RAM en el equipo local (`OMP_NUM_THREADS=4 MKL_NUM_THREADS=4`), el entrenamiento se ejecutó de forma **estrictamente secuencial**: primero `recibot-neo` (`Argón-Auditor`) y luego `recibot-flash` (`Pulso-Ágil`).

- **Identidad `recibot-neo` (`Argón-Auditor`):** Auditoría profunda, razonamiento multi-paso y verificación cruzada financiera, NCF/DGII y jurídica.
- **Identidad `recibot-flash` (`Pulso-Ágil`):** Respuesta instantánea, cálculos exactos y orientación operativa concisa destilada desde Neo.
- **Vocabulario compartido:** `2,000` tokens (`MAX_SEQ_LEN=32`), tokenizador determinístico UTF-8 con plegado de acentos (`1,868` palabras de dominio + `4` especiales + `128` buckets OOV FNV-1a `1872..1999`; `0` slots `<RESERVED_...>`).
- **Taxonomía ReciminsaApp + Legal RD:** `42` intenciones (`32` operativas de `reciminsaapp` incluida `identity_capabilities` + `10` de derecho empresarial vinculado: Código Tributario `Ley 11-92`/NCF/B04 `30` días, Facturación Electrónica `Ley 32-23`, Retenciones `Norma 02-05`/`07-07`/calendario DGII, Medio Ambiente `Ley 64-00` & Residuos `Ley 225-20`, Sociedades y sucursales bajo mismo RNC `Ley 479-08`, Contratos mercantiles/cotizaciones/conduces, Laboral/TSS/EPP `Ley 16-92` & `Ley 87-01`, Datos y Ciberseguridad `Ley 172-13`/`126-02`/`53-07`, Antilavado y origen lícito de chatarra `Ley 155-17`, y Auditoría de riesgos jurídicos), `13` herramientas de verificación en vivo (incluyendo `check_legal_compliance`) y `3` niveles de profundidad.
- **Corpus y dataset:** `3,486` muestras de entrenamiento y `882` de validación usadas por los scripts de entrenamiento (`4,032` train / `1,008` val generadas por [reciminsa_dataset.py](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/shared/reciminsa_dataset.py) con `target_per_intent=120`), `909` oraciones de preentrenamiento causal, `74` pares DPO de preferencia y `77` documentos KB ([reciminsa_kb.json](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/shared/reciminsa_kb.json)).

---

## 2. Comparativa de Modelos, Parámetros y Benchmarks Medidos (v4 · 2,000 Tokens)

| Métrica | `modelo/recibot-neo` (`Argón-Auditor`) | `modelo/recibot-flash` (`Pulso-Ágil`) |
| :--- | :--- | :--- |
| **Identidad / Rol** | `Argón-Auditor`: Razonamiento multi-cláusula, memoria multi-turno, análisis legal y 13 chequeos en vivo | `Pulso-Ágil`: Respuestas ultrarrápidas, cálculos exactos y enrutamiento directo |
| **Arquitectura** | `GPT-Transformer(2L,4H,d=112,ffn=224)+LoRA(r=8)+DPO+RAG(d=64)` | `Embedding(2000,48)+MeanMaxPool(96)+ReLU(72)+DistillFromNeo(T=2.5)` |
| **Parámetros (inferencia)** | `444,762` (`690,266` totales con LoRA durante SFT; `260,410` entrenables LoRA) | `111,671` (`3.98x` menos parámetros que Neo en inferencia) |
| **Total combinado (Neo + Flash)** | **`556,433` parámetros en inferencia** (`801,937` incluyendo LoRA de entrenamiento) | ← Suma de ambos modelos a `2,000` tokens |
| **Entrenamiento** | 15 ep Pretrain (PPL `4.59`) + 32 ep LoRA SFT + 12 ep DPO (`194.215 s`) | 50 epochs destilación desde `recibot_neo.pt` congelado (`14.956 s`) |
| **Val Intent Accuracy (FP32)** | `0.9966` (F1 macro `0.9966`) | `1.0000` (F1 macro `1.0000`) |
| **Val Intent Accuracy (Int8)** | `0.9966` | `1.0000` |
| **Val Tool Macro F1** | `0.9900` | `0.9960` |
| **Val Depth Accuracy** | `1.0000` | N/A (ruta directa) |
| **Teacher Agreement (Flash vs Neo)** | — | `0.9966` |
| **Hybrid RAG Hit@1 / Hit@3 / MRR** | `0.7642` / `0.9365` / `0.8542` | `0.8050` / `0.9592` / `0.8844` |
| **Dense / BM25 RAG Hit@1** | `0.8061` / `0.6077` | `0.9082` / `0.6077` |
| **Latencia Python FP32** | `1277.53 µs` | `147.89 µs` (`8.64x` más rápido en Python) |
| **Latencia C++ Nativo (`-O3`)** | `4350.44 µs` | `6.54 µs` |

---

## 3. Arquitectura Políglota (9 Lenguajes)

### Runtimes compilados y ejecutados en este entorno local
- **Python (`python3`):** [train_neo.py](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-neo/python/train_neo.py), [train_flash.py](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-flash/python/train_flash.py), [reciminsa_dataset.py](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/shared/reciminsa_dataset.py), [rag_engine.py](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/shared/rag_engine.py), [export_js_bundle.py](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/shared/export_js_bundle.py).
- **C++ (`g++ -O3 -std=c++17`):** [neo_inference.cpp](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-neo/cpp/neo_inference.cpp) y [flash_inference.cpp](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-flash/cpp/flash_inference.cpp).
- **Java (`javac` / `java`):** [NeoVerifier.java](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-neo/java/NeoVerifier.java) (incluye invariantes DGII, ventana B04 `30` días y KYC compra en efectivo chatarra) y [FlashRunner.java](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-flash/java/FlashRunner.java).
- **JavaScript (`node` + WebView):** [neo_runtime.js](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-neo/js/neo_runtime.js), [flash_runtime.js](file:///home/keylet/Documentos/Proyectos/ecorecicla/modelo/recibot-flash/js/flash_runtime.js), [recibot-models.js](file:///home/keylet/Documentos/Proyectos/ecorecicla/js/recibot-models.js) (`973.09 KB`) y [chatbot.js](file:///home/keylet/Documentos/Proyectos/ecorecicla/js/chatbot.js).

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
* **Identidad y Autoconocimiento Conversacional (`buildIdentityResponseHtml`):** Tanto **ReciBot Neo (`Argón-Auditor`)** como **ReciBot Flash (`Pulso-Ágil`)** responden dinámicamente en primera persona sobre sí mismos según la faceta consultada (origen y propósito en `ReciminsaApp`, arquitectura Transformer/LoRA/DPO/Destilación y pila políglota de 9 lenguajes, conteo exacto en vivo de `1,500` tokens y parámetros, ejecución 100% local/offline Int8 con memoria de `6` turnos, límites éticos/técnicos sin sentimientos ni conciencia, benchmarks v3 y comparación entre Neo y Flash).
