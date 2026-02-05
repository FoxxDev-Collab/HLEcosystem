namespace HLE.FamilyHub.Models.Enums;

/// <summary>
/// Defines the status of a gift idea
/// </summary>
public enum GiftIdeaStatus
{
    /// <summary>
    /// Idea is active and being considered
    /// </summary>
    Active = 0,

    /// <summary>
    /// Idea has been purchased as a gift
    /// </summary>
    Purchased = 1,

    /// <summary>
    /// No longer interested in this idea
    /// </summary>
    NotInterested = 2
}
