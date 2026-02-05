using HLE.AssetTracker.Extensions;
using HLE.AssetTracker.Models.Entities;
using HLE.AssetTracker.Models.ViewModels;
using HLE.AssetTracker.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HLE.AssetTracker.Controllers;

[Authorize]
public class VehiclesController : Controller
{
    private readonly IVehicleService _vehicleService;
    private readonly ILogger<VehiclesController> _logger;

    public VehiclesController(IVehicleService vehicleService, ILogger<VehiclesController> logger)
    {
        _vehicleService = vehicleService;
        _logger = logger;
    }

    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var vehicles = await _vehicleService.GetVehiclesAsync(householdId, includeArchived: false, ct);

        return View(vehicles);
    }

    public IActionResult Create()
    {
        return View(new VehicleCreateViewModel());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(VehicleCreateViewModel viewModel, CancellationToken ct)
    {
        if (!ModelState.IsValid)
        {
            return View(viewModel);
        }

        var householdId = HttpContext.GetCurrentHouseholdId();
        var userId = HttpContext.GetCurrentUserId();

        var vehicle = new Vehicle
        {
            HouseholdId = householdId,
            AssetId = viewModel.AssetId,
            Make = viewModel.Make,
            Model = viewModel.Model,
            Year = viewModel.Year,
            VIN = viewModel.VIN,
            LicensePlate = viewModel.LicensePlate,
            Color = viewModel.Color,
            VehicleType = viewModel.VehicleType,
            CurrentOdometer = viewModel.CurrentOdometer,
            OdometerUnit = viewModel.OdometerUnit,
            Notes = viewModel.Notes,
            CreatedByUserId = userId,
            IsArchived = false
        };

        await _vehicleService.CreateVehicleAsync(vehicle, ct);

        TempData["Success"] = "Vehicle created successfully!";
        return RedirectToAction(nameof(Index));
    }

    public async Task<IActionResult> Edit(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var vehicle = await _vehicleService.GetVehicleAsync(id, householdId, ct);

        if (vehicle == null)
        {
            return NotFound();
        }

        var viewModel = new VehicleEditViewModel
        {
            Id = vehicle.Id,
            Make = vehicle.Make,
            Model = vehicle.Model,
            Year = vehicle.Year,
            VIN = vehicle.VIN,
            LicensePlate = vehicle.LicensePlate,
            Color = vehicle.Color,
            VehicleType = vehicle.VehicleType,
            CurrentOdometer = vehicle.CurrentOdometer,
            OdometerUnit = vehicle.OdometerUnit,
            Notes = vehicle.Notes,
            AssetId = vehicle.AssetId
        };

        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, VehicleEditViewModel viewModel, CancellationToken ct)
    {
        if (id != viewModel.Id)
        {
            return BadRequest();
        }

        if (!ModelState.IsValid)
        {
            return View(viewModel);
        }

        var householdId = HttpContext.GetCurrentHouseholdId();
        var vehicle = await _vehicleService.GetVehicleAsync(id, householdId, ct);

        if (vehicle == null)
        {
            return NotFound();
        }

        vehicle.Make = viewModel.Make;
        vehicle.Model = viewModel.Model;
        vehicle.Year = viewModel.Year;
        vehicle.VIN = viewModel.VIN;
        vehicle.LicensePlate = viewModel.LicensePlate;
        vehicle.Color = viewModel.Color;
        vehicle.VehicleType = viewModel.VehicleType;
        vehicle.CurrentOdometer = viewModel.CurrentOdometer;
        vehicle.OdometerUnit = viewModel.OdometerUnit;
        vehicle.Notes = viewModel.Notes;
        vehicle.AssetId = viewModel.AssetId;

        await _vehicleService.UpdateVehicleAsync(vehicle, ct);

        TempData["Success"] = "Vehicle updated successfully!";
        return RedirectToAction(nameof(Details), new { id });
    }

    public async Task<IActionResult> Details(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var vehicle = await _vehicleService.GetVehicleAsync(id, householdId, ct);

        if (vehicle == null)
        {
            return NotFound();
        }

        // Get statistics
        ViewBag.AverageMPG = await _vehicleService.CalculateAverageMPGAsync(id, householdId, ct);
        ViewBag.RecentMPG = await _vehicleService.CalculateRecentMPGAsync(id, householdId, 3, ct);
        ViewBag.MilesThisMonth = await _vehicleService.GetMilesDrivenThisMonthAsync(id, householdId, ct);
        ViewBag.FuelCostThisMonth = await _vehicleService.GetFuelCostThisMonthAsync(id, householdId, ct);

        return View(vehicle);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Archive(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await _vehicleService.ArchiveVehicleAsync(id, householdId, ct);
            TempData["Success"] = "Vehicle archived successfully!";
        }
        catch (InvalidOperationException)
        {
            TempData["Error"] = "Vehicle not found.";
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
            await _vehicleService.RestoreVehicleAsync(id, householdId, ct);
            TempData["Success"] = "Vehicle restored successfully!";
        }
        catch (InvalidOperationException)
        {
            TempData["Error"] = "Vehicle not found.";
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
            await _vehicleService.DeleteVehicleAsync(id, householdId, ct);
            TempData["Success"] = "Vehicle permanently deleted!";
        }
        catch (InvalidOperationException)
        {
            TempData["Error"] = "Vehicle not found.";
        }

        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> AddOdometerReading(OdometerReadingViewModel viewModel, CancellationToken ct)
    {
        if (!ModelState.IsValid)
        {
            TempData["Error"] = "Invalid odometer reading data.";
            return RedirectToAction(nameof(Details), new { id = viewModel.VehicleId });
        }

        var householdId = HttpContext.GetCurrentHouseholdId();
        var userId = HttpContext.GetCurrentUserId();

        try
        {
            await _vehicleService.AddOdometerReadingAsync(
                viewModel.VehicleId,
                householdId,
                viewModel.Odometer,
                viewModel.ReadingDate,
                userId,
                viewModel.Notes,
                ct);

            TempData["Success"] = "Odometer reading added successfully!";
        }
        catch (InvalidOperationException ex)
        {
            TempData["Error"] = ex.Message;
        }

        return RedirectToAction(nameof(Details), new { id = viewModel.VehicleId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> AddFuelLog(FuelLogViewModel viewModel, CancellationToken ct)
    {
        if (!ModelState.IsValid)
        {
            TempData["Error"] = "Invalid fuel log data.";
            return RedirectToAction(nameof(Details), new { id = viewModel.VehicleId });
        }

        var householdId = HttpContext.GetCurrentHouseholdId();
        var userId = HttpContext.GetCurrentUserId();

        try
        {
            await _vehicleService.AddFuelLogAsync(
                viewModel.VehicleId,
                householdId,
                viewModel.Odometer,
                viewModel.FillUpDate,
                viewModel.Quantity,
                viewModel.QuantityUnit,
                viewModel.TotalCost,
                viewModel.PricePerUnit,
                viewModel.FuelType,
                viewModel.IsFullTank,
                userId,
                viewModel.Notes,
                ct);

            TempData["Success"] = "Fuel log added successfully!";
        }
        catch (InvalidOperationException ex)
        {
            TempData["Error"] = ex.Message;
        }

        return RedirectToAction(nameof(Details), new { id = viewModel.VehicleId });
    }
}
