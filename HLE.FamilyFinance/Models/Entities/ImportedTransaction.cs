using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Models.Entities;

/// <summary>
/// Staging record for an imported transaction before confirmation
/// </summary>
public class ImportedTransaction
{
    public int Id { get; set; }
    public int ImportBatchId { get; set; }

    /// <summary>
    /// Transaction date from the file
    /// </summary>
    public DateOnly Date { get; set; }

    /// <summary>
    /// Transaction amount (positive = credit/deposit, negative = debit/withdrawal)
    /// </summary>
    public decimal Amount { get; set; }

    /// <summary>
    /// Description from the file
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Payee name (parsed or raw)
    /// </summary>
    public string? Payee { get; set; }

    /// <summary>
    /// Check number if applicable
    /// </summary>
    public string? CheckNumber { get; set; }

    /// <summary>
    /// Reference/confirmation number
    /// </summary>
    public string? ReferenceNumber { get; set; }

    /// <summary>
    /// Raw data from the file for debugging
    /// </summary>
    public string? RawData { get; set; }

    /// <summary>
    /// Current status of this imported transaction
    /// </summary>
    public ImportMatchStatus MatchStatus { get; set; } = ImportMatchStatus.Pending;

    /// <summary>
    /// If matched to existing transaction
    /// </summary>
    public int? MatchedTransactionId { get; set; }

    /// <summary>
    /// Suggested category based on rules
    /// </summary>
    public int? SuggestedCategoryId { get; set; }

    /// <summary>
    /// The transaction created from this import (after confirmation)
    /// </summary>
    public int? CreatedTransactionId { get; set; }

    /// <summary>
    /// Notes about matching or categorization
    /// </summary>
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ImportBatch ImportBatch { get; set; } = null!;
    public Transaction? MatchedTransaction { get; set; }
    public Category? SuggestedCategory { get; set; }
    public Transaction? CreatedTransaction { get; set; }
}
