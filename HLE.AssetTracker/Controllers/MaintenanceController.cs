using HLE.AssetTracker.Extensions;
using HLE.AssetTracker.Models.ViewModels;
using HLE.AssetTracker.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HLE.AssetTracker.Controllers;

[Authorize]
public class MaintenanceController(
    IMaintenanceService maintenanceService,
    IAssetService assetService) : Controller
{
    public async Task<IActionResult> Index()
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var dashboard = await maintenanceService.GetDashboardDataAsync(householdId);

        var viewModel = new MaintenanceIndexViewModel
        {
            Dashboard = dashboard
        };

        return View(viewModel);
    }

    public async Task<IActionResult> ByAsset(int id)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var asset = await assetService.GetAssetAsync(id, householdId);

        if (asset == null)
        {
            return NotFound();
        }

        var schedules = await maintenanceService.GetSchedulesForAssetAsync(id, householdId);
        var logs = await maintenanceService.GetLogsForAssetAsync(id, householdId, 50);

        var viewModel = new MaintenanceByAssetViewModel
        {
            AssetId = asset.Id,
            AssetName = asset.Name,
            Schedules = schedules,
            Logs = logs
        };

        return View(viewModel);
    }

    public async Task<IActionResult> History(int? assetId, int page = 1)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var logs = await maintenanceService.GetMaintenanceHistoryAsync(householdId, assetId, page, 20);

        string? assetName = null;
        if (assetId.HasValue)
        {
            var asset = await assetService.GetAssetAsync(assetId.Value, householdId);
            assetName = asset?.Name;
        }

        var viewModel = new MaintenanceHistoryViewModel
        {
            AssetId = assetId,
            AssetName = assetName,
            Logs = logs
        };

        return View(viewModel);
    }

    [HttpGet]
    public async Task<IActionResult> CreateSchedule(int assetId)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var asset = await assetService.GetAssetAsync(assetId, householdId);

        if (asset == null)
        {
            return NotFound();
        }

        var viewModel = new CreateScheduleViewModel
        {
            AssetId = assetId,
            AssetName = asset.Name
        };

        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CreateSchedule(CreateScheduleViewModel model)
    {
        if (!ModelState.IsValid)
        {
            var householdId = HttpContext.GetCurrentHouseholdId();
            var asset = await assetService.GetAssetAsync(model.AssetId, householdId);
            model.AssetName = asset?.Name;
            return View(model);
        }

        // Validate recurring schedules have an interval
        if (model.IsRecurring && (!model.IntervalDays.HasValue || model.IntervalDays.Value <= 0))
        {
            ModelState.AddModelError(nameof(model.IntervalDays), "Recurring schedules must have a positive interval.");
            var householdId2 = HttpContext.GetCurrentHouseholdId();
            var asset2 = await assetService.GetAssetAsync(model.AssetId, householdId2);
            model.AssetName = asset2?.Name;
            return View(model);
        }

        try
        {
            var householdId = HttpContext.GetCurrentHouseholdId();
            await maintenanceService.CreateScheduleAsync(
                model.AssetId,
                householdId,
                model.Name,
                model.Description,
                model.IntervalDays,
                model.NextDueDate,
                model.IsRecurring,
                model.NotifyDaysBefore);

            TempData["Success"] = "Maintenance schedule created successfully.";
            return RedirectToAction(nameof(ByAsset), new { id = model.AssetId });
        }
        catch (Exception ex)
        {
            ModelState.AddModelError(string.Empty, ex.Message);
            var householdId = HttpContext.GetCurrentHouseholdId();
            var asset = await assetService.GetAssetAsync(model.AssetId, householdId);
            model.AssetName = asset?.Name;
            return View(model);
        }
    }

    [HttpGet]
    public async Task<IActionResult> EditSchedule(int id)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var schedule = await maintenanceService.GetScheduleAsync(id, householdId);

        if (schedule == null)
        {
            return NotFound();
        }

        var viewModel = new EditScheduleViewModel
        {
            Id = schedule.Id,
            AssetId = schedule.AssetId,
            AssetName = schedule.Asset.Name,
            Name = schedule.Name,
            Description = schedule.Description,
            NextDueDate = schedule.NextDueDate,
            IsRecurring = schedule.IsRecurring,
            IntervalDays = schedule.IntervalDays,
            NotifyDaysBefore = schedule.NotifyDaysBefore,
            IsActive = schedule.IsActive
        };

        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> EditSchedule(EditScheduleViewModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        // Validate recurring schedules have an interval
        if (model.IsRecurring && (!model.IntervalDays.HasValue || model.IntervalDays.Value <= 0))
        {
            ModelState.AddModelError(nameof(model.IntervalDays), "Recurring schedules must have a positive interval.");
            return View(model);
        }

        try
        {
            var householdId = HttpContext.GetCurrentHouseholdId();
            await maintenanceService.UpdateScheduleAsync(
                model.Id,
                householdId,
                model.Name,
                model.Description,
                model.IntervalDays,
                model.NextDueDate,
                model.IsRecurring,
                model.NotifyDaysBefore,
                model.IsActive);

            TempData["Success"] = "Maintenance schedule updated successfully.";
            return RedirectToAction(nameof(ByAsset), new { id = model.AssetId });
        }
        catch (Exception ex)
        {
            ModelState.AddModelError(string.Empty, ex.Message);
            return View(model);
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteSchedule(int id)
    {
        try
        {
            var householdId = HttpContext.GetCurrentHouseholdId();
            var schedule = await maintenanceService.GetScheduleAsync(id, householdId);

            if (schedule == null)
            {
                return NotFound();
            }

            var assetId = schedule.AssetId;
            await maintenanceService.DeleteScheduleAsync(id, householdId);

            TempData["Success"] = "Maintenance schedule deleted successfully.";
            return RedirectToAction(nameof(ByAsset), new { id = assetId });
        }
        catch (Exception ex)
        {
            TempData["Error"] = ex.Message;
            return RedirectToAction(nameof(Index));
        }
    }

    [HttpGet]
    public async Task<IActionResult> LogMaintenance(int assetId, int? scheduleId)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var asset = await assetService.GetAssetAsync(assetId, householdId);

        if (asset == null)
        {
            return NotFound();
        }

        var viewModel = new LogMaintenanceViewModel
        {
            AssetId = assetId,
            AssetName = asset.Name,
            ScheduleId = scheduleId
        };

        if (scheduleId.HasValue)
        {
            var schedule = await maintenanceService.GetScheduleAsync(scheduleId.Value, householdId);
            if (schedule != null)
            {
                viewModel.ScheduleName = schedule.Name;
                viewModel.Description = schedule.Name;
            }
        }

        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> LogMaintenance(LogMaintenanceViewModel model)
    {
        if (!ModelState.IsValid)
        {
            var householdId2 = HttpContext.GetCurrentHouseholdId();
            var asset2 = await assetService.GetAssetAsync(model.AssetId, householdId2);
            model.AssetName = asset2?.Name;
            return View(model);
        }

        try
        {
            var householdId = HttpContext.GetCurrentHouseholdId();
            var userId = HttpContext.GetCurrentUserId();

            if (model.ScheduleId.HasValue)
            {
                // Log against a schedule and advance due date
                await maintenanceService.CompleteScheduledMaintenanceAsync(
                    model.ScheduleId.Value,
                    householdId,
                    userId,
                    model.PerformedAt,
                    model.Description,
                    model.Cost,
                    model.Notes);
            }
            else
            {
                // Log ad-hoc maintenance
                await maintenanceService.LogMaintenanceAsync(
                    model.AssetId,
                    householdId,
                    userId,
                    model.PerformedAt,
                    model.Description,
                    model.Cost,
                    model.Notes);
            }

            TempData["Success"] = "Maintenance logged successfully.";
            return RedirectToAction(nameof(ByAsset), new { id = model.AssetId });
        }
        catch (Exception ex)
        {
            ModelState.AddModelError(string.Empty, ex.Message);
            var householdId = HttpContext.GetCurrentHouseholdId();
            var asset = await assetService.GetAssetAsync(model.AssetId, householdId);
            model.AssetName = asset?.Name;
            return View(model);
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CompleteSchedule(int id)
    {
        try
        {
            var householdId = HttpContext.GetCurrentHouseholdId();
            var userId = HttpContext.GetCurrentUserId();
            var schedule = await maintenanceService.GetScheduleAsync(id, householdId);

            if (schedule == null)
            {
                return NotFound();
            }

            // Quick complete - log with schedule name and advance
            await maintenanceService.CompleteScheduledMaintenanceAsync(
                id,
                householdId,
                userId,
                DateOnly.FromDateTime(DateTime.Today),
                schedule.Name,
                null,
                null);

            TempData["Success"] = "Maintenance marked as complete.";
            return RedirectToAction(nameof(Index));
        }
        catch (Exception ex)
        {
            TempData["Error"] = ex.Message;
            return RedirectToAction(nameof(Index));
        }
    }
}
