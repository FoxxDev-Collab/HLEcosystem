using HLE.FamilyHub.Data;
using HLE.FamilyHub.Models.Entities;
using HLE.FamilyHub.Models.Enums;
using HLE.FamilyHub.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HLE.FamilyHub.Services;

/// <summary>
/// Implementation of gift idea tracking and conversion service.
/// </summary>
public class GiftIdeaService(
    ApplicationDbContext context,
    ILogger<GiftIdeaService> logger) : IGiftIdeaService
{
    /// <inheritdoc/>
    public async Task<List<GiftIdeaSummaryDto>> GetActiveIdeasAsync(int householdId, CancellationToken ct = default)
    {
        return await context.GiftIdeas
            .AsNoTracking()
            .Include(gi => gi.FamilyMember)
            .Where(gi => gi.HouseholdId == householdId && gi.Status == GiftIdeaStatus.Active)
            .Select(gi => new GiftIdeaSummaryDto(
                gi.Id,
                gi.Idea,
                gi.DateCaptured,
                gi.Priority,
                gi.Status,
                gi.EstimatedCost,
                gi.Url,
                gi.FamilyMemberId,
                gi.FamilyMember != null ? gi.FamilyMember.FirstName + " " + gi.FamilyMember.LastName : null
            ))
            .OrderByDescending(gi => gi.Priority)
            .ThenByDescending(gi => gi.DateCaptured)
            .ToListAsync(ct);
    }

    /// <inheritdoc/>
    public async Task<List<GiftIdeaSummaryDto>> GetIdeasForMemberAsync(int familyMemberId, int householdId, CancellationToken ct = default)
    {
        return await context.GiftIdeas
            .AsNoTracking()
            .Include(gi => gi.FamilyMember)
            .Where(gi => gi.HouseholdId == householdId && gi.FamilyMemberId == familyMemberId)
            .Select(gi => new GiftIdeaSummaryDto(
                gi.Id,
                gi.Idea,
                gi.DateCaptured,
                gi.Priority,
                gi.Status,
                gi.EstimatedCost,
                gi.Url,
                gi.FamilyMemberId,
                gi.FamilyMember != null ? gi.FamilyMember.FirstName + " " + gi.FamilyMember.LastName : null
            ))
            .OrderByDescending(gi => gi.Priority)
            .ThenByDescending(gi => gi.DateCaptured)
            .ToListAsync(ct);
    }

    /// <inheritdoc/>
    public async Task<GiftIdea?> GetIdeaAsync(int id, int householdId, CancellationToken ct = default)
    {
        return await context.GiftIdeas
            .AsNoTracking()
            .FirstOrDefaultAsync(gi => gi.Id == id && gi.HouseholdId == householdId, ct);
    }

    /// <inheritdoc/>
    public async Task<GiftIdea> CreateIdeaAsync(
        int householdId,
        int? familyMemberId,
        string idea,
        string? source,
        GiftIdeaPriority priority,
        decimal? estimatedCost,
        string? url,
        string? notes,
        CancellationToken ct = default)
    {
        var giftIdea = new GiftIdea
        {
            HouseholdId = householdId,
            FamilyMemberId = familyMemberId,
            Idea = idea,
            Source = source,
            DateCaptured = DateOnly.FromDateTime(DateTime.UtcNow),
            Priority = priority,
            Status = GiftIdeaStatus.Active,
            EstimatedCost = estimatedCost,
            Url = url,
            Notes = notes,
            CreatedAt = DateTime.UtcNow
        };

        context.GiftIdeas.Add(giftIdea);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Created gift idea {GiftIdeaId} in household {HouseholdId}", giftIdea.Id, householdId);

        return giftIdea;
    }

    /// <inheritdoc/>
    public async Task UpdateIdeaAsync(
        int id,
        int householdId,
        int? familyMemberId,
        string idea,
        string? source,
        GiftIdeaPriority priority,
        decimal? estimatedCost,
        string? url,
        string? notes,
        CancellationToken ct = default)
    {
        var giftIdea = await context.GiftIdeas
            .FirstOrDefaultAsync(gi => gi.Id == id && gi.HouseholdId == householdId, ct);

        if (giftIdea == null)
        {
            throw new InvalidOperationException($"Gift idea {id} not found in household {householdId}.");
        }

        giftIdea.FamilyMemberId = familyMemberId;
        giftIdea.Idea = idea;
        giftIdea.Source = source;
        giftIdea.Priority = priority;
        giftIdea.EstimatedCost = estimatedCost;
        giftIdea.Url = url;
        giftIdea.Notes = notes;

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Updated gift idea {GiftIdeaId} in household {HouseholdId}", id, householdId);
    }

    /// <inheritdoc/>
    public async Task UpdateIdeaStatusAsync(int id, int householdId, GiftIdeaStatus status, CancellationToken ct = default)
    {
        var giftIdea = await context.GiftIdeas
            .FirstOrDefaultAsync(gi => gi.Id == id && gi.HouseholdId == householdId, ct);

        if (giftIdea == null)
        {
            throw new InvalidOperationException($"Gift idea {id} not found in household {householdId}.");
        }

        giftIdea.Status = status;

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Updated gift idea {GiftIdeaId} status to {Status} in household {HouseholdId}", id, status, householdId);
    }

    /// <inheritdoc/>
    public async Task<Gift> ConvertToGiftAsync(int ideaId, int householdId, CancellationToken ct = default)
    {
        var giftIdea = await context.GiftIdeas
            .FirstOrDefaultAsync(gi => gi.Id == ideaId && gi.HouseholdId == householdId, ct);

        if (giftIdea == null)
        {
            throw new InvalidOperationException($"Gift idea {ideaId} not found in household {householdId}.");
        }

        if (!giftIdea.FamilyMemberId.HasValue)
        {
            throw new InvalidOperationException($"Cannot convert gift idea {ideaId} to gift: no family member associated.");
        }

        // Create the gift from the idea
        var gift = new Gift
        {
            HouseholdId = householdId,
            FamilyMemberId = giftIdea.FamilyMemberId.Value,
            Description = giftIdea.Idea,
            GiftDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Occasion = null,
            Status = GiftStatus.Purchased,
            EstimatedCost = giftIdea.EstimatedCost,
            ActualCost = null,
            Rating = null,
            Notes = giftIdea.Notes,
            CreatedAt = DateTime.UtcNow
        };

        context.Gifts.Add(gift);

        // Update the idea status
        giftIdea.Status = GiftIdeaStatus.Purchased;

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Converted gift idea {GiftIdeaId} to gift {GiftId} in household {HouseholdId}",
            ideaId, gift.Id, householdId);

        return gift;
    }

    /// <inheritdoc/>
    public async Task DeleteIdeaAsync(int id, int householdId, CancellationToken ct = default)
    {
        var giftIdea = await context.GiftIdeas
            .FirstOrDefaultAsync(gi => gi.Id == id && gi.HouseholdId == householdId, ct);

        if (giftIdea == null)
        {
            throw new InvalidOperationException($"Gift idea {id} not found in household {householdId}.");
        }

        context.GiftIdeas.Remove(giftIdea);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Deleted gift idea {GiftIdeaId} from household {HouseholdId}", id, householdId);
    }
}
