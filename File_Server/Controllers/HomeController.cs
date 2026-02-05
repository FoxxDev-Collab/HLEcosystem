using System.Diagnostics;
using HLE.FileServer.Data;
using HLE.FileServer.Extensions;
using HLE.FileServer.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HLE.FileServer.Controllers;

public class HomeController : Controller
{
    private readonly ILogger<HomeController> _logger;
    private readonly ApplicationDbContext _context;

    public HomeController(
        ILogger<HomeController> logger,
        ApplicationDbContext context)
    {
        _logger = logger;
        _context = context;
    }

    public async Task<IActionResult> Index()
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            var userId = User.GetUserId();
            var user = await _context.Users.FindAsync(userId);
            if (user != null)
            {
                var model = await BuildDashboardViewModel(user);
                return View(model);
            }
        }
        return View(new DashboardViewModel());
    }

    private async Task<DashboardViewModel> BuildDashboardViewModel(ApplicationUser user)
    {
        var userId = user.Id;
        var sevenDaysAgo = DateTime.UtcNow.AddDays(-7);

        // Get all user's files (not folders)
        var userFiles = await _context.FileEntries
            .Where(f => f.UserId == userId && !f.IsFolder)
            .ToListAsync();

        // Calculate storage breakdown by content type
        var storageBreakdown = new StorageBreakdown();
        foreach (var file in userFiles)
        {
            if (file.ContentType.StartsWith("image/"))
            {
                storageBreakdown.ImagesBytes += file.FileSize;
                storageBreakdown.ImagesCount++;
            }
            else if (file.ContentType.StartsWith("video/"))
            {
                storageBreakdown.VideosBytes += file.FileSize;
                storageBreakdown.VideosCount++;
            }
            else if (file.ContentType.StartsWith("audio/"))
            {
                storageBreakdown.AudioBytes += file.FileSize;
                storageBreakdown.AudioCount++;
            }
            else if (file.ContentType.Contains("pdf") ||
                     file.ContentType.Contains("word") ||
                     file.ContentType.Contains("document") ||
                     file.ContentType.Contains("excel") ||
                     file.ContentType.Contains("spreadsheet") ||
                     file.ContentType.Contains("powerpoint") ||
                     file.ContentType.Contains("presentation") ||
                     file.ContentType.Contains("text"))
            {
                storageBreakdown.DocumentsBytes += file.FileSize;
                storageBreakdown.DocumentsCount++;
            }
            else
            {
                storageBreakdown.OtherBytes += file.FileSize;
                storageBreakdown.OtherCount++;
            }
        }

        // Get recent activity (last 10 files)
        var recentActivity = await _context.FileEntries
            .Where(f => f.UserId == userId)
            .OrderByDescending(f => f.UploadDate)
            .Take(10)
            .Select(f => new RecentActivityItem
            {
                Id = f.Id,
                FileName = f.FileName,
                UploadDate = f.UploadDate,
                FileSize = f.FileSize,
                IsFolder = f.IsFolder,
                ContentType = f.ContentType
            })
            .ToListAsync();

        return new DashboardViewModel
        {
            FirstName = user.FirstName,
            LastName = user.LastName,
            Email = user.Email,
            TotalFiles = userFiles.Count,
            TotalStorageBytes = userFiles.Sum(f => f.FileSize),
            RecentUploadsCount = userFiles.Count(f => f.UploadDate >= sevenDaysAgo),
            UniqueFileTypes = userFiles.Select(f => GetFileExtension(f.FileName)).Distinct().Count(),
            RecentActivity = recentActivity,
            StorageByType = storageBreakdown
        };
    }

    private string GetFileExtension(string fileName)
    {
        var ext = Path.GetExtension(fileName);
        return string.IsNullOrEmpty(ext) ? "file" : ext.TrimStart('.').ToLower();
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
