using HLE.AssetTracker.Data;
using HLE.AssetTracker.Models.Entities;
using HLE.AssetTracker.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HLE.AssetTracker.Services;

public class MaintenanceService(
    ApplicationDbContext context,
    ILogger<MaintenanceService> logger) : IMaintenanceService
{
    public async Task<List<MaintenanceScheduleDto>> GetSchedulesForAssetAsync(
        int assetId,
        int householdId,
        CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        return await context.MaintenanceSchedules
            .AsNoTracking()
            .Include(s => s.Asset)
            .Where(s => s.AssetId == assetId && s.Asset.HouseholdId == householdId)
            .OrderBy(s => s.NextDueDate)
            .Select(s => new MaintenanceScheduleDto(
                s.Id,
                s.AssetId,
                s.Asset.Name,
                s.Name,
                s.Description,
                s.IntervalDays,
                s.NextDueDate,
                s.IsRecurring,
                s.NotifyDaysBefore,
                s.IsActive,
                s.CreatedAt,
                s.NextDueDate.DayNumber - today.DayNumber,
                s.NextDueDate < today
            ))
            .ToListAsync(ct);
    }

    public async Task<List<MaintenanceScheduleDto>> GetUpcomingMaintenanceAsync(
        int householdId,
        int daysAhead,
        CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var futureDate = today.AddDays(daysAhead);

        return await context.MaintenanceSchedules
            .AsNoTracking()
            .Include(s => s.Asset)
            .Where(s => s.Asset.HouseholdId == householdId
                && s.IsActive
                && s.NextDueDate >= today
                && s.NextDueDate <= futureDate)
            .OrderBy(s => s.NextDueDate)
            .Select(s => new MaintenanceScheduleDto(
                s.Id,
                s.AssetId,
                s.Asset.Name,
                s.Name,
                s.Description,
                s.IntervalDays,
                s.NextDueDate,
                s.IsRecurring,
                s.NotifyDaysBefore,
                s.IsActive,
                s.CreatedAt,
                s.NextDueDate.DayNumber - today.DayNumber,
                false
            ))
            .ToListAsync(ct);
    }

    public async Task<List<MaintenanceScheduleDto>> GetOverdueMaintenanceAsync(
        int householdId,
        CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        return await context.MaintenanceSchedules
            .AsNoTracking()
            .Include(s => s.Asset)
            .Where(s => s.Asset.HouseholdId == householdId
                && s.IsActive
                && s.NextDueDate < today)
            .OrderBy(s => s.NextDueDate)
            .Select(s => new MaintenanceScheduleDto(
                s.Id,
                s.AssetId,
                s.Asset.Name,
                s.Name,
                s.Description,
                s.IntervalDays,
                s.NextDueDate,
                s.IsRecurring,
                s.NotifyDaysBefore,
                s.IsActive,
                s.CreatedAt,
                s.NextDueDate.DayNumber - today.DayNumber,
                true
            ))
            .ToListAsync(ct);
    }

    public async Task<List<MaintenanceScheduleDto>> GetDueTodayAsync(
        int householdId,
        CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        return await context.MaintenanceSchedules
            .AsNoTracking()
            .Include(s => s.Asset)
            .Where(s => s.Asset.HouseholdId == householdId
                && s.IsActive
                && s.NextDueDate == today)
            .OrderBy(s => s.Name)
            .Select(s => new MaintenanceScheduleDto(
                s.Id,
                s.AssetId,
                s.Asset.Name,
                s.Name,
                s.Description,
                s.IntervalDays,
                s.NextDueDate,
                s.IsRecurring,
                s.NotifyDaysBefore,
                s.IsActive,
                s.CreatedAt,
                0,
                false
            ))
            .ToListAsync(ct);
    }

    public async Task<MaintenanceSchedule?> GetScheduleAsync(
        int id,
        int householdId,
        CancellationToken ct = default)
    {
        return await context.MaintenanceSchedules
            .Include(s => s.Asset)
            .FirstOrDefaultAsync(s => s.Id == id && s.Asset.HouseholdId == householdId, ct);
    }

    public async Task<MaintenanceSchedule> CreateScheduleAsync(
        int assetId,
        int householdId,
        string name,
        string? description,
        int? intervalDays,
        DateOnly nextDueDate,
        bool isRecurring,
        int notifyDaysBefore,
        CancellationToken ct = default)
    {
        // Verify asset belongs to household
        var assetExists = await context.Assets
            .AnyAsync(a => a.Id == assetId && a.HouseholdId == householdId, ct);

        if (!assetExists)
        {
            throw new InvalidOperationException("Asset not found or access denied.");
        }

        // Validate recurring schedule has interval
        if (isRecurring && (!intervalDays.HasValue || intervalDays.Value <= 0))
        {
            throw new ArgumentException("Recurring schedules must have a positive interval in days.");
        }

        var schedule = new MaintenanceSchedule
        {
            AssetId = assetId,
            Name = name,
            Description = description,
            IntervalDays = isRecurring ? intervalDays : null,
            NextDueDate = nextDueDate,
            IsRecurring = isRecurring,
            NotifyDaysBefore = notifyDaysBefore,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        context.MaintenanceSchedules.Add(schedule);
        await context.SaveChangesAsync(ct);

        logger.LogInformation(
            "Created maintenance schedule {ScheduleId} '{Name}' for asset {AssetId}",
            schedule.Id, schedule.Name, assetId);

        return schedule;
    }

    public async Task UpdateScheduleAsync(
        int id,
        int householdId,
        string name,
        string? description,
        int? intervalDays,
        DateOnly nextDueDate,
        bool isRecurring,
        int notifyDaysBefore,
        bool isActive,
        CancellationToken ct = default)
    {
        var schedule = await GetScheduleAsync(id, householdId, ct);
        if (schedule == null)
        {
            throw new InvalidOperationException("Maintenance schedule not found or access denied.");
        }

        // Validate recurring schedule has interval
        if (isRecurring && (!intervalDays.HasValue || intervalDays.Value <= 0))
        {
            throw new ArgumentException("Recurring schedules must have a positive interval in days.");
        }

        schedule.Name = name;
        schedule.Description = description;
        schedule.IntervalDays = isRecurring ? intervalDays : null;
        schedule.NextDueDate = nextDueDate;
        schedule.IsRecurring = isRecurring;
        schedule.NotifyDaysBefore = notifyDaysBefore;
        schedule.IsActive = isActive;

        await context.SaveChangesAsync(ct);

        logger.LogInformation(
            "Updated maintenance schedule {ScheduleId} '{Name}'",
            schedule.Id, schedule.Name);
    }

    public async Task DeleteScheduleAsync(int id, int householdId, CancellationToken ct = default)
    {
        var schedule = await GetScheduleAsync(id, householdId, ct);
        if (schedule == null)
        {
            throw new InvalidOperationException("Maintenance schedule not found or access denied.");
        }

        context.MaintenanceSchedules.Remove(schedule);
        await context.SaveChangesAsync(ct);

        logger.LogInformation(
            "Deleted maintenance schedule {ScheduleId} '{Name}'",
            schedule.Id, schedule.Name);
    }

    public async Task<MaintenanceLog> CompleteScheduledMaintenanceAsync(
        int scheduleId,
        int householdId,
        string userId,
        DateOnly performedAt,
        string description,
        decimal? cost,
        string? notes,
        CancellationToken ct = default)
    {
        var schedule = await GetScheduleAsync(scheduleId, householdId, ct);
        if (schedule == null)
        {
            throw new InvalidOperationException("Maintenance schedule not found or access denied.");
        }

        // Create log entry
        var log = new MaintenanceLog
        {
            AssetId = schedule.AssetId,
            ScheduleId = scheduleId,
            PerformedAt = performedAt,
            Description = description,
            Cost = cost,
            Notes = notes,
            PerformedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        context.MaintenanceLogs.Add(log);

        // Advance next due date if recurring
        if (schedule.IsRecurring && schedule.IntervalDays.HasValue)
        {
            schedule.NextDueDate = performedAt.AddDays(schedule.IntervalDays.Value);
            logger.LogInformation(
                "Advanced schedule {ScheduleId} next due date to {NextDueDate}",
                scheduleId, schedule.NextDueDate);
        }
        else
        {
            // One-time schedule, mark as inactive
            schedule.IsActive = false;
            logger.LogInformation(
                "Completed one-time schedule {ScheduleId}, marked inactive",
                scheduleId);
        }

        await context.SaveChangesAsync(ct);

        logger.LogInformation(
            "Logged maintenance for schedule {ScheduleId} on asset {AssetId}",
            scheduleId, schedule.AssetId);

        return log;
    }

    public async Task<MaintenanceLog> LogMaintenanceAsync(
        int assetId,
        int householdId,
        string userId,
        DateOnly performedAt,
        string description,
        decimal? cost,
        string? notes,
        CancellationToken ct = default)
    {
        // Verify asset belongs to household
        var assetExists = await context.Assets
            .AnyAsync(a => a.Id == assetId && a.HouseholdId == householdId, ct);

        if (!assetExists)
        {
            throw new InvalidOperationException("Asset not found or access denied.");
        }

        var log = new MaintenanceLog
        {
            AssetId = assetId,
            ScheduleId = null,
            PerformedAt = performedAt,
            Description = description,
            Cost = cost,
            Notes = notes,
            PerformedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        context.MaintenanceLogs.Add(log);
        await context.SaveChangesAsync(ct);

        logger.LogInformation(
            "Logged ad-hoc maintenance for asset {AssetId}",
            assetId);

        return log;
    }

    public async Task<PagedResult<MaintenanceLogDto>> GetMaintenanceHistoryAsync(
        int householdId,
        int? assetId,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = context.MaintenanceLogs
            .AsNoTracking()
            .Include(l => l.Asset)
            .Include(l => l.Schedule)
            .Where(l => l.Asset.HouseholdId == householdId);

        if (assetId.HasValue)
        {
            query = query.Where(l => l.AssetId == assetId.Value);
        }

        var totalCount = await query.CountAsync(ct);

        var logs = await query
            .OrderByDescending(l => l.PerformedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new MaintenanceLogDto(
                l.Id,
                l.AssetId,
                l.Asset.Name,
                l.ScheduleId,
                l.Schedule != null ? l.Schedule.Name : null,
                l.PerformedAt,
                l.Description,
                l.Cost,
                l.Notes,
                l.PerformedByUserId,
                l.CreatedAt
            ))
            .ToListAsync(ct);

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        return new PagedResult<MaintenanceLogDto>(
            logs,
            totalCount,
            page,
            pageSize,
            totalPages
        );
    }

    public async Task<List<MaintenanceLogDto>> GetLogsForAssetAsync(
        int assetId,
        int householdId,
        int count,
        CancellationToken ct = default)
    {
        return await context.MaintenanceLogs
            .AsNoTracking()
            .Include(l => l.Asset)
            .Include(l => l.Schedule)
            .Where(l => l.AssetId == assetId && l.Asset.HouseholdId == householdId)
            .OrderByDescending(l => l.PerformedAt)
            .Take(count)
            .Select(l => new MaintenanceLogDto(
                l.Id,
                l.AssetId,
                l.Asset.Name,
                l.ScheduleId,
                l.Schedule != null ? l.Schedule.Name : null,
                l.PerformedAt,
                l.Description,
                l.Cost,
                l.Notes,
                l.PerformedByUserId,
                l.CreatedAt
            ))
            .ToListAsync(ct);
    }

    public async Task<MaintenanceDashboardDto> GetDashboardDataAsync(
        int householdId,
        CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var endOfWeek = today.AddDays(7);
        var endOfMonth = today.AddDays(30);

        var overdue = await GetOverdueMaintenanceAsync(householdId, ct);
        var dueToday = await GetDueTodayAsync(householdId, ct);
        var upcoming = await GetUpcomingMaintenanceAsync(householdId, 30, ct);

        var dueThisWeek = upcoming.Count(s => s.NextDueDate <= endOfWeek);
        var dueThisMonth = upcoming.Count;

        var recentLogs = await context.MaintenanceLogs
            .AsNoTracking()
            .Include(l => l.Asset)
            .Include(l => l.Schedule)
            .Where(l => l.Asset.HouseholdId == householdId)
            .OrderByDescending(l => l.PerformedAt)
            .Take(10)
            .Select(l => new MaintenanceLogDto(
                l.Id,
                l.AssetId,
                l.Asset.Name,
                l.ScheduleId,
                l.Schedule != null ? l.Schedule.Name : null,
                l.PerformedAt,
                l.Description,
                l.Cost,
                l.Notes,
                l.PerformedByUserId,
                l.CreatedAt
            ))
            .ToListAsync(ct);

        return new MaintenanceDashboardDto(
            overdue.Count,
            dueToday.Count,
            dueThisWeek,
            dueThisMonth,
            overdue.Take(10).ToList(),
            dueToday,
            upcoming.Take(10).ToList(),
            recentLogs
        );
    }
}
