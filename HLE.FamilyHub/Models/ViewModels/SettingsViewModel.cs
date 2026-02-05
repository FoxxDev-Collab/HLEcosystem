using HLE.FamilyHub.Services.Interfaces;

namespace HLE.FamilyHub.Models.ViewModels;

/// <summary>
/// View model for the settings page.
/// </summary>
public class SettingsViewModel
{
    /// <summary>
    /// Name of the household.
    /// </summary>
    public string HouseholdName { get; set; } = "";

    /// <summary>
    /// List of all family members in the household.
    /// </summary>
    public List<FamilyMemberSummaryDto> FamilyMembers { get; set; } = [];

    /// <summary>
    /// Total count of important dates.
    /// </summary>
    public int TotalDates { get; set; }

    /// <summary>
    /// Total count of gift ideas.
    /// </summary>
    public int TotalGiftIdeas { get; set; }

    /// <summary>
    /// Total count of gifts given/received.
    /// </summary>
    public int TotalGifts { get; set; }
}
