using SQLite;
using System;

namespace ReciminsaApp.Models;

public class OfflineRecord
{
    [PrimaryKey, AutoIncrement]
    public int Id { get; set; }
    public string TableName { get; set; } = string.Empty;
    public string DataJson { get; set; } = string.Empty;
    public bool IsSynced { get; set; }
    public DateTime CreatedAt { get; set; }
}
