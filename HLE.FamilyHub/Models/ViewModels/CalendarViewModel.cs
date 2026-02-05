using HLE.FamilyHub.Services.Interfaces;

namespace HLE.FamilyHub.Models.ViewModels;

/// <summary>
/// View model for the calendar page.
/// </summary>
public class CalendarViewModel
{
    /// <summary>
    /// Year being displayed.
    /// </summary>
    public int Year { get; set; }

    /// <summary>
    /// Month being displayed (1-12).
    /// </summary>
    public int Month { get; set; }

    /// <summary>
    /// Important dates for the month.
    /// </summary>
    public List<ImportantDateSummaryDto> Dates { get; set; } = [];

    /// <summary>
    /// Events grouped by day of month.
    /// </summary>
    public Dictionary<int, List<ImportantDateSummaryDto>> EventsByDay { get; set; } = new();

    /// <summary>
    /// Formatted month name (e.g., "January 2026").
    /// </summary>
    public string MonthName { get; set; } = "";
}
