using System.ComponentModel.DataAnnotations;

namespace HLE.AssetTracker.Models.ViewModels;

public class AssetCreateViewModel
{
    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    [Display(Name = "Category")]
    public int? CategoryId { get; set; }

    [Display(Name = "Location")]
    public int? LocationId { get; set; }

    [StringLength(100)]
    public string? Manufacturer { get; set; }

    [StringLength(100)]
    public string? Model { get; set; }

    [Display(Name = "Serial Number")]
    [StringLength(100)]
    public string? SerialNumber { get; set; }

    [Display(Name = "Purchase Date")]
    [DataType(DataType.Date)]
    public DateOnly? PurchaseDate { get; set; }

    [Display(Name = "Purchase Price")]
    [DataType(DataType.Currency)]
    [Range(0, 9999999.99)]
    public decimal? PurchasePrice { get; set; }

    [Display(Name = "Purchase Location")]
    [StringLength(200)]
    public string? PurchaseLocation { get; set; }

    [Display(Name = "Warranty Expiration")]
    [DataType(DataType.Date)]
    public DateOnly? WarrantyExpiration { get; set; }

    [Display(Name = "Warranty Notes")]
    public string? WarrantyNotes { get; set; }

    [Range(1, 10000)]
    public int Quantity { get; set; } = 1;

    public string? Notes { get; set; }

    /// <summary>
    /// JSON string containing custom field values
    /// </summary>
    public string? CustomFieldsJson { get; set; }

    /// <summary>
    /// Selected label IDs
    /// </summary>
    public int[]? LabelIds { get; set; }
}

public class AssetEditViewModel : AssetCreateViewModel
{
    public int Id { get; set; }
}
