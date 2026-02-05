namespace HLE.FamilyHub.Models.Enums;

/// <summary>
/// Defines how often an important date recurs
/// </summary>
public enum RecurrenceType
{
    /// <summary>
    /// One-time event, does not recur
    /// </summary>
    Once = 0,

    /// <summary>
    /// Recurs annually on the same date
    /// </summary>
    Annual = 1
}
