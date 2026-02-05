using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Models.Entities;

/// <summary>
/// Represents a project-based budget plan (e.g., "Kitchen Renovation", "Backyard Sprinklers")
/// </summary>
public class BudgetPlannerProject
{
    public int Id { get; set; }
    public int HouseholdId { get; set; }

    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description of the project
    /// </summary>
    public string? Description { get; set; }

    public BudgetPlannerProjectStatus Status { get; set; } = BudgetPlannerProjectStatus.Planning;

    /// <summary>
    /// Target date for completion (optional)
    /// </summary>
    public DateOnly? TargetDate { get; set; }

    /// <summary>
    /// Calculated total cost from line items
    /// </summary>
    public decimal TotalCost { get; set; }

    /// <summary>
    /// Optional icon (Bootstrap icon class)
    /// </summary>
    public string? Icon { get; set; }

    /// <summary>
    /// Optional color for display (hex code)
    /// </summary>
    public string? Color { get; set; }

    /// <summary>
    /// Optional notes
    /// </summary>
    public string? Notes { get; set; }

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public Household Household { get; set; } = null!;
    public ICollection<BudgetPlannerItem> Items { get; set; } = [];
}
