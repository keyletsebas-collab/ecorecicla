#nullable enable
using Android.App;
using Android.Content;
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

    public static string RequestAddQuickTile(Context context, string toolType)
    {
        bool isFactura = string.Equals(toolType, "factura", StringComparison.OrdinalIgnoreCase);
        string label = isFactura ? "Nueva Factura" : "Bitácora Recogida";

        if (OperatingSystem.IsAndroidVersionAtLeast(33))
        {
            MainThread.BeginInvokeOnMainThread(() =>
            {
                try
                {
                    Context activeCtx = Platform.CurrentActivity ?? context;
                    var sbm = activeCtx.GetSystemService(Context.StatusBarService) as StatusBarManager;
                    if (sbm == null) return;

                    string className = isFactura
                        ? "com.companyname.reciminsaapp.FacturaControlTileService"
                        : "com.companyname.reciminsaapp.BitacoraControlTileService";
                    string pkg = activeCtx.PackageName ?? "com.companyname.reciminsaapp";
                    var component = new ComponentName(pkg, className);
                    int iconRes = isFactura ? Resource.Drawable.ic_qs_factura : Resource.Drawable.ic_qs_bitacora;
                    var icon = Icon.CreateWithResource(activeCtx, iconRes);
                    var executor = activeCtx.MainExecutor;

                    if (executor != null)
                    {
                        sbm.RequestAddTileService(
                            component,
                            label,
                            icon,
                            executor,
                            new TileRequestCallback(activeCtx, label));
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error calling RequestAddTileService: {ex.Message}");
                }
            });

            return $"📲 Confirma en el aviso de Android para agregar '{label}' a tu Centro de Control (junto a Wi-Fi, Bluetooth y Linterna).";
        }

        return $"📲 Abre el Centro de Control de tu celular (donde están Wi-Fi, Bluetooth y Linterna), toca Editar (✏️) y arrastra '{label}'.";
    }

    private sealed class TileRequestCallback : Java.Lang.Object, Java.Util.Functions.IConsumer
    {
        private readonly Context _context;
        private readonly string _label;

        public TileRequestCallback(Context context, string label)
        {
            _context = context;
            _label = label;
        }

        public void Accept(Java.Lang.Object? resultObj)
        {
            try
            {
                int code = (resultObj as Java.Lang.Integer)?.IntValue() ?? -1;
                // 2 = TILE_ADDED, 1 = TILE_ALREADY_ADDED
                string? msg = code switch
                {
                    2 => $"✅ '{_label}' agregado al Centro de Control del celular.",
                    1 => $"ℹ️ '{_label}' ya está en tu Centro de Control.",
                    _ => null
                };
                if (!string.IsNullOrEmpty(msg))
                {
                    MainThread.BeginInvokeOnMainThread(() =>
                    {
                        try
                        {
                            Toast.MakeText(_context, msg, ToastLength.Long)?.Show();
                        }
                        catch { }
                    });
                }
            }
            catch { }
        }
    }
}
