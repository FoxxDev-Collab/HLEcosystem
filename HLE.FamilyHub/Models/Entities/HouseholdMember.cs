using HLE.FamilyHub.Models.Enums;

namespace HLE.FamilyHub.Models.Entities;

/// <summary>
/// Represents a user who has access to a household
/// </summary>
public class HouseholdMember
{
    public int Id { get; set; }

    public int HouseholdId { get; set; }

    public string UserId { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string? Email { get; set; }

    public HouseholdRole Role { get; set; } = HouseholdRole.Viewer;

    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Household Household { get; set; } = null!;
}
