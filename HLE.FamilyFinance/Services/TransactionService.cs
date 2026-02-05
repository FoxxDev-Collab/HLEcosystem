using HLE.FamilyFinance.Data;
using HLE.FamilyFinance.Models.Entities;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyFinance.Services;

public class TransactionService(ApplicationDbContext context, IAccountService accountService, ILogger<TransactionService> logger) : ITransactionService
{
    public async Task<PagedResult<TransactionListItemDto>> GetTransactionsAsync(TransactionFilterDto filter, CancellationToken ct = default)
    {
        var query = context.Transactions
            .AsNoTracking()
            .Include(t => t.Account)
            .Include(t => t.Category)
            .Where(t => t.HouseholdId == filter.HouseholdId);

        if (filter.AccountId.HasValue)
            query = query.Where(t => t.AccountId == filter.AccountId.Value);

        if (filter.CategoryId.HasValue)
            query = query.Where(t => t.CategoryId == filter.CategoryId.Value);

        if (filter.Type.HasValue)
            query = query.Where(t => t.Type == filter.Type.Value);

        if (filter.StartDate.HasValue)
            query = query.Where(t => t.Date >= filter.StartDate.Value);

        if (filter.EndDate.HasValue)
            query = query.Where(t => t.Date <= filter.EndDate.Value);

        if (filter.IsReconciled.HasValue)
            query = query.Where(t => t.IsReconciled == filter.IsReconciled.Value);

        if (!string.IsNullOrWhiteSpace(filter.SearchTerm))
        {
            var term = filter.SearchTerm.ToLower();
            query = query.Where(t =>
                (t.Payee != null && t.Payee.ToLower().Contains(term)) ||
                (t.Description != null && t.Description.ToLower().Contains(term)));
        }

        var totalCount = await query.CountAsync(ct);

        query = filter.SortBy.ToLower() switch
        {
            "amount" => filter.SortDescending ? query.OrderByDescending(t => t.Amount) : query.OrderBy(t => t.Amount),
            "payee" => filter.SortDescending ? query.OrderByDescending(t => t.Payee) : query.OrderBy(t => t.Payee),
            _ => filter.SortDescending ? query.OrderByDescending(t => t.Date).ThenByDescending(t => t.Id) : query.OrderBy(t => t.Date).ThenBy(t => t.Id)
        };

        var items = await query
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .Select(t => new TransactionListItemDto(
                t.Id,
                t.Date,
                t.Type,
                t.Amount,
                t.Payee,
                t.Description,
                t.AccountId,
                t.Account.Name,
                t.CategoryId,
                t.Category != null ? t.Category.Name : null,
                t.Category != null ? t.Category.Icon : null,
                t.Category != null ? t.Category.Color : null,
                t.IsReconciled,
                t.IsCleared,
                t.RecurringTransactionId.HasValue
            ))
            .ToListAsync(ct);

        return new PagedResult<TransactionListItemDto>(
            items,
            totalCount,
            filter.Page,
            filter.PageSize,
            (int)Math.Ceiling(totalCount / (double)filter.PageSize)
        );
    }

    public async Task<Transaction?> GetTransactionAsync(int id, int householdId, CancellationToken ct = default)
    {
        return await context.Transactions
            .Include(t => t.Account)
            .Include(t => t.Category)
            .Include(t => t.TransferToAccount)
            .FirstOrDefaultAsync(t => t.Id == id && t.HouseholdId == householdId, ct);
    }

