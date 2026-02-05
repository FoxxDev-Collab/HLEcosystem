namespace HLE.AssetTracker.Models.Entities;

public class Vehicle
{
    public int Id { get; set; }
    public int HouseholdId { get; set; }
    public int? AssetId { get; set; }  // Optional link to existing Asset

    // Vehicle Identification
    public string? VIN { get; set; }
    public string Make { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public int? Year { get; set; }
    public string? LicensePlate { get; set; }
    public string? Color { get; set; }
    public string? VehicleType { get; set; }  // Car, Truck, Motorcycle, etc.

    // Odometer Tracking
    public int CurrentOdometer { get; set; }
    public string OdometerUnit { get; set; } = "Miles";  // Miles or Kilometers

    // Metadata
    public string? Notes { get; set; }
    public string CreatedByUserId { get; set; } = string.Empty;
    public bool IsArchived { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation Properties
    public Household Household { get; set; } = null!;
    public Asset? Asset { get; set; }
    public ICollection<OdometerReading> OdometerReadings { get; set; } = new List<OdometerReading>();
    public ICollection<FuelLog> FuelLogs { get; set; } = new List<FuelLog>();
}
