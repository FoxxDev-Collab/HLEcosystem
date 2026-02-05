using HLE.AssetTracker.Models.Entities;

namespace HLE.AssetTracker.Services.Interfaces;

public interface IVehicleService
{
    // Vehicle CRUD
    Task<List<Vehicle>> GetVehiclesAsync(int householdId, bool includeArchived = false, CancellationToken ct = default);
    Task<Vehicle?> GetVehicleAsync(int id, int householdId, CancellationToken ct = default);
    Task<Vehicle> CreateVehicleAsync(Vehicle vehicle, CancellationToken ct = default);
    Task<Vehicle> UpdateVehicleAsync(Vehicle vehicle, CancellationToken ct = default);
    Task ArchiveVehicleAsync(int id, int householdId, CancellationToken ct = default);
    Task RestoreVehicleAsync(int id, int householdId, CancellationToken ct = default);

    // Odometer Management
    Task AddOdometerReadingAsync(int vehicleId, int householdId, int odometer, DateTime readingDate, string userId, string? notes = null, CancellationToken ct = default);
    Task<List<OdometerReading>> GetOdometerHistoryAsync(int vehicleId, int householdId, CancellationToken ct = default);

    // Fuel Log Management
    Task AddFuelLogAsync(int vehicleId, int householdId, int odometer, DateTime fillUpDate, decimal quantity, string quantityUnit, decimal totalCost, decimal pricePerUnit, string? fuelType, bool isFullTank, string userId, string? notes = null, CancellationToken ct = default);
    Task<List<FuelLog>> GetFuelLogsAsync(int vehicleId, int householdId, CancellationToken ct = default);

    // Delete
    Task DeleteVehicleAsync(int id, int householdId, CancellationToken ct = default);

    // Statistics
    Task<decimal?> CalculateAverageMPGAsync(int vehicleId, int householdId, CancellationToken ct = default);
    Task<decimal?> CalculateRecentMPGAsync(int vehicleId, int householdId, int lastNFillups = 3, CancellationToken ct = default);
    Task<int> GetMilesDrivenThisMonthAsync(int vehicleId, int householdId, CancellationToken ct = default);
    Task<decimal> GetFuelCostThisMonthAsync(int vehicleId, int householdId, CancellationToken ct = default);
}
