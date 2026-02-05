using HLE.FamilyFinance.Data;
using HLE.FamilyFinance.Models.Entities;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyFinance.Services;

public class CategoryService(ApplicationDbContext context, ILogger<CategoryService> logger) : ICategoryService
{
    public async Task<List<CategoryDto>> GetCategoriesAsync(int householdId, CancellationToken ct = default)
    {
        return await context.Categories
            .AsNoTracking()
            .Where(c => c.HouseholdId == householdId && !c.IsArchived)
            .OrderBy(c => c.Type)
            .ThenBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .Select(c => new CategoryDto(
                c.Id,
                c.Name,
                c.Type,
                c.ParentCategoryId,
                c.ParentCategory != null ? c.ParentCategory.Name : null,
                c.Icon,
                c.Color,
                c.DefaultBudgetAmount,
                c.Transactions.Count
            ))
            .ToListAsync(ct);
    }

    public async Task<List<CategoryTreeDto>> GetCategoryTreeAsync(int householdId, CategoryType? type = null, CancellationToken ct = default)
    {
        var categories = await context.Categories
            .AsNoTracking()
            .Where(c => c.HouseholdId == householdId && !c.IsArchived)
            .Where(c => !type.HasValue || c.Type == type.Value)
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .ToListAsync(ct);

        return BuildTree(categories, null);
    }

    private static List<CategoryTreeDto> BuildTree(List<Category> allCategories, int? parentId)
    {
        return allCategories
            .Where(c => c.ParentCategoryId == parentId)
            .Select(c => new CategoryTreeDto(
                c.Id,
                c.Name,
                c.Type,
                c.Icon,
                c.Color,
                c.DefaultBudgetAmount,
                BuildTree(allCategories, c.Id)
            ))
            .ToList();
    }

    public async Task<Category?> GetCategoryAsync(int id, int householdId, CancellationToken ct = default)
    {
        return await context.Categories
            .FirstOrDefaultAsync(c => c.Id == id && c.HouseholdId == householdId, ct);
    }

    public async Task<Category> CreateCategoryAsync(int householdId, string name, CategoryType type, int? parentId,
        string? icon, string? color, CancellationToken ct = default)
    {
        var maxOrder = await context.Categories
            .Where(c => c.HouseholdId == householdId && c.ParentCategoryId == parentId)
            .MaxAsync(c => (int?)c.SortOrder, ct) ?? 0;

        var category = new Category
        {
            HouseholdId = householdId,
            ParentCategoryId = parentId,
            Name = name,
            Type = type,
            Icon = icon,
            Color = color,
            SortOrder = maxOrder + 1,
            CreatedAt = DateTime.UtcNow
        };

        context.Categories.Add(category);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Created category {CategoryId} '{Name}' for household {HouseholdId}", category.Id, name, householdId);
        return category;
    }

