using System.ComponentModel.DataAnnotations;

namespace HLE.FamilyHealth.Models.ViewModels;

public class HealthProfileViewModel
{
    public int Id { get; set; }

    [Required]
    [Display(Name = "Family Member")]
    public int FamilyMemberId { get; set; }

    [Display(Name = "Blood Type")]
    [MaxLength(10)]
    public string? BloodType { get; set; }

    [Display(Name = "Height (cm)")]
    [Range(0, 300)]
    public decimal? HeightCm { get; set; }

    [Display(Name = "Weight (kg)")]
    [Range(0, 500)]
    public decimal? WeightKg { get; set; }

    [Display(Name = "Allergies")]
    [DataType(DataType.MultilineText)]
    public string? Allergies { get; set; }

    [Display(Name = "Chronic Conditions")]
    [DataType(DataType.MultilineText)]
    public string? ChronicConditions { get; set; }

    [Display(Name = "Major Surgeries")]
    [DataType(DataType.MultilineText)]
    public string? MajorSurgeries { get; set; }

    [Display(Name = "Primary Care Provider")]
    [MaxLength(200)]
    public string? PrimaryCareProvider { get; set; }

    [Display(Name = "Preferred Hospital")]
    [MaxLength(200)]
    public string? PreferredHospital { get; set; }

    [Display(Name = "Medical Notes")]
    [DataType(DataType.MultilineText)]
    public string? MedicalNotes { get; set; }

    [Display(Name = "Organ Donor")]
    public bool IsOrganDonor { get; set; }

    // Navigation
    public string? FamilyMemberName { get; set; }
}

public class HealthProfileIndexViewModel
{
    public List<HealthProfileSummary> HealthProfiles { get; set; } = [];
    public int TotalProfiles { get; set; }
    public int ProfilesWithAllergies { get; set; }
}

public class HealthProfileSummary
{
    public int Id { get; set; }
    public int FamilyMemberId { get; set; }
    public string FamilyMemberName { get; set; } = string.Empty;
    public string? BloodType { get; set; }
    public bool HasAllergies { get; set; }
    public bool HasChronicConditions { get; set; }
    public string? PrimaryCareProvider { get; set; }
}
