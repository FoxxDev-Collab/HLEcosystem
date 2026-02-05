using System.ComponentModel.DataAnnotations;

namespace HLE.FamilyHealth.Models.Entities;

public class VisitSummary
{
    public int Id { get; set; }

    public int? AppointmentId { get; set; }

    [Required]
    public int FamilyMemberId { get; set; }

    public int? ProviderId { get; set; }

    [Required]
    public DateTime VisitDate { get; set; }

    [MaxLength(500)]
    public string? ChiefComplaint { get; set; }

    public string? Diagnosis { get; set; }

    public string? TreatmentProvided { get; set; }

    public string? PrescriptionsWritten { get; set; }

    public string? LabTestsOrdered { get; set; }

    public string? FollowUpInstructions { get; set; }

    public DateTime? NextVisitRecommended { get; set; }

    public string? AttachedDocuments { get; set; } // File paths or URLs

    public string? Notes { get; set; }

    [MaxLength(100)]
    public string? VisitType { get; set; } // In-Person, Telehealth, Emergency, Hospital

    // Cost tracking fields
    /// <summary>
    /// Total amount billed for this visit
    /// </summary>
    public decimal? BilledAmount { get; set; }

    /// <summary>
    /// Amount covered by insurance
    /// </summary>
    public decimal? InsurancePaid { get; set; }

    /// <summary>
    /// Patient's out-of-pocket cost after insurance
    /// </summary>
    public decimal? OutOfPocketCost { get; set; }

    /// <summary>
    /// Whether this expense was paid from an HSA
    /// </summary>
    public bool PaidFromHsa { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public Appointment? Appointment { get; set; }
    public FamilyMember FamilyMember { get; set; } = null!;
    public Provider? Provider { get; set; }
}
