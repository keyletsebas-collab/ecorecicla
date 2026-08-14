#nullable enable
using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.JSInterop;

namespace ReciminsaApp.Services;

public static class JsInteropService
{
    private static readonly DatabaseService _dbService = new();

    [JSInvokable]
    public static async Task DownloadFile(string filename, string base64Data)
    {
        try
        {
            byte[] fileBytes = Convert.FromBase64String(base64Data);

            // Generate a safe unique file path in the cache directory
            string cachePath = FileSystem.CacheDirectory;
            string safeFileName = filename.Replace("/", "_").Replace("\\", "_");
            string filePath = Path.Combine(cachePath, safeFileName);

            // Ensure unique name if file exists (just in case)
            int count = 1;
            string fileNameOnly = Path.GetFileNameWithoutExtension(safeFileName);
            string extension = Path.GetExtension(safeFileName);
            while (File.Exists(filePath))
            {
                filePath = Path.Combine(cachePath, $"{fileNameOnly} ({count}){extension}");
                count++;
            }

            await File.WriteAllBytesAsync(filePath, fileBytes);

            // Open in default app
            await Launcher.OpenAsync(new OpenFileRequest
            {
                File = new ReadOnlyFile(filePath)
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error descargando archivo: " + ex.Message);
        }
    }

    [JSInvokable]
    public static async Task<int> SaveOfflineRecord(string tableName, string dataJson)
    {
        var record = new Models.OfflineRecord
        {
            TableName = tableName,
            DataJson = dataJson,
            IsSynced = false,
            CreatedAt = DateTime.UtcNow
        };
        return await _dbService.SaveRecordAsync(record);
    }

    [JSInvokable]
    public static async Task<string> GetUnsyncedRecords()
    {
        var records = await _dbService.GetUnsyncedRecordsAsync();
        return System.Text.Json.JsonSerializer.Serialize(records);
    }

    [JSInvokable]
    public static async Task MarkAsSynced(int id)
    {
        var record = await _dbService.GetRecordAsync(id);
        if (record != null)
        {
            record.IsSynced = true;
            await _dbService.SaveRecordAsync(record);
        }
    }
}
