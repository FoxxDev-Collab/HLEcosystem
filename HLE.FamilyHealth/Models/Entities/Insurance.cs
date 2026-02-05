using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HLE.FamilyHealth.Models.Entities;

public class Insurance
{
    public int Id { get; set; }

    [Required]
    public int FamilyMemberId { get; set; }

    [Required]
    [MaxLength(200)]
    public string ProviderName { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string PolicyNumber { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? GroupNumber { get; set; }

    [MaxLength(100)]
    public string? PolicyHolderName { get; set; }

    [MaxLength(50)]
    public string InsuranceType { get; set; } = "Medical"; // Medical, Dental, Vision, etc.

    [MaxLength(20)]
    public string? PhoneNumber { get; set; }

    [MaxLength(200)]
    public string? Website { get; set; }

    public DateOnly? EffectiveDate { get; set; }

    public DateOnly? ExpirationDate { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? Deductible { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? OutOfPocketMax { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? Copay { get; set; }

    public string? Notes { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    [ForeignKey(nameof(FamilyMemberId))]
    public FamilyMember FamilyMember { get; set; } = null!;
}
