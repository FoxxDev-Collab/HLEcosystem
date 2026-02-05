using System.ComponentModel.DataAnnotations;

namespace HLE.FamilyHealth.Models.ViewModels;

public class InsuranceViewModel
{
    public int Id { get; set; }

    [Required]
    [Display(Name = "Family Member")]
    public int FamilyMemberId { get; set; }

    [Required]
    [Display(Name = "Provider Name")]
    [MaxLength(200)]
    public string ProviderName { get; set; } = string.Empty;

    [Required]
    [Display(Name = "Policy Number")]
    [MaxLength(100)]
    public string PolicyNumber { get; set; } = string.Empty;

    [Display(Name = "Group Number")]
    [MaxLength(100)]
    public string? GroupNumber { get; set; }

    [Display(Name = "Policy Holder Name")]
    [MaxLength(100)]
    public string? PolicyHolderName { get; set; }

    [Display(Name = "Insurance Type")]
    [MaxLength(50)]
    public string InsuranceType { get; set; } = "Medical";

    [Display(Name = "Phone Number")]
    [MaxLength(20)]
    [Phone]
    public string? PhoneNumber { get; set; }

    [Display(Name = "Website")]
    [MaxLength(200)]
    [Url]
    public string? Website { get; set; }

    [Display(Name = "Effective Date")]
    [DataType(DataType.Date)]
    public DateOnly? EffectiveDate { get; set; }

    [Display(Name = "Expiration Date")]
    [DataType(DataType.Date)]
    public DateOnly? ExpirationDate { get; set; }

    [Display(Name = "Deductible")]
    [DataType(DataType.Currency)]
    public decimal? Deductible { get; set; }

    [Display(Name = "Out of Pocket Max")]
    [DataType(DataType.Currency)]
    public decimal? OutOfPocketMax { get; set; }

    [Display(Name = "Copay")]
    [DataType(DataType.Currency)]
    public decimal? Copay { get; set; }

    [Display(Name = "Notes")]
    [DataType(DataType.MultilineText)]
    public string? Notes { get; set; }

    [Display(Name = "Active")]
    public bool IsActive { get; set; } = true;

    // Navigation
    public string? FamilyMemberName { get; set; }
}

public class InsuranceIndexViewModel
{
    public List<InsuranceSummary> InsurancePolicies { get; set; } = [];
    public int TotalPolicies { get; set; }
    public int ActivePolicies { get; set; }
}

public class InsuranceSummary
{
    public int Id { get; set; }
    public int FamilyMemberId { get; set; }
    public string FamilyMemberName { get; set; } = string.Empty;
    public string ProviderName { get; set; } = string.Empty;
    public string PolicyNumber { get; set; } = string.Empty;
    public string InsuranceType { get; set; } = string.Empty;
    public DateOnly? ExpirationDate { get; set; }
    public bool IsActive { get; set; }
    public bool IsExpiringSoon => ExpirationDate.HasValue &&
        ExpirationDate.Value <= DateOnly.FromDateTime(DateTime.Now.AddDays(30));
}
