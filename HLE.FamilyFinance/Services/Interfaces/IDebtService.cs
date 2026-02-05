using HLE.FamilyFinance.Models.Entities;
using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Services.Interfaces;

public record DebtSummaryDto(
    int Id,
    string Name,
    DebtType Type,
    string? Lender,
    decimal CurrentBalance,
    decimal InterestRate,
    decimal MinimumPayment,
    int PaymentDayOfMonth,
    string? Icon,
    string? Color,
    bool IsArchived
);

public record DebtDetailDto(
    int Id,
    string Name,
    DebtType Type,
    string? Lender,
    string? AccountNumberLast4,
    decimal OriginalPrincipal,
    decimal CurrentBalance,
    decimal InterestRate,
    int? TermMonths,
    decimal MinimumPayment,
    int PaymentDayOfMonth,
    DateOnly? OriginationDate,
    DateOnly? ExpectedPayoffDate,
    int? LinkedAccountId,
    string? LinkedAccountName,
    string? Icon,
    string? Color,
    string? Notes,
    bool IncludeInNetWorth,
    bool IsArchived,
    decimal TotalPaid,
    decimal TotalInterestPaid,
    int PaymentsRemaining
);

public record DebtPaymentDto(
    int Id,
    DateOnly PaymentDate,
    decimal TotalAmount,
    decimal PrincipalAmount,
    decimal InterestAmount,
    decimal? EscrowAmount,
    decimal? ExtraPrincipal,
    decimal RemainingBalance,
    string? Notes
);

public record AmortizationEntryDto(
    int PaymentNumber,
    DateOnly PaymentDate,
    decimal Payment,
    decimal Principal,
    decimal Interest,
    decimal Balance
);

public record DebtCreateDto(
    string Name,
    DebtType Type,
    string? Lender,
    string? AccountNumberLast4,
    decimal OriginalPrincipal,
    decimal CurrentBalance,
    decimal InterestRate,
    int? TermMonths,
    decimal MinimumPayment,
    int PaymentDayOfMonth,
    DateOnly? OriginationDate,
    int? LinkedAccountId,
    string? Icon,
    string? Color,
    string? Notes,
    bool IncludeInNetWorth
);

public record DebtPaymentCreateDto(
    DateOnly PaymentDate,
    decimal TotalAmount,
    decimal PrincipalAmount,
    decimal InterestAmount,
    decimal? EscrowAmount,
    decimal? ExtraPrincipal,
    int? LinkedTransactionId,
    string? Notes
);

public interface IDebtService
{
    Task<List<DebtSummaryDto>> GetDebtsAsync(int householdId, CancellationToken ct = default);
    Task<List<DebtSummaryDto>> GetDebtsByTypeAsync(int householdId, DebtType type, CancellationToken ct = default);
    Task<DebtDetailDto?> GetDebtAsync(int id, int householdId, CancellationToken ct = default);
    Task<Debt> CreateDebtAsync(int householdId, DebtCreateDto dto, CancellationToken ct = default);
    Task UpdateDebtAsync(int id, int householdId, DebtCreateDto dto, CancellationToken ct = default);
    Task RecordPaymentAsync(int debtId, int householdId, DebtPaymentCreateDto dto, CancellationToken ct = default);
    Task ArchiveDebtAsync(int id, int householdId, CancellationToken ct = default);
    Task RestoreDebtAsync(int id, int householdId, CancellationToken ct = default);
    Task DeleteDebtAsync(int id, int householdId, CancellationToken ct = default);
    Task<decimal> GetTotalDebtAsync(int householdId, CancellationToken ct = default);
    Task<List<DebtPaymentDto>> GetPaymentHistoryAsync(int debtId, int householdId, CancellationToken ct = default);
    Task<List<AmortizationEntryDto>> GetAmortizationScheduleAsync(int debtId, int householdId, CancellationToken ct = default);
    Task<DateOnly?> GetPayoffProjectionAsync(int debtId, int householdId, decimal? extraMonthlyPayment = null, CancellationToken ct = default);
}
