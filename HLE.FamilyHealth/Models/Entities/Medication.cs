using System.ComponentModel.DataAnnotations;

namespace HLE.FamilyHealth.Models.Entities;

public class Medication
{
    public int Id { get; set; }

    [Required]
    public int FamilyMemberId { get; set; }

    [Required]
    [MaxLength(200)]
    public string MedicationName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Dosage { get; set; }

    [MaxLength(100)]
    public string? Frequency { get; set; }

    public DateOnly? StartDate { get; set; }

    public DateOnly? EndDate { get; set; }

    public bool IsActive { get; set; } = true;

    [MaxLength(200)]
    public string? PrescribedBy { get; set; }

    [MaxLength(200)]
    public string? Pharmacy { get; set; }

    public DateOnly? LastRefillDate { get; set; }

    public DateOnly? NextRefillDate { get; set; }

    public int? RefillsRemaining { get; set; }

    public string? Purpose { get; set; }

    public string? SideEffects { get; set; }

    public string? Notes { get; set; }

    // Cost tracking fields
    /// <summary>
    /// Cost per refill
    /// </summary>
    public decimal? CostPerRefill { get; set; }

    /// <summary>
    /// Insurance copay amount
    /// </summary>
    public decimal? Copay { get; set; }

    /// <summary>
    /// Whether this is typically paid from HSA
    /// </summary>
    public bool PaidFromHsa { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    // Navigation property
    public FamilyMember FamilyMember { get; set; } = null!;
}
