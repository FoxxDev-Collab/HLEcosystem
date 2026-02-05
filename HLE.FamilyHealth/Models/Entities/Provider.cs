using System.ComponentModel.DataAnnotations;

namespace HLE.FamilyHealth.Models.Entities;

public class Provider
{
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Specialty { get; set; }

    [Required]
    [MaxLength(50)]
    public string Type { get; set; } = "Doctor"; // Doctor, Dentist, Hospital, Lab, Pharmacy, etc.

    [MaxLength(500)]
    public string? Address { get; set; }

    [MaxLength(20)]
    public string? PhoneNumber { get; set; }

    [MaxLength(20)]
    public string? FaxNumber { get; set; }

    [MaxLength(200)]
    public string? Email { get; set; }

    [MaxLength(200)]
    public string? Website { get; set; }

    [MaxLength(200)]
    public string? PortalUrl { get; set; }

    [MaxLength(100)]
    public string? PreferredContactMethod { get; set; }

    public string? Notes { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}
