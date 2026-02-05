using System.ComponentModel.DataAnnotations;

namespace HLE.FamilyHealth.Models.ViewModels;

public class FamilyMemberViewModel
{
    public int Id { get; set; }

    [Required]
    [Display(Name = "First Name")]
    [MaxLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    [Display(Name = "Last Name")]
    [MaxLength(100)]
    public string LastName { get; set; } = string.Empty;

    [Required]
    [Display(Name = "Date of Birth")]
    [DataType(DataType.Date)]
    public DateOnly DateOfBirth { get; set; } = DateOnly.FromDateTime(DateTime.Now.AddYears(-30));

    [Display(Name = "Relationship")]
    [MaxLength(50)]
    public string? Relationship { get; set; }

    [Display(Name = "Gender")]
    [MaxLength(20)]
    public string? Gender { get; set; }

    [Display(Name = "Active")]
    public bool IsActive { get; set; } = true;

    // Calculated properties
    public int Age => DateTime.Now.Year - DateOfBirth.Year -
        (DateTime.Now.DayOfYear < DateOfBirth.DayOfYear ? 1 : 0);

    public string FullName => $"{FirstName} {LastName}";
}

public class FamilyMemberIndexViewModel
{
    public List<FamilyMemberSummary> FamilyMembers { get; set; } = [];
    public int TotalMembers { get; set; }
    public int ActiveMembers { get; set; }
}

public class FamilyMemberSummary
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public DateOnly DateOfBirth { get; set; }
    public int Age { get; set; }
    public string? Relationship { get; set; }
    public bool IsActive { get; set; }
    public bool HasHealthProfile { get; set; }
    public int EmergencyContactsCount { get; set; }
    public int InsurancePoliciesCount { get; set; }
}
