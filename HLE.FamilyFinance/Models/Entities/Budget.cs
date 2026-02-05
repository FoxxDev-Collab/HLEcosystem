namespace HLE.FamilyFinance.Models.Entities;

/// <summary>
/// Represents a monthly budget allocation for a category
/// </summary>
public class Budget
{
    public int Id { get; set; }
    public int HouseholdId { get; set; }
    public int CategoryId { get; set; }

    /// <summary>
    /// Year of the budget period
    /// </summary>
    public int Year { get; set; }

    /// <summary>
    /// Month of the budget period (1-12)
    /// </summary>
    public int Month { get; set; }

    /// <summary>
    /// Budgeted amount for this category in this month
    /// </summary>
    public decimal Amount { get; set; }

    /// <summary>
    /// Optional notes for this budget entry
    /// </summary>
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public Household Household { get; set; } = null!;
    public Category Category { get; set; } = null!;
}
