using System.ComponentModel.DataAnnotations;
using HLE.FamilyHub.Models.Enums;

namespace HLE.FamilyHub.Models.ViewModels;

/// <summary>
/// View model for creating a new gift idea.
/// </summary>
public class GiftIdeaCreateViewModel
{
    /// <summary>
    /// Gift idea description.
    /// </summary>
    [Required(ErrorMessage = "Gift idea is required")]
    [StringLength(500)]
    public string Idea { get; set; } = "";

    /// <summary>
    /// Optional family member this gift idea is for.
    /// </summary>
    [Display(Name = "Family Member")]
    public int? FamilyMemberId { get; set; }

    /// <summary>
    /// Source of the idea (e.g., conversation, website, store).
    /// </summary>
    [StringLength(200)]
    public string? Source { get; set; }

    /// <summary>
    /// Priority level of this gift idea.
    /// </summary>
    [Required]
    public GiftIdeaPriority Priority { get; set; } = GiftIdeaPriority.Medium;

    /// <summary>
    /// Estimated cost.
    /// </summary>
    [Display(Name = "Estimated Cost")]
    [Range(0, 999999.99)]
    [DataType(DataType.Currency)]
    public decimal? EstimatedCost { get; set; }

    /// <summary>
    /// URL to product or reference.
    /// </summary>
    [Url]
    [StringLength(1000)]
    public string? Url { get; set; }

    /// <summary>
    /// Additional notes.
    /// </summary>
    [StringLength(2000)]
    public string? Notes { get; set; }
}
