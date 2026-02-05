using HLE.FamilyFinance.Extensions;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HLE.FamilyFinance.Controllers;

[Authorize]
public class ReportsController(
    IReportService reportService,
    ITransactionService transactionService,
    ILogger<ReportsController> logger) : Controller
{
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        var stats = await reportService.GetDashboardStatsAsync(householdId, ct);
        var cashFlow = await reportService.GetCashFlowAsync(householdId, 12, ct);

        ViewData["Stats"] = stats;
        ViewData["CashFlow"] = cashFlow;

        return View();
    }

    public async Task<IActionResult> CashFlow(int months = 12, CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var cashFlow = await reportService.GetCashFlowAsync(householdId, months, ct);
        return View(cashFlow);
    }

    public async Task<IActionResult> SpendingByCategory(int? year, CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        year ??= DateTime.UtcNow.Year;

        var spending = await reportService.GetYearlySpendingByCategoryAsync(householdId, year.Value, ct);

        ViewData["Year"] = year;
        return View(spending);
    }

    public async Task<IActionResult> IncomeVsExpenses(int months = 12, CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var cashFlow = await reportService.GetCashFlowAsync(householdId, months, ct);

        var totalIncome = cashFlow.Sum(c => c.Income);
        var totalExpenses = cashFlow.Sum(c => c.Expenses);
        var averageMonthlyIncome = cashFlow.Any() ? totalIncome / cashFlow.Count : 0;
        var averageMonthlyExpenses = cashFlow.Any() ? totalExpenses / cashFlow.Count : 0;

        ViewData["TotalIncome"] = totalIncome;
        ViewData["TotalExpenses"] = totalExpenses;
        ViewData["AverageMonthlyIncome"] = averageMonthlyIncome;
        ViewData["AverageMonthlyExpenses"] = averageMonthlyExpenses;
        ViewData["TotalSavings"] = totalIncome - totalExpenses;
        ViewData["SavingsRate"] = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

        return View(cashFlow);
    }

    [HttpGet]
    public async Task<IActionResult> ExportTransactions(
        DateOnly? startDate,
        DateOnly? endDate,
        CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        startDate ??= DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-1));
        endDate ??= DateOnly.FromDateTime(DateTime.UtcNow);

        var filter = new TransactionFilterDto(
            HouseholdId: householdId,
            AccountId: null,
            CategoryId: null,
            Type: null,
            StartDate: startDate,
            EndDate: endDate,
            SearchTerm: null,
            Page: 1,
            PageSize: 10000,
            SortBy: "date",
            SortDescending: false
        );

        var transactions = await transactionService.GetTransactionsAsync(filter, ct);

        // Generate CSV
        var csv = new System.Text.StringBuilder();
        csv.AppendLine("Date,Type,Amount,Payee,Category,Account,Description");

        foreach (var t in transactions.Items)
        {
            csv.AppendLine($"{t.Date:yyyy-MM-dd},{t.Type},{t.Amount},\"{t.Payee?.Replace("\"", "\"\"")}\",\"{t.CategoryName?.Replace("\"", "\"\"")}\",\"{t.AccountName?.Replace("\"", "\"\"")}\",\"{t.Description?.Replace("\"", "\"\"")}\"");
        }

        var bytes = System.Text.Encoding.UTF8.GetBytes(csv.ToString());
        return File(bytes, "text/csv", $"transactions_{startDate:yyyyMMdd}_{endDate:yyyyMMdd}.csv");
    }
}
