namespace HLE.AssetTracker.Models.Entities;

public class OdometerReading
{
    public int Id { get; set; }
    public int VehicleId { get; set; }
    public DateTime ReadingDate { get; set; }
    public int Odometer { get; set; }
    public string? Notes { get; set; }
    public string RecordedByUserId { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    // Navigation Properties
    public Vehicle Vehicle { get; set; } = null!;
}
