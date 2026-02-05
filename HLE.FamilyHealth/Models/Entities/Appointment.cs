using System.ComponentModel.DataAnnotations;

namespace HLE.FamilyHealth.Models.Entities;

public class Appointment
{
    public int Id { get; set; }

    [Required]
    public int FamilyMemberId { get; set; }

    public int? ProviderId { get; set; }

    [Required]
    public DateTime AppointmentDateTime { get; set; }

    public int? DurationMinutes { get; set; } = 30;

    [Required]
    [MaxLength(100)]
    public string AppointmentType { get; set; } = string.Empty; // Annual Checkup, Follow-up, Specialist, Procedure, Lab Work

    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = "Scheduled"; // Scheduled, Completed, Cancelled, No-Show, Rescheduled

    [MaxLength(200)]
    public string? Location { get; set; }

    public string? ReasonForVisit { get; set; }

    public string? PreAppointmentNotes { get; set; }

    public bool ReminderSent { get; set; } = false;

    public DateTime? ReminderSentAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public FamilyMember FamilyMember { get; set; } = null!;
    public Provider? Provider { get; set; }
    public VisitSummary? VisitSummary { get; set; }
}
