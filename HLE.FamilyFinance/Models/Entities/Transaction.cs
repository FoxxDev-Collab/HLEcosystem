using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Models.Entities;

/// <summary>
/// Represents a financial transaction (income, expense, or transfer)
/// </summary>
public class Transaction
{
    public int Id { get; set; }
    public int HouseholdId { get; set; }
    public int AccountId { get; set; }
    public int? CategoryId { get; set; }

    /// <summary>
    /// For transfers: the destination account
    /// </summary>
    public int? TransferToAccountId { get; set; }

    /// <summary>
    /// For transfers: links the two transaction records
    /// </summary>
    public int? LinkedTransactionId { get; set; }

    public TransactionType Type { get; set; }

    /// <summary>
    /// Always positive; sign determined by Type
    /// </summary>
    public decimal Amount { get; set; }

    /// <summary>
    /// Date of the transaction
    /// </summary>
    public DateOnly Date { get; set; }

    /// <summary>
    /// Payee or payer name
    /// </summary>
    public string? Payee { get; set; }

    /// <summary>
    /// Description or memo
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Reference to recurring transaction that created this
    /// </summary>
    public int? RecurringTransactionId { get; set; }

    /// <summary>
    /// Whether this has been reconciled with bank statement
    /// </summary>
    public bool IsReconciled { get; set; }

    /// <summary>
    /// Whether this is cleared at the bank
    /// </summary>
    public bool IsCleared { get; set; }

    /// <summary>
    /// Whether this transaction is a balance adjustment (should be excluded from income/expense reports)
    /// </summary>
    public bool IsBalanceAdjustment { get; set; }

    /// <summary>
    /// Optional tags for additional categorization
    /// </summary>
    public string[]? Tags { get; set; }

    /// <summary>
    /// External ID from bank (FITID from QFX/OFX) for duplicate detection
    /// </summary>
    public string? ExternalId { get; set; }

    /// <summary>
    /// User who created this transaction
    /// </summary>
    public string CreatedByUserId { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public Household Household { get; set; } = null!;
    public Account Account { get; set; } = null!;
    public Account? TransferToAccount { get; set; }
    public Category? Category { get; set; }
    public Transaction? LinkedTransaction { get; set; }
    public RecurringTransaction? RecurringTransaction { get; set; }
}
