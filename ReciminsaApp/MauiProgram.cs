using Microsoft.Extensions.Logging;
#if ANDROID || IOS || MACCATALYST
using Plugin.LocalNotification;
#endif

namespace ReciminsaApp;

public static class MauiProgram
{
	public static MauiApp CreateMauiApp()
	{
		var builder = MauiApp.CreateBuilder();
		builder
			.UseMauiApp<App>()
#if ANDROID || IOS || MACCATALYST
            .UseLocalNotification()
#endif
			.ConfigureFonts(fonts => fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular"));

		builder.Services.AddMauiBlazorWebView();
		builder.Services.AddBlazorWebViewDeveloperTools();

#if DEBUG
		builder.Logging.AddDebug();
#endif

		return builder.Build();
	}
}
