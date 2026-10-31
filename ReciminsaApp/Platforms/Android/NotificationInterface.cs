#nullable enable
#if ANDROID
using System;
using System.IO;
using System.Threading.Tasks;
using Android.Webkit;
using Plugin.LocalNotification;
using Microsoft.Maui.ApplicationModel;
using Microsoft.Maui.ApplicationModel.DataTransfer;
using Microsoft.Maui.Dispatching;
using Microsoft.Maui.Media;
using Microsoft.Maui.Storage;

#pragma warning disable CA1822 // Mark members as static

namespace ReciminsaApp.Platforms.Android
{
    public class NotificationInterface : Java.Lang.Object
    {
        private readonly global::Android.Webkit.WebView? _webView;

        public NotificationInterface()
        {
        }

        public NotificationInterface(global::Android.Webkit.WebView webView)
        {
            _webView = webView;
        }

        [JavascriptInterface]
        [Java.Interop.Export("NavigateHome")]
        public void NavigateHome()
        {
            if (_webView != null)
            {
                MainThread.BeginInvokeOnMainThread(() =>
                {
                    try
                    {
                        _webView.LoadUrl("https://0.0.0.1/index.html?page=ajustes");
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"Error en NavigateHome: {ex.Message}");
                    }
                });
            }
        }

        [JavascriptInterface]
        [Java.Interop.Export("ShowNotification")]
        public void ShowNotification(string title, string body)
        {
            try
            {
                var request = new NotificationRequest
                {
                    NotificationId = Random.Shared.Next(1000, 9999),
                    Title = title ?? "Notificación",
                    Description = body ?? string.Empty,
                    Schedule = new NotificationRequestSchedule
                    {
                        NotifyTime = DateTime.Now.AddSeconds(1)
                    }
                };

                LocalNotificationCenter.Current.Show(request);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error en ShowNotification: {ex.Message}");
            }
        }

