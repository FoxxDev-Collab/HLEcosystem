using System.ComponentModel.DataAnnotations;

namespace HLE.FamilyHealth.Models.ViewModels;

public class EmergencyContactViewModel
{
    public int Id { get; set; }

    [Required]
    [Display(Name = "Family Member")]
    public int FamilyMemberId { get; set; }

    [Required]
    [Display(Name = "Contact Name")]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [Display(Name = "Relationship")]
    [MaxLength(50)]
    public string Relationship { get; set; } = string.Empty;

    [Required]
    [Display(Name = "Phone Number")]
    [MaxLength(20)]
    [Phone]
    public string PhoneNumber { get; set; } = string.Empty;

    [Display(Name = "Alternate Phone")]
    [MaxLength(20)]
    [Phone]
    public string? AlternatePhone { get; set; }

    [Display(Name = "Email")]
    [MaxLength(200)]
    [EmailAddress]
    public string? Email { get; set; }

    [Display(Name = "Address")]
    [MaxLength(500)]
    [DataType(DataType.MultilineText)]
    public string? Address { get; set; }

    [Display(Name = "Priority")]
    [Range(1, 10)]
    public int Priority { get; set; } = 1;

    // Navigation
    public string? FamilyMemberName { get; set; }
}

public class EmergencyContactIndexViewModel
{
    public List<EmergencyContactSummary> EmergencyContacts { get; set; } = [];
    public int TotalContacts { get; set; }
}

public class EmergencyContactSummary
{
    public int Id { get; set; }
    public int FamilyMemberId { get; set; }
    public string FamilyMemberName { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Relationship { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public int Priority { get; set; }
}
