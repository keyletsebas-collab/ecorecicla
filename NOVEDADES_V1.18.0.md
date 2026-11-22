# 📱 Novedades ReciminsaApp — v1.18.0 (Build 12) + Mapa de Notificaciones

> [!TIP]
> **Guía de Lectura Rápida para Celular**
> Este documento contiene:
> 1. **🔥 Últimos Cambios: v1.18.0 (Build 12 - 21 Nov 2026)**
> 2. **🚀 Novedades Generales de la Versión v1.18.0 (Fases 1 a 3)**
> 3. **🔔 Todos los Archivos de Notificaciones (Fuera de la App / Reales y Dentro de la App)**

---

## 🔥 1. Última Actualización: v1.18.0 (Build 12)

### 📲 A. Botones Rápidos en el Centro de Control del Celular (Junto a Bluetooth, Wi-Fi y Linterna)
- **2 Botones Nativos (`TileService`) en el Centro de Control de Android**: Aparecen directamente en el panel desplegable del celular (donde están el Bluetooth, Internet/Wi-Fi, Linterna y Brillo):
  - **🚛 Bitácora Recogida** (`BitacoraControlTileService` con icono vectorial `@drawable/ic_qs_bitacora`): Al tocarlo en tu Centro de Control, cierra la cortina del sistema y abre la mini-ventana de Bitácora para registrar una recogida en segundos y guardarla en Supabase.
  - **🧾 Nueva Factura** (`FacturaControlTileService` con icono vectorial `@drawable/ic_qs_factura`): Al tocarlo en tu Centro de Control, abre directo el facturador rápido con validación fiscal DGII y guardado en Supabase.
- **Cómo activarlos en tu celular**:
  1. Desde la app: Toca **`📲 + Botón Bitácora en Centro de Control`** o **`📲 + Botón Factura en Centro de Control`** (en Android 13+ aparece el aviso nativo para agregarlos con 1 toque).
  2. Desde tu celular: Desliza hacia abajo tu **Centro de Control** (donde están Bluetooth, Wi-Fi y Linterna), toca el botón **Editar (✏️)** y arrastra **"Bitácora Recogida"** y **"Nueva Factura"** a tus botones activos.
