using HLE.FamilyFinance.Models.Entities;
using HLE.FamilyFinance.Models.Enums;
using Microsoft.AspNetCore.Http;

namespace HLE.FamilyFinance.Services.Interfaces;

public record TaxYearSummaryDto(
    int Id,
    int Year,
    TaxFilingStatus FederalFilingStatus,
    string? State,
    bool IsFederalFiled,
    bool IsStateFiled,
    decimal? FederalRefund,
    decimal? StateRefund,
    int DocumentCount,
    int ReceivedDocumentCount
);

public record TaxYearDetailDto(
    int Id,
    int Year,
    TaxFilingStatus FederalFilingStatus,
    string? State,
    bool IsFederalFiled,
    DateOnly? FederalFiledDate,
    bool IsStateFiled,
    DateOnly? StateFiledDate,
    decimal? FederalRefund,
    decimal? StateRefund,
    bool RefundReceived,
    DateOnly? RefundReceivedDate,
    string? Notes,
    decimal TotalGrossIncome,
    decimal TotalFederalWithheld,
    decimal TotalStateWithheld,
    List<TaxDocumentDto> Documents
);

public record TaxDocumentDto(
    int Id,
    TaxDocumentType DocumentType,
    string Issuer,
    string? Description,
    decimal? GrossAmount,
    decimal? FederalWithheld,
    decimal? StateWithheld,
    decimal? SocialSecurityWithheld,
    decimal? MedicareWithheld,
    bool IsReceived,
    DateOnly? ReceivedDate,
    DateOnly? ExpectedDate,
    string? Notes,
    // File attachment info
    bool HasFile,
    string? UploadedFileName,
    long? FileSize
);

public record TaxYearCreateDto(
    int Year,
    TaxFilingStatus FederalFilingStatus,
    string? State,
    string? Notes
);

public record TaxYearEditDto(
    TaxFilingStatus FederalFilingStatus,
    string? State,
    string? Notes,
    bool IsFederalFiled,
    DateOnly? FederalFiledDate,
    decimal? FederalRefund,
    bool IsStateFiled,
    DateOnly? StateFiledDate,
    decimal? StateRefund,
    bool RefundReceived,
    DateOnly? RefundReceivedDate
);

public record TaxDocumentCreateDto(
    TaxDocumentType DocumentType,
    string Issuer,
    string? Description,
    decimal? GrossAmount,
    decimal? FederalWithheld,
    decimal? StateWithheld,
    decimal? SocialSecurityWithheld,
    decimal? MedicareWithheld,
    DateOnly? ExpectedDate,
    string? Notes
);

// Health/HSA Summary DTOs
public record HsaAccountSummaryDto(
    int AccountId,
    string AccountName,
    decimal YearStartBalance,
    decimal Contributions,
    decimal Distributions,
    decimal YearEndBalance,
    decimal? AnnualLimit,
    bool? IsFamilyCoverage
);

public record TaxYearHealthSummaryDto(
    int Year,
    decimal HsaContributions,
    decimal HsaDistributions,
    decimal HsaBalance,
    List<HsaAccountSummaryDto> HsaAccounts
);

public interface ITaxService
{
    Task<List<TaxYearSummaryDto>> GetTaxYearsAsync(int householdId, CancellationToken ct = default);
    Task<TaxYearDetailDto?> GetTaxYearAsync(int id, int householdId, CancellationToken ct = default);
    Task<TaxYearDetailDto?> GetTaxYearByYearAsync(int year, int householdId, CancellationToken ct = default);
    Task<TaxYear> CreateTaxYearAsync(int householdId, TaxYearCreateDto dto, CancellationToken ct = default);
    Task UpdateTaxYearAsync(int id, int householdId, TaxYearEditDto dto, CancellationToken ct = default);
    Task DeleteTaxYearAsync(int id, int householdId, CancellationToken ct = default);
    Task<TaxDocument> AddDocumentAsync(int taxYearId, int householdId, TaxDocumentCreateDto dto, CancellationToken ct = default);
    Task UpdateDocumentAsync(int documentId, int householdId, TaxDocumentCreateDto dto, CancellationToken ct = default);
    Task MarkDocumentReceivedAsync(int documentId, int householdId, DateOnly receivedDate, CancellationToken ct = default);
    Task DeleteDocumentAsync(int documentId, int householdId, CancellationToken ct = default);
    Task<List<TaxDocumentDto>> GetPendingDocumentsAsync(int taxYearId, int householdId, CancellationToken ct = default);

    // File attachment methods
    Task UploadDocumentFileAsync(int documentId, int householdId, IFormFile file, CancellationToken ct = default);
    Task DeleteDocumentFileAsync(int documentId, int householdId, CancellationToken ct = default);
    Task<TaxDocumentFileResult?> GetDocumentFileAsync(int documentId, int householdId, CancellationToken ct = default);

    // Health/HSA summary
    Task<TaxYearHealthSummaryDto?> GetHealthSummaryAsync(int householdId, int year, CancellationToken ct = default);
}
