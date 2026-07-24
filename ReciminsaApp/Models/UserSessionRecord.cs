using SQLite;
using System;

namespace ReciminsaApp.Models;

public class UserSessionRecord
{
    [PrimaryKey]
    public string AccountId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string SessionJson { get; set; } = string.Empty;
    public bool BiometricEnabled { get; set; } = true;
    public DateTime LastLoginAt { get; set; } = DateTime.UtcNow;
}
