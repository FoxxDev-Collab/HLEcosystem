using HLE.FamilyHub.Models.Entities;
using HLE.FamilyHub.Models.Enums;

namespace HLE.FamilyHub.Services.Interfaces;

/// <summary>
/// Summary DTO for gift idea list views.
/// </summary>
public record GiftIdeaSummaryDto(
    int Id,
    string Idea,
    DateOnly DateCaptured,
    GiftIdeaPriority Priority,
    GiftIdeaStatus Status,
    decimal? EstimatedCost,
    string? Url,
    int? FamilyMemberId,
    string? FamilyMemberName
);

/// <summary>
/// Service for managing gift ideas and converting them to actual gifts.
/// </summary>
public interface IGiftIdeaService
{
    /// <summary>
    /// Gets all active gift ideas for a household.
    /// </summary>
    /// <param name="householdId">The household ID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>List of active gift ideas.</returns>
    Task<List<GiftIdeaSummaryDto>> GetActiveIdeasAsync(int householdId, CancellationToken ct = default);

    /// <summary>
    /// Gets all gift ideas associated with a specific family member.
    /// </summary>
    /// <param name="familyMemberId">The family member ID.</param>
    /// <param name="householdId">The household ID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>List of gift ideas for the family member.</returns>
    Task<List<GiftIdeaSummaryDto>> GetIdeasForMemberAsync(int familyMemberId, int householdId, CancellationToken ct = default);

    /// <summary>
    /// Gets a specific gift idea by ID.
    /// </summary>
    /// <param name="id">The gift idea ID.</param>
    /// <param name="householdId">The household ID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The gift idea entity or null if not found.</returns>
    Task<GiftIdea?> GetIdeaAsync(int id, int householdId, CancellationToken ct = default);

    /// <summary>
    /// Creates a new gift idea.
    /// </summary>
    /// <param name="householdId">The household ID.</param>
    /// <param name="familyMemberId">Optional associated family member ID.</param>
    /// <param name="idea">The gift idea description.</param>
    /// <param name="source">Where the idea came from.</param>
    /// <param name="priority">Priority level.</param>
    /// <param name="estimatedCost">Estimated cost.</param>
    /// <param name="url">Product or reference URL.</param>
    /// <param name="notes">Additional notes.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The created gift idea entity.</returns>
    Task<GiftIdea> CreateIdeaAsync(
        int householdId,
        int? familyMemberId,
        string idea,
        string? source,
        GiftIdeaPriority priority,
        decimal? estimatedCost,
        string? url,
        string? notes,
        CancellationToken ct = default);

    /// <summary>
    /// Updates an existing gift idea.
    /// </summary>
    /// <param name="id">The gift idea ID.</param>
    /// <param name="householdId">The household ID.</param>
    /// <param name="familyMemberId">Optional associated family member ID.</param>
    /// <param name="idea">The gift idea description.</param>
    /// <param name="source">Where the idea came from.</param>
    /// <param name="priority">Priority level.</param>
    /// <param name="estimatedCost">Estimated cost.</param>
    /// <param name="url">Product or reference URL.</param>
    /// <param name="notes">Additional notes.</param>
    /// <param name="ct">Cancellation token.</param>
    Task UpdateIdeaAsync(
        int id,
        int householdId,
        int? familyMemberId,
        string idea,
        string? source,
        GiftIdeaPriority priority,
        decimal? estimatedCost,
        string? url,
        string? notes,
        CancellationToken ct = default);

    /// <summary>
    /// Updates only the status of a gift idea (quick status change).
    /// </summary>
    /// <param name="id">The gift idea ID.</param>
    /// <param name="householdId">The household ID.</param>
    /// <param name="status">The new status.</param>
    /// <param name="ct">Cancellation token.</param>
    Task UpdateIdeaStatusAsync(int id, int householdId, GiftIdeaStatus status, CancellationToken ct = default);

    /// <summary>
    /// Converts a gift idea into an actual gift record.
    /// Sets the idea status to Purchased and creates a corresponding Gift entity.
    /// </summary>
    /// <param name="ideaId">The gift idea ID.</param>
    /// <param name="householdId">The household ID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The newly created gift entity.</returns>
    /// <exception cref="InvalidOperationException">Thrown if the idea has no associated family member.</exception>
    Task<Gift> ConvertToGiftAsync(int ideaId, int householdId, CancellationToken ct = default);

    /// <summary>
    /// Deletes a gift idea.
    /// </summary>
    /// <param name="id">The gift idea ID.</param>
    /// <param name="householdId">The household ID.</param>
    /// <param name="ct">Cancellation token.</param>
    Task DeleteIdeaAsync(int id, int householdId, CancellationToken ct = default);
}
