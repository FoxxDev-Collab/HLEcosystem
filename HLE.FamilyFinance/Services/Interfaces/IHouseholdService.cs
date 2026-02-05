using HLE.FamilyFinance.Models.Entities;
using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Services.Interfaces;

public interface IHouseholdService
{
    /// <summary>
    /// Gets or creates a household for a user. Called on first login to auto-provision.
    /// </summary>
    Task<Household> GetOrCreateHouseholdAsync(string userId, string displayName, string? email, CancellationToken ct = default);

    /// <summary>
    /// Gets the household and member info for a user
    /// </summary>
    Task<(Household? Household, HouseholdMember? Member)> GetUserHouseholdAsync(string userId, CancellationToken ct = default);

    /// <summary>
    /// Gets a household by ID (with authorization check)
    /// </summary>
    Task<Household?> GetHouseholdAsync(int householdId, string userId, CancellationToken ct = default);

    /// <summary>
    /// Updates household settings
    /// </summary>
    Task UpdateHouseholdAsync(int householdId, string name, string userId, CancellationToken ct = default);

    /// <summary>
    /// Gets all members of a household
    /// </summary>
    Task<List<HouseholdMember>> GetMembersAsync(int householdId, CancellationToken ct = default);

    /// <summary>
    /// Invites a new member to the household
    /// </summary>
    Task<HouseholdMember> AddMemberAsync(int householdId, string userId, string displayName, string? email, HouseholdRole role, CancellationToken ct = default);

    /// <summary>
    /// Updates a member's role
    /// </summary>
    Task UpdateMemberRoleAsync(int householdId, int memberId, HouseholdRole newRole, string requestingUserId, CancellationToken ct = default);

    /// <summary>
    /// Removes a member from the household
    /// </summary>
    Task RemoveMemberAsync(int householdId, int memberId, string requestingUserId, CancellationToken ct = default);

    /// <summary>
    /// Checks if a user has at least the specified role in the household
    /// </summary>
    Task<bool> HasRoleAsync(int householdId, string userId, HouseholdRole minimumRole, CancellationToken ct = default);
}
