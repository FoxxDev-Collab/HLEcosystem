using HLE.FileServer.Data;
using HLE.FileServer.Extensions;
using HLE.FileServer.Models;
using HLE.FileServer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;

namespace HLE.FileServer.Controllers;

/// <summary>
/// TUS Protocol implementation for resumable file uploads
/// https://tus.io/protocols/resumable-upload
/// </summary>
[Authorize]
[Route("tus")]
public class TusController : Controller
{
    private readonly ApplicationDbContext _context;
    private readonly IStorageService _storageService;
    private readonly ILogger<TusController> _logger;

    // TUS protocol version we support
    private const string TusVersion = "1.0.0";

    // Maximum file size (2 GB)
    private const long MaxFileSize = 2L * 1024 * 1024 * 1024;

    // Upload expiration (24 hours for abandoned uploads)
    private static readonly TimeSpan UploadExpiration = TimeSpan.FromHours(24);

    // Maximum versions to keep per file
    private const int MaxVersions = 10;

    public TusController(
        ApplicationDbContext context,
        IStorageService storageService,
        ILogger<TusController> logger)
    {
        _context = context;
        _storageService = storageService;
        _logger = logger;
    }

    /// <summary>
    /// OPTIONS - Return TUS server capabilities
    /// </summary>
    [HttpOptions]
    [HttpOptions("{uploadId}")]
    public IActionResult Options()
    {
        Response.Headers["Tus-Resumable"] = TusVersion;
        Response.Headers["Tus-Version"] = TusVersion;
        Response.Headers["Tus-Extension"] = "creation,creation-with-upload,termination,checksum";
        Response.Headers["Tus-Max-Size"] = MaxFileSize.ToString();
        Response.Headers["Tus-Checksum-Algorithm"] = "sha256";
        return NoContent();
    }

    /// <summary>
    /// POST - Create a new upload
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateUpload()
    {
        var userId = User.GetUserId();
        if (userId == null) return Unauthorized();

        // Parse Upload-Length header (required)
        if (!Request.Headers.TryGetValue("Upload-Length", out var lengthHeader) ||
            !long.TryParse(lengthHeader, out var totalSize))
        {
            return BadRequest("Upload-Length header is required");
        }

        if (totalSize > MaxFileSize)
        {
            return StatusCode(413, $"File size exceeds maximum of {MaxFileSize / (1024 * 1024 * 1024)} GB");
        }

        // Parse Upload-Metadata header (optional but expected)
        string fileName = $"upload_{DateTime.UtcNow:yyyyMMddHHmmss}";
        string? contentType = null;
        int? targetFolderId = null;

        if (Request.Headers.TryGetValue("Upload-Metadata", out var metadataHeader))
        {
            var metadata = ParseMetadata(metadataHeader.ToString());

            if (metadata.TryGetValue("filename", out var fn))
                fileName = fn;
            if (metadata.TryGetValue("filetype", out var ft))
                contentType = ft;
            if (metadata.TryGetValue("folderId", out var fid) && int.TryParse(fid, out var parsedFolderId))
                targetFolderId = parsedFolderId;
        }

        // Validate target folder belongs to user
        if (targetFolderId.HasValue)
        {
            var folderExists = await _context.FileEntries
                .AnyAsync(f => f.Id == targetFolderId && f.UserId == userId && f.IsFolder && !f.IsDeleted);
            if (!folderExists)
            {
                targetFolderId = null; // Fall back to root
            }
        }

        // Create unique upload ID and temp file path
        var uploadId = Guid.NewGuid().ToString("N");
        var tempDir = Path.Combine(_storageService.GetUserFilesPath(userId), ".tus_temp");
        Directory.CreateDirectory(tempDir);
        var tempFilePath = Path.Combine(tempDir, $"{uploadId}.part");

        // Create empty temp file
        await using (var fs = new FileStream(tempFilePath, FileMode.Create))
        {
            // Pre-allocate if possible for better performance
            if (totalSize > 0)
            {
                fs.SetLength(totalSize);
            }
        }

        var upload = new TusUpload
        {
            UploadId = uploadId,
            FileName = SanitizeFileName(fileName),
            TotalSize = totalSize,
            UploadedBytes = 0,
            TempFilePath = tempFilePath,
            TargetFolderId = targetFolderId,
            ContentType = contentType,
            CreatedAt = DateTime.UtcNow,
            LastActivity = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.Add(UploadExpiration),
            UserId = userId
        };

        _context.TusUploads.Add(upload);
        await _context.SaveChangesAsync();

        // Return upload URL
        var uploadUrl = Url.Action(nameof(PatchUpload), "Tus", new { uploadId }, Request.Scheme);

        Response.Headers["Tus-Resumable"] = TusVersion;
        Response.Headers.Location = uploadUrl;
        Response.Headers["Upload-Offset"] = "0";

        // Handle creation-with-upload (data in POST body)
        if (Request.ContentLength > 0)
        {
            return await HandleChunkUpload(upload);
        }

        return StatusCode(201); // Created
    }

