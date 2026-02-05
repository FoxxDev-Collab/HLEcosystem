namespace HLE.FamilyFinance.Services.Interfaces;

public record DashboardStatsDto(
    decimal NetWorth,
    decimal MonthlyIncome,
    decimal MonthlyExpenses,
    decimal MonthlySavings,
    decimal BudgetUsedPercent,
    int UpcomingBillsCount,
    decimal UpcomingBillsTotal,
    int AccountsCount,
    int TransactionsThisMonth
);

public record CashFlowDto(
    int Year,
    int Month,
    string MonthName,
    decimal Income,
    decimal Expenses,
    decimal NetCashFlow
);

public record NetWorthHistoryDto(
    DateOnly Date,
    decimal Assets,
    decimal Liabilities,
    decimal NetWorth
);

public record AccountBalanceHistoryDto(
    int AccountId,
    string AccountName,
    DateOnly Date,
    decimal Balance
);

public interface IReportService
{
    Task<DashboardStatsDto> GetDashboardStatsAsync(int householdId, CancellationToken ct = default);
    Task<List<CashFlowDto>> GetCashFlowAsync(int householdId, int months, CancellationToken ct = default);
    Task<List<SpendingByCategoryDto>> GetYearlySpendingByCategoryAsync(int householdId, int year, CancellationToken ct = default);
}
