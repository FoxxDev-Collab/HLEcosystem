using HLE.FamilyFinance.Extensions;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Models.ViewModels;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace HLE.FamilyFinance.Controllers;

[Authorize]
public class BudgetPlannerController(
    IBudgetPlannerService budgetPlannerService,
    ILogger<BudgetPlannerController> logger) : Controller
{
    public async Task<IActionResult> Index(BudgetPlannerProjectStatus? status, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        var projects = status.HasValue
            ? await budgetPlannerService.GetProjectsByStatusAsync(householdId, status.Value, ct)
            : await budgetPlannerService.GetProjectsAsync(householdId, ct);

        var affordability = await budgetPlannerService.GetAffordabilitySummaryAsync(householdId, ct);

        var viewModel = new BudgetPlannerIndexViewModel
        {
            FilterStatus = status,
            Projects = projects,
            TotalPlannedCost = affordability.TotalPlannedCosts,
            TotalAvailableBalance = affordability.TotalAvailableBalance
        };

        PopulateDropdowns();
        return View(viewModel);
    }

    public async Task<IActionResult> Details(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var project = await budgetPlannerService.GetProjectAsync(id, householdId, ct);

        if (project == null)
        {
            return NotFound();
        }

        var affordability = await budgetPlannerService.GetAffordabilitySummaryAsync(householdId, ct);

        var viewModel = new BudgetPlannerProjectDetailsViewModel
        {
            Id = project.Id,
            Name = project.Name,
            Description = project.Description,
            Status = project.Status,
            TargetDate = project.TargetDate,
            TotalCost = project.TotalCost,
            Icon = project.Icon,
            Color = project.Color,
            Notes = project.Notes,
            CreatedAt = project.CreatedAt,
            UpdatedAt = project.UpdatedAt,
            Items = project.Items,
            AvailableBalance = affordability.TotalAvailableBalance
        };

        PopulateDropdowns();
        return View(viewModel);
    }

    public IActionResult Create()
    {
        PopulateDropdowns();
        return View(new BudgetPlannerProjectCreateViewModel());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(BudgetPlannerProjectCreateViewModel model, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        if (!ModelState.IsValid)
        {
            PopulateDropdowns();
            return View(model);
        }

        try
        {
            var dto = new BudgetPlannerProjectCreateDto(
                model.Name,
                model.Description,
                model.Status,
                model.TargetDate,
                model.Icon,
                model.Color,
                model.Notes
            );

            var project = await budgetPlannerService.CreateProjectAsync(householdId, dto, ct);
            TempData["Success"] = "Project created successfully.";
            return RedirectToAction(nameof(Details), new { id = project.Id });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error creating budget planner project");
            ModelState.AddModelError("", "An error occurred while creating the project.");
            PopulateDropdowns();
            return View(model);
        }
    }

    public async Task<IActionResult> Edit(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var project = await budgetPlannerService.GetProjectAsync(id, householdId, ct);

        if (project == null)
        {
            return NotFound();
        }

        var model = new BudgetPlannerProjectEditViewModel
        {
            Id = project.Id,
            Name = project.Name,
            Description = project.Description,
            Status = project.Status,
            TargetDate = project.TargetDate,
            Icon = project.Icon,
            Color = project.Color,
            Notes = project.Notes,
            SortOrder = project.SortOrder
        };

        PopulateDropdowns();
        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, BudgetPlannerProjectEditViewModel model, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        if (!ModelState.IsValid)
        {
            PopulateDropdowns();
            return View(model);
        }

        try
        {
            var dto = new BudgetPlannerProjectUpdateDto(
                model.Name,
                model.Description,
                model.Status,
                model.TargetDate,
                model.Icon,
                model.Color,
                model.Notes,
                model.SortOrder
            );

            await budgetPlannerService.UpdateProjectAsync(id, householdId, dto, ct);
            TempData["Success"] = "Project updated successfully.";
            return RedirectToAction(nameof(Details), new { id });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error updating budget planner project {ProjectId}", id);
            ModelState.AddModelError("", "An error occurred while updating the project.");
            PopulateDropdowns();
            return View(model);
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await budgetPlannerService.DeleteProjectAsync(id, householdId, ct);
            TempData["Success"] = "Project deleted.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error deleting budget planner project {ProjectId}", id);
            TempData["Error"] = "Failed to delete project.";
        }

        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateStatus(int id, BudgetPlannerProjectStatus status, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await budgetPlannerService.UpdateProjectStatusAsync(id, householdId, status, ct);
            TempData["Success"] = "Project status updated.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error updating status for project {ProjectId}", id);
            TempData["Error"] = "Failed to update status.";
        }

        return RedirectToAction(nameof(Details), new { id });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Duplicate(int id, string newName, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            var newProject = await budgetPlannerService.DuplicateProjectAsync(id, householdId, newName, ct);
            TempData["Success"] = "Project duplicated successfully.";
            return RedirectToAction(nameof(Details), new { id = newProject.Id });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error duplicating project {ProjectId}", id);
            TempData["Error"] = "Failed to duplicate project.";
            return RedirectToAction(nameof(Details), new { id });
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> AddItem(int projectId, BudgetPlannerItemCreateViewModel model, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        if (!ModelState.IsValid)
        {
            TempData["Error"] = "Please fill in all required fields correctly.";
            return RedirectToAction(nameof(Details), new { id = projectId });
        }

        try
        {
            var dto = new BudgetPlannerItemCreateDto(
                model.Name,
                model.Description,
                model.Quantity,
                model.UnitCost,
                model.ReferenceUrl
            );

            await budgetPlannerService.AddItemAsync(projectId, householdId, dto, ct);
            TempData["Success"] = "Item added successfully.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error adding item to project {ProjectId}", projectId);
            TempData["Error"] = "Failed to add item.";
        }

        return RedirectToAction(nameof(Details), new { id = projectId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateItem(int projectId, int itemId, BudgetPlannerItemEditViewModel model, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            var dto = new BudgetPlannerItemUpdateDto(
                model.Name,
                model.Description,
                model.Quantity,
                model.UnitCost,
                model.SortOrder,
                model.IsPurchased,
                model.ReferenceUrl
            );

            await budgetPlannerService.UpdateItemAsync(itemId, projectId, householdId, dto, ct);
            TempData["Success"] = "Item updated successfully.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error updating item {ItemId} in project {ProjectId}", itemId, projectId);
            TempData["Error"] = "Failed to update item.";
        }

        return RedirectToAction(nameof(Details), new { id = projectId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteItem(int projectId, int itemId, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await budgetPlannerService.DeleteItemAsync(itemId, projectId, householdId, ct);
            TempData["Success"] = "Item removed.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error deleting item {ItemId} from project {ProjectId}", itemId, projectId);
            TempData["Error"] = "Failed to remove item.";
        }

        return RedirectToAction(nameof(Details), new { id = projectId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ToggleItemPurchased(int projectId, int itemId, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await budgetPlannerService.ToggleItemPurchasedAsync(itemId, projectId, householdId, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error toggling purchased status for item {ItemId}", itemId);
            TempData["Error"] = "Failed to update item.";
        }

        return RedirectToAction(nameof(Details), new { id = projectId });
    }

    public async Task<IActionResult> Affordability(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var summary = await budgetPlannerService.GetAffordabilitySummaryAsync(householdId, ct);

        var viewModel = new AffordabilityViewModel
        {
            TotalAvailableBalance = summary.TotalAvailableBalance,
            TotalPlannedCosts = summary.TotalPlannedCosts,
            RemainingAfterProjects = summary.RemainingAfterProjects,
            ActiveProjects = summary.ActiveProjects,
            AccountBalances = summary.AccountBalances
        };

        return View(viewModel);
    }

    private void PopulateDropdowns()
    {
        ViewData["StatusList"] = new SelectList(
            Enum.GetValues<BudgetPlannerProjectStatus>().Select(s => new { Value = s, Text = FormatEnumName(s.ToString()) }),
            "Value", "Text");
    }

    private static string FormatEnumName(string name)
    {
        return string.Concat(name.Select((c, i) => i > 0 && char.IsUpper(c) ? " " + c : c.ToString()));
    }
}
