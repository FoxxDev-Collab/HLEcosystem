using HLE.AssetTracker.Data;
using HLE.AssetTracker.Models.Entities;
using HLE.AssetTracker.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HLE.AssetTracker.Services;

public class LocationService(ApplicationDbContext context, ILogger<LocationService> logger) : ILocationService
{
    public async Task<List<Location>> GetLocationTreeAsync(int householdId, CancellationToken ct = default)
    {
        // Get all locations for the household
        var allLocations = await context.Locations
            .AsNoTracking()
            .Where(l => l.HouseholdId == householdId)
            .OrderBy(l => l.SortOrder)
            .ThenBy(l => l.Name)
            .ToListAsync(ct);

        // Build the tree by assigning children to parents
        var lookup = allLocations.ToLookup(l => l.ParentId);

        foreach (var location in allLocations)
        {
            location.Children = lookup[location.Id].ToList();
        }

        // Return only top-level locations (no parent)
        return allLocations.Where(l => l.ParentId == null).ToList();
    }

    public async Task<List<Location>> GetAllLocationsAsync(int householdId, CancellationToken ct = default)
    {
        return await context.Locations
            .AsNoTracking()
            .Where(l => l.HouseholdId == householdId)
            .OrderBy(l => l.SortOrder)
            .ThenBy(l => l.Name)
            .ToListAsync(ct);
    }

    public async Task<Location?> GetLocationAsync(int id, int householdId, CancellationToken ct = default)
    {
        return await context.Locations
            .AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == id && l.HouseholdId == householdId, ct);
    }

    public async Task<Location> CreateLocationAsync(int householdId, string name, int? parentId, string? description, CancellationToken ct = default)
    {
        // Validate parent exists and belongs to same household
        if (parentId.HasValue)
        {
            var parentExists = await context.Locations
                .AnyAsync(l => l.Id == parentId.Value && l.HouseholdId == householdId, ct);

            if (!parentExists)
            {
                throw new InvalidOperationException("Parent location not found");
            }
        }

        // Get max sort order for siblings
        var maxSortOrder = await context.Locations
            .Where(l => l.HouseholdId == householdId && l.ParentId == parentId)
            .MaxAsync(l => (int?)l.SortOrder, ct) ?? 0;

        var location = new Location
        {
            HouseholdId = householdId,
            ParentId = parentId,
            Name = name.Trim(),
            Description = description?.Trim(),
            SortOrder = maxSortOrder + 1,
            CreatedAt = DateTime.UtcNow
        };

        context.Locations.Add(location);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Created location {LocationId} '{Name}' in household {HouseholdId}", location.Id, name, householdId);
        return location;
    }

    public async Task UpdateLocationAsync(int id, int householdId, string name, string? description, CancellationToken ct = default)
    {
        var location = await context.Locations
            .FirstOrDefaultAsync(l => l.Id == id && l.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Location not found");

        location.Name = name.Trim();
        location.Description = description?.Trim();

        await context.SaveChangesAsync(ct);
    }

    public async Task MoveLocationAsync(int id, int householdId, int? newParentId, CancellationToken ct = default)
    {
        var location = await context.Locations
            .FirstOrDefaultAsync(l => l.Id == id && l.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Location not found");

        // Prevent moving to self or descendant
        if (newParentId.HasValue)
        {
            if (newParentId.Value == id)
            {
                throw new InvalidOperationException("Cannot move location to itself");
            }

            // Check parent exists
            var parentExists = await context.Locations
                .AnyAsync(l => l.Id == newParentId.Value && l.HouseholdId == householdId, ct);

            if (!parentExists)
            {
                throw new InvalidOperationException("Target parent location not found");
            }

            // Check for circular reference (new parent is not a descendant of this location)
            if (await IsDescendantOfAsync(newParentId.Value, id, householdId, ct))
            {
                throw new InvalidOperationException("Cannot move location to one of its descendants");
            }
        }

        location.ParentId = newParentId;
        await context.SaveChangesAsync(ct);
    }

    public async Task DeleteLocationAsync(int id, int householdId, CancellationToken ct = default)
    {
        var location = await context.Locations
            .FirstOrDefaultAsync(l => l.Id == id && l.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Location not found");

        // Check for children
        var hasChildren = await context.Locations
            .AnyAsync(l => l.ParentId == id, ct);

        if (hasChildren)
        {
            throw new InvalidOperationException("Cannot delete location that has child locations");
        }

        // Check for assets
        var hasAssets = await context.Assets
            .AnyAsync(a => a.LocationId == id, ct);

        if (hasAssets)
        {
            throw new InvalidOperationException("Cannot delete location that contains assets. Move or delete the assets first.");
        }

        context.Locations.Remove(location);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Deleted location {LocationId} from household {HouseholdId}", id, householdId);
    }

    public async Task<string> GetLocationPathAsync(int id, int householdId, CancellationToken ct = default)
    {
        var pathParts = new List<string>();
        var currentId = (int?)id;

        // Walk up the tree
        while (currentId.HasValue)
        {
            var location = await context.Locations
                .AsNoTracking()
                .FirstOrDefaultAsync(l => l.Id == currentId.Value && l.HouseholdId == householdId, ct);

            if (location == null)
            {
                break;
            }

            pathParts.Insert(0, location.Name);
            currentId = location.ParentId;
        }

        return string.Join(" > ", pathParts);
    }

    private async Task<bool> IsDescendantOfAsync(int potentialDescendantId, int ancestorId, int householdId, CancellationToken ct)
    {
        var currentId = (int?)potentialDescendantId;

        while (currentId.HasValue)
        {
            if (currentId.Value == ancestorId)
            {
                return true;
            }

            var location = await context.Locations
                .AsNoTracking()
                .Where(l => l.Id == currentId.Value && l.HouseholdId == householdId)
                .Select(l => l.ParentId)
                .FirstOrDefaultAsync(ct);

            currentId = location;
        }

        return false;
    }
}
