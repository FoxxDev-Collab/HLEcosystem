using HLE.FileServer.Data;
using HLE.FileServer.Extensions;
using HLE.FileServer.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HLE.FileServer.Controllers;

[Authorize]
public class SharesController : Controller
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<SharesController> _logger;

    public SharesController(
        ApplicationDbContext context,
        ILogger<SharesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<IActionResult> Index()
    {
        var userId = User.GetUserId();

        // Get items shared with current user
        var sharedWithMe = await _context.FileShares
            .Include(s => s.FileEntry)
            .Include(s => s.Owner)
            .Where(s => s.SharedWithUserId == userId)
            .OrderByDescending(s => s.SharedDate)
            .ToListAsync();

        // Get items current user has shared with others
        var sharedByMe = await _context.FileShares
            .Include(s => s.FileEntry)
            .Include(s => s.SharedWithUser)
            .Where(s => s.OwnerId == userId)
            .OrderByDescending(s => s.SharedDate)
            .ToListAsync();

        ViewBag.SharedWithMe = sharedWithMe;
        ViewBag.SharedByMe = sharedByMe;

        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Share(int fileEntryId, string sharedWithUserId, SharePermission permission)
    {
        var userId = User.GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        // Verify the file/folder exists and belongs to the user
        var fileEntry = await _context.FileEntries
            .FirstOrDefaultAsync(f => f.Id == fileEntryId && f.UserId == userId);

        if (fileEntry == null)
        {
            TempData["Error"] = "File or folder not found.";
            return RedirectToAction("Index", "Files");
        }

        // Verify the target user exists
        var targetUser = await _context.Users.FindAsync(sharedWithUserId);
        if (targetUser == null)
        {
            TempData["Error"] = "User not found.";
            return RedirectToAction("Index", "Files");
        }

        // Prevent sharing with yourself
        if (sharedWithUserId == userId)
        {
            TempData["Error"] = "You cannot share with yourself.";
            return RedirectToAction("Index", "Files");
        }

        // Check if already shared
        var existingShare = await _context.FileShares
            .FirstOrDefaultAsync(s => s.FileEntryId == fileEntryId && s.SharedWithUserId == sharedWithUserId);

        if (existingShare != null)
        {
            // Update permission if already shared
            existingShare.Permission = permission;
            await _context.SaveChangesAsync();
            TempData["Success"] = $"Updated sharing permissions for '{fileEntry.FileName}' with {targetUser.Email}.";
        }
        else
        {
            // Create new share
            var share = new Models.FileShare
            {
                FileEntryId = fileEntryId,
                OwnerId = userId,
                SharedWithUserId = sharedWithUserId,
                Permission = permission,
                SharedDate = DateTime.UtcNow
            };

            _context.FileShares.Add(share);
            await _context.SaveChangesAsync();
            TempData["Success"] = $"'{fileEntry.FileName}' shared successfully with {targetUser.Email}.";
        }

        return RedirectToAction("Index", "Files", new { folderId = fileEntry.ParentFolderId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Unshare(int shareId, string returnUrl = "Shares")
    {
        var userId = User.GetUserId();
        var share = await _context.FileShares
            .Include(s => s.FileEntry)
            .FirstOrDefaultAsync(s => s.Id == shareId && (s.OwnerId == userId || s.SharedWithUserId == userId));

        if (share == null)
        {
            TempData["Error"] = "Share not found.";
            return RedirectToAction(nameof(Index));
        }

        var fileName = share.FileEntry?.FileName ?? "Unknown";
        _context.FileShares.Remove(share);
        await _context.SaveChangesAsync();

        TempData["Success"] = $"Sharing for '{fileName}' has been removed.";

        if (returnUrl == "Files")
        {
            return RedirectToAction("Index", "Files", new { folderId = share.FileEntry?.ParentFolderId });
        }

        return RedirectToAction(nameof(Index));
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers(string query)
    {
        var userId = User.GetUserId();

        var users = await _context.Users
            .Where(u => u.Id != userId &&
                       u.IsActive &&
                       (u.Email!.Contains(query) ||
                        (u.FirstName + " " + u.LastName).Contains(query)))
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

    public async Task<IActionResult> Browse(int shareId)
    {
        var userId = User.GetUserId();
        var share = await _context.FileShares
            .Include(s => s.FileEntry)
            .ThenInclude(f => f!.Children)
            .FirstOrDefaultAsync(s => s.Id == shareId && s.SharedWithUserId == userId);

        if (share == null || share.FileEntry == null)
        {
            TempData["Error"] = "Shared folder not found.";
            return RedirectToAction(nameof(Index));
        }

        if (!share.FileEntry.IsFolder)
        {
            TempData["Error"] = "This is not a folder.";
            return RedirectToAction(nameof(Index));
        }

        // Get contents of the shared folder
        var entries = await _context.FileEntries
            .Where(f => f.ParentFolderId == share.FileEntry.Id)
            .OrderByDescending(f => f.IsFolder)
            .ThenBy(f => f.FileName)
            .ToListAsync();

        ViewBag.Share = share;
        ViewBag.Folder = share.FileEntry;

        return View(entries);
    }
}
