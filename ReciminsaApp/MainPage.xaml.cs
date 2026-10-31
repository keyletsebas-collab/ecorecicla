#nullable enable
using System.Text.Json;

namespace ReciminsaApp;

public partial class MainPage : ContentPage
{
    private const string CurrentVersion = "v1.18.0";
    // Nota: Reemplaza esta URL con la ruta final donde alojes tu version.json (puede ser un Bucket público en Supabase o Github)
    private const string UpdateCheckUrl = "https://raw.githubusercontent.com/keyletsebas-collab/ecorecicla/main/version.json";
    // Host local desde el que HybridWebView sirve wwwroot (https://0.0.0.1/). Es el mismo origen que usaba
    // BlazorWebView, así que localStorage/IndexedDB (sesión, datos offline) se conservan tras la migración.
    private const string AppHost = "0.0.0.1";
    private static readonly JsonSerializerOptions CachedJsonOptions = new() { PropertyNameCaseInsensitive = true };

    public MainPage()
    {
        InitializeComponent();
    }

    // =============================================
    // INICIALIZACIÓN DEL WEBVIEW NATIVO
    // =============================================

    private void OnWebViewInitialized(object? sender, WebViewInitializedEventArgs e)
    {
#if WINDOWS
        if (hybridWebView.Handler?.PlatformView is Microsoft.UI.Xaml.Controls.WebView2 { CoreWebView2: { } core })
        {
            ConfigureWindowsWebView(core);
        }
#elif ANDROID
        if (hybridWebView.Handler?.PlatformView is global::Android.Webkit.WebView androidView)
        {
            ConfigureAndroidWebView(androidView);
        }
#endif
    }

#if ANDROID
    private static void ConfigureAndroidWebView(global::Android.Webkit.WebView webView)
    {
        // Habilitar Viewport móvil nativo respetando el viewport de la web
        webView.Settings.JavaScriptEnabled = true;
        webView.Settings.DomStorageEnabled = true;
        webView.Settings.DatabaseEnabled = true;
        webView.Settings.UseWideViewPort = true;
        webView.Settings.LoadWithOverviewMode = false;
        webView.Settings.SetSupportZoom(false);
        webView.Settings.BuiltInZoomControls = false;
        webView.Settings.DisplayZoomControls = false;

        // Eliminar márgenes de scroll nativo
        webView.SetPadding(0, 0, 0, 0);

        // Deshabilitar el prompt nativo de Google Autofill en WebView (que muestra https://0.0.0.1)
        if (OperatingSystem.IsAndroidVersionAtLeast(26))
        {
            webView.ImportantForAutofill = global::Android.Views.ImportantForAutofill.NoExcludeDescendants;
        }

        // Habilitar depuración de DevTools para inspección si fuera necesario
        global::Android.Webkit.WebView.SetWebContentsDebuggingEnabled(true);

        // Puente window.AndroidNative usado por pdf-utils.js, excel-utils.js, biometric-auth.js, etc.
        // Se pasa el WebView para que la biometría pueda devolver el resultado a JS (onBiometricAuthResult).
        webView.AddJavascriptInterface(new Platforms.Android.NotificationInterface(webView), "AndroidNative");

        try
        {
            webView.ClearCache(true);
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error clearing Android webview cache: " + ex.Message);
        }

        // AddJavascriptInterface solo aplica a partir de la siguiente carga de página:
        // si el contenido ya empezó a cargarse, se recarga para que window.AndroidNative exista.
        if (!string.IsNullOrEmpty(webView.Url) && webView.Url != "about:blank")
        {
            webView.Reload();
        }
    }
#endif

#if WINDOWS
    private static async void ConfigureWindowsWebView(Microsoft.Web.WebView2.Core.CoreWebView2 core)
    {
        core.Settings.AreDevToolsEnabled = true;
        core.Settings.AreDefaultContextMenusEnabled = true;
        core.NavigationStarting += CoreWebView2_NavigationStarting;
        core.NewWindowRequested += CoreWebView2_NewWindowRequested;

        try
        {
            // Forzar limpieza de Service Workers y Cache que puedan estar causando que se vea la versión antigua
            await core.Profile.ClearBrowsingDataAsync(Microsoft.Web.WebView2.Core.CoreWebView2BrowsingDataKinds.ServiceWorkers | Microsoft.Web.WebView2.Core.CoreWebView2BrowsingDataKinds.CacheStorage);
            await core.ExecuteScriptAsync("if ('serviceWorker' in navigator) { navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister())); }");
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error limpiando cache: " + ex.Message);
        }
    }

