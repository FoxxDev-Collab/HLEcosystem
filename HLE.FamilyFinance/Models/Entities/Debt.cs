using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Models.Entities;

/// <summary>
/// Represents a debt or liability (mortgage, auto loan, student loan, etc.)
/// </summary>
public class Debt
{
    public int Id { get; set; }
    public int HouseholdId { get; set; }

    public DebtType Type { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Lender or creditor name
    /// </summary>
    public string? Lender { get; set; }

    /// <summary>
    /// Account number (partial for security)
    /// </summary>
    public string? AccountNumberLast4 { get; set; }

    /// <summary>
    /// Original loan amount
    /// </summary>
    public decimal OriginalPrincipal { get; set; }

    /// <summary>
    /// Current outstanding balance
    /// </summary>
    public decimal CurrentBalance { get; set; }

    /// <summary>
    /// Annual Percentage Rate (APR)
    /// </summary>
    public decimal InterestRate { get; set; }

    /// <summary>
    /// Loan term in months
    /// </summary>
    public int? TermMonths { get; set; }

    /// <summary>
    /// Minimum monthly payment required
    /// </summary>
    public decimal MinimumPayment { get; set; }

    /// <summary>
    /// Day of month when payment is due
    /// </summary>
    public int PaymentDayOfMonth { get; set; }

    /// <summary>
    /// Date when the loan originated
    /// </summary>
    public DateOnly? OriginationDate { get; set; }

    /// <summary>
    /// Expected payoff date
    /// </summary>
    public DateOnly? ExpectedPayoffDate { get; set; }

    /// <summary>
    /// Link to a financial Account for tracking purposes
    /// </summary>
    public int? LinkedAccountId { get; set; }

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
    public Account? LinkedAccount { get; set; }
    public ICollection<DebtPayment> Payments { get; set; } = [];
    public ICollection<Asset> LinkedAssets { get; set; } = [];
    public ICollection<MonthlyBill> LinkedBills { get; set; } = [];
}
