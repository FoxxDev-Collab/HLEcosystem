using System.Text.Json;
using HLE.AssetTracker.Data;
using HLE.AssetTracker.Models.Entities;
using HLE.AssetTracker.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HLE.AssetTracker.Services;

public class AssetService(ApplicationDbContext context, ILogger<AssetService> logger) : IAssetService
{
    public async Task<PagedResult<AssetListItemDto>> GetAssetsAsync(AssetFilterDto filter, CancellationToken ct = default)
    {
        var query = context.Assets
            .AsNoTracking()
            .Include(a => a.Category)
            .Include(a => a.Location)
            .Include(a => a.Photos.Where(p => p.IsPrimary))
            .Include(a => a.AssetLabels)
            .Where(a => a.HouseholdId == filter.HouseholdId);

        // Apply filters
        if (!filter.IncludeArchived)
        {
            query = query.Where(a => !a.IsArchived);
        }

        if (!string.IsNullOrWhiteSpace(filter.SearchTerm))
        {
            var term = filter.SearchTerm.ToLower();
            query = query.Where(a =>
                a.Name.ToLower().Contains(term) ||
                (a.Description != null && a.Description.ToLower().Contains(term)) ||
                (a.Manufacturer != null && a.Manufacturer.ToLower().Contains(term)) ||
                (a.Model != null && a.Model.ToLower().Contains(term)) ||
                (a.SerialNumber != null && a.SerialNumber.ToLower().Contains(term)));
        }

        if (filter.CategoryId.HasValue)
        {
            query = query.Where(a => a.CategoryId == filter.CategoryId.Value);
        }

        if (filter.LocationId.HasValue)
        {
            query = query.Where(a => a.LocationId == filter.LocationId.Value);
        }

        if (filter.LabelIds?.Length > 0)
        {
            query = query.Where(a => a.AssetLabels.Any(al => filter.LabelIds.Contains(al.LabelId)));
        }

        // Get total count before pagination
        var totalCount = await query.CountAsync(ct);

        // Apply sorting
        query = filter.SortBy.ToLower() switch
        {
            "name" => filter.SortDescending ? query.OrderByDescending(a => a.Name) : query.OrderBy(a => a.Name),
            "category" => filter.SortDescending ? query.OrderByDescending(a => a.Category!.Name) : query.OrderBy(a => a.Category!.Name),
            "location" => filter.SortDescending ? query.OrderByDescending(a => a.Location!.Name) : query.OrderBy(a => a.Location!.Name),
            "price" => filter.SortDescending ? query.OrderByDescending(a => a.PurchasePrice) : query.OrderBy(a => a.PurchasePrice),
            "warranty" => filter.SortDescending ? query.OrderByDescending(a => a.WarrantyExpiration) : query.OrderBy(a => a.WarrantyExpiration),
            "created" => filter.SortDescending ? query.OrderByDescending(a => a.CreatedAt) : query.OrderBy(a => a.CreatedAt),
            _ => query.OrderBy(a => a.Name)
        };

        // Apply pagination
        var items = await query
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .Select(a => new AssetListItemDto(
                a.Id,
                a.Name,
                a.Category != null ? a.Category.Name : null,
                a.Location != null ? a.Location.Name : null,
                a.Photos.Where(p => p.IsPrimary).Select(p => p.FilePath).FirstOrDefault(),
                a.PurchasePrice,
                a.WarrantyExpiration,
                a.Quantity,
                a.IsArchived,
                a.CreatedAt
            ))
            .ToListAsync(ct);

        var totalPages = (int)Math.Ceiling(totalCount / (double)filter.PageSize);

        return new PagedResult<AssetListItemDto>(items, totalCount, filter.Page, filter.PageSize, totalPages);
    }

