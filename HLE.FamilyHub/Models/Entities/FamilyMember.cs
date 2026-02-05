using HLE.FamilyHub.Models.Enums;

namespace HLE.FamilyHub.Models.Entities;

/// <summary>
/// Represents a family member tracked within a household
/// </summary>
public class FamilyMember
{
    public int Id { get; set; }

    public int HouseholdId { get; set; }

    public string FirstName { get; set; } = string.Empty;

    public string LastName { get; set; } = string.Empty;

    public string? Nickname { get; set; }

    public Relationship Relationship { get; set; }

    public string? RelationshipNotes { get; set; }

    public DateOnly? Birthday { get; set; }

    public DateOnly? Anniversary { get; set; }

    public string? Phone { get; set; }

    public string? Email { get; set; }

    public PreferredContactMethod PreferredContact { get; set; } = PreferredContactMethod.None;

    public string? AddressLine1 { get; set; }

    public string? AddressLine2 { get; set; }

    public string? City { get; set; }

    public string? State { get; set; }

    public string? ZipCode { get; set; }

    public string? Country { get; set; }

    public string? ProfilePhotoUrl { get; set; }

    public string? Notes { get; set; }

    public bool IsActive { get; set; } = true;

    public bool IncludeInHolidayCards { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Household Household { get; set; } = null!;

    public ICollection<ImportantDate> ImportantDates { get; set; } = [];

    public ICollection<Gift> Gifts { get; set; } = [];

    public ICollection<GiftIdea> GiftIdeas { get; set; } = [];
}
