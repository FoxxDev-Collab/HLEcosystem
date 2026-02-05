using HLE.FamilyHub.Data;
using HLE.FamilyHub.Models.Entities;
using HLE.FamilyHub.Models.Enums;
using HLE.FamilyHub.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HLE.FamilyHub.Services;

/// <summary>
/// Implementation of important date management service with next occurrence calculation.
/// </summary>
public class ImportantDateService(
    ApplicationDbContext context,
    ILogger<ImportantDateService> logger) : IImportantDateService
{
    /// <inheritdoc/>
    public async Task<List<ImportantDateSummaryDto>> GetAllDatesAsync(int householdId, CancellationToken ct = default)
    {
        var dates = await context.ImportantDates
            .AsNoTracking()
            .Include(d => d.FamilyMember)
            .Where(d => d.HouseholdId == householdId)
            .ToListAsync(ct);

        return dates
            .Select(MapToSummaryDto)
            .OrderBy(d => d.NextOccurrence)
            .ToList();
    }

    /// <inheritdoc/>
    public async Task<List<ImportantDateSummaryDto>> GetUpcomingDatesAsync(int householdId, int daysAhead = 30, CancellationToken ct = default)
    {
        var dates = await context.ImportantDates
            .AsNoTracking()
            .Include(d => d.FamilyMember)
            .Where(d => d.HouseholdId == householdId)
            .ToListAsync(ct);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var cutoffDate = today.AddDays(daysAhead);

        return dates
            .Select(MapToSummaryDto)
            .Where(d => d.NextOccurrence <= cutoffDate)
            .OrderBy(d => d.NextOccurrence)
            .ToList();
    }

    /// <inheritdoc/>
    public async Task<ImportantDate?> GetDateAsync(int id, int householdId, CancellationToken ct = default)
    {
        return await context.ImportantDates
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == id && d.HouseholdId == householdId, ct);
    }

    /// <inheritdoc/>
    public async Task<ImportantDate> CreateDateAsync(
        int householdId,
        int? familyMemberId,
        string label,
        DateOnly date,
        ImportantDateType type,
        RecurrenceType recurrence,
        int reminderDays,
        string? notes,
        CancellationToken ct = default)
    {
        var importantDate = new ImportantDate
        {
            HouseholdId = householdId,
            FamilyMemberId = familyMemberId,
            Label = label,
            Date = date,
            Type = type,
            RecurrenceType = recurrence,
            ReminderDaysBefore = reminderDays,
            Notes = notes,
            CreatedAt = DateTime.UtcNow
        };

        context.ImportantDates.Add(importantDate);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Created important date {ImportantDateId} in household {HouseholdId}", importantDate.Id, householdId);

        return importantDate;
    }

    /// <inheritdoc/>
    public async Task UpdateDateAsync(
        int id,
        int householdId,
        int? familyMemberId,
        string label,
        DateOnly date,
        ImportantDateType type,
        RecurrenceType recurrence,
        int reminderDays,
        string? notes,
        CancellationToken ct = default)
    {
        var importantDate = await context.ImportantDates
            .FirstOrDefaultAsync(d => d.Id == id && d.HouseholdId == householdId, ct);

        if (importantDate == null)
        {
            throw new InvalidOperationException($"Important date {id} not found in household {householdId}.");
        }

        importantDate.FamilyMemberId = familyMemberId;
        importantDate.Label = label;
        importantDate.Date = date;
        importantDate.Type = type;
        importantDate.RecurrenceType = recurrence;
        importantDate.ReminderDaysBefore = reminderDays;
        importantDate.Notes = notes;

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Updated important date {ImportantDateId} in household {HouseholdId}", id, householdId);
    }

    /// <inheritdoc/>
    public async Task DeleteDateAsync(int id, int householdId, CancellationToken ct = default)
    {
        var importantDate = await context.ImportantDates
            .FirstOrDefaultAsync(d => d.Id == id && d.HouseholdId == householdId, ct);

        if (importantDate == null)
        {
            throw new InvalidOperationException($"Important date {id} not found in household {householdId}.");
        }

        context.ImportantDates.Remove(importantDate);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Deleted important date {ImportantDateId} from household {HouseholdId}", id, householdId);
    }

    /// <inheritdoc/>
    public async Task<List<ImportantDateSummaryDto>> GetDatesForMemberAsync(int familyMemberId, int householdId, CancellationToken ct = default)
    {
        var dates = await context.ImportantDates
            .AsNoTracking()
            .Include(d => d.FamilyMember)
            .Where(d => d.HouseholdId == householdId && d.FamilyMemberId == familyMemberId)
            .ToListAsync(ct);

        return dates
            .Select(MapToSummaryDto)
            .OrderBy(d => d.NextOccurrence)
            .ToList();
    }

    /// <inheritdoc/>
    public async Task<List<ImportantDateSummaryDto>> GetDatesByMonthAsync(int householdId, int year, int month, CancellationToken ct = default)
    {
        var dates = await context.ImportantDates
            .AsNoTracking()
            .Include(d => d.FamilyMember)
            .Where(d => d.HouseholdId == householdId)
            .ToListAsync(ct);

        return dates
            .Select(MapToSummaryDto)
            .Where(d => d.NextOccurrence.Year == year && d.NextOccurrence.Month == month)
            .OrderBy(d => d.NextOccurrence)
            .ToList();
    }

    /// <summary>
    /// Maps an ImportantDate entity to a summary DTO with calculated next occurrence.
    /// </summary>
    private static ImportantDateSummaryDto MapToSummaryDto(ImportantDate date)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        DateOnly nextOccurrence;
        int daysUntil;

        if (date.RecurrenceType == RecurrenceType.Once)
        {
            nextOccurrence = date.Date;
            daysUntil = nextOccurrence.DayNumber - today.DayNumber;
        }
        else // Annual
        {
            // Handle February 29 for non-leap years
            var day = Math.Min(date.Date.Day, DateTime.DaysInMonth(today.Year, date.Date.Month));
            var thisYearDate = new DateOnly(today.Year, date.Date.Month, day);

            if (thisYearDate >= today)
            {
                nextOccurrence = thisYearDate;
            }
            else
            {
                // Move to next year
                var nextYear = today.Year + 1;
                day = Math.Min(date.Date.Day, DateTime.DaysInMonth(nextYear, date.Date.Month));
                nextOccurrence = new DateOnly(nextYear, date.Date.Month, day);
            }

            daysUntil = nextOccurrence.DayNumber - today.DayNumber;
        }

        return new ImportantDateSummaryDto(
            date.Id,
            date.Label,
            date.Date,
            date.Type,
            date.RecurrenceType,
            date.ReminderDaysBefore,
            date.FamilyMemberId,
            date.FamilyMember != null ? $"{date.FamilyMember.FirstName} {date.FamilyMember.LastName}" : null,
            daysUntil,
            nextOccurrence
        );
    }
}