    private static void CoreWebView2_NavigationStarting(Microsoft.Web.WebView2.Core.CoreWebView2 sender, Microsoft.Web.WebView2.Core.CoreWebView2NavigationStartingEventArgs e)
    {
        // Si intenta navegar a un blob: (por ejemplo al darle click a un PDF mal generado), lo bloqueamos para evitar la pantalla blanca
        if (e.Uri?.StartsWith("blob:") == true)
        {
            e.Cancel = true;
            return;
        }

        // Enlaces a sitios externos se abren en el navegador del sistema (antes lo hacía BlazorWebView.UrlLoading)
        if (TryGetExternalUri(e.Uri, out var externalUri))
        {
            e.Cancel = true;
            OpenExternally(externalUri);
        }
    }

    private static void CoreWebView2_NewWindowRequested(Microsoft.Web.WebView2.Core.CoreWebView2 sender, Microsoft.Web.WebView2.Core.CoreWebView2NewWindowRequestedEventArgs e)
    {
        // window.open / target="_blank" hacia sitios externos → navegador del sistema
        if (TryGetExternalUri(e.Uri, out var externalUri))
        {
            e.Handled = true;
            OpenExternally(externalUri);
        }
    }
#endif

    private static bool TryGetExternalUri(string? url, [System.Diagnostics.CodeAnalysis.NotNullWhen(true)] out Uri? uri)
    {
        uri = null;
        if (Uri.TryCreate(url, UriKind.Absolute, out var parsed) &&
            (parsed.Scheme is "http" or "https" or "mailto" or "tel") &&
            !string.Equals(parsed.Host, AppHost, StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(parsed.Host, "localhost", StringComparison.OrdinalIgnoreCase))
        {
            uri = parsed;
            return true;
        }

        return false;
    }

    private static void OpenExternally(Uri uri)
    {
        MainThread.BeginInvokeOnMainThread(async () =>
        {
            try
            {
                await Launcher.Default.OpenAsync(uri);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"No se pudo abrir {uri}: {ex.Message}");
            }
        });
    }

    // =============================================
    // MENSAJES JS → .NET (window.HybridWebView.SendRawMessage vía js/native-bridge.js)
    // =============================================

    private async void OnRawMessageReceived(object? sender, HybridWebViewRawMessageReceivedEventArgs e)
    {
        try
        {
            if (string.IsNullOrEmpty(e.Message))
            {
                return;
            }

            var message = JsonSerializer.Deserialize<WebMessage>(e.Message, CachedJsonOptions);
            switch (message?.Action)
            {
                case "download":
                    await SaveDownloadAsync(message);
                    break;
                default:
                    // save_user_session, get_user_session, authenticate_biometric... aún no tienen
                    // implementación nativa en Windows; el JS usa su fallback (IndexedDB/localStorage).
                    System.Diagnostics.Debug.WriteLine($"Mensaje JS sin manejar: {message?.Action}");
                    break;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error procesando mensaje de JS: " + ex.Message);
        }
    }

    private async Task SaveDownloadAsync(WebMessage message)
    {
        try
        {
#if WINDOWS
            string downloadsPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
#else
            string downloadsPath = FileSystem.Current.CacheDirectory;
#endif
            Directory.CreateDirectory(downloadsPath); // Asegurar que la carpeta Descargas exista

            string safeFileName = message.Filename.Replace("/", "_").Replace("\\", "_");
            string filePath = Path.Combine(downloadsPath, safeFileName);

            // Asegurar nombre único
            int count = 1;
            string fileNameOnly = Path.GetFileNameWithoutExtension(safeFileName);
            string extension = Path.GetExtension(safeFileName);
            while (File.Exists(filePath))
            {
                filePath = Path.Combine(downloadsPath, $"{fileNameOnly} ({count}){extension}");
                count++;
            }

            byte[] fileBytes = Convert.FromBase64String(message.Data);
            await File.WriteAllBytesAsync(filePath, fileBytes);

            // Intentar abrir con el programa por defecto del sistema
            try
            {
#if WINDOWS
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(filePath) { UseShellExecute = true });
#else
                throw new PlatformNotSupportedException();
#endif
            }
            catch (Exception)
            {
                // Fallback a Launcher.OpenAsync de MAUI
                await Launcher.OpenAsync(new OpenFileRequest
                {
                    File = new ReadOnlyFile(filePath)
                });
            }

            // Mostrar confirmación visual en pantalla al usuario
            string finalPath = filePath;
            MainThread.BeginInvokeOnMainThread(async () =>
                await DisplayAlertAsync("Archivo Guardado", $"El archivo se ha descargado y guardado en tu carpeta de Descargas:\n\n{finalPath}", "OK"));
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error descargando archivo: " + ex.Message);
        }
    }