    public async Task<Transaction> CreateTransactionAsync(int householdId, string userId, TransactionCreateDto dto, CancellationToken ct = default)
    {
        var transaction = new Transaction
        {
            HouseholdId = householdId,
            AccountId = dto.AccountId,
            CategoryId = dto.CategoryId,
            Type = dto.Type,
            Amount = dto.Amount,
            Date = dto.Date,
            Payee = dto.Payee,
            Description = dto.Description,
            Tags = dto.Tags,
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        context.Transactions.Add(transaction);
        await context.SaveChangesAsync(ct);

        // Update account balance
        await accountService.RecalculateBalanceAsync(dto.AccountId, ct);

        logger.LogInformation("Created transaction {TransactionId} for household {HouseholdId}", transaction.Id, householdId);
        return transaction;
    }

    public async Task<(Transaction From, Transaction To)> CreateTransferAsync(int householdId, string userId, int fromAccountId,
        int toAccountId, decimal amount, DateOnly date, string? description, CancellationToken ct = default)
    {
        var fromTransaction = new Transaction
        {
            HouseholdId = householdId,
            AccountId = fromAccountId,
            TransferToAccountId = toAccountId,
            Type = TransactionType.Transfer,
            Amount = amount,
            Date = date,
            Payee = "Transfer",
            Description = description,
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        var toTransaction = new Transaction
        {
            HouseholdId = householdId,
            AccountId = toAccountId,
            TransferToAccountId = fromAccountId,
            Type = TransactionType.Transfer,
            Amount = amount,
            Date = date,
            Payee = "Transfer",
            Description = description,
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        context.Transactions.Add(fromTransaction);
        context.Transactions.Add(toTransaction);
        await context.SaveChangesAsync(ct);

        // Link the transactions
        fromTransaction.LinkedTransactionId = toTransaction.Id;
        toTransaction.LinkedTransactionId = fromTransaction.Id;
        await context.SaveChangesAsync(ct);

        // Update account balances
        await accountService.RecalculateBalanceAsync(fromAccountId, ct);
        await accountService.RecalculateBalanceAsync(toAccountId, ct);

        logger.LogInformation("Created transfer from account {FromAccountId} to {ToAccountId}", fromAccountId, toAccountId);
        return (fromTransaction, toTransaction);
    }

    public async Task UpdateTransactionAsync(int id, int householdId, TransactionUpdateDto dto, CancellationToken ct = default)
    {
        var transaction = await context.Transactions
            .FirstOrDefaultAsync(t => t.Id == id && t.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Transaction not found");

        var oldAccountId = transaction.AccountId;

        transaction.AccountId = dto.AccountId;
        transaction.CategoryId = dto.CategoryId;
        transaction.Amount = dto.Amount;
        transaction.Date = dto.Date;
        transaction.Payee = dto.Payee;
        transaction.Description = dto.Description;
        transaction.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync(ct);

        // Update affected account balances
        await accountService.RecalculateBalanceAsync(dto.AccountId, ct);
        if (oldAccountId != dto.AccountId)
        {
            await accountService.RecalculateBalanceAsync(oldAccountId, ct);
        }
    }

    public async Task DeleteTransactionAsync(int id, int householdId, CancellationToken ct = default)
    {
        var transaction = await context.Transactions
            .FirstOrDefaultAsync(t => t.Id == id && t.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Transaction not found");

        var accountId = transaction.AccountId;

        // If this is a transfer, also delete the linked transaction
        if (transaction.LinkedTransactionId.HasValue)
        {
            var linkedTransaction = await context.Transactions.FindAsync([transaction.LinkedTransactionId.Value], ct);
            if (linkedTransaction != null)
            {
                context.Transactions.Remove(linkedTransaction);
                await accountService.RecalculateBalanceAsync(linkedTransaction.AccountId, ct);
            }
        }

        context.Transactions.Remove(transaction);
        await context.SaveChangesAsync(ct);

        await accountService.RecalculateBalanceAsync(accountId, ct);

        logger.LogInformation("Deleted transaction {TransactionId}", id);
    }

    public async Task ToggleReconciledAsync(int id, int householdId, CancellationToken ct = default)
    {
        var transaction = await context.Transactions
            .FirstOrDefaultAsync(t => t.Id == id && t.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Transaction not found");

        transaction.IsReconciled = !transaction.IsReconciled;
        transaction.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);
    }

    public async Task ToggleClearedAsync(int id, int householdId, CancellationToken ct = default)
    {
        var transaction = await context.Transactions
            .FirstOrDefaultAsync(t => t.Id == id && t.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Transaction not found");

        transaction.IsCleared = !transaction.IsCleared;
        transaction.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);
    }

    public async Task<List<TransactionListItemDto>> GetRecentTransactionsAsync(int householdId, int count, CancellationToken ct = default)
    {
        return await context.Transactions
            .AsNoTracking()
            .Include(t => t.Account)
            .Include(t => t.Category)
            .Where(t => t.HouseholdId == householdId)
            .OrderByDescending(t => t.Date)
            .ThenByDescending(t => t.Id)
            .Take(count)
            .Select(t => new TransactionListItemDto(
                t.Id,
                t.Date,
                t.Type,
                t.Amount,
                t.Payee,
                t.Description,
                t.AccountId,
                t.Account.Name,
                t.CategoryId,
                t.Category != null ? t.Category.Name : null,
                t.Category != null ? t.Category.Icon : null,
                t.Category != null ? t.Category.Color : null,
                t.IsReconciled,
                t.IsCleared,
                t.RecurringTransactionId.HasValue
            ))
            .ToListAsync(ct);
    }

    public async Task<List<SpendingByCategoryDto>> GetSpendingByCategoryAsync(int householdId, DateOnly startDate, DateOnly endDate, CancellationToken ct = default)
    {
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

    public async Task<decimal> GetTotalIncomeAsync(int householdId, DateOnly startDate, DateOnly endDate, CancellationToken ct = default)
    {
        return await context.Transactions
            .AsNoTracking()
            .Where(t => t.HouseholdId == householdId &&
                       t.Type == TransactionType.Income &&
                       t.Date >= startDate &&
                       t.Date <= endDate &&
                       !t.IsBalanceAdjustment &&
                       (t.Category == null || t.Category.Type != CategoryType.Transfer))
            .SumAsync(t => t.Amount, ct);
    }

    public async Task<decimal> GetTotalExpensesAsync(int householdId, DateOnly startDate, DateOnly endDate, CancellationToken ct = default)
    {
        return await context.Transactions
            .AsNoTracking()
            .Where(t => t.HouseholdId == householdId &&
                       t.Type == TransactionType.Expense &&
                       t.Date >= startDate &&
                       t.Date <= endDate &&
                       !t.IsBalanceAdjustment &&
                       (t.Category == null || t.Category.Type != CategoryType.Transfer))
            .SumAsync(t => t.Amount, ct);
    }
}
