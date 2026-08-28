using Android.App;
using Android.Content;
using Android.Content.PM;
using Android.OS;

namespace ReciminsaApp;

[Activity(
    Theme = "@style/Maui.SplashTheme",
    MainLauncher = true,
    LaunchMode = LaunchMode.SingleTop,
    ConfigurationChanges = ConfigChanges.ScreenSize | ConfigChanges.Orientation | ConfigChanges.UiMode | ConfigChanges.ScreenLayout | ConfigChanges.SmallestScreenSize | ConfigChanges.Density)]
public class MainActivity : MauiAppCompatActivity
{
    protected override void OnCreate(Bundle? savedInstanceState)
    {
        base.OnCreate(savedInstanceState);
        HandleQuickIntent(Intent);
    }

    protected override void OnNewIntent(Intent? intent)
    {
        base.OnNewIntent(intent);
        HandleQuickIntent(intent);
    }

    private void HandleQuickIntent(Intent? intent)
    {
        if (intent == null) return;
        string? action = intent.GetStringExtra("action");
        if (action == "quick_transaction")
        {
            Platforms.Android.NotificationInterface.TriggerQuickTransactionModal();
        }
    }
}
