namespace HLE.AssetTracker.Models.Entities;

/// <summary>
/// Represents a completed maintenance action
/// </summary>
public class MaintenanceLog
{
    public int Id { get; set; }

    public int AssetId { get; set; }

    /// <summary>
    /// Associated schedule ID (null for ad-hoc maintenance)
    /// </summary>
    public int? ScheduleId { get; set; }

    /// <summary>
    /// Date the maintenance was performed
    /// </summary>
    public DateOnly PerformedAt { get; set; }

    /// <summary>
    /// Description of work performed
    /// </summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// Cost of maintenance (if applicable)
    /// </summary>
    public decimal? Cost { get; set; }

    /// <summary>
    /// Authentik user ID who performed/logged this maintenance
    /// </summary>
    public string PerformedByUserId { get; set; } = string.Empty;

    /// <summary>
    /// Additional notes
    /// </summary>
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Asset Asset { get; set; } = null!;
    public MaintenanceSchedule? Schedule { get; set; }
}
