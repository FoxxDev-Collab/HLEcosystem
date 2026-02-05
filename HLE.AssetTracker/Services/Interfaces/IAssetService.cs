using System.Text.Json;
using HLE.AssetTracker.Models.Entities;

namespace HLE.AssetTracker.Services.Interfaces;

public record AssetFilterDto(
    int HouseholdId,
    string? SearchTerm = null,
    int? CategoryId = null,
    int? LocationId = null,
    int[]? LabelIds = null,
    bool IncludeArchived = false,
    int Page = 1,
    int PageSize = 20,
    string SortBy = "Name",
    bool SortDescending = false
);

public record AssetListItemDto(
    int Id,
    string Name,
    string? CategoryName,
    string? LocationName,
    string? PrimaryPhotoPath,
    decimal? PurchasePrice,
    DateOnly? WarrantyExpiration,
    int Quantity,
    bool IsArchived,
    DateTime CreatedAt
);

public record PagedResult<T>(
    List<T> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);

public record DashboardStatsDto(
    int TotalAssets,
    decimal TotalValue,
    int ExpiringWarrantiesCount,
    int UpcomingMaintenanceCount,
    int LocationsCount,
    int CategoriesCount
);

public interface IAssetService
{
    /// <summary>
    /// Gets a paged list of assets with filtering
    /// </summary>
    Task<PagedResult<AssetListItemDto>> GetAssetsAsync(AssetFilterDto filter, CancellationToken ct = default);

    /// <summary>
    /// Gets a single asset with all details
    /// </summary>
    Task<Asset?> GetAssetAsync(int id, int householdId, CancellationToken ct = default);

    /// <summary>
    /// Creates a new asset
    /// </summary>
    Task<Asset> CreateAssetAsync(
        int householdId,
        string userId,
        string name,
        string? description,
        int? categoryId,
        int? locationId,
        string? manufacturer,
        string? model,
        string? serialNumber,
        DateOnly? purchaseDate,
        decimal? purchasePrice,
        string? purchaseLocation,
        DateOnly? warrantyExpiration,
        string? warrantyNotes,
        int quantity,
        string? notes,
        JsonDocument? customFields,
        int[]? labelIds,
        CancellationToken ct = default);

    /// <summary>
    /// Updates an existing asset
    /// </summary>
    Task UpdateAssetAsync(
        int id,
        int householdId,
        string name,
        string? description,
        int? categoryId,
        int? locationId,
        string? manufacturer,
        string? model,
        string? serialNumber,
        DateOnly? purchaseDate,
        decimal? purchasePrice,
        string? purchaseLocation,
        DateOnly? warrantyExpiration,
        string? warrantyNotes,
        int quantity,
        string? notes,
        JsonDocument? customFields,
        int[]? labelIds,
        CancellationToken ct = default);

    /// <summary>
    /// Archives an asset (soft delete)
    /// </summary>
    Task ArchiveAssetAsync(int id, int householdId, CancellationToken ct = default);

    /// <summary>
    /// Restores an archived asset
    /// </summary>
    Task RestoreAssetAsync(int id, int householdId, CancellationToken ct = default);

    /// <summary>
    /// Permanently deletes an asset
    /// </summary>
    Task DeleteAssetAsync(int id, int householdId, CancellationToken ct = default);

    /// <summary>
    /// Gets assets with warranties expiring within the specified days
    /// </summary>
    Task<List<Asset>> GetExpiringWarrantiesAsync(int householdId, int daysAhead, CancellationToken ct = default);

    /// <summary>
    /// Gets recent assets for the dashboard
    /// </summary>
    Task<List<AssetListItemDto>> GetRecentAssetsAsync(int householdId, int count, CancellationToken ct = default);

    /// <summary>
    /// Gets dashboard statistics
    /// </summary>
    Task<DashboardStatsDto> GetDashboardStatsAsync(int householdId, CancellationToken ct = default);
}
