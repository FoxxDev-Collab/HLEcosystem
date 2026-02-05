namespace HLE.AssetTracker.Models.Entities;

/// <summary>
/// Many-to-many join table between Assets and Labels
/// </summary>
public class AssetLabel
{
    public int AssetId { get; set; }

    public int LabelId { get; set; }

    // Navigation properties
    public Asset Asset { get; set; } = null!;
    public Label Label { get; set; } = null!;
}
