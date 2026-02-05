using HLE.FamilyFinance.Models.Entities;
using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Services.Interfaces;

public record AccountSummaryDto(
    int Id,
    string Name,
    AccountType Type,
    string? Institution,
    decimal CurrentBalance,
    string? Icon,
    string? Color,
    bool IsArchived
);

public record AccountDto(
    int Id,
    string Name,
    AccountType Type,
    string? Institution,
    decimal CurrentBalance,
    decimal? CreditLimit,
    string? Color,
    string? Icon,
    bool IncludeInNetWorth,
    bool IsArchived
);

public record AccountDetailDto(
    int Id,
    string Name,
    AccountType Type,
    string? Institution,
    string? AccountNumber,
    decimal InitialBalance,
    decimal CurrentBalance,
    decimal? CreditLimit,
    decimal? InterestRate,
    decimal? HsaAnnualLimit,
    bool? HsaFamilyCoverage,
    string Currency,
    string? Notes,
    string? Color,
    string? Icon,
    bool IncludeInNetWorth,
    bool IsArchived,
    int TransactionCount,
    decimal MonthlyIncome,
    decimal MonthlyExpenses
);

public record NetWorthSummaryDto(
    decimal TotalAssets,
    decimal TotalLiabilities,
    decimal NetWorth,
    List<AccountDto> AssetAccounts,
    List<AccountDto> LiabilityAccounts
);

public interface IAccountService
{
    Task<List<AccountSummaryDto>> GetAccountsAsync(int householdId, CancellationToken ct = default);
    Task<AccountDetailDto?> GetAccountAsync(int id, int householdId, CancellationToken ct = default);
    Task<Account> CreateAccountAsync(int householdId, string name, AccountType type,
        string? institution, string? accountNumber, decimal initialBalance, string currency,
        string? notes, decimal? hsaAnnualLimit = null, bool? hsaFamilyCoverage = null, CancellationToken ct = default);
    Task UpdateAccountAsync(int id, int householdId, string name, AccountType type,
        string? institution, string? accountNumber, string currency, string? notes,
        decimal? hsaAnnualLimit = null, bool? hsaFamilyCoverage = null, CancellationToken ct = default);
    Task ArchiveAccountAsync(int id, int householdId, CancellationToken ct = default);
    Task RestoreAccountAsync(int id, int householdId, CancellationToken ct = default);
    Task AdjustBalanceAsync(int id, int householdId, decimal newBalance, CancellationToken ct = default);
    Task RecalculateBalanceAsync(int accountId, CancellationToken ct = default);
    Task<NetWorthSummaryDto> GetNetWorthAsync(int householdId, CancellationToken ct = default);
}
