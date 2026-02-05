using System.ComponentModel.DataAnnotations;
using HLE.FamilyHub.Models.Enums;

namespace HLE.FamilyHub.Models.ViewModels;

/// <summary>
/// View model for creating a new gift record.
/// </summary>
public class GiftCreateViewModel
{
    /// <summary>
    /// Family member who received or will receive the gift.
    /// </summary>
    [Required(ErrorMessage = "Family member is required")]
    [Display(Name = "Family Member")]
    public int FamilyMemberId { get; set; }

    /// <summary>
    /// Description of the gift.
    /// </summary>
    [Required(ErrorMessage = "Description is required")]
    [StringLength(500)]
    public string Description { get; set; } = "";

    /// <summary>
    /// Date the gift was or will be given.
    /// </summary>
    [Display(Name = "Gift Date")]
    public DateOnly? GiftDate { get; set; }

    /// <summary>
    /// Occasion for the gift (e.g., Birthday, Christmas, Anniversary).
    /// </summary>
    [StringLength(100)]
    public string? Occasion { get; set; }

    /// <summary>
    /// Current status of the gift.
    /// </summary>
    [Required]
    public GiftStatus Status { get; set; } = GiftStatus.Purchased;

    /// <summary>
    /// Estimated cost before purchase.
    /// </summary>
    [Display(Name = "Estimated Cost")]
    [Range(0, 999999.99)]
    [DataType(DataType.Currency)]
    public decimal? EstimatedCost { get; set; }

    /// <summary>
    /// Actual cost paid.
    /// </summary>
    [Display(Name = "Actual Cost")]
    [Range(0, 999999.99)]
    [DataType(DataType.Currency)]
    public decimal? ActualCost { get; set; }

    /// <summary>
    /// Rating of how well the gift was received (1-5).
    /// </summary>
    [Range(1, 5)]
    public int? Rating { get; set; }

    /// <summary>
    /// Additional notes about the gift.
    /// </summary>
    [StringLength(2000)]
    public string? Notes { get; set; }
}
