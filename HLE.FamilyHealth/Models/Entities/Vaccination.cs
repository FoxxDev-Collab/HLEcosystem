using System.ComponentModel.DataAnnotations;

namespace HLE.FamilyHealth.Models.Entities;

public class Vaccination
{
    public int Id { get; set; }

    [Required]
    public int FamilyMemberId { get; set; }

    [Required]
    [MaxLength(200)]
    public string VaccineName { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? DoseNumber { get; set; }

    [Required]
    public DateOnly DateAdministered { get; set; }

    public DateOnly? NextDoseDate { get; set; }

    [MaxLength(200)]
    public string? AdministeredBy { get; set; }

    [MaxLength(100)]
    public string? LotNumber { get; set; }

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    // Navigation property
    public FamilyMember FamilyMember { get; set; } = null!;
}
