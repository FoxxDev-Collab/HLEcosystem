using HLE.FamilyFinance.Data;
using HLE.FamilyFinance.Models.Entities;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyFinance.Services;

public class BillService(ApplicationDbContext context, ILogger<BillService> logger) : IBillService
{
    public async Task<List<BillSummaryDto>> GetBillsAsync(int householdId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var currentMonth = new DateOnly(now.Year, now.Month, 1);

        var bills = await context.MonthlyBills
            .AsNoTracking()
            .Include(b => b.AutoPayAccount)
            .Include(b => b.Payments.Where(p => p.DueDate >= currentMonth && p.DueDate < currentMonth.AddMonths(1)))
            .Where(b => b.HouseholdId == householdId)
            .OrderBy(b => b.DueDayOfMonth)
            .ThenBy(b => b.Name)
            .ToListAsync(ct);

        return bills.Select(b => new BillSummaryDto(
            b.Id,
            b.Name,
            b.Payee,
            b.Category,
            b.ExpectedAmount,
            b.DueDayOfMonth,
            b.AutoPay,
            b.AutoPayAccount?.Name,
            b.Icon,
            b.Color,
            b.IsActive,
            b.Payments.FirstOrDefault()?.Status
        )).ToList();
    }

    public async Task<List<BillSummaryDto>> GetActiveBillsAsync(int householdId, CancellationToken ct = default)
    {
        var bills = await GetBillsAsync(householdId, ct);
        return bills.Where(b => b.IsActive).ToList();
    }

    public async Task<BillDetailDto?> GetBillAsync(int id, int householdId, CancellationToken ct = default)
    {
        var bill = await context.MonthlyBills
            .AsNoTracking()
            .Include(b => b.AutoPayAccount)
            .Include(b => b.LinkedDebt)
            .Include(b => b.DefaultCategory)
            .Include(b => b.Payments)
            .Where(b => b.Id == id && b.HouseholdId == householdId)
            .FirstOrDefaultAsync(ct);

        if (bill == null) return null;

        var startOfYear = new DateOnly(DateTime.UtcNow.Year, 1, 1);
        var paidThisYear = bill.Payments
            .Where(p => p.PaidDate >= startOfYear && p.Status == BillPaymentStatus.Paid)
            .Sum(p => p.AmountPaid ?? 0);

        var paidPayments = bill.Payments.Where(p => p.AmountPaid.HasValue).ToList();
        var averagePayment = paidPayments.Count > 0 ? paidPayments.Average(p => p.AmountPaid!.Value) : bill.ExpectedAmount;

        return new BillDetailDto(
            bill.Id,
            bill.Name,
            bill.Payee,
            bill.Category,
            bill.ExpectedAmount,
            bill.IsVariableAmount,
            bill.DueDayOfMonth,
            bill.AutoPay,
            bill.AutoPayAccountId,
            bill.AutoPayAccount?.Name,
            bill.LinkedDebtId,
            bill.LinkedDebt?.Name,
            bill.DefaultCategoryId,
            bill.DefaultCategory?.Name,
            bill.Icon,
            bill.Color,
            bill.WebsiteUrl,
            bill.Notes,
            bill.IsActive,
            paidThisYear,
            averagePayment
        );
    }

