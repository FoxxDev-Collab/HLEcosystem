using HLE.FamilyHub.Models.Entities;
using HLE.FamilyHub.Models.Enums;

namespace HLE.FamilyHub.Services.Interfaces;

/// <summary>
/// Summary DTO for gift list views.
/// </summary>
public record GiftSummaryDto(
    int Id,
    string Description,
    DateOnly? GiftDate,
    string? Occasion,
    GiftStatus Status,
    decimal? ActualCost,
    int? Rating,
    int FamilyMemberId,
    string FamilyMemberName
);

/// <summary>
/// Detailed DTO for gift edit/detail views.
/// </summary>
public record GiftDetailDto(
    int Id,
    string Description,
    DateOnly? GiftDate,
    string? Occasion,
    GiftStatus Status,
    decimal? EstimatedCost,
    decimal? ActualCost,
    int? Rating,
    string? Notes,
    int FamilyMemberId,
    string FamilyMemberName,
    DateTime CreatedAt
);

/// <summary>
/// Service for managing gifts given to family members.
/// </summary>
public interface IGiftService
{
    /// <summary>
    /// Gets gifts for a household, optionally filtered by family member.
    /// </summary>
    /// <param name="householdId">The household ID.</param>
    /// <param name="familyMemberId">Optional family member ID to filter by.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>List of gift summaries.</returns>
    Task<List<GiftSummaryDto>> GetGiftsAsync(int householdId, int? familyMemberId = null, CancellationToken ct = default);

    /// <summary>
    /// Gets detailed information for a specific gift.
    /// </summary>
    /// <param name="id">The gift ID.</param>
    /// <param name="householdId">The household ID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Gift details or null if not found.</returns>
    Task<GiftDetailDto?> GetGiftAsync(int id, int householdId, CancellationToken ct = default);

    /// <summary>
    /// Creates a new gift record.
    /// </summary>
    /// <param name="householdId">The household ID.</param>
    /// <param name="familyMemberId">The recipient family member ID.</param>
    /// <param name="description">Gift description.</param>
    /// <param name="giftDate">Date the gift was/will be given.</param>
    /// <param name="occasion">Occasion for the gift.</param>
    /// <param name="status">Current gift status.</param>
    /// <param name="estimatedCost">Estimated cost.</param>
    /// <param name="actualCost">Actual cost paid.</param>
    /// <param name="rating">Rating of how well received (1-5).</param>
    /// <param name="notes">Additional notes.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The created gift entity.</returns>
    Task<Gift> CreateGiftAsync(
        int householdId,
        int familyMemberId,
        string description,
        DateOnly? giftDate,
        string? occasion,
        GiftStatus status,
        decimal? estimatedCost,
        decimal? actualCost,
        int? rating,
        string? notes,
        CancellationToken ct = default);

    /// <summary>
    /// Updates an existing gift record.
    /// </summary>
    /// <param name="id">The gift ID.</param>
    /// <param name="householdId">The household ID.</param>
    /// <param name="familyMemberId">The recipient family member ID.</param>
    /// <param name="description">Gift description.</param>
    /// <param name="giftDate">Date the gift was/will be given.</param>
    /// <param name="occasion">Occasion for the gift.</param>
    /// <param name="status">Current gift status.</param>
    /// <param name="estimatedCost">Estimated cost.</param>
    /// <param name="actualCost">Actual cost paid.</param>
    /// <param name="rating">Rating of how well received (1-5).</param>
    /// <param name="notes">Additional notes.</param>
    /// <param name="ct">Cancellation token.</param>
    Task UpdateGiftAsync(
        int id,
        int householdId,
        int familyMemberId,
        string description,
        DateOnly? giftDate,
        string? occasion,
        GiftStatus status,
        decimal? estimatedCost,
        decimal? actualCost,
        int? rating,
        string? notes,
        CancellationToken ct = default);

    /// <summary>
    /// Updates only the status of a gift (quick status change).
    /// </summary>
    /// <param name="id">The gift ID.</param>
    /// <param name="householdId">The household ID.</param>
    /// <param name="status">The new status.</param>
    /// <param name="ct">Cancellation token.</param>
    Task UpdateGiftStatusAsync(int id, int householdId, GiftStatus status, CancellationToken ct = default);

    /// <summary>
    /// Deletes a gift record.
    /// </summary>
    /// <param name="id">The gift ID.</param>
    /// <param name="householdId">The household ID.</param>
    /// <param name="ct">Cancellation token.</param>
    Task DeleteGiftAsync(int id, int householdId, CancellationToken ct = default);

    /// <summary>
    /// Calculates the total amount spent on gifts, optionally filtered by year.
    /// </summary>
    /// <param name="householdId">The household ID.</param>
    /// <param name="year">Optional year to filter by (uses GiftDate).</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Total actual cost of gifts with status Given.</returns>
    Task<decimal> GetTotalSpentAsync(int householdId, int? year = null, CancellationToken ct = default);
}
