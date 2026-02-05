namespace HLE.FamilyFinance.Models.Enums;

/// <summary>
/// Defines the role of a member within a household
/// </summary>
public enum HouseholdRole
{
    /// <summary>
    /// Full control over household and all finances
    /// </summary>
    Owner = 0,

    /// <summary>
    /// Can manage members, categories, accounts, and all transactions
    /// </summary>
    Admin = 1,

    /// <summary>
    /// Can create, edit, and delete transactions and budgets
    /// </summary>
    Editor = 2,

    /// <summary>
    /// Read-only access to financial data
    /// </summary>
    Viewer = 3
}
