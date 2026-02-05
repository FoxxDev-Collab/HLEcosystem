using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace HLE.FamilyHealth.Models.ViewModels;

public record VisitSummaryListDto
{
    public int Id { get; init; }
    public int? AppointmentId { get; init; }
    public int FamilyMemberId { get; init; }
    public string FamilyMemberName { get; init; } = string.Empty;
    public int? ProviderId { get; init; }
    public string? ProviderName { get; init; }
    public DateTime VisitDate { get; init; }
    public string? ChiefComplaint { get; init; }
    public string? Diagnosis { get; init; }
    public string? VisitType { get; init; }
    public DateTime? NextVisitRecommended { get; init; }
}

public class VisitSummaryCreateDto
{
    [Display(Name = "Related Appointment")]
    public int? AppointmentId { get; set; }

    [Required(ErrorMessage = "Please select a family member")]
    [Display(Name = "Family Member")]
    public int FamilyMemberId { get; set; }

    [Display(Name = "Provider")]
    public int? ProviderId { get; set; }

    [Required(ErrorMessage = "Visit date is required")]
    [Display(Name = "Visit Date")]
    public DateTime VisitDate { get; set; } = DateTime.Now;

    [MaxLength(500)]
    [Display(Name = "Chief Complaint")]
    public string? ChiefComplaint { get; set; }

    [Display(Name = "Diagnosis")]
    [DataType(DataType.MultilineText)]
    public string? Diagnosis { get; set; }

    [Display(Name = "Treatment Provided")]
    [DataType(DataType.MultilineText)]
    public string? TreatmentProvided { get; set; }

    [Display(Name = "Prescriptions Written")]
    [DataType(DataType.MultilineText)]
    public string? PrescriptionsWritten { get; set; }

    [Display(Name = "Lab Tests Ordered")]
    [DataType(DataType.MultilineText)]
    public string? LabTestsOrdered { get; set; }

    [Display(Name = "Follow-Up Instructions")]
    [DataType(DataType.MultilineText)]
    public string? FollowUpInstructions { get; set; }

    [Display(Name = "Next Visit Recommended")]
    public DateTime? NextVisitRecommended { get; set; }

    [Display(Name = "Attached Documents")]
    [DataType(DataType.MultilineText)]
    public string? AttachedDocuments { get; set; }

    [Display(Name = "Notes")]
    [DataType(DataType.MultilineText)]
    public string? Notes { get; set; }

    [MaxLength(100)]
    [Display(Name = "Visit Type")]
    public string? VisitType { get; set; }
}

public class VisitSummaryEditDto : VisitSummaryCreateDto
{
    public int Id { get; set; }
}

public class VisitSummaryIndexViewModel
{
    public List<VisitSummaryListDto> VisitSummaries { get; set; } = [];
    public List<SelectListItem> FamilyMembers { get; set; } = [];
    public List<SelectListItem> Providers { get; set; } = [];
}
