using HLE.FamilyFinance.Models.Entities;

namespace HLE.FamilyFinance.Services.Interfaces;

public record BudgetDto(
    int Id,
    int CategoryId,
    string CategoryName,
    string? CategoryIcon,
    string? CategoryColor,
    int Year,
    int Month,
    decimal Amount
);

public record BudgetCategoryDto(
    int CategoryId,
    string CategoryName,
    string? Icon,
    string? Color,
    decimal BudgetedAmount,
    decimal SpentAmount,
    decimal RemainingAmount,
    decimal PercentUsed,
    int TransactionCount
);

public record MonthlyBudgetSummaryDto(
    int Year,
    int Month,
    decimal TotalBudgeted,
    decimal TotalSpent,
    decimal TotalRemaining,
    decimal TotalIncome,
    decimal SavingsRate,
    List<BudgetCategoryDto> Categories
);

public record BudgetTrendDto(
    int Year,
    int Month,
    decimal Budgeted,
    decimal Actual
);

public interface IBudgetService
{
    Task<List<BudgetDto>> GetBudgetsAsync(int householdId, int year, int month, CancellationToken ct = default);
    Task<MonthlyBudgetSummaryDto> GetMonthlyBudgetAsync(int householdId, int year, int month, CancellationToken ct = default);
    Task<Budget> CreateBudgetAsync(int householdId, int categoryId, int year, int month, decimal amount, CancellationToken ct = default);
    Task UpdateBudgetAsync(int id, int householdId, decimal amount, CancellationToken ct = default);
    Task DeleteBudgetAsync(int id, int householdId, CancellationToken ct = default);
    Task CopyBudgetsFromPreviousMonthAsync(int householdId, int year, int month, CancellationToken ct = default);
    Task<List<BudgetTrendDto>> GetBudgetTrendsAsync(int householdId, int months, CancellationToken ct = default);
}