    public async Task<MonthlyBill> CreateBillAsync(int householdId, BillCreateDto dto, CancellationToken ct = default)
    {
        var bill = new MonthlyBill
        {
            HouseholdId = householdId,
            Name = dto.Name,
            Payee = dto.Payee,
            Category = dto.Category,
            ExpectedAmount = dto.ExpectedAmount,
            IsVariableAmount = dto.IsVariableAmount,
            DueDayOfMonth = dto.DueDayOfMonth,
            AutoPay = dto.AutoPay,
            AutoPayAccountId = dto.AutoPayAccountId,
            LinkedDebtId = dto.LinkedDebtId,
            DefaultCategoryId = dto.DefaultCategoryId,
            Icon = dto.Icon,
            Color = dto.Color,
            WebsiteUrl = dto.WebsiteUrl,
            Notes = dto.Notes,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        context.MonthlyBills.Add(bill);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Created bill {BillId} '{Name}' for household {HouseholdId}", bill.Id, dto.Name, householdId);
        return bill;
    }

    public async Task UpdateBillAsync(int id, int householdId, BillCreateDto dto, CancellationToken ct = default)
    {
        var bill = await context.MonthlyBills
            .FirstOrDefaultAsync(b => b.Id == id && b.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Bill not found");

        bill.Name = dto.Name;
        bill.Payee = dto.Payee;
        bill.Category = dto.Category;
        bill.ExpectedAmount = dto.ExpectedAmount;
        bill.IsVariableAmount = dto.IsVariableAmount;
        bill.DueDayOfMonth = dto.DueDayOfMonth;
        bill.AutoPay = dto.AutoPay;
        bill.AutoPayAccountId = dto.AutoPayAccountId;
        bill.LinkedDebtId = dto.LinkedDebtId;
        bill.DefaultCategoryId = dto.DefaultCategoryId;
        bill.Icon = dto.Icon;
        bill.Color = dto.Color;
        bill.WebsiteUrl = dto.WebsiteUrl;
        bill.Notes = dto.Notes;
        bill.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync(ct);
    }

    public async Task RecordPaymentAsync(int billId, int householdId, BillPaymentRecordDto dto, CancellationToken ct = default)
    {
        var bill = await context.MonthlyBills
            .FirstOrDefaultAsync(b => b.Id == billId && b.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Bill not found");

        var payment = new BillPayment
        {
            MonthlyBillId = billId,
            DueDate = dto.DueDate,
            PaidDate = dto.PaidDate,
            AmountDue = bill.ExpectedAmount,
            AmountPaid = dto.AmountPaid,
            Status = BillPaymentStatus.Paid,
            LinkedTransactionId = dto.LinkedTransactionId,
            ConfirmationNumber = dto.ConfirmationNumber,
            Notes = dto.Notes,
            CreatedAt = DateTime.UtcNow
        };

        context.BillPayments.Add(payment);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Recorded payment for bill {BillId}", billId);
    }

    public async Task MarkAsPaidAsync(int paymentId, int householdId, decimal? amountPaid, string? confirmationNumber, CancellationToken ct = default)
    {
        var payment = await context.BillPayments
            .Include(p => p.MonthlyBill)
            .FirstOrDefaultAsync(p => p.Id == paymentId && p.MonthlyBill.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Bill payment not found");

        payment.Status = BillPaymentStatus.Paid;
        payment.PaidDate = DateOnly.FromDateTime(DateTime.UtcNow);
        payment.AmountPaid = amountPaid ?? payment.AmountDue;
        payment.ConfirmationNumber = confirmationNumber;
        payment.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync(ct);
    }

    public async Task DeactivateBillAsync(int id, int householdId, CancellationToken ct = default)
    {
        var bill = await context.MonthlyBills
            .FirstOrDefaultAsync(b => b.Id == id && b.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Bill not found");

        bill.IsActive = false;
        bill.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Deactivated bill {BillId}", id);
    }

    public async Task ReactivateBillAsync(int id, int householdId, CancellationToken ct = default)
    {
        var bill = await context.MonthlyBills
            .FirstOrDefaultAsync(b => b.Id == id && b.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Bill not found");

        bill.IsActive = true;
        bill.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Reactivated bill {BillId}", id);
    }

    public async Task DeleteBillAsync(int id, int householdId, CancellationToken ct = default)
    {
        var bill = await context.MonthlyBills
            .Include(b => b.Payments)
            .FirstOrDefaultAsync(b => b.Id == id && b.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Bill not found");

        context.MonthlyBills.Remove(bill);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Deleted bill {BillId}", id);
    }

    public async Task<List<UpcomingBillDto>> GetUpcomingBillsAsync(int householdId, int daysAhead = 30, CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var endDate = today.AddDays(daysAhead);

        var bills = await context.MonthlyBills
            .AsNoTracking()
            .Include(b => b.AutoPayAccount)
            .Include(b => b.Payments)
            .Where(b => b.HouseholdId == householdId && b.IsActive)
            .ToListAsync(ct);

        var upcoming = new List<UpcomingBillDto>();

        foreach (var bill in bills)
        {
            // Calculate next due date
            var dueDay = Math.Min(bill.DueDayOfMonth, DateTime.DaysInMonth(today.Year, today.Month));
            var dueDate = new DateOnly(today.Year, today.Month, dueDay);

            if (dueDate < today)
            {
                dueDate = dueDate.AddMonths(1);
                dueDay = Math.Min(bill.DueDayOfMonth, DateTime.DaysInMonth(dueDate.Year, dueDate.Month));
                dueDate = new DateOnly(dueDate.Year, dueDate.Month, dueDay);
            }

            if (dueDate > endDate) continue;

            // Check if already paid this period
            var existingPayment = bill.Payments
                .FirstOrDefault(p => p.DueDate.Month == dueDate.Month && p.DueDate.Year == dueDate.Year);

            var status = existingPayment?.Status ?? (dueDate < today ? BillPaymentStatus.Overdue : BillPaymentStatus.Pending);

            upcoming.Add(new UpcomingBillDto(
                bill.Id,
                existingPayment?.Id,
                bill.Name,
                bill.Payee,
                bill.Category,
                dueDate,
                bill.ExpectedAmount,
                bill.AutoPay,
                bill.AutoPayAccount?.Name,
                (dueDate.ToDateTime(TimeOnly.MinValue) - today.ToDateTime(TimeOnly.MinValue)).Days,
                status,
                bill.Icon,
                bill.Color
            ));
        }

        return upcoming.OrderBy(b => b.DueDate).ToList();
    }

    public async Task<List<BillCalendarEntryDto>> GetBillCalendarAsync(int householdId, int year, int month, CancellationToken ct = default)
    {
        var startDate = new DateOnly(year, month, 1);
        var endDate = startDate.AddMonths(1).AddDays(-1);
        var daysInMonth = DateTime.DaysInMonth(year, month);

        var bills = await context.MonthlyBills
            .AsNoTracking()
            .Include(b => b.AutoPayAccount)
            .Include(b => b.Payments.Where(p => p.DueDate >= startDate && p.DueDate <= endDate))
            .Where(b => b.HouseholdId == householdId && b.IsActive)
            .ToListAsync(ct);

        var calendar = new Dictionary<DateOnly, List<UpcomingBillDto>>();

        foreach (var bill in bills)
        {
            var dueDay = Math.Min(bill.DueDayOfMonth, daysInMonth);
            var dueDate = new DateOnly(year, month, dueDay);

            var existingPayment = bill.Payments.FirstOrDefault(p => p.DueDate == dueDate);
            var status = existingPayment?.Status ?? BillPaymentStatus.Pending;

            var entry = new UpcomingBillDto(
                bill.Id,
                existingPayment?.Id,
                bill.Name,
                bill.Payee,
                bill.Category,
                dueDate,
                bill.ExpectedAmount,
                bill.AutoPay,
                bill.AutoPayAccount?.Name,
                0,
                status,
                bill.Icon,
                bill.Color
            );

            if (!calendar.ContainsKey(dueDate))
                calendar[dueDate] = [];
            calendar[dueDate].Add(entry);
        }

        return calendar
            .OrderBy(kv => kv.Key)
            .Select(kv => new BillCalendarEntryDto(kv.Key, kv.Value, kv.Value.Sum(b => b.ExpectedAmount)))
            .ToList();
    }

    public async Task<List<BillPaymentDto>> GetPaymentHistoryAsync(int billId, int householdId, CancellationToken ct = default)
    {
        var bill = await context.MonthlyBills
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == billId && b.HouseholdId == householdId, ct);

        if (bill == null) return [];

        return await context.BillPayments
            .AsNoTracking()
            .Where(p => p.MonthlyBillId == billId)
            .OrderByDescending(p => p.DueDate)
            .Select(p => new BillPaymentDto(
                p.Id,
                p.MonthlyBillId,
                bill.Name,
                p.DueDate,
                p.PaidDate,
                p.AmountDue,
                p.AmountPaid,
                p.Status,
                p.ConfirmationNumber,
                p.Notes
            ))
            .ToListAsync(ct);
    }

    public async Task GenerateMonthlyPaymentsAsync(int householdId, int year, int month, CancellationToken ct = default)
    {
        var bills = await context.MonthlyBills
            .Include(b => b.Payments)
            .Where(b => b.HouseholdId == householdId && b.IsActive)
            .ToListAsync(ct);

        var daysInMonth = DateTime.DaysInMonth(year, month);

        foreach (var bill in bills)
        {
            var dueDay = Math.Min(bill.DueDayOfMonth, daysInMonth);
            var dueDate = new DateOnly(year, month, dueDay);

            // Check if payment already exists for this period
            var exists = bill.Payments.Any(p => p.DueDate == dueDate);
            if (exists) continue;

            var payment = new BillPayment
            {
                MonthlyBillId = bill.Id,
                DueDate = dueDate,
                AmountDue = bill.ExpectedAmount,
                Status = BillPaymentStatus.Pending,
                CreatedAt = DateTime.UtcNow
            };

            context.BillPayments.Add(payment);
        }

        await context.SaveChangesAsync(ct);
        logger.LogInformation("Generated monthly bill payments for {Year}-{Month} for household {HouseholdId}", year, month, householdId);
    }
}
