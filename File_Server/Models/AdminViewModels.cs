using HLE.FileServer.Services;

namespace HLE.FileServer.Models;

public class AdminDashboardViewModel
{
    public string UserFilesPath { get; set; } = string.Empty;
    public string GroupFilesPath { get; set; } = string.Empty;
    public StorageStats UserFilesStats { get; set; } = new();
    public StorageStats GroupFilesStats { get; set; } = new();
    public List<UserStorageInfo> UserStorageBreakdown { get; set; } = new();
    public List<GroupStorageInfo> GroupStorageBreakdown { get; set; } = new();
    public int TotalUsers { get; set; }
    public int TotalGroups { get; set; }
}

public class UserStorageInfo
{
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public long TotalBytes { get; set; }
    public int FileCount { get; set; }
}

public class GroupStorageInfo
{
    public int GroupId { get; set; }
    public string GroupName { get; set; } = string.Empty;
    public long TotalBytes { get; set; }
    public long QuotaBytes { get; set; }
    public int FileCount { get; set; }
}
