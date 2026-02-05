namespace HLE.FileServer.Services;

public interface IStorageService
{
    /// <summary>
    /// Gets the base path for user file storage.
    /// </summary>
    string GetUserFilesBasePath();

    /// <summary>
    /// Gets the base path for group file storage.
    /// </summary>
    string GetGroupFilesBasePath();

    /// <summary>
    /// Gets the full path for a specific user's files directory.
    /// Creates the directory if it doesn't exist.
    /// </summary>
    string GetUserFilesPath(string userId);

    /// <summary>
    /// Gets the full path for a specific group's files directory.
    /// Creates the directory if it doesn't exist.
    /// </summary>
    string GetGroupFilesPath(int groupId);

    /// <summary>
    /// Gets storage statistics for a path.
    /// </summary>
    StorageStats GetStorageStats(string path);
}

public class StorageStats
{
    public long TotalBytes { get; set; }
    public long UsedBytes { get; set; }
    public long AvailableBytes { get; set; }
    public int FileCount { get; set; }
    public int DirectoryCount { get; set; }
}
