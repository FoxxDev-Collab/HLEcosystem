namespace HLE.FamilyFinance.Models.Entities;

/// <summary>
/// Represents a line item within a budget planner project
/// </summary>
public class BudgetPlannerItem
{
    public int Id { get; set; }
    public int ProjectId { get; set; }

    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description or notes for this item
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Quantity of items (default 1)
    /// </summary>
    public decimal Quantity { get; set; } = 1;

    /// <summary>
    /// Cost per unit
    /// </summary>
    public decimal UnitCost { get; set; }

    /// <summary>
    /// Calculated line total (Quantity * UnitCost)
    /// </summary>
    public decimal LineTotal { get; set; }

    /// <summary>
    /// Sort order for display
    /// </summary>
    public int SortOrder { get; set; }

    /// <summary>
    /// Whether this item has been purchased
    /// </summary>
    public bool IsPurchased { get; set; }

    /// <summary>
    /// Optional URL for reference (product link, etc.)
    /// </summary>
    public string? ReferenceUrl { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public BudgetPlannerProject Project { get; set; } = null!;
}
