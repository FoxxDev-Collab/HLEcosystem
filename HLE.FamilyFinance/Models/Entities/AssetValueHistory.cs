namespace HLE.FamilyFinance.Models.Entities;

/// <summary>
/// Tracks historical values of an asset over time
/// </summary>
public class AssetValueHistory
{
    public int Id { get; set; }
    public int AssetId { get; set; }

    /// <summary>
    /// Date of the value record
    /// </summary>
    public DateOnly Date { get; set; }

    /// <summary>
    /// Estimated value at this date
    /// </summary>
    public decimal Value { get; set; }

    /// <summary>
    /// Source of the valuation (e.g., "Zillow", "KBB", "Manual")
    /// </summary>
    public string? Source { get; set; }

    /// <summary>
    /// Optional notes about this valuation
    /// </summary>
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Asset Asset { get; set; } = null!;
}
