using HLE.AssetTracker.Data;
using HLE.AssetTracker.Models.Entities;
using HLE.AssetTracker.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HLE.AssetTracker.Services;

public class VehicleService : IVehicleService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<VehicleService> _logger;

    public VehicleService(ApplicationDbContext context, ILogger<VehicleService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<List<Vehicle>> GetVehiclesAsync(int householdId, bool includeArchived = false, CancellationToken ct = default)
    {
        var query = _context.Vehicles
            .AsNoTracking()
            .Where(v => v.HouseholdId == householdId);

        if (!includeArchived)
        {
            query = query.Where(v => !v.IsArchived);
        }

        return await query
            .OrderBy(v => v.Year)
            .ThenBy(v => v.Make)
            .ThenBy(v => v.Model)
            .ToListAsync(ct);
    }

    public async Task<Vehicle?> GetVehicleAsync(int id, int householdId, CancellationToken ct = default)
    {
        return await _context.Vehicles
            .AsNoTracking()
            .Include(v => v.OdometerReadings.OrderByDescending(or => or.ReadingDate).Take(10))
            .Include(v => v.FuelLogs.OrderByDescending(fl => fl.FillUpDate).Take(10))
            .FirstOrDefaultAsync(v => v.Id == id && v.HouseholdId == householdId, ct);
    }

    public async Task<Vehicle> CreateVehicleAsync(Vehicle vehicle, CancellationToken ct = default)
    {
        vehicle.CreatedAt = DateTime.UtcNow;
        vehicle.UpdatedAt = DateTime.UtcNow;

        _context.Vehicles.Add(vehicle);
        await _context.SaveChangesAsync(ct);

        return vehicle;
    }

    public async Task<Vehicle> UpdateVehicleAsync(Vehicle vehicle, CancellationToken ct = default)
    {
        vehicle.UpdatedAt = DateTime.UtcNow;

        _context.Vehicles.Update(vehicle);
        await _context.SaveChangesAsync(ct);

        return vehicle;
    }

    public async Task ArchiveVehicleAsync(int id, int householdId, CancellationToken ct = default)
    {
        var vehicle = await _context.Vehicles
            .FirstOrDefaultAsync(v => v.Id == id && v.HouseholdId == householdId, ct);

        if (vehicle == null)
            throw new InvalidOperationException("Vehicle not found");

        vehicle.IsArchived = true;
        vehicle.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);
    }

    public async Task RestoreVehicleAsync(int id, int householdId, CancellationToken ct = default)
    {
        var vehicle = await _context.Vehicles
            .FirstOrDefaultAsync(v => v.Id == id && v.HouseholdId == householdId, ct);

        if (vehicle == null)
            throw new InvalidOperationException("Vehicle not found");

        vehicle.IsArchived = false;
        vehicle.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);
    }

    public async Task DeleteVehicleAsync(int id, int householdId, CancellationToken ct = default)
    {
        var vehicle = await _context.Vehicles
            .FirstOrDefaultAsync(v => v.Id == id && v.HouseholdId == householdId, ct);

        if (vehicle == null)
            throw new InvalidOperationException("Vehicle not found");

        // Cascade delete will handle OdometerReadings and FuelLogs
        _context.Vehicles.Remove(vehicle);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Permanently deleted vehicle {VehicleId} from household {HouseholdId}", id, householdId);
    }

    public async Task AddOdometerReadingAsync(int vehicleId, int householdId, int odometer, DateTime readingDate, string userId, string? notes = null, CancellationToken ct = default)
    {
        var vehicle = await _context.Vehicles
            .FirstOrDefaultAsync(v => v.Id == vehicleId && v.HouseholdId == householdId, ct);

        if (vehicle == null)
            throw new InvalidOperationException("Vehicle not found");

        var reading = new OdometerReading
        {
            VehicleId = vehicleId,
            ReadingDate = readingDate,
            Odometer = odometer,
            Notes = notes,
            RecordedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        _context.OdometerReadings.Add(reading);

        // Update vehicle's current odometer if this is the latest reading
        if (odometer > vehicle.CurrentOdometer)
        {
            vehicle.CurrentOdometer = odometer;
            vehicle.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(ct);
    }

    public async Task<List<OdometerReading>> GetOdometerHistoryAsync(int vehicleId, int householdId, CancellationToken ct = default)
    {
        // Verify vehicle belongs to household
        var vehicleExists = await _context.Vehicles
            .AnyAsync(v => v.Id == vehicleId && v.HouseholdId == householdId, ct);

        if (!vehicleExists)
            return new List<OdometerReading>();

        return await _context.OdometerReadings
            .AsNoTracking()
            .Where(or => or.VehicleId == vehicleId)
            .OrderByDescending(or => or.ReadingDate)
            .ToListAsync(ct);
    }

    public async Task AddFuelLogAsync(int vehicleId, int householdId, int odometer, DateTime fillUpDate, decimal quantity, string quantityUnit, decimal totalCost, decimal pricePerUnit, string? fuelType, bool isFullTank, string userId, string? notes = null, CancellationToken ct = default)
    {
        var vehicle = await _context.Vehicles
            .FirstOrDefaultAsync(v => v.Id == vehicleId && v.HouseholdId == householdId, ct);

        if (vehicle == null)
            throw new InvalidOperationException("Vehicle not found");

        var fuelLog = new FuelLog
        {
            VehicleId = vehicleId,
            FillUpDate = fillUpDate,
            Odometer = odometer,
            Quantity = quantity,
            QuantityUnit = quantityUnit,
            TotalCost = totalCost,
            PricePerUnit = pricePerUnit,
            FuelType = fuelType,
            IsFullTank = isFullTank,
            Notes = notes,
            LoggedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        // Calculate MPG if this is a full tank
        if (isFullTank)
        {
            var previousFullTank = await _context.FuelLogs
                .Where(fl => fl.VehicleId == vehicleId && fl.IsFullTank && fl.FillUpDate < fillUpDate)
                .OrderByDescending(fl => fl.FillUpDate)
                .FirstOrDefaultAsync(ct);

            if (previousFullTank != null)
            {
                var milesDriven = odometer - previousFullTank.Odometer;
                fuelLog.MilesDriven = milesDriven;

                if (quantity > 0)
                {
                    fuelLog.CalculatedMPG = Math.Round((decimal)milesDriven / quantity, 2);
                }
            }
        }

        _context.FuelLogs.Add(fuelLog);

        // Update vehicle's current odometer
        if (odometer > vehicle.CurrentOdometer)
        {
            vehicle.CurrentOdometer = odometer;
            vehicle.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(ct);
    }

    public async Task<List<FuelLog>> GetFuelLogsAsync(int vehicleId, int householdId, CancellationToken ct = default)
    {
        var vehicleExists = await _context.Vehicles
            .AnyAsync(v => v.Id == vehicleId && v.HouseholdId == householdId, ct);

        if (!vehicleExists)
            return new List<FuelLog>();

        return await _context.FuelLogs
            .AsNoTracking()
            .Where(fl => fl.VehicleId == vehicleId)
            .OrderByDescending(fl => fl.FillUpDate)
            .ToListAsync(ct);
    }

    public async Task<decimal?> CalculateAverageMPGAsync(int vehicleId, int householdId, CancellationToken ct = default)
    {
        var vehicleExists = await _context.Vehicles
            .AnyAsync(v => v.Id == vehicleId && v.HouseholdId == householdId, ct);

        if (!vehicleExists)
            return null;

        var mpgValues = await _context.FuelLogs
            .Where(fl => fl.VehicleId == vehicleId && fl.CalculatedMPG.HasValue)
            .Select(fl => fl.CalculatedMPG!.Value)
            .ToListAsync(ct);

        return mpgValues.Any() ? Math.Round(mpgValues.Average(), 2) : null;
    }

    public async Task<decimal?> CalculateRecentMPGAsync(int vehicleId, int householdId, int lastNFillups = 3, CancellationToken ct = default)
    {
        var vehicleExists = await _context.Vehicles
            .AnyAsync(v => v.Id == vehicleId && v.HouseholdId == householdId, ct);

        if (!vehicleExists)
            return null;

        var mpgValues = await _context.FuelLogs
            .Where(fl => fl.VehicleId == vehicleId && fl.CalculatedMPG.HasValue)
            .OrderByDescending(fl => fl.FillUpDate)
            .Take(lastNFillups)
            .Select(fl => fl.CalculatedMPG!.Value)
            .ToListAsync(ct);

        return mpgValues.Any() ? Math.Round(mpgValues.Average(), 2) : null;
    }

    public async Task<int> GetMilesDrivenThisMonthAsync(int vehicleId, int householdId, CancellationToken ct = default)
    {
        var vehicleExists = await _context.Vehicles
            .AnyAsync(v => v.Id == vehicleId && v.HouseholdId == householdId, ct);

        if (!vehicleExists)
            return 0;

        var startOfMonth = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var milesDriven = await _context.FuelLogs
            .Where(fl => fl.VehicleId == vehicleId && fl.FillUpDate >= startOfMonth && fl.MilesDriven.HasValue)
            .SumAsync(fl => fl.MilesDriven!.Value, ct);

        return milesDriven;
    }

    public async Task<decimal> GetFuelCostThisMonthAsync(int vehicleId, int householdId, CancellationToken ct = default)
    {
        var vehicleExists = await _context.Vehicles
            .AnyAsync(v => v.Id == vehicleId && v.HouseholdId == householdId, ct);

        if (!vehicleExists)
            return 0;

        var startOfMonth = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var totalCost = await _context.FuelLogs
            .Where(fl => fl.VehicleId == vehicleId && fl.FillUpDate >= startOfMonth)
            .SumAsync(fl => fl.TotalCost, ct);

        return totalCost;
    }
}
