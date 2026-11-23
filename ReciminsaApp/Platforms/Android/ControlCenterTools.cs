#nullable enable
using System.Text.Json;
using Android.App;
using Android.Content;
using Android.Content.PM;
using Android.Graphics.Drawables;
using Android.OS;
using Android.Service.QuickSettings;
using Android.Widget;
using AndroidX.Core.App;
using Microsoft.Maui.ApplicationModel;

#pragma warning disable IDE0130 // Namespace does not match folder structure
#pragma warning disable CA1416
#pragma warning disable CA1422
namespace ReciminsaApp.Platforms.Android;

internal static class QuickControlLauncher
{
    public static Intent BuildMainActivityIntent(Context context, string tool)
    {
        var intent = new Intent(context, typeof(MainActivity));
        intent.AddFlags(ActivityFlags.NewTask | ActivityFlags.ClearTop | ActivityFlags.SingleTop);
        intent.PutExtra("quick_tool", tool);
        return intent;
    }

    public static void LaunchFromTile(TileService tileService, string tool, int requestCode)
    {
        void ExecuteLaunch()
        {
            try
            {
                var intent = BuildMainActivityIntent(tileService, tool);
                if (OperatingSystem.IsAndroidVersionAtLeast(34))
                {
                    var flags = PendingIntentFlags.UpdateCurrent | PendingIntentFlags.Immutable;
                    var pendingIntent = PendingIntent.GetActivity(tileService, requestCode, intent, flags);
                    if (pendingIntent != null)
                    {
                        tileService.StartActivityAndCollapse(pendingIntent);
                        return;
                    }
                }
                tileService.StartActivityAndCollapse(intent);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error launching quick tool {tool} from TileService: {ex.Message}");
            }
        }

        try
        {
            if (tileService.IsLocked)
            {
                tileService.UnlockAndRun(new Java.Lang.Runnable(ExecuteLaunch));
            }
            else
            {
                ExecuteLaunch();
            }
        }
        catch
        {
            ExecuteLaunch();
        }
    }
}

[Service(
    Name = "com.companyname.reciminsaapp.BitacoraControlTileService",
    Label = "Bitácora Recogida",
    Icon = "@drawable/ic_qs_bitacora",
    Permission = "android.permission.BIND_QUICK_SETTINGS_TILE",
    Exported = true)]
[IntentFilter(new[] { "android.service.quicksettings.action.QS_TILE" })]
public class BitacoraControlTileService : TileService
{
    public override void OnStartListening()
    {
        base.OnStartListening();
        try
        {
            if (QsTile != null)
            {
                QsTile.Label = "Bitácora Recogida";
                if (OperatingSystem.IsAndroidVersionAtLeast(29))
                {
                    QsTile.Subtitle = "Reciminsa";
                }
                QsTile.Icon = Icon.CreateWithResource(this, Resource.Drawable.ic_qs_bitacora);
                QsTile.State = TileState.Inactive;
                QsTile.UpdateTile();
            }
        }
        catch { }
    }

    public override void OnClick()
    {
        base.OnClick();
        try
        {
            if (QsTile != null)
            {
                QsTile.State = TileState.Active;
                QsTile.UpdateTile();
            }
        }
        catch { }
        QuickControlLauncher.LaunchFromTile(this, "bitacora", 8801);
    }
}

[Service(
    Name = "com.companyname.reciminsaapp.FacturaControlTileService",
    Label = "Nueva Factura",
    Icon = "@drawable/ic_qs_factura",
    Permission = "android.permission.BIND_QUICK_SETTINGS_TILE",
    Exported = true)]
[IntentFilter(new[] { "android.service.quicksettings.action.QS_TILE" })]
public class FacturaControlTileService : TileService
{
    public override void OnStartListening()
    {
        base.OnStartListening();
        try
        {
            if (QsTile != null)
            {
                QsTile.Label = "Nueva Factura";
                if (OperatingSystem.IsAndroidVersionAtLeast(29))
                {
                    QsTile.Subtitle = "Reciminsa";
                }
                QsTile.Icon = Icon.CreateWithResource(this, Resource.Drawable.ic_qs_factura);
                QsTile.State = TileState.Inactive;
                QsTile.UpdateTile();
            }
        }
        catch { }
    }

    public override void OnClick()
    {
        base.OnClick();
        try
        {
            if (QsTile != null)
            {
                QsTile.State = TileState.Active;
                QsTile.UpdateTile();
            }
        }
        catch { }
        QuickControlLauncher.LaunchFromTile(this, "factura", 8802);
    }
}

public static class ControlCenterNotificationHelper
{
    public const string ChannelId = "reciminsa_control_center";
    public const int NotificationId = 8800;

