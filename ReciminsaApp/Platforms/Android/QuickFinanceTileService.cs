#nullable enable
#if ANDROID
using Android.App;
using Android.Content;
using Android.OS;
using Android.Service.QuickSettings;

namespace ReciminsaApp.Platforms.Android
{
    [Service(
        Name = "com.reciminsa.app.QuickFinanceTileService",
        Label = "Egresos/Ingresos",
        Icon = "@mipmap/appicon",
        Permission = "android.permission.BIND_QUICK_SETTINGS_TILE",
        Exported = true)]
    [IntentFilter(new[] { "android.service.quicksettings.action.QS_TILE" })]
    [System.Runtime.Versioning.SupportedOSPlatform("android24.0")]
    public class QuickFinanceTileService : TileService
    {
        public override void OnStartListening()
        {
            base.OnStartListening();
            if (QsTile != null)
            {
                QsTile.State = TileState.Active;
                QsTile.Label = "Egresos/Ingresos";
                QsTile.UpdateTile();
            }
        }

        public override void OnClick()
        {
            base.OnClick();

            var intent = new Intent(this, typeof(MainActivity));
            intent.AddFlags(ActivityFlags.NewTask | ActivityFlags.ClearTop | ActivityFlags.SingleTop);
            intent.PutExtra("action", "quick_transaction");

            try
            {
                if ((int)Build.VERSION.SdkInt >= 34)
                {
                    var pendingIntent = PendingIntent.GetActivity(
                        this,
                        0,
                        intent,
                        PendingIntentFlags.UpdateCurrent | PendingIntentFlags.Immutable
                    );
                    if (pendingIntent != null)
                    {
                        StartActivityAndCollapse(pendingIntent);
                    }
                }
                else
                {
                    StartActivityAndCollapse(intent);
                }
            }
            catch (System.Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error al abrir desde QuickFinanceTileService: {ex.Message}");
            }
        }
    }
}
#endif
