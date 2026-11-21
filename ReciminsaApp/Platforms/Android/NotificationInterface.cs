#nullable enable
#if ANDROID
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Android.Webkit;
using Plugin.LocalNotification;
using Microsoft.Maui.ApplicationModel;
using Microsoft.Maui.ApplicationModel.DataTransfer;
using Microsoft.Maui.Dispatching;
using Microsoft.Maui.Media;
using Microsoft.Maui.Storage;

#pragma warning disable CA1822 // Mark members as static

namespace ReciminsaApp.Platforms.Android;

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
        [Java.Interop.Export("GetAndroidId")]
        public string GetAndroidId()
        {
            try
            {
                var context = global::Android.App.Application.Context;
                var androidId = global::Android.Provider.Settings.Secure.GetString(
                    context.ContentResolver,
                    global::Android.Provider.Settings.Secure.AndroidId);
                return androidId ?? string.Empty;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error en GetAndroidId: {ex.Message}");
                return string.Empty;
            }
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
            ShowNotificationOnChannel(title, body, "reciminsa_alerts");
        }

        [JavascriptInterface]
        [Java.Interop.Export("ShowNotificationOnChannel")]
        public void ShowNotificationOnChannel(string title, string body, string channelId)
        {
            try
            {
                string resolvedChannel = string.IsNullOrWhiteSpace(channelId) ? "reciminsa_alerts" : channelId.Trim();
                var request = new NotificationRequest
                {
                    NotificationId = Random.Shared.Next(1000, 199999),
                    Title = string.IsNullOrWhiteSpace(title) ? "Notificación" : title,
                    Description = body ?? string.Empty,
                    Android = new Plugin.LocalNotification.AndroidOption.AndroidOptions
                    {
                        ChannelId = resolvedChannel,
                        Priority = Plugin.LocalNotification.AndroidOption.AndroidPriority.High,
                        AutoCancel = true,
                        LaunchAppWhenTapped = true
                    }
                };

                MainThread.BeginInvokeOnMainThread(async () =>
                {
                    try
                    {
                        await LocalNotificationCenter.Current.Show(request);
                    }
                    catch (Exception showEx)
                    {
                        System.Diagnostics.Debug.WriteLine($"Error mostrando notificación inmediata: {showEx.Message}");
                    }
                });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error en ShowNotificationOnChannel: {ex.Message}");
            }
        }

        [JavascriptInterface]
        [Java.Interop.Export("ScheduleNotification")]
        public void ScheduleNotification(int notificationId, string title, string body, string triggerEpochMsStr, string channelId)
        {
            try
            {
                if (notificationId <= 0 ||
                    !long.TryParse(triggerEpochMsStr, System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture, out long epochMs))
                {
                    return;
                }

                var notifyLocal = DateTimeOffset.FromUnixTimeMilliseconds(epochMs).LocalDateTime;
                if (notifyLocal <= DateTime.Now.AddSeconds(5))
                {
                    return;
                }

                string resolvedChannel = string.IsNullOrWhiteSpace(channelId) ? "reciminsa_routes" : channelId.Trim();
                var request = new NotificationRequest
                {
                    NotificationId = notificationId,
                    Title = string.IsNullOrWhiteSpace(title) ? "Recordatorio Reciminsaap" : title,
                    Description = body ?? string.Empty,
                    Schedule = new NotificationRequestSchedule
                    {
                        NotifyTime = notifyLocal,
                        Android = new Plugin.LocalNotification.AndroidOption.AndroidScheduleOptions
                        {
                            AlarmType = Plugin.LocalNotification.AndroidOption.AndroidAlarmType.RtcWakeup
                        }
                    },
                    Android = new Plugin.LocalNotification.AndroidOption.AndroidOptions
                    {
                        ChannelId = resolvedChannel,
                        Priority = Plugin.LocalNotification.AndroidOption.AndroidPriority.High,
                        AutoCancel = true,
                        LaunchAppWhenTapped = true
                    }
                };

                MainThread.BeginInvokeOnMainThread(async () =>
                {
                    try
                    {
                        LocalNotificationCenter.Current.Cancel(notificationId);
                        await LocalNotificationCenter.Current.Show(request);
                    }
                    catch (Exception schedEx)
                    {
                        System.Diagnostics.Debug.WriteLine($"Error programando notificación {notificationId}: {schedEx.Message}");
                    }
                });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error en ScheduleNotification: {ex.Message}");
            }
        }

        [JavascriptInterface]
        [Java.Interop.Export("CancelScheduledNotification")]
        public void CancelScheduledNotification(int notificationId)
        {
            try
            {
                if (notificationId <= 0) return;
                MainThread.BeginInvokeOnMainThread(() =>
                {
                    try
                    {
                        LocalNotificationCenter.Current.Cancel(notificationId);
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"Error cancelando notificación {notificationId}: {ex.Message}");
                    }
                });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error en CancelScheduledNotification: {ex.Message}");
            }
        }

        [JavascriptInterface]
        [Java.Interop.Export("RequestNotificationPermission")]
        public void RequestNotificationPermission()
        {
            MainThread.BeginInvokeOnMainThread(async () =>
            {
                try
                {
                    if (!await LocalNotificationCenter.Current.AreNotificationsEnabled())
                    {
                        await LocalNotificationCenter.Current.RequestNotificationPermission(new NotificationPermission
                        {
                            AskPermission = true
                        });
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"Error en RequestNotificationPermission: {ex.Message}");
                }
            });
        }

        [JavascriptInterface]
        [Java.Interop.Export("AreNotificationsEnabled")]
        public bool AreNotificationsEnabled()
        {
            try
            {
                return AndroidX.Core.App.NotificationManagerCompat
                    .From(global::Android.App.Application.Context)
                    ?.AreNotificationsEnabled() ?? false;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error en AreNotificationsEnabled: {ex.Message}");
                return false;
            }
        }

        [JavascriptInterface]
        [Java.Interop.Export("DownloadFile")]
        public void DownloadFile(string filename, string base64Data)
        {
            try
            {
                string safeName = System.IO.Path.GetFileName((filename ?? "archivo.pdf").Trim());
                if (string.IsNullOrWhiteSpace(safeName))
                {
                    safeName = "archivo.pdf";
                }
                foreach (char c in System.IO.Path.GetInvalidFileNameChars())
                {
                    safeName = safeName.Replace(c, '_');
                }

                string ext = System.IO.Path.GetExtension(safeName).ToLowerInvariant();
                var allowedExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    ".pdf", ".xlsx", ".xls", ".csv", ".txt", ".json", ".png", ".jpg", ".jpeg"
                };
                if (!allowedExtensions.Contains(ext))
                {
                    System.Diagnostics.Debug.WriteLine($"Extensión bloqueada en DownloadFile: {ext}");
                    return;
                }
                filename = safeName;

                byte[] fileBytes = Convert.FromBase64String(base64Data);

                // 1. Guardar en CacheDirectory para que Launcher / FileProvider puedan abrirlo y compartirlo
                string cachePath = FileSystem.Current.CacheDirectory;
                string cacheFilePath = System.IO.Path.Combine(cachePath, filename);
                System.IO.File.WriteAllBytes(cacheFilePath, fileBytes);

                // 2. Guardar en la carpeta pública de Descargas (Downloads) del dispositivo
                bool savedToPublicDownloads = false;

                if (OperatingSystem.IsAndroidVersionAtLeast(29))
                {
                    try
                    {
                        var context = global::Android.App.Application.Context;
                        var resolver = context.ContentResolver;
                        if (resolver != null)
                        {
                            var contentValues = new global::Android.Content.ContentValues();
                            contentValues.Put(global::Android.Provider.MediaStore.IMediaColumns.DisplayName, filename);
                            contentValues.Put(global::Android.Provider.MediaStore.IMediaColumns.MimeType, GetMimeType(filename));
                            contentValues.Put(global::Android.Provider.MediaStore.IMediaColumns.RelativePath, global::Android.OS.Environment.DirectoryDownloads);

                            var uri = resolver.Insert(global::Android.Provider.MediaStore.Downloads.ExternalContentUri!, contentValues);
                            if (uri != null)
                            {
                                using var outputStream = resolver.OpenOutputStream(uri);
                                if (outputStream != null)
                                {
                                    outputStream.Write(fileBytes, 0, fileBytes.Length);
                                    outputStream.Flush();
                                    savedToPublicDownloads = true;
                                }
                            }
                        }
                    }
                    catch (Exception mediaEx)
                    {
                        Console.WriteLine("Error al guardar con MediaStore Downloads: " + mediaEx.Message);
                    }
                }
                else
                {
                    try
                    {
                        var downloadsDir = global::Android.OS.Environment.GetExternalStoragePublicDirectory(global::Android.OS.Environment.DirectoryDownloads);
                        if (downloadsDir != null)
                        {
                            string downloadsPath = downloadsDir.AbsolutePath;
                            string filePath = System.IO.Path.Combine(downloadsPath, filename);
                            int count = 1;
                            string fileNameOnly = System.IO.Path.GetFileNameWithoutExtension(filename);
                            string extension = System.IO.Path.GetExtension(filename);
                            while (System.IO.File.Exists(filePath))
                            {
                                filePath = System.IO.Path.Combine(downloadsPath, $"{fileNameOnly} ({count}){extension}");
                                count++;
                            }
                            System.IO.File.WriteAllBytes(filePath, fileBytes);
                            savedToPublicDownloads = true;
                        }
                    }
                    catch (Exception legacyEx)
                    {
                        Console.WriteLine("Error guardando en Descargas legacy: " + legacyEx.Message);
                    }
                }

                // 3. Notificar al usuario mediante Toast nativo de Android
                MainThread.BeginInvokeOnMainThread(() =>
                {
                    try
                    {
                        string msg = savedToPublicDownloads
                            ? $"📄 {filename} guardado en Descargas"
                            : $"📄 {filename} guardado";
                        global::Android.Widget.Toast.MakeText(global::Android.App.Application.Context, msg, global::Android.Widget.ToastLength.Long)?.Show();
                    }
                    catch { }
                });

                // 4. Abrir con visor predeterminado (Intent con FileProvider / Launcher) o menú de Compartir
                string finalPath = cacheFilePath;
                string mime = GetMimeType(filename);
                MainThread.BeginInvokeOnMainThread(async () =>
                {
                    bool opened = false;
                    try
                    {
                        var context = global::Android.App.Application.Context;
                        var javaFile = new Java.IO.File(finalPath);
                        var contentUri = AndroidX.Core.Content.FileProvider.GetUriForFile(
                            context,
                            $"{context.PackageName}.fileProvider",
                            javaFile);

                        var intent = new global::Android.Content.Intent(global::Android.Content.Intent.ActionView);
                        intent.SetDataAndType(contentUri, mime);
                        intent.AddFlags(global::Android.Content.ActivityFlags.GrantReadUriPermission);
                        intent.AddFlags(global::Android.Content.ActivityFlags.NewTask);

                        var chooser = global::Android.Content.Intent.CreateChooser(intent, $"Abrir {filename}");
                        if (chooser != null)
                        {
                            chooser.AddFlags(global::Android.Content.ActivityFlags.NewTask);
                            context.StartActivity(chooser);
                            opened = true;
                        }
                    }
                    catch (Exception intentEx)
                    {
                        Console.WriteLine("Intent directo falló: " + intentEx.Message);
                    }

                    if (!opened)
                    {
                        try
                        {
                            opened = await Launcher.Default.OpenAsync(new OpenFileRequest
                            {
                                Title = filename,
                                File = new ReadOnlyFile(finalPath, mime)
                            });
                        }
                        catch (Exception launchEx)
                        {
                            Console.WriteLine("Launcher falló: " + launchEx.Message);
                        }
                    }

                    if (!opened)
                    {
                        try
                        {
                            await Share.Default.RequestAsync(new ShareFileRequest
                            {
                                Title = filename,
                                File = new ShareFile(finalPath, mime)
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

        private static string GetMimeType(string filename)
        {
            string ext = System.IO.Path.GetExtension(filename).ToLowerInvariant();
            return ext switch
            {
                ".pdf" => "application/pdf",
                ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".xls" => "application/vnd.ms-excel",
                ".txt" => "text/plain",
                ".csv" => "text/csv",
                ".json" => "application/json",
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                _ => "application/octet-stream"
            };
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
                if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
                    !(uri.Scheme is "https" or "http" or "mailto" or "tel"))
                {
                    System.Diagnostics.Debug.WriteLine($"URL bloqueada por esquema no permitido: {url}");
                    return;
                }

                MainThread.BeginInvokeOnMainThread(async () => await Launcher.Default.OpenAsync(uri));
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error in OpenUrl: " + ex.Message);
            }
        }

        [JavascriptInterface]
        [Java.Interop.Export("ShareFileToWhatsApp")]
        public void ShareFileToWhatsApp(string filename, string base64Data, string text, string phone)
        {
            try
            {
                string safeName = System.IO.Path.GetFileName((filename ?? "documento.pdf").Trim());
                if (string.IsNullOrWhiteSpace(safeName))
                {
                    safeName = "documento.pdf";
                }
                foreach (char c in System.IO.Path.GetInvalidFileNameChars())
                {
                    safeName = safeName.Replace(c, '_');
                }

                string ext = System.IO.Path.GetExtension(safeName).ToLowerInvariant();
                var allowedExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    ".pdf", ".xlsx", ".xls", ".csv", ".txt", ".json", ".png", ".jpg", ".jpeg"
                };
                if (!allowedExtensions.Contains(ext))
                {
                    System.Diagnostics.Debug.WriteLine($"Extensión bloqueada en ShareFileToWhatsApp: {ext}");
                    return;
                }

                byte[] fileBytes = Convert.FromBase64String(base64Data ?? string.Empty);
                string cacheFilePath = System.IO.Path.Combine(FileSystem.Current.CacheDirectory, safeName);
                System.IO.File.WriteAllBytes(cacheFilePath, fileBytes);

                string mime = GetMimeType(safeName);
                string shareText = text ?? string.Empty;
                var digitsBuilder = new System.Text.StringBuilder();
                if (!string.IsNullOrEmpty(phone))
                {
                    foreach (char ch in phone)
                    {
                        if (char.IsDigit(ch)) digitsBuilder.Append(ch);
                    }
                }
                string digitsPhone = digitsBuilder.ToString();

                MainThread.BeginInvokeOnMainThread(async () =>
                {
                    try
                    {
                        var context = global::Android.App.Application.Context;
                        var javaFile = new Java.IO.File(cacheFilePath);
                        var contentUri = AndroidX.Core.Content.FileProvider.GetUriForFile(
                            context,
                            $"{context.PackageName}.fileProvider",
                            javaFile);

                        if (contentUri != null)
                        {
                            global::Android.Content.Intent BuildShareIntent(string? targetPackage)
                            {
                                var intent = new global::Android.Content.Intent(global::Android.Content.Intent.ActionSend);
                                intent.SetType(mime);
                                intent.PutExtra(global::Android.Content.Intent.ExtraStream, contentUri);
                                intent.PutExtra(global::Android.Content.Intent.ExtraText, shareText);
                                intent.ClipData = global::Android.Content.ClipData.NewRawUri(safeName, contentUri);
                                intent.AddFlags(global::Android.Content.ActivityFlags.GrantReadUriPermission);
                                intent.AddFlags(global::Android.Content.ActivityFlags.NewTask);
                                if (!string.IsNullOrWhiteSpace(targetPackage))
                                {
                                    intent.SetPackage(targetPackage);
                                }
                                if (digitsPhone.Length >= 7)
                                {
                                    intent.PutExtra("jid", $"{digitsPhone}@s.whatsapp.net");
                                }
                                return intent;
                            }

                            foreach (var pkg in new[] { "com.whatsapp", "com.whatsapp.w4b" })
                            {
                                try
                                {
                                    var waIntent = BuildShareIntent(pkg);
                                    context.StartActivity(waIntent);
                                    return;
                                }
                                catch (global::Android.Content.ActivityNotFoundException)
                                {
                                    // Probar siguiente variante o chooser del sistema
                                }
                            }

                            try
                            {
                                var genericIntent = BuildShareIntent(null);
                                var chooser = global::Android.Content.Intent.CreateChooser(genericIntent, $"Compartir {safeName}");
                                if (chooser != null)
                                {
                                    chooser.AddFlags(global::Android.Content.ActivityFlags.NewTask);
                                    context.StartActivity(chooser);
                                    return;
                                }
                            }
                            catch (Exception chooserEx)
                            {
                                Console.WriteLine("Error abriendo selector para compartir PDF: " + chooserEx.Message);
                            }
                        }

                        await Share.Default.RequestAsync(new ShareFileRequest
                        {
                            Title = safeName,
                            File = new ShareFile(cacheFilePath, mime)
                        });
                    }
                    catch (Exception shareEx)
                    {
                        Console.WriteLine("Error compartiendo archivo a WhatsApp: " + shareEx.Message);
                    }
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error general en ShareFileToWhatsApp: " + ex.Message);
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
                        // Android < 9: evitar falsos positivos sin verificacion real de resultado de actividad
                        SendBiometricResultToJS(false, "La autenticación biométrica requiere Android 9 o superior. Inicia sesión con tu contraseña.");
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
                string safeErrJson = JsonSerializer.Serialize(error ?? string.Empty);
                string script = $"if (typeof window.onBiometricAuthResult === 'function') {{ window.onBiometricAuthResult({(success ? "true" : "false")}, {safeErrJson}); }}";

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

        [JavascriptInterface]
        [Java.Interop.Export("ConsumePendingQuickTool")]
        public string ConsumePendingQuickTool()
        {
            var tool = MainActivity.PendingQuickTool ?? string.Empty;
            MainActivity.PendingQuickTool = null;
            return tool;
        }

        [JavascriptInterface]
        [Java.Interop.Export("RequestAddControlCenterTile")]
        public string RequestAddControlCenterTile(string toolType)
        {
            try
            {
                var ctx = global::Android.App.Application.Context;
                return ControlCenterNotificationHelper.RequestAddQuickTile(ctx, toolType ?? "bitacora");
            }
            catch (Exception ex)
            {
                return $"⚠️ No se pudo registrar acceso directo: {ex.Message}";
            }
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
#endif
