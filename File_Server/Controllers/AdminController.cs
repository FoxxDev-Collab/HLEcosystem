using HLE.FileServer.Constants;
using HLE.FileServer.Data;
using HLE.FileServer.Models;
using HLE.FileServer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HLE.FileServer.Controllers;

[Authorize(Roles = Roles.Admin)]
public class AdminController : Controller
{
    private readonly IStorageService _storageService;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AdminController> _logger;

    public AdminController(
        IStorageService storageService,
        ApplicationDbContext context,
        ILogger<AdminController> logger)
    {
        _storageService = storageService;
        _context = context;
        _logger = logger;
    }

    public async Task<IActionResult> Index()
    {
        var userFilesPath = _storageService.GetUserFilesBasePath();
        var groupFilesPath = _storageService.GetGroupFilesBasePath();

        var userFilesStats = _storageService.GetStorageStats(userFilesPath);
        var groupFilesStats = _storageService.GetStorageStats(groupFilesPath);

        // Get user storage breakdown
        var userStorageStats = await _context.FileEntries
            .Where(f => !f.IsFolder)
            .GroupBy(f => f.UserId)
            .Select(g => new
            {
                UserId = g.Key,
                TotalBytes = g.Sum(f => f.FileSize),
                FileCount = g.Count()
            })
            .ToListAsync();

        var users = await _context.Users
            .Where(u => userStorageStats.Select(s => s.UserId).Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Email ?? "Unknown");

        var userBreakdown = userStorageStats.Select(s => new UserStorageInfo
        {
            UserId = s.UserId,
            Email = users.GetValueOrDefault(s.UserId, "Unknown") ?? "Unknown",
            TotalBytes = s.TotalBytes,
            FileCount = s.FileCount
        }).OrderByDescending(s => s.TotalBytes).ToList();

        // Get group storage breakdown
        var groupBreakdown = await _context.Groups
            .Select(g => new GroupStorageInfo
            {
                GroupId = g.Id,
                GroupName = g.Name,
                TotalBytes = g.StorageUsedBytes,
                QuotaBytes = g.StorageQuotaBytes,
                FileCount = _context.GroupFiles.Count(f => f.GroupId == g.Id && !f.IsFolder)
            })
            .OrderByDescending(g => g.TotalBytes)
            .ToListAsync();

        var model = new AdminDashboardViewModel
        {
            UserFilesPath = userFilesPath,
            GroupFilesPath = groupFilesPath,
            UserFilesStats = userFilesStats,
            GroupFilesStats = groupFilesStats,
            UserStorageBreakdown = userBreakdown,
            GroupStorageBreakdown = groupBreakdown,
            TotalUsers = await _context.Users.CountAsync(),
            TotalGroups = await _context.Groups.CountAsync()
        };

        return View(model);
    }
}
