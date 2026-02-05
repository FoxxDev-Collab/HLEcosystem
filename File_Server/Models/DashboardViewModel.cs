namespace HLE.FileServer.Models;

public class DashboardViewModel
{
    public int TotalFiles { get; set; }
    public long TotalStorageBytes { get; set; }
    public int RecentUploadsCount { get; set; }
    public int UniqueFileTypes { get; set; }

    public List<RecentActivityItem> RecentActivity { get; set; } = new();
    public StorageBreakdown StorageByType { get; set; } = new();

    // User info
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Email { get; set; }
}

public class RecentActivityItem
{
    public int Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public DateTime UploadDate { get; set; }
    public long FileSize { get; set; }
    public bool IsFolder { get; set; }
    public string ContentType { get; set; } = string.Empty;
}

public class StorageBreakdown
{
    public long DocumentsBytes { get; set; }
    public long ImagesBytes { get; set; }
    public long VideosBytes { get; set; }
    public long AudioBytes { get; set; }
    public long OtherBytes { get; set; }

    public int DocumentsCount { get; set; }
    public int ImagesCount { get; set; }
    public int VideosCount { get; set; }
    public int AudioCount { get; set; }
    public int OtherCount { get; set; }
}
