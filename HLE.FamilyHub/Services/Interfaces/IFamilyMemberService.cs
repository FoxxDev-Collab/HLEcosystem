using HLE.FamilyHub.Models.Entities;
using HLE.FamilyHub.Models.Enums;

namespace HLE.FamilyHub.Services.Interfaces;

/// <summary>
/// Summary DTO for family member list views.
/// </summary>
public record FamilyMemberSummaryDto(
    int Id,
    string FirstName,
    string LastName,
    string? Nickname,
    Relationship Relationship,
    DateOnly? Birthday,
    string? Phone,
    string? Email,
    string? City,
    string? State,
    bool IncludeInHolidayCards,
    bool IsActive,
    int UpcomingDateCount,
    int GiftIdeaCount
)
{
    /// <summary>
    /// Full name combining first and last name.
    /// </summary>
    public string FullName => $"{FirstName} {LastName}";
}

/// <summary>
/// Detailed DTO for family member edit/detail views.
/// </summary>
public record FamilyMemberDetailDto(
    int Id,
    string FirstName,
    string LastName,
    string? Nickname,
    Relationship Relationship,
    string? RelationshipNotes,
    DateOnly? Birthday,
    DateOnly? Anniversary,
    string? Phone,
    string? Email,
    PreferredContactMethod PreferredContact,
    string? AddressLine1,
    string? AddressLine2,
    string? City,
    string? State,
    string? ZipCode,
    string? Country,
    string? ProfilePhotoUrl,
    string? Notes,
    bool IsActive,
    bool IncludeInHolidayCards,
    DateTime CreatedAt
)
{
    /// <summary>
    /// Full name combining first and last name.
    /// </summary>
    public string FullName => $"{FirstName} {LastName}";
}

/// <summary>
/// Service for managing family members within a household.
/// </summary>
public interface IFamilyMemberService
{
    /// <summary>
    /// Gets all family members for a household with summary information.
    /// </summary>
    /// <param name="householdId">The household ID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>List of family member summaries.</returns>
    Task<List<FamilyMemberSummaryDto>> GetFamilyMembersAsync(int householdId, CancellationToken ct = default);

    /// <summary>
    /// Gets family members who should receive holiday cards (active, opted-in, with address).
    /// </summary>
    /// <param name="householdId">The household ID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>List of family members for holiday card list.</returns>
    Task<List<FamilyMemberSummaryDto>> GetHolidayCardListAsync(int householdId, CancellationToken ct = default);

    /// <summary>
    /// Gets detailed information for a specific family member.
    /// </summary>
    /// <param name="id">The family member ID.</param>
    /// <param name="householdId">The household ID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Family member details or null if not found.</returns>
    Task<FamilyMemberDetailDto?> GetFamilyMemberAsync(int id, int householdId, CancellationToken ct = default);

    /// <summary>
    /// Creates a new family member and automatically creates ImportantDate records for birthday and anniversary if provided.
    /// </summary>
    /// <param name="householdId">The household ID.</param>
    /// <param name="firstName">First name (required).</param>
    /// <param name="lastName">Last name (required).</param>
    /// <param name="nickname">Nickname or preferred name.</param>
    /// <param name="relationship">Relationship to household.</param>
    /// <param name="relationshipNotes">Additional relationship context.</param>
    /// <param name="birthday">Birth date.</param>
    /// <param name="anniversary">Anniversary date.</param>
    /// <param name="phone">Phone number.</param>
    /// <param name="email">Email address.</param>
    /// <param name="preferredContact">Preferred contact method.</param>
    /// <param name="addressLine1">Street address line 1.</param>
    /// <param name="addressLine2">Street address line 2.</param>
    /// <param name="city">City.</param>
    /// <param name="state">State or province.</param>
    /// <param name="zipCode">ZIP or postal code.</param>
    /// <param name="country">Country.</param>
    /// <param name="profilePhotoUrl">Profile photo URL.</param>
    /// <param name="notes">General notes.</param>
    /// <param name="includeInHolidayCards">Whether to include in holiday card list.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The created family member entity.</returns>
    Task<FamilyMember> CreateFamilyMemberAsync(
        int householdId,
        string firstName,
        string lastName,
        string? nickname,
        Relationship relationship,
        string? relationshipNotes,
        DateOnly? birthday,
        DateOnly? anniversary,
        string? phone,
        string? email,
        PreferredContactMethod preferredContact,
        string? addressLine1,
        string? addressLine2,
        string? city,
        string? state,
        string? zipCode,
        string? country,
        string? profilePhotoUrl,
        string? notes,
        bool includeInHolidayCards,
        CancellationToken ct = default);

    /// <summary>
    /// Updates an existing family member.
    /// </summary>
    /// <param name="id">The family member ID.</param>
    /// <param name="householdId">The household ID.</param>
    /// <param name="firstName">First name (required).</param>
    /// <param name="lastName">Last name (required).</param>
    /// <param name="nickname">Nickname or preferred name.</param>
    /// <param name="relationship">Relationship to household.</param>
    /// <param name="relationshipNotes">Additional relationship context.</param>
    /// <param name="birthday">Birth date.</param>
    /// <param name="anniversary">Anniversary date.</param>
    /// <param name="phone">Phone number.</param>
    /// <param name="email">Email address.</param>
    /// <param name="preferredContact">Preferred contact method.</param>
    /// <param name="addressLine1">Street address line 1.</param>
    /// <param name="addressLine2">Street address line 2.</param>
    /// <param name="city">City.</param>
    /// <param name="state">State or province.</param>
    /// <param name="zipCode">ZIP or postal code.</param>
    /// <param name="country">Country.</param>
    /// <param name="profilePhotoUrl">Profile photo URL.</param>
    /// <param name="notes">General notes.</param>
    /// <param name="includeInHolidayCards">Whether to include in holiday card list.</param>
    /// <param name="ct">Cancellation token.</param>
    Task UpdateFamilyMemberAsync(
        int id,
        int householdId,
        string firstName,
        string lastName,
        string? nickname,
        Relationship relationship,
        string? relationshipNotes,
        DateOnly? birthday,
        DateOnly? anniversary,
        string? phone,
        string? email,
        PreferredContactMethod preferredContact,
        string? addressLine1,
        string? addressLine2,
        string? city,
        string? state,
        string? zipCode,
        string? country,
        string? profilePhotoUrl,
        string? notes,
        bool includeInHolidayCards,
        CancellationToken ct = default);

    /// <summary>
    /// Soft-deletes a family member by setting IsActive to false.
    /// </summary>
    /// <param name="id">The family member ID.</param>
    /// <param name="householdId">The household ID.</param>
    /// <param name="ct">Cancellation token.</param>
    Task DeleteFamilyMemberAsync(int id, int householdId, CancellationToken ct = default);

    /// <summary>
    /// Searches family members by name or nickname.
    /// </summary>
    /// <param name="householdId">The household ID.</param>
    /// <param name="query">Search query string.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>List of matching family members.</returns>
    Task<List<FamilyMemberSummaryDto>> SearchAsync(int householdId, string query, CancellationToken ct = default);
}
