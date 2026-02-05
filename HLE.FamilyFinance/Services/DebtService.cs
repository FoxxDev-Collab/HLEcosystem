using HLE.FamilyFinance.Data;
using HLE.FamilyFinance.Models.Entities;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyFinance.Services;

public class DebtService(ApplicationDbContext context, ILogger<DebtService> logger) : IDebtService
{
    public async Task<List<DebtSummaryDto>> GetDebtsAsync(int householdId, CancellationToken ct = default)
    {
        return await context.Debts
            .AsNoTracking()
            .Where(d => d.HouseholdId == householdId && !d.IsArchived)
            .OrderBy(d => d.Type)
            .ThenBy(d => d.Name)
            .Select(d => new DebtSummaryDto(
                d.Id,
                d.Name,
                d.Type,
                d.Lender,
                d.CurrentBalance,
                d.InterestRate,
                d.MinimumPayment,
                d.PaymentDayOfMonth,
                d.Icon,
                d.Color,
                d.IsArchived
            ))
            .ToListAsync(ct);
    }

    public async Task<List<DebtSummaryDto>> GetDebtsByTypeAsync(int householdId, DebtType type, CancellationToken ct = default)
    {
        return await context.Debts
            .AsNoTracking()
            .Where(d => d.HouseholdId == householdId && d.Type == type && !d.IsArchived)
            .OrderBy(d => d.Name)
            .Select(d => new DebtSummaryDto(
                d.Id,
                d.Name,
                d.Type,
                d.Lender,
                d.CurrentBalance,
                d.InterestRate,
                d.MinimumPayment,
                d.PaymentDayOfMonth,
                d.Icon,
                d.Color,
                d.IsArchived
            ))
            .ToListAsync(ct);
    }

    public async Task<DebtDetailDto?> GetDebtAsync(int id, int householdId, CancellationToken ct = default)
    {
        var debt = await context.Debts
            .AsNoTracking()
            .Include(d => d.LinkedAccount)
            .Include(d => d.Payments)
            .Where(d => d.Id == id && d.HouseholdId == householdId)
            .FirstOrDefaultAsync(ct);

        if (debt == null) return null;

        var totalPaid = debt.Payments.Sum(p => p.TotalAmount);
        var totalInterestPaid = debt.Payments.Sum(p => p.InterestAmount);
        var paymentsRemaining = debt.MinimumPayment > 0
            ? (int)Math.Ceiling(debt.CurrentBalance / debt.MinimumPayment)
            : 0;

        return new DebtDetailDto(
            debt.Id,
            debt.Name,
            debt.Type,
            debt.Lender,
            debt.AccountNumberLast4,
            debt.OriginalPrincipal,
            debt.CurrentBalance,
            debt.InterestRate,
            debt.TermMonths,
            debt.MinimumPayment,
            debt.PaymentDayOfMonth,
            debt.OriginationDate,
            debt.ExpectedPayoffDate,
            debt.LinkedAccountId,
            debt.LinkedAccount?.Name,
            debt.Icon,
            debt.Color,
            debt.Notes,
            debt.IncludeInNetWorth,
            debt.IsArchived,
            totalPaid,
            totalInterestPaid,
            paymentsRemaining
        );
    }

