using System.Text.Json;

namespace HLE.AssetTracker.Models.Entities;

/// <summary>
/// Represents a tracked asset/item
/// </summary>
public class Asset
{
    public int Id { get; set; }

    public int HouseholdId { get; set; }

    public int? LocationId { get; set; }

    public int? CategoryId { get; set; }

    /// <summary>
    /// Asset name/title
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Detailed description
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Manufacturer/brand name
    /// </summary>
    public string? Manufacturer { get; set; }

    /// <summary>
    /// Model number/name
    /// </summary>
    public string? Model { get; set; }

    /// <summary>
    /// Serial number
    /// </summary>
    public string? SerialNumber { get; set; }

    /// <summary>
    /// Date of purchase
    /// </summary>
    public DateOnly? PurchaseDate { get; set; }

    /// <summary>
    /// Purchase price
    /// </summary>
    public decimal? PurchasePrice { get; set; }

    /// <summary>
    /// Where the item was purchased
    /// </summary>
    public string? PurchaseLocation { get; set; }

    /// <summary>
    /// Warranty expiration date
    /// </summary>
    public DateOnly? WarrantyExpiration { get; set; }

    /// <summary>
    /// Notes about warranty coverage
    /// </summary>
    public string? WarrantyNotes { get; set; }

    /// <summary>
    /// Quantity of this item
    /// </summary>
    public int Quantity { get; set; } = 1;

    /// <summary>
    /// General notes
    /// </summary>
    public string? Notes { get; set; }

    /// <summary>
    /// Custom field values (JSON object keyed by CustomFieldDefinition.Id)
    /// </summary>
    public JsonDocument? CustomFields { get; set; }

    /// <summary>
    /// Authentik user ID who created this asset
    /// </summary>
    public string CreatedByUserId { get; set; } = string.Empty;

    /// <summary>
    /// Whether the asset is archived (soft delete)
    /// </summary>
    public bool IsArchived { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public Household Household { get; set; } = null!;
    public Location? Location { get; set; }
    public Category? Category { get; set; }
    public ICollection<AssetPhoto> Photos { get; set; } = [];
    public ICollection<AssetLabel> AssetLabels { get; set; } = [];
    public ICollection<MaintenanceSchedule> MaintenanceSchedules { get; set; } = [];
    public ICollection<MaintenanceLog> MaintenanceLogs { get; set; } = [];
}
