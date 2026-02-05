using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Models.Entities;

/// <summary>
/// Represents a user's membership in a household with their role
/// </summary>
public class HouseholdMember
{
    public int Id { get; set; }

    public int HouseholdId { get; set; }

    /// <summary>
    /// The Authentik user ID
    /// </summary>
    public string UserId { get; set; } = string.Empty;

    /// <summary>
    /// Display name for this member in the household context
    /// </summary>
    public string DisplayName { get; set; } = string.Empty;

    /// <summary>
    /// Email address (from Authentik claims)
    /// </summary>
    public string? Email { get; set; }

    /// <summary>
    /// The member's role in this household
    /// </summary>
    public HouseholdRole Role { get; set; } = HouseholdRole.Viewer;

    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Household Household { get; set; } = null!;
}
