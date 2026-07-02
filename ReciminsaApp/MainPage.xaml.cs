using System.Text.Json;
using System.Net.Http;

namespace ReciminsaApp;

public partial class MainPage : ContentPage
{
    private const string CurrentVersion = "v1.0.14";
    // Nota: Reemplaza esta URL con la ruta final donde alojes tu version.json (puede ser un Bucket público en Supabase o Github)
    private const string UpdateCheckUrl = "https://raw.githubusercontent.com/keyletsebas-collab/ecorecicla/main/version.json"; 

    public MainPage()
    {
        InitializeComponent();
        blazorWebView.BlazorWebViewInitialized += BlazorWebView_BlazorWebViewInitialized;

#if ANDROID
        Microsoft.AspNetCore.Components.WebView.Maui.BlazorWebViewHandler.BlazorWebViewMapper.AppendToMapping("NotificationInterface", (handler, view) =>
        {
            handler.PlatformView.AddJavascriptInterface(new Platforms.Android.NotificationInterface(), "AndroidNative");
        });
#endif
    }

    private async void BlazorWebView_BlazorWebViewInitialized(object sender, Microsoft.AspNetCore.Components.WebView.BlazorWebViewInitializedEventArgs e)
    {
#if WINDOWS
        e.WebView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;
        e.WebView.CoreWebView2.NavigationStarting += CoreWebView2_NavigationStarting;
        
        try
        {
            // Forzar limpieza de Service Workers y Cache que puedan estar causando que se vea la versión antigua
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
        // Si intenta navegar a un blob: (por ejemplo al darle click a un PDF mal generado), lo bloqueamos para evitar la pantalla blanca
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
                if (message != null && message.Action == "download")
                {
                    string downloadsPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
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
                        System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(filePath) { UseShellExecute = true });
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
                    {
                        await DisplayAlert("Factura Guardada", $"El archivo PDF se ha descargado y guardado en tu carpeta de Descargas:\n\n{finalPath}", "OK");
                    });
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error descargando archivo: " + ex.Message);
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
            var response = await client.GetStringAsync(UpdateCheckUrl);
            
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var updateInfo = JsonSerializer.Deserialize<UpdateInfo>(response, options);
            
            if (updateInfo != null && IsNewerVersion(updateInfo.Version, CurrentVersion))
            {
                bool answer = await DisplayAlert(
                    "¡Actualización Disponible!", 
                    $"Hay una nueva versión de Reciminsa App ({updateInfo.Version}). ¿Deseas descargarla e instalarla ahora?", 
                    "Descargar e Instalar", "Más tarde");
                    
                if (answer)
                {
                    await Launcher.OpenAsync(updateInfo.DownloadUrl);
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
        
        remoteVersion = remoteVersion.Replace("v", "");
        localVersion = localVersion.Replace("v", "");
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
    public string Version { get; set; }
    public string DownloadUrl { get; set; }
}

public class WebMessage
{
    public string Action { get; set; }
    public string Filename { get; set; }
    public string Data { get; set; }
}
