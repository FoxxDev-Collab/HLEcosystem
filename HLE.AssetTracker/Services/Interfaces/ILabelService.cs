using HLE.AssetTracker.Models.Entities;

namespace HLE.AssetTracker.Services.Interfaces;

public interface ILabelService
{
    /// <summary>
    /// Gets all labels for a household
    /// </summary>
    Task<List<Label>> GetLabelsAsync(int householdId, CancellationToken ct = default);

    /// <summary>
    /// Gets a single label by ID
    /// </summary>
    Task<Label?> GetLabelAsync(int id, int householdId, CancellationToken ct = default);

    /// <summary>
    /// Creates a new label
    /// </summary>
    Task<Label> CreateLabelAsync(int householdId, string name, string? color, CancellationToken ct = default);

    /// <summary>
    /// Updates a label
    /// </summary>
    Task UpdateLabelAsync(int id, int householdId, string name, string? color, CancellationToken ct = default);

    /// <summary>
    /// Deletes a label (removes from all assets)
    /// </summary>
    Task DeleteLabelAsync(int id, int householdId, CancellationToken ct = default);

    /// <summary>
    /// Gets the count of assets using this label
    /// </summary>
    Task<int> GetAssetCountAsync(int labelId, CancellationToken ct = default);
}
