using System.Text.Json;
using System.Net.Http;

namespace ReciminsaApp;

public partial class MainPage : ContentPage
{
    private const string CurrentVersion = "v1.16.0";
    // Nota: Reemplaza esta URL con la ruta final donde alojes tu version.json (puede ser un Bucket público en Supabase o Github)
    private const string UpdateCheckUrl = "https://raw.githubusercontent.com/keyletsebas-collab/ecorecicla/main/version.json"; 

    public MainPage()
    {
        InitializeComponent();
        blazorWebView.BlazorWebViewInitialized += BlazorWebView_BlazorWebViewInitialized;
        blazorWebView.UrlLoading += (sender, e) =>
        {
            if (e.Url.Host != "0.0.0.0" && e.Url.Host != "localhost")
            {
                e.UrlLoadingStrategy = Microsoft.AspNetCore.Components.WebView.UrlLoadingStrategy.OpenExternally;
            }
        };
    }

    private async void BlazorWebView_BlazorWebViewInitialized(object? sender, Microsoft.AspNetCore.Components.WebView.BlazorWebViewInitializedEventArgs e)
    {
#if ANDROID
        e.WebView.AddJavascriptInterface(new Platforms.Android.NotificationInterface(e.WebView), "AndroidNative");
        try
        {
            e.WebView.ClearCache(true);
            e.WebView.EvaluateJavascript("if ('serviceWorker' in navigator) { navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister())); }", null);
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error clearing Android webview cache: " + ex.Message);
        }
#endif
#if WINDOWS
        e.WebView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;
        e.WebView.CoreWebView2.NavigationStarting += CoreWebView2_NavigationStarting;
        e.WebView.CoreWebView2.Settings.AreDevToolsEnabled = true;
        e.WebView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
        
        try
        {
            await e.WebView.CoreWebView2.Profile.ClearBrowsingDataAsync(Microsoft.Web.WebView2.Core.CoreWebView2BrowsingDataKinds.ServiceWorkers | Microsoft.Web.WebView2.Core.CoreWebView2BrowsingDataKinds.CacheStorage);
            await e.WebView.CoreWebView2.ExecuteScriptAsync("if ('serviceWorker' in navigator) { navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister())); }");
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error limpiando cache: " + ex.Message);
        }
#endif
    }

#if WINDOWS
    private void CoreWebView2_NavigationStarting(object sender, Microsoft.Web.WebView2.Core.CoreWebView2NavigationStartingEventArgs e)
    {
        if (e.Uri != null && e.Uri.StartsWith("blob:"))
        {
            e.Cancel = true;
        }
    }

    private async void CoreWebView2_WebMessageReceived(object sender, Microsoft.Web.WebView2.Core.CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            var json = e.TryGetWebMessageAsString();
            if (!string.IsNullOrEmpty(json))
            {
                var message = JsonSerializer.Deserialize<WebMessage>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                if (message != null)
                {
                    if (message.Action == "download")
                    {
                        string downloadsPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
                        Directory.CreateDirectory(downloadsPath);
                        
                        string safeFileName = message.Filename.Replace("/", "_").Replace("\\", "_");
                        string filePath = Path.Combine(downloadsPath, safeFileName);
                        
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

                        try
                        {
                            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(filePath) { UseShellExecute = true });
                        }
                        catch (Exception)
                        {
                            await Launcher.OpenAsync(new OpenFileRequest
                            {
                                File = new ReadOnlyFile(filePath)
                            });
                        }

                        string finalPath = filePath;
                        MainThread.BeginInvokeOnMainThread(async () =>
                        {
                            await DisplayAlert("Factura Guardada", $"El archivo PDF se ha descargado y guardado en tu carpeta de Descargas:\n\n{finalPath}", "OK");
                        });
                    }
                    else if (message.Action == "save_user_session")
                    {
                        var db = new Services.DatabaseService();
                        await db.SaveUserSessionAsync(new Models.UserSessionRecord
                        {
                            AccountId = message.AccountId,
                            Email = message.Email,
                            Name = message.Name,
                            SessionJson = message.Data,
                            BiometricEnabled = true,
                            LastLoginAt = DateTime.UtcNow
                        });
                    }
                    else if (message.Action == "get_user_session")
                    {
                        var db = new Services.DatabaseService();
                        var session = await db.GetLatestUserSessionAsync();
                        string sessionJson = session?.SessionJson ?? "";
                        string script = $"if (typeof window.onSQLiteSessionLoaded === 'function') {{ window.onSQLiteSessionLoaded({JsonSerializer.Serialize(sessionJson)}); }}";
                        await blazorWebView.WebView.CoreWebView2.ExecuteScriptAsync(script);
                    }
                    else if (message.Action == "delete_user_session")
                    {
                        var db = new Services.DatabaseService();
                        await db.DeleteUserSessionAsync(message.AccountId);
                    }
                    else if (message.Action == "authenticate_biometric")
                    {
                        bool success = false;
                        string errorMsg = "";
                        try
                        {
                            var ucvResult = await Windows.Security.Credentials.UI.UserConsentVerifier.RequestVerificationAsync("Confirmar Inicio de Sesión en Reciminsa App");
                            if (ucvResult == Windows.Security.Credentials.UI.UserConsentVerificationResult.Verified)
                            {
                                success = true;
                            }
                            else
                            {
                                errorMsg = "Autenticación de Windows Hello cancelada o no verificada.";
                            }
                        }
                        catch (Exception ex)
                        {
                            errorMsg = ex.Message;
                        }

                        string script = $"if (typeof window.onBiometricAuthResult === 'function') {{ window.onBiometricAuthResult({(success ? "true" : "false")}, '{errorMsg.Replace("'", "\\'")}'); }}";
                        await blazorWebView.WebView.CoreWebView2.ExecuteScriptAsync(script);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error en WebMessageReceived: " + ex.Message);
        }
    }
#endif

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
            
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var updateInfo = JsonSerializer.Deserialize<UpdateInfo>(response, options);
            
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
        catch (Exception)
        {
            // Si no hay internet, simplemente fallará de forma silenciosa para que la app offline no se detenga.
        }
    }

    private bool IsNewerVersion(string remoteVersion, string localVersion)
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
    public string AccountId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}
