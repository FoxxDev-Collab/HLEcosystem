using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Models.Entities;

/// <summary>
/// Represents a financial account (bank account, credit card, cash, etc.)
/// </summary>
public class Account
{
    public int Id { get; set; }
    public int HouseholdId { get; set; }

    public string Name { get; set; } = string.Empty;
    public AccountType Type { get; set; }

    /// <summary>
    /// Optional institution name (e.g., "Chase", "Fidelity")
    /// </summary>
    public string? Institution { get; set; }

    /// <summary>
    /// Last 4 digits of account number (for identification)
    /// </summary>
    public string? AccountNumberLast4 { get; set; }

    /// <summary>
    /// Starting balance when account was added
    /// </summary>
    public decimal InitialBalance { get; set; }

    /// <summary>
    /// Current calculated balance (updated via transactions)
    /// </summary>
    public decimal CurrentBalance { get; set; }

    /// <summary>
    /// For credit cards: the credit limit
    /// </summary>
    public decimal? CreditLimit { get; set; }

    /// <summary>
    /// Interest rate for credit cards or loans
    /// </summary>
    public decimal? InterestRate { get; set; }

    /// <summary>
    /// For HSA accounts: Annual contribution limit based on coverage type
    /// </summary>
    public decimal? HsaAnnualLimit { get; set; }

    /// <summary>
    /// For HSA accounts: Whether this is family coverage (true) or individual (false)
    /// </summary>
    public bool? HsaFamilyCoverage { get; set; }

    /// <summary>
    /// Currency code (e.g., "USD", "EUR")
    /// </summary>
    public string Currency { get; set; } = "USD";

    /// <summary>
    /// Optional notes about the account
    /// </summary>
    public string? Notes { get; set; }

    /// <summary>
    /// Optional color for display (hex code)
    /// </summary>
    public string? Color { get; set; }

    /// <summary>
    /// Optional icon (emoji or icon class)
    /// </summary>
    public string? Icon { get; set; }

    public bool IsArchived { get; set; }
    public bool IncludeInNetWorth { get; set; } = true;
    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public Household Household { get; set; } = null!;
    public ICollection<Transaction> Transactions { get; set; } = [];
    public ICollection<RecurringTransaction> RecurringTransactions { get; set; } = [];
}
