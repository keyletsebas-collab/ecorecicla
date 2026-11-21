using Android.App;
using Android.Content.PM;
using Android.OS;
using Android.Views;

#pragma warning disable IDE0130 // Namespace does not match folder structure
#pragma warning disable CA1422 // Obsolete in Android 35
namespace ReciminsaApp;

[Activity(Theme = "@style/Maui.SplashTheme", MainLauncher = true, ConfigurationChanges = ConfigChanges.ScreenSize | ConfigChanges.Orientation | ConfigChanges.UiMode | ConfigChanges.ScreenLayout | ConfigChanges.SmallestScreenSize | ConfigChanges.Density)]
public class MainActivity : MauiAppCompatActivity
{
    protected override void OnCreate(Bundle? savedInstanceState)
    {
        base.OnCreate(savedInstanceState);

#if DEBUG
        try
        {
            global::Android.Webkit.WebView.SetWebContentsDebuggingEnabled(true);
        }
        catch { }
#endif

        try
        {
            if (OperatingSystem.IsAndroidVersionAtLeast(33))
            {
                const string postNotif = global::Android.Manifest.Permission.PostNotifications;
                if (AndroidX.Core.Content.ContextCompat.CheckSelfPermission(this, postNotif) != Permission.Granted)
                {
                    AndroidX.Core.App.ActivityCompat.RequestPermissions(this, new[] { postNotif }, 1001);
                }
            }
        }
        catch { }

        try
        {
            if (Window != null)
            {
                AndroidX.Core.View.WindowCompat.SetDecorFitsSystemWindows(Window, true);
                Window.SetStatusBarColor(global::Android.Graphics.Color.ParseColor("#0a0f0a"));
                Window.SetNavigationBarColor(global::Android.Graphics.Color.ParseColor("#0a0f0a"));
            }
        }
        catch { }
    }
}
