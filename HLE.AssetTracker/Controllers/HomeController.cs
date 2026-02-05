using System.Diagnostics;
using HLE.AssetTracker.Extensions;
using HLE.AssetTracker.Models;
using HLE.AssetTracker.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace HLE.AssetTracker.Controllers;

public class HomeController(
    ILogger<HomeController> logger,
    IAssetService assetService) : Controller
{
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        if (User.Identity?.IsAuthenticated != true)
        {
            return View("Landing");
        }

        var householdId = HttpContext.GetCurrentHouseholdId();
        var household = HttpContext.GetCurrentHousehold();
        var member = HttpContext.GetCurrentMember();

        // Get dashboard data
        var stats = await assetService.GetDashboardStatsAsync(householdId, ct);
        var recentAssets = await assetService.GetRecentAssetsAsync(householdId, 5, ct);
        var expiringWarranties = await assetService.GetExpiringWarrantiesAsync(householdId, 30, ct);

        ViewData["HouseholdName"] = household.Name;
        ViewData["UserName"] = member?.DisplayName ?? User.Identity?.Name ?? "User";
        ViewData["Stats"] = stats;
        ViewData["RecentAssets"] = recentAssets;
        ViewData["ExpiringWarranties"] = expiringWarranties;

        return View("Dashboard");
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
