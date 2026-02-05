using HLE.FamilyFinance.Data;
using HLE.FamilyFinance.Models.Entities;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyFinance.Services;

public class BudgetService(ApplicationDbContext context, ILogger<BudgetService> logger) : IBudgetService
{
    public async Task<List<BudgetDto>> GetBudgetsAsync(int householdId, int year, int month, CancellationToken ct = default)
    {
        return await context.Budgets
            .AsNoTracking()
            .Include(b => b.Category)
            .Where(b => b.HouseholdId == householdId && b.Year == year && b.Month == month)
            .Select(b => new BudgetDto(
                b.Id,
                b.CategoryId,
                b.Category.Name,
                b.Category.Icon,
                b.Category.Color,
                b.Year,
                b.Month,
                b.Amount
            ))
            .ToListAsync(ct);
    }

    public async Task<MonthlyBudgetSummaryDto> GetMonthlyBudgetAsync(int householdId, int year, int month, CancellationToken ct = default)
    {
        var startDate = new DateOnly(year, month, 1);
        var endDate = startDate.AddMonths(1).AddDays(-1);

        // Get all expense categories for the household
        var categories = await context.Categories
            .AsNoTracking()
            .Where(c => c.HouseholdId == householdId && c.Type == CategoryType.Expense && !c.IsArchived)
            .OrderBy(c => c.SortOrder)
            .ToListAsync(ct);

        // Get budgets for this month
        var budgets = await context.Budgets
            .AsNoTracking()
            .Where(b => b.HouseholdId == householdId && b.Year == year && b.Month == month)
            .ToDictionaryAsync(b => b.CategoryId, b => b.Amount, ct);

        // Get spending by category for this month (excluding balance adjustments)
        var spending = await context.Transactions
            .AsNoTracking()
            .Where(t => t.HouseholdId == householdId &&
                       t.Type == TransactionType.Expense &&
                       t.Date >= startDate &&
                       t.Date <= endDate &&
                       t.CategoryId.HasValue &&
                       !t.IsBalanceAdjustment)
            .GroupBy(t => t.CategoryId)
            .Select(g => new { CategoryId = g.Key!.Value, Amount = g.Sum(t => t.Amount), Count = g.Count() })
            .ToDictionaryAsync(x => x.CategoryId, x => (x.Amount, x.Count), ct);

        // Get total income for savings rate calculation (excluding balance adjustments and transfers)
        var totalIncome = await context.Transactions
            .AsNoTracking()
            .Where(t => t.HouseholdId == householdId &&
                       t.Type == TransactionType.Income &&
                       t.Date >= startDate &&
                       t.Date <= endDate &&
                       !t.IsBalanceAdjustment &&
                       (t.Category == null || t.Category.Type != CategoryType.Transfer))
            .SumAsync(t => t.Amount, ct);

        var budgetCategories = categories.Select(c =>
        {
            var budgeted = budgets.GetValueOrDefault(c.Id, c.DefaultBudgetAmount ?? 0);
            var (spent, count) = spending.GetValueOrDefault(c.Id, (0, 0));
            var remaining = budgeted - spent;
            var percentUsed = budgeted > 0 ? (spent / budgeted) * 100 : 0;

            return new BudgetCategoryDto(
                c.Id,
                c.Name,
                c.Icon,
                c.Color,
                budgeted,
                spent,
                remaining,
                percentUsed,
                count
            );
        }).ToList();

        var totalBudgeted = budgetCategories.Sum(b => b.BudgetedAmount);
        var totalSpent = budgetCategories.Sum(b => b.SpentAmount);
        var totalRemaining = totalBudgeted - totalSpent;
        var savingsRate = totalIncome > 0 ? ((totalIncome - totalSpent) / totalIncome) * 100 : 0;

        return new MonthlyBudgetSummaryDto(
            year,
            month,
            totalBudgeted,
            totalSpent,
            totalRemaining,
            totalIncome,
            savingsRate,
            budgetCategories
        );
    }

