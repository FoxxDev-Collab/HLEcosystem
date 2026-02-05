using System.ComponentModel.DataAnnotations;
using HLE.FamilyHub.Models.Enums;

namespace HLE.FamilyHub.Models.ViewModels;

/// <summary>
/// View model for creating a new important date.
/// </summary>
public class ImportantDateCreateViewModel
{
    /// <summary>
    /// Label for the date (e.g., "John's Birthday", "Our Anniversary").
    /// </summary>
    [Required(ErrorMessage = "Label is required")]
    [StringLength(200)]
    public string Label { get; set; } = "";

    /// <summary>
    /// The date itself.
    /// </summary>
    [Required(ErrorMessage = "Date is required")]
    public DateOnly Date { get; set; }

    /// <summary>
    /// Type of important date.
    /// </summary>
    [Required]
    public ImportantDateType Type { get; set; }

    /// <summary>
    /// Whether and how the date recurs.
    /// </summary>
    [Required]
    [Display(Name = "Recurrence Type")]
    public RecurrenceType RecurrenceType { get; set; } = RecurrenceType.Annual;

    /// <summary>
    /// Number of days before the date to send a reminder.
    /// </summary>
    [Required]
    [Display(Name = "Reminder Days Before")]
    [Range(0, 365)]
    public int ReminderDaysBefore { get; set; } = 14;

    /// <summary>
    /// Optional family member this date is associated with.
    /// </summary>
    [Display(Name = "Family Member")]
    public int? FamilyMemberId { get; set; }

    /// <summary>
    /// Additional notes about this date.
    /// </summary>
    [StringLength(2000)]
    public string? Notes { get; set; }
}
