using HLE.FamilyFinance.Models.Entities;
using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Services.Interfaces;

public record ImportBatchSummaryDto(
    int Id,
    string FileName,
    ImportFileFormat Format,
    int AccountId,
    string AccountName,
    DateTime ImportedAt,
    int TotalRows,
    int ImportedCount,
    int DuplicateCount,
    int SkippedCount,
    int PendingCount,
    bool IsFinalized
);

public record ImportedTransactionDto(
    int Id,
    DateOnly Date,
    decimal Amount,
    string? Description,
    string? Payee,
    string? CheckNumber,
    string? ReferenceNumber,
    ImportMatchStatus MatchStatus,
    int? SuggestedCategoryId,
    string? SuggestedCategoryName,
    int? MatchedTransactionId,
    string? Notes
);

public record ImportReviewDto(
    int BatchId,
    string FileName,
    string AccountName,
    List<ImportedTransactionDto> Transactions,
    int TotalCount,
    int PendingCount,
    int AutoMatchedCount,
    int DuplicateCount
);

public record CategoryRuleDto(
    int Id,
    string Pattern,
    CategoryRuleMatchType MatchType,
    int CategoryId,
    string CategoryName,
    string? AssignPayee,
    int Priority,
    bool IsActive,
    int MatchCount,
    DateTime? LastMatchedAt
);

public record CategoryRuleCreateDto(
    string Pattern,
    CategoryRuleMatchType MatchType,
    int CategoryId,
    string? AssignPayee,
    int Priority,
    string? Notes
);

public record ImportConfirmationDto(
    int TransactionId,
    int? CategoryId,
    string? Payee,
    bool Skip
);

public interface IImportService
{
    Task<ImportBatch> ImportFileAsync(int householdId, int accountId, string fileName, Stream fileStream, ImportFileFormat format, string? userId, CancellationToken ct = default);
    Task<ImportReviewDto?> GetPendingImportAsync(int batchId, int householdId, CancellationToken ct = default);
    Task<List<ImportBatchSummaryDto>> GetImportHistoryAsync(int householdId, CancellationToken ct = default);
    Task ConfirmImportAsync(int batchId, int householdId, List<ImportConfirmationDto> confirmations, CancellationToken ct = default);
    Task CancelImportAsync(int batchId, int householdId, CancellationToken ct = default);
    Task AutoCategorizeAsync(int batchId, int householdId, CancellationToken ct = default);
    Task<List<CategoryRuleDto>> GetCategoryRulesAsync(int householdId, CancellationToken ct = default);
    Task<CategoryRule> CreateCategoryRuleAsync(int householdId, CategoryRuleCreateDto dto, CancellationToken ct = default);
    Task UpdateCategoryRuleAsync(int id, int householdId, CategoryRuleCreateDto dto, CancellationToken ct = default);
    Task DeleteCategoryRuleAsync(int id, int householdId, CancellationToken ct = default);
    Task<int?> FindMatchingCategoryAsync(int householdId, string description, CancellationToken ct = default);
}
