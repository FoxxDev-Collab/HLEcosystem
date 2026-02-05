using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace HLE.FamilyHealth.Models.ViewModels;

public record VaccinationListDto
{
    public int Id { get; init; }
    public int FamilyMemberId { get; init; }
    public string FamilyMemberName { get; init; } = string.Empty;
    public string VaccineName { get; init; } = string.Empty;
    public string? DoseNumber { get; init; }
    public DateOnly DateAdministered { get; init; }
    public DateOnly? NextDoseDate { get; init; }
    public int? DaysUntilNextDose { get; init; }
}

public class VaccinationCreateDto
{
    [Required(ErrorMessage = "Please select a family member")]
    [Display(Name = "Family Member")]
    public int FamilyMemberId { get; set; }

    [Required(ErrorMessage = "Vaccine name is required")]
    [MaxLength(200)]
    [Display(Name = "Vaccine Name")]
    public string VaccineName { get; set; } = string.Empty;

    [MaxLength(50)]
    [Display(Name = "Dose Number")]
    public string? DoseNumber { get; set; }

    [Required(ErrorMessage = "Date administered is required")]
    [Display(Name = "Date Administered")]
    [DataType(DataType.Date)]
    public DateOnly DateAdministered { get; set; }

    [Display(Name = "Next Dose Date")]
    [DataType(DataType.Date)]
    public DateOnly? NextDoseDate { get; set; }

    [MaxLength(200)]
    [Display(Name = "Administered By")]
    public string? AdministeredBy { get; set; }

    [MaxLength(100)]
    [Display(Name = "Lot Number")]
    public string? LotNumber { get; set; }

    [Display(Name = "Notes")]
    [DataType(DataType.MultilineText)]
    public string? Notes { get; set; }
}

public class VaccinationEditDto : VaccinationCreateDto
{
    public int Id { get; set; }
}

public class VaccinationIndexViewModel
{
    public List<VaccinationListDto> Vaccinations { get; set; } = [];
    public List<VaccinationListDto> UpcomingDoses { get; set; } = [];
    public List<SelectListItem> FamilyMembers { get; set; } = [];
}
