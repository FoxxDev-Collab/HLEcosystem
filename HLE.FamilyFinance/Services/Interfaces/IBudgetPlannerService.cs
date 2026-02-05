using HLE.FamilyFinance.Models.Entities;
using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Services.Interfaces;

// Project DTOs
public record BudgetPlannerProjectSummaryDto(
    int Id,
    string Name,
    string? Description,
    BudgetPlannerProjectStatus Status,
    DateOnly? TargetDate,
    decimal TotalCost,
    int ItemCount,
    int PurchasedItemCount,
    string? Icon,
    string? Color
);

public record BudgetPlannerProjectDetailDto(
    int Id,
    string Name,
    string? Description,
    BudgetPlannerProjectStatus Status,
    DateOnly? TargetDate,
    decimal TotalCost,
    string? Icon,
    string? Color,
    string? Notes,
    int SortOrder,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    List<BudgetPlannerItemDto> Items
);

public record BudgetPlannerProjectCreateDto(
    string Name,
    string? Description,
    BudgetPlannerProjectStatus Status,
    DateOnly? TargetDate,
    string? Icon,
    string? Color,
    string? Notes
);

public record BudgetPlannerProjectUpdateDto(
    string Name,
    string? Description,
    BudgetPlannerProjectStatus Status,
    DateOnly? TargetDate,
    string? Icon,
    string? Color,
    string? Notes,
    int SortOrder
);

// Item DTOs
public record BudgetPlannerItemDto(
    int Id,
    int ProjectId,
    string Name,
    string? Description,
    decimal Quantity,
    decimal UnitCost,
    decimal LineTotal,
    int SortOrder,
    bool IsPurchased,
    string? ReferenceUrl
);

public record BudgetPlannerItemCreateDto(
    string Name,
    string? Description,
    decimal Quantity,
    decimal UnitCost,
    string? ReferenceUrl
);

public record BudgetPlannerItemUpdateDto(
    string Name,
    string? Description,
    decimal Quantity,
    decimal UnitCost,
    int SortOrder,
    bool IsPurchased,
    string? ReferenceUrl
);

// Affordability DTOs
public record AffordabilitySummaryDto(
    decimal TotalAvailableBalance,
    decimal TotalPlannedCosts,
    decimal RemainingAfterProjects,
    List<BudgetPlannerProjectSummaryDto> ActiveProjects,
    List<AffordabilityAccountDto> AccountBalances
);

public record AffordabilityAccountDto(
    int AccountId,
    string AccountName,
    decimal Balance
);

public interface IBudgetPlannerService
{
    // Project operations
    Task<List<BudgetPlannerProjectSummaryDto>> GetProjectsAsync(int householdId, CancellationToken ct = default);
    Task<List<BudgetPlannerProjectSummaryDto>> GetProjectsByStatusAsync(int householdId, BudgetPlannerProjectStatus status, CancellationToken ct = default);
    Task<BudgetPlannerProjectDetailDto?> GetProjectAsync(int id, int householdId, CancellationToken ct = default);
    Task<BudgetPlannerProject> CreateProjectAsync(int householdId, BudgetPlannerProjectCreateDto dto, CancellationToken ct = default);
    Task UpdateProjectAsync(int id, int householdId, BudgetPlannerProjectUpdateDto dto, CancellationToken ct = default);
    Task UpdateProjectStatusAsync(int id, int householdId, BudgetPlannerProjectStatus status, CancellationToken ct = default);
    Task DeleteProjectAsync(int id, int householdId, CancellationToken ct = default);
    Task<decimal> GetTotalPlannedCostAsync(int householdId, CancellationToken ct = default);
    Task<BudgetPlannerProject> DuplicateProjectAsync(int projectId, int householdId, string newName, CancellationToken ct = default);

    // Item operations
    Task<BudgetPlannerItem> AddItemAsync(int projectId, int householdId, BudgetPlannerItemCreateDto dto, CancellationToken ct = default);
    Task UpdateItemAsync(int itemId, int projectId, int householdId, BudgetPlannerItemUpdateDto dto, CancellationToken ct = default);
    Task DeleteItemAsync(int itemId, int projectId, int householdId, CancellationToken ct = default);
    Task ToggleItemPurchasedAsync(int itemId, int projectId, int householdId, CancellationToken ct = default);

    // Affordability
    Task<AffordabilitySummaryDto> GetAffordabilitySummaryAsync(int householdId, CancellationToken ct = default);
}
