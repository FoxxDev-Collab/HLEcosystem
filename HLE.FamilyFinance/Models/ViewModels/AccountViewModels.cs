using System.ComponentModel.DataAnnotations;
using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Models.ViewModels;

public class AccountCreateViewModel
{
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = "";

    [Required]
    public AccountType Type { get; set; }

    [StringLength(50)]
    public string? Institution { get; set; }

    [StringLength(50)]
    public string? AccountNumber { get; set; }

    [Required]
    [Range(typeof(decimal), "-99999999999999.99", "99999999999999.99")]
    public decimal CurrentBalance { get; set; }

    [StringLength(3)]
    public string Currency { get; set; } = "USD";

    [StringLength(500)]
    public string? Notes { get; set; }

    // HSA-specific fields
    [Range(typeof(decimal), "0", "99999.99")]
    [Display(Name = "Annual Contribution Limit")]
    public decimal? HsaAnnualLimit { get; set; }

    [Display(Name = "Family Coverage")]
    public bool? HsaFamilyCoverage { get; set; }
}

public class AccountEditViewModel
{
    public int Id { get; set; }

    [Required]
    [StringLength(100)]
    public string Name { get; set; } = "";

    [Required]
    public AccountType Type { get; set; }

    [StringLength(50)]
    public string? Institution { get; set; }

    [StringLength(50)]
    public string? AccountNumber { get; set; }

    [Required]
    [Range(typeof(decimal), "-99999999999999.99", "99999999999999.99")]
    public decimal CurrentBalance { get; set; }

    [StringLength(3)]
    public string Currency { get; set; } = "USD";

    [StringLength(500)]
    public string? Notes { get; set; }

    public bool IsArchived { get; set; }

    // HSA-specific fields
    [Range(typeof(decimal), "0", "99999.99")]
    [Display(Name = "Annual Contribution Limit")]
    public decimal? HsaAnnualLimit { get; set; }

    [Display(Name = "Family Coverage")]
    public bool? HsaFamilyCoverage { get; set; }
}
