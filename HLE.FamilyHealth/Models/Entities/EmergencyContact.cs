using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HLE.FamilyHealth.Models.Entities;

public class EmergencyContact
{
    public int Id { get; set; }

    [Required]
    public int FamilyMemberId { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string Relationship { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string PhoneNumber { get; set; } = string.Empty;

    [MaxLength(20)]
    public string? AlternatePhone { get; set; }

    [MaxLength(200)]
    public string? Email { get; set; }

    [MaxLength(500)]
    public string? Address { get; set; }

    public int Priority { get; set; } = 1; // 1 = primary, 2 = secondary, etc.

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    [ForeignKey(nameof(FamilyMemberId))]
    public FamilyMember FamilyMember { get; set; } = null!;
}
