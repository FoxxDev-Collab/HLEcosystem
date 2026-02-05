namespace HLE.AssetTracker.Models.Enums;

/// <summary>
/// Defines the data type for custom fields on categories
/// </summary>
public enum CustomFieldType
{
    /// <summary>
    /// Single-line text input
    /// </summary>
    Text = 0,

    /// <summary>
    /// Numeric value (decimal)
    /// </summary>
    Number = 1,

    /// <summary>
    /// Date picker
    /// </summary>
    Date = 2,

    /// <summary>
    /// Checkbox (true/false)
    /// </summary>
    Boolean = 3,

    /// <summary>
    /// Dropdown selection from predefined options
    /// </summary>
    Select = 4,

    /// <summary>
    /// Multi-line text area
    /// </summary>
    TextArea = 5,

    /// <summary>
    /// URL input
    /// </summary>
    Url = 6
}
