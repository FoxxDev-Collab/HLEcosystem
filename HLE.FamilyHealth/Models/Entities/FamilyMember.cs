using System.ComponentModel.DataAnnotations;

namespace HLE.FamilyHealth.Models.Entities;

public class FamilyMember
{
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string LastName { get; set; } = string.Empty;

    [Required]
    public DateOnly DateOfBirth { get; set; }

    [MaxLength(50)]
    public string? Relationship { get; set; } // Parent, Child, Spouse, Self, etc.

    [MaxLength(20)]
    public string? Gender { get; set; }

    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Optional link to FamilyFinance household for integrated cost reporting
    /// </summary>
    public int? HouseholdId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public HealthProfile? HealthProfile { get; set; }
    public ICollection<EmergencyContact> EmergencyContacts { get; set; } = [];
    public ICollection<Insurance> InsurancePolicies { get; set; } = [];
}
