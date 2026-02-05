namespace HLE.AssetTracker.Models.Enums;

/// <summary>
/// Defines the role of a member within a household
/// </summary>
public enum HouseholdRole
{
    /// <summary>
    /// Full control over household and all assets
    /// </summary>
    Owner = 0,

    /// <summary>
    /// Can manage members, categories, locations, and all assets
    /// </summary>
    Admin = 1,

    /// <summary>
    /// Can create, edit, and delete assets
    /// </summary>
    Editor = 2,

    /// <summary>
    /// Read-only access to assets
    /// </summary>
    Viewer = 3
}
