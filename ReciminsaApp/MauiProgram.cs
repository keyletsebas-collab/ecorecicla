using Microsoft.Extensions.Logging;
#if ANDROID || IOS || MACCATALYST
using Plugin.LocalNotification;
#endif
#if ANDROID
using Plugin.LocalNotification.AndroidOption;
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
            .UseLocalNotification(config =>
            {
#if ANDROID
                config.AddAndroid(android =>
                {
                    android.AddChannel(new NotificationChannelRequest
                    {
                        Id = "reciminsa_alerts",
                        Name = "Alertas y Notificaciones",
                        Description = "Alertas críticas, NCF, créditos, auditoría y Soporte IT",
                        Importance = AndroidImportance.High,
                        EnableSound = true,
                        EnableVibration = true,
                        ShowBadge = true
                    });
                    android.AddChannel(new NotificationChannelRequest
                    {
                        Id = "reciminsa_routes",
                        Name = "Agenda y Rutas de Recogida",
                        Description = "Recordatorios programados de recogidas",
                        Importance = AndroidImportance.High,
                        EnableSound = true,
                        EnableVibration = true,
                        ShowBadge = true
                    });
                });
#endif
            })
#endif
			.ConfigureFonts(fonts => fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular"));

#if DEBUG
		builder.Services.AddHybridWebViewDeveloperTools();
		builder.Logging.AddDebug();
#endif

		return builder.Build();
	}
}
