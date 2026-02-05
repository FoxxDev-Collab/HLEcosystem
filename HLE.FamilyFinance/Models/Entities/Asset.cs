using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Models.Entities;

/// <summary>
/// Represents a tracked asset (real estate, vehicle, etc.)
/// </summary>
public class Asset
{
    public int Id { get; set; }
    public int HouseholdId { get; set; }

    public AssetType Type { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Original purchase price
    /// </summary>
    public decimal PurchasePrice { get; set; }

    /// <summary>
    /// Date the asset was purchased
    /// </summary>
    public DateOnly? PurchaseDate { get; set; }

    /// <summary>
    /// Current estimated value
    /// </summary>
    public decimal CurrentValue { get; set; }

    /// <summary>
    /// Date the current value was last updated
    /// </summary>
    public DateOnly ValueAsOfDate { get; set; }

    // Real Estate specific properties
    /// <summary>
    /// Property address (for real estate)
    /// </summary>
    public string? Address { get; set; }

    /// <summary>
    /// Property city (for real estate)
    /// </summary>
    public string? City { get; set; }

    /// <summary>
    /// Property state (for real estate)
    /// </summary>
    public string? State { get; set; }

    /// <summary>
    /// Property ZIP code (for real estate)
    /// </summary>
    public string? ZipCode { get; set; }

    /// <summary>
    /// Square footage (for real estate)
    /// </summary>
    public int? SquareFootage { get; set; }

    /// <summary>
    /// Year built (for real estate)
    /// </summary>
    public int? YearBuilt { get; set; }

    /// <summary>
    /// Annual property tax amount
    /// </summary>
    public decimal? PropertyTaxAnnual { get; set; }

    // Vehicle specific properties
    /// <summary>
    /// Vehicle make (e.g., "Toyota")
    /// </summary>
    public string? Make { get; set; }

    /// <summary>
    /// Vehicle model (e.g., "Camry")
    /// </summary>
    public string? Model { get; set; }

    /// <summary>
    /// Vehicle year
    /// </summary>
    public int? VehicleYear { get; set; }

    /// <summary>
    /// Vehicle Identification Number
    /// </summary>
    public string? VIN { get; set; }

    /// <summary>
    /// Current odometer reading
    /// </summary>
    public int? Mileage { get; set; }

    /// <summary>
    /// License plate number
    /// </summary>
    public string? LicensePlate { get; set; }

    /// <summary>
    /// Link to associated debt (mortgage, auto loan)
    /// </summary>
    public int? LinkedDebtId { get; set; }

    /// <summary>
    /// Optional icon (Bootstrap icon class)
    /// </summary>
    public string? Icon { get; set; }

    /// <summary>
    /// Optional color for display (hex code)
    /// </summary>
    public string? Color { get; set; }

    /// <summary>
    /// Whether to include in net worth calculations
    /// </summary>
    public bool IncludeInNetWorth { get; set; } = true;

    /// <summary>
    /// Optional notes
    /// </summary>
    public string? Notes { get; set; }

    public bool IsArchived { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public Household Household { get; set; } = null!;
    public Debt? LinkedDebt { get; set; }
    public ICollection<AssetValueHistory> ValueHistory { get; set; } = [];
}
