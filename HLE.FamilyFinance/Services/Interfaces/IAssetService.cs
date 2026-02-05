using HLE.FamilyFinance.Models.Entities;
using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Services.Interfaces;

public record AssetSummaryDto(
    int Id,
    string Name,
    AssetType Type,
    decimal CurrentValue,
    DateOnly ValueAsOfDate,
    string? Icon,
    string? Color,
    bool IsArchived
);

public record AssetDetailDto(
    int Id,
    string Name,
    AssetType Type,
    decimal PurchasePrice,
    DateOnly? PurchaseDate,
    decimal CurrentValue,
    DateOnly ValueAsOfDate,
    // Real estate
    string? Address,
    string? City,
    string? State,
    string? ZipCode,
    int? SquareFootage,
    int? YearBuilt,
    decimal? PropertyTaxAnnual,
    // Vehicle
    string? Make,
    string? VehicleModel,
    int? VehicleYear,
    string? VIN,
    int? Mileage,
    string? LicensePlate,
    // Links
    int? LinkedDebtId,
    string? LinkedDebtName,
    string? Icon,
    string? Color,
    string? Notes,
    bool IncludeInNetWorth,
    bool IsArchived,
    decimal AppreciationPercent
);

public record AssetValueHistoryDto(
    int Id,
    DateOnly Date,
    decimal Value,
    string? Source,
    string? Notes
);

public record AssetCreateDto(
    string Name = "",
    AssetType Type = AssetType.Other,
    decimal PurchasePrice = 0,
    DateOnly? PurchaseDate = null,
    decimal CurrentValue = 0,
    // Real estate
    string? Address = null,
    string? City = null,
    string? State = null,
    string? ZipCode = null,
    int? SquareFootage = null,
    int? YearBuilt = null,
    decimal? PropertyTaxAnnual = null,
    // Vehicle
    string? Make = null,
    string? VehicleModel = null,
    int? VehicleYear = null,
    string? VIN = null,
    int? Mileage = null,
    string? LicensePlate = null,
    // Links
    int? LinkedDebtId = null,
    string? Icon = null,
    string? Color = null,
    string? Notes = null,
    bool IncludeInNetWorth = true
);

public interface IAssetService
{
    Task<List<AssetSummaryDto>> GetAssetsAsync(int householdId, CancellationToken ct = default);
    Task<List<AssetSummaryDto>> GetAssetsByTypeAsync(int householdId, AssetType type, CancellationToken ct = default);
    Task<AssetDetailDto?> GetAssetAsync(int id, int householdId, CancellationToken ct = default);
    Task<Asset> CreateAssetAsync(int householdId, AssetCreateDto dto, CancellationToken ct = default);
    Task UpdateAssetAsync(int id, int householdId, AssetCreateDto dto, CancellationToken ct = default);
    Task UpdateValueAsync(int id, int householdId, decimal newValue, string? source, string? notes, CancellationToken ct = default);
    Task ArchiveAssetAsync(int id, int householdId, CancellationToken ct = default);
    Task RestoreAssetAsync(int id, int householdId, CancellationToken ct = default);
    Task DeleteAssetAsync(int id, int householdId, CancellationToken ct = default);
    Task<decimal> GetTotalAssetValueAsync(int householdId, CancellationToken ct = default);
    Task<List<AssetValueHistoryDto>> GetValueHistoryAsync(int assetId, int householdId, CancellationToken ct = default);
}
