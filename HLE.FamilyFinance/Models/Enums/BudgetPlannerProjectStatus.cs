namespace HLE.FamilyFinance.Models.Enums;

/// <summary>
/// Represents the status of a budget planner project
/// </summary>
public enum BudgetPlannerProjectStatus
{
    /// <summary>
    /// Project is being planned, items are being added
    /// </summary>
    Planning,

    /// <summary>
    /// Actively saving for this project
    /// </summary>
    Active,

    /// <summary>
    /// Project has been completed/purchased
    /// </summary>
    Completed,

    /// <summary>
    /// Project has been cancelled
    /// </summary>
    Cancelled
}
