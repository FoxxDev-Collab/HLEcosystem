using System.ComponentModel.DataAnnotations;

namespace HLE.AssetTracker.Models.ViewModels;

public class VehicleCreateViewModel
{
    [Required(ErrorMessage = "Make is required")]
    [StringLength(100)]
    public string Make { get; set; } = string.Empty;

    [Required(ErrorMessage = "Model is required")]
    [StringLength(100)]
    public string Model { get; set; } = string.Empty;

    [Range(1900, 2100, ErrorMessage = "Year must be between 1900 and 2100")]
    public int? Year { get; set; }

    [StringLength(17, ErrorMessage = "VIN must be 17 characters or less")]
    public string? VIN { get; set; }

    [StringLength(20)]
    public string? LicensePlate { get; set; }

    [StringLength(50)]
    public string? Color { get; set; }

    [StringLength(50)]
    public string? VehicleType { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "Current odometer must be positive")]
    public int CurrentOdometer { get; set; }

    [Required]
    public string OdometerUnit { get; set; } = "Miles";

    [StringLength(1000)]
    public string? Notes { get; set; }

    public int? AssetId { get; set; }
}

public class VehicleEditViewModel
{
    public int Id { get; set; }

    [Required(ErrorMessage = "Make is required")]
    [StringLength(100)]
    public string Make { get; set; } = string.Empty;

    [Required(ErrorMessage = "Model is required")]
    [StringLength(100)]
    public string Model { get; set; } = string.Empty;

    [Range(1900, 2100, ErrorMessage = "Year must be between 1900 and 2100")]
    public int? Year { get; set; }

    [StringLength(17, ErrorMessage = "VIN must be 17 characters or less")]
    public string? VIN { get; set; }

    [StringLength(20)]
    public string? LicensePlate { get; set; }

    [StringLength(50)]
    public string? Color { get; set; }

    [StringLength(50)]
    public string? VehicleType { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "Current odometer must be positive")]
    public int CurrentOdometer { get; set; }

    [Required]
    public string OdometerUnit { get; set; } = "Miles";

    [StringLength(1000)]
    public string? Notes { get; set; }

    public int? AssetId { get; set; }
}

public class OdometerReadingViewModel
{
    public int VehicleId { get; set; }

    [Required]
    public DateTime ReadingDate { get; set; } = DateTime.Now;

    [Required]
    [Range(0, int.MaxValue, ErrorMessage = "Odometer must be positive")]
    public int Odometer { get; set; }

    [StringLength(500)]
    public string? Notes { get; set; }
}

public class FuelLogViewModel
{
    public int VehicleId { get; set; }

    [Required]
    public DateTime FillUpDate { get; set; } = DateTime.Now;

    [Required]
    [Range(0, int.MaxValue, ErrorMessage = "Odometer must be positive")]
    public int Odometer { get; set; }

    [Required]
    [Range(0.01, 1000, ErrorMessage = "Quantity must be between 0.01 and 1000")]
    public decimal Quantity { get; set; }

    [Required]
    public string QuantityUnit { get; set; } = "Gallons";

    [Required]
    [Range(0.01, 10000, ErrorMessage = "Total cost must be between 0.01 and 10000")]
    public decimal TotalCost { get; set; }

    [Required]
    [Range(0.01, 100, ErrorMessage = "Price per unit must be between 0.01 and 100")]
    public decimal PricePerUnit { get; set; }

    [StringLength(50)]
    public string? FuelType { get; set; }

    public bool IsFullTank { get; set; } = true;

    [StringLength(500)]
    public string? Notes { get; set; }
}
