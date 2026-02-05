using HLE.FamilyHub.Models.Enums;

namespace HLE.FamilyHub.Models.Entities;

/// <summary>
/// Represents an important date to remember (birthday, anniversary, etc.)
/// </summary>
public class ImportantDate
{
    public int Id { get; set; }

    public int HouseholdId { get; set; }

    /// <summary>
    /// Optional reference to a specific family member. Null for household-level dates.
    /// </summary>
    public int? FamilyMemberId { get; set; }

    public string Label { get; set; } = string.Empty;

    public DateOnly Date { get; set; }

    public ImportantDateType Type { get; set; }

    public RecurrenceType RecurrenceType { get; set; } = RecurrenceType.Annual;

    public int ReminderDaysBefore { get; set; } = 14;

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Household Household { get; set; } = null!;

    public FamilyMember? FamilyMember { get; set; }
}
