using System.Diagnostics;
using HLE.FamilyFinance.Extensions;
using HLE.FamilyFinance.Models;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Models.ViewModels;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace HLE.FamilyFinance.Controllers;

public class HomeController(
    ILogger<HomeController> logger,
    IReportService reportService,
    IAccountService accountService,
    IRecurringTransactionService recurringService,
    ITransactionService transactionService) : Controller
{
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        if (User.Identity?.IsAuthenticated != true)
        {
            return View("Landing");
        }

        var householdId = HttpContext.GetCurrentHouseholdId();
        var household = HttpContext.GetCurrentHousehold();
        var member = HttpContext.GetCurrentMember();

        var stats = await reportService.GetDashboardStatsAsync(householdId, ct);
        var accounts = await accountService.GetAccountsAsync(householdId, ct);
        var upcomingBills = await recurringService.GetUpcomingTransactionsAsync(householdId, 14, ct);
        var cashFlow = await reportService.GetCashFlowAsync(householdId, 6, ct);
        var recentTransactions = await transactionService.GetRecentTransactionsAsync(householdId, 10, ct);

        var viewModel = new DashboardViewModel
        {
            HouseholdName = household.Name,
            UserName = member?.DisplayName ?? User.Identity?.Name ?? "User",
            Stats = stats,
            Accounts = accounts,
            UpcomingBills = upcomingBills.Where(u => u.Type == TransactionType.Expense).Take(5).ToList(),
            CashFlow = cashFlow,
            RecentTransactions = recentTransactions.Select(t => new RecentTransactionDto
            {
                Id = t.Id,
                Date = t.Date,
                Payee = t.Payee,
                CategoryName = t.CategoryName,
                AccountName = t.AccountName,
                Amount = t.Amount,
                Type = t.Type.ToString()
            }).ToList()
        };

        return View("Dashboard", viewModel);
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
