using HLE.FamilyHub.Data;
using HLE.FamilyHub.Models.Entities;
using HLE.FamilyHub.Models.Enums;
using HLE.FamilyHub.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HLE.FamilyHub.Services;

/// <summary>
/// Implementation of gift tracking and management service.
/// </summary>
public class GiftService(
    ApplicationDbContext context,
    ILogger<GiftService> logger) : IGiftService
{
    /// <inheritdoc/>
    public async Task<List<GiftSummaryDto>> GetGiftsAsync(int householdId, int? familyMemberId = null, CancellationToken ct = default)
    {
        var query = context.Gifts
            .AsNoTracking()
            .Include(g => g.FamilyMember)
            .Where(g => g.HouseholdId == householdId);

        if (familyMemberId.HasValue)
        {
            query = query.Where(g => g.FamilyMemberId == familyMemberId.Value);
        }

        return await query
            .Select(g => new GiftSummaryDto(
                g.Id,
                g.Description,
                g.GiftDate,
                g.Occasion,
                g.Status,
                g.ActualCost,
                g.Rating,
                g.FamilyMemberId,
                g.FamilyMember.FirstName + " " + g.FamilyMember.LastName
            ))
            .OrderByDescending(g => g.GiftDate)
            .ToListAsync(ct);
    }

    /// <inheritdoc/>
    public async Task<GiftDetailDto?> GetGiftAsync(int id, int householdId, CancellationToken ct = default)
    {
        return await context.Gifts
            .AsNoTracking()
            .Include(g => g.FamilyMember)
            .Where(g => g.Id == id && g.HouseholdId == householdId)
            .Select(g => new GiftDetailDto(
                g.Id,
                g.Description,
                g.GiftDate,
                g.Occasion,
                g.Status,
                g.EstimatedCost,
                g.ActualCost,
                g.Rating,
                g.Notes,
                g.FamilyMemberId,
                g.FamilyMember.FirstName + " " + g.FamilyMember.LastName,
                g.CreatedAt
            ))
            .FirstOrDefaultAsync(ct);
    }

    /// <inheritdoc/>
    public async Task<Gift> CreateGiftAsync(
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
        CancellationToken ct = default)
    {
        var gift = new Gift
        {
            HouseholdId = householdId,
            FamilyMemberId = familyMemberId,
            Description = description,
            GiftDate = giftDate,
            Occasion = occasion,
            Status = status,
            EstimatedCost = estimatedCost,
            ActualCost = actualCost,
            Rating = rating,
            Notes = notes,
            CreatedAt = DateTime.UtcNow
        };

        context.Gifts.Add(gift);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Created gift {GiftId} for family member {FamilyMemberId} in household {HouseholdId}",
            gift.Id, familyMemberId, householdId);

        return gift;
    }

    /// <inheritdoc/>
    public async Task UpdateGiftAsync(
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
        CancellationToken ct = default)
    {
        var gift = await context.Gifts
            .FirstOrDefaultAsync(g => g.Id == id && g.HouseholdId == householdId, ct);

        if (gift == null)
        {
            throw new InvalidOperationException($"Gift {id} not found in household {householdId}.");
        }

        gift.FamilyMemberId = familyMemberId;
        gift.Description = description;
        gift.GiftDate = giftDate;
        gift.Occasion = occasion;
        gift.Status = status;
        gift.EstimatedCost = estimatedCost;
        gift.ActualCost = actualCost;
        gift.Rating = rating;
        gift.Notes = notes;

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Updated gift {GiftId} in household {HouseholdId}", id, householdId);
    }

    /// <inheritdoc/>
    public async Task UpdateGiftStatusAsync(int id, int householdId, GiftStatus status, CancellationToken ct = default)
    {
        var gift = await context.Gifts
            .FirstOrDefaultAsync(g => g.Id == id && g.HouseholdId == householdId, ct);

        if (gift == null)
        {
            throw new InvalidOperationException($"Gift {id} not found in household {householdId}.");
        }

        gift.Status = status;

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Updated gift {GiftId} status to {Status} in household {HouseholdId}", id, status, householdId);
    }

    /// <inheritdoc/>
    public async Task DeleteGiftAsync(int id, int householdId, CancellationToken ct = default)
    {
        var gift = await context.Gifts
            .FirstOrDefaultAsync(g => g.Id == id && g.HouseholdId == householdId, ct);

        if (gift == null)
        {
            throw new InvalidOperationException($"Gift {id} not found in household {householdId}.");
        }

        context.Gifts.Remove(gift);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Deleted gift {GiftId} from household {HouseholdId}", id, householdId);
    }

    /// <inheritdoc/>
    public async Task<decimal> GetTotalSpentAsync(int householdId, int? year = null, CancellationToken ct = default)
    {
        var query = context.Gifts
            .AsNoTracking()
            .Where(g => g.HouseholdId == householdId
                && g.Status == GiftStatus.Given
                && g.ActualCost.HasValue);

        if (year.HasValue)
        {
            query = query.Where(g => g.GiftDate.HasValue && g.GiftDate.Value.Year == year.Value);
        }

        var total = await query.SumAsync(g => g.ActualCost!.Value, ct);

        return total;
    }
}
