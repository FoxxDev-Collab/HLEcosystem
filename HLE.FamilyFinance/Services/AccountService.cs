using HLE.FamilyFinance.Data;
using HLE.FamilyFinance.Models.Entities;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyFinance.Services;

public class AccountService(ApplicationDbContext context, ILogger<AccountService> logger) : IAccountService
{
    public async Task<List<AccountSummaryDto>> GetAccountsAsync(int householdId, CancellationToken ct = default)
    {
        return await context.Accounts
            .AsNoTracking()
            .Where(a => a.HouseholdId == householdId && !a.IsArchived)
            .OrderBy(a => a.SortOrder)
            .ThenBy(a => a.Name)
            .Select(a => new AccountSummaryDto(
                a.Id,
                a.Name,
                a.Type,
                a.Institution,
                a.CurrentBalance,
                a.Icon,
                a.Color,
                a.IsArchived
            ))
            .ToListAsync(ct);
    }

    public async Task<AccountDetailDto?> GetAccountAsync(int id, int householdId, CancellationToken ct = default)
    {
        var account = await context.Accounts
            .AsNoTracking()
            .Where(a => a.Id == id && a.HouseholdId == householdId)
            .FirstOrDefaultAsync(ct);

        if (account == null) return null;

        var now = DateTime.UtcNow;
        var startOfMonth = new DateOnly(now.Year, now.Month, 1);
        var endOfMonth = startOfMonth.AddMonths(1).AddDays(-1);

        var transactionStats = await context.Transactions
            .AsNoTracking()
            .Include(t => t.Category)
            .Where(t => t.AccountId == id && t.Date >= startOfMonth && t.Date <= endOfMonth)
            .GroupBy(t => 1)
            .Select(g => new
            {
                Count = g.Count(),
                Income = g.Where(t => t.Type == TransactionType.Income && !t.IsBalanceAdjustment && (t.Category == null || t.Category.Type != CategoryType.Transfer)).Sum(t => t.Amount),
                Expenses = g.Where(t => t.Type == TransactionType.Expense && !t.IsBalanceAdjustment && (t.Category == null || t.Category.Type != CategoryType.Transfer)).Sum(t => t.Amount)
            })
            .FirstOrDefaultAsync(ct);

        return new AccountDetailDto(
            account.Id,
            account.Name,
            account.Type,
            account.Institution,
            account.AccountNumberLast4,
            account.InitialBalance,
            account.CurrentBalance,
            account.CreditLimit,
            account.InterestRate,
            account.HsaAnnualLimit,
            account.HsaFamilyCoverage,
            account.Currency,
            account.Notes,
            account.Color,
            account.Icon,
            account.IncludeInNetWorth,
            account.IsArchived,
            transactionStats?.Count ?? 0,
            transactionStats?.Income ?? 0,
            transactionStats?.Expenses ?? 0
        );
    }

    public async Task<Account> CreateAccountAsync(int householdId, string name, AccountType type,
        string? institution, string? accountNumber, decimal initialBalance, string currency,
        string? notes, decimal? hsaAnnualLimit = null, bool? hsaFamilyCoverage = null, CancellationToken ct = default)
    {
        var maxOrder = await context.Accounts
            .Where(a => a.HouseholdId == householdId)
            .MaxAsync(a => (int?)a.SortOrder, ct) ?? 0;

        var account = new Account
        {
            HouseholdId = householdId,
            Name = name,
            Type = type,
            Institution = institution,
            AccountNumberLast4 = accountNumber,
            InitialBalance = initialBalance,
            CurrentBalance = initialBalance,
            Currency = currency,
            Notes = notes,
            HsaAnnualLimit = type == AccountType.HSA ? hsaAnnualLimit : null,
            HsaFamilyCoverage = type == AccountType.HSA ? hsaFamilyCoverage : null,
            IncludeInNetWorth = true,
            SortOrder = maxOrder + 1,
            CreatedAt = DateTime.UtcNow
        };

        context.Accounts.Add(account);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Created account {AccountId} '{Name}' for household {HouseholdId}", account.Id, name, householdId);
        return account;
    }

