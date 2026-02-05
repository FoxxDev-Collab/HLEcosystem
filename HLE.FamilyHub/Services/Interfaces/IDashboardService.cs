namespace HLE.FamilyHub.Services.Interfaces;

/// <summary>
/// Dashboard statistics summary.
/// </summary>
public record DashboardStatsDto(
    int TotalFamilyMembers,
    int UpcomingDatesCount,
    int ActiveGiftIdeas,
    decimal TotalGiftSpentThisYear
);

/// <summary>
/// Upcoming event for dashboard display.
/// </summary>
public record UpcomingEventDto(
    int ImportantDateId,
    string Label,
    DateOnly NextOccurrence,
    int DaysUntil,
    string? FamilyMemberName,
    string Type
);

/// <summary>
/// Recent gift activity item for dashboard feed.
/// </summary>
public record RecentGiftActivityDto(
    int Id,
    string Description,
    string FamilyMemberName,
    string Status,
    DateOnly? GiftDate,
    string EntityType
);

/// <summary>
/// Service for aggregating dashboard data from multiple sources.
/// </summary>
public interface IDashboardService
{
    /// <summary>
    /// Gets aggregated statistics for the dashboard overview.
    /// </summary>
    /// <param name="householdId">The household ID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Dashboard statistics.</returns>
    Task<DashboardStatsDto> GetDashboardStatsAsync(int householdId, CancellationToken ct = default);

    /// <summary>
    /// Gets upcoming events (important dates) for the dashboard.
    /// </summary>
    /// <param name="householdId">The household ID.</param>
    /// <param name="daysAhead">Number of days to look ahead (default 30).</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>List of upcoming events sorted by date.</returns>
    Task<List<UpcomingEventDto>> GetUpcomingEventsAsync(int householdId, int daysAhead = 30, CancellationToken ct = default);

    /// <summary>
    /// Gets recent gift and gift idea activity for the dashboard feed.
    /// </summary>
    /// <param name="householdId">The household ID.</param>
    /// <param name="count">Maximum number of items to return (default 10).</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>List of recent gift activities sorted by creation date.</returns>
    Task<List<RecentGiftActivityDto>> GetRecentGiftActivityAsync(int householdId, int count = 10, CancellationToken ct = default);
}
