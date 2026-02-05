using HLE.AssetTracker.Models.Entities;
using HLE.AssetTracker.Models.Enums;

namespace HLE.AssetTracker.Services.Interfaces;

public interface ICategoryService
{
    /// <summary>
    /// Gets all categories for a household
    /// </summary>
    Task<List<Category>> GetCategoriesAsync(int householdId, CancellationToken ct = default);

    /// <summary>
    /// Gets a category with its custom field definitions
    /// </summary>
    Task<Category?> GetCategoryAsync(int id, int householdId, CancellationToken ct = default);

    /// <summary>
    /// Creates a new category
    /// </summary>
    Task<Category> CreateCategoryAsync(int householdId, string name, string? icon, string? color, CancellationToken ct = default);

    /// <summary>
    /// Updates a category
    /// </summary>
    Task UpdateCategoryAsync(int id, int householdId, string name, string? icon, string? color, CancellationToken ct = default);

    /// <summary>
    /// Deletes a category (will set CategoryId to null on assets)
    /// </summary>
    Task DeleteCategoryAsync(int id, int householdId, CancellationToken ct = default);

    /// <summary>
    /// Gets custom field definitions for a category
    /// </summary>
    Task<List<CustomFieldDefinition>> GetCustomFieldsAsync(int categoryId, CancellationToken ct = default);

    /// <summary>
    /// Adds a custom field definition to a category
    /// </summary>
    Task<CustomFieldDefinition> AddCustomFieldAsync(int categoryId, int householdId, string name, CustomFieldType fieldType, string[]? options, bool isRequired, CancellationToken ct = default);

    /// <summary>
    /// Updates a custom field definition
    /// </summary>
    Task UpdateCustomFieldAsync(int fieldId, int householdId, string name, CustomFieldType fieldType, string[]? options, bool isRequired, CancellationToken ct = default);

    /// <summary>
    /// Deletes a custom field definition
    /// </summary>
    Task DeleteCustomFieldAsync(int fieldId, int householdId, CancellationToken ct = default);

    /// <summary>
    /// Reorders custom fields
    /// </summary>
    Task ReorderCustomFieldsAsync(int categoryId, int householdId, int[] fieldIds, CancellationToken ct = default);
}
