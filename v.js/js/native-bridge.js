/* =============================================
   NATIVE-BRIDGE.JS – Puente JS → .NET MAUI (HybridWebView)
   ---------------------------------------------
   En la app de escritorio/Android (.NET MAUI) la web se sirve desde https://0.0.0.1/
   y los mensajes a C# deben pasar por window.HybridWebView.SendRawMessage (lo inyecta
   _framework/hybridwebview.js, cargado condicionalmente en index.html).
   En la web / PWA / Electron este archivo no hace nada: post() devuelve false.
   ============================================= */

(function () {
  const MAUI_HOSTS = ['0.0.0.1', '0.0.0.0'];

  window.NativeBridge = {
    /** true cuando la página corre dentro del HybridWebView de .NET MAUI */
    isMauiApp: MAUI_HOSTS.includes(window.location.hostname),

    /**
     * Envía un mensaje al código C# (MainPage.OnRawMessageReceived).
     * @param {object|string} message Objeto que se serializa a JSON (ej. { action: 'download', filename, data })
     * @returns {boolean} true si había un host nativo que recibiera el mensaje
     */
    post: function (message) {
      const json = typeof message === 'string' ? message : JSON.stringify(message);

      if (window.HybridWebView && typeof window.HybridWebView.SendRawMessage === 'function') {
        window.HybridWebView.SendRawMessage(json);
        return true;
      }

      // Compatibilidad con hosts WebView2 sin HybridWebView (versiones antiguas de la app)
      if (window.chrome && window.chrome.webview && typeof window.chrome.webview.postMessage === 'function') {
        window.chrome.webview.postMessage(json);
        return true;
      }

      return false;
    }
  };
})();
