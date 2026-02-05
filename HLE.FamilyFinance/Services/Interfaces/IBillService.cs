using HLE.FamilyFinance.Models.Entities;
using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Services.Interfaces;

public record BillSummaryDto(
    int Id,
    string Name,
    string? Payee,
    BillCategory Category,
    decimal ExpectedAmount,
    int DueDayOfMonth,
    bool AutoPay,
    string? AutoPayAccountName,
    string? Icon,
    string? Color,
    bool IsActive,
    BillPaymentStatus? CurrentMonthStatus
);

public record BillDetailDto(
    int Id,
    string Name,
    string? Payee,
    BillCategory Category,
    decimal ExpectedAmount,
    bool IsVariableAmount,
    int DueDayOfMonth,
    bool AutoPay,
    int? AutoPayAccountId,
    string? AutoPayAccountName,
    int? LinkedDebtId,
    string? LinkedDebtName,
    int? DefaultCategoryId,
    string? DefaultCategoryName,
    string? Icon,
    string? Color,
    string? WebsiteUrl,
    string? Notes,
    bool IsActive,
    decimal TotalPaidThisYear,
    decimal AveragePayment
);

public record BillPaymentDto(
    int Id,
    int MonthlyBillId,
    string BillName,
    DateOnly DueDate,
    DateOnly? PaidDate,
    decimal AmountDue,
    decimal? AmountPaid,
    BillPaymentStatus Status,
    string? ConfirmationNumber,
    string? Notes
);

public record UpcomingBillDto(
    int BillId,
    int? PaymentId,
    string Name,
    string? Payee,
    BillCategory Category,
    DateOnly DueDate,
    decimal ExpectedAmount,
    bool AutoPay,
    string? AccountName,
    int DaysUntilDue,
    BillPaymentStatus Status,
    string? Icon,
    string? Color
);

public record BillCalendarEntryDto(
    DateOnly Date,
    List<UpcomingBillDto> Bills,
    decimal TotalDue
);

public record BillCreateDto(
    string Name,
    string? Payee,
    BillCategory Category,
    decimal ExpectedAmount,
    bool IsVariableAmount,
    int DueDayOfMonth,
    bool AutoPay,
    int? AutoPayAccountId,
    int? LinkedDebtId,
    int? DefaultCategoryId,
    string? Icon,
    string? Color,
    string? WebsiteUrl,
    string? Notes
);

public record BillPaymentRecordDto(
    DateOnly DueDate,
    DateOnly PaidDate,
    decimal AmountPaid,
    int? LinkedTransactionId,
    string? ConfirmationNumber,
    string? Notes
);

public interface IBillService
{
    Task<List<BillSummaryDto>> GetBillsAsync(int householdId, CancellationToken ct = default);
    Task<List<BillSummaryDto>> GetActiveBillsAsync(int householdId, CancellationToken ct = default);
    Task<BillDetailDto?> GetBillAsync(int id, int householdId, CancellationToken ct = default);
    Task<MonthlyBill> CreateBillAsync(int householdId, BillCreateDto dto, CancellationToken ct = default);
    Task UpdateBillAsync(int id, int householdId, BillCreateDto dto, CancellationToken ct = default);
    Task RecordPaymentAsync(int billId, int householdId, BillPaymentRecordDto dto, CancellationToken ct = default);
    Task MarkAsPaidAsync(int paymentId, int householdId, decimal? amountPaid, string? confirmationNumber, CancellationToken ct = default);
    Task DeactivateBillAsync(int id, int householdId, CancellationToken ct = default);
    Task ReactivateBillAsync(int id, int householdId, CancellationToken ct = default);
    Task DeleteBillAsync(int id, int householdId, CancellationToken ct = default);
    Task<List<UpcomingBillDto>> GetUpcomingBillsAsync(int householdId, int daysAhead = 30, CancellationToken ct = default);
    Task<List<BillCalendarEntryDto>> GetBillCalendarAsync(int householdId, int year, int month, CancellationToken ct = default);
    Task<List<BillPaymentDto>> GetPaymentHistoryAsync(int billId, int householdId, CancellationToken ct = default);
    Task GenerateMonthlyPaymentsAsync(int householdId, int year, int month, CancellationToken ct = default);
}