    // =============================================
    // ACTUALIZACIONES
    // =============================================

    protected override void OnAppearing()
    {
        base.OnAppearing();
        CheckForUpdatesAsync();
    }

    private async void CheckForUpdatesAsync()
    {
        try
        {
            using var client = new HttpClient();
            // Cache bypass using ticks timestamp query parameter
            var response = await client.GetStringAsync(UpdateCheckUrl + "?t=" + DateTime.UtcNow.Ticks);

            var updateInfo = JsonSerializer.Deserialize<UpdateInfo>(response, CachedJsonOptions);

            if (updateInfo != null && IsNewerVersion(updateInfo.Version, CurrentVersion))
            {
                bool answer = await DisplayAlertAsync(
                    "¡Actualización Disponible!",
                    $"Hay una nueva versión de Reciminsa App ({updateInfo.Version}). ¿Deseas descargarla e instalarla ahora?",
                    "Descargar e Instalar", "Más tarde");

                if (answer)
                {
                    // Redirect to the landing page package download panel, passing the currently installed version
                    await Launcher.OpenAsync($"https://landing-de-reciminsa.vercel.app/index.html?dev=true&installed={CurrentVersion}");
                }
            }
        }
        catch (Exception ex)
        {
            // Si no hay internet, simplemente fallará de forma silenciosa para que la app offline no se detenga.
            System.Diagnostics.Debug.WriteLine($"CheckForUpdatesAsync failed: {ex.Message}");
        }
    }

    private static bool IsNewerVersion(string remoteVersion, string localVersion)
    {
        if (string.IsNullOrEmpty(remoteVersion) || string.IsNullOrEmpty(localVersion)) return false;

        remoteVersion = remoteVersion.Replace("v", "").Trim();
        localVersion = localVersion.Replace("v", "").Trim();

        // Try parsing using built-in System.Version first
        if (Version.TryParse(remoteVersion, out Version? rVer) && Version.TryParse(localVersion, out Version? lVer))
        {
            return rVer > lVer;
        }

        // Fallback split logic
        var remoteParts = remoteVersion.Split('.');
        var localParts = localVersion.Split('.');

        for (int i = 0; i < Math.Min(remoteParts.Length, localParts.Length); i++)
        {
            if (int.TryParse(remoteParts[i], out int rv) && int.TryParse(localParts[i], out int lv))
            {
                if (rv > lv) return true;
                if (rv < lv) return false;
            }
        }
        return false;
    }

    protected override bool OnBackButtonPressed()
    {
#if ANDROID
        if (hybridWebView.Handler?.PlatformView is global::Android.Webkit.WebView androidView)
        {
            var currentUrl = androidView.Url;
            if (!string.IsNullOrEmpty(currentUrl) && currentUrl.Contains("soporte-it"))
            {
                androidView.LoadUrl("https://0.0.0.1/index.html?page=ajustes");
                return true;
            }

            if (androidView.CanGoBack())
            {
                var historyList = androidView.CopyBackForwardList();
                var curIdx = historyList.CurrentIndex;
                if (curIdx > 0)
                {
                    var prevUrl = historyList.GetItemAtIndex(curIdx - 1)?.Url;
                    if (prevUrl != null && (prevUrl.EndsWith("/#") || prevUrl.EndsWith("0.0.0.1/") || prevUrl.EndsWith("0.0.0.1/#")))
                    {
                        androidView.LoadUrl("https://0.0.0.1/index.html");
                        return true;
                    }
                }
                androidView.GoBack();
                return true;
            }
        }
#endif
        return base.OnBackButtonPressed();
    }
}

public class UpdateInfo
{
    public string Version { get; set; } = string.Empty;
    public string DownloadUrl { get; set; } = string.Empty;
}

public class WebMessage
{
    public string Action { get; set; } = string.Empty;
    public string Filename { get; set; } = string.Empty;
    public string Data { get; set; } = string.Empty;
}
