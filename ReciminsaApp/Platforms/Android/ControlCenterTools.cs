#nullable enable
using Android.App;
using Android.Content;
using Android.Graphics.Drawables;
using Android.OS;
using Android.Service.QuickSettings;
using AndroidX.Core.App;

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
}

[Service(
    Name = "com.companyname.reciminsaapp.BitacoraControlTileService",
    Label = "Bitácora Recogida",
    Icon = "@mipmap/appicon",
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
                    QsTile.Subtitle = "ReciminsaApp";
                }
                QsTile.State = TileState.Active;
                QsTile.UpdateTile();
            }
        }
        catch { }
    }

    public override void OnClick()
    {
        base.OnClick();
        QuickControlLauncher.LaunchFromTile(this, "bitacora", 8801);
    }
}

[Service(
    Name = "com.companyname.reciminsaapp.FacturaControlTileService",
    Label = "Nueva Factura",
    Icon = "@mipmap/appicon",
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
                    QsTile.Subtitle = "ReciminsaApp";
                }
                QsTile.State = TileState.Active;
                QsTile.UpdateTile();
            }
        }
        catch { }
    }

    public override void OnClick()
    {
        base.OnClick();
        QuickControlLauncher.LaunchFromTile(this, "factura", 8802);
    }
}

public static class ControlCenterNotificationHelper
{
    public const string ChannelId = "reciminsa_control_center";
    public const int NotificationId = 8800;

    public static void ShowControlCenterPanel(Context context)
    {
        try
        {
            var notificationManager = context.GetSystemService(Context.NotificationService) as NotificationManager;
            if (notificationManager == null) return;

            if (OperatingSystem.IsAndroidVersionAtLeast(26))
            {
                var existing = notificationManager.GetNotificationChannel(ChannelId);
                if (existing == null)
                {
                    var channel = new NotificationChannel(
                        ChannelId,
                        "Herramientas Rápidas ReciminsaApp",
                        NotificationImportance.Low)
                    {
                        Description = "Botones rápidos del Centro de Control para registrar Bitácoras de Recogida y Facturas."
                    };
                    channel.SetShowBadge(false);
                    notificationManager.CreateNotificationChannel(channel);
                }
            }

            if (OperatingSystem.IsAndroidVersionAtLeast(33))
            {
                if (AndroidX.Core.Content.ContextCompat.CheckSelfPermission(
                    context,
                    global::Android.Manifest.Permission.PostNotifications) != global::Android.Content.PM.Permission.Granted)
                {
                    return;
                }
            }

            var piFlags = OperatingSystem.IsAndroidVersionAtLeast(23)
                ? PendingIntentFlags.UpdateCurrent | PendingIntentFlags.Immutable
                : PendingIntentFlags.UpdateCurrent;

            var openAppIntent = new Intent(context, typeof(MainActivity));
            openAppIntent.AddFlags(ActivityFlags.NewTask | ActivityFlags.ClearTop | ActivityFlags.SingleTop);
            var openAppPending = PendingIntent.GetActivity(context, 8800, openAppIntent, piFlags);

            var bitacoraIntent = QuickControlLauncher.BuildMainActivityIntent(context, "bitacora");
            var bitacoraPending = PendingIntent.GetActivity(context, 8801, bitacoraIntent, piFlags);

            var facturaIntent = QuickControlLauncher.BuildMainActivityIntent(context, "factura");
            var facturaPending = PendingIntent.GetActivity(context, 8802, facturaIntent, piFlags);

            var smallIconRes = context.ApplicationInfo?.Icon ?? global::Android.Resource.Drawable.IcMenuEdit;

            var builder = new NotificationCompat.Builder(context, ChannelId)
                .SetSmallIcon(smallIconRes)
                .SetContentTitle("ReciminsaApp • Centro de Control")
                .SetContentText("Accesos rápidos: Bitácora de Recogida y Nueva Factura")
                .SetContentIntent(openAppPending)
                .SetOngoing(true)
                .SetOnlyAlertOnce(true)
                .SetPriority(NotificationCompat.PriorityLow)
                .SetVisibility(NotificationCompat.VisibilityPublic)
                .AddAction(0, "🚛 Bitácora Recogida", bitacoraPending)
                .AddAction(0, "🧾 Nueva Factura", facturaPending);

            NotificationManagerCompat.From(context).Notify(NotificationId, builder.Build());
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error showing control center notification panel: {ex.Message}");
        }
    }

    public static string RequestAddQuickTile(Context context, string toolType)
    {
        ShowControlCenterPanel(context);

        if (OperatingSystem.IsAndroidVersionAtLeast(33))
        {
            try
            {
                var sbm = context.GetSystemService(Context.StatusBarService) as StatusBarManager;
                if (sbm != null)
                {
                    bool isFactura = string.Equals(toolType, "factura", StringComparison.OrdinalIgnoreCase);
                    var className = isFactura
                        ? "com.companyname.reciminsaapp.FacturaControlTileService"
                        : "com.companyname.reciminsaapp.BitacoraControlTileService";
                    var component = new ComponentName(context.PackageName ?? "com.companyname.reciminsaapp", className);
                    var label = isFactura ? "Nueva Factura" : "Bitácora Recogida";
                    var iconRes = context.ApplicationInfo?.Icon ?? global::Android.Resource.Drawable.IcMenuAdd;
                    var icon = Icon.CreateWithResource(context, iconRes);
                    var executor = context.MainExecutor;
                    if (executor != null)
                    {
                        sbm.RequestAddTileService(
                            component,
                            label,
                            icon,
                            executor,
                            new TileRequestCallback());
                        return $"📲 Solicitud enviada para fijar '{label}' al Centro de Control Android.";
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error calling RequestAddTileService: {ex.Message}");
            }
        }

        return "📲 Panel rápido activado en tu barra de notificaciones Android (ReciminsaApp).";
    }

    private sealed class TileRequestCallback : Java.Lang.Object, Java.Util.Functions.IConsumer
    {
        public void Accept(Java.Lang.Object? t)
        {
            // Resultado entregado de forma asíncrona por Android StatusBarManager
        }
    }
}
