using System.Text.Json;
using HLE.AssetTracker.Models.Enums;

namespace HLE.AssetTracker.Models.Entities;

/// <summary>
/// Defines a custom field for a category
/// </summary>
public class CustomFieldDefinition
{
    public int Id { get; set; }

    public int CategoryId { get; set; }

    /// <summary>
    /// Field name/label (e.g., "Serial Number", "Warranty Provider")
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// The data type of this field
    /// </summary>
    public CustomFieldType FieldType { get; set; } = CustomFieldType.Text;

    /// <summary>
    /// Options for Select field type (JSON array)
    /// </summary>
    public JsonDocument? Options { get; set; }

    /// <summary>
    /// Whether this field is required when creating/editing assets
    /// </summary>
    public bool IsRequired { get; set; }

    /// <summary>
    /// Sort order for display
    /// </summary>
    public int SortOrder { get; set; }

    // Navigation properties
    public Category Category { get; set; } = null!;
}
