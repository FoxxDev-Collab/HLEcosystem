using System.Text.Json;
using HLE.AssetTracker.Extensions;
using HLE.AssetTracker.Filters;
using HLE.AssetTracker.Models.Enums;
using HLE.AssetTracker.Models.ViewModels;
using HLE.AssetTracker.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace HLE.AssetTracker.Controllers;

[Authorize]
public class AssetsController(
    IAssetService assetService,
    ILocationService locationService,
    ICategoryService categoryService,
    ILogger<AssetsController> logger) : Controller
{
    public async Task<IActionResult> Index(
        string? search,
        int? categoryId,
        int? locationId,
        string sortBy = "name",
        bool sortDesc = false,
        int page = 1,
        CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        var filter = new AssetFilterDto(
            HouseholdId: householdId,
            SearchTerm: search,
            CategoryId: categoryId,
            LocationId: locationId,
            LabelIds: null,
            IncludeArchived: false,
            Page: page,
            PageSize: 20,
            SortBy: sortBy,
            SortDescending: sortDesc
        );

        var result = await assetService.GetAssetsAsync(filter, ct);
        var categories = await categoryService.GetCategoriesAsync(householdId, ct);
        var locations = await locationService.GetAllLocationsAsync(householdId, ct);

        ViewData["Categories"] = new SelectList(categories, "Id", "Name", categoryId);
        ViewData["Locations"] = new SelectList(locations, "Id", "Name", locationId);
        ViewData["Search"] = search;
        ViewData["SortBy"] = sortBy;
        ViewData["SortDesc"] = sortDesc;

        return View(result);
    }

    public async Task<IActionResult> Details(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var asset = await assetService.GetAssetAsync(id, householdId, ct);

        if (asset == null)
        {
            return NotFound();
        }

        return View(asset);
    }

    public async Task<IActionResult> Create(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        await PopulateDropdownsAsync(householdId, ct);
        return View(new AssetCreateViewModel());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(AssetCreateViewModel viewModel, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var userId = HttpContext.GetCurrentUserId();

        // Diagnostic logging
        logger.LogInformation("=== Create POST Debug ===");
        logger.LogInformation("ModelState.IsValid: {IsValid}", ModelState.IsValid);
        logger.LogInformation("Model.Name: '{Name}'", viewModel.Name ?? "(null)");
        logger.LogInformation("Model.Quantity: {Quantity}", viewModel.Quantity);

        // Log raw form data
        logger.LogInformation("=== RAW FORM DATA ===");
        foreach (var key in Request.Form.Keys)
        {
            var value = Request.Form[key];
            logger.LogInformation("  Form[{Key}] = '{Value}'", key, value);
        }

        if (!ModelState.IsValid)
        {
            logger.LogWarning("Validation failed with {ErrorCount} errors:", ModelState.ErrorCount);
            foreach (var key in ModelState.Keys)
            {
                var errors = ModelState[key]?.Errors;
                if (errors?.Count > 0)
                {
                    foreach (var error in errors)
                    {
                        logger.LogWarning("  [{Key}]: {Error}", key, error.ErrorMessage);
                    }
                }
            }

            await PopulateDropdownsAsync(householdId, ct);
            return View(viewModel);
        }

        try
        {
            JsonDocument? customFields = null;
            if (!string.IsNullOrWhiteSpace(viewModel.CustomFieldsJson))
            {
                customFields = JsonDocument.Parse(viewModel.CustomFieldsJson);
            }

            var asset = await assetService.CreateAssetAsync(
                householdId,
                userId,
                viewModel.Name,
                viewModel.Description,
                viewModel.CategoryId,
                viewModel.LocationId,
                viewModel.Manufacturer,
                viewModel.Model,
                viewModel.SerialNumber,
                viewModel.PurchaseDate,
                viewModel.PurchasePrice,
                viewModel.PurchaseLocation,
                viewModel.WarrantyExpiration,
                viewModel.WarrantyNotes,
                viewModel.Quantity,
                viewModel.Notes,
                customFields,
                viewModel.LabelIds,
                ct);

            TempData["Success"] = "Asset created successfully.";
            return RedirectToAction(nameof(Details), new { id = asset.Id });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error creating asset");
            ModelState.AddModelError("", "An error occurred while creating the asset.");
            await PopulateDropdownsAsync(householdId, ct);
            return View(viewModel);
        }
    }

    public async Task<IActionResult> Edit(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var asset = await assetService.GetAssetAsync(id, householdId, ct);

        if (asset == null)
        {
            return NotFound();
        }

        var model = new AssetEditViewModel
        {
            Id = asset.Id,
            Name = asset.Name,
            Description = asset.Description,
            CategoryId = asset.CategoryId,
            LocationId = asset.LocationId,
            Manufacturer = asset.Manufacturer,
            Model = asset.Model,
            SerialNumber = asset.SerialNumber,
            PurchaseDate = asset.PurchaseDate,
            PurchasePrice = asset.PurchasePrice,
            PurchaseLocation = asset.PurchaseLocation,
            WarrantyExpiration = asset.WarrantyExpiration,
            WarrantyNotes = asset.WarrantyNotes,
            Quantity = asset.Quantity,
            Notes = asset.Notes,
            CustomFieldsJson = asset.CustomFields?.RootElement.ToString(),
            LabelIds = asset.AssetLabels.Select(al => al.LabelId).ToArray()
        };

        await PopulateDropdownsAsync(householdId, ct);
        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, AssetEditViewModel viewModel, CancellationToken ct)
    {
        if (id != viewModel.Id)
        {
            return BadRequest();
        }

        var householdId = HttpContext.GetCurrentHouseholdId();

        if (!ModelState.IsValid)
        {
            await PopulateDropdownsAsync(householdId, ct);
            return View(viewModel);
        }

        try
        {
            JsonDocument? customFields = null;
            if (!string.IsNullOrWhiteSpace(viewModel.CustomFieldsJson))
            {
                customFields = JsonDocument.Parse(viewModel.CustomFieldsJson);
            }

            await assetService.UpdateAssetAsync(
                id,
                householdId,
                viewModel.Name,
                viewModel.Description,
                viewModel.CategoryId,
                viewModel.LocationId,
                viewModel.Manufacturer,
                viewModel.Model,
                viewModel.SerialNumber,
                viewModel.PurchaseDate,
                viewModel.PurchasePrice,
                viewModel.PurchaseLocation,
                viewModel.WarrantyExpiration,
                viewModel.WarrantyNotes,
                viewModel.Quantity,
                viewModel.Notes,
                customFields,
                viewModel.LabelIds,
                ct);

            TempData["Success"] = "Asset updated successfully.";
            return RedirectToAction(nameof(Details), new { id });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error updating asset {AssetId}", id);
            ModelState.AddModelError("", "An error occurred while updating the asset.");
            await PopulateDropdownsAsync(householdId, ct);
            return View(viewModel);
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Archive(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await assetService.ArchiveAssetAsync(id, householdId, ct);
            TempData["Success"] = "Asset archived.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error archiving asset {AssetId}", id);
            TempData["Error"] = "Failed to archive asset.";
        }

        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Restore(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await assetService.RestoreAssetAsync(id, householdId, ct);
            TempData["Success"] = "Asset restored.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error restoring asset {AssetId}", id);
            TempData["Error"] = "Failed to restore asset.";
        }

        return RedirectToAction(nameof(Details), new { id });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [RequireHouseholdRole(HouseholdRole.Admin)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await assetService.DeleteAssetAsync(id, householdId, ct);
            TempData["Success"] = "Asset permanently deleted.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error deleting asset {AssetId}", id);
            TempData["Error"] = "Failed to delete asset.";
        }

        return RedirectToAction(nameof(Index));
    }

    private async Task PopulateDropdownsAsync(int householdId, CancellationToken ct)
    {
        var categories = await categoryService.GetCategoriesAsync(householdId, ct);
        var locations = await locationService.GetAllLocationsAsync(householdId, ct);

        ViewData["Categories"] = new SelectList(categories, "Id", "Name");
        ViewData["Locations"] = new SelectList(locations, "Id", "Name");
    }
}
