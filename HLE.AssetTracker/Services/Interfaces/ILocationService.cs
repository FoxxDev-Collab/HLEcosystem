using HLE.AssetTracker.Models.Entities;

namespace HLE.AssetTracker.Services.Interfaces;

public interface ILocationService
{
    /// <summary>
    /// Gets the full location tree for a household
    /// </summary>
    Task<List<Location>> GetLocationTreeAsync(int householdId, CancellationToken ct = default);

    /// <summary>
    /// Gets all locations as a flat list
    /// </summary>
    Task<List<Location>> GetAllLocationsAsync(int householdId, CancellationToken ct = default);

    /// <summary>
    /// Gets a single location by ID
    /// </summary>
    Task<Location?> GetLocationAsync(int id, int householdId, CancellationToken ct = default);

    /// <summary>
    /// Creates a new location
    /// </summary>
    Task<Location> CreateLocationAsync(int householdId, string name, int? parentId, string? description, CancellationToken ct = default);

    /// <summary>
    /// Updates a location
    /// </summary>
    Task UpdateLocationAsync(int id, int householdId, string name, string? description, CancellationToken ct = default);

    /// <summary>
    /// Moves a location to a new parent
    /// </summary>
    Task MoveLocationAsync(int id, int householdId, int? newParentId, CancellationToken ct = default);

    /// <summary>
    /// Deletes a location (will fail if has children or assets)
    /// </summary>
    Task DeleteLocationAsync(int id, int householdId, CancellationToken ct = default);

    /// <summary>
    /// Gets the full path of a location (e.g., "Home > Kitchen > Pantry")
    /// </summary>
    Task<string> GetLocationPathAsync(int id, int householdId, CancellationToken ct = default);
}
