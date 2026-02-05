using HLE.FamilyFinance.Data;
using HLE.FamilyFinance.Models.Entities;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyFinance.Services;

public class HouseholdService(ApplicationDbContext context, ICategoryService categoryService, ILogger<HouseholdService> logger) : IHouseholdService
{
    public async Task<Household> GetOrCreateHouseholdAsync(string userId, string displayName, string? email, CancellationToken ct = default)
    {
        // Check if user already belongs to a household
        var existingMember = await context.HouseholdMembers
            .Include(m => m.Household)
            .FirstOrDefaultAsync(m => m.UserId == userId, ct);

        if (existingMember != null)
        {
            logger.LogDebug("User {UserId} already has household {HouseholdId}", userId, existingMember.HouseholdId);
            return existingMember.Household;
        }

        // Create new household for this user
        var household = new Household
        {
            Name = $"{displayName}'s Family",
            OwnerId = userId,
            CreatedAt = DateTime.UtcNow
        };

        context.Households.Add(household);
        await context.SaveChangesAsync(ct);

        // Add user as owner member
        var member = new HouseholdMember
        {
            HouseholdId = household.Id,
            UserId = userId,
            DisplayName = displayName,
            Email = email,
            Role = HouseholdRole.Owner,
            JoinedAt = DateTime.UtcNow
        };

        context.HouseholdMembers.Add(member);
        await context.SaveChangesAsync(ct);

        // Seed default categories for the new household
        await categoryService.SeedDefaultCategoriesAsync(household.Id, ct);

        logger.LogInformation("Created new household {HouseholdId} for user {UserId}", household.Id, userId);
        return household;
    }

    public async Task<(Household? Household, HouseholdMember? Member)> GetUserHouseholdAsync(string userId, CancellationToken ct = default)
    {
        var member = await context.HouseholdMembers
            .Include(m => m.Household)
            .FirstOrDefaultAsync(m => m.UserId == userId, ct);

        return (member?.Household, member);
    }

    public async Task<Household?> GetHouseholdAsync(int householdId, string userId, CancellationToken ct = default)
    {
        // Verify user is a member of this household
        var isMember = await context.HouseholdMembers
            .AnyAsync(m => m.HouseholdId == householdId && m.UserId == userId, ct);

        if (!isMember)
        {
            return null;
        }

        return await context.Households.FindAsync([householdId], ct);
    }

    public async Task UpdateHouseholdAsync(int householdId, string name, string userId, CancellationToken ct = default)
    {
        // Verify user has admin rights
        if (!await HasRoleAsync(householdId, userId, HouseholdRole.Admin, ct))
        {
            throw new UnauthorizedAccessException("User does not have permission to update household settings");
        }

        var household = await context.Households.FindAsync([householdId], ct)
            ?? throw new InvalidOperationException("Household not found");

        household.Name = name;
        await context.SaveChangesAsync(ct);
    }

    public async Task<List<HouseholdMember>> GetMembersAsync(int householdId, CancellationToken ct = default)
    {
        return await context.HouseholdMembers
            .AsNoTracking()
            .Where(m => m.HouseholdId == householdId)
            .OrderBy(m => m.Role)
            .ThenBy(m => m.DisplayName)
            .ToListAsync(ct);
    }

    public async Task<HouseholdMember> AddMemberAsync(int householdId, string userId, string displayName, string? email, HouseholdRole role, CancellationToken ct = default)
    {
        // Check if user is already a member
        var existing = await context.HouseholdMembers
            .FirstOrDefaultAsync(m => m.HouseholdId == householdId && m.UserId == userId, ct);

        if (existing != null)
        {
            throw new InvalidOperationException("User is already a member of this household");
        }

        var member = new HouseholdMember
        {
            HouseholdId = householdId,
            UserId = userId,
            DisplayName = displayName,
            Email = email,
            Role = role,
            JoinedAt = DateTime.UtcNow
        };

        context.HouseholdMembers.Add(member);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Added member {UserId} to household {HouseholdId} with role {Role}", userId, householdId, role);
        return member;
    }

    public async Task UpdateMemberRoleAsync(int householdId, int memberId, HouseholdRole newRole, string requestingUserId, CancellationToken ct = default)
    {
        // Only owners can change roles
        if (!await HasRoleAsync(householdId, requestingUserId, HouseholdRole.Owner, ct))
        {
            throw new UnauthorizedAccessException("Only owners can change member roles");
        }

        var member = await context.HouseholdMembers
            .FirstOrDefaultAsync(m => m.Id == memberId && m.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Member not found");

        // Cannot change owner's role
        if (member.Role == HouseholdRole.Owner)
        {
            throw new InvalidOperationException("Cannot change the owner's role");
        }

        member.Role = newRole;
        await context.SaveChangesAsync(ct);
    }

    public async Task RemoveMemberAsync(int householdId, int memberId, string requestingUserId, CancellationToken ct = default)
    {
        // Only admins+ can remove members
        if (!await HasRoleAsync(householdId, requestingUserId, HouseholdRole.Admin, ct))
        {
            throw new UnauthorizedAccessException("User does not have permission to remove members");
        }

        var member = await context.HouseholdMembers
            .FirstOrDefaultAsync(m => m.Id == memberId && m.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Member not found");

        // Cannot remove the owner
        if (member.Role == HouseholdRole.Owner)
        {
            throw new InvalidOperationException("Cannot remove the household owner");
        }

        context.HouseholdMembers.Remove(member);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Removed member {MemberId} from household {HouseholdId}", memberId, householdId);
    }

    public async Task<bool> HasRoleAsync(int householdId, string userId, HouseholdRole minimumRole, CancellationToken ct = default)
    {
        var member = await context.HouseholdMembers
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.HouseholdId == householdId && m.UserId == userId, ct);

        if (member == null)
        {
            return false;
        }

        // Lower enum value = higher permission (Owner=0, Admin=1, Editor=2, Viewer=3)
        return member.Role <= minimumRole;
    }
}
