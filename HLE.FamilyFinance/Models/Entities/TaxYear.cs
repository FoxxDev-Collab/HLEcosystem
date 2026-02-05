using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Models.Entities;

/// <summary>
/// Represents a tax year for tracking documents and filing status
/// </summary>
public class TaxYear
{
    public int Id { get; set; }
    public int HouseholdId { get; set; }

    /// <summary>
    /// Tax year (e.g., 2025)
    /// </summary>
    public int Year { get; set; }

    public TaxFilingStatus FederalFilingStatus { get; set; }

    /// <summary>
    /// State of residence for state taxes
    /// </summary>
    public string? State { get; set; }

    /// <summary>
    /// Whether federal taxes have been filed
    /// </summary>
    public bool IsFederalFiled { get; set; }

    /// <summary>
    /// Date federal taxes were filed
    /// </summary>
    public DateOnly? FederalFiledDate { get; set; }

    /// <summary>
    /// Whether state taxes have been filed
    /// </summary>
    public bool IsStateFiled { get; set; }

    /// <summary>
    /// Date state taxes were filed
    /// </summary>
    public DateOnly? StateFiledDate { get; set; }

    /// <summary>
    /// Federal refund amount (negative = amount owed)
    /// </summary>
    public decimal? FederalRefund { get; set; }

    /// <summary>
    /// State refund amount (negative = amount owed)
    /// </summary>
    public decimal? StateRefund { get; set; }

    /// <summary>
    /// Whether the refund has been received
    /// </summary>
    public bool RefundReceived { get; set; }

    /// <summary>
    /// Date refund was received
    /// </summary>
    public DateOnly? RefundReceivedDate { get; set; }

    /// <summary>
    /// Notes about this tax year
    /// </summary>
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public Household Household { get; set; } = null!;
    public ICollection<TaxDocument> Documents { get; set; } = [];
}
