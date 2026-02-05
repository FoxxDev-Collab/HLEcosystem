namespace HLE.AssetTracker.Models.Entities;

/// <summary>
/// Represents a tag/label for cross-cutting asset organization
/// </summary>
public class Label
{
    public int Id { get; set; }

    public int HouseholdId { get; set; }

    /// <summary>
    /// Label name (e.g., "Fragile", "High Value", "Insured")
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Display color (hex code)
    /// </summary>
    public string? Color { get; set; }

    /// <summary>
    /// Sort order for display
    /// </summary>
    public int SortOrder { get; set; }

    // Navigation properties
    public Household Household { get; set; } = null!;
    public ICollection<AssetLabel> AssetLabels { get; set; } = [];
}
