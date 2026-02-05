using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Models.Entities;

/// <summary>
/// Represents a recurring monthly bill
/// </summary>
public class MonthlyBill
{
    public int Id { get; set; }
    public int HouseholdId { get; set; }

    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Company or person to pay
    /// </summary>
    public string? Payee { get; set; }

    public BillCategory Category { get; set; }

    /// <summary>
    /// Expected/typical amount
    /// </summary>
    public decimal ExpectedAmount { get; set; }

    /// <summary>
    /// Whether the amount varies month to month
    /// </summary>
    public bool IsVariableAmount { get; set; }

    /// <summary>
    /// Day of month when payment is due
    /// </summary>
    public int DueDayOfMonth { get; set; }

    /// <summary>
    /// Whether this bill is set up for automatic payment
    /// </summary>
    public bool AutoPay { get; set; }

    /// <summary>
    /// Account used for auto-pay
    /// </summary>
    public int? AutoPayAccountId { get; set; }

    /// <summary>
    /// Link to associated debt (if this is a debt payment)
    /// </summary>
    public int? LinkedDebtId { get; set; }

    /// <summary>
    /// Category for transaction categorization
    /// </summary>
    public int? DefaultCategoryId { get; set; }

    /// <summary>
    /// Optional icon (Bootstrap icon class)
    /// </summary>
    public string? Icon { get; set; }

    /// <summary>
    /// Optional color for display (hex code)
    /// </summary>
    public string? Color { get; set; }

    /// <summary>
    /// Website URL for the biller
    /// </summary>
    public string? WebsiteUrl { get; set; }

    /// <summary>
    /// Notes or account info
    /// </summary>
    public string? Notes { get; set; }

    /// <summary>
    /// Whether this bill is currently active
    /// </summary>
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public Household Household { get; set; } = null!;
    public Account? AutoPayAccount { get; set; }
    public Debt? LinkedDebt { get; set; }
    public Category? DefaultCategory { get; set; }
    public ICollection<BillPayment> Payments { get; set; } = [];
}
