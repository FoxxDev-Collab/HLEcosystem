namespace HLE.AssetTracker.Models.Entities;

/// <summary>
/// Represents an asset category with optional custom fields
/// </summary>
public class Category
{
    public int Id { get; set; }

    public int HouseholdId { get; set; }

    /// <summary>
    /// Category name (e.g., "Electronics", "Furniture")
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional icon (emoji or icon class)
    /// </summary>
    public string? Icon { get; set; }

    /// <summary>
    /// Optional color for display (hex code)
    /// </summary>
    public string? Color { get; set; }

    /// <summary>
    /// Sort order for display
    /// </summary>
    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Household Household { get; set; } = null!;
    public ICollection<CustomFieldDefinition> CustomFields { get; set; } = [];
    public ICollection<Asset> Assets { get; set; } = [];
}
