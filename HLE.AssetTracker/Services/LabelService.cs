using HLE.AssetTracker.Data;
using HLE.AssetTracker.Models.Entities;
using HLE.AssetTracker.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HLE.AssetTracker.Services;

public class LabelService(
    ApplicationDbContext context,
    ILogger<LabelService> logger) : ILabelService
{
    public async Task<List<Label>> GetLabelsAsync(int householdId, CancellationToken ct = default)
    {
        return await context.Labels
            .AsNoTracking()
            .Where(l => l.HouseholdId == householdId)
            .OrderBy(l => l.Name)
            .ToListAsync(ct);
    }

    public async Task<Label?> GetLabelAsync(int id, int householdId, CancellationToken ct = default)
    {
        return await context.Labels
            .FirstOrDefaultAsync(l => l.Id == id && l.HouseholdId == householdId, ct);
    }

    public async Task<Label> CreateLabelAsync(
        int householdId,
        string name,
        string? color,
        CancellationToken ct = default)
    {
        var label = new Label
        {
            HouseholdId = householdId,
            Name = name,
            Color = color,
        };

        context.Labels.Add(label);
        await context.SaveChangesAsync(ct);

        logger.LogInformation(
            "Created label {LabelId} '{Name}' for household {HouseholdId}",
            label.Id, label.Name, householdId);

        return label;
    }

    public async Task UpdateLabelAsync(
        int id,
        int householdId,
        string name,
        string? color,
        CancellationToken ct = default)
    {
        var label = await GetLabelAsync(id, householdId, ct);
        if (label == null)
        {
            throw new InvalidOperationException("Label not found or access denied.");
        }

        label.Name = name;
        label.Color = color;

        await context.SaveChangesAsync(ct);

        logger.LogInformation(
            "Updated label {LabelId} '{Name}'",
            label.Id, label.Name);
    }

    public async Task DeleteLabelAsync(int id, int householdId, CancellationToken ct = default)
    {
        var label = await context.Labels
            .Include(l => l.AssetLabels)
            .FirstOrDefaultAsync(l => l.Id == id && l.HouseholdId == householdId, ct);

        if (label == null)
        {
            throw new InvalidOperationException("Label not found or access denied.");
        }

        // Remove label from all assets
        context.AssetLabels.RemoveRange(label.AssetLabels);
        context.Labels.Remove(label);

        await context.SaveChangesAsync(ct);

        logger.LogInformation(
            "Deleted label {LabelId} '{Name}' and removed from {AssetCount} assets",
            label.Id, label.Name, label.AssetLabels.Count);
    }

    public async Task<int> GetAssetCountAsync(int labelId, CancellationToken ct = default)
    {
        return await context.AssetLabels
            .Where(al => al.LabelId == labelId)
            .CountAsync(ct);
    }
}
