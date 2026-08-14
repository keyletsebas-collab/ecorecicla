using System.IO;
using SQLite;

namespace ReciminsaApp;

public static class Constants
{
    public const string DatabaseFilename = "ReciminsaOffline.db3";

    public const SQLiteOpenFlags Flags =
        SQLiteOpenFlags.ReadWrite |
        SQLiteOpenFlags.Create |
        SQLiteOpenFlags.SharedCache;

    public static string DatabasePath =>
        Path.Combine(FileSystem.AppDataDirectory, DatabaseFilename);
}
