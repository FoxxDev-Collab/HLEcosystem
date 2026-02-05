namespace HLE.FamilyFinance.Models.Entities;

/// <summary>
/// Represents a family/household unit that shares finances
/// </summary>
public class Household
{
    public int Id { get; set; }

    /// <summary>
    /// Display name for the household (e.g., "Smith Family")
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// The Authentik user ID of the household owner
    /// </summary>
    public string OwnerId { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ICollection<HouseholdMember> Members { get; set; } = [];
    public ICollection<Account> Accounts { get; set; } = [];
    public ICollection<Category> Categories { get; set; } = [];
    public ICollection<Transaction> Transactions { get; set; } = [];
    public ICollection<Budget> Budgets { get; set; } = [];
    public ICollection<RecurringTransaction> RecurringTransactions { get; set; } = [];
}