- **Archivos**: [`ControlCenterTools.cs`](file:///home/antigravity/keyletsebas-collab/ecorecicla/ReciminsaApp/Platforms/Android/ControlCenterTools.cs), [`AndroidManifest.xml`](file:///home/antigravity/keyletsebas-collab/ecorecicla/ReciminsaApp/Platforms/Android/AndroidManifest.xml), [`ic_qs_bitacora.xml`](file:///home/antigravity/keyletsebas-collab/ecorecicla/ReciminsaApp/Platforms/Android/Resources/drawable/ic_qs_bitacora.xml), [`ic_qs_factura.xml`](file:///home/antigravity/keyletsebas-collab/ecorecicla/ReciminsaApp/Platforms/Android/Resources/drawable/ic_qs_factura.xml), [`quick-control-tools.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/quick-control-tools.js).

### 🗑️ B. Eliminación Real en Supabase (Sin "Resurrección" de Datos)
- **Borrado físico (`DELETE`) en la nube**: Al eliminar una factura, bitácora, cotización o cliente, ahora se borra físicamente de las tablas de Supabase ([`syncDeleteEntityFromSupabase`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/sync.js#L1525-L1620)).
- **Sistema de *Tombstones* (`recim_deleted_tombstones`)**: Evita que un registro eliminado en el celular vuelva a aparecer cuando otro dispositivo o PC sincroniza.
- **Conexión con DGII 608**: Si eliminas o anulas una factura con NCF, queda registrada automáticamente para el reporte **Formato 608** de comprobantes anulados.
- **Archivo**: [`sync.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/sync.js).

### 📄 C. Nuevo Orden Visual en PDFs (Tickets 80mm y Facturas A4)
Todos los comprobantes en PDF ahora respetan estrictamente este orden jerárquico:
1. **Logo de la empresa arriba** (centrado y escalado proporcionalmente).
2. **Nombre de la empresa + Sucursal + Ubicación de la sucursal** debajo del logo.
3. **Datos del cliente** (Nombre, RNC/Cédula, NCF, fecha y tipo).
4. **Datos del consumo** (Tabla detallada de materiales/artículos, pesos, precios e ITBIS/Totales).
5. **Logo de la empresa al final** junto al pie de página corporativo.
- **Archivo**: [`pdf-utils.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/pdf-utils.js).

### 🏢 D. Filtros por Sucursal y Nuevas Ventanas de Detalle
- **Clientes por Sucursal ([`clients.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/clients.js))**:
  - Selector para asignar a qué sucursal pertenece cada cliente al crearlo o editarlo.
  - Filtro superior para ver clientes de una sucursal específica o de todas.
  - **Ficha Detallada del Cliente** ([`showClientDetailsModal`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/clients.js#L698-L785)): Muestra ubicación de sucursal, resumen e historial de facturas del cliente.
- **Resumen Global de Sucursales en Historial ([`history.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/history.js))**:
  - Panel comparativo con métricas de todas las sucursales activas y modal detallado por cada sede ([`showBranchDataDetailsModal`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/history.js#L1318-L1430)).
- **Detalles de Bitácoras y Cotizaciones ([`bitacoras.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/bitacoras.js), [`invoices.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/invoices.js))**:
  - Modal de vista detallada para cada Bitácora de Recogida ([`showBitacoraDetailsModal`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/bitacoras.js#L352-L445)) con botón de descarga PDF directo.
  - Cotizaciones con cálculo de totales en vivo ([`calcQuoteLiveTotals`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/invoices.js#L2211-L2265)), selector de modalidad por fila y modal de inspección completa ([`showQuoteDetailsModal`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/invoices.js#L2552-L2635)).

---

## 🚀 2. Todas las Mejoras de la Versión v1.18.0 (Fases 1 a 3)

| Categoría | Qué cambió en la App | Archivos Principales |
| :--- | :--- | :--- |
| **👑 Parametrización CEO y Sucursales** | 3 ventanas en Ajustes: **Empresa**, **Accesos y Dispositivos (Solo CEO)** y **Sucursales** con código único y contraseña por sede. | [`company-settings.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/company-settings.js) |
| **🏛️ Reportes DGII (606, 607 y 608)** | Generación y descarga oficial en `.TXT` y `.XLSX` conectada a tus facturas reales y control estricto de secuencias NCF Serie B. | [`dgii-reports.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/dgii-reports.js), [`dgii-api.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/dgii-api.js) |
| **🗺️ Agenda y Rutas de Recogida** | Programación única o recurrente por sucursal, botón para abrir en **Google Maps / Waze**, aviso por WhatsApp y conversión en 1 toque a Bitácora. | [`routes-agenda.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/routes-agenda.js) |
| **💬 Envío Directo por WhatsApp** | Comparte Facturas, Bitácoras, Cotizaciones y Certificados Ecológicos detectando el teléfono del cliente (`+1 809/829/849`). | [`whatsapp-share.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/whatsapp-share.js) |
| **🔔 Centro de Alertas Inteligentes** | Avisos automáticos de NCF por agotarse o vencer, facturas a crédito vencidas, cotizaciones por expirar y anulaciones. | [`smart-alerts.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/smart-alerts.js) |
| **🛡️ Auditoría Antifraude** | Bitácora inmutable de hasta 500 eventos críticos (borrados, anulaciones, cambios de precios y rutas) por usuario, equipo y sede. | [`audit-log.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/audit-log.js) |
| **🌱 QR Vectorial Offline** | Generador QR ISO/IEC 18004 sin internet para Certificados Ecológicos en PDF con código de verificación antifalsificación. | [`qr-vector.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/qr-vector.js), [`eco-pdf-engine.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/eco-pdf-engine.js) |
| **🔄 Cola Offline y Motor Escalable** | Indicador en vivo (*Sincronizado / Sin red / X pendientes*), respaldo pesado en IndexedDB y subida de logos a Supabase Storage. | [`sync-status.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/sync-status.js), [`storage-engine.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/storage-engine.js) |
| **📥 Descargas Android & UI Móvil** | Guardado nativo con `MediaStore` en carpeta *Descargas*, moneda única **RD$ (DOP)**, login **Glassmorphism** y apertura por defecto en *Historial*. | [`NotificationInterface.cs`](file:///home/antigravity/keyletsebas-collab/ecorecicla/ReciminsaApp/Platforms/Android/NotificationInterface.cs), [`auth.css`](file:///home/antigravity/keyletsebas-collab/ecorecicla/css/auth.css) |

---

## 🔔 3. Mapa Completo de Archivos de Notificaciones

### A. Notificaciones Reales / Fuera de la App (Sistema Operativo Android, Windows y Navegador)

1. **[`ReciminsaApp/Platforms/Android/NotificationInterface.cs`](file:///home/antigravity/keyletsebas-collab/ecorecicla/ReciminsaApp/Platforms/Android/NotificationInterface.cs)**
   - **Rol**: Puente nativo `window.AndroidNative` entre JavaScript y el sistema operativo Android (`Plugin.LocalNotification` y `NotificationManagerCompat`).
   - **Qué hace**:
     - `ShowNotification` / `ShowNotificationOnChannel` (líneas 74–116): Lanza notificaciones reales en la barra de estado de Android con prioridad alta.
     - `ScheduleNotification` / `CancelScheduledNotification` (líneas 120–201): Programa alarmas exactas (`RtcWakeup`) fuera de la app para recordatorios de rutas de recogida.
     - `RequestNotificationPermission` / `AreNotificationsEnabled` (líneas 205–241): Solicita y verifica permisos de notificación del sistema.
     - `Toast.MakeText` nativo de Android (línea 347): Muestra aviso del sistema al guardar archivos en `Descargas`.
     - `RequestAddControlCenterTile` (línea 773): Solicita fijar los botones rápidos en el Centro de Control de Android.

2. **[`ReciminsaApp/Platforms/Android/ControlCenterTools.cs`](file:///home/antigravity/keyletsebas-collab/ecorecicla/ReciminsaApp/Platforms/Android/ControlCenterTools.cs)**
   - **Rol**: Notificación persistente del Centro de Control y `TileService` de Android (`BitacoraControlTileService` y `FacturaControlTileService`).
   - **Qué hace**:
     - `ControlCenterNotificationHelper.ShowControlCenterPanel` (líneas 124–189): Crea el canal `reciminsa_control_center` y mantiene la notificación fija fuera de la app con los botones **"🚛 Bitácora Recogida"** y **"🧾 Nueva Factura"**.
     - `RequestAddQuickTile` (líneas 191–233): Registra los tiles nativos en la barra de estado de Android 13+.

3. **[`ReciminsaApp/MauiProgram.cs`](file:///home/antigravity/keyletsebas-collab/ecorecicla/ReciminsaApp/MauiProgram.cs)**
   - **Rol**: Registro de canales de notificación nativos de Android al arrancar `.NET MAUI` (líneas 19–46):
     - Canal `reciminsa_alerts` (*"Alertas y Notificaciones"* con sonido, vibración y badge).
     - Canal `reciminsa_routes` (*"Agenda y Rutas de Recogida"* con sonido, vibración y badge).

4. **[`ReciminsaApp/Platforms/Android/MainActivity.cs`](file:///home/antigravity/keyletsebas-collab/ecorecicla/ReciminsaApp/Platforms/Android/MainActivity.cs)**
   - **Rol**: Actividad principal de Android (líneas 31–46 y 67–78).
   - **Qué hace**: Pide el permiso `android.permission.POST_NOTIFICATIONS` en Android 13+ (código `1001`) al abrir la app y lanza el panel del Centro de Control en la barra de notificaciones.

5. **[`ReciminsaApp/Platforms/Android/AndroidManifest.xml`](file:///home/antigravity/keyletsebas-collab/ecorecicla/ReciminsaApp/Platforms/Android/AndroidManifest.xml)** y **[`ReciminsaApp/ReciminsaApp.csproj`](file:///home/antigravity/keyletsebas-collab/ecorecicla/ReciminsaApp/ReciminsaApp.csproj)**
   - **Rol**: Declaran los permisos del sistema `POST_NOTIFICATIONS`, `VIBRATE` y `RECEIVE_BOOT_COMPLETED` (líneas 20–22 del Manifest) y la librería `Plugin.LocalNotification` (línea 71 del `.csproj`).

6. **[`ReciminsaApp/MainPage.xaml.cs`](file:///home/antigravity/keyletsebas-collab/ecorecicla/ReciminsaApp/MainPage.xaml.cs)**
   - **Rol**: Enlaza `NotificationInterface` como `window.AndroidNative` en el WebView (línea 103) y en Windows muestra diálogos nativos (`DisplayAlertAsync`) al descargar archivos o detectar actualizaciones (líneas 339, 396–405).

---

### B. Archivos Híbridos (Conectan la App con Notificaciones Reales Fuera de la App)

> [!NOTE]
> Todos los archivos de `js/` tienen su copia sincronizada automáticamente en `ReciminsaApp/wwwroot/js/` mediante `node build.js`.

7. **[`js/smart-alerts.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/smart-alerts.js)** *(y `ReciminsaApp/wwwroot/js/smart-alerts.js`)*
   - **Rol**: Centro de Notificaciones Inteligentes (campana 🔔 de la barra superior + push nativo al celular/navegador).
   - **Qué hace**:
     - Evalúa NCF agotados/por vencer, facturas a crédito vencidas (+15/+30 días), cotizaciones por expirar, rutas pendientes y eventos de auditoría.
     - En `refreshSmartAlerts({ notifyNative: true })` (líneas 465–514) dispara notificaciones reales **fuera de la app** usando `window.AndroidNative.ShowNotificationOnChannel` (en Android) o `new window.Notification(...)` (en PC/Web).

8. **[`js/routes-agenda.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/routes-agenda.js)** *(y `ReciminsaApp/wwwroot/js/routes-agenda.js`)*
   - **Rol**: Programador de recordatorios nativos de recogidas (líneas 105–198 y 283–288).
   - **Qué hace**: Verifica permisos (`AreNotificationsEnabled` / `RequestNotificationPermission`) y programa alarmas nativas en el canal `reciminsa_routes` (`window.AndroidNative.ScheduleNotification` / `CancelScheduledNotification`) para avisar en el celular a las 08:00 AM o 1 hora antes de cada recogida, aunque la app esté cerrada.

9. **[`js/sync.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/sync.js)** *(y `ReciminsaApp/wwwroot/js/sync.js`)*
   - **Rol**: Notificaciones Push en tiempo real desde Supabase (`global:support_notifications`, líneas 2213–2263).
   - **Qué hace**: Escucha nuevos mensajes en la tabla `support_chats` y lanza una notificación fuera de la app vía `window.AndroidNative.ShowNotification`, `Capacitor.Plugins.LocalNotifications.schedule`, o `new Notification(...)` del navegador cuando la ventana está en segundo plano.

10. **[`soporte-it/js/soporte.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/soporte-it/js/soporte.js)** *(y `ReciminsaApp/wwwroot/soporte-it/js/soporte.js`)*
    - **Rol**: Notificaciones del chat de Soporte IT (líneas 70–95 y 798–818).
    - **Qué hace**: Envía notificaciones fuera de la app cuando llega una respuesta de soporte (`Capacitor.Plugins.LocalNotifications` o Web `Notification`) y define su propio sistema `showToast` animado dentro del módulo de soporte.

11. **[`js/quick-control-tools.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/quick-control-tools.js)** *(y `ReciminsaApp/wwwroot/js/quick-control-tools.js`)*
    - **Rol**: Interfaz de las herramientas rápidas invocadas desde la notificación fija del Centro de Control Android (líneas 95–97 y 920–935). Permite solicitar desde la app que se fijen los botones rápidos en la barra de notificaciones de Android (`RequestAddControlCenterTile`).

12. **[`package.json`](file:///home/antigravity/keyletsebas-collab/ecorecicla/package.json)**, **[`android/capacitor.settings.gradle`](file:///home/antigravity/keyletsebas-collab/ecorecicla/android/capacitor.settings.gradle)** y **[`android/app/capacitor.build.gradle`](file:///home/antigravity/keyletsebas-collab/ecorecicla/android/app/capacitor.build.gradle)**
    - **Rol**: Configuran el plugin `@capacitor/local-notifications` (`^8.2.0`) para entornos Capacitor.

---

### C. Notificaciones Internas (Dentro de la App: Toasts, Campana UI y Eventos)

13. **[`js/app.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/app.js)** *(y `ReciminsaApp/wwwroot/js/app.js`)*
    - **Rol**: Define la función global `showToast(message, type)` (líneas 6–49) que muestra los avisos flotantes (`✅`, `❌`, `⚠️`, `ℹ️`) con vibración háptica (`navigator.vibrate`) en el celular, e inicializa `refreshSmartAlerts` y `syncPickupRouteReminders` al iniciar sesión (líneas 256–284).

14. **[`index.html`](file:///home/antigravity/keyletsebas-collab/ecorecicla/index.html)**, **[`css/app.css`](file:///home/antigravity/keyletsebas-collab/ecorecicla/css/app.css)** y **[`css/main.css`](file:///home/antigravity/keyletsebas-collab/ecorecicla/css/main.css)**
    - **Rol**: Contienen el botón de la campana `#topbar-alerts-btn` y contador `#topbar-alerts-badge` en la barra superior (`index.html`), además de los estilos visuales del panel `.smart-alerts-panel` (`css/app.css`) y de las notificaciones flotantes `#toast-container` / `.toast` (`css/main.css`).

15. **Módulos que disparan alertas al Centro de Notificaciones (`recordSmartAlertEvent` / `refreshSmartAlerts`) y Toasts internos**:
    - [`js/invoices.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/invoices.js): Notifica cuando se eliminan o anulan facturas, cotizaciones, notas de crédito/débito y cuando una secuencia NCF está baja o agotada.
    - [`js/history.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/history.js): Registra alertas de supervisión cuando un usuario elimina registros desde el historial.
    - [`js/settings.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/settings.js) y [`js/company-settings.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/company-settings.js): Emiten notificaciones internas al guardar secuencias NCF, sucursales, logos y accesos de dispositivos.
    - [`js/logger-messages.js`](file:///home/antigravity/keyletsebas-collab/ecorecicla/js/logger-messages.js): Registra en consola/bitácora interna todos los mensajes emitidos por `showToast`.
