using HLE.FamilyFinance.Extensions;
using HLE.FamilyFinance.Helpers;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace HLE.FamilyFinance.Controllers;

[Authorize]
public class AssetsController(
    IAssetService assetService,
    IDebtService debtService,
    ILogger<AssetsController> logger) : Controller
{
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var assets = await assetService.GetAssetsAsync(householdId, ct);
        var totalValue = await assetService.GetTotalAssetValueAsync(householdId, ct);

        ViewData["TotalValue"] = totalValue;
        return View(assets);
    }

    public async Task<IActionResult> Details(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var asset = await assetService.GetAssetAsync(id, householdId, ct);

        if (asset == null)
        {
            return NotFound();
        }

        var valueHistory = await assetService.GetValueHistoryAsync(id, householdId, ct);
        ViewData["ValueHistory"] = valueHistory;

        return View(asset);
    }

    public async Task<IActionResult> Create(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        await PopulateDropdownsAsync(householdId, ct);
        return View(new AssetCreateDto());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(AssetCreateDto model, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        if (!ModelState.IsValid)
        {
            await PopulateDropdownsAsync(householdId, ct);
            return View(model);
        }

        try
        {
            var asset = await assetService.CreateAssetAsync(householdId, model, ct);
            TempData["Success"] = "Asset created successfully.";
            return RedirectToAction(nameof(Details), new { id = asset.Id });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error creating asset");
            ModelState.AddModelError("", "An error occurred while creating the asset.");
            await PopulateDropdownsAsync(householdId, ct);
            return View(model);
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

        var model = new AssetCreateDto(
            asset.Name,
            asset.Type,
            asset.PurchasePrice,
            asset.PurchaseDate,
            asset.CurrentValue,
            asset.Address,
            asset.City,
            asset.State,
            asset.ZipCode,
            asset.SquareFootage,
            asset.YearBuilt,
            asset.PropertyTaxAnnual,
            asset.Make,
            asset.VehicleModel,
            asset.VehicleYear,
            asset.VIN,
            asset.Mileage,
            asset.LicensePlate,
            asset.LinkedDebtId,
            asset.Icon,
            asset.Color,
            asset.Notes,
            asset.IncludeInNetWorth
        );

        ViewData["AssetId"] = id;
        await PopulateDropdownsAsync(householdId, ct);
        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, AssetCreateDto model, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        if (!ModelState.IsValid)
        {
            ViewData["AssetId"] = id;
            await PopulateDropdownsAsync(householdId, ct);
            return View(model);
        }

        try
        {
            await assetService.UpdateAssetAsync(id, householdId, model, ct);
            TempData["Success"] = "Asset updated successfully.";
            return RedirectToAction(nameof(Details), new { id });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error updating asset {AssetId}", id);
            ModelState.AddModelError("", "An error occurred while updating the asset.");
            ViewData["AssetId"] = id;
            await PopulateDropdownsAsync(householdId, ct);
            return View(model);
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateValue(int id, decimal newValue, string? source, string? notes, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await assetService.UpdateValueAsync(id, householdId, newValue, source, notes, ct);
            TempData["Success"] = "Value updated successfully.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error updating value for asset {AssetId}", id);
            TempData["Error"] = "Failed to update value.";
        }

        return RedirectToAction(nameof(Details), new { id });
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
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await assetService.DeleteAssetAsync(id, householdId, ct);
            TempData["Success"] = "Asset deleted.";
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
        ViewData["AssetTypes"] = new SelectList(
            Enum.GetValues<AssetType>().Select(t => new { Value = t, Text = FormatEnumName(t.ToString()) }),
            "Value", "Text");

        var debts = await debtService.GetDebtsAsync(householdId, ct);
        ViewData["Debts"] = new SelectList(debts, "Id", "Name");
    }

    private static string FormatEnumName(string name)
    {
        return string.Concat(name.Select((c, i) => i > 0 && char.IsUpper(c) ? " " + c : c.ToString()));
    }
}
