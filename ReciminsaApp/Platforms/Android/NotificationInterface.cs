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
                string downloadsPath = global::Android.OS.Environment.GetExternalStoragePublicDirectory(global::Android.OS.Environment.DirectoryDownloads).AbsolutePath;
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

                // Use MAUI Launcher to open it
                MainThread.BeginInvokeOnMainThread(async () =>
                {
                    await Launcher.OpenAsync(new OpenFileRequest
                    {
                        File = new ReadOnlyFile(filePath)
                    });
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error downloading file: " + ex.Message);
            }
        }
    }
}
#endif
