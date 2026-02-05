using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace HLE.FamilyHealth.Models.ViewModels;

public record MedicationListDto
{
    public int Id { get; init; }
    public int FamilyMemberId { get; init; }
    public string FamilyMemberName { get; init; } = string.Empty;
    public string MedicationName { get; init; } = string.Empty;
    public string? Dosage { get; init; }
    public string? Frequency { get; init; }
    public bool IsActive { get; init; }
    public DateOnly? NextRefillDate { get; init; }
    public int? DaysUntilRefill { get; init; }
    public int? RefillsRemaining { get; init; }
}

public class MedicationCreateDto
{
    [Required(ErrorMessage = "Please select a family member")]
    [Display(Name = "Family Member")]
    public int FamilyMemberId { get; set; }

    [Required(ErrorMessage = "Medication name is required")]
    [MaxLength(200)]
    [Display(Name = "Medication Name")]
    public string MedicationName { get; set; } = string.Empty;

    [MaxLength(100)]
    [Display(Name = "Dosage")]
    public string? Dosage { get; set; }

    [MaxLength(100)]
    [Display(Name = "Frequency")]
    public string? Frequency { get; set; }

    [Display(Name = "Start Date")]
    [DataType(DataType.Date)]
    public DateOnly? StartDate { get; set; }

    [Display(Name = "End Date")]
    [DataType(DataType.Date)]
    public DateOnly? EndDate { get; set; }

    [Display(Name = "Currently Active")]
    public bool IsActive { get; set; } = true;

    [MaxLength(200)]
    [Display(Name = "Prescribed By")]
    public string? PrescribedBy { get; set; }

    [MaxLength(200)]
    [Display(Name = "Pharmacy")]
    public string? Pharmacy { get; set; }

    [Display(Name = "Last Refill Date")]
    [DataType(DataType.Date)]
    public DateOnly? LastRefillDate { get; set; }

    [Display(Name = "Next Refill Date")]
    [DataType(DataType.Date)]
    public DateOnly? NextRefillDate { get; set; }

    [Display(Name = "Refills Remaining")]
    [Range(0, 99)]
    public int? RefillsRemaining { get; set; }

    [Display(Name = "Purpose")]
    [DataType(DataType.MultilineText)]
    public string? Purpose { get; set; }

    [Display(Name = "Side Effects")]
    [DataType(DataType.MultilineText)]
    public string? SideEffects { get; set; }

    [Display(Name = "Notes")]
    [DataType(DataType.MultilineText)]
    public string? Notes { get; set; }
}

public class MedicationEditDto : MedicationCreateDto
{
    public int Id { get; set; }
}

public class MedicationIndexViewModel
{
    public List<MedicationListDto> ActiveMedications { get; set; } = [];
    public List<MedicationListDto> InactiveMedications { get; set; } = [];
    public List<MedicationListDto> RefillAlerts { get; set; } = [];
    public List<SelectListItem> FamilyMembers { get; set; } = [];
}
