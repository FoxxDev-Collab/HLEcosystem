namespace HLE.AssetTracker.Models.Entities;

/// <summary>
/// Represents a recurring or one-time maintenance schedule for an asset
/// </summary>
public class MaintenanceSchedule
{
    public int Id { get; set; }

    public int AssetId { get; set; }

    /// <summary>
    /// Name of the maintenance task (e.g., "Oil Change", "Filter Replacement")
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Detailed description of the maintenance task
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Interval in days for recurring maintenance (null = one-time)
    /// </summary>
    public int? IntervalDays { get; set; }

    /// <summary>
    /// Next due date for this maintenance
    /// </summary>
    public DateOnly NextDueDate { get; set; }

    /// <summary>
    /// Whether this is a recurring maintenance schedule
    /// </summary>
    public bool IsRecurring { get; set; }

    /// <summary>
    /// Days before due date to show notification
    /// </summary>
    public int NotifyDaysBefore { get; set; } = 7;

    /// <summary>
    /// Whether this schedule is active
    /// </summary>
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Asset Asset { get; set; } = null!;
    public ICollection<MaintenanceLog> MaintenanceLogs { get; set; } = [];
}
