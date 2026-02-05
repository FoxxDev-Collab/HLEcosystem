using HLE.FileServer.Models;
using Microsoft.Extensions.Options;

namespace HLE.FileServer.Services;

public class StorageService : IStorageService
{
    private readonly StorageSettings _settings;
    private readonly string _contentRootPath;
    private readonly ILogger<StorageService> _logger;

    public StorageService(
        IOptions<StorageSettings> settings,
        IWebHostEnvironment environment,
        ILogger<StorageService> logger)
    {
        _settings = settings.Value;
        _contentRootPath = environment.ContentRootPath;
        _logger = logger;
    }

    public string GetUserFilesBasePath()
    {
        return ResolvePath(_settings.UserFilesPath);
    }

    public string GetGroupFilesBasePath()
    {
        return ResolvePath(_settings.GroupFilesPath);
    }

    public string GetUserFilesPath(string userId)
    {
        var basePath = GetUserFilesBasePath();
        var userPath = Path.Combine(basePath, userId);
        EnsureDirectoryExists(userPath);
        return userPath;
    }

    public string GetGroupFilesPath(int groupId)
    {
        var basePath = GetGroupFilesBasePath();
        var groupPath = Path.Combine(basePath, groupId.ToString());
        EnsureDirectoryExists(groupPath);
        return groupPath;
    }

    public StorageStats GetStorageStats(string path)
    {
        var stats = new StorageStats();

        try
        {
            if (!Directory.Exists(path))
            {
                return stats;
            }

            var dirInfo = new DirectoryInfo(path);

            // Get drive info for total/available space
            var driveInfo = new DriveInfo(Path.GetPathRoot(Path.GetFullPath(path)) ?? path);
            stats.TotalBytes = driveInfo.TotalSize;
            stats.AvailableBytes = driveInfo.AvailableFreeSpace;

            // Calculate used space and counts
            var files = dirInfo.GetFiles("*", SearchOption.AllDirectories);
            stats.FileCount = files.Length;
            stats.UsedBytes = files.Sum(f => f.Length);
            stats.DirectoryCount = dirInfo.GetDirectories("*", SearchOption.AllDirectories).Length;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting storage stats for path: {Path}", path);
        }

        return stats;
    }

    private string ResolvePath(string configuredPath)
    {
        if (string.IsNullOrWhiteSpace(configuredPath))
        {
            throw new InvalidOperationException("Storage path cannot be empty");
        }

        // If it's already an absolute path, use it directly
        if (Path.IsPathRooted(configuredPath))
        {
            return configuredPath;
        }

        // Relative path - resolve against content root
        return Path.GetFullPath(Path.Combine(_contentRootPath, configuredPath));
    }

    private void EnsureDirectoryExists(string path)
    {
        if (!Directory.Exists(path))
        {
            _logger.LogInformation("Creating storage directory: {Path}", path);
            Directory.CreateDirectory(path);
        }
    }
}
