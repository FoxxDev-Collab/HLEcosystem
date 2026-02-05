using HLE.FamilyHub.Data;
using HLE.FamilyHub.Models.Entities;
using HLE.FamilyHub.Models.Enums;
using HLE.FamilyHub.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HLE.FamilyHub.Services;

/// <summary>
/// Implementation of household management service.
/// </summary>
public class HouseholdService(
    ApplicationDbContext context,
    ILogger<HouseholdService> logger) : IHouseholdService
{
    /// <inheritdoc/>
    public async Task<Household> GetOrCreateHouseholdAsync(string userId, string displayName, string? email, CancellationToken ct = default)
    {
        // Check if user already has a household
        var existingMembership = await context.HouseholdMembers
            .AsNoTracking()
            .Include(hm => hm.Household)
            .FirstOrDefaultAsync(hm => hm.UserId == userId, ct);

        if (existingMembership?.Household != null)
        {
            logger.LogInformation("User {UserId} already has household {HouseholdId}", userId, existingMembership.Household.Id);
            return existingMembership.Household;
        }

        // Create new household
        var household = new Household
        {
            Name = $"{displayName}'s Family",
            CreatedAt = DateTime.UtcNow
        };

        context.Households.Add(household);

        // Add user as owner
        var member = new HouseholdMember
        {
            Household = household,
            UserId = userId,
            DisplayName = displayName,
            Email = email,
            Role = HouseholdRole.Owner,
            JoinedAt = DateTime.UtcNow
        };

        context.HouseholdMembers.Add(member);

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Created new household {HouseholdId} for user {UserId}", household.Id, userId);

        return household;
    }

    /// <inheritdoc/>
    public async Task<(Household? Household, HouseholdMember? Member)> GetUserHouseholdAsync(string userId, CancellationToken ct = default)
    {
        var membership = await context.HouseholdMembers
            .AsNoTracking()
            .Include(hm => hm.Household)
            .FirstOrDefaultAsync(hm => hm.UserId == userId, ct);

        return (membership?.Household, membership);
    }

    /// <inheritdoc/>
    public async Task<Household?> GetHouseholdAsync(int householdId, string userId, CancellationToken ct = default)
    {
        // Verify user has access to this household
        var hasAccess = await context.HouseholdMembers
            .AsNoTracking()
            .AnyAsync(hm => hm.HouseholdId == householdId && hm.UserId == userId, ct);

        if (!hasAccess)
        {
            logger.LogWarning("User {UserId} attempted to access household {HouseholdId} without permission", userId, householdId);
            return null;
        }

        return await context.Households
            .AsNoTracking()
            .FirstOrDefaultAsync(h => h.Id == householdId, ct);
    }

    /// <inheritdoc/>
    public async Task UpdateHouseholdAsync(int householdId, string name, string userId, CancellationToken ct = default)
    {
        // Verify user has Owner or Admin role
        var hasPermission = await HasRoleAsync(householdId, userId, HouseholdRole.Admin, ct);

        if (!hasPermission)
        {
            logger.LogWarning("User {UserId} attempted to update household {HouseholdId} without permission", userId, householdId);
            throw new UnauthorizedAccessException("User does not have permission to update this household.");
        }

        var household = await context.Households.FindAsync([householdId], ct);

        if (household == null)
        {
            throw new InvalidOperationException($"Household {householdId} not found.");
        }

        household.Name = name;

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Updated household {HouseholdId} name to {Name}", householdId, name);
    }

    /// <inheritdoc/>
    public async Task<List<HouseholdMember>> GetMembersAsync(int householdId, CancellationToken ct = default)
    {
        return await context.HouseholdMembers
            .AsNoTracking()
            .Where(hm => hm.HouseholdId == householdId)
            .OrderBy(hm => hm.JoinedAt)
            .ToListAsync(ct);
    }

    /// <inheritdoc/>
    public async Task<bool> HasRoleAsync(int householdId, string userId, HouseholdRole minimumRole, CancellationToken ct = default)
    {
        var member = await context.HouseholdMembers
            .AsNoTracking()
            .FirstOrDefaultAsync(hm => hm.HouseholdId == householdId && hm.UserId == userId, ct);

        if (member == null)
        {
            return false;
        }

        // Role hierarchy: Owner > Admin > Editor > Viewer
        return minimumRole switch
        {
            HouseholdRole.Owner => member.Role == HouseholdRole.Owner,
            HouseholdRole.Admin => member.Role is HouseholdRole.Owner or HouseholdRole.Admin,
            HouseholdRole.Editor => member.Role is not HouseholdRole.Viewer,
            HouseholdRole.Viewer => true,
            _ => false
        };
    }
}
