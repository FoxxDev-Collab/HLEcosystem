using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HLE.FamilyHealth.Models.Entities;

public class HealthProfile
{
    public int Id { get; set; }

    [Required]
    public int FamilyMemberId { get; set; }

    [MaxLength(10)]
    public string? BloodType { get; set; } // A+, A-, B+, B-, AB+, AB-, O+, O-

    [Column(TypeName = "decimal(5,2)")]
    public decimal? HeightCm { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal? WeightKg { get; set; }

    public string? Allergies { get; set; } // JSON or delimited list

    public string? ChronicConditions { get; set; } // JSON or delimited list

    public string? MajorSurgeries { get; set; } // JSON or delimited list

    [MaxLength(200)]
    public string? PrimaryCareProvider { get; set; }

    [MaxLength(200)]
    public string? PreferredHospital { get; set; }

    public string? MedicalNotes { get; set; }

    public bool IsOrganDonor { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    [ForeignKey(nameof(FamilyMemberId))]
    public FamilyMember FamilyMember { get; set; } = null!;
}
