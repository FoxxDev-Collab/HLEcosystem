using HLE.FamilyFinance.Models.Entities;
using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Services.Interfaces;

public record CategoryDto(
    int Id,
    string Name,
    CategoryType Type,
    int? ParentCategoryId,
    string? ParentCategoryName,
    string? Icon,
    string? Color,
    decimal? DefaultBudgetAmount,
    int TransactionCount
);

public record CategoryTreeDto(
    int Id,
    string Name,
    CategoryType Type,
    string? Icon,
    string? Color,
    decimal? DefaultBudgetAmount,
    List<CategoryTreeDto> Children
);

public interface ICategoryService
{
    Task<List<CategoryDto>> GetCategoriesAsync(int householdId, CancellationToken ct = default);
    Task<List<CategoryTreeDto>> GetCategoryTreeAsync(int householdId, CategoryType? type = null, CancellationToken ct = default);
    Task<Category?> GetCategoryAsync(int id, int householdId, CancellationToken ct = default);
    Task<Category> CreateCategoryAsync(int householdId, string name, CategoryType type, int? parentId,
        string? icon, string? color, CancellationToken ct = default);
    Task UpdateCategoryAsync(int id, int householdId, string name, int? parentId,
        string? icon, string? color, CancellationToken ct = default);
    Task DeleteCategoryAsync(int id, int householdId, CancellationToken ct = default);
    Task SeedDefaultCategoriesAsync(int householdId, CancellationToken ct = default);
}