    public async Task<Debt> CreateDebtAsync(int householdId, DebtCreateDto dto, CancellationToken ct = default)
    {
        var debt = new Debt
        {
            HouseholdId = householdId,
            Name = dto.Name,
            Type = dto.Type,
            Lender = dto.Lender,
            AccountNumberLast4 = dto.AccountNumberLast4,
            OriginalPrincipal = dto.OriginalPrincipal,
            CurrentBalance = dto.CurrentBalance,
            InterestRate = dto.InterestRate,
            TermMonths = dto.TermMonths,
            MinimumPayment = dto.MinimumPayment,
            PaymentDayOfMonth = dto.PaymentDayOfMonth,
            OriginationDate = dto.OriginationDate,
            LinkedAccountId = dto.LinkedAccountId,
            Icon = dto.Icon,
            Color = dto.Color,
            Notes = dto.Notes,
            IncludeInNetWorth = dto.IncludeInNetWorth,
            CreatedAt = DateTime.UtcNow
        };

        // Calculate expected payoff date if we have term
        if (dto.OriginationDate.HasValue && dto.TermMonths.HasValue)
        {
            debt.ExpectedPayoffDate = dto.OriginationDate.Value.AddMonths(dto.TermMonths.Value);
        }

        context.Debts.Add(debt);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Created debt {DebtId} '{Name}' for household {HouseholdId}", debt.Id, dto.Name, householdId);
        return debt;
    }

