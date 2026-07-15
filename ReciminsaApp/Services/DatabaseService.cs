using SQLite;
using System.Collections.Generic;
using System.Threading.Tasks;
using ReciminsaApp.Models;

namespace ReciminsaApp.Services;

public class DatabaseService
{
    private SQLiteAsyncConnection? _database;

    public DatabaseService()
    {
    }

    private async Task Init()
    {
        if (_database is not null)
            return;

        _database = new SQLiteAsyncConnection(Constants.DatabasePath, Constants.Flags);
        await _database.CreateTableAsync<OfflineRecord>();
    }

    public async Task<List<OfflineRecord>> GetUnsyncedRecordsAsync()
    {
        await Init();
        return await _database!.Table<OfflineRecord>().Where(t => !t.IsSynced).ToListAsync();
    }

    public async Task<int> SaveRecordAsync(OfflineRecord item)
    {
        await Init();
        if (item.Id != 0)
            return await _database!.UpdateAsync(item);
        else
            return await _database!.InsertAsync(item);
    }

    public async Task<OfflineRecord> GetRecordAsync(int id)
    {
        await Init();
        return await _database!.Table<OfflineRecord>().Where(i => i.Id == id).FirstOrDefaultAsync();
    }
}
