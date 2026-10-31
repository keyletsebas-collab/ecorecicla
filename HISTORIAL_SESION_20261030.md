# 📋 Historial y Resumen de Sesión — ReciminsaApp / EcoRecicla
**Fecha:** 30 de Octubre de 2026  
**Proyecto:** ReciminsaApp (.NET 10 MAUI / Web Hybrid)  
**ID de Conversación:** `52417ebd-4e86-4c10-99af-5ac369bda5c4`

---

## 📌 1. Objetivos y Solicitudes del Usuario

1. **Corrección de Estadísticas y Gráficos:**
   - *Problema:* En pantallas móviles, los gráficos de estadísticas (trading dashboard) se reducían excesivamente hasta ser ilegibles y las etiquetas de texto se solapaban.
   - *Solución:* Implementación de contenedores con scroll horizontal táctil (`min-width`), tarjetas KPI de resumen ejecutivo superior y formateo numérico compacto (`formatTradingVal`).

2. **Eliminación de Divisa Estadounidense (USD):**
   - *Solicitud:* Quitar el Dólar (USD) y operar exclusivamente con la moneda de República Dominicana (Peso Dominicano - RD$ / DOP).
   - *Solución:* 
     - Catálogo de divisas reducido a `DOP` (`RD$`).
     - Función `getCurrency()` fija en Peso Dominicano.
     - Métodos de formato y conversión monetaria simplificados para emitir siempre `RD$`.
     - Panel de Configuración (`Ajustes`) actualizado con tarjeta oficial de Moneda Única Nacional, eliminando selectores y campos de tasa cambiaria innecesarios.
     - Generación de facturas/recibos en PDF ajustada a `PESOS` y `DOP`.

3. **Rediseño Estético del Inicio de Sesión (Login / Register):**
   - *Solicitud:* Mejorar el diseño del inicio de sesión para que sea moderno, estético y visualmente atractivo.
   - *Solución:*
     - Acabado **Glassmorphism** oscuro con desenfoque de fondo (`backdrop-filter: blur(28px)`).
     - Iluminación superior de bordes (*edge-lighting*) en verde esmeralda translúcido.
     - Tipografía moderna (*Outfit* + *Inter*) con gradiente metálico brillante.
     - Pestañas de alternancia (*Iniciar Sesión / Crear Cuenta*) integradas en carril redondeado tipo cápsula.
     - Entradas de texto ergonómicas de cristal translúcido con anillo de enfoque esmeralda de 3px.
     - Botón principal de acceso y botón biométrico con relieve lumínico y microinteracciones táctiles.
     - Inyección directa en `index.html` e invalidación de caché (`v=201`) para evitar retención de CSS antiguo en WebViews móviles.

4. **Compilación y Despliegue en Teléfono Android:**
   - *Solicitud:* Compilar el proyecto en el celular conectado.
   - *Solución:* 
     - Sincronización de activos web con `node build.js`.
     - Compilación de `ReciminsaApp.csproj` para `net10.0-android` (0 advertencias, 0 errores).
     - Instalación del paquete firmado ([com.companyname.reciminsaapp-Signed.apk](file:///home/keylet/Documentos/Proyectos/ecorecicla/ReciminsaApp/bin/Debug/net10.0-android/com.companyname.reciminsaapp-Signed.apk)) en el dispositivo `LZ0A56DOYE1000862` mediante `adb install -r`.
     - Lanzamiento automático de la aplicación en el móvil.

5. **Optimización de Rendimiento del PC:**
   - *Problema:* El equipo del usuario experimentaba lentitud severa y saturación de CPU/RAM.
   - *Diagnóstico:*
     - Dos procesos de `scrcpy` ejecutándose en paralelo consumiendo más del **235% de CPU** combinados.
     - Procesos inactivos de Gradle Daemons (`PID 5095` y `5914`) consumiendo más de 13 GB de memoria virtual y saturando swap.
   - *Solución:*
     - Eliminación de procesos duplicados y huérfanos.
     - Ajuste de prioridad (*renice*) del proceso activo de `scrcpy`.
     - Cierre forzado de demonios de Gradle inactivos.
     - Liberación de memoria física, reduciendo la carga promedio del procesador de 18.0 a 11.5.

---

## 📂 2. Archivos Modificados

| Archivo | Descripción del Cambio |
| :--- | :--- |
| [`index.html`](file:///home/keylet/Documentos/Proyectos/ecorecicla/index.html) | Inyección de estilos críticos de autenticación, fuente Outfit, reordenamiento de hojas de estilo con `v=201`, y marcado limpio de formulario. |
| [`css/auth.css`](file:///home/keylet/Documentos/Proyectos/ecorecicla/css/auth.css) | Rediseño completo de la interfaz de autenticación: glassmorphism, orbes ambientales, botones, pestañas e inputs. |
| [`js/i18n.js`](file:///home/keylet/Documentos/Proyectos/ecorecicla/js/i18n.js) | Eliminación de USD, moneda única DOP (`RD$`), y simplificación de conversores. |
| [`js/settings.js`](file:///home/keylet/Documentos/Proyectos/ecorecicla/js/settings.js) | Retiro de selectores de divisa y tasa de cambio; panel informativo de moneda nacional dominicana. |
| [`js/history.js`](file:///home/keylet/Documentos/Proyectos/ecorecicla/js/history.js) | Adaptación responsive de gráficos de trading, scroll horizontal, KPIs de resumen y formateador compacto (`formatTradingVal`). |
| [`js/pdf-utils.js`](file:///home/keylet/Documentos/Proyectos/ecorecicla/js/pdf-utils.js) | Fijado de moneda en `PESOS` y `DOP` en conversión a letras para facturación. |
| [`ReciminsaApp/wwwroot/`](file:///home/keylet/Documentos/Proyectos/ecorecicla/ReciminsaApp/wwwroot/) | Sincronización completa de los archivos web compilados para la app .NET MAUI. |

---

## 💡 3. Comandos Útiles de Mantenimiento

- **Compilar y sincronizar activos web:**
  ```bash
  node build.js
  ```

- **Compilar aplicación para Android:**
  ```bash
  dotnet build ReciminsaApp/ReciminsaApp.csproj -f net10.0-android
  ```

- **Instalar en celular conectado:**
  ```bash
  adb install -r ReciminsaApp/bin/Debug/net10.0-android/com.companyname.reciminsaapp-Signed.apk
  ```

- **Ejecutar `scrcpy` optimizado (bajo consumo de CPU y RAM):**
  ```bash
  scrcpy -m 1024 --max-fps 30
  ```
