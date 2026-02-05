using HLE.FileServer.Data;
using HLE.FileServer.Extensions;
using HLE.FileServer.Models;
using HLE.FileServer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HLE.FileServer.Controllers;

[Authorize]
public class GroupsController : Controller
{
    private readonly ApplicationDbContext _context;
    private readonly IStorageService _storageService;
    private readonly ILogger<GroupsController> _logger;

    // Security: Maximum file size (500 MB)
    private const long MaxFileSize = 500 * 1024 * 1024;

    // Security: Blocked file extensions (executable/dangerous)
    private static readonly HashSet<string> BlockedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".exe", ".dll", ".bat", ".cmd", ".ps1", ".sh", ".bash",
        ".msi", ".scr", ".com", ".pif", ".vbs", ".vbe", ".js",
        ".jse", ".wsf", ".wsh", ".msc", ".jar", ".reg"
    };

    public GroupsController(
        ApplicationDbContext context,
        IStorageService storageService,
        ILogger<GroupsController> logger)
    {
        _context = context;
        _storageService = storageService;
        _logger = logger;
    }

    // GET: Groups
    public async Task<IActionResult> Index()
    {
        var userId = User.GetUserId();

        // Get groups where user is owner or member
        var ownedGroups = await _context.Groups
            .Include(g => g.Owner)
            .Include(g => g.Members)
            .Where(g => g.OwnerId == userId && g.IsActive)
            .ToListAsync();

        var memberGroups = await _context.GroupMembers
            .Include(gm => gm.Group)
            .ThenInclude(g => g!.Owner)
            .Include(gm => gm.Group)
            .ThenInclude(g => g!.Members)
            .Where(gm => gm.UserId == userId && gm.Group!.IsActive)
            .Select(gm => gm.Group)
            .ToListAsync();

        ViewBag.OwnedGroups = ownedGroups;
        ViewBag.MemberGroups = memberGroups;

        return View();
    }

    // GET: Groups/Details/5
    public async Task<IActionResult> Details(int id, int? folderId)
    {
        var userId = User.GetUserId();
        var group = await _context.Groups
            .Include(g => g.Owner)
            .Include(g => g.Members)
            .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(g => g.Id == id);

        if (group == null)
        {
            return NotFound();
        }

        // Check if user has access to this group
        var member = group.Members.FirstOrDefault(m => m.UserId == userId);
        if (group.OwnerId != userId && member == null)
        {
            TempData["Error"] = "You don't have access to this group.";
            return RedirectToAction(nameof(Index));
        }

        // Get files in current folder
        var files = await _context.GroupFiles
            .Include(f => f.UploadedBy)
            .Where(f => f.GroupId == id && f.ParentFolderId == folderId)
            .OrderByDescending(f => f.IsFolder)
            .ThenBy(f => f.FileName)
            .ToListAsync();

        // Build breadcrumb path
        ViewBag.Breadcrumbs = await GetGroupBreadcrumbPath(id, folderId);
        ViewBag.CurrentFolderId = folderId;
        ViewBag.Group = group;
        ViewBag.UserMember = member;
        ViewBag.IsOwner = group.OwnerId == userId;

        return View(files);
    }

    // GET: Groups/Create
    public IActionResult Create()
    {
        return View();
    }

    // POST: Groups/Create
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create([Bind("Name,Description,StorageQuotaBytes")] Group group)
    {
        if (!ModelState.IsValid)
        {
            return View(group);
        }

        var userId = User.GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        group.OwnerId = userId;
        group.CreatedDate = DateTime.UtcNow;
        group.IsActive = true;
        group.StorageUsedBytes = 0;

        _context.Groups.Add(group);
        await _context.SaveChangesAsync();

        // Create owner membership
        var ownerMembership = new GroupMember
        {
            GroupId = group.Id,
            UserId = userId,
            Role = GroupRole.Owner,
            CanUpload = true,
            CanDownload = true,
            CanDelete = true,
            CanManageMembers = true
        };

        _context.GroupMembers.Add(ownerMembership);
        await _context.SaveChangesAsync();

        TempData["Success"] = $"Group '{group.Name}' created successfully!";
        return RedirectToAction(nameof(Details), new { id = group.Id });
    }

    // POST: Groups/CreateFolder
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CreateFolder(int groupId, string folderName, int? parentFolderId)
    {
        if (string.IsNullOrWhiteSpace(folderName))
        {
            TempData["Error"] = "Folder name cannot be empty.";
            return RedirectToAction(nameof(Details), new { id = groupId, folderId = parentFolderId });
        }

        // Security: Validate folder name for invalid characters
        if (!IsValidFileName(folderName))
        {
            TempData["Error"] = "Folder name contains invalid characters.";
            return RedirectToAction(nameof(Details), new { id = groupId, folderId = parentFolderId });
        }

        var userId = User.GetUserId();
        if (!await CanUserUpload(groupId, userId))
        {
            TempData["Error"] = "You don't have permission to create folders in this group.";
            return RedirectToAction(nameof(Details), new { id = groupId, folderId = parentFolderId });
        }

        // Check for duplicate folder name
        var exists = await _context.GroupFiles
            .AnyAsync(f => f.GroupId == groupId &&
                          f.ParentFolderId == parentFolderId &&
                          f.IsFolder &&
                          f.FileName == folderName);

        if (exists)
        {
            TempData["Error"] = "A folder with this name already exists.";
            return RedirectToAction(nameof(Details), new { id = groupId, folderId = parentFolderId });
        }

        var folder = new GroupFile
        {
            GroupId = groupId,
            FileName = folderName,
            IsFolder = true,
            ParentFolderId = parentFolderId,
            UploadedById = userId!,
            UploadDate = DateTime.UtcNow,
            FileSize = 0,
            StoragePath = string.Empty,
            ContentType = "folder"
        };

        _context.GroupFiles.Add(folder);
        await _context.SaveChangesAsync();

        TempData["Success"] = $"Folder '{folderName}' created successfully.";
        return RedirectToAction(nameof(Details), new { id = groupId, folderId = parentFolderId });
    }

    // POST: Groups/UploadFile (single file with progress tracking)
    [HttpPost]
    public async Task<IActionResult> UploadFile(IFormFile file, int groupId, int? folderId)
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
        if (!await CanUserUpload(groupId, userId))
        {
            return Json(new { success = false, message = "You don't have permission to upload files to this group." });
        }

        var group = await _context.Groups.FindAsync(groupId);
        if (group == null)
        {
            return Json(new { success = false, message = "Group not found." });
        }

        try
        {
            // Check storage quota
            if (group.StorageQuotaBytes > 0 &&
                (group.StorageUsedBytes + file.Length) > group.StorageQuotaBytes)
            {
                return Json(new { success = false, message = "Storage quota exceeded." });
            }

            // Get upload directory from storage service
            var uploadPath = _storageService.GetGroupFilesPath(groupId);

            // Security: Sanitize filename
            var fileName = SanitizeFileName(file.FileName);
            var uniqueFileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid():N}_{fileName}";
            var filePath = Path.Combine(uploadPath, uniqueFileName);

            // Security: Verify the path is within the expected directory
            var fullPath = Path.GetFullPath(filePath);
            var expectedDirectory = Path.GetFullPath(uploadPath);
            if (!fullPath.StartsWith(expectedDirectory, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Path traversal attempt detected for file: {FileName} in group: {GroupId}", file.FileName, groupId);
                return Json(new { success = false, message = "Invalid file path." });
            }

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Security: Determine safe content type
            var safeContentType = GetSafeContentType(fileName);

            var groupFile = new GroupFile
            {
                GroupId = groupId,
                FileName = fileName,
                StoragePath = filePath,
                FileSize = file.Length,
                ContentType = safeContentType,
                UploadDate = DateTime.UtcNow,
                UploadedById = userId!,
                IsFolder = false,
                ParentFolderId = folderId
            };

            _context.GroupFiles.Add(groupFile);

            // Update group storage usage
            group.StorageUsedBytes += file.Length;
            await _context.SaveChangesAsync();

            return Json(new { success = true, message = "File uploaded successfully." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading file: {FileName}", file.FileName);
            return Json(new { success = false, message = "An error occurred while uploading the file." });
        }
    }

    // POST: Groups/Upload
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Upload(int groupId, List<IFormFile> files, int? currentFolderId)
    {
        if (files == null || files.Count == 0)
        {
            TempData["Error"] = "No files selected for upload.";
            return RedirectToAction(nameof(Details), new { id = groupId, folderId = currentFolderId });
        }

        var userId = User.GetUserId();
        if (!await CanUserUpload(groupId, userId))
        {
            TempData["Error"] = "You don't have permission to upload files to this group.";
            return RedirectToAction(nameof(Details), new { id = groupId, folderId = currentFolderId });
        }

        var group = await _context.Groups.FindAsync(groupId);
        if (group == null)
        {
            return NotFound();
        }

        // Get upload directory from storage service
        var uploadPath = _storageService.GetGroupFilesPath(groupId);

        var uploadedCount = 0;
        long totalSize = 0;
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
                    // Check storage quota
                    if (group.StorageQuotaBytes > 0 &&
                        (group.StorageUsedBytes + totalSize + file.Length) > group.StorageQuotaBytes)
                    {
                        TempData["Warning"] = "Storage quota exceeded. Some files were not uploaded.";
                        break;
                    }

                    // Security: Sanitize filename
                    var fileName = SanitizeFileName(file.FileName);
                    var uniqueFileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid():N}_{fileName}";
                    var filePath = Path.Combine(uploadPath, uniqueFileName);

                    // Security: Verify the path is within the expected directory
                    var fullPath = Path.GetFullPath(filePath);
                    var expectedDirectory = Path.GetFullPath(uploadPath);
                    if (!fullPath.StartsWith(expectedDirectory, StringComparison.OrdinalIgnoreCase))
                    {
                        _logger.LogWarning("Path traversal attempt detected for file: {FileName} in group: {GroupId}", file.FileName, groupId);
                        skippedFiles.Add($"{file.FileName} (invalid path)");
                        continue;
                    }

                    using (var stream = new FileStream(filePath, FileMode.Create))
                    {
                        await file.CopyToAsync(stream);
                    }

                    // Security: Determine safe content type
                    var safeContentType = GetSafeContentType(fileName);

                    var groupFile = new GroupFile
                    {
                        GroupId = groupId,
                        FileName = fileName,
                        StoragePath = filePath,
                        FileSize = file.Length,
                        ContentType = safeContentType,
                        UploadDate = DateTime.UtcNow,
                        UploadedById = userId!,
                        IsFolder = false,
                        ParentFolderId = currentFolderId
                    };

                    _context.GroupFiles.Add(groupFile);
                    totalSize += file.Length;
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

        // Update group storage usage
        group.StorageUsedBytes += totalSize;
        await _context.SaveChangesAsync();

        if (uploadedCount > 0)
        {
            TempData["Success"] = $"Successfully uploaded {uploadedCount} file(s).";
        }
        else
        {
            TempData["Error"] = "Failed to upload files.";
        }

        return RedirectToAction(nameof(Details), new { id = groupId, folderId = currentFolderId });
    }

    // GET: Groups/Download/5
    public async Task<IActionResult> Download(int id)
    {
        var userId = User.GetUserId();
        var file = await _context.GroupFiles
            .Include(f => f.Group)
            .FirstOrDefaultAsync(f => f.Id == id);

        if (file == null || file.IsFolder)
        {
            return NotFound();
        }

        if (!await CanUserDownload(file.GroupId, userId))
        {
            TempData["Error"] = "You don't have permission to download files from this group.";
            return RedirectToAction(nameof(Details), new { id = file.GroupId });
        }

        // Security: Validate that the file path is within the expected group directory
        var expectedDirectory = Path.GetFullPath(_storageService.GetGroupFilesPath(file.GroupId));
        var actualFilePath = Path.GetFullPath(file.StoragePath);
        if (!actualFilePath.StartsWith(expectedDirectory, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Path traversal attempt detected during download. User: {UserId}, GroupId: {GroupId}, Path: {Path}", userId, file.GroupId, file.StoragePath);
            return Forbid();
        }

        if (!System.IO.File.Exists(file.StoragePath))
        {
            TempData["Error"] = "File not found on disk.";
            return RedirectToAction(nameof(Details), new { id = file.GroupId, folderId = file.ParentFolderId });
        }

        // Security: Use FileStream directly instead of loading entire file into memory
        var stream = new FileStream(file.StoragePath, FileMode.Open, FileAccess.Read, System.IO.FileShare.Read);

        // Security: Force download with Content-Disposition attachment header
        var safeFileName = SanitizeFileName(file.FileName);
        return File(stream, "application/octet-stream", safeFileName);
    }

    // POST: Groups/DeleteFile
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteFile(int id)
    {
        var userId = User.GetUserId();
        var file = await _context.GroupFiles
            .Include(f => f.Group)
            .Include(f => f.Children)
            .FirstOrDefaultAsync(f => f.Id == id);

        if (file == null)
        {
            return NotFound();
        }

        if (!await CanUserDelete(file.GroupId, userId))
        {
            TempData["Error"] = "You don't have permission to delete files from this group.";
            return RedirectToAction(nameof(Details), new { id = file.GroupId });
        }

        var groupId = file.GroupId;
        var parentFolderId = file.ParentFolderId;
        long deletedSize = 0;

        if (file.IsFolder)
        {
            deletedSize = await DeleteFolderRecursive(file);
        }
        else
        {
            if (System.IO.File.Exists(file.StoragePath))
            {
                try
                {
                    System.IO.File.Delete(file.StoragePath);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error deleting file from disk: {FilePath}", file.StoragePath);
                }
            }

            deletedSize = file.FileSize;
            _context.GroupFiles.Remove(file);
        }

        // Update group storage usage
        var group = await _context.Groups.FindAsync(groupId);
        if (group != null)
        {
            group.StorageUsedBytes -= deletedSize;
        }

        await _context.SaveChangesAsync();

        TempData["Success"] = $"'{file.FileName}' deleted successfully.";
        return RedirectToAction(nameof(Details), new { id = groupId, folderId = parentFolderId });
    }

    // Helper methods
    private async Task<bool> CanUserUpload(int groupId, string? userId)
    {
        if (userId == null) return false;

        var group = await _context.Groups.FindAsync(groupId);
        if (group == null) return false;

        if (group.OwnerId == userId) return true;

        var member = await _context.GroupMembers
            .FirstOrDefaultAsync(m => m.GroupId == groupId && m.UserId == userId);

        return member != null && member.CanUpload;
    }

    private async Task<bool> CanUserDownload(int groupId, string? userId)
    {
        if (userId == null) return false;

        var group = await _context.Groups.FindAsync(groupId);
        if (group == null) return false;

        if (group.OwnerId == userId) return true;

        var member = await _context.GroupMembers
            .FirstOrDefaultAsync(m => m.GroupId == groupId && m.UserId == userId);

        return member != null && member.CanDownload;
    }

    private async Task<bool> CanUserDelete(int groupId, string? userId)
    {
        if (userId == null) return false;

        var group = await _context.Groups.FindAsync(groupId);
        if (group == null) return false;

        if (group.OwnerId == userId) return true;

        var member = await _context.GroupMembers
            .FirstOrDefaultAsync(m => m.GroupId == groupId && m.UserId == userId);

        return member != null && member.CanDelete;
    }

    private async Task<long> DeleteFolderRecursive(GroupFile folder)
    {
        long totalSize = 0;

        var children = await _context.GroupFiles
            .Where(f => f.ParentFolderId == folder.Id)
            .Include(f => f.Children)
            .ToListAsync();

        foreach (var child in children)
        {
            if (child.IsFolder)
            {
                totalSize += await DeleteFolderRecursive(child);
            }
            else
            {
                if (System.IO.File.Exists(child.StoragePath))
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
                totalSize += child.FileSize;
                _context.GroupFiles.Remove(child);
            }
        }

        _context.GroupFiles.Remove(folder);
        return totalSize;
    }

    private async Task<List<(int? Id, string Name)>> GetGroupBreadcrumbPath(int groupId, int? folderId)
    {
        var breadcrumbs = new List<(int? Id, string Name)>();
        breadcrumbs.Add((null, "Group Root"));

        if (folderId == null)
        {
            return breadcrumbs;
        }

        var currentFolder = await _context.GroupFiles
            .FirstOrDefaultAsync(f => f.Id == folderId && f.GroupId == groupId && f.IsFolder);

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
                current = await _context.GroupFiles
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

    // Member Management Actions

    // GET: Groups/GetMembers/5
    [HttpGet]
    public async Task<IActionResult> GetMembers(int id)
    {
        var userId = User.GetUserId();
        var group = await _context.Groups
            .Include(g => g.Members)
            .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(g => g.Id == id);

        if (group == null)
        {
            return NotFound();
        }

        // Check if user has access
        var member = group.Members.FirstOrDefault(m => m.UserId == userId);
        if (group.OwnerId != userId && member == null)
        {
            return Forbid();
        }

        var members = group.Members.Select(m => new
        {
            id = m.Id,
            userId = m.User?.Id,
            userName = m.User?.Email,
            fullName = m.User?.FirstName + " " + m.User?.LastName,
            email = m.User?.Email,
            role = m.Role.ToString(),
            roleValue = (int)m.Role,
            joinedDate = m.JoinedDate,
            canUpload = m.CanUpload,
            canDownload = m.CanDownload,
            canDelete = m.CanDelete,
            canManageMembers = m.CanManageMembers,
            isOwner = m.UserId == group.OwnerId
        }).ToList();

        return Json(members);
    }

    // POST: Groups/AddMember
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> AddMember(int groupId, string userId, int role, bool canUpload, bool canDownload, bool canDelete, bool canManageMembers)
    {
        var currentUserId = User.GetUserId();
        var group = await _context.Groups
            .Include(g => g.Members)
            .FirstOrDefaultAsync(g => g.Id == groupId);

        if (group == null)
        {
            return Json(new { success = false, message = "Group not found." });
        }

        // Check if current user can manage members
        if (!await CanUserManageMembers(groupId, currentUserId))
        {
            return Json(new { success = false, message = "You don't have permission to manage members." });
        }

        // Check if user is already a member
        var existingMember = await _context.GroupMembers
            .FirstOrDefaultAsync(m => m.GroupId == groupId && m.UserId == userId);

        if (existingMember != null)
        {
            return Json(new { success = false, message = "User is already a member of this group." });
        }

        var newMember = new GroupMember
        {
            GroupId = groupId,
            UserId = userId,
            Role = (GroupRole)role,
            CanUpload = canUpload,
            CanDownload = canDownload,
            CanDelete = canDelete,
            CanManageMembers = canManageMembers,
            JoinedDate = DateTime.UtcNow
        };

        _context.GroupMembers.Add(newMember);
        await _context.SaveChangesAsync();

        return Json(new { success = true, message = "Member added successfully." });
    }

    // POST: Groups/UpdateMember
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateMember(int memberId, int role, bool canUpload, bool canDownload, bool canDelete, bool canManageMembers)
    {
        var currentUserId = User.GetUserId();
        var member = await _context.GroupMembers
            .Include(m => m.Group)
            .FirstOrDefaultAsync(m => m.Id == memberId);

        if (member == null)
        {
            return Json(new { success = false, message = "Member not found." });
        }

        // Check if current user can manage members
        if (!await CanUserManageMembers(member.GroupId, currentUserId))
        {
            return Json(new { success = false, message = "You don't have permission to manage members." });
        }

        // Prevent changing owner's permissions
        if (member.UserId == member.Group?.OwnerId)
        {
            return Json(new { success = false, message = "Cannot modify owner's permissions." });
        }

        member.Role = (GroupRole)role;
        member.CanUpload = canUpload;
        member.CanDownload = canDownload;
        member.CanDelete = canDelete;
        member.CanManageMembers = canManageMembers;

        await _context.SaveChangesAsync();

        return Json(new { success = true, message = "Member permissions updated successfully." });
    }

    // POST: Groups/RemoveMember
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> RemoveMember(int memberId)
    {
        var currentUserId = User.GetUserId();
        var member = await _context.GroupMembers
            .Include(m => m.Group)
            .FirstOrDefaultAsync(m => m.Id == memberId);

        if (member == null)
        {
            return Json(new { success = false, message = "Member not found." });
        }

        // Check if current user can manage members
        if (!await CanUserManageMembers(member.GroupId, currentUserId))
        {
            return Json(new { success = false, message = "You don't have permission to manage members." });
        }

        // Prevent removing owner
        if (member.UserId == member.Group?.OwnerId)
        {
            return Json(new { success = false, message = "Cannot remove the group owner." });
        }

        _context.GroupMembers.Remove(member);
        await _context.SaveChangesAsync();

        return Json(new { success = true, message = "Member removed successfully." });
    }

    // GET: Groups/SearchUsers
    [HttpGet]
    public async Task<IActionResult> SearchUsers(string query, int groupId)
    {
        if (string.IsNullOrWhiteSpace(query) || query.Length < 2)
        {
            return Json(new List<object>());
        }

        var currentUserId = User.GetUserId();

        // Check if user has access to this group
        var group = await _context.Groups
            .Include(g => g.Members)
            .FirstOrDefaultAsync(g => g.Id == groupId);

        if (group == null)
        {
            return Json(new List<object>());
        }

        var member = group.Members.FirstOrDefault(m => m.UserId == currentUserId);
        if (group.OwnerId != currentUserId && member == null)
        {
            return Forbid();
        }

        // Get current member IDs
        var memberIds = group.Members.Select(m => m.UserId).ToList();

        // Search for users not already in the group
        var users = await _context.Users
            .Where(u => !memberIds.Contains(u.Id) &&
                       u.IsActive &&
                       (u.Email!.Contains(query) ||
                        u.FirstName!.Contains(query) ||
                        u.LastName!.Contains(query)))
            .Take(10)
            .Select(u => new
            {
                id = u.Id,
                userName = u.Email,
                email = u.Email,
                fullName = u.FirstName + " " + u.LastName
            })
            .ToListAsync();

        return Json(users);
    }

    private async Task<bool> CanUserManageMembers(int groupId, string? userId)
    {
        if (userId == null) return false;

        var group = await _context.Groups.FindAsync(groupId);
        if (group == null) return false;

        if (group.OwnerId == userId) return true;

        var member = await _context.GroupMembers
            .FirstOrDefaultAsync(m => m.GroupId == groupId && m.UserId == userId);

        return member != null && member.CanManageMembers;
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
