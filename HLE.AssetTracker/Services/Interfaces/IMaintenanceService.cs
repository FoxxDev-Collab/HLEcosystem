using HLE.AssetTracker.Models.Entities;

namespace HLE.AssetTracker.Services.Interfaces;

public record MaintenanceScheduleDto(
    int Id,
    int AssetId,
    string AssetName,
    string Name,
    string? Description,
    int? IntervalDays,
    DateOnly NextDueDate,
    bool IsRecurring,
    int NotifyDaysBefore,
    bool IsActive,
    DateTime CreatedAt,
    int DaysUntilDue,
    bool IsOverdue
);

public record MaintenanceLogDto(
    int Id,
    int AssetId,
    string AssetName,
    int? ScheduleId,
    string? ScheduleName,
    DateOnly PerformedAt,
    string Description,
    decimal? Cost,
    string? Notes,
    string PerformedByUserId,
    DateTime CreatedAt
);

public record MaintenanceDashboardDto(
    int OverdueCount,
    int DueTodayCount,
    int DueThisWeekCount,
    int DueThisMonthCount,
    List<MaintenanceScheduleDto> OverdueTasks,
    List<MaintenanceScheduleDto> DueTodayTasks,
    List<MaintenanceScheduleDto> UpcomingTasks,
    List<MaintenanceLogDto> RecentLogs
);

public record MaintenanceFilterDto(
    int HouseholdId,
    int? AssetId = null,
    bool IncludeInactive = false,
    int Page = 1,
    int PageSize = 20
);

public interface IMaintenanceService
{
    /// <summary>
    /// Gets all maintenance schedules for a specific asset
    /// </summary>
    Task<List<MaintenanceScheduleDto>> GetSchedulesForAssetAsync(int assetId, int householdId, CancellationToken ct = default);

    /// <summary>
    /// Gets all upcoming maintenance within the specified days
    /// </summary>
    Task<List<MaintenanceScheduleDto>> GetUpcomingMaintenanceAsync(int householdId, int daysAhead, CancellationToken ct = default);

    /// <summary>
    /// Gets all overdue maintenance tasks
    /// </summary>
    Task<List<MaintenanceScheduleDto>> GetOverdueMaintenanceAsync(int householdId, CancellationToken ct = default);

    /// <summary>
    /// Gets maintenance tasks due today
    /// </summary>
    Task<List<MaintenanceScheduleDto>> GetDueTodayAsync(int householdId, CancellationToken ct = default);

    /// <summary>
    /// Gets a single maintenance schedule by ID
    /// </summary>
    Task<MaintenanceSchedule?> GetScheduleAsync(int id, int householdId, CancellationToken ct = default);

    /// <summary>
    /// Creates a new maintenance schedule
    /// </summary>
    Task<MaintenanceSchedule> CreateScheduleAsync(
        int assetId,
        int householdId,
        string name,
        string? description,
        int? intervalDays,
        DateOnly nextDueDate,
        bool isRecurring,
        int notifyDaysBefore,
        CancellationToken ct = default);

    /// <summary>
    /// Updates an existing maintenance schedule
    /// </summary>
    Task UpdateScheduleAsync(
        int id,
        int householdId,
        string name,
        string? description,
        int? intervalDays,
        DateOnly nextDueDate,
        bool isRecurring,
        int notifyDaysBefore,
        bool isActive,
        CancellationToken ct = default);

    /// <summary>
    /// Deletes a maintenance schedule
    /// </summary>
    Task DeleteScheduleAsync(int id, int householdId, CancellationToken ct = default);

    /// <summary>
    /// Marks a scheduled maintenance as complete and advances the next due date
    /// </summary>
    Task<MaintenanceLog> CompleteScheduledMaintenanceAsync(
        int scheduleId,
        int householdId,
        string userId,
        DateOnly performedAt,
        string description,
        decimal? cost,
        string? notes,
        CancellationToken ct = default);

    /// <summary>
    /// Logs ad-hoc maintenance (not tied to a schedule)
    /// </summary>
    Task<MaintenanceLog> LogMaintenanceAsync(
        int assetId,
        int householdId,
        string userId,
        DateOnly performedAt,
        string description,
        decimal? cost,
        string? notes,
        CancellationToken ct = default);

    /// <summary>
    /// Gets paginated maintenance history
    /// </summary>
    Task<PagedResult<MaintenanceLogDto>> GetMaintenanceHistoryAsync(
        int householdId,
        int? assetId,
        int page,
        int pageSize,
        CancellationToken ct = default);

    /// <summary>
    /// Gets maintenance logs for a specific asset
    /// </summary>
    Task<List<MaintenanceLogDto>> GetLogsForAssetAsync(int assetId, int householdId, int count, CancellationToken ct = default);

    /// <summary>
    /// Gets dashboard data for the maintenance overview
    /// </summary>
    Task<MaintenanceDashboardDto> GetDashboardDataAsync(int householdId, CancellationToken ct = default);
}