    public async Task UpdateDebtAsync(int id, int householdId, DebtCreateDto dto, CancellationToken ct = default)
    {
        var debt = await context.Debts
            .FirstOrDefaultAsync(d => d.Id == id && d.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Debt not found");

        debt.Name = dto.Name;
        debt.Type = dto.Type;
        debt.Lender = dto.Lender;
        debt.AccountNumberLast4 = dto.AccountNumberLast4;
        debt.OriginalPrincipal = dto.OriginalPrincipal;
        debt.InterestRate = dto.InterestRate;
        debt.TermMonths = dto.TermMonths;
        debt.MinimumPayment = dto.MinimumPayment;
        debt.PaymentDayOfMonth = dto.PaymentDayOfMonth;
        debt.OriginationDate = dto.OriginationDate;
        debt.LinkedAccountId = dto.LinkedAccountId;
        debt.Icon = dto.Icon;
        debt.Color = dto.Color;
        debt.Notes = dto.Notes;
        debt.IncludeInNetWorth = dto.IncludeInNetWorth;
        debt.UpdatedAt = DateTime.UtcNow;

        if (dto.OriginationDate.HasValue && dto.TermMonths.HasValue)
        {
            debt.ExpectedPayoffDate = dto.OriginationDate.Value.AddMonths(dto.TermMonths.Value);
        }

        await context.SaveChangesAsync(ct);
    }

    public async Task RecordPaymentAsync(int debtId, int householdId, DebtPaymentCreateDto dto, CancellationToken ct = default)
    {
        var debt = await context.Debts
            .FirstOrDefaultAsync(d => d.Id == debtId && d.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Debt not found");

        var payment = new DebtPayment
        {
            DebtId = debtId,
            PaymentDate = dto.PaymentDate,
            TotalAmount = dto.TotalAmount,
            PrincipalAmount = dto.PrincipalAmount,
            InterestAmount = dto.InterestAmount,
            EscrowAmount = dto.EscrowAmount,
            ExtraPrincipal = dto.ExtraPrincipal,
            RemainingBalance = debt.CurrentBalance - dto.PrincipalAmount - (dto.ExtraPrincipal ?? 0),
            LinkedTransactionId = dto.LinkedTransactionId,
            Notes = dto.Notes,
            CreatedAt = DateTime.UtcNow
        };

        debt.CurrentBalance = payment.RemainingBalance;
        debt.UpdatedAt = DateTime.UtcNow;

        context.DebtPayments.Add(payment);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Recorded payment of {Amount} for debt {DebtId}", dto.TotalAmount, debtId);
    }

    public async Task ArchiveDebtAsync(int id, int householdId, CancellationToken ct = default)
    {
        var debt = await context.Debts
            .FirstOrDefaultAsync(d => d.Id == id && d.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Debt not found");

        debt.IsArchived = true;
        debt.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Archived debt {DebtId}", id);
    }

    public async Task RestoreDebtAsync(int id, int householdId, CancellationToken ct = default)
    {
        var debt = await context.Debts
            .FirstOrDefaultAsync(d => d.Id == id && d.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Debt not found");

        debt.IsArchived = false;
        debt.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Restored debt {DebtId}", id);
    }

    public async Task DeleteDebtAsync(int id, int householdId, CancellationToken ct = default)
    {
        var debt = await context.Debts
            .Include(d => d.Payments)
            .FirstOrDefaultAsync(d => d.Id == id && d.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Debt not found");

        context.Debts.Remove(debt);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Deleted debt {DebtId}", id);
    }

    public async Task<decimal> GetTotalDebtAsync(int householdId, CancellationToken ct = default)
    {
        return await context.Debts
            .AsNoTracking()
            .Where(d => d.HouseholdId == householdId && !d.IsArchived && d.IncludeInNetWorth)
            .SumAsync(d => d.CurrentBalance, ct);
    }

    public async Task<List<DebtPaymentDto>> GetPaymentHistoryAsync(int debtId, int householdId, CancellationToken ct = default)
    {
        var debt = await context.Debts
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == debtId && d.HouseholdId == householdId, ct);

        if (debt == null) return [];

        return await context.DebtPayments
            .AsNoTracking()
            .Where(p => p.DebtId == debtId)
            .OrderByDescending(p => p.PaymentDate)
            .Select(p => new DebtPaymentDto(
                p.Id,
                p.PaymentDate,
                p.TotalAmount,
                p.PrincipalAmount,
                p.InterestAmount,
                p.EscrowAmount,
                p.ExtraPrincipal,
                p.RemainingBalance,
                p.Notes
            ))
            .ToListAsync(ct);
    }

    public async Task<List<AmortizationEntryDto>> GetAmortizationScheduleAsync(int debtId, int householdId, CancellationToken ct = default)
    {
        var debt = await context.Debts
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == debtId && d.HouseholdId == householdId, ct);

        if (debt == null || debt.MinimumPayment <= 0 || debt.InterestRate <= 0)
            return [];

        var schedule = new List<AmortizationEntryDto>();
        var balance = debt.CurrentBalance;
        var monthlyRate = debt.InterestRate / 100 / 12;
        var payment = debt.MinimumPayment;
        var paymentNumber = 1;
        var paymentDate = DateOnly.FromDateTime(DateTime.UtcNow);
        paymentDate = new DateOnly(paymentDate.Year, paymentDate.Month, Math.Min(debt.PaymentDayOfMonth, DateTime.DaysInMonth(paymentDate.Year, paymentDate.Month)));

        while (balance > 0 && paymentNumber <= 360) // Cap at 30 years
        {
            var interest = balance * monthlyRate;
            var principal = Math.Min(payment - interest, balance);

            if (principal < 0) principal = 0;

            balance -= principal;
            if (balance < 0.01m) balance = 0;

            schedule.Add(new AmortizationEntryDto(
                paymentNumber,
                paymentDate,
                principal + interest,
                principal,
                interest,
                balance
            ));

            paymentNumber++;
            paymentDate = paymentDate.AddMonths(1);
        }

        return schedule;
    }

    public async Task<DateOnly?> GetPayoffProjectionAsync(int debtId, int householdId, decimal? extraMonthlyPayment = null, CancellationToken ct = default)
    {
        var debt = await context.Debts
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == debtId && d.HouseholdId == householdId, ct);

        if (debt == null || debt.MinimumPayment <= 0)
            return null;

        var balance = debt.CurrentBalance;
        var monthlyRate = debt.InterestRate / 100 / 12;
        var payment = debt.MinimumPayment + (extraMonthlyPayment ?? 0);
        var paymentDate = DateOnly.FromDateTime(DateTime.UtcNow);

        while (balance > 0)
        {
            var interest = balance * monthlyRate;
            var principal = payment - interest;

            if (principal <= 0)
                return null; // Payment doesn't cover interest

            balance -= principal;
            paymentDate = paymentDate.AddMonths(1);

            if (paymentDate > DateOnly.FromDateTime(DateTime.UtcNow).AddYears(50))
                return null; // Too far in future
        }

        return paymentDate;
    }
}