    /// <summary>
    /// HEAD - Get current upload offset
    /// </summary>
    [HttpHead("{uploadId}")]
    public async Task<IActionResult> GetUploadStatus(string uploadId)
    {
        var userId = User.GetUserId();
        var upload = await _context.TusUploads
            .FirstOrDefaultAsync(u => u.UploadId == uploadId && u.UserId == userId);

        if (upload == null)
        {
            return NotFound();
        }

        Response.Headers["Tus-Resumable"] = TusVersion;
        Response.Headers["Upload-Offset"] = upload.UploadedBytes.ToString();
        Response.Headers["Upload-Length"] = upload.TotalSize.ToString();
        Response.Headers["Cache-Control"] = "no-store";

        return Ok();
    }

    /// <summary>
    /// PATCH - Upload a chunk
    /// </summary>
    [HttpPatch("{uploadId}")]
    public async Task<IActionResult> PatchUpload(string uploadId)
    {
        var userId = User.GetUserId();
        var upload = await _context.TusUploads
            .FirstOrDefaultAsync(u => u.UploadId == uploadId && u.UserId == userId);

        if (upload == null)
        {
            return NotFound();
        }

        if (upload.IsComplete)
        {
            return StatusCode(409, "Upload already complete");
        }

        // Validate Content-Type
        if (Request.ContentType != "application/offset+octet-stream")
        {
            return StatusCode(415, "Content-Type must be application/offset+octet-stream");
        }

        // Validate Upload-Offset
        if (!Request.Headers.TryGetValue("Upload-Offset", out var offsetHeader) ||
            !long.TryParse(offsetHeader, out var clientOffset))
        {
            return BadRequest("Upload-Offset header is required");
        }

        if (clientOffset != upload.UploadedBytes)
        {
            return StatusCode(409, $"Offset mismatch. Expected {upload.UploadedBytes}, got {clientOffset}");
        }

        return await HandleChunkUpload(upload);
    }

    /// <summary>
    /// DELETE - Cancel and remove an upload
    /// </summary>
    [HttpDelete("{uploadId}")]
    public async Task<IActionResult> CancelUpload(string uploadId)
    {
        var userId = User.GetUserId();
        var upload = await _context.TusUploads
            .FirstOrDefaultAsync(u => u.UploadId == uploadId && u.UserId == userId);

        if (upload == null)
        {
            return NotFound();
        }

        // Delete temp file
        if (System.IO.File.Exists(upload.TempFilePath))
        {
            try
            {
                System.IO.File.Delete(upload.TempFilePath);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete temp file: {Path}", upload.TempFilePath);
            }
        }

        _context.TusUploads.Remove(upload);
        await _context.SaveChangesAsync();

        Response.Headers["Tus-Resumable"] = TusVersion;
        return NoContent();
    }