    public async Task<Asset?> GetAssetAsync(int id, int householdId, CancellationToken ct = default)
    {
        return await context.Assets
            .AsNoTracking()
            .Include(a => a.Category)
                .ThenInclude(c => c!.CustomFields)
            .Include(a => a.Location)
            .Include(a => a.Photos.OrderByDescending(p => p.IsPrimary).ThenBy(p => p.UploadedAt))
            .Include(a => a.AssetLabels)
                .ThenInclude(al => al.Label)
            .Include(a => a.MaintenanceSchedules.Where(s => s.IsActive))
            .Include(a => a.MaintenanceLogs.OrderByDescending(l => l.PerformedAt).Take(5))
            .FirstOrDefaultAsync(a => a.Id == id && a.HouseholdId == householdId, ct);
    }

    public async Task<Asset> CreateAssetAsync(
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
        CancellationToken ct = default)
    {
        var asset = new Asset
        {
            HouseholdId = householdId,
            Name = name.Trim(),
            Description = description?.Trim(),
            CategoryId = categoryId,
            LocationId = locationId,
            Manufacturer = manufacturer?.Trim(),
            Model = model?.Trim(),
            SerialNumber = serialNumber?.Trim(),
            PurchaseDate = purchaseDate,
            PurchasePrice = purchasePrice,
            PurchaseLocation = purchaseLocation?.Trim(),
            WarrantyExpiration = warrantyExpiration,
            WarrantyNotes = warrantyNotes?.Trim(),
            Quantity = quantity > 0 ? quantity : 1,
            Notes = notes?.Trim(),
            CustomFields = customFields,
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        context.Assets.Add(asset);
        await context.SaveChangesAsync(ct);

        // Add labels
        if (labelIds?.Length > 0)
        {
            foreach (var labelId in labelIds)
            {
                context.AssetLabels.Add(new AssetLabel
                {
                    AssetId = asset.Id,
                    LabelId = labelId
                });
            }
            await context.SaveChangesAsync(ct);
        }

        logger.LogInformation("Created asset {AssetId} '{Name}' in household {HouseholdId}", asset.Id, name, householdId);
        return asset;
    }

    public async Task UpdateAssetAsync(
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
        CancellationToken ct = default)
    {
        var asset = await context.Assets
            .Include(a => a.AssetLabels)
            .FirstOrDefaultAsync(a => a.Id == id && a.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Asset not found");

        asset.Name = name.Trim();
        asset.Description = description?.Trim();
        asset.CategoryId = categoryId;
        asset.LocationId = locationId;
        asset.Manufacturer = manufacturer?.Trim();
        asset.Model = model?.Trim();
        asset.SerialNumber = serialNumber?.Trim();
        asset.PurchaseDate = purchaseDate;
        asset.PurchasePrice = purchasePrice;
        asset.PurchaseLocation = purchaseLocation?.Trim();
        asset.WarrantyExpiration = warrantyExpiration;
        asset.WarrantyNotes = warrantyNotes?.Trim();
        asset.Quantity = quantity > 0 ? quantity : 1;
        asset.Notes = notes?.Trim();
        asset.CustomFields = customFields;
        asset.UpdatedAt = DateTime.UtcNow;

        // Update labels
        var existingLabelIds = asset.AssetLabels.Select(al => al.LabelId).ToList();
        var newLabelIds = labelIds ?? [];

        // Remove labels no longer present
        var labelsToRemove = asset.AssetLabels.Where(al => !newLabelIds.Contains(al.LabelId)).ToList();
        foreach (var label in labelsToRemove)
        {
            context.AssetLabels.Remove(label);
        }

        // Add new labels
        foreach (var labelId in newLabelIds.Where(id => !existingLabelIds.Contains(id)))
        {
            context.AssetLabels.Add(new AssetLabel
            {
                AssetId = asset.Id,
                LabelId = labelId
            });
        }

        await context.SaveChangesAsync(ct);
        logger.LogInformation("Updated asset {AssetId} in household {HouseholdId}", id, householdId);
    }

    public async Task ArchiveAssetAsync(int id, int householdId, CancellationToken ct = default)
    {
        var asset = await context.Assets
            .FirstOrDefaultAsync(a => a.Id == id && a.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Asset not found");

        asset.IsArchived = true;
        asset.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Archived asset {AssetId} in household {HouseholdId}", id, householdId);
    }

    public async Task RestoreAssetAsync(int id, int householdId, CancellationToken ct = default)
    {
        var asset = await context.Assets
            .FirstOrDefaultAsync(a => a.Id == id && a.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Asset not found");

        asset.IsArchived = false;
        asset.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Restored asset {AssetId} in household {HouseholdId}", id, householdId);
    }

    public async Task DeleteAssetAsync(int id, int householdId, CancellationToken ct = default)
    {
        var asset = await context.Assets
            .FirstOrDefaultAsync(a => a.Id == id && a.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Asset not found");

        context.Assets.Remove(asset);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Permanently deleted asset {AssetId} from household {HouseholdId}", id, householdId);
    }

    public async Task<List<Asset>> GetExpiringWarrantiesAsync(int householdId, int daysAhead, CancellationToken ct = default)
    {
        var cutoffDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(daysAhead));

        return await context.Assets
            .AsNoTracking()
            .Include(a => a.Category)
            .Include(a => a.Location)
            .Where(a => a.HouseholdId == householdId &&
                       !a.IsArchived &&
                       a.WarrantyExpiration.HasValue &&
                       a.WarrantyExpiration.Value <= cutoffDate &&
                       a.WarrantyExpiration.Value >= DateOnly.FromDateTime(DateTime.UtcNow))
            .OrderBy(a => a.WarrantyExpiration)
            .ToListAsync(ct);
    }

    public async Task<List<AssetListItemDto>> GetRecentAssetsAsync(int householdId, int count, CancellationToken ct = default)
    {
        return await context.Assets
            .AsNoTracking()
            .Include(a => a.Category)
            .Include(a => a.Location)
            .Include(a => a.Photos.Where(p => p.IsPrimary))
            .Where(a => a.HouseholdId == householdId && !a.IsArchived)
            .OrderByDescending(a => a.CreatedAt)
            .Take(count)
            .Select(a => new AssetListItemDto(
                a.Id,
                a.Name,
                a.Category != null ? a.Category.Name : null,
                a.Location != null ? a.Location.Name : null,
                a.Photos.Where(p => p.IsPrimary).Select(p => p.FilePath).FirstOrDefault(),
                a.PurchasePrice,
                a.WarrantyExpiration,
                a.Quantity,
                a.IsArchived,
                a.CreatedAt
            ))
            .ToListAsync(ct);
    }

    public async Task<DashboardStatsDto> GetDashboardStatsAsync(int householdId, CancellationToken ct = default)
    {
        var totalAssets = await context.Assets
            .CountAsync(a => a.HouseholdId == householdId && !a.IsArchived, ct);

        var totalValue = await context.Assets
            .Where(a => a.HouseholdId == householdId && !a.IsArchived && a.PurchasePrice.HasValue)
            .SumAsync(a => a.PurchasePrice!.Value * a.Quantity, ct);

        var thirtyDaysFromNow = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30));
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var expiringWarrantiesCount = await context.Assets
            .CountAsync(a => a.HouseholdId == householdId &&
                            !a.IsArchived &&
                            a.WarrantyExpiration.HasValue &&
                            a.WarrantyExpiration.Value <= thirtyDaysFromNow &&
                            a.WarrantyExpiration.Value >= today, ct);

        var sevenDaysFromNow = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7));

        var upcomingMaintenanceCount = await context.MaintenanceSchedules
            .CountAsync(s => s.Asset.HouseholdId == householdId &&
                            s.IsActive &&
                            s.NextDueDate <= sevenDaysFromNow, ct);

        var locationsCount = await context.Locations
            .CountAsync(l => l.HouseholdId == householdId, ct);

        var categoriesCount = await context.Categories
            .CountAsync(c => c.HouseholdId == householdId, ct);

        return new DashboardStatsDto(
            totalAssets,
            totalValue,
            expiringWarrantiesCount,
            upcomingMaintenanceCount,
            locationsCount,
            categoriesCount
        );
    }
}
