using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Models.Entities;

/// <summary>
/// Represents a template for automatically creating recurring transactions
/// </summary>
public class RecurringTransaction
{
    public int Id { get; set; }
    public int HouseholdId { get; set; }
    public int AccountId { get; set; }
    public int? CategoryId { get; set; }
    public int? TransferToAccountId { get; set; }

    public string Name { get; set; } = string.Empty;
    public TransactionType Type { get; set; }
    public decimal Amount { get; set; }
    public string? Payee { get; set; }
    public string? Description { get; set; }

    /// <summary>
    /// Frequency of recurrence
    /// </summary>
    public RecurrenceFrequency Frequency { get; set; }

    /// <summary>
    /// Interval (e.g., 2 for "every 2 weeks")
    /// </summary>
    public int FrequencyInterval { get; set; } = 1;

    /// <summary>
    /// Day of month for monthly (1-31), day of week for weekly (0-6)
    /// </summary>
    public int DayOfPeriod { get; set; }

    /// <summary>
    /// Start date for the recurrence
    /// </summary>
    public DateOnly StartDate { get; set; }

    /// <summary>
    /// Optional end date
    /// </summary>
    public DateOnly? EndDate { get; set; }

    /// <summary>
    /// Next date this transaction will be created
    /// </summary>
    public DateOnly NextOccurrence { get; set; }

    /// <summary>
    /// Last date a transaction was created
    /// </summary>
    public DateOnly? LastProcessed { get; set; }

    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Whether to automatically create transactions or just notify
    /// </summary>
    public bool AutoCreate { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public Household Household { get; set; } = null!;
    public Account Account { get; set; } = null!;
    public Account? TransferToAccount { get; set; }
    public Category? Category { get; set; }
    public ICollection<Transaction> GeneratedTransactions { get; set; } = [];
}
