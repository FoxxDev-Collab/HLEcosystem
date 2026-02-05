using HLE.FamilyFinance.Services.Interfaces;

namespace HLE.FamilyFinance.Models.ViewModels;

public class DashboardViewModel
{
    public string HouseholdName { get; set; } = "";
    public string UserName { get; set; } = "";
    public DashboardStatsDto Stats { get; set; } = null!;
    public List<AccountSummaryDto> Accounts { get; set; } = [];
    public List<UpcomingTransactionDto> UpcomingBills { get; set; } = [];
    public List<RecentTransactionDto> RecentTransactions { get; set; } = [];
    public List<CashFlowDto> CashFlow { get; set; } = [];
}

public class RecentTransactionDto
{
    public int Id { get; set; }
    public DateOnly Date { get; set; }
    public string? Payee { get; set; }
    public string? CategoryName { get; set; }
    public string AccountName { get; set; } = "";
    public decimal Amount { get; set; }
    public string Type { get; set; } = "";
}
