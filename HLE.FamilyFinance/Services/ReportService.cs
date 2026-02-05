using HLE.FamilyFinance.Data;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace HLE.FamilyFinance.Services;

public class ReportService(
    ApplicationDbContext context,
    IAccountService accountService,
    IRecurringTransactionService recurringService,
    ILogger<ReportService> logger) : IReportService
{
    public async Task<DashboardStatsDto> GetDashboardStatsAsync(int householdId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var startOfMonth = new DateOnly(now.Year, now.Month, 1);
        var endOfMonth = startOfMonth.AddMonths(1).AddDays(-1);

        // Net worth
        var netWorth = await accountService.GetNetWorthAsync(householdId, ct);

        // Monthly income/expenses (excluding balance adjustments and transfers)
        // Also exclude transactions with Transfer category type (for manually categorized transfers)
        var monthlyTotals = await context.Transactions
            .AsNoTracking()
            .Where(t => t.HouseholdId == householdId &&
                       t.Date >= startOfMonth &&
                       t.Date <= endOfMonth &&
                       t.Type != TransactionType.Transfer &&
                       !t.IsBalanceAdjustment &&
                       (t.Category == null || t.Category.Type != CategoryType.Transfer))
            .GroupBy(t => t.Type)
            .Select(g => new { Type = g.Key, Total = g.Sum(t => t.Amount) })
            .ToListAsync(ct);

        var monthlyIncome = monthlyTotals.FirstOrDefault(t => t.Type == TransactionType.Income)?.Total ?? 0;
        var monthlyExpenses = monthlyTotals.FirstOrDefault(t => t.Type == TransactionType.Expense)?.Total ?? 0;

        // Budget usage
        var totalBudgeted = await context.Budgets
            .AsNoTracking()
            .Where(b => b.HouseholdId == householdId && b.Year == now.Year && b.Month == now.Month)
            .SumAsync(b => b.Amount, ct);
        var budgetUsedPercent = totalBudgeted > 0 ? (monthlyExpenses / totalBudgeted) * 100 : 0;

        // Upcoming bills
        var upcoming = await recurringService.GetUpcomingTransactionsAsync(householdId, 14, ct);
        var upcomingExpenses = upcoming.Where(u => u.Type == TransactionType.Expense).ToList();

        // Accounts count
        var accountsCount = await context.Accounts
            .CountAsync(a => a.HouseholdId == householdId && !a.IsArchived, ct);

        // Transactions this month
        var transactionsThisMonth = await context.Transactions
            .CountAsync(t => t.HouseholdId == householdId &&
                            t.Date >= startOfMonth &&
                            t.Date <= endOfMonth, ct);

        return new DashboardStatsDto(
            netWorth.NetWorth,
            monthlyIncome,
            monthlyExpenses,
            monthlyIncome - monthlyExpenses,
            budgetUsedPercent,
            upcomingExpenses.Count,
            upcomingExpenses.Sum(u => u.Amount),
            accountsCount,
            transactionsThisMonth
        );
    }

    public async Task<List<CashFlowDto>> GetCashFlowAsync(int householdId, int months, CancellationToken ct = default)
    {
        var endDate = DateOnly.FromDateTime(DateTime.UtcNow);
        var startDate = endDate.AddMonths(-months + 1);
        startDate = new DateOnly(startDate.Year, startDate.Month, 1);

        var transactions = await context.Transactions
            .AsNoTracking()
            .Where(t => t.HouseholdId == householdId &&
                       t.Date >= startDate &&
                       t.Type != TransactionType.Transfer &&
                       !t.IsBalanceAdjustment &&
                       (t.Category == null || t.Category.Type != CategoryType.Transfer))
            .GroupBy(t => new { t.Date.Year, t.Date.Month, t.Type })
            .Select(g => new { g.Key.Year, g.Key.Month, g.Key.Type, Total = g.Sum(t => t.Amount) })
            .ToListAsync(ct);

        var results = new List<CashFlowDto>();
        var current = startDate;

        while (current <= endDate)
        {
            var income = transactions
                .Where(t => t.Year == current.Year && t.Month == current.Month && t.Type == TransactionType.Income)
                .Sum(t => t.Total);
            var expenses = transactions
                .Where(t => t.Year == current.Year && t.Month == current.Month && t.Type == TransactionType.Expense)
                .Sum(t => t.Total);

            results.Add(new CashFlowDto(
                current.Year,
                current.Month,
                CultureInfo.CurrentCulture.DateTimeFormat.GetAbbreviatedMonthName(current.Month),
                income,
                expenses,
                income - expenses
            ));

            current = current.AddMonths(1);
        }

        return results;
    }

    public async Task<List<SpendingByCategoryDto>> GetYearlySpendingByCategoryAsync(int householdId, int year, CancellationToken ct = default)
    {
        var startDate = new DateOnly(year, 1, 1);
        var endDate = new DateOnly(year, 12, 31);

        var spending = await context.Transactions
            .AsNoTracking()
            .Include(t => t.Category)
            .Where(t => t.HouseholdId == householdId &&
                       t.Type == TransactionType.Expense &&
                       t.Date >= startDate &&
                       t.Date <= endDate &&
                       t.CategoryId.HasValue &&
                       !t.IsBalanceAdjustment)
            .GroupBy(t => new { t.CategoryId, t.Category!.Name, t.Category.Icon, t.Category.Color })
            .Select(g => new
            {
                g.Key.CategoryId,
                g.Key.Name,
                g.Key.Icon,
                g.Key.Color,
                Amount = g.Sum(t => t.Amount),
                Count = g.Count()
            })
            .OrderByDescending(x => x.Amount)
            .ToListAsync(ct);

        var total = spending.Sum(s => s.Amount);

        return spending.Select(s => new SpendingByCategoryDto(
            s.CategoryId!.Value,
            s.Name,
            s.Icon,
            s.Color,
            s.Amount,
            s.Count,
            total > 0 ? (s.Amount / total) * 100 : 0
        )).ToList();
    }
}
