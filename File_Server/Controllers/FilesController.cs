using HLE.FileServer.Data;
using HLE.FileServer.Extensions;
using HLE.FileServer.Helpers;
using HLE.FileServer.Models;
using HLE.FileServer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

namespace HLE.FileServer.Controllers;

[Authorize]
public class FilesController : Controller
{
    private readonly ApplicationDbContext _context;
    private readonly IStorageService _storageService;
    private readonly ILogger<FilesController> _logger;

    // Security: Maximum file size (2 GB - increased for large media files)
    private const long MaxFileSize = 2L * 1024 * 1024 * 1024;

    // Trash retention period (30 days)
    private static readonly TimeSpan TrashRetentionPeriod = TimeSpan.FromDays(30);

    // Maximum versions to keep per file
    private const int MaxVersions = 10;

    // Security: Allowed file extensions whitelist
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".txt", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
        ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg",
        ".mp3", ".mp4", ".wav", ".avi", ".mov", ".mkv", ".webm",
        ".zip", ".rar", ".7z", ".tar", ".gz",
        ".csv", ".json", ".xml", ".html", ".css", ".js",
        ".md", ".rtf", ".odt", ".ods", ".odp"
    };

    // Security: Blocked file extensions (executable/dangerous)
    private static readonly HashSet<string> BlockedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".exe", ".dll", ".bat", ".cmd", ".ps1", ".sh", ".bash",
        ".msi", ".scr", ".com", ".pif", ".vbs", ".vbe", ".js",
        ".jse", ".wsf", ".wsh", ".msc", ".jar", ".reg"
    };

    public FilesController(
        ApplicationDbContext context,
        IStorageService storageService,
        ILogger<FilesController> logger)
    {
        _context = context;
        _storageService = storageService;
        _logger = logger;
    }

    public async Task<IActionResult> Index(int? folderId)
    {
        var userId = User.GetUserId();

        // Get files and folders in current directory (exclude deleted items)
        var entries = await _context.FileEntries
            .Where(f => f.UserId == userId && f.ParentFolderId == folderId && !f.IsDeleted)
            .OrderByDescending(f => f.IsFolder) // Folders first
            .ThenBy(f => f.FileName)
            .ToListAsync();

        // Build breadcrumb path
        ViewBag.Breadcrumbs = await GetBreadcrumbPath(folderId, userId!);
        ViewBag.CurrentFolderId = folderId;

        return View(entries);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CreateFolder(string folderName, int? parentFolderId)
    {
        if (string.IsNullOrWhiteSpace(folderName))
        {
            TempData["Error"] = "Folder name cannot be empty.";
            return RedirectToAction(nameof(Index), new { folderId = parentFolderId });
        }

        // Security: Validate folder name for invalid characters
        if (!IsValidFileName(folderName))
        {
            TempData["Error"] = "Folder name contains invalid characters.";
            return RedirectToAction(nameof(Index), new { folderId = parentFolderId });
        }

        var userId = User.GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        // Check if folder already exists in current directory
        var exists = await _context.FileEntries
            .AnyAsync(f => f.UserId == userId &&
                          f.ParentFolderId == parentFolderId &&
                          f.IsFolder &&
                          f.FileName == folderName);

        if (exists)
        {
            TempData["Error"] = "A folder with this name already exists.";
            return RedirectToAction(nameof(Index), new { folderId = parentFolderId });
        }

        var folder = new FileEntry
        {
            FileName = folderName,
            IsFolder = true,
            ParentFolderId = parentFolderId,
            UserId = userId,
            UploadDate = DateTime.UtcNow,
            FileSize = 0,
            StoragePath = string.Empty,
            ContentType = "folder"
        };

        _context.FileEntries.Add(folder);
        await _context.SaveChangesAsync();

        TempData["Success"] = $"Folder '{folderName}' created successfully.";
        return RedirectToAction(nameof(Index), new { folderId = parentFolderId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Upload(List<IFormFile> files, int? currentFolderId)
    {
        if (files == null || files.Count == 0)
        {
            TempData["Error"] = "No files selected for upload.";
            return RedirectToAction(nameof(Index), new { folderId = currentFolderId });
        }

        var userId = User.GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        // Get upload directory from storage service
        var uploadPath = _storageService.GetUserFilesPath(userId);

        var uploadedCount = 0;
        var skippedFiles = new List<string>();

        foreach (var file in files)
        {
            if (file.Length > 0)
            {
                // Security: Validate file size
                if (file.Length > MaxFileSize)
                {
                    skippedFiles.Add($"{file.FileName} (exceeds size limit)");
                    continue;
                }

                // Security: Validate file extension
                var fileValidation = ValidateFileUpload(file);
                if (!fileValidation.IsValid)
                {
                    skippedFiles.Add($"{file.FileName} ({fileValidation.ErrorMessage})");
                    continue;
                }

                try
                {
                    // Security: Sanitize filename
                    var fileName = SanitizeFileName(file.FileName);
                    var uniqueFileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid():N}_{fileName}";
                    var filePath = Path.Combine(uploadPath, uniqueFileName);

                    // Security: Verify the path is within the expected directory
                    var fullPath = Path.GetFullPath(filePath);
                    var expectedDirectory = Path.GetFullPath(uploadPath);
                    if (!fullPath.StartsWith(expectedDirectory, StringComparison.OrdinalIgnoreCase))
                    {
                        _logger.LogWarning("Path traversal attempt detected for file: {FileName}", file.FileName);
                        skippedFiles.Add($"{file.FileName} (invalid path)");
                        continue;
                    }

                    // Save file to disk and compute hash
                    string? contentHash = null;
                    using (var stream = new FileStream(filePath, FileMode.Create))
                    {
                        await file.CopyToAsync(stream);
                    }

                    // Compute SHA-256 hash for ETag and deduplication
                    contentHash = await ComputeFileHashAsync(filePath);

                    // Security: Determine safe content type
                    var safeContentType = GetSafeContentType(fileName);
                    var now = DateTime.UtcNow;

                    // Save file metadata to database
                    var fileEntry = new FileEntry
                    {
                        FileName = fileName,
                        StoragePath = filePath,
                        FileSize = file.Length,
                        ContentType = safeContentType,
                        UploadDate = now,
                        LastModified = now,
                        ContentHash = contentHash,
                        UserId = userId,
                        IsFolder = false,
                        ParentFolderId = currentFolderId
                    };

                    _context.FileEntries.Add(fileEntry);
                    uploadedCount++;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error uploading file: {FileName}", file.FileName);
                }
            }
        }

        if (skippedFiles.Count > 0)
        {
            TempData["Warning"] = $"Some files were skipped: {string.Join(", ", skippedFiles.Take(3))}{(skippedFiles.Count > 3 ? $" and {skippedFiles.Count - 3} more" : "")}";
        }

        await _context.SaveChangesAsync();

        if (uploadedCount > 0)
        {
            TempData["Success"] = $"Successfully uploaded {uploadedCount} file(s).";
        }
        else
        {
            TempData["Error"] = "Failed to upload files.";
        }

        return RedirectToAction(nameof(Index), new { folderId = currentFolderId });
    }

    [HttpPost]
    public async Task<IActionResult> UploadFile(IFormFile file, int? folderId)
    {
        if (file == null || file.Length == 0)
        {
            return Json(new { success = false, message = "No file provided." });
        }

        // Security: Validate file size
        if (file.Length > MaxFileSize)
        {
            return Json(new { success = false, message = "File exceeds maximum size limit (500 MB)." });
        }

        // Security: Validate file extension
        var fileValidation = ValidateFileUpload(file);
        if (!fileValidation.IsValid)
        {
            return Json(new { success = false, message = fileValidation.ErrorMessage });
        }

        var userId = User.GetUserId();
        if (userId == null)
        {
            return Json(new { success = false, message = "Unauthorized." });
        }

        try
        {
            // Get upload directory from storage service
            var uploadPath = _storageService.GetUserFilesPath(userId);

            // Security: Sanitize filename
            var fileName = SanitizeFileName(file.FileName);
            var uniqueFileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid():N}_{fileName}";
            var filePath = Path.Combine(uploadPath, uniqueFileName);

            // Security: Verify the path is within the expected directory
            var fullPath = Path.GetFullPath(filePath);
            var expectedDirectory = Path.GetFullPath(uploadPath);
            if (!fullPath.StartsWith(expectedDirectory, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Path traversal attempt detected for file: {FileName}", file.FileName);
                return Json(new { success = false, message = "Invalid file path." });
            }

            // Save file to disk
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Compute SHA-256 hash for ETag and deduplication
            var contentHash = await ComputeFileHashAsync(filePath);

            // Security: Determine safe content type
            var safeContentType = GetSafeContentType(fileName);
            var now = DateTime.UtcNow;

            // Save file metadata to database
            var fileEntry = new FileEntry
            {
                FileName = fileName,
                StoragePath = filePath,
                FileSize = file.Length,
                ContentType = safeContentType,
                UploadDate = now,
                LastModified = now,
                ContentHash = contentHash,
                UserId = userId,
                IsFolder = false,
                ParentFolderId = folderId
            };

            _context.FileEntries.Add(fileEntry);
            await _context.SaveChangesAsync();

            return Json(new
            {
                success = true,
                message = "File uploaded successfully.",
                file = new
                {
                    id = fileEntry.Id,
                    fileName = fileEntry.FileName,
                    fileSize = fileEntry.FileSize,
                    contentType = fileEntry.ContentType,
                    contentHash = fileEntry.ContentHash
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading file: {FileName}", file.FileName);
            return Json(new { success = false, message = "An error occurred while uploading the file." });
        }
    }

    public async Task<IActionResult> Download(int id)
    {
        var userId = User.GetUserId();
        var fileEntry = await _context.FileEntries
            .FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId && !f.IsDeleted);

        if (fileEntry == null)
        {
            return NotFound();
        }

        if (fileEntry.IsFolder)
        {
            TempData["Error"] = "Cannot download folders.";
            return RedirectToAction(nameof(Index), new { folderId = fileEntry.ParentFolderId });
        }

        // Security: Validate that the file path is within the expected user directory
        var expectedDirectory = Path.GetFullPath(_storageService.GetUserFilesPath(userId!));
        var actualFilePath = Path.GetFullPath(fileEntry.StoragePath);
        if (!actualFilePath.StartsWith(expectedDirectory, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Path traversal attempt detected during download. User: {UserId}, Path: {Path}", userId, fileEntry.StoragePath);
            return Forbid();
        }

        if (!System.IO.File.Exists(fileEntry.StoragePath))
        {
            TempData["Error"] = "File not found on disk.";
            return RedirectToAction(nameof(Index), new { folderId = fileEntry.ParentFolderId });
        }

        var safeFileName = SanitizeFileName(fileEntry.FileName);
        var contentType = fileEntry.ContentType ?? "application/octet-stream";
        var fileInfo = new FileInfo(fileEntry.StoragePath);
        var fileLength = fileInfo.Length;
        var lastModified = fileEntry.LastModified;

        // Generate ETag from content hash or file metadata
        var etag = !string.IsNullOrEmpty(fileEntry.ContentHash)
            ? $"\"{fileEntry.ContentHash}\""
            : $"\"{fileEntry.Id}-{lastModified.Ticks}\"";

        // Check If-None-Match (ETag) - return 304 if unchanged
        var requestEtag = Request.Headers.IfNoneMatch.ToString();
        if (!string.IsNullOrEmpty(requestEtag) && requestEtag == etag)
        {
            return StatusCode(304); // Not Modified
        }

        // Check If-Modified-Since - return 304 if unchanged
        if (Request.Headers.IfModifiedSince.Count > 0)
        {
            if (DateTimeOffset.TryParse(Request.Headers.IfModifiedSince.ToString(), out var ifModifiedSince))
            {
                if (lastModified <= ifModifiedSince.UtcDateTime.AddSeconds(1)) // 1-second tolerance
                {
                    return StatusCode(304); // Not Modified
                }
            }
        }

        // Set caching headers
        Response.Headers.ETag = etag;
        Response.Headers.LastModified = lastModified.ToString("R");
        Response.Headers.CacheControl = "private, max-age=3600"; // 1 hour cache
        Response.Headers.AcceptRanges = "bytes";

        // Handle Range requests (HTTP 206 Partial Content)
        var rangeHeader = Request.Headers.Range.ToString();
        if (!string.IsNullOrEmpty(rangeHeader) && rangeHeader.StartsWith("bytes="))
        {
            return HandleRangeRequest(fileEntry.StoragePath, fileLength, contentType, safeFileName, rangeHeader);
        }

        // Full file download
        var stream = new FileStream(fileEntry.StoragePath, FileMode.Open, FileAccess.Read, System.IO.FileShare.Read,
            bufferSize: 64 * 1024, // 64KB buffer for large file performance
            useAsync: true);

        return File(stream, contentType, safeFileName, enableRangeProcessing: true);
    }

    /// <summary>
    /// Handles HTTP Range requests for partial content (video seeking, download resume)
    /// </summary>
    private IActionResult HandleRangeRequest(string filePath, long fileLength, string contentType, string fileName, string rangeHeader)
    {
        // Parse range header: "bytes=start-end" or "bytes=start-"
        var rangeSpec = rangeHeader.Substring(6); // Remove "bytes="
        var rangeParts = rangeSpec.Split('-');

        long start = 0;
        long end = fileLength - 1;

        if (rangeParts.Length >= 1 && long.TryParse(rangeParts[0], out var rangeStart))
        {
            start = rangeStart;
        }

        if (rangeParts.Length >= 2 && !string.IsNullOrEmpty(rangeParts[1]) && long.TryParse(rangeParts[1], out var rangeEnd))
        {
            end = Math.Min(rangeEnd, fileLength - 1);
        }

        // Validate range
        if (start < 0 || start >= fileLength || end < start)
        {
            Response.Headers.ContentRange = $"bytes */{fileLength}";
            return StatusCode(416); // Range Not Satisfiable
        }

        var contentLength = end - start + 1;

        Response.StatusCode = 206; // Partial Content
        Response.Headers.ContentRange = $"bytes {start}-{end}/{fileLength}";
        Response.Headers.ContentLength = contentLength;
        Response.Headers.ContentDisposition = $"attachment; filename=\"{fileName}\"";
        Response.ContentType = contentType;

        // Stream the requested range
        var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, System.IO.FileShare.Read,
            bufferSize: 64 * 1024, useAsync: true);
        stream.Seek(start, SeekOrigin.Begin);

        return new FileStreamResult(new RangeStream(stream, contentLength), contentType);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Move(int id, int? destinationFolderId)
    {
        var userId = User.GetUserId();
        var fileEntry = await _context.FileEntries
            .FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId);

        if (fileEntry == null)
        {
            return NotFound();
        }

        // Validate destination folder if provided
        if (destinationFolderId.HasValue)
        {
            var destinationFolder = await _context.FileEntries
                .FirstOrDefaultAsync(f => f.Id == destinationFolderId && f.UserId == userId && f.IsFolder);

            if (destinationFolder == null)
            {
                TempData["Error"] = "Destination folder not found.";
                return RedirectToAction(nameof(Index), new { folderId = fileEntry.ParentFolderId });
            }

            // Prevent moving a folder into itself or its children
            if (fileEntry.IsFolder && await IsDescendantOf(destinationFolderId.Value, fileEntry.Id))
            {
                TempData["Error"] = "Cannot move a folder into itself or its subfolders.";
                return RedirectToAction(nameof(Index), new { folderId = fileEntry.ParentFolderId });
            }
        }

        // Check for duplicate name in destination
        var duplicate = await _context.FileEntries
            .AnyAsync(f => f.UserId == userId &&
                          f.ParentFolderId == destinationFolderId &&
                          f.FileName == fileEntry.FileName &&
                          f.Id != fileEntry.Id);

        if (duplicate)
        {
            TempData["Error"] = $"An item with the name '{fileEntry.FileName}' already exists in the destination folder.";
            return RedirectToAction(nameof(Index), new { folderId = fileEntry.ParentFolderId });
        }

        var oldParentFolderId = fileEntry.ParentFolderId;
        fileEntry.ParentFolderId = destinationFolderId;
        await _context.SaveChangesAsync();

        TempData["Success"] = $"'{fileEntry.FileName}' moved successfully.";
        return RedirectToAction(nameof(Index), new { folderId = oldParentFolderId });
    }

    [HttpGet]
    public async Task<IActionResult> GetFolderTree(int? excludeFolderId)
    {
        var userId = User.GetUserId();
        var folders = await _context.FileEntries
            .Where(f => f.UserId == userId && f.IsFolder && f.Id != excludeFolderId)
            .OrderBy(f => f.FileName)
            .Select(f => new { f.Id, f.FileName, f.ParentFolderId })
            .ToListAsync();

        return Json(folders);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Rename(int id, string newName)
    {
        if (string.IsNullOrWhiteSpace(newName))
        {
            return Json(new { success = false, message = "Name cannot be empty." });
        }

        // Security: Validate new name for invalid characters
        if (!IsValidFileName(newName))
        {
            return Json(new { success = false, message = "Name contains invalid characters." });
        }

        var userId = User.GetUserId();
        var fileEntry = await _context.FileEntries
            .FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId);

        if (fileEntry == null)
        {
            return Json(new { success = false, message = "File or folder not found." });
        }

        // Check for duplicate name in current directory
        var duplicate = await _context.FileEntries
            .AnyAsync(f => f.UserId == userId &&
                          f.ParentFolderId == fileEntry.ParentFolderId &&
                          f.FileName == newName &&
                          f.Id != fileEntry.Id);

        if (duplicate)
        {
            return Json(new { success = false, message = $"An item with the name '{newName}' already exists in this location." });
        }

        var oldName = fileEntry.FileName;
        fileEntry.FileName = newName;
        await _context.SaveChangesAsync();

        return Json(new { success = true, message = $"'{oldName}' renamed to '{newName}' successfully." });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = User.GetUserId();
        var fileEntry = await _context.FileEntries
            .Include(f => f.Children)
            .FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId && !f.IsDeleted);

        if (fileEntry == null)
        {
            return NotFound();
        }

        var parentFolderId = fileEntry.ParentFolderId;

        // Soft delete - move to trash
        if (fileEntry.IsFolder)
        {
            await SoftDeleteFolderRecursive(fileEntry);
            TempData["Success"] = $"Folder '{fileEntry.FileName}' moved to trash.";
        }
        else
        {
            fileEntry.IsDeleted = true;
            fileEntry.DeletedDate = DateTime.UtcNow;
            fileEntry.OriginalParentFolderId = fileEntry.ParentFolderId;
            fileEntry.ParentFolderId = null; // Remove from folder hierarchy
            TempData["Success"] = $"File '{fileEntry.FileName}' moved to trash.";
        }

        await _context.SaveChangesAsync();
        return RedirectToAction(nameof(Index), new { folderId = parentFolderId });
    }

    /// <summary>
    /// View items in trash
    /// </summary>
    public async Task<IActionResult> Trash()
    {
        var userId = User.GetUserId();

        var trashedItems = await _context.FileEntries
            .Where(f => f.UserId == userId && f.IsDeleted)
            .OrderByDescending(f => f.DeletedDate)
            .ToListAsync();

        // Calculate days remaining before permanent deletion
        ViewBag.TrashRetentionDays = TrashRetentionPeriod.Days;

        return View(trashedItems);
    }

    /// <summary>
    /// Restore an item from trash
    /// </summary>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Restore(int id)
    {
        var userId = User.GetUserId();
        var fileEntry = await _context.FileEntries
            .FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId && f.IsDeleted);

        if (fileEntry == null)
        {
            return NotFound();
        }

        // Verify original parent folder still exists (if it was in a folder)
        int? restoreToFolder = null;
        if (fileEntry.OriginalParentFolderId.HasValue)
        {
            var parentExists = await _context.FileEntries
                .AnyAsync(f => f.Id == fileEntry.OriginalParentFolderId && f.UserId == userId && !f.IsDeleted);

            if (parentExists)
            {
                restoreToFolder = fileEntry.OriginalParentFolderId;
            }
        }

        // Restore the item
        fileEntry.IsDeleted = false;
        fileEntry.DeletedDate = null;
        fileEntry.ParentFolderId = restoreToFolder;
        fileEntry.OriginalParentFolderId = null;

        // If it's a folder, restore children too
        if (fileEntry.IsFolder)
        {
            await RestoreFolderChildrenRecursive(fileEntry.Id, userId!);
        }

        await _context.SaveChangesAsync();

        TempData["Success"] = $"'{fileEntry.FileName}' restored successfully.";
        return RedirectToAction(nameof(Trash));
    }

    /// <summary>
    /// Permanently delete an item from trash
    /// </summary>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> PermanentDelete(int id)
    {
        var userId = User.GetUserId();
        var fileEntry = await _context.FileEntries
            .Include(f => f.Children)
            .FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId && f.IsDeleted);

        if (fileEntry == null)
        {
            return NotFound();
        }

        if (fileEntry.IsFolder)
        {
            await HardDeleteFolderRecursive(fileEntry);
        }
        else
        {
            // Delete file from disk
            if (!string.IsNullOrEmpty(fileEntry.StoragePath) && System.IO.File.Exists(fileEntry.StoragePath))
            {
                try
                {
                    System.IO.File.Delete(fileEntry.StoragePath);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error deleting file from disk: {FilePath}", fileEntry.StoragePath);
                }
            }
            _context.FileEntries.Remove(fileEntry);
        }

        await _context.SaveChangesAsync();

        TempData["Success"] = $"'{fileEntry.FileName}' permanently deleted.";
        return RedirectToAction(nameof(Trash));
    }

    /// <summary>
    /// Empty all items from trash
    /// </summary>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> EmptyTrash()
    {
        var userId = User.GetUserId();

        var trashedItems = await _context.FileEntries
            .Where(f => f.UserId == userId && f.IsDeleted)
            .ToListAsync();

        foreach (var item in trashedItems)
        {
            if (!item.IsFolder && !string.IsNullOrEmpty(item.StoragePath) && System.IO.File.Exists(item.StoragePath))
            {
                try
                {
                    System.IO.File.Delete(item.StoragePath);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error deleting file from disk: {FilePath}", item.StoragePath);
                }
            }
        }

        _context.FileEntries.RemoveRange(trashedItems);
        await _context.SaveChangesAsync();

        TempData["Success"] = $"Trash emptied. {trashedItems.Count} item(s) permanently deleted.";
        return RedirectToAction(nameof(Trash));
    }

    private async Task SoftDeleteFolderRecursive(FileEntry folder)
    {
        folder.IsDeleted = true;
        folder.DeletedDate = DateTime.UtcNow;
        folder.OriginalParentFolderId = folder.ParentFolderId;
        folder.ParentFolderId = null;

        // Get all children (not already deleted)
        var children = await _context.FileEntries
            .Where(f => f.ParentFolderId == folder.Id && !f.IsDeleted)
            .ToListAsync();

        foreach (var child in children)
        {
            if (child.IsFolder)
            {
                await SoftDeleteFolderRecursive(child);
            }
            else
            {
                child.IsDeleted = true;
                child.DeletedDate = DateTime.UtcNow;
                child.OriginalParentFolderId = child.ParentFolderId;
                child.ParentFolderId = null;
            }
        }
    }

    private async Task RestoreFolderChildrenRecursive(int folderId, string userId)
    {
        // Find children that were deleted at same time (part of folder deletion)
        var children = await _context.FileEntries
            .Where(f => f.UserId == userId && f.IsDeleted && f.OriginalParentFolderId == folderId)
            .ToListAsync();

        foreach (var child in children)
        {
            child.IsDeleted = false;
            child.DeletedDate = null;
            child.ParentFolderId = folderId;
            child.OriginalParentFolderId = null;

            if (child.IsFolder)
            {
                await RestoreFolderChildrenRecursive(child.Id, userId);
            }
        }
    }

    private async Task HardDeleteFolderRecursive(FileEntry folder)
    {
        // Get all children (including soft-deleted that were part of this folder)
        var children = await _context.FileEntries
            .Where(f => f.ParentFolderId == folder.Id || f.OriginalParentFolderId == folder.Id)
            .ToListAsync();

        foreach (var child in children)
        {
            if (child.IsFolder)
            {
                await HardDeleteFolderRecursive(child);
            }
            else
            {
                if (!string.IsNullOrEmpty(child.StoragePath) && System.IO.File.Exists(child.StoragePath))
                {
                    try
                    {
                        System.IO.File.Delete(child.StoragePath);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error deleting file from disk: {FilePath}", child.StoragePath);
                    }
                }
                _context.FileEntries.Remove(child);
            }
        }

        _context.FileEntries.Remove(folder);
    }

    private async Task<List<(int? Id, string Name)>> GetBreadcrumbPath(int? folderId, string userId)
    {
        var breadcrumbs = new List<(int? Id, string Name)>();
        breadcrumbs.Add((null, "Home"));

        if (folderId == null)
        {
            return breadcrumbs;
        }

        var currentFolder = await _context.FileEntries
            .FirstOrDefaultAsync(f => f.Id == folderId && f.UserId == userId && f.IsFolder);

        if (currentFolder == null)
        {
            return breadcrumbs;
        }

        var path = new List<(int? Id, string Name)>();
        var current = currentFolder;

        while (current != null)
        {
            path.Insert(0, (current.Id, current.FileName));

            if (current.ParentFolderId != null)
            {
                current = await _context.FileEntries
                    .FirstOrDefaultAsync(f => f.Id == current.ParentFolderId);
            }
            else
            {
                current = null;
            }
        }

        breadcrumbs.AddRange(path);
        return breadcrumbs;
    }

    private async Task<bool> IsDescendantOf(int? folderId, int ancestorId)
    {
        if (folderId == null)
        {
            return false;
        }

        if (folderId == ancestorId)
        {
            return true;
        }

        var folder = await _context.FileEntries
            .FirstOrDefaultAsync(f => f.Id == folderId);

        if (folder == null)
        {
            return false;
        }

        return await IsDescendantOf(folder.ParentFolderId, ancestorId);
    }

    #region Version History

    /// <summary>
    /// Get version history for a file
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetVersions(int id)
    {
        var userId = User.GetUserId();
        var file = await _context.FileEntries
            .Include(f => f.Versions)
            .FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId && !f.IsFolder && !f.IsDeleted);

        if (file == null)
        {
            return NotFound();
        }

        var versions = file.Versions
            .OrderByDescending(v => v.VersionNumber)
            .Select(v => new
            {
                v.Id,
                v.VersionNumber,
                v.FileSize,
                v.CreatedAt,
                v.Note,
                IsCurrent = false
            })
            .ToList();

        // Add current version at the top
        var result = new List<object>
        {
            new
            {
                Id = (int?)null,
                VersionNumber = file.CurrentVersion,
                file.FileSize,
                CreatedAt = file.LastModified,
                Note = (string?)null,
                IsCurrent = true
            }
        };
        result.AddRange(versions.Cast<object>());

        return Json(new
        {
            fileId = file.Id,
            fileName = file.FileName,
            versioningEnabled = file.VersioningEnabled,
            currentVersion = file.CurrentVersion,
            versions = result
        });
    }

    /// <summary>
    /// Download a specific version of a file
    /// </summary>
    public async Task<IActionResult> DownloadVersion(int id, int versionId)
    {
        var userId = User.GetUserId();

        var version = await _context.FileVersions
            .Include(v => v.FileEntry)
            .FirstOrDefaultAsync(v => v.Id == versionId && v.FileEntry!.UserId == userId);

        if (version?.FileEntry == null || version.FileEntry.Id != id)
        {
            return NotFound();
        }

        if (!System.IO.File.Exists(version.StoragePath))
        {
            TempData["Error"] = "Version file not found on disk.";
            return RedirectToAction(nameof(Index));
        }

        var safeFileName = $"v{version.VersionNumber}_{SanitizeFileName(version.FileEntry.FileName)}";
        var stream = new FileStream(version.StoragePath, FileMode.Open, FileAccess.Read, System.IO.FileShare.Read);

        return File(stream, "application/octet-stream", safeFileName);
    }

    /// <summary>
    /// Restore a previous version of a file
    /// </summary>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> RestoreVersion(int id, int versionId)
    {
        var userId = User.GetUserId();

        var version = await _context.FileVersions
            .Include(v => v.FileEntry)
            .ThenInclude(f => f!.Versions)
            .FirstOrDefaultAsync(v => v.Id == versionId && v.FileEntry!.UserId == userId);

        if (version?.FileEntry == null || version.FileEntry.Id != id)
        {
            return Json(new { success = false, message = "Version not found." });
        }

        var file = version.FileEntry;

        if (!System.IO.File.Exists(version.StoragePath))
        {
            return Json(new { success = false, message = "Version file not found on disk." });
        }

        try
        {
            // Create a version of the current file before restoring
            await CreateFileVersionAsync(file, userId!);

            // Copy version file to replace current
            System.IO.File.Copy(version.StoragePath, file.StoragePath, overwrite: true);

            // Update file metadata
            file.FileSize = version.FileSize;
            file.ContentHash = version.ContentHash;
            file.LastModified = DateTime.UtcNow;
            file.CurrentVersion++;

            await _context.SaveChangesAsync();

            return Json(new
            {
                success = true,
                message = $"Restored to version {version.VersionNumber}. Current version is now {file.CurrentVersion}."
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restoring version {VersionId} for file {FileId}", versionId, id);
            return Json(new { success = false, message = "Error restoring version." });
        }
    }

    /// <summary>
    /// Delete a specific version
    /// </summary>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteVersion(int id, int versionId)
    {
        var userId = User.GetUserId();

        var version = await _context.FileVersions
            .Include(v => v.FileEntry)
            .FirstOrDefaultAsync(v => v.Id == versionId && v.FileEntry!.UserId == userId);

        if (version?.FileEntry == null || version.FileEntry.Id != id)
        {
            return Json(new { success = false, message = "Version not found." });
        }

        // Delete version file from disk
        if (System.IO.File.Exists(version.StoragePath))
        {
            try
            {
                System.IO.File.Delete(version.StoragePath);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete version file: {Path}", version.StoragePath);
            }
        }

        _context.FileVersions.Remove(version);
        await _context.SaveChangesAsync();

        return Json(new { success = true, message = $"Version {version.VersionNumber} deleted." });
    }

    /// <summary>
    /// Toggle versioning for a file
    /// </summary>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ToggleVersioning(int id, bool enabled)
    {
        var userId = User.GetUserId();
        var file = await _context.FileEntries
            .FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId && !f.IsFolder && !f.IsDeleted);

        if (file == null)
        {
            return Json(new { success = false, message = "File not found." });
        }

        file.VersioningEnabled = enabled;
        await _context.SaveChangesAsync();

        return Json(new
        {
            success = true,
            message = enabled ? "Versioning enabled." : "Versioning disabled.",
            versioningEnabled = enabled
        });
    }

    /// <summary>
    /// Creates a version of the current file content
    /// </summary>
    private async Task CreateFileVersionAsync(FileEntry file, string userId)
    {
        // Get next version number
        var maxVersion = await _context.FileVersions
            .Where(v => v.FileEntryId == file.Id)
            .MaxAsync(v => (int?)v.VersionNumber) ?? 0;

        var newVersionNumber = maxVersion + 1;

        // Create version storage directory
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
        var versionCount = await _context.FileVersions.CountAsync(v => v.FileEntryId == file.Id);
        if (versionCount >= MaxVersions)
        {
            var versionsToDelete = await _context.FileVersions
                .Where(v => v.FileEntryId == file.Id)
                .OrderBy(v => v.VersionNumber)
                .Take(versionCount - MaxVersions + 1)
                .ToListAsync();

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
        }

        _logger.LogInformation("Created version {Version} of file {FileId}", newVersionNumber, file.Id);
    }

    #endregion

    /// <summary>
    /// Computes SHA-256 hash of a file for ETag generation and deduplication
    /// </summary>
    private static async Task<string> ComputeFileHashAsync(string filePath)
    {
        using var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, System.IO.FileShare.Read,
            bufferSize: 64 * 1024, useAsync: true);
        var hashBytes = await SHA256.HashDataAsync(stream);
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }

    #region Security Helper Methods

    /// <summary>
    /// Validates if a filename is safe and doesn't contain invalid characters or path traversal sequences
    /// </summary>
    private static bool IsValidFileName(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName) || fileName.Length > 255)
            return false;

        // Check for path traversal sequences
        if (fileName.Contains("..") || fileName.Contains("/") || fileName.Contains("\\"))
            return false;

        // Check for invalid filename characters
        var invalidChars = Path.GetInvalidFileNameChars();
        return !fileName.Any(c => invalidChars.Contains(c));
    }

    /// <summary>
    /// Sanitizes a filename by removing path components and invalid characters
    /// </summary>
    private static string SanitizeFileName(string fileName)
    {
        // Get just the filename without any path
        var sanitized = Path.GetFileName(fileName);

        // Remove any remaining invalid characters
        var invalidChars = Path.GetInvalidFileNameChars();
        sanitized = new string(sanitized.Where(c => !invalidChars.Contains(c)).ToArray());

        // Ensure the filename is not empty after sanitization
        if (string.IsNullOrWhiteSpace(sanitized))
            sanitized = $"file_{Guid.NewGuid():N}";

        // Limit filename length
        if (sanitized.Length > 200)
        {
            var ext = Path.GetExtension(sanitized);
            var nameWithoutExt = Path.GetFileNameWithoutExtension(sanitized);
            sanitized = nameWithoutExt.Substring(0, 200 - ext.Length) + ext;
        }

        return sanitized;
    }

    /// <summary>
    /// Validates file upload for security (extension, content type)
    /// </summary>
    private static (bool IsValid, string ErrorMessage) ValidateFileUpload(IFormFile file)
    {
        var extension = Path.GetExtension(file.FileName)?.ToLowerInvariant();

        if (string.IsNullOrEmpty(extension))
            return (false, "File must have an extension");

        // Check if extension is blocked (dangerous executable files)
        if (BlockedExtensions.Contains(extension))
            return (false, "This file type is not allowed for security reasons");

        // Double extension check (e.g., file.pdf.exe)
        var fileNameWithoutExt = Path.GetFileNameWithoutExtension(file.FileName);
        var secondExtension = Path.GetExtension(fileNameWithoutExt)?.ToLowerInvariant();
        if (!string.IsNullOrEmpty(secondExtension) && BlockedExtensions.Contains(secondExtension))
            return (false, "Files with suspicious double extensions are not allowed");

        return (true, string.Empty);
    }

    /// <summary>
    /// Gets a safe content type based on file extension (don't trust client-provided content type)
    /// </summary>
    private static string GetSafeContentType(string fileName)
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
            ".ppt" => "application/vnd.ms-powerpoint",
            ".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".bmp" => "image/bmp",
            ".webp" => "image/webp",
            ".svg" => "image/svg+xml",
            ".mp3" => "audio/mpeg",
            ".wav" => "audio/wav",
            ".mp4" => "video/mp4",
            ".webm" => "video/webm",
            ".avi" => "video/x-msvideo",
            ".mov" => "video/quicktime",
            ".mkv" => "video/x-matroska",
            ".zip" => "application/zip",
            ".rar" => "application/vnd.rar",
            ".7z" => "application/x-7z-compressed",
            ".tar" => "application/x-tar",
            ".gz" => "application/gzip",
            ".csv" => "text/csv",
            ".json" => "application/json",
            ".xml" => "application/xml",
            ".html" => "text/html",
            ".css" => "text/css",
            ".md" => "text/markdown",
            ".rtf" => "application/rtf",
            _ => "application/octet-stream"
        };
    }

    #endregion
}
