namespace HLE.FamilyHub.Models.Enums;

/// <summary>
/// Defines roles for household members with different permission levels
/// </summary>
public enum HouseholdRole
{
    /// <summary>
    /// Household owner - full control including deletion
    /// </summary>
    Owner = 0,

    /// <summary>
    /// Administrator - can manage members and all content
    /// </summary>
    Admin = 1,

    /// <summary>
    /// Editor - can create and modify content
    /// </summary>
    Editor = 2,

    /// <summary>
    /// Viewer - read-only access
    /// </summary>
    Viewer = 3
}
