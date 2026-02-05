using HLE.AssetTracker.Data;
using HLE.AssetTracker.Extensions;
using HLE.AssetTracker.Models.ViewModels;
using HLE.AssetTracker.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HLE.AssetTracker.Controllers;

[Authorize]
public class CategoriesController(
    ICategoryService categoryService,
    ApplicationDbContext context) : Controller
{
    public async Task<IActionResult> Index()
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var categories = await categoryService.GetCategoriesAsync(householdId);

        var categoryDtos = new List<CategoryListItemDto>();
        foreach (var category in categories)
        {
            var assetCount = await context.Assets
                .Where(a => a.CategoryId == category.Id && a.HouseholdId == householdId)
                .CountAsync();

            var customFieldCount = category.CustomFields.Count;

            categoryDtos.Add(new CategoryListItemDto(
                category.Id,
                category.Name,
                category.Icon,
                category.Color,
                assetCount,
                customFieldCount
            ));
        }

        var viewModel = new CategoryIndexViewModel
        {
            Categories = categoryDtos.OrderBy(c => c.Name).ToList()
        };

        return View(viewModel);
    }

    [HttpGet]
    public IActionResult Create()
    {
        var viewModel = new CreateCategoryViewModel();
        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(CreateCategoryViewModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        try
        {
            var householdId = HttpContext.GetCurrentHouseholdId();
            await categoryService.CreateCategoryAsync(
                householdId,
                model.Name,
                model.Icon,
                model.Color);

            TempData["Success"] = "Category created successfully.";
            return RedirectToAction(nameof(Index));
        }
        catch (Exception ex)
        {
            ModelState.AddModelError(string.Empty, ex.Message);
            return View(model);
        }
    }

    [HttpGet]
    public async Task<IActionResult> Edit(int id)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var category = await categoryService.GetCategoryAsync(id, householdId);

        if (category == null)
        {
            return NotFound();
        }

        var assetCount = await context.Assets
            .Where(a => a.CategoryId == id && a.HouseholdId == householdId)
            .CountAsync();

        var customFields = await categoryService.GetCustomFieldsAsync(id);

        var viewModel = new EditCategoryViewModel
        {
            Id = category.Id,
            Name = category.Name,
            Icon = category.Icon,
            Color = category.Color,
            AssetCount = assetCount,
            CustomFields = customFields.OrderBy(f => f.SortOrder).ToList()
        };

        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(EditCategoryViewModel model)
    {
        if (!ModelState.IsValid)
        {
            var householdId2 = HttpContext.GetCurrentHouseholdId();
            model.CustomFields = (await categoryService.GetCustomFieldsAsync(model.Id))
                .OrderBy(f => f.SortOrder).ToList();
            return View(model);
        }

        try
        {
            var householdId = HttpContext.GetCurrentHouseholdId();
            await categoryService.UpdateCategoryAsync(
                model.Id,
                householdId,
                model.Name,
                model.Icon,
                model.Color);

            TempData["Success"] = "Category updated successfully.";
            return RedirectToAction(nameof(Index));
        }
        catch (Exception ex)
        {
            ModelState.AddModelError(string.Empty, ex.Message);
            var householdId = HttpContext.GetCurrentHouseholdId();
            model.CustomFields = (await categoryService.GetCustomFieldsAsync(model.Id))
                .OrderBy(f => f.SortOrder).ToList();
            return View(model);
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            var householdId = HttpContext.GetCurrentHouseholdId();
            await categoryService.DeleteCategoryAsync(id, householdId);

            TempData["Success"] = "Category deleted successfully.";
            return RedirectToAction(nameof(Index));
        }
        catch (Exception ex)
        {
            TempData["Error"] = ex.Message;
            return RedirectToAction(nameof(Index));
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> AddCustomField(int categoryId, AddCustomFieldViewModel model)
    {
        model.CategoryId = categoryId;

        if (!ModelState.IsValid)
        {
            TempData["Error"] = "Invalid custom field data.";
            return RedirectToAction(nameof(Edit), new { id = categoryId });
        }

        try
        {
            var householdId = HttpContext.GetCurrentHouseholdId();
            var options = !string.IsNullOrWhiteSpace(model.SelectOptions)
                ? model.SelectOptions.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                : null;

            await categoryService.AddCustomFieldAsync(
                categoryId,
                householdId,
                model.Name,
                model.FieldType,
                options,
                model.IsRequired);

            TempData["Success"] = $"Custom field '{model.Name}' added successfully.";
            return RedirectToAction(nameof(Edit), new { id = categoryId });
        }
        catch (Exception ex)
        {
            TempData["Error"] = ex.Message;
            return RedirectToAction(nameof(Edit), new { id = categoryId });
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteCustomField(int id, int categoryId)
    {
        try
        {
            var householdId = HttpContext.GetCurrentHouseholdId();
            await categoryService.DeleteCustomFieldAsync(id, householdId);

            TempData["Success"] = "Custom field deleted successfully.";
            return RedirectToAction(nameof(Edit), new { id = categoryId });
        }
        catch (Exception ex)
        {
            TempData["Error"] = ex.Message;
            return RedirectToAction(nameof(Edit), new { id = categoryId });
        }
    }
}
