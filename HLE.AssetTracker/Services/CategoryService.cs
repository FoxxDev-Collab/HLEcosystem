using System.Text.Json;
using HLE.AssetTracker.Data;
using HLE.AssetTracker.Models.Entities;
using HLE.AssetTracker.Models.Enums;
using HLE.AssetTracker.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HLE.AssetTracker.Services;

public class CategoryService(ApplicationDbContext context, ILogger<CategoryService> logger) : ICategoryService
{
    public async Task<List<Category>> GetCategoriesAsync(int householdId, CancellationToken ct = default)
    {
        return await context.Categories
            .AsNoTracking()
            .Include(c => c.CustomFields.OrderBy(f => f.SortOrder))
            .Where(c => c.HouseholdId == householdId)
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .ToListAsync(ct);
    }

    public async Task<Category?> GetCategoryAsync(int id, int householdId, CancellationToken ct = default)
    {
        return await context.Categories
            .AsNoTracking()
            .Include(c => c.CustomFields.OrderBy(f => f.SortOrder))
            .FirstOrDefaultAsync(c => c.Id == id && c.HouseholdId == householdId, ct);
    }

    public async Task<Category> CreateCategoryAsync(int householdId, string name, string? icon, string? color, CancellationToken ct = default)
    {
        var maxSortOrder = await context.Categories
            .Where(c => c.HouseholdId == householdId)
            .MaxAsync(c => (int?)c.SortOrder, ct) ?? 0;

        var category = new Category
        {
            HouseholdId = householdId,
            Name = name.Trim(),
            Icon = icon?.Trim(),
            Color = color?.Trim(),
            SortOrder = maxSortOrder + 1,
            CreatedAt = DateTime.UtcNow
        };

        context.Categories.Add(category);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Created category {CategoryId} '{Name}' in household {HouseholdId}", category.Id, name, householdId);
        return category;
    }

    public async Task UpdateCategoryAsync(int id, int householdId, string name, string? icon, string? color, CancellationToken ct = default)
    {
        var category = await context.Categories
            .FirstOrDefaultAsync(c => c.Id == id && c.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Category not found");

        category.Name = name.Trim();
        category.Icon = icon?.Trim();
        category.Color = color?.Trim();

        await context.SaveChangesAsync(ct);
    }

    public async Task DeleteCategoryAsync(int id, int householdId, CancellationToken ct = default)
    {
        var category = await context.Categories
            .FirstOrDefaultAsync(c => c.Id == id && c.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Category not found");

        // Assets will have CategoryId set to null due to OnDelete.SetNull
        context.Categories.Remove(category);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Deleted category {CategoryId} from household {HouseholdId}", id, householdId);
    }

    public async Task<List<CustomFieldDefinition>> GetCustomFieldsAsync(int categoryId, CancellationToken ct = default)
    {
        return await context.CustomFieldDefinitions
            .AsNoTracking()
            .Where(f => f.CategoryId == categoryId)
            .OrderBy(f => f.SortOrder)
            .ToListAsync(ct);
    }

    public async Task<CustomFieldDefinition> AddCustomFieldAsync(int categoryId, int householdId, string name, CustomFieldType fieldType, string[]? options, bool isRequired, CancellationToken ct = default)
    {
        // Verify category belongs to household
        var categoryExists = await context.Categories
            .AnyAsync(c => c.Id == categoryId && c.HouseholdId == householdId, ct);

        if (!categoryExists)
        {
            throw new InvalidOperationException("Category not found");
        }

        var maxSortOrder = await context.CustomFieldDefinitions
            .Where(f => f.CategoryId == categoryId)
            .MaxAsync(f => (int?)f.SortOrder, ct) ?? 0;

        var field = new CustomFieldDefinition
        {
            CategoryId = categoryId,
            Name = name.Trim(),
            FieldType = fieldType,
            Options = options != null ? JsonDocument.Parse(JsonSerializer.Serialize(options)) : null,
            IsRequired = isRequired,
            SortOrder = maxSortOrder + 1
        };

        context.CustomFieldDefinitions.Add(field);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Added custom field {FieldId} '{Name}' to category {CategoryId}", field.Id, name, categoryId);
        return field;
    }

    public async Task UpdateCustomFieldAsync(int fieldId, int householdId, string name, CustomFieldType fieldType, string[]? options, bool isRequired, CancellationToken ct = default)
    {
        var field = await context.CustomFieldDefinitions
            .Include(f => f.Category)
            .FirstOrDefaultAsync(f => f.Id == fieldId && f.Category.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Custom field not found");

        field.Name = name.Trim();
        field.FieldType = fieldType;
        field.Options = options != null ? JsonDocument.Parse(JsonSerializer.Serialize(options)) : null;
        field.IsRequired = isRequired;

        await context.SaveChangesAsync(ct);
    }

    public async Task DeleteCustomFieldAsync(int fieldId, int householdId, CancellationToken ct = default)
    {
        var field = await context.CustomFieldDefinitions
            .Include(f => f.Category)
            .FirstOrDefaultAsync(f => f.Id == fieldId && f.Category.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Custom field not found");

        context.CustomFieldDefinitions.Remove(field);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Deleted custom field {FieldId} from category {CategoryId}", fieldId, field.CategoryId);
    }

    public async Task ReorderCustomFieldsAsync(int categoryId, int householdId, int[] fieldIds, CancellationToken ct = default)
    {
        // Verify category belongs to household
        var categoryExists = await context.Categories
            .AnyAsync(c => c.Id == categoryId && c.HouseholdId == householdId, ct);

        if (!categoryExists)
        {
            throw new InvalidOperationException("Category not found");
        }

        var fields = await context.CustomFieldDefinitions
            .Where(f => f.CategoryId == categoryId)
            .ToListAsync(ct);

        for (int i = 0; i < fieldIds.Length; i++)
        {
            var field = fields.FirstOrDefault(f => f.Id == fieldIds[i]);
            if (field != null)
            {
                field.SortOrder = i;
            }
        }

        await context.SaveChangesAsync(ct);
    }
}
