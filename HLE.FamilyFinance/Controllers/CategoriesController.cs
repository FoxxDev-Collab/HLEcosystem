using HLE.FamilyFinance.Extensions;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Models.ViewModels;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace HLE.FamilyFinance.Controllers;

[Authorize]
public class CategoriesController(
    ICategoryService categoryService,
    ILogger<CategoriesController> logger) : Controller
{
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var categories = await categoryService.GetCategoriesAsync(householdId, ct);

        // Group by parent for hierarchical display
        var incomeCategories = categories.Where(c => c.Type == CategoryType.Income).ToList();
        var expenseCategories = categories.Where(c => c.Type == CategoryType.Expense).ToList();

        ViewData["IncomeCategories"] = incomeCategories;
        ViewData["ExpenseCategories"] = expenseCategories;

        return View(categories);
    }

    public async Task<IActionResult> Create(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        await PopulateDropdownsAsync(householdId, ct);
        return View(new CategoryCreateViewModel());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(CategoryCreateViewModel model, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        if (!ModelState.IsValid)
        {
            await PopulateDropdownsAsync(householdId, ct);
            return View(model);
        }

        try
        {
            await categoryService.CreateCategoryAsync(
                householdId,
                model.Name,
                model.Type,
                model.ParentCategoryId,
                model.Icon,
                model.Color,
                ct);

            TempData["Success"] = "Category created successfully.";
            return RedirectToAction(nameof(Index));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error creating category");
            ModelState.AddModelError("", "An error occurred while creating the category.");
            await PopulateDropdownsAsync(householdId, ct);
            return View(model);
        }
    }

    public async Task<IActionResult> Edit(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var category = await categoryService.GetCategoryAsync(id, householdId, ct);

        if (category == null)
        {
            return NotFound();
        }

        var model = new CategoryEditViewModel
        {
            Id = category.Id,
            Name = category.Name,
            Type = category.Type,
            ParentCategoryId = category.ParentCategoryId,
            Icon = category.Icon,
            Color = category.Color
        };

        await PopulateDropdownsAsync(householdId, ct, id);
        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, CategoryEditViewModel model, CancellationToken ct)
    {
        if (id != model.Id)
        {
            return BadRequest();
        }

        var householdId = HttpContext.GetCurrentHouseholdId();

        if (!ModelState.IsValid)
        {
            await PopulateDropdownsAsync(householdId, ct, id);
            return View(model);
        }

        try
        {
            await categoryService.UpdateCategoryAsync(
                id,
                householdId,
                model.Name,
                model.ParentCategoryId,
                model.Icon,
                model.Color,
                ct);

            TempData["Success"] = "Category updated successfully.";
            return RedirectToAction(nameof(Index));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error updating category {CategoryId}", id);
            ModelState.AddModelError("", "An error occurred while updating the category.");
            await PopulateDropdownsAsync(householdId, ct, id);
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
            await categoryService.DeleteCategoryAsync(id, householdId, ct);
            TempData["Success"] = "Category deleted.";
        }
        catch (InvalidOperationException ex)
        {
            TempData["Error"] = ex.Message;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error deleting category {CategoryId}", id);
            TempData["Error"] = "Failed to delete category.";
        }

        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SeedDefaults(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await categoryService.SeedDefaultCategoriesAsync(householdId, ct);
            TempData["Success"] = "Default categories added successfully.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error seeding default categories");
            TempData["Error"] = "Failed to add default categories.";
        }

        return RedirectToAction(nameof(Index));
    }

    private async Task PopulateDropdownsAsync(int householdId, CancellationToken ct, int? excludeId = null)
    {
        var categories = await categoryService.GetCategoriesAsync(householdId, ct);

        // Exclude the current category and its children from parent selection
        var parentOptions = categories
            .Where(c => !c.ParentCategoryId.HasValue && c.Id != excludeId)
            .ToList();

        ViewData["ParentCategories"] = new SelectList(parentOptions, "Id", "Name");
        ViewData["CategoryTypes"] = new SelectList(
            Enum.GetValues<CategoryType>().Select(t => new { Value = t, Text = t.ToString() }),
            "Value", "Text");
    }
}
