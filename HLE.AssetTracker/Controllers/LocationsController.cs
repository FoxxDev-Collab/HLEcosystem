using HLE.AssetTracker.Data;
using HLE.AssetTracker.Extensions;
using HLE.AssetTracker.Models.ViewModels;
using HLE.AssetTracker.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HLE.AssetTracker.Controllers;

[Authorize]
public class LocationsController(
    ILocationService locationService,
    ApplicationDbContext context) : Controller
{
    public async Task<IActionResult> Index()
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var locations = await locationService.GetLocationTreeAsync(householdId);

        // Build tree DTOs with asset counts
        var locationDtos = await BuildLocationTreeAsync(locations, householdId);

        var viewModel = new LocationIndexViewModel
        {
            Locations = locationDtos
        };

        return View(viewModel);
    }

    [HttpGet]
    public async Task<IActionResult> Create(int? parentId)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var availableParents = await GetAvailableParentsAsync(householdId);

        string? parentName = null;
        if (parentId.HasValue)
        {
            var parent = await locationService.GetLocationAsync(parentId.Value, householdId);
            parentName = parent?.Name;
        }

        var viewModel = new CreateLocationViewModel
        {
            ParentId = parentId,
            ParentName = parentName,
            AvailableParents = availableParents
        };

        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(CreateLocationViewModel model)
    {
        if (!ModelState.IsValid)
        {
            var householdId2 = HttpContext.GetCurrentHouseholdId();
            model.AvailableParents = await GetAvailableParentsAsync(householdId2);
            return View(model);
        }

        try
        {
            var householdId = HttpContext.GetCurrentHouseholdId();
            await locationService.CreateLocationAsync(
                householdId,
                model.Name,
                model.ParentId,
                model.Description);

            TempData["Success"] = "Location created successfully.";
            return RedirectToAction(nameof(Index));
        }
        catch (Exception ex)
        {
            ModelState.AddModelError(string.Empty, ex.Message);
            var householdId = HttpContext.GetCurrentHouseholdId();
            model.AvailableParents = await GetAvailableParentsAsync(householdId);
            return View(model);
        }
    }

    [HttpGet]
    public async Task<IActionResult> Edit(int id)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var location = await locationService.GetLocationAsync(id, householdId);

        if (location == null)
        {
            return NotFound();
        }

        var assetCount = await context.Assets
            .Where(a => a.LocationId == id && a.HouseholdId == householdId)
            .CountAsync();

        var availableParents = await GetAvailableParentsAsync(householdId, excludeId: id);
        var path = await locationService.GetLocationPathAsync(id, householdId);

        var viewModel = new EditLocationViewModel
        {
            Id = location.Id,
            Name = location.Name,
            Description = location.Description,
            ParentId = location.ParentId,
            CurrentPath = path,
            AssetCount = assetCount,
            AvailableParents = availableParents
        };

        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(EditLocationViewModel model)
    {
        if (!ModelState.IsValid)
        {
            var householdId2 = HttpContext.GetCurrentHouseholdId();
            model.AvailableParents = await GetAvailableParentsAsync(householdId2, excludeId: model.Id);
            model.CurrentPath = await locationService.GetLocationPathAsync(model.Id, householdId2);
            return View(model);
        }

        try
        {
            var householdId = HttpContext.GetCurrentHouseholdId();

            // Update basic properties
            await locationService.UpdateLocationAsync(
                model.Id,
                householdId,
                model.Name,
                model.Description);

            // Move if parent changed
            var location = await locationService.GetLocationAsync(model.Id, householdId);
            if (location != null && location.ParentId != model.ParentId)
            {
                await locationService.MoveLocationAsync(model.Id, householdId, model.ParentId);
            }

            TempData["Success"] = "Location updated successfully.";
            return RedirectToAction(nameof(Index));
        }
        catch (Exception ex)
        {
            ModelState.AddModelError(string.Empty, ex.Message);
            var householdId = HttpContext.GetCurrentHouseholdId();
            model.AvailableParents = await GetAvailableParentsAsync(householdId, excludeId: model.Id);
            model.CurrentPath = await locationService.GetLocationPathAsync(model.Id, householdId);
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
            await locationService.DeleteLocationAsync(id, householdId);

            TempData["Success"] = "Location deleted successfully.";
            return RedirectToAction(nameof(Index));
        }
        catch (Exception ex)
        {
            TempData["Error"] = ex.Message;
            return RedirectToAction(nameof(Index));
        }
    }

    private async Task<List<LocationTreeItemDto>> BuildLocationTreeAsync(
        IEnumerable<HLE.AssetTracker.Models.Entities.Location> locations,
        int householdId,
        int? parentId = null)
    {
        var result = new List<LocationTreeItemDto>();

        foreach (var location in locations.Where(l => l.ParentId == parentId))
        {
            var assetCount = await context.Assets
                .Where(a => a.LocationId == location.Id && a.HouseholdId == householdId)
                .CountAsync();

            var path = await locationService.GetLocationPathAsync(location.Id, householdId);

            var children = await BuildLocationTreeAsync(locations, householdId, location.Id);

            result.Add(new LocationTreeItemDto(
                location.Id,
                location.Name,
                location.Description,
                location.ParentId,
                path,
                assetCount,
                children
            ));
        }

        return result;
    }

    private async Task<List<LocationSelectDto>> GetAvailableParentsAsync(int householdId, int? excludeId = null)
    {
        var locations = await locationService.GetAllLocationsAsync(householdId);
        var result = new List<LocationSelectDto>();

        // Add root option
        result.Add(new LocationSelectDto(0, "(No Parent - Top Level)", "", 0));

        // Build hierarchy
        await BuildLocationSelectListAsync(locations, result, householdId, null, 0, excludeId);

        return result;
    }

    private async Task BuildLocationSelectListAsync(
        List<HLE.AssetTracker.Models.Entities.Location> allLocations,
        List<LocationSelectDto> result,
        int householdId,
        int? parentId,
        int level,
        int? excludeId)
    {
        var children = allLocations.Where(l => l.ParentId == parentId);

        foreach (var location in children)
        {
            if (excludeId.HasValue && location.Id == excludeId.Value)
            {
                // Skip the location being edited (can't be its own parent)
                continue;
            }

            var path = await locationService.GetLocationPathAsync(location.Id, householdId);
            var indent = new string('\u00A0', level * 4); // Non-breaking spaces for indentation

            result.Add(new LocationSelectDto(
                location.Id,
                $"{indent}{location.Name}",
                path,
                level
            ));

            // Recursively add children
            await BuildLocationSelectListAsync(allLocations, result, householdId, location.Id, level + 1, excludeId);
        }
    }
}