    /// <summary>
    /// GET - List active uploads for current user (non-standard, for UI)
    /// </summary>
    [HttpGet("active")]
    public async Task<IActionResult> GetActiveUploads()
    {
        var userId = User.GetUserId();

        var uploads = await _context.TusUploads
            .Where(u => u.UserId == userId && !u.IsComplete && u.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(u => u.LastActivity)
            .Select(u => new
            {
                u.UploadId,
                u.FileName,
                u.TotalSize,
                u.UploadedBytes,
                Progress = u.TotalSize > 0 ? (double)u.UploadedBytes / u.TotalSize * 100 : 0,
                u.CreatedAt,
                u.LastActivity,
                u.TargetFolderId
            })
            .ToListAsync();

        return Json(uploads);
    }

    private async Task<IActionResult> HandleChunkUpload(TusUpload upload)
    {
        var chunkSize = Request.ContentLength ?? 0;
        if (chunkSize == 0)
        {
            return BadRequest("No data in request body");
        }

        // Validate checksum if provided
        string? expectedChecksum = null;
        if (Request.Headers.TryGetValue("Upload-Checksum", out var checksumHeader))
        {
            var parts = checksumHeader.ToString().Split(' ');
            if (parts.Length == 2 && parts[0] == "sha256")
            {
                expectedChecksum = parts[1];
            }
        }

        try
        {
            // Write chunk to temp file
            await using var fileStream = new FileStream(upload.TempFilePath, FileMode.Open, FileAccess.Write, System.IO.FileShare.None);
            fileStream.Seek(upload.UploadedBytes, SeekOrigin.Begin);

            // Read and write in chunks with optional checksum verification
            using var sha256 = expectedChecksum != null ? SHA256.Create() : null;
            var buffer = new byte[64 * 1024]; // 64KB buffer
            long bytesWritten = 0;

            while (bytesWritten < chunkSize)
            {
                var bytesRead = await Request.Body.ReadAsync(buffer, 0, (int)Math.Min(buffer.Length, chunkSize - bytesWritten));
                if (bytesRead == 0) break;

                await fileStream.WriteAsync(buffer.AsMemory(0, bytesRead));
                sha256?.TransformBlock(buffer, 0, bytesRead, null, 0);
                bytesWritten += bytesRead;
            }

            // Verify checksum if provided
            if (sha256 != null && expectedChecksum != null)
            {
                sha256.TransformFinalBlock([], 0, 0);
                var actualChecksum = Convert.ToBase64String(sha256.Hash!);
                if (actualChecksum != expectedChecksum)
                {
                    return StatusCode(460, "Checksum mismatch"); // TUS-specific status
                }
            }

            // Update upload progress
            upload.UploadedBytes += bytesWritten;
            upload.LastActivity = DateTime.UtcNow;
            upload.ExpiresAt = DateTime.UtcNow.Add(UploadExpiration);

            // Check if upload is complete
            if (upload.UploadedBytes >= upload.TotalSize)
            {
                upload.IsComplete = true;
                await FinalizeUpload(upload);
            }

            await _context.SaveChangesAsync();

            Response.Headers["Tus-Resumable"] = TusVersion;
            Response.Headers["Upload-Offset"] = upload.UploadedBytes.ToString();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error writing chunk for upload {UploadId}", upload.UploadId);
            return StatusCode(500, "Error writing chunk");
        }
    }

    private async Task FinalizeUpload(TusUpload upload)
    {
        var userId = upload.UserId;
        var uploadPath = _storageService.GetUserFilesPath(userId);

        // Check if file already exists (for versioning)
        var existingFile = await _context.FileEntries
            .Include(f => f.Versions)
            .FirstOrDefaultAsync(f =>
                f.UserId == userId &&
                f.ParentFolderId == upload.TargetFolderId &&
                f.FileName == upload.FileName &&
                !f.IsFolder &&
                !f.IsDeleted);

        // Compute hash of uploaded file
        var contentHash = await ComputeFileHashAsync(upload.TempFilePath);
        var safeContentType = GetSafeContentType(upload.FileName) ?? upload.ContentType ?? "application/octet-stream";

        if (existingFile != null && existingFile.VersioningEnabled)
        {
            // Create a version of the existing file before replacing
            await CreateFileVersion(existingFile, userId);

            // Move temp file to replace existing
            var existingFilePath = existingFile.StoragePath;

            // Delete old file from disk
            if (System.IO.File.Exists(existingFilePath))
            {
                System.IO.File.Delete(existingFilePath);
            }

            // Move temp file to final location
            System.IO.File.Move(upload.TempFilePath, existingFilePath);

            // Update file entry
            existingFile.FileSize = upload.TotalSize;
            existingFile.ContentHash = contentHash;
            existingFile.ContentType = safeContentType;
            existingFile.LastModified = DateTime.UtcNow;
            existingFile.CurrentVersion++;

            _logger.LogInformation("Updated file {FileName} to version {Version} via TUS upload",
                existingFile.FileName, existingFile.CurrentVersion);
        }
        else
        {
            // Create new file entry
            var uniqueFileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid():N}_{upload.FileName}";
            var finalPath = Path.Combine(uploadPath, uniqueFileName);

            // Move temp file to final location
            System.IO.File.Move(upload.TempFilePath, finalPath);

            var fileEntry = new FileEntry
            {
                FileName = upload.FileName,
                StoragePath = finalPath,
                FileSize = upload.TotalSize,
                ContentType = safeContentType,
                ContentHash = contentHash,
                UploadDate = DateTime.UtcNow,
                LastModified = DateTime.UtcNow,
                UserId = userId,
                ParentFolderId = upload.TargetFolderId,
                IsFolder = false,
                CurrentVersion = 1,
                VersioningEnabled = true
            };

            _context.FileEntries.Add(fileEntry);
            _logger.LogInformation("Created new file {FileName} via TUS upload", fileEntry.FileName);
        }

        // Remove the TUS upload record
        _context.TusUploads.Remove(upload);
    }

