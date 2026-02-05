namespace HLE.AssetTracker.Models.Entities;

/// <summary>
/// Represents a hierarchical location where assets can be stored
/// </summary>
public class Location
{
    public int Id { get; set; }

    public int HouseholdId { get; set; }

    /// <summary>
    /// Parent location ID for hierarchy (null = top-level)
    /// </summary>
    public int? ParentId { get; set; }

    /// <summary>
    /// Location name (e.g., "Kitchen", "Garage Shelf A")
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description of the location
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Sort order for display
    /// </summary>
    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Household Household { get; set; } = null!;
    public Location? Parent { get; set; }
    public ICollection<Location> Children { get; set; } = [];
    public ICollection<Asset> Assets { get; set; } = [];
}
