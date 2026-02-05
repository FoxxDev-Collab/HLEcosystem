using HLE.FamilyHub.Models.Entities;
using HLE.FamilyHub.Models.Enums;

namespace HLE.FamilyHub.Services.Interfaces;

/// <summary>
/// Summary DTO for important date list views with calculated next occurrence.
/// </summary>
public record ImportantDateSummaryDto(
    int Id,
    string Label,
    DateOnly Date,
    ImportantDateType Type,
    RecurrenceType RecurrenceType,
    int ReminderDaysBefore,
    int? FamilyMemberId,
    string? FamilyMemberName,
    int DaysUntilNext,
    DateOnly NextOccurrence
);

/// <summary>
/// Service for managing important dates, anniversaries, and recurring events.
/// </summary>
public interface IImportantDateService
{
    /// <summary>
    /// Gets all important dates for a household.
    /// </summary>
    /// <param name="householdId">The household ID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>List of all important dates with next occurrence calculated.</returns>
    Task<List<ImportantDateSummaryDto>> GetAllDatesAsync(int householdId, CancellationToken ct = default);

    /// <summary>
    /// Gets important dates that occur within the specified number of days ahead.
    /// </summary>
    /// <param name="householdId">The household ID.</param>
    /// <param name="daysAhead">Number of days to look ahead (default 30).</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>List of upcoming important dates sorted by next occurrence.</returns>
    Task<List<ImportantDateSummaryDto>> GetUpcomingDatesAsync(int householdId, int daysAhead = 30, CancellationToken ct = default);

    /// <summary>
    /// Gets a specific important date by ID.
    /// </summary>
    /// <param name="id">The important date ID.</param>
    /// <param name="householdId">The household ID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The important date entity or null if not found.</returns>
    Task<ImportantDate?> GetDateAsync(int id, int householdId, CancellationToken ct = default);

    /// <summary>
    /// Creates a new important date.
    /// </summary>
    /// <param name="householdId">The household ID.</param>
    /// <param name="familyMemberId">Optional associated family member ID.</param>
    /// <param name="label">Display label for the date.</param>
    /// <param name="date">The date of the event.</param>
    /// <param name="type">Type of important date.</param>
    /// <param name="recurrence">Recurrence pattern.</param>
    /// <param name="reminderDays">Days before to send reminder.</param>
    /// <param name="notes">Additional notes.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The created important date entity.</returns>
    Task<ImportantDate> CreateDateAsync(
        int householdId,
        int? familyMemberId,
        string label,
        DateOnly date,
        ImportantDateType type,
        RecurrenceType recurrence,
        int reminderDays,
        string? notes,
        CancellationToken ct = default);

    /// <summary>
    /// Updates an existing important date.
    /// </summary>
    /// <param name="id">The important date ID.</param>
    /// <param name="householdId">The household ID.</param>
    /// <param name="familyMemberId">Optional associated family member ID.</param>
    /// <param name="label">Display label for the date.</param>
    /// <param name="date">The date of the event.</param>
    /// <param name="type">Type of important date.</param>
    /// <param name="recurrence">Recurrence pattern.</param>
    /// <param name="reminderDays">Days before to send reminder.</param>
    /// <param name="notes">Additional notes.</param>
    /// <param name="ct">Cancellation token.</param>
    Task UpdateDateAsync(
        int id,
        int householdId,
        int? familyMemberId,
        string label,
        DateOnly date,
        ImportantDateType type,
        RecurrenceType recurrence,
        int reminderDays,
        string? notes,
        CancellationToken ct = default);

    /// <summary>
    /// Deletes an important date.
    /// </summary>
    /// <param name="id">The important date ID.</param>
    /// <param name="householdId">The household ID.</param>
    /// <param name="ct">Cancellation token.</param>
    Task DeleteDateAsync(int id, int householdId, CancellationToken ct = default);

    /// <summary>
    /// Gets all important dates associated with a specific family member.
    /// </summary>
    /// <param name="familyMemberId">The family member ID.</param>
    /// <param name="householdId">The household ID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>List of important dates for the family member.</returns>
    Task<List<ImportantDateSummaryDto>> GetDatesForMemberAsync(int familyMemberId, int householdId, CancellationToken ct = default);

    /// <summary>
    /// Gets important dates that occur in a specific month.
    /// </summary>
    /// <param name="householdId">The household ID.</param>
    /// <param name="year">The year.</param>
    /// <param name="month">The month (1-12).</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>List of important dates in the specified month.</returns>
    Task<List<ImportantDateSummaryDto>> GetDatesByMonthAsync(int householdId, int year, int month, CancellationToken ct = default);
}
