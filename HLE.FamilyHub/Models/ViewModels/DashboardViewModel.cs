using HLE.FamilyHub.Services.Interfaces;

namespace HLE.FamilyHub.Models.ViewModels;

/// <summary>
/// View model for the dashboard page.
/// </summary>
public class DashboardViewModel
{
    /// <summary>
    /// Name of the household.
    /// </summary>
    public string HouseholdName { get; set; } = "";

    /// <summary>
    /// Name of the current user.
    /// </summary>
    public string UserName { get; set; } = "";

    /// <summary>
    /// Dashboard statistics.
    /// </summary>
    public DashboardStatsDto Stats { get; set; } = null!;

    /// <summary>
    /// Upcoming events within the selected time frame.
    /// </summary>
    public List<UpcomingEventDto> UpcomingEvents { get; set; } = [];

    /// <summary>
    /// Recent gift activity.
    /// </summary>
    public List<RecentGiftActivityDto> RecentGiftActivity { get; set; } = [];

    /// <summary>
    /// Number of days ahead to display (30, 60, or 90).
    /// </summary>
    public int DaysAhead { get; set; } = 30;
}
