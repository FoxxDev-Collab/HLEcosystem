namespace HLE.FamilyHub.Models.Entities;

/// <summary>
/// Represents a household that can contain multiple family members
/// </summary>
public class Household
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string OwnerId { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ICollection<HouseholdMember> Members { get; set; } = [];

    public ICollection<FamilyMember> FamilyMembers { get; set; } = [];
}