    public async Task UpdateCategoryAsync(int id, int householdId, string name, int? parentId,
        string? icon, string? color, CancellationToken ct = default)
    {
        var category = await context.Categories
            .FirstOrDefaultAsync(c => c.Id == id && c.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Category not found");

        category.Name = name;
        category.ParentCategoryId = parentId;
        category.Icon = icon;
        category.Color = color;

        await context.SaveChangesAsync(ct);
    }

    public async Task DeleteCategoryAsync(int id, int householdId, CancellationToken ct = default)
    {
        var category = await context.Categories
            .Include(c => c.Transactions)
            .Include(c => c.SubCategories)
            .FirstOrDefaultAsync(c => c.Id == id && c.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Category not found");

        if (category.Transactions.Any())
        {
            throw new InvalidOperationException("Cannot delete category with existing transactions. Archive it instead.");
        }

        if (category.SubCategories.Any())
        {
            throw new InvalidOperationException("Cannot delete category with subcategories. Delete subcategories first.");
        }

        context.Categories.Remove(category);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Deleted category {CategoryId}", id);
    }

    public async Task SeedDefaultCategoriesAsync(int householdId, CancellationToken ct = default)
    {
        // Check if categories already exist
        var existingCount = await context.Categories.CountAsync(c => c.HouseholdId == householdId, ct);
        if (existingCount > 0)
        {
            logger.LogDebug("Household {HouseholdId} already has categories, skipping seed", householdId);
            return;
        }

        var categories = new List<Category>();
        var sortOrder = 0;

        // Income categories (using Bootstrap Icons)
        var incomeCategories = new[]
        {
            ("Salary", "bi-cash-coin", "#22c55e"),
            ("Freelance", "bi-briefcase", "#10b981"),
            ("Investments", "bi-graph-up-arrow", "#14b8a6"),
            ("Rental Income", "bi-house-door", "#06b6d4"),
            ("Gifts", "bi-gift", "#0ea5e9"),
            ("Other Income", "bi-cash-stack", "#3b82f6")
        };

        foreach (var (name, icon, color) in incomeCategories)
        {
            categories.Add(new Category
            {
                HouseholdId = householdId,
                Name = name,
                Type = CategoryType.Income,
                Icon = icon,
                Color = color,
                SortOrder = sortOrder++,
                CreatedAt = DateTime.UtcNow
            });
        }

        // Transfer category (excluded from income/expense calculations)
        categories.Add(new Category
        {
            HouseholdId = householdId,
            Name = "Transfer",
            Type = CategoryType.Transfer,
            Icon = "bi-arrow-left-right",
            Color = "#6b7280",
            SortOrder = sortOrder++,
            CreatedAt = DateTime.UtcNow
        });

        // Balance Adjustment category (excluded from income/expense calculations)
        categories.Add(new Category
        {
            HouseholdId = householdId,
            Name = "Balance Adjustment",
            Type = CategoryType.Transfer,
            Icon = "bi-plus-slash-minus",
            Color = "#9ca3af",
            SortOrder = sortOrder++,
            CreatedAt = DateTime.UtcNow
        });

        // Expense categories with subcategories (using Bootstrap Icons)
        var expenseCategories = new (string Name, string Icon, string Color, string[]? SubCategories)[]
        {
            ("Housing", "bi-house", "#ef4444", new[] { "Rent/Mortgage", "Property Tax", "Home Insurance", "Maintenance" }),
            ("Transportation", "bi-car-front", "#f97316", new[] { "Gas", "Car Payment", "Insurance", "Maintenance", "Public Transit" }),
            ("Food", "bi-basket", "#f59e0b", new[] { "Groceries", "Restaurants", "Coffee Shops" }),
            ("Utilities", "bi-lightning-charge", "#eab308", new[] { "Electric", "Gas", "Water", "Internet", "Phone" }),
            ("Healthcare", "bi-heart-pulse", "#84cc16", new[] { "Insurance", "Medical", "Dental", "Pharmacy" }),
            ("Entertainment", "bi-film", "#22c55e", new[] { "Streaming", "Movies", "Games", "Hobbies" }),
            ("Shopping", "bi-bag", "#10b981", new[] { "Clothing", "Electronics", "Home Goods" }),
            ("Personal", "bi-person", "#14b8a6", new[] { "Haircare", "Gym", "Subscriptions" }),
            ("Education", "bi-book", "#06b6d4", new[] { "Tuition", "Books", "Courses" }),
            ("Financial", "bi-bank", "#0ea5e9", new[] { "Bank Fees", "Interest", "Investments" }),
            ("Gifts & Donations", "bi-gift", "#3b82f6", new[] { "Gifts", "Charity" }),
            ("Travel", "bi-airplane", "#8b5cf6", new[] { "Flights", "Hotels", "Activities" })
        };

        foreach (var (name, icon, color, subCategories) in expenseCategories)
        {
            var parent = new Category
            {
                HouseholdId = householdId,
                Name = name,
                Type = CategoryType.Expense,
                Icon = icon,
                Color = color,
                SortOrder = sortOrder++,
                CreatedAt = DateTime.UtcNow
            };
            categories.Add(parent);

            if (subCategories != null)
            {
                context.Categories.Add(parent);
                await context.SaveChangesAsync(ct);

                var subOrder = 0;
                foreach (var subName in subCategories)
                {
                    categories.Add(new Category
                    {
                        HouseholdId = householdId,
                        ParentCategoryId = parent.Id,
                        Name = subName,
                        Type = CategoryType.Expense,
                        Color = color,
                        SortOrder = subOrder++,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }
        }

        context.Categories.AddRange(categories.Where(c => c.Id == 0));
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Seeded {Count} default categories for household {HouseholdId}", categories.Count, householdId);
    }
}
