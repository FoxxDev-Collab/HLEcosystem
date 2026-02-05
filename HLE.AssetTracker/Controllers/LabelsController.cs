using HLE.AssetTracker.Extensions;
using HLE.AssetTracker.Models.ViewModels;
using HLE.AssetTracker.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HLE.AssetTracker.Controllers;

[Authorize]
public class LabelsController(ILabelService labelService) : Controller
{
    public async Task<IActionResult> Index()
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var labels = await labelService.GetLabelsAsync(householdId);

        var labelDtos = new List<LabelListItemDto>();
        foreach (var label in labels)
        {
            var assetCount = await labelService.GetAssetCountAsync(label.Id);
            labelDtos.Add(new LabelListItemDto(
                label.Id,
                label.Name,
                label.Color,
                assetCount
            ));
        }

        var viewModel = new LabelIndexViewModel
        {
            Labels = labelDtos
        };

        return View(viewModel);
    }

    [HttpGet]
    public IActionResult Create()
    {
        var viewModel = new CreateLabelViewModel();
        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(CreateLabelViewModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        try
        {
            var householdId = HttpContext.GetCurrentHouseholdId();
            await labelService.CreateLabelAsync(householdId, model.Name, model.Color);

            TempData["Success"] = "Label created successfully.";
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
        var label = await labelService.GetLabelAsync(id, householdId);

        if (label == null)
        {
            return NotFound();
        }

        var assetCount = await labelService.GetAssetCountAsync(id);

        var viewModel = new EditLabelViewModel
        {
            Id = label.Id,
            Name = label.Name,
            Color = label.Color,
            AssetCount = assetCount
        };

        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(EditLabelViewModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        try
        {
            var householdId = HttpContext.GetCurrentHouseholdId();
            await labelService.UpdateLabelAsync(model.Id, householdId, model.Name, model.Color);

            TempData["Success"] = "Label updated successfully.";
            return RedirectToAction(nameof(Index));
        }
        catch (Exception ex)
        {
            ModelState.AddModelError(string.Empty, ex.Message);
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
            await labelService.DeleteLabelAsync(id, householdId);

            TempData["Success"] = "Label deleted successfully.";
            return RedirectToAction(nameof(Index));
        }
        catch (Exception ex)
        {
            TempData["Error"] = ex.Message;
            return RedirectToAction(nameof(Index));
        }
    }
}
