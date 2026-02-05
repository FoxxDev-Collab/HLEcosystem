using HLE.FamilyFinance.Models.Entities;
using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Services.Interfaces;

public record TransactionFilterDto(
    int HouseholdId,
    int? AccountId = null,
    int? CategoryId = null,
    TransactionType? Type = null,
    DateOnly? StartDate = null,
    DateOnly? EndDate = null,
    string? SearchTerm = null,
    bool? IsReconciled = null,
    int Page = 1,
    int PageSize = 50,
    string SortBy = "Date",
    bool SortDescending = true
);

public record TransactionListItemDto(
    int Id,
    DateOnly Date,
    TransactionType Type,
    decimal Amount,
    string? Payee,
    string? Description,
    int AccountId,
    string AccountName,
    int? CategoryId,
    string? CategoryName,
    string? CategoryIcon,
    string? CategoryColor,
    bool IsReconciled,
    bool IsCleared,
    bool IsRecurring
);

public record TransactionCreateDto(
    int AccountId,
    int? CategoryId,
    TransactionType Type,
    decimal Amount,
    DateOnly Date,
    string? Payee,
    string? Description,
    int? TransferToAccountId = null,
    string[]? Tags = null
);

public record TransactionUpdateDto(
    int AccountId,
    int? CategoryId,
    decimal Amount,
    DateOnly Date,
    string? Payee,
    string? Description
);

public record SpendingByCategoryDto(
    int CategoryId,
    string CategoryName,
    string? Icon,
    string? Color,
    decimal Amount,
    int TransactionCount,
    decimal Percentage
);

public record PagedResult<T>(
    List<T> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);

public interface ITransactionService
{
    Task<PagedResult<TransactionListItemDto>> GetTransactionsAsync(TransactionFilterDto filter, CancellationToken ct = default);
    Task<Transaction?> GetTransactionAsync(int id, int householdId, CancellationToken ct = default);
    Task<Transaction> CreateTransactionAsync(int householdId, string userId, TransactionCreateDto dto, CancellationToken ct = default);
    Task<(Transaction From, Transaction To)> CreateTransferAsync(int householdId, string userId, int fromAccountId,
        int toAccountId, decimal amount, DateOnly date, string? description, CancellationToken ct = default);
    Task UpdateTransactionAsync(int id, int householdId, TransactionUpdateDto dto, CancellationToken ct = default);
    Task DeleteTransactionAsync(int id, int householdId, CancellationToken ct = default);
    Task ToggleReconciledAsync(int id, int householdId, CancellationToken ct = default);
    Task ToggleClearedAsync(int id, int householdId, CancellationToken ct = default);
    Task<List<TransactionListItemDto>> GetRecentTransactionsAsync(int householdId, int count, CancellationToken ct = default);
    Task<List<SpendingByCategoryDto>> GetSpendingByCategoryAsync(int householdId, DateOnly startDate, DateOnly endDate, CancellationToken ct = default);
    Task<decimal> GetTotalIncomeAsync(int householdId, DateOnly startDate, DateOnly endDate, CancellationToken ct = default);
    Task<decimal> GetTotalExpensesAsync(int householdId, DateOnly startDate, DateOnly endDate, CancellationToken ct = default);
}
