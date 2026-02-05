using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace HLE.FamilyHealth.Models.ViewModels;

public record AppointmentListDto
{
    public int Id { get; init; }
    public int FamilyMemberId { get; init; }
    public string FamilyMemberName { get; init; } = string.Empty;
    public int? ProviderId { get; init; }
    public string? ProviderName { get; init; }
    public DateTime AppointmentDateTime { get; init; }
    public int? DurationMinutes { get; init; }
    public string AppointmentType { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string? Location { get; init; }
    public string? ReasonForVisit { get; init; }
    public bool ReminderSent { get; init; }
    public int? DaysUntilAppointment { get; init; }
    public bool HasVisitSummary { get; init; }
}

public record AppointmentCalendarDto
{
    public int Id { get; init; }
    public string FamilyMemberName { get; init; } = string.Empty;
    public DateTime AppointmentDateTime { get; init; }
    public int? DurationMinutes { get; init; }
    public string AppointmentType { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string? ProviderName { get; init; }
}

public class AppointmentCreateDto
{
    [Required(ErrorMessage = "Please select a family member")]
    [Display(Name = "Family Member")]
    public int FamilyMemberId { get; set; }

    [Display(Name = "Provider")]
    public int? ProviderId { get; set; }

    [Required(ErrorMessage = "Appointment date and time is required")]
    [Display(Name = "Appointment Date & Time")]
    public DateTime AppointmentDateTime { get; set; } = DateTime.Now.AddDays(1);

    [Display(Name = "Duration (minutes)")]
    [Range(5, 480, ErrorMessage = "Duration must be between 5 and 480 minutes")]
    public int? DurationMinutes { get; set; } = 30;

    [Required(ErrorMessage = "Appointment type is required")]
    [MaxLength(100)]
    [Display(Name = "Appointment Type")]
    public string AppointmentType { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    [Display(Name = "Status")]
    public string Status { get; set; } = "Scheduled";

    [MaxLength(200)]
    [Display(Name = "Location/Facility")]
    public string? Location { get; set; }

    [Display(Name = "Reason for Visit")]
    [DataType(DataType.MultilineText)]
    public string? ReasonForVisit { get; set; }

    [Display(Name = "Pre-Appointment Notes")]
    [DataType(DataType.MultilineText)]
    public string? PreAppointmentNotes { get; set; }
}

public class AppointmentEditDto : AppointmentCreateDto
{
    public int Id { get; set; }
    public bool ReminderSent { get; set; }
}

public class AppointmentIndexViewModel
{
    public List<AppointmentListDto> UpcomingAppointments { get; set; } = [];
    public List<AppointmentListDto> PastAppointments { get; set; } = [];
    public List<SelectListItem> FamilyMembers { get; set; } = [];
    public List<SelectListItem> Providers { get; set; } = [];
}

public class AppointmentCalendarViewModel
{
    public int Year { get; set; }
    public int Month { get; set; }
    public List<AppointmentCalendarDto> Appointments { get; set; } = [];
    public List<SelectListItem> FamilyMembers { get; set; } = [];
}