    private async Task CreateFileVersion(FileEntry file, string userId)
    {
        // Get next version number
        var maxVersion = file.Versions.Any() ? file.Versions.Max(v => v.VersionNumber) : 0;
        var newVersionNumber = maxVersion + 1;

        // Create version storage path
        var versionDir = Path.Combine(Path.GetDirectoryName(file.StoragePath)!, ".versions", file.Id.ToString());
        Directory.CreateDirectory(versionDir);
        var versionPath = Path.Combine(versionDir, $"v{file.CurrentVersion}_{Path.GetFileName(file.StoragePath)}");

        // Copy current file to version storage
        System.IO.File.Copy(file.StoragePath, versionPath);

        var version = new FileVersion
        {
            FileEntryId = file.Id,
            VersionNumber = newVersionNumber,
            StoragePath = versionPath,
            FileSize = file.FileSize,
            ContentHash = file.ContentHash,
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = userId
        };

        _context.FileVersions.Add(version);

        // Cleanup old versions if we have too many
        var versionsToDelete = file.Versions
            .OrderByDescending(v => v.VersionNumber)
            .Skip(MaxVersions - 1)
            .ToList();

        foreach (var oldVersion in versionsToDelete)
        {
            if (System.IO.File.Exists(oldVersion.StoragePath))
            {
                try
                {
                    System.IO.File.Delete(oldVersion.StoragePath);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to delete old version file: {Path}", oldVersion.StoragePath);
                }
            }
            _context.FileVersions.Remove(oldVersion);
        }

        _logger.LogInformation("Created version {Version} of file {FileId}", newVersionNumber, file.Id);
    }

    private static Dictionary<string, string> ParseMetadata(string metadata)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var pair in metadata.Split(','))
        {
            var parts = pair.Trim().Split(' ', 2);
            if (parts.Length == 2)
            {
                try
                {
                    var value = Encoding.UTF8.GetString(Convert.FromBase64String(parts[1]));
                    result[parts[0]] = value;
                }
                catch
                {
                    result[parts[0]] = parts[1];
                }
            }
            else if (parts.Length == 1)
            {
                result[parts[0]] = string.Empty;
            }
        }

        return result;
    }

    private static string SanitizeFileName(string fileName)
    {
        var sanitized = Path.GetFileName(fileName);
        var invalidChars = Path.GetInvalidFileNameChars();
        sanitized = new string(sanitized.Where(c => !invalidChars.Contains(c)).ToArray());

        if (string.IsNullOrWhiteSpace(sanitized))
            sanitized = $"file_{Guid.NewGuid():N}";

        if (sanitized.Length > 200)
        {
            var ext = Path.GetExtension(sanitized);
            var nameWithoutExt = Path.GetFileNameWithoutExtension(sanitized);
            sanitized = nameWithoutExt[..(200 - ext.Length)] + ext;
        }

        return sanitized;
    }

    private static async Task<string> ComputeFileHashAsync(string filePath)
    {
        await using var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, System.IO.FileShare.Read,
            bufferSize: 64 * 1024, useAsync: true);
        var hashBytes = await SHA256.HashDataAsync(stream);
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }

    private static string? GetSafeContentType(string fileName)
    {
        var extension = Path.GetExtension(fileName)?.ToLowerInvariant();

        return extension switch
        {
            ".txt" => "text/plain",
            ".pdf" => "application/pdf",
            ".doc" => "application/msword",
            ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xls" => "application/vnd.ms-excel",
            ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".mp4" => "video/mp4",
            ".webm" => "video/webm",
            ".mp3" => "audio/mpeg",
            ".zip" => "application/zip",
            _ => null
        };
    }
}
