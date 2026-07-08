#if ANDROID
using Android.Webkit;
using Plugin.LocalNotification;

namespace ReciminsaApp.Platforms.Android
{
    public class NotificationInterface : Java.Lang.Object
    {
        [JavascriptInterface]
        [Java.Interop.Export("ShowNotification")]
        public void ShowNotification(string title, string body)
        {
            var request = new NotificationRequest
            {
                NotificationId = new Random().Next(1000, 9999),
                Title = title,
                Description = body,
                Schedule = new NotificationRequestSchedule
                {
                    NotifyTime = DateTime.Now.AddSeconds(1)
                }
            };

            LocalNotificationCenter.Current.Show(request);
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
                    // Intentar guardar en Descargas públicas
                    string downloadsPath = global::Android.OS.Environment.GetExternalStoragePublicDirectory(global::Android.OS.Environment.DirectoryDownloads).AbsolutePath;
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
                    // Fallback a la caché privada de la app que no requiere permisos
                    string cachePath = FileSystem.Current.CacheDirectory;
                    filePath = System.IO.Path.Combine(cachePath, filename);
                    System.IO.File.WriteAllBytes(filePath, fileBytes);
                }

                // Usar MAUI Launcher para abrir el archivo
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
    }
}
#endif
