using System.Security.Cryptography;
using System.Text.RegularExpressions;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

namespace HLE.FamilyFinance.Services;

public class TaxDocumentStorageSettings
{
    public string BasePath { get; set; } = "TaxDocuments";
    public int MaxFileSizeMB { get; set; } = 25;
}

public partial class TaxDocumentStorageService : ITaxDocumentStorageService
{
    private readonly TaxDocumentStorageSettings _settings;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<TaxDocumentStorageService> _logger;

    // Allowed extensions for tax documents
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".doc", ".docx"
    };

    // MIME types mapping
    private static readonly Dictionary<string, string> MimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        { ".pdf", "application/pdf" },
        { ".jpg", "image/jpeg" },
        { ".jpeg", "image/jpeg" },
        { ".png", "image/png" },
        { ".gif", "image/gif" },
        { ".doc", "application/msword" },
        { ".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
    };

    public TaxDocumentStorageService(
        IOptions<TaxDocumentStorageSettings> settings,
        IWebHostEnvironment environment,
        ILogger<TaxDocumentStorageService> logger)
    {
        _settings = settings.Value;
        _environment = environment;
        _logger = logger;
    }

    public async Task<TaxDocumentFileInfo> SaveFileAsync(
        IFormFile file,
        int householdId,
        int year,
        int documentId,
        CancellationToken ct = default)
    {
        ValidateFile(file);

        var basePath = GetBasePath();
        var folderPath = Path.Combine(basePath, householdId.ToString(), year.ToString());

        // Ensure directory exists
        Directory.CreateDirectory(folderPath);

        // Sanitize filename and create storage filename
        var safeFileName = SanitizeFileName(file.FileName);
        var extension = Path.GetExtension(safeFileName).ToLowerInvariant();
        var storageFileName = $"{documentId}_{Guid.NewGuid():N}{extension}";
        var fullPath = Path.Combine(folderPath, storageFileName);

        // Verify the path is within our base directory (path traversal protection)
        var normalizedFullPath = Path.GetFullPath(fullPath);
        var normalizedBasePath = Path.GetFullPath(basePath);
        if (!normalizedFullPath.StartsWith(normalizedBasePath, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Invalid file path detected");
        }

        // Calculate hash and save file
        string contentHash;
        await using (var fileStream = new FileStream(fullPath, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            await file.CopyToAsync(fileStream, ct);
        }

        // Calculate SHA-256 hash
        await using (var readStream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read))
        {
            contentHash = await ComputeHashAsync(readStream, ct);
        }

        // Calculate relative storage path
        var relativePath = Path.GetRelativePath(basePath, fullPath);

        _logger.LogInformation(
            "Saved tax document file: {FileName} for Household {HouseholdId}, Year {Year}, Document {DocumentId}",
            safeFileName, householdId, year, documentId);

        return new TaxDocumentFileInfo(relativePath, contentHash, file.Length);
    }

    public Task DeleteFileAsync(string storagePath, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(storagePath))
            return Task.CompletedTask;

        var basePath = GetBasePath();
        var fullPath = Path.Combine(basePath, storagePath);

        // Verify path is within base directory
        var normalizedFullPath = Path.GetFullPath(fullPath);
        var normalizedBasePath = Path.GetFullPath(basePath);
        if (!normalizedFullPath.StartsWith(normalizedBasePath, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Attempted to delete file outside base path: {Path}", storagePath);
            return Task.CompletedTask;
        }

        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
            _logger.LogInformation("Deleted tax document file: {Path}", storagePath);
        }

        return Task.CompletedTask;
    }

    public Task<TaxDocumentFileResult?> GetFileAsync(string storagePath, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(storagePath))
            return Task.FromResult<TaxDocumentFileResult?>(null);

        var basePath = GetBasePath();
        var fullPath = Path.Combine(basePath, storagePath);

        // Verify path is within base directory
        var normalizedFullPath = Path.GetFullPath(fullPath);
        var normalizedBasePath = Path.GetFullPath(basePath);
        if (!normalizedFullPath.StartsWith(normalizedBasePath, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Attempted to access file outside base path: {Path}", storagePath);
            return Task.FromResult<TaxDocumentFileResult?>(null);
        }

        if (!File.Exists(fullPath))
            return Task.FromResult<TaxDocumentFileResult?>(null);

        var extension = Path.GetExtension(fullPath).ToLowerInvariant();
        var contentType = MimeTypes.GetValueOrDefault(extension, "application/octet-stream");

        // Extract original filename from storage path (format: documentId_guid.ext)
        var fileName = Path.GetFileName(fullPath);

        var fileStream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);

        return Task.FromResult<TaxDocumentFileResult?>(new TaxDocumentFileResult(fileStream, contentType, fileName));
    }

    public void ValidateFile(IFormFile file)
    {
        if (file == null || file.Length == 0)
            throw new ArgumentException("No file provided or file is empty");

        var maxSizeBytes = _settings.MaxFileSizeMB * 1024L * 1024L;
        if (file.Length > maxSizeBytes)
            throw new ArgumentException($"File size exceeds maximum allowed size of {_settings.MaxFileSizeMB}MB");

        var extension = Path.GetExtension(file.FileName)?.ToLowerInvariant();
        if (string.IsNullOrEmpty(extension) || !AllowedExtensions.Contains(extension))
            throw new ArgumentException($"File type '{extension}' is not allowed. Allowed types: {string.Join(", ", AllowedExtensions)}");

        // Check for double extensions (e.g., .pdf.exe)
        var fileName = Path.GetFileNameWithoutExtension(file.FileName);
        var innerExtension = Path.GetExtension(fileName)?.ToLowerInvariant();
        if (!string.IsNullOrEmpty(innerExtension) && !AllowedExtensions.Contains(innerExtension))
            throw new ArgumentException("Suspicious file extension detected");
    }

    private string GetBasePath()
    {
        var basePath = _settings.BasePath;

        // If relative path, make it relative to content root
        if (!Path.IsPathRooted(basePath))
        {
            basePath = Path.Combine(_environment.ContentRootPath, basePath);
        }

        return basePath;
    }

    private static string SanitizeFileName(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
            return "document";

        // Get just the filename without path
        fileName = Path.GetFileName(fileName);

        // Remove invalid characters
        var invalidChars = Path.GetInvalidFileNameChars();
        foreach (var c in invalidChars)
        {
            fileName = fileName.Replace(c, '_');
        }

        // Replace spaces with underscores
        fileName = fileName.Replace(' ', '_');

        // Remove any sequences of underscores
        fileName = MultipleUnderscoreRegex().Replace(fileName, "_");

        // Limit length (keep extension)
        var extension = Path.GetExtension(fileName);
        var nameWithoutExt = Path.GetFileNameWithoutExtension(fileName);
        if (nameWithoutExt.Length > 100)
        {
            nameWithoutExt = nameWithoutExt[..100];
        }

        return nameWithoutExt + extension;
    }

    private static async Task<string> ComputeHashAsync(Stream stream, CancellationToken ct)
    {
        using var sha256 = SHA256.Create();
        var hashBytes = await sha256.ComputeHashAsync(stream, ct);
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }

    [GeneratedRegex(@"_+")]
    private static partial Regex MultipleUnderscoreRegex();
}
