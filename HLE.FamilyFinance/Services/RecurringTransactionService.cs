using HLE.FamilyFinance.Data;
using HLE.FamilyFinance.Models.Entities;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyFinance.Services;

public class RecurringTransactionService(
    ApplicationDbContext context,
    ITransactionService transactionService,
    ILogger<RecurringTransactionService> logger) : IRecurringTransactionService
{
    public async Task<List<RecurringTransactionDto>> GetRecurringTransactionsAsync(int householdId, bool includeInactive = false, CancellationToken ct = default)
    {
        var query = context.RecurringTransactions
            .AsNoTracking()
            .Include(r => r.Account)
            .Include(r => r.Category)
            .Where(r => r.HouseholdId == householdId);

        if (!includeInactive)
        {
            query = query.Where(r => r.IsActive);
        }

        return await query
            .OrderBy(r => r.NextOccurrence)
            .Select(r => new RecurringTransactionDto(
                r.Id,
                r.Name,
                r.Type,
                r.Amount,
                r.Payee,
                r.AccountId,
                r.Account.Name,
                r.CategoryId,
                r.Category != null ? r.Category.Name : null,
                r.Frequency,
                r.FrequencyInterval,
                r.NextOccurrence,
                r.IsActive,
                r.AutoCreate
            ))
            .ToListAsync(ct);
    }

    public async Task<RecurringTransaction?> GetRecurringTransactionAsync(int id, int householdId, CancellationToken ct = default)
    {
        return await context.RecurringTransactions
            .Include(r => r.Account)
            .Include(r => r.Category)
            .FirstOrDefaultAsync(r => r.Id == id && r.HouseholdId == householdId, ct);
    }

    public async Task<RecurringTransaction> CreateRecurringTransactionAsync(int householdId, string name, TransactionType type,
        int accountId, int? categoryId, decimal amount, string? payee, string? description,
        RecurrenceFrequency frequency, int interval, int dayOfPeriod, DateOnly startDate, DateOnly? endDate,
        bool autoCreate, int? transferToAccountId, CancellationToken ct = default)
    {
        var recurring = new RecurringTransaction
        {
            HouseholdId = householdId,
            Name = name,
            Type = type,
            AccountId = accountId,
            CategoryId = categoryId,
            Amount = amount,
            Payee = payee,
            Description = description,
            Frequency = frequency,
            FrequencyInterval = interval,
            DayOfPeriod = dayOfPeriod,
            StartDate = startDate,
            EndDate = endDate,
            NextOccurrence = CalculateNextOccurrence(startDate, frequency, interval, dayOfPeriod),
            AutoCreate = autoCreate,
            TransferToAccountId = transferToAccountId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        context.RecurringTransactions.Add(recurring);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Created recurring transaction {Id} '{Name}' for household {HouseholdId}",
            recurring.Id, name, householdId);
        return recurring;
    }

    public async Task UpdateRecurringTransactionAsync(int id, int householdId, string name, int accountId, int? categoryId,
        decimal amount, string? payee, string? description, RecurrenceFrequency frequency, int interval,
        int dayOfPeriod, DateOnly? endDate, bool autoCreate, bool isActive, CancellationToken ct = default)
    {
        var recurring = await context.RecurringTransactions
            .FirstOrDefaultAsync(r => r.Id == id && r.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Recurring transaction not found");

        recurring.Name = name;
        recurring.AccountId = accountId;
        recurring.CategoryId = categoryId;
        recurring.Amount = amount;
        recurring.Payee = payee;
        recurring.Description = description;
        recurring.Frequency = frequency;
        recurring.FrequencyInterval = interval;
        recurring.DayOfPeriod = dayOfPeriod;
        recurring.EndDate = endDate;
        recurring.AutoCreate = autoCreate;
        recurring.IsActive = isActive;
        recurring.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync(ct);
    }

    public async Task DeleteRecurringTransactionAsync(int id, int householdId, CancellationToken ct = default)
    {
        var recurring = await context.RecurringTransactions
            .FirstOrDefaultAsync(r => r.Id == id && r.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Recurring transaction not found");

        context.RecurringTransactions.Remove(recurring);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Deleted recurring transaction {Id}", id);
    }

    public async Task<List<UpcomingTransactionDto>> GetUpcomingTransactionsAsync(int householdId, int days, CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var endDate = today.AddDays(days);

        return await context.RecurringTransactions
            .AsNoTracking()
            .Include(r => r.Account)
            .Include(r => r.Category)
            .Where(r => r.HouseholdId == householdId &&
                       r.IsActive &&
                       r.NextOccurrence >= today &&
                       r.NextOccurrence <= endDate)
            .OrderBy(r => r.NextOccurrence)
            .Select(r => new UpcomingTransactionDto(
                r.Id,
                r.Name,
                r.Type,
                r.Amount,
                r.Account.Name,
                r.Category != null ? r.Category.Name : null,
                r.NextOccurrence,
                r.NextOccurrence.DayNumber - today.DayNumber
            ))
            .ToListAsync(ct);
    }

    public async Task ProcessDueRecurringTransactionsAsync(int householdId, string userId, CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var dueTransactions = await context.RecurringTransactions
            .Where(r => r.HouseholdId == householdId &&
                       r.IsActive &&
                       r.AutoCreate &&
                       r.NextOccurrence <= today &&
                       (r.EndDate == null || r.EndDate >= today))
            .ToListAsync(ct);

        foreach (var recurring in dueTransactions)
        {
            var dto = new TransactionCreateDto(
                recurring.AccountId,
                recurring.CategoryId,
                recurring.Type,
                recurring.Amount,
                recurring.NextOccurrence,
                recurring.Payee,
                recurring.Description,
                recurring.TransferToAccountId
            );

            var transaction = await transactionService.CreateTransactionAsync(householdId, userId, dto, ct);
            transaction.RecurringTransactionId = recurring.Id;

            recurring.LastProcessed = recurring.NextOccurrence;
            recurring.NextOccurrence = CalculateNextOccurrence(
                recurring.NextOccurrence.AddDays(1),
                recurring.Frequency,
                recurring.FrequencyInterval,
                recurring.DayOfPeriod
            );

            logger.LogInformation("Processed recurring transaction {Id}, created transaction {TransactionId}",
                recurring.Id, transaction.Id);
        }

        await context.SaveChangesAsync(ct);
    }

    public async Task SkipNextOccurrenceAsync(int id, int householdId, CancellationToken ct = default)
    {
        var recurring = await context.RecurringTransactions
            .FirstOrDefaultAsync(r => r.Id == id && r.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Recurring transaction not found");

        recurring.NextOccurrence = CalculateNextOccurrence(
            recurring.NextOccurrence.AddDays(1),
            recurring.Frequency,
            recurring.FrequencyInterval,
            recurring.DayOfPeriod
        );
        recurring.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync(ct);
        logger.LogInformation("Skipped occurrence for recurring transaction {Id}", id);
    }

    private static DateOnly CalculateNextOccurrence(DateOnly fromDate, RecurrenceFrequency frequency, int interval, int dayOfPeriod)
    {
        return frequency switch
        {
            RecurrenceFrequency.Daily => fromDate.AddDays(interval),
            RecurrenceFrequency.Weekly => GetNextWeekday(fromDate, (DayOfWeek)dayOfPeriod, interval),
            RecurrenceFrequency.BiWeekly => GetNextWeekday(fromDate, (DayOfWeek)dayOfPeriod, interval * 2),
            RecurrenceFrequency.Monthly => GetNextMonthDay(fromDate, dayOfPeriod, interval),
            RecurrenceFrequency.Quarterly => GetNextMonthDay(fromDate, dayOfPeriod, interval * 3),
            RecurrenceFrequency.Yearly => GetNextMonthDay(fromDate, dayOfPeriod, interval * 12),
            _ => fromDate.AddMonths(1)
        };
    }

    private static DateOnly GetNextWeekday(DateOnly fromDate, DayOfWeek targetDay, int weeksToAdd)
    {
        var daysUntilTarget = ((int)targetDay - (int)fromDate.DayOfWeek + 7) % 7;
        if (daysUntilTarget == 0) daysUntilTarget = 7;
        return fromDate.AddDays(daysUntilTarget + (weeksToAdd - 1) * 7);
    }

    private static DateOnly GetNextMonthDay(DateOnly fromDate, int targetDay, int monthsToAdd)
    {
        var nextDate = fromDate.AddMonths(monthsToAdd);
        var daysInMonth = DateTime.DaysInMonth(nextDate.Year, nextDate.Month);
        var day = Math.Min(targetDay, daysInMonth);
        return new DateOnly(nextDate.Year, nextDate.Month, day);
    }
}
