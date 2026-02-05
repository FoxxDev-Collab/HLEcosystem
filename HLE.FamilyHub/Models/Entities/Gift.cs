using HLE.FamilyHub.Models.Enums;

namespace HLE.FamilyHub.Models.Entities;

/// <summary>
/// Represents a gift given or to be given to a family member
/// </summary>
public class Gift
{
    public int Id { get; set; }

    public int HouseholdId { get; set; }

    public int FamilyMemberId { get; set; }

    public string Description { get; set; } = string.Empty;

    public DateOnly? GiftDate { get; set; }

    public string? Occasion { get; set; }

    public GiftStatus Status { get; set; } = GiftStatus.Idea;

    public decimal? EstimatedCost { get; set; }

    public decimal? ActualCost { get; set; }

    /// <summary>
    /// Optional rating of how well the gift was received (1-5)
    /// </summary>
    public int? Rating { get; set; }

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Household Household { get; set; } = null!;

    public FamilyMember FamilyMember { get; set; } = null!;
}
