using HLE.FamilyHub.Extensions;
using HLE.FamilyHub.Models.ViewModels;
using HLE.FamilyHub.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;

namespace HLE.FamilyHub.Controllers;

/// <summary>
/// Home controller handling landing page and dashboard.
/// </summary>
public class HomeController(IDashboardService dashboardService) : Controller
{
    /// <summary>
    /// Landing page or dashboard based on authentication status.
    /// </summary>
    /// <param name="days">Number of days ahead to show events (30, 60, or 90)</param>
    /// <param name="ct">Cancellation token</param>
    public async Task<IActionResult> Index(int? days, CancellationToken ct = default)
    {
        if (!User.Identity?.IsAuthenticated ?? true)
        {
            return View("Landing");
        }

        var household = HttpContext.GetCurrentHousehold();
        var member = HttpContext.GetCurrentMember();

        var daysAhead = days switch
        {
            60 => 60,
            90 => 90,
            _ => 30
        };

        var stats = await dashboardService.GetDashboardStatsAsync(household.Id, ct);
        var upcomingEvents = await dashboardService.GetUpcomingEventsAsync(household.Id, daysAhead, ct);
        var recentActivity = await dashboardService.GetRecentGiftActivityAsync(household.Id, 10, ct);

        var viewModel = new DashboardViewModel
        {
            HouseholdName = household.Name,
            UserName = member?.DisplayName ?? User.Identity?.Name ?? "User",
            Stats = stats,
            UpcomingEvents = upcomingEvents,
            RecentGiftActivity = recentActivity,
            DaysAhead = daysAhead
        };

        return View(viewModel);
    }

    /// <summary>
    /// Error page.
    /// </summary>
    /// <returns>Error view with request ID</returns>
    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}

/// <summary>
/// Error view model for displaying error information.
/// </summary>
public class ErrorViewModel
{
    public string? RequestId { get; set; }
    public bool ShowRequestId => !string.IsNullOrEmpty(RequestId);
}
