using HLE.FamilyHub.Models.Entities;
using HLE.FamilyHub.Models.Enums;

namespace HLE.FamilyHub.Services.Interfaces;

/// <summary>
/// Service for managing household operations including creation, retrieval, and member management.
/// </summary>
public interface IHouseholdService
{
    /// <summary>
    /// Gets an existing household for the user or creates a new one if none exists.
    /// </summary>
    /// <param name="userId">The authenticated user's ID from Authentik.</param>
    /// <param name="displayName">The user's display name for naming the household.</param>
    /// <param name="email">The user's email address.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The user's household (existing or newly created).</returns>
    Task<Household> GetOrCreateHouseholdAsync(string userId, string displayName, string? email, CancellationToken ct = default);

    /// <summary>
    /// Gets the user's household and their membership record.
    /// </summary>
    /// <param name="userId">The authenticated user's ID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Tuple of household and membership, or null if user has no household.</returns>
    Task<(Household? Household, HouseholdMember? Member)> GetUserHouseholdAsync(string userId, CancellationToken ct = default);

    /// <summary>
    /// Gets a household by ID, verifying the user has access to it.
    /// </summary>
    /// <param name="householdId">The household ID.</param>
    /// <param name="userId">The authenticated user's ID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The household if the user has access, otherwise null.</returns>
    Task<Household?> GetHouseholdAsync(int householdId, string userId, CancellationToken ct = default);

    /// <summary>
    /// Updates household information.
    /// </summary>
    /// <param name="householdId">The household ID.</param>
    /// <param name="name">The new household name.</param>
    /// <param name="userId">The authenticated user's ID (must have Owner or Admin role).</param>
    /// <param name="ct">Cancellation token.</param>
    Task UpdateHouseholdAsync(int householdId, string name, string userId, CancellationToken ct = default);

    /// <summary>
    /// Gets all members of a household.
    /// </summary>
    /// <param name="householdId">The household ID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>List of household members with user information.</returns>
    Task<List<HouseholdMember>> GetMembersAsync(int householdId, CancellationToken ct = default);

    /// <summary>
    /// Checks if a user has at least the specified role in a household.
    /// </summary>
    /// <param name="householdId">The household ID.</param>
    /// <param name="userId">The user's ID.</param>
    /// <param name="minimumRole">The minimum required role.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>True if the user has the required role or higher.</returns>
    Task<bool> HasRoleAsync(int householdId, string userId, HouseholdRole minimumRole, CancellationToken ct = default);
}