    public async Task<Budget> CreateBudgetAsync(int householdId, int categoryId, int year, int month, decimal amount, CancellationToken ct = default)
    {
        var existing = await context.Budgets
            .FirstOrDefaultAsync(b => b.HouseholdId == householdId &&
                                     b.CategoryId == categoryId &&
                                     b.Year == year &&
                                     b.Month == month, ct);

        if (existing != null)
        {
            throw new InvalidOperationException("Budget already exists for this category and month");
        }

        var budget = new Budget
        {
            HouseholdId = householdId,
            CategoryId = categoryId,
            Year = year,
            Month = month,
            Amount = amount,
            CreatedAt = DateTime.UtcNow
        };

        context.Budgets.Add(budget);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Created budget for category {CategoryId} in {Year}/{Month}", categoryId, year, month);
        return budget;
    }

    public async Task UpdateBudgetAsync(int id, int householdId, decimal amount, CancellationToken ct = default)
    {
        var budget = await context.Budgets
            .FirstOrDefaultAsync(b => b.Id == id && b.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Budget not found");

        budget.Amount = amount;
        budget.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync(ct);
        logger.LogInformation("Updated budget {BudgetId} to {Amount}", id, amount);
    }

    public async Task DeleteBudgetAsync(int id, int householdId, CancellationToken ct = default)
    {
        var budget = await context.Budgets
            .FirstOrDefaultAsync(b => b.Id == id && b.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Budget not found");

        context.Budgets.Remove(budget);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Deleted budget {BudgetId}", id);
    }

    public async Task CopyBudgetsFromPreviousMonthAsync(int householdId, int year, int month, CancellationToken ct = default)
    {
        // Calculate previous month
        var prevDate = new DateOnly(year, month, 1).AddMonths(-1);
        var prevYear = prevDate.Year;
        var prevMonth = prevDate.Month;

        var previousBudgets = await context.Budgets
            .AsNoTracking()
            .Where(b => b.HouseholdId == householdId && b.Year == prevYear && b.Month == prevMonth)
            .ToListAsync(ct);

        if (previousBudgets.Count == 0)
        {
            logger.LogWarning("No budgets found for {Year}/{Month} to copy", prevYear, prevMonth);
            return;
        }

        // Copy budgets (don't overwrite existing)
        foreach (var prev in previousBudgets)
        {
            var exists = await context.Budgets
                .AnyAsync(b => b.HouseholdId == householdId &&
                              b.CategoryId == prev.CategoryId &&
                              b.Year == year &&
                              b.Month == month, ct);

            if (!exists)
            {
                context.Budgets.Add(new Budget
                {
                    HouseholdId = householdId,
                    CategoryId = prev.CategoryId,
                    Year = year,
                    Month = month,
                    Amount = prev.Amount,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        await context.SaveChangesAsync(ct);
        logger.LogInformation("Copied budgets from {PrevYear}/{PrevMonth} to {Year}/{Month}",
            prevYear, prevMonth, year, month);
    }

    public async Task<List<BudgetTrendDto>> GetBudgetTrendsAsync(int householdId, int months, CancellationToken ct = default)
    {
        var endDate = DateOnly.FromDateTime(DateTime.UtcNow);
        var startDate = endDate.AddMonths(-months + 1);
        startDate = new DateOnly(startDate.Year, startDate.Month, 1);

        var budgets = await context.Budgets
            .AsNoTracking()
            .Where(b => b.HouseholdId == householdId)
            .Where(b => (b.Year > startDate.Year) ||
                       (b.Year == startDate.Year && b.Month >= startDate.Month))
            .GroupBy(b => new { b.Year, b.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, Amount = g.Sum(b => b.Amount) })
            .ToDictionaryAsync(x => (x.Year, x.Month), x => x.Amount, ct);

        var spending = await context.Transactions
            .AsNoTracking()
            .Where(t => t.HouseholdId == householdId &&
                       t.Type == TransactionType.Expense &&
                       t.Date >= startDate &&
                       !t.IsBalanceAdjustment)
            .GroupBy(t => new { t.Date.Year, t.Date.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, Amount = g.Sum(t => t.Amount) })
            .ToDictionaryAsync(x => (x.Year, x.Month), x => x.Amount, ct);

        var results = new List<BudgetTrendDto>();
        var current = startDate;
        while (current <= endDate)
        {
            var key = (current.Year, current.Month);
            results.Add(new BudgetTrendDto(
                current.Year,
                current.Month,
                budgets.GetValueOrDefault(key, 0),
                spending.GetValueOrDefault(key, 0)
            ));
            current = current.AddMonths(1);
        }

        return results;
    }
}
