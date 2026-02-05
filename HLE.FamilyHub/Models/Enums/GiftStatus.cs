namespace HLE.FamilyHub.Models.Enums;

/// <summary>
/// Defines the current status of a gift
/// </summary>
public enum GiftStatus
{
    /// <summary>
    /// Gift idea, not yet purchased
    /// </summary>
    Idea = 0,

    /// <summary>
    /// Gift has been purchased
    /// </summary>
    Purchased = 1,

    /// <summary>
    /// Gift has been wrapped
    /// </summary>
    Wrapped = 2,

    /// <summary>
    /// Gift has been given to the recipient
    /// </summary>
    Given = 3
}
