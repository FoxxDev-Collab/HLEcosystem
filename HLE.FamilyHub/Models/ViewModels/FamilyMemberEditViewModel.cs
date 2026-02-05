using System.ComponentModel.DataAnnotations;
using HLE.FamilyHub.Models.Enums;

namespace HLE.FamilyHub.Models.ViewModels;

/// <summary>
/// View model for editing an existing family member.
/// </summary>
public class FamilyMemberEditViewModel
{
    /// <summary>
    /// Family member ID.
    /// </summary>
    [Required]
    public int Id { get; set; }

    /// <summary>
    /// First name of the family member.
    /// </summary>
    [Required(ErrorMessage = "First name is required")]
    [Display(Name = "First Name")]
    [StringLength(100)]
    public string FirstName { get; set; } = "";

    /// <summary>
    /// Last name of the family member.
    /// </summary>
    [Required(ErrorMessage = "Last name is required")]
    [Display(Name = "Last Name")]
    [StringLength(100)]
    public string LastName { get; set; } = "";

    /// <summary>
    /// Nickname or preferred name.
    /// </summary>
    [StringLength(100)]
    public string? Nickname { get; set; }

    /// <summary>
    /// Relationship to household.
    /// </summary>
    [Required]
    public Relationship Relationship { get; set; }

    /// <summary>
    /// Additional relationship context.
    /// </summary>
    [Display(Name = "Relationship Notes")]
    [StringLength(500)]
    public string? RelationshipNotes { get; set; }

    /// <summary>
    /// Birth date.
    /// </summary>
    public DateOnly? Birthday { get; set; }

    /// <summary>
    /// Anniversary date.
    /// </summary>
    public DateOnly? Anniversary { get; set; }

    /// <summary>
    /// Phone number.
    /// </summary>
    [Phone]
    [StringLength(20)]
    public string? Phone { get; set; }

    /// <summary>
    /// Email address.
    /// </summary>
    [EmailAddress]
    [StringLength(255)]
    public string? Email { get; set; }

    /// <summary>
    /// Preferred contact method.
    /// </summary>
    [Display(Name = "Preferred Contact Method")]
    public PreferredContactMethod PreferredContact { get; set; }

    /// <summary>
    /// Street address line 1.
    /// </summary>
    [Display(Name = "Address Line 1")]
    [StringLength(200)]
    public string? AddressLine1 { get; set; }

    /// <summary>
    /// Street address line 2.
    /// </summary>
    [Display(Name = "Address Line 2")]
    [StringLength(200)]
    public string? AddressLine2 { get; set; }

    /// <summary>
    /// City.
    /// </summary>
    [StringLength(100)]
    public string? City { get; set; }

    /// <summary>
    /// State or province.
    /// </summary>
    [StringLength(50)]
    public string? State { get; set; }

    /// <summary>
    /// ZIP or postal code.
    /// </summary>
    [Display(Name = "ZIP Code")]
    [StringLength(20)]
    public string? ZipCode { get; set; }

    /// <summary>
    /// Country.
    /// </summary>
    [StringLength(100)]
    public string? Country { get; set; }

    /// <summary>
    /// Profile photo URL.
    /// </summary>
    [Display(Name = "Profile Photo URL")]
    [Url]
    [StringLength(1000)]
    public string? ProfilePhotoUrl { get; set; }

    /// <summary>
    /// General notes.
    /// </summary>
    [StringLength(2000)]
    public string? Notes { get; set; }

    /// <summary>
    /// Whether to include in holiday card list.
    /// </summary>
    [Display(Name = "Include in Holiday Cards")]
    public bool IncludeInHolidayCards { get; set; } = true;
}
