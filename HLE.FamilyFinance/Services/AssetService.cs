using HLE.FamilyFinance.Data;
using HLE.FamilyFinance.Models.Entities;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyFinance.Services;

public class AssetService(ApplicationDbContext context, ILogger<AssetService> logger) : IAssetService
{
    public async Task<List<AssetSummaryDto>> GetAssetsAsync(int householdId, CancellationToken ct = default)
    {
        return await context.Assets
            .AsNoTracking()
            .Where(a => a.HouseholdId == householdId && !a.IsArchived)
            .OrderBy(a => a.Type)
            .ThenBy(a => a.Name)
            .Select(a => new AssetSummaryDto(
                a.Id,
                a.Name,
                a.Type,
                a.CurrentValue,
                a.ValueAsOfDate,
                a.Icon,
                a.Color,
                a.IsArchived
            ))
            .ToListAsync(ct);
    }

    public async Task<List<AssetSummaryDto>> GetAssetsByTypeAsync(int householdId, AssetType type, CancellationToken ct = default)
    {
        return await context.Assets
            .AsNoTracking()
            .Where(a => a.HouseholdId == householdId && a.Type == type && !a.IsArchived)
            .OrderBy(a => a.Name)
            .Select(a => new AssetSummaryDto(
                a.Id,
                a.Name,
                a.Type,
                a.CurrentValue,
                a.ValueAsOfDate,
                a.Icon,
                a.Color,
                a.IsArchived
            ))
            .ToListAsync(ct);
    }

    public async Task<AssetDetailDto?> GetAssetAsync(int id, int householdId, CancellationToken ct = default)
    {
        var asset = await context.Assets
            .AsNoTracking()
            .Include(a => a.LinkedDebt)
            .Where(a => a.Id == id && a.HouseholdId == householdId)
            .FirstOrDefaultAsync(ct);

        if (asset == null) return null;

        var appreciationPercent = asset.PurchasePrice > 0
            ? ((asset.CurrentValue - asset.PurchasePrice) / asset.PurchasePrice) * 100
            : 0;

        return new AssetDetailDto(
            asset.Id,
            asset.Name,
            asset.Type,
            asset.PurchasePrice,
            asset.PurchaseDate,
            asset.CurrentValue,
            asset.ValueAsOfDate,
            asset.Address,
            asset.City,
            asset.State,
            asset.ZipCode,
            asset.SquareFootage,
            asset.YearBuilt,
            asset.PropertyTaxAnnual,
            asset.Make,
            asset.Model,
            asset.VehicleYear,
            asset.VIN,
            asset.Mileage,
            asset.LicensePlate,
            asset.LinkedDebtId,
            asset.LinkedDebt?.Name,
            asset.Icon,
            asset.Color,
            asset.Notes,
            asset.IncludeInNetWorth,
            asset.IsArchived,
            appreciationPercent
        );
    }

    public async Task<Asset> CreateAssetAsync(int householdId, AssetCreateDto dto, CancellationToken ct = default)
    {
        var asset = new Asset
        {
            HouseholdId = householdId,
            Name = dto.Name,
            Type = dto.Type,
            PurchasePrice = dto.PurchasePrice,
            PurchaseDate = dto.PurchaseDate,
            CurrentValue = dto.CurrentValue,
            ValueAsOfDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Address = dto.Address,
            City = dto.City,
            State = dto.State,
            ZipCode = dto.ZipCode,
            SquareFootage = dto.SquareFootage,
            YearBuilt = dto.YearBuilt,
            PropertyTaxAnnual = dto.PropertyTaxAnnual,
            Make = dto.Make,
            Model = dto.VehicleModel,
            VehicleYear = dto.VehicleYear,
            VIN = dto.VIN,
            Mileage = dto.Mileage,
            LicensePlate = dto.LicensePlate,
            LinkedDebtId = dto.LinkedDebtId,
            Icon = dto.Icon,
            Color = dto.Color,
            Notes = dto.Notes,
            IncludeInNetWorth = dto.IncludeInNetWorth,
            CreatedAt = DateTime.UtcNow
        };

        context.Assets.Add(asset);
        await context.SaveChangesAsync(ct);

        // Add initial value history entry
        var historyEntry = new AssetValueHistory
        {
            AssetId = asset.Id,
            Date = asset.ValueAsOfDate,
            Value = asset.CurrentValue,
            Source = "Initial",
            CreatedAt = DateTime.UtcNow
        };
        context.AssetValueHistory.Add(historyEntry);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Created asset {AssetId} '{Name}' for household {HouseholdId}", asset.Id, dto.Name, householdId);
        return asset;
    }