        [JavascriptInterface]
        [Java.Interop.Export("DownloadFile")]
        public void DownloadFile(string filename, string base64Data)
        {
            try
            {
                byte[] fileBytes = Convert.FromBase64String(base64Data);
                string filePath = "";

                try
                {
                    var downloadsDir = global::Android.OS.Environment.GetExternalStoragePublicDirectory(global::Android.OS.Environment.DirectoryDownloads)
                        ?? throw new System.IO.DirectoryNotFoundException("Public downloads directory is not available.");
                    string downloadsPath = downloadsDir.AbsolutePath;
                    filePath = System.IO.Path.Combine(downloadsPath, filename);

                    int count = 1;
                    string fileNameOnly = System.IO.Path.GetFileNameWithoutExtension(filename);
                    string extension = System.IO.Path.GetExtension(filename);
                    while (System.IO.File.Exists(filePath))
                    {
                        filePath = System.IO.Path.Combine(downloadsPath, $"{fileNameOnly} ({count}){extension}");
                        count++;
                    }
                    System.IO.File.WriteAllBytes(filePath, fileBytes);
                }
                catch (Exception ex)
                {
                    Console.WriteLine("Error al guardar en Descargas públicas, usando caché de la app: " + ex.Message);
                    string cachePath = FileSystem.Current.CacheDirectory;
                    filePath = System.IO.Path.Combine(cachePath, filename);
                    System.IO.File.WriteAllBytes(filePath, fileBytes);
                }

                string finalPath = filePath;
                MainThread.BeginInvokeOnMainThread(async () =>
                {
                    try
                    {
                        bool opened = await Launcher.Default.OpenAsync(new OpenFileRequest
                        {
                            File = new ReadOnlyFile(finalPath)
                        });

                        if (!opened)
                        {
                            await Share.Default.RequestAsync(new ShareFileRequest
                            {
                                Title = filename,
                                File = new ShareFile(finalPath)
                            });
                        }
                    }
                    catch (Exception launchEx)
                    {
                        Console.WriteLine("Error al abrir archivo con Launcher: " + launchEx.Message);
                        try
                        {
                            await Share.Default.RequestAsync(new ShareFileRequest
                            {
                                Title = filename,
                                File = new ShareFile(finalPath)
                            });
                        }
                        catch (Exception shareEx)
                        {
                            Console.WriteLine("Error al compartir archivo: " + shareEx.Message);
                        }
                    }
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error general en DownloadFile: " + ex.Message);
            }
        }

        [JavascriptInterface]
        [Java.Interop.Export("ShareText")]
        public void ShareText(string text, string title)
        {
            try
            {
                MainThread.BeginInvokeOnMainThread(async () =>
                {
                    await Share.Default.RequestAsync(new ShareTextRequest
                    {
                        Text = text,
                        Title = title
                    });
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error in ShareText: " + ex.Message);
            }
        }

        [JavascriptInterface]
        [Java.Interop.Export("OpenUrl")]
        public void OpenUrl(string url)
        {
            try
            {
                MainThread.BeginInvokeOnMainThread(async () => await Launcher.Default.OpenAsync(new Uri(url)));
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error in OpenUrl: " + ex.Message);
            }
        }

        // =============================================
        // SQLITE SESSION METHODS
        // =============================================

        [JavascriptInterface]
        [Java.Interop.Export("SaveUserSessionSQLite")]
        public void SaveUserSessionSQLite(string accountId, string email, string name, string sessionJson)
        {
            Task.Run(async () =>
            {
                try
                {
                    var db = new Services.DatabaseService();
                    await db.SaveUserSessionAsync(new Models.UserSessionRecord
                    {
                        AccountId = accountId,
                        Email = email,
                        Name = name,
                        SessionJson = sessionJson,
                        BiometricEnabled = true,
                        LastLoginAt = DateTime.UtcNow
                    });
                    Console.WriteLine($"✅ Sesión guardada en SQLite para el usuario {email}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine("❌ Error guardando sesión en SQLite: " + ex.Message);
                }
            });
        }

        [JavascriptInterface]
        [Java.Interop.Export("GetLatestUserSessionSQLite")]
        public string GetLatestUserSessionSQLite()
        {
            try
            {
                var db = new Services.DatabaseService();
                var session = Task.Run(async () => await db.GetLatestUserSessionAsync()).Result;
                return session?.SessionJson ?? "";
            }
            catch (Exception ex)
            {
                Console.WriteLine("❌ Error leyendo sesión de SQLite: " + ex.Message);
                return "";
            }
        }

        [JavascriptInterface]
        [Java.Interop.Export("DeleteUserSessionSQLite")]
        public void DeleteUserSessionSQLite(string accountId)
        {
            Task.Run(async () =>
            {
                try
                {
                    var db = new Services.DatabaseService();
                    await db.DeleteUserSessionAsync(accountId);
                    Console.WriteLine($"🗑️ Sesión eliminada de SQLite para el usuario {accountId}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine("❌ Error eliminando sesión de SQLite: " + ex.Message);
                }
            });
        }

        // =============================================
        // BIOMETRIC AUTHENTICATION METHOD
        // =============================================

        [JavascriptInterface]
        [Java.Interop.Export("AuthenticateBiometric")]
        public void AuthenticateBiometric(string title, string subtitle)
        {
            MainThread.BeginInvokeOnMainThread(() =>
            {
                try
                {
                    var activity = Platform.CurrentActivity;
                    if (activity == null)
                    {
                        SendBiometricResultToJS(false, "No se pudo obtener la actividad actual.");
                        return;
                    }

                    // Android 9 (API 28) y superior: usar BiometricPrompt con todos los métodos
                    if (OperatingSystem.IsAndroidVersionAtLeast(28))
                    {
                        var executor = activity.MainExecutor;
                        if (executor == null)
                        {
                            SendBiometricResultToJS(false, "No se pudo obtener el ejecutor principal de Android.");
                            return;
                        }

                        var callback = new BiometricCallback((success, err) => SendBiometricResultToJS(success, err));

                        var builder = new global::Android.Hardware.Biometrics.BiometricPrompt.Builder(activity)
                            .SetTitle(string.IsNullOrEmpty(title) ? "Confirmar Identidad" : title)
                            .SetSubtitle(string.IsNullOrEmpty(subtitle) ? "Usa huella, rostro, PIN o patrón para continuar" : subtitle);

                        // API 30+ (Android 11): usar SetAllowedAuthenticators para habilitar
                        // TODOS los métodos: huella, rostro, iris, PIN, patrón, contraseña
                        if (OperatingSystem.IsAndroidVersionAtLeast(30))
                        {
                            // BIOMETRIC_WEAK = 0x00FF (huella, rostro, iris)
                            // DEVICE_CREDENTIAL = 0x8000 (PIN, patrón, contraseña)
                            builder.SetAllowedAuthenticators(0x00FF | 0x8000);
                        }
                        else
                        {
                            // API 28-29: usar SetDeviceCredentialAllowed (deprecated en API 30 pero funcional aquí)
                            #pragma warning disable CA1416, CA1422 // Validate platform compatibility
                            builder.SetDeviceCredentialAllowed(true);
                            #pragma warning restore CA1416, CA1422
                        }

                        var prompt = builder.Build();
                        var cancellationSignal = new global::Android.OS.CancellationSignal();
                        prompt.Authenticate(cancellationSignal, executor, callback);
                    }
                    else
                    {
                        // Android 8 y anterior: usar KeyguardManager que soporta PIN/patrón/contraseña
                        var keyguardManager = (global::Android.App.KeyguardManager?)activity.GetSystemService(global::Android.Content.Context.KeyguardService);
                        if (keyguardManager?.IsKeyguardSecure is true)
                        {
                            #pragma warning disable CA1422
                            var intent = keyguardManager.CreateConfirmDeviceCredentialIntent(
                                string.IsNullOrEmpty(title) ? "Confirmar Identidad" : title,
                                string.IsNullOrEmpty(subtitle) ? "Usa tu método de seguridad para continuar" : subtitle
                            );
                            #pragma warning restore CA1422
                            if (intent != null)
                            {
                                activity.StartActivity(intent);
                                SendBiometricResultToJS(true, "");
                            }
                            else
                            {
                                SendBiometricResultToJS(false, "No hay método de seguridad configurado en el dispositivo.");
                            }
                        }
                        else
                        {
                            SendBiometricResultToJS(false, "El dispositivo no tiene bloqueo de pantalla configurado. Configura un PIN, patrón o huella en Ajustes.");
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine("❌ Error en autenticación de seguridad de Android: " + ex.Message);
                    SendBiometricResultToJS(false, ex.Message);
                }
            });
        }

        private void SendBiometricResultToJS(bool success, string error)
        {
            MainThread.BeginInvokeOnMainThread(() =>
            {
                string safeErr = error.Replace("'", "\\'").Replace("\n", " ");
                string script = $"if (typeof window.onBiometricAuthResult === 'function') {{ window.onBiometricAuthResult({(success ? "true" : "false")}, '{safeErr}'); }}";

                if (_webView != null)
                {
                    _webView.EvaluateJavascript(script, null);
                }
                else
                {
                    Console.WriteLine("⚠️ _webView is null in SendBiometricResultToJS");
                }
            });
        }
    }

    [System.Runtime.Versioning.SupportedOSPlatform("android28.0")]
    public class BiometricCallback(Action<bool, string> onResult) : global::Android.Hardware.Biometrics.BiometricPrompt.AuthenticationCallback, global::Android.Content.IDialogInterfaceOnClickListener
    {
        public override void OnAuthenticationSucceeded(global::Android.Hardware.Biometrics.BiometricPrompt.AuthenticationResult? result)
        {
            base.OnAuthenticationSucceeded(result);
            onResult(true, "");
        }

        public override void OnAuthenticationFailed()
        {
            base.OnAuthenticationFailed();
            // No llamamos onResult aquí porque Android permite reintentar automáticamente
            // Solo se reporta en OnAuthenticationError cuando se agotan los intentos
        }

        public override void OnAuthenticationError(global::Android.Hardware.Biometrics.BiometricErrorCode errorCode, Java.Lang.ICharSequence? errString)
        {
            base.OnAuthenticationError(errorCode, errString);
            onResult(false, errString?.ToString() ?? "Error de autenticación biométrica");
        }

        public void OnClick(global::Android.Content.IDialogInterface? dialog, int which)
        {
            onResult(false, "Cancelado por el usuario");
        }
    }
}
#endif
