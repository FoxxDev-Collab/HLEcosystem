using HLE.FamilyFinance.Models.Entities;
using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Services.Interfaces;

public record RecurringTransactionDto(
    int Id,
    string Name,
    TransactionType Type,
    decimal Amount,
    string? Payee,
    int AccountId,
    string AccountName,
    int? CategoryId,
    string? CategoryName,
    RecurrenceFrequency Frequency,
    int FrequencyInterval,
    DateOnly NextOccurrence,
    bool IsActive,
    bool AutoCreate
);

public record UpcomingTransactionDto(
    int RecurringTransactionId,
    string Name,
    TransactionType Type,
    decimal Amount,
    string AccountName,
    string? CategoryName,
    DateOnly Date,
    int DaysUntil
);

public interface IRecurringTransactionService
{
    Task<List<RecurringTransactionDto>> GetRecurringTransactionsAsync(int householdId, bool includeInactive = false, CancellationToken ct = default);
    Task<RecurringTransaction?> GetRecurringTransactionAsync(int id, int householdId, CancellationToken ct = default);
    Task<RecurringTransaction> CreateRecurringTransactionAsync(int householdId, string name, TransactionType type,
        int accountId, int? categoryId, decimal amount, string? payee, string? description,
        RecurrenceFrequency frequency, int interval, int dayOfPeriod, DateOnly startDate, DateOnly? endDate,
        bool autoCreate, int? transferToAccountId, CancellationToken ct = default);
    Task UpdateRecurringTransactionAsync(int id, int householdId, string name, int accountId, int? categoryId,
        decimal amount, string? payee, string? description, RecurrenceFrequency frequency, int interval,
        int dayOfPeriod, DateOnly? endDate, bool autoCreate, bool isActive, CancellationToken ct = default);
    Task DeleteRecurringTransactionAsync(int id, int householdId, CancellationToken ct = default);
    Task<List<UpcomingTransactionDto>> GetUpcomingTransactionsAsync(int householdId, int days, CancellationToken ct = default);
    Task ProcessDueRecurringTransactionsAsync(int householdId, string userId, CancellationToken ct = default);
    Task SkipNextOccurrenceAsync(int id, int householdId, CancellationToken ct = default);
}