    public async Task UpdateAccountAsync(int id, int householdId, string name, AccountType type,
        string? institution, string? accountNumber, string currency, string? notes,
        decimal? hsaAnnualLimit = null, bool? hsaFamilyCoverage = null, CancellationToken ct = default)
    {
        var account = await context.Accounts
            .FirstOrDefaultAsync(a => a.Id == id && a.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Account not found");

        account.Name = name;
        account.Type = type;
        account.Institution = institution;
        account.AccountNumberLast4 = accountNumber;
        account.Currency = currency;
        account.Notes = notes;
        account.HsaAnnualLimit = type == AccountType.HSA ? hsaAnnualLimit : null;
        account.HsaFamilyCoverage = type == AccountType.HSA ? hsaFamilyCoverage : null;
        account.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync(ct);
    }

    public async Task ArchiveAccountAsync(int id, int householdId, CancellationToken ct = default)
    {
        var account = await context.Accounts
            .FirstOrDefaultAsync(a => a.Id == id && a.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Account not found");

        account.IsArchived = true;
        account.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Archived account {AccountId}", id);
    }

    public async Task RestoreAccountAsync(int id, int householdId, CancellationToken ct = default)
    {
        var account = await context.Accounts
            .FirstOrDefaultAsync(a => a.Id == id && a.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Account not found");

        account.IsArchived = false;
        account.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Restored account {AccountId}", id);
    }

    public async Task AdjustBalanceAsync(int id, int householdId, decimal newBalance, CancellationToken ct = default)
    {
        var account = await context.Accounts
            .FirstOrDefaultAsync(a => a.Id == id && a.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Account not found");

        // Calculate the difference between current and desired balance
        var difference = newBalance - account.CurrentBalance;

        if (difference == 0)
        {
            logger.LogInformation("No balance adjustment needed for account {AccountId}", id);
            return;
        }

        // Find or create a "Balance Adjustment" category
        var adjustmentCategory = await context.Categories
            .FirstOrDefaultAsync(c => c.HouseholdId == householdId && c.Name == "Balance Adjustment", ct);

        if (adjustmentCategory == null)
        {
            adjustmentCategory = new Category
            {
                HouseholdId = householdId,
                Name = "Balance Adjustment",
                Type = CategoryType.Transfer, // Excluded from income/expense calculations
                Icon = "bi-sliders",
                Color = "#6c757d",
                CreatedAt = DateTime.UtcNow
            };
            context.Categories.Add(adjustmentCategory);
            await context.SaveChangesAsync(ct);
        }

        // Create an adjustment transaction
        var transaction = new Transaction
        {
            HouseholdId = householdId,
            AccountId = id,
            CategoryId = adjustmentCategory.Id,
            Amount = Math.Abs(difference),
            Type = difference > 0 ? TransactionType.Income : TransactionType.Expense,
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            Description = $"Balance adjustment: {account.CurrentBalance:C} → {newBalance:C}",
            IsBalanceAdjustment = true,
            CreatedAt = DateTime.UtcNow
        };

        context.Transactions.Add(transaction);

        // Update the account balance
        account.CurrentBalance = newBalance;
        account.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Created balance adjustment transaction for account {AccountId}: {Difference:C} (new balance: {NewBalance:C})",
            id, difference, newBalance);
    }

    public async Task RecalculateBalanceAsync(int accountId, CancellationToken ct = default)
    {
        var account = await context.Accounts.FindAsync([accountId], ct)
            ?? throw new InvalidOperationException("Account not found");

        var transactionSum = await context.Transactions
            .Where(t => t.AccountId == accountId)
            .SumAsync(t => t.Type == TransactionType.Income ? t.Amount :
                          t.Type == TransactionType.Expense ? -t.Amount :
                          t.Type == TransactionType.Transfer && t.TransferToAccountId != null ? -t.Amount : 0, ct);

        // Also add incoming transfers
        var incomingTransfers = await context.Transactions
            .Where(t => t.TransferToAccountId == accountId && t.Type == TransactionType.Transfer)
            .SumAsync(t => t.Amount, ct);

        account.CurrentBalance = account.InitialBalance + transactionSum + incomingTransfers;
        account.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);
    }

    public async Task<NetWorthSummaryDto> GetNetWorthAsync(int householdId, CancellationToken ct = default)
    {
        var accounts = await context.Accounts
            .AsNoTracking()
            .Where(a => a.HouseholdId == householdId && !a.IsArchived && a.IncludeInNetWorth)
            .OrderBy(a => a.SortOrder)
            .Select(a => new AccountDto(
                a.Id,
                a.Name,
                a.Type,
                a.Institution,
                a.CurrentBalance,
                a.CreditLimit,
                a.Color,
                a.Icon,
                a.IncludeInNetWorth,
                a.IsArchived
            ))
            .ToListAsync(ct);

        // Assets: Checking, Savings, Cash, Investment, HSA
        var assetTypes = new[] { AccountType.Checking, AccountType.Savings, AccountType.Cash, AccountType.Investment, AccountType.HSA };
        var assetAccounts = accounts.Where(a => assetTypes.Contains(a.Type)).ToList();
        var totalAssets = assetAccounts.Sum(a => a.CurrentBalance);

        // Liabilities: Credit Card, Loan
        var liabilityTypes = new[] { AccountType.CreditCard, AccountType.Loan };
        var liabilityAccounts = accounts.Where(a => liabilityTypes.Contains(a.Type)).ToList();
        var totalLiabilities = liabilityAccounts.Sum(a => Math.Abs(a.CurrentBalance));

        return new NetWorthSummaryDto(
            totalAssets,
            totalLiabilities,
            totalAssets - totalLiabilities,
            assetAccounts,
            liabilityAccounts
        );
    }
}
