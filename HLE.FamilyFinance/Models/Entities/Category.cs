using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Models.Entities;

/// <summary>
/// Represents a transaction category with optional budget support
/// </summary>
public class Category
{
    public int Id { get; set; }
    public int HouseholdId { get; set; }

    /// <summary>
    /// Optional parent category for subcategories
    /// </summary>
    public int? ParentCategoryId { get; set; }

    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Whether this is income or expense
    /// </summary>
    public CategoryType Type { get; set; }

    /// <summary>
    /// Optional icon (emoji or icon class)
    /// </summary>
    public string? Icon { get; set; }

    /// <summary>
    /// Optional color for display (hex code)
    /// </summary>
    public string? Color { get; set; }

    /// <summary>
    /// Default monthly budget amount (can be overridden in Budget entity)
    /// </summary>
    public decimal? DefaultBudgetAmount { get; set; }

    public int SortOrder { get; set; }
    public bool IsArchived { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Household Household { get; set; } = null!;
    public Category? ParentCategory { get; set; }
    public ICollection<Category> SubCategories { get; set; } = [];
    public ICollection<Transaction> Transactions { get; set; } = [];
    public ICollection<Budget> Budgets { get; set; } = [];
    public ICollection<RecurringTransaction> RecurringTransactions { get; set; } = [];
}