    public static void RemoveLegacyControlCenterNotification(Context context)
    {
        try
        {
            NotificationManagerCompat.From(context).Cancel(NotificationId);
            if (OperatingSystem.IsAndroidVersionAtLeast(26))
            {
                var nm = context.GetSystemService(Context.NotificationService) as NotificationManager;
                nm?.DeleteNotificationChannel(ChannelId);
            }
        }
        catch { }
    }

    private static (ComponentName component, string label, int iconRes, string normalizedTool) GetTileComponent(Context context, string toolType)
    {
        bool isFactura = string.Equals(toolType, "factura", StringComparison.OrdinalIgnoreCase);
        string normalizedTool = isFactura ? "factura" : "bitacora";
        string label = isFactura ? "Nueva Factura" : "Bitácora Recogida";
        string className = isFactura
            ? "com.companyname.reciminsaapp.FacturaControlTileService"
            : "com.companyname.reciminsaapp.BitacoraControlTileService";
        int iconRes = isFactura ? Resource.Drawable.ic_qs_factura : Resource.Drawable.ic_qs_bitacora;
        string pkg = context.PackageName ?? "com.companyname.reciminsaapp";
        return (new ComponentName(pkg, className), label, iconRes, normalizedTool);
    }

    public static string GetControlCenterTilesState(Context context)
    {
        bool bitEnabled = true;
        bool facEnabled = true;
        try
        {
            var pm = context.PackageManager;
            if (pm != null)
            {
                var (bitComp, _, _, _) = GetTileComponent(context, "bitacora");
                var (facComp, _, _, _) = GetTileComponent(context, "factura");
                bitEnabled = pm.GetComponentEnabledSetting(bitComp) != ComponentEnabledState.Disabled;
                facEnabled = pm.GetComponentEnabledSetting(facComp) != ComponentEnabledState.Disabled;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error reading Control Center tiles state: {ex.Message}");
        }

        return JsonSerializer.Serialize(new
        {
            bitacora = bitEnabled,
            factura = facEnabled,
            supportsRequestAdd = OperatingSystem.IsAndroidVersionAtLeast(33),
            apiLevel = (int)Build.VERSION.SdkInt
        });
    }

    public static string SetControlCenterTileEnabled(Context context, string toolType, bool enabled, global::Android.Webkit.WebView? webView = null)
    {
        var (component, label, _, normalizedTool) = GetTileComponent(context, toolType);
        ComponentEnabledState prevState = ComponentEnabledState.Default;

        try
        {
            var pm = context.PackageManager;
            if (pm != null)
            {
                prevState = pm.GetComponentEnabledSetting(component);
                pm.SetComponentEnabledSetting(
                    component,
                    enabled ? ComponentEnabledState.Enabled : ComponentEnabledState.Disabled,
                    ComponentEnableOption.DontKillApp);
            }

            if (enabled && OperatingSystem.IsAndroidVersionAtLeast(24))
            {
                try { TileService.RequestListeningState(context, component); } catch { }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error updating component state for {normalizedTool}: {ex.Message}");
        }

        if (!enabled)
        {
            string disabledMsg = $"⏸️ Botón '{label}' desactivado del Centro de Control de Android.";
            DispatchTileResultToWebView(webView, normalizedTool, -100, disabledMsg);
            return disabledMsg;
        }

        if (OperatingSystem.IsAndroidVersionAtLeast(33))
        {
            int delayMs = prevState == ComponentEnabledState.Disabled ? 350 : 0;
            RequestAddQuickTileInternal(context, normalizedTool, webView, delayMs);
            return $"📲 Confirma en el aviso de Android para agregar '{label}' a tu Centro de Control (junto a Wi-Fi, Bluetooth y Linterna).";
        }

        string legacyMsg = $"✅ '{label}' activado. Desliza el Centro de Control, toca el lápiz ✏️ arriba a la derecha y agrega '{label}'.";
        DispatchTileResultToWebView(webView, normalizedTool, 0, legacyMsg);
        return legacyMsg;
    }

    public static string RequestAddQuickTile(Context context, string toolType, global::Android.Webkit.WebView? webView = null)
    {
        var (component, label, _, normalizedTool) = GetTileComponent(context, toolType);
        ComponentEnabledState prevState = ComponentEnabledState.Default;

        try
        {
            var pm = context.PackageManager;
            if (pm != null)
            {
                prevState = pm.GetComponentEnabledSetting(component);
                if (prevState == ComponentEnabledState.Disabled)
                {
                    pm.SetComponentEnabledSetting(component, ComponentEnabledState.Enabled, ComponentEnableOption.DontKillApp);
                }
            }

            if (OperatingSystem.IsAndroidVersionAtLeast(24))
            {
                try { TileService.RequestListeningState(context, component); } catch { }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error ensuring component enabled for {normalizedTool}: {ex.Message}");
        }

        if (OperatingSystem.IsAndroidVersionAtLeast(33))
        {
            int delayMs = prevState == ComponentEnabledState.Disabled ? 350 : 0;
            RequestAddQuickTileInternal(context, normalizedTool, webView, delayMs);
            return $"📲 Confirma en el aviso de Android para agregar '{label}' a tu Centro de Control (junto a Wi-Fi, Bluetooth y Linterna).";
        }

        string legacyMsg = $"📲 Abre el Centro de Control de tu celular (donde están Wi-Fi, Bluetooth y Linterna), toca Editar (✏️) y arrastra '{label}'.";
        DispatchTileResultToWebView(webView, normalizedTool, 0, legacyMsg);
        return legacyMsg;
    }

    private static void RequestAddQuickTileInternal(Context context, string normalizedTool, global::Android.Webkit.WebView? webView, int delayMs)
    {
        var (component, label, iconRes, tool) = GetTileComponent(context, normalizedTool);

        MainThread.BeginInvokeOnMainThread(async () =>
        {
            try
            {
                if (delayMs > 0)
                {
                    await Task.Delay(delayMs);
                }

                Context activeCtx = Platform.CurrentActivity ?? context;
                var sbm = activeCtx.GetSystemService(Context.StatusBarService) as StatusBarManager;
                if (sbm == null)
                {
                    DispatchTileResultToWebView(webView, tool, -1, $"📲 Botón '{label}' activado. Desliza el Centro de Control y toca el lápiz ✏️ para agregarlo.");
                    return;
                }

                var icon = Icon.CreateWithResource(activeCtx, iconRes);
                var executor = activeCtx.MainExecutor;

                if (executor != null && icon != null)
                {
                    sbm.RequestAddTileService(
                        component,
                        label,
                        icon,
                        executor,
                        new TileRequestCallback(activeCtx, label, tool, webView));
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error calling RequestAddTileService: {ex.Message}");
                DispatchTileResultToWebView(webView, tool, -1, $"📲 Botón '{label}' activado. Si no apareció el aviso, agrégalo desde el lápiz ✏️ del Centro de Control.");
            }
        });
    }

    private static void DispatchTileResultToWebView(global::Android.Webkit.WebView? webView, string normalizedTool, int code, string msg)
    {
        if (webView == null) return;
        MainThread.BeginInvokeOnMainThread(() =>
        {
            try
            {
                string toolJson = JsonSerializer.Serialize(normalizedTool ?? string.Empty);
                string msgJson = JsonSerializer.Serialize(msg ?? string.Empty);
                string script = $"if (typeof window.onAndroidControlCenterTileResult === 'function') {{ window.onAndroidControlCenterTileResult({toolJson}, {code}, {msgJson}); }}";
                webView.EvaluateJavascript(script, null);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error dispatching tile result to WebView: {ex.Message}");
            }
        });
    }

    private sealed class TileRequestCallback : Java.Lang.Object, Java.Util.Functions.IConsumer
    {
        private readonly Context _context;
        private readonly string _label;
        private readonly string _normalizedTool;
        private readonly global::Android.Webkit.WebView? _webView;

        public TileRequestCallback(Context context, string label, string normalizedTool, global::Android.Webkit.WebView? webView)
        {
            _context = context;
            _label = label;
            _normalizedTool = normalizedTool;
            _webView = webView;
        }

        public void Accept(Java.Lang.Object? resultObj)
        {
            try
            {
                int code = (resultObj as Java.Lang.Integer)?.IntValue() ?? -1;
                // 2 = TILE_ADDED, 1 = TILE_ALREADY_ADDED, 0 = TILE_NOT_ADDED
                string msg = code switch
                {
                    2 => $"✅ '{_label}' agregado al Centro de Control del celular.",
                    1 => $"ℹ️ '{_label}' ya está en tu Centro de Control.",
                    0 => $"ℹ️ Cancelado. Puedes agregar '{_label}' tocando el lápiz ✏️ en tu Centro de Control.",
                    _ => $"📲 Botón '{_label}' activado. Si no apareció el aviso automático, desliza el Centro de Control, toca el lápiz ✏️ y agrégalo."
                };

                MainThread.BeginInvokeOnMainThread(() =>
                {
                    try
                    {
                        Toast.MakeText(_context, msg, ToastLength.Long)?.Show();
                    }
                    catch { }
                });

                DispatchTileResultToWebView(_webView, _normalizedTool, code, msg);
            }
            catch { }
        }
    }
}