    public async Task UpdateAssetAsync(int id, int householdId, AssetCreateDto dto, CancellationToken ct = default)
    {
        var asset = await context.Assets
            .FirstOrDefaultAsync(a => a.Id == id && a.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Asset not found");

        asset.Name = dto.Name;
        asset.Type = dto.Type;
        asset.PurchasePrice = dto.PurchasePrice;
        asset.PurchaseDate = dto.PurchaseDate;
        asset.Address = dto.Address;
        asset.City = dto.City;
        asset.State = dto.State;
        asset.ZipCode = dto.ZipCode;
        asset.SquareFootage = dto.SquareFootage;
        asset.YearBuilt = dto.YearBuilt;
        asset.PropertyTaxAnnual = dto.PropertyTaxAnnual;
        asset.Make = dto.Make;
        asset.Model = dto.VehicleModel;
        asset.VehicleYear = dto.VehicleYear;
        asset.VIN = dto.VIN;
        asset.Mileage = dto.Mileage;
        asset.LicensePlate = dto.LicensePlate;
        asset.LinkedDebtId = dto.LinkedDebtId;
        asset.Icon = dto.Icon;
        asset.Color = dto.Color;
        asset.Notes = dto.Notes;
        asset.IncludeInNetWorth = dto.IncludeInNetWorth;
        asset.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync(ct);
    }

    public async Task UpdateValueAsync(int id, int householdId, decimal newValue, string? source, string? notes, CancellationToken ct = default)
    {
        var asset = await context.Assets
            .FirstOrDefaultAsync(a => a.Id == id && a.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Asset not found");

        asset.CurrentValue = newValue;
        asset.ValueAsOfDate = DateOnly.FromDateTime(DateTime.UtcNow);
        asset.UpdatedAt = DateTime.UtcNow;

        // Add to value history
        var historyEntry = new AssetValueHistory
        {
            AssetId = id,
            Date = asset.ValueAsOfDate,
            Value = newValue,
            Source = source,
            Notes = notes,
            CreatedAt = DateTime.UtcNow
        };
        context.AssetValueHistory.Add(historyEntry);

        await context.SaveChangesAsync(ct);
        logger.LogInformation("Updated value for asset {AssetId} to {NewValue}", id, newValue);
    }

    public async Task ArchiveAssetAsync(int id, int householdId, CancellationToken ct = default)
    {
        var asset = await context.Assets
            .FirstOrDefaultAsync(a => a.Id == id && a.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Asset not found");

        asset.IsArchived = true;
        asset.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Archived asset {AssetId}", id);
    }

    public async Task RestoreAssetAsync(int id, int householdId, CancellationToken ct = default)
    {
        var asset = await context.Assets
            .FirstOrDefaultAsync(a => a.Id == id && a.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Asset not found");

        asset.IsArchived = false;
        asset.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Restored asset {AssetId}", id);
    }

    public async Task DeleteAssetAsync(int id, int householdId, CancellationToken ct = default)
    {
        var asset = await context.Assets
            .Include(a => a.ValueHistory)
            .FirstOrDefaultAsync(a => a.Id == id && a.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Asset not found");

        context.Assets.Remove(asset);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Deleted asset {AssetId}", id);
    }

    public async Task<decimal> GetTotalAssetValueAsync(int householdId, CancellationToken ct = default)
    {
        return await context.Assets
            .AsNoTracking()
            .Where(a => a.HouseholdId == householdId && !a.IsArchived && a.IncludeInNetWorth)
            .SumAsync(a => a.CurrentValue, ct);
    }

    public async Task<List<AssetValueHistoryDto>> GetValueHistoryAsync(int assetId, int householdId, CancellationToken ct = default)
    {
        // Verify asset belongs to household
        var asset = await context.Assets
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == assetId && a.HouseholdId == householdId, ct);

        if (asset == null) return [];

        return await context.AssetValueHistory
            .AsNoTracking()
            .Where(h => h.AssetId == assetId)
            .OrderByDescending(h => h.Date)
            .Select(h => new AssetValueHistoryDto(
                h.Id,
                h.Date,
                h.Value,
                h.Source,
                h.Notes
            ))
            .ToListAsync(ct);
    }
}
