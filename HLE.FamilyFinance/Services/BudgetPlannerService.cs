using HLE.FamilyFinance.Data;
using HLE.FamilyFinance.Models.Entities;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyFinance.Services;

public class BudgetPlannerService(ApplicationDbContext context, ILogger<BudgetPlannerService> logger) : IBudgetPlannerService
{
    public async Task<List<BudgetPlannerProjectSummaryDto>> GetProjectsAsync(int householdId, CancellationToken ct = default)
    {
        return await context.BudgetPlannerProjects
            .AsNoTracking()
            .Where(p => p.HouseholdId == householdId)
            .OrderBy(p => p.SortOrder)
            .ThenBy(p => p.Name)
            .Select(p => new BudgetPlannerProjectSummaryDto(
                p.Id,
                p.Name,
                p.Description,
                p.Status,
                p.TargetDate,
                p.TotalCost,
                p.Items.Count,
                p.Items.Count(i => i.IsPurchased),
                p.Icon,
                p.Color
            ))
            .ToListAsync(ct);
    }

    public async Task<List<BudgetPlannerProjectSummaryDto>> GetProjectsByStatusAsync(int householdId, BudgetPlannerProjectStatus status, CancellationToken ct = default)
    {
        return await context.BudgetPlannerProjects
            .AsNoTracking()
            .Where(p => p.HouseholdId == householdId && p.Status == status)
            .OrderBy(p => p.SortOrder)
            .ThenBy(p => p.Name)
            .Select(p => new BudgetPlannerProjectSummaryDto(
                p.Id,
                p.Name,
                p.Description,
                p.Status,
                p.TargetDate,
                p.TotalCost,
                p.Items.Count,
                p.Items.Count(i => i.IsPurchased),
                p.Icon,
                p.Color
            ))
            .ToListAsync(ct);
    }

    public async Task<BudgetPlannerProjectDetailDto?> GetProjectAsync(int id, int householdId, CancellationToken ct = default)
    {
        var project = await context.BudgetPlannerProjects
            .AsNoTracking()
            .Include(p => p.Items.OrderBy(i => i.SortOrder).ThenBy(i => i.Name))
            .Where(p => p.Id == id && p.HouseholdId == householdId)
            .FirstOrDefaultAsync(ct);

        if (project == null) return null;

        return new BudgetPlannerProjectDetailDto(
            project.Id,
            project.Name,
            project.Description,
            project.Status,
            project.TargetDate,
            project.TotalCost,
            project.Icon,
            project.Color,
            project.Notes,
            project.SortOrder,
            project.CreatedAt,
            project.UpdatedAt,
            project.Items.Select(i => new BudgetPlannerItemDto(
                i.Id,
                i.ProjectId,
                i.Name,
                i.Description,
                i.Quantity,
                i.UnitCost,
                i.LineTotal,
                i.SortOrder,
                i.IsPurchased,
                i.ReferenceUrl
            )).ToList()
        );
    }

    public async Task<BudgetPlannerProject> CreateProjectAsync(int householdId, BudgetPlannerProjectCreateDto dto, CancellationToken ct = default)
    {
        var maxSortOrder = await context.BudgetPlannerProjects
            .Where(p => p.HouseholdId == householdId)
            .MaxAsync(p => (int?)p.SortOrder, ct) ?? 0;

        var project = new BudgetPlannerProject
        {
            HouseholdId = householdId,
            Name = dto.Name,
            Description = dto.Description,
            Status = dto.Status,
            TargetDate = dto.TargetDate,
            Icon = dto.Icon,
            Color = dto.Color,
            Notes = dto.Notes,
            TotalCost = 0,
            SortOrder = maxSortOrder + 1,
            CreatedAt = DateTime.UtcNow
        };

        context.BudgetPlannerProjects.Add(project);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Created budget planner project {ProjectId} '{Name}' for household {HouseholdId}", project.Id, dto.Name, householdId);
        return project;
    }

