namespace HLE.AssetTracker.Models.Entities;

public class FuelLog
{
    public int Id { get; set; }
    public int VehicleId { get; set; }
    public DateTime FillUpDate { get; set; }
    public int Odometer { get; set; }

    // Fuel Details
    public decimal Quantity { get; set; }  // Amount of fuel
    public string QuantityUnit { get; set; } = "Gallons";  // Gallons or Liters
    public decimal TotalCost { get; set; }
    public decimal PricePerUnit { get; set; }  // Calculated or entered
    public string? FuelType { get; set; }  // Regular, Premium, Diesel, Electric, etc.

    // Calculation Fields
    public bool IsFullTank { get; set; }
    public decimal? CalculatedMPG { get; set; }  // Automatically calculated
    public int? MilesDriven { get; set; }  // Miles since last fill-up

    // Metadata
    public string? Notes { get; set; }
    public string LoggedByUserId { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    // Navigation Properties
    public Vehicle Vehicle { get; set; } = null!;
}
