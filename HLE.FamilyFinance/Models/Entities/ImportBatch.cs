using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Models.Entities;

/// <summary>
/// Represents a batch of imported transactions from a file
/// </summary>
public class ImportBatch
{
    public int Id { get; set; }
    public int HouseholdId { get; set; }
    public int AccountId { get; set; }

    /// <summary>
    /// Original filename that was imported
    /// </summary>
    public string FileName { get; set; } = string.Empty;

    /// <summary>
    /// Format of the imported file
    /// </summary>
    public ImportFileFormat Format { get; set; }

    /// <summary>
    /// When the import was performed
    /// </summary>
    public DateTime ImportedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// User who performed the import
    /// </summary>
    public string? ImportedByUserId { get; set; }

    /// <summary>
    /// Total rows found in the file
    /// </summary>
    public int TotalRows { get; set; }

    /// <summary>
    /// Number of transactions successfully imported
    /// </summary>
    public int ImportedCount { get; set; }

    /// <summary>
    /// Number of duplicate transactions skipped
    /// </summary>
    public int DuplicateCount { get; set; }

    /// <summary>
    /// Number of transactions skipped for other reasons
    /// </summary>
    public int SkippedCount { get; set; }

    /// <summary>
    /// Whether import has been finalized
    /// </summary>
    public bool IsFinalized { get; set; }

    /// <summary>
    /// Notes about this import
    /// </summary>
    public string? Notes { get; set; }

    // Navigation properties
    public Household Household { get; set; } = null!;
    public Account Account { get; set; } = null!;
    public ICollection<ImportedTransaction> Transactions { get; set; } = [];
}
