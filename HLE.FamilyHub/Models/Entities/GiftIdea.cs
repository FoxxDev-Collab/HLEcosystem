using HLE.FamilyHub.Models.Enums;

namespace HLE.FamilyHub.Models.Entities;

/// <summary>
/// Represents a potential gift idea for a family member or general idea
/// </summary>
public class GiftIdea
{
    public int Id { get; set; }

    public int HouseholdId { get; set; }

    /// <summary>
    /// Optional reference to a specific family member. Null for general ideas.
    /// </summary>
    public int? FamilyMemberId { get; set; }

    public string Idea { get; set; } = string.Empty;

    public DateOnly DateCaptured { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);

    public string? Source { get; set; }

    public GiftIdeaPriority Priority { get; set; } = GiftIdeaPriority.Medium;

    public GiftIdeaStatus Status { get; set; } = GiftIdeaStatus.Active;

    public decimal? EstimatedCost { get; set; }

    public string? Url { get; set; }

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Household Household { get; set; } = null!;

    public FamilyMember? FamilyMember { get; set; }
}
