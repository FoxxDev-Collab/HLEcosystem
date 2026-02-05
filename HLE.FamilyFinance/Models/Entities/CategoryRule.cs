using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Models.Entities;

/// <summary>
/// Rule for auto-categorizing imported transactions
/// </summary>
public class CategoryRule
{
    public int Id { get; set; }
    public int HouseholdId { get; set; }

    /// <summary>
    /// Pattern to match against transaction description
    /// </summary>
    public string Pattern { get; set; } = string.Empty;

    /// <summary>
    /// How to match the pattern
    /// </summary>
    public CategoryRuleMatchType MatchType { get; set; } = CategoryRuleMatchType.Contains;

    /// <summary>
    /// Category to assign when pattern matches
    /// </summary>
    public int CategoryId { get; set; }

    /// <summary>
    /// Optional payee name to assign
    /// </summary>
    public string? AssignPayee { get; set; }

    /// <summary>
    /// Priority for rule matching (lower = higher priority)
    /// </summary>
    public int Priority { get; set; }

    /// <summary>
    /// Whether this rule is active
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Number of times this rule has been applied
    /// </summary>
    public int MatchCount { get; set; }

    /// <summary>
    /// Last time this rule matched
    /// </summary>
    public DateTime? LastMatchedAt { get; set; }

    /// <summary>
    /// Notes about this rule
    /// </summary>
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public Household Household { get; set; } = null!;
    public Category Category { get; set; } = null!;
}