    public async Task UpdateProjectAsync(int id, int householdId, BudgetPlannerProjectUpdateDto dto, CancellationToken ct = default)
    {
        var project = await context.BudgetPlannerProjects
            .FirstOrDefaultAsync(p => p.Id == id && p.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Project not found");

        project.Name = dto.Name;
        project.Description = dto.Description;
        project.Status = dto.Status;
        project.TargetDate = dto.TargetDate;
        project.Icon = dto.Icon;
        project.Color = dto.Color;
        project.Notes = dto.Notes;
        project.SortOrder = dto.SortOrder;
        project.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Updated budget planner project {ProjectId}", id);
    }

    public async Task UpdateProjectStatusAsync(int id, int householdId, BudgetPlannerProjectStatus status, CancellationToken ct = default)
    {
        var project = await context.BudgetPlannerProjects
            .FirstOrDefaultAsync(p => p.Id == id && p.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Project not found");

        project.Status = status;
        project.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Updated budget planner project {ProjectId} status to {Status}", id, status);
    }

    public async Task DeleteProjectAsync(int id, int householdId, CancellationToken ct = default)
    {
        var project = await context.BudgetPlannerProjects
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == id && p.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Project not found");

        context.BudgetPlannerProjects.Remove(project);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Deleted budget planner project {ProjectId}", id);
    }

    public async Task<decimal> GetTotalPlannedCostAsync(int householdId, CancellationToken ct = default)
    {
        return await context.BudgetPlannerProjects
            .AsNoTracking()
            .Where(p => p.HouseholdId == householdId &&
                        (p.Status == BudgetPlannerProjectStatus.Planning || p.Status == BudgetPlannerProjectStatus.Active))
            .SumAsync(p => p.TotalCost, ct);
    }

    public async Task<BudgetPlannerProject> DuplicateProjectAsync(int projectId, int householdId, string newName, CancellationToken ct = default)
    {
        var sourceProject = await context.BudgetPlannerProjects
            .AsNoTracking()
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == projectId && p.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Project not found");

        var maxSortOrder = await context.BudgetPlannerProjects
            .Where(p => p.HouseholdId == householdId)
            .MaxAsync(p => (int?)p.SortOrder, ct) ?? 0;

        var newProject = new BudgetPlannerProject
        {
            HouseholdId = householdId,
            Name = newName,
            Description = sourceProject.Description,
            Status = BudgetPlannerProjectStatus.Planning,
            TargetDate = null,
            Icon = sourceProject.Icon,
            Color = sourceProject.Color,
            Notes = sourceProject.Notes,
            TotalCost = sourceProject.TotalCost,
            SortOrder = maxSortOrder + 1,
            CreatedAt = DateTime.UtcNow
        };

        context.BudgetPlannerProjects.Add(newProject);
        await context.SaveChangesAsync(ct);

        // Duplicate items
        var sortOrder = 1;
        foreach (var sourceItem in sourceProject.Items.OrderBy(i => i.SortOrder))
        {
            var newItem = new BudgetPlannerItem
            {
                ProjectId = newProject.Id,
                Name = sourceItem.Name,
                Description = sourceItem.Description,
                Quantity = sourceItem.Quantity,
                UnitCost = sourceItem.UnitCost,
                LineTotal = sourceItem.LineTotal,
                SortOrder = sortOrder++,
                IsPurchased = false,
                ReferenceUrl = sourceItem.ReferenceUrl,
                CreatedAt = DateTime.UtcNow
            };
            context.BudgetPlannerItems.Add(newItem);
        }

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Duplicated budget planner project {SourceProjectId} to {NewProjectId} '{NewName}'", projectId, newProject.Id, newName);
        return newProject;
    }

    public async Task<BudgetPlannerItem> AddItemAsync(int projectId, int householdId, BudgetPlannerItemCreateDto dto, CancellationToken ct = default)
    {
        var project = await context.BudgetPlannerProjects
            .FirstOrDefaultAsync(p => p.Id == projectId && p.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Project not found");

        var maxSortOrder = await context.BudgetPlannerItems
            .Where(i => i.ProjectId == projectId)
            .MaxAsync(i => (int?)i.SortOrder, ct) ?? 0;

        var item = new BudgetPlannerItem
        {
            ProjectId = projectId,
            Name = dto.Name,
            Description = dto.Description,
            Quantity = dto.Quantity,
            UnitCost = dto.UnitCost,
            LineTotal = dto.Quantity * dto.UnitCost,
            SortOrder = maxSortOrder + 1,
            IsPurchased = false,
            ReferenceUrl = dto.ReferenceUrl,
            CreatedAt = DateTime.UtcNow
        };

        context.BudgetPlannerItems.Add(item);

        // Update project total
        project.TotalCost += item.LineTotal;
        project.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Added item {ItemId} '{Name}' to project {ProjectId}", item.Id, dto.Name, projectId);
        return item;
    }

    public async Task UpdateItemAsync(int itemId, int projectId, int householdId, BudgetPlannerItemUpdateDto dto, CancellationToken ct = default)
    {
        var project = await context.BudgetPlannerProjects
            .FirstOrDefaultAsync(p => p.Id == projectId && p.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Project not found");

        var item = await context.BudgetPlannerItems
            .FirstOrDefaultAsync(i => i.Id == itemId && i.ProjectId == projectId, ct)
            ?? throw new InvalidOperationException("Item not found");

        var oldLineTotal = item.LineTotal;
        var newLineTotal = dto.Quantity * dto.UnitCost;

        item.Name = dto.Name;
        item.Description = dto.Description;
        item.Quantity = dto.Quantity;
        item.UnitCost = dto.UnitCost;
        item.LineTotal = newLineTotal;
        item.SortOrder = dto.SortOrder;
        item.IsPurchased = dto.IsPurchased;
        item.ReferenceUrl = dto.ReferenceUrl;
        item.UpdatedAt = DateTime.UtcNow;

        // Update project total
        project.TotalCost = project.TotalCost - oldLineTotal + newLineTotal;
        project.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Updated item {ItemId} in project {ProjectId}", itemId, projectId);
    }

    public async Task DeleteItemAsync(int itemId, int projectId, int householdId, CancellationToken ct = default)
    {
        var project = await context.BudgetPlannerProjects
            .FirstOrDefaultAsync(p => p.Id == projectId && p.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Project not found");

        var item = await context.BudgetPlannerItems
            .FirstOrDefaultAsync(i => i.Id == itemId && i.ProjectId == projectId, ct)
            ?? throw new InvalidOperationException("Item not found");

        // Update project total
        project.TotalCost -= item.LineTotal;
        project.UpdatedAt = DateTime.UtcNow;

        context.BudgetPlannerItems.Remove(item);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Deleted item {ItemId} from project {ProjectId}", itemId, projectId);
    }

    public async Task ToggleItemPurchasedAsync(int itemId, int projectId, int householdId, CancellationToken ct = default)
    {
        var project = await context.BudgetPlannerProjects
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == projectId && p.HouseholdId == householdId, ct)
            ?? throw new InvalidOperationException("Project not found");

        var item = await context.BudgetPlannerItems
            .FirstOrDefaultAsync(i => i.Id == itemId && i.ProjectId == projectId, ct)
            ?? throw new InvalidOperationException("Item not found");

        item.IsPurchased = !item.IsPurchased;
        item.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Toggled purchased status for item {ItemId} to {IsPurchased}", itemId, item.IsPurchased);
    }

    public async Task<AffordabilitySummaryDto> GetAffordabilitySummaryAsync(int householdId, CancellationToken ct = default)
    {
        // Get account balances (only checking/savings/cash accounts that are included in net worth)
        var accounts = await context.Accounts
            .AsNoTracking()
            .Where(a => a.HouseholdId == householdId &&
                        !a.IsArchived &&
                        a.IncludeInNetWorth &&
                        (a.Type == AccountType.Checking || a.Type == AccountType.Savings || a.Type == AccountType.Cash))
            .Select(a => new AffordabilityAccountDto(a.Id, a.Name, a.CurrentBalance))
            .ToListAsync(ct);

        var totalAvailableBalance = accounts.Sum(a => a.Balance);

        // Get active/planning projects
        var activeProjects = await context.BudgetPlannerProjects
            .AsNoTracking()
            .Where(p => p.HouseholdId == householdId &&
                        (p.Status == BudgetPlannerProjectStatus.Planning || p.Status == BudgetPlannerProjectStatus.Active))
            .OrderBy(p => p.SortOrder)
            .Select(p => new BudgetPlannerProjectSummaryDto(
                p.Id,
                p.Name,
                p.Description,
                p.Status,
                p.TargetDate,
                p.TotalCost,
                p.Items.Count,
                p.Items.Count(i => i.IsPurchased),
                p.Icon,
                p.Color
            ))
            .ToListAsync(ct);

        var totalPlannedCosts = activeProjects.Sum(p => p.TotalCost);
        var remainingAfterProjects = totalAvailableBalance - totalPlannedCosts;

        return new AffordabilitySummaryDto(
            totalAvailableBalance,
            totalPlannedCosts,
            remainingAfterProjects,
            activeProjects,
            accounts
        );
    }
}
