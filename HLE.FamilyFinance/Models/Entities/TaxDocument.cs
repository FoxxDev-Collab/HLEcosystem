using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Models.Entities;

/// <summary>
/// Represents a tax document (W-2, 1099, etc.) for a tax year
/// </summary>
public class TaxDocument
{
    public int Id { get; set; }
    public int TaxYearId { get; set; }

    public TaxDocumentType DocumentType { get; set; }

    /// <summary>
    /// Issuer/employer name
    /// </summary>
    public string Issuer { get; set; } = string.Empty;

    /// <summary>
    /// Description or additional info
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Gross/total amount on the document
    /// </summary>
    public decimal? GrossAmount { get; set; }

    /// <summary>
    /// Federal tax withheld
    /// </summary>
    public decimal? FederalWithheld { get; set; }

    /// <summary>
    /// State tax withheld
    /// </summary>
    public decimal? StateWithheld { get; set; }

    /// <summary>
    /// Social Security tax withheld (for W-2)
    /// </summary>
    public decimal? SocialSecurityWithheld { get; set; }

    /// <summary>
    /// Medicare tax withheld (for W-2)
    /// </summary>
    public decimal? MedicareWithheld { get; set; }

    /// <summary>
    /// Whether the document has been received
    /// </summary>
    public bool IsReceived { get; set; }

    /// <summary>
    /// Date the document was received
    /// </summary>
    public DateOnly? ReceivedDate { get; set; }

    /// <summary>
    /// Expected date to receive (for tracking)
    /// </summary>
    public DateOnly? ExpectedDate { get; set; }

    /// <summary>
    /// Optional notes
    /// </summary>
    public string? Notes { get; set; }

    // File attachment properties
    /// <summary>
    /// Original filename of the uploaded document
    /// </summary>
    public string? UploadedFileName { get; set; }

    /// <summary>
    /// Relative path to the stored file
    /// </summary>
    public string? StoragePath { get; set; }

    /// <summary>
    /// File size in bytes
    /// </summary>
    public long? FileSize { get; set; }

    /// <summary>
    /// SHA-256 hash for file integrity verification
    /// </summary>
    public string? ContentHash { get; set; }

    /// <summary>
    /// When the file was uploaded
    /// </summary>
    public DateTime? UploadedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public TaxYear TaxYear { get; set; } = null!;
}
