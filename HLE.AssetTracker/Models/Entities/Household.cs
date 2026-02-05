namespace HLE.AssetTracker.Models.Entities;

/// <summary>
/// Represents a family/household unit that shares assets
/// </summary>
public class Household
{
    public int Id { get; set; }

    /// <summary>
    /// Display name for the household (e.g., "Smith Family")
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// The Authentik user ID of the household owner
    /// </summary>
    public string OwnerId { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ICollection<HouseholdMember> Members { get; set; } = [];
    public ICollection<Location> Locations { get; set; } = [];
    public ICollection<Category> Categories { get; set; } = [];
    public ICollection<Asset> Assets { get; set; } = [];
    public ICollection<Label> Labels { get; set; } = [];
}
