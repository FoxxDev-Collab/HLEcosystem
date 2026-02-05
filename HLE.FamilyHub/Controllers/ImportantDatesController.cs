using HLE.FamilyHub.Extensions;
using HLE.FamilyHub.Models.Entities;
using HLE.FamilyHub.Models.Enums;
using HLE.FamilyHub.Models.ViewModels;
using HLE.FamilyHub.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using System.Globalization;

namespace HLE.FamilyHub.Controllers;

/// <summary>
/// Controller for managing important dates (birthdays, anniversaries, etc.).
/// </summary>
[Authorize]
public class ImportantDatesController(
    IImportantDateService importantDateService,
    IFamilyMemberService familyMemberService) : Controller
{
    /// <summary>
    /// List all important dates sorted by next occurrence.
    /// </summary>
    /// <param name="ct">Cancellation token</param>
    public async Task<IActionResult> Index(CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var dates = await importantDateService.GetAllDatesAsync(householdId, ct);

        return View(dates);
    }

    /// <summary>
    /// Display calendar view for a specific month.
    /// </summary>
    /// <param name="year">Year to display</param>
    /// <param name="month">Month to display (1-12)</param>
    /// <param name="ct">Cancellation token</param>
    public async Task<IActionResult> Calendar(int? year, int? month, CancellationToken ct = default)
    {
        var currentDate = DateTime.Today;
        var targetYear = year ?? currentDate.Year;
        var targetMonth = month ?? currentDate.Month;

        if (targetMonth < 1 || targetMonth > 12)
        {
            targetMonth = currentDate.Month;
        }

        var householdId = HttpContext.GetCurrentHouseholdId();
        var dates = await importantDateService.GetDatesByMonthAsync(householdId, targetYear, targetMonth, ct);

        var viewModel = new CalendarViewModel
        {
            Year = targetYear,
            Month = targetMonth,
            Dates = dates,
            MonthName = new DateTime(targetYear, targetMonth, 1).ToString("MMMM yyyy", CultureInfo.CurrentCulture)
        };

        return View(viewModel);
    }

    /// <summary>
    /// Display form to create a new important date.
    /// </summary>
    /// <param name="familyMemberId">Optional pre-selected family member ID</param>
    /// <param name="ct">Cancellation token</param>
    public async Task<IActionResult> Create(int? familyMemberId, CancellationToken ct = default)
    {
        await PopulateDropdownsAsync(ct);

        if (familyMemberId.HasValue)
        {
            ViewData["PreselectedMemberId"] = familyMemberId.Value;
        }

        return View();
    }

    /// <summary>
    /// Create a new important date.
    /// </summary>
    /// <param name="model">Important date creation data</param>
    /// <param name="ct">Cancellation token</param>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(ImportantDateCreateViewModel model, CancellationToken ct = default)
    {
        if (!ModelState.IsValid)
        {
            await PopulateDropdownsAsync(ct);
            return View(model);
        }

        var householdId = HttpContext.GetCurrentHouseholdId();
        await importantDateService.CreateDateAsync(
            householdId,
            model.FamilyMemberId,
            model.Label,
            model.Date,
            model.Type,
            model.RecurrenceType,
            model.ReminderDaysBefore,
            model.Notes,
            ct);

        TempData["Success"] = "Important date created successfully.";
        return RedirectToAction(nameof(Index));
    }

    /// <summary>
    /// Display form to edit an important date.
    /// </summary>
    /// <param name="id">Important date ID</param>
    /// <param name="ct">Cancellation token</param>
    public async Task<IActionResult> Edit(int id, CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var date = await importantDateService.GetDateAsync(id, householdId, ct);

        if (date == null)
        {
            return NotFound();
        }

        var viewModel = new ImportantDateEditViewModel
        {
            Id = date.Id,
            Label = date.Label,
            Date = date.Date,
            Type = date.Type,
            RecurrenceType = date.RecurrenceType,
            ReminderDaysBefore = date.ReminderDaysBefore,
            FamilyMemberId = date.FamilyMemberId,
            Notes = date.Notes
        };

        await PopulateDropdownsAsync(ct);
        return View(viewModel);
    }

    /// <summary>
    /// Update an existing important date.
    /// </summary>
    /// <param name="id">Important date ID</param>
    /// <param name="model">Updated important date data</param>
    /// <param name="ct">Cancellation token</param>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, ImportantDateEditViewModel model, CancellationToken ct = default)
    {
        if (!ModelState.IsValid)
        {
            await PopulateDropdownsAsync(ct);
            return View(model);
        }

        var householdId = HttpContext.GetCurrentHouseholdId();

        // Verify the important date exists before updating
        var existingDate = await importantDateService.GetDateAsync(id, householdId, ct);
        if (existingDate == null)
        {
            return NotFound();
        }

        await importantDateService.UpdateDateAsync(
            id,
            householdId,
            model.FamilyMemberId,
            model.Label,
            model.Date,
            model.Type,
            model.RecurrenceType,
            model.ReminderDaysBefore,
            model.Notes,
            ct);

        TempData["Success"] = "Important date updated successfully.";
        return RedirectToAction(nameof(Index));
    }

    /// <summary>
    /// Delete an important date.
    /// </summary>
    /// <param name="id">Important date ID</param>
    /// <param name="ct">Cancellation token</param>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id, CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        // Verify the important date exists before deleting
        var existingDate = await importantDateService.GetDateAsync(id, householdId, ct);
        if (existingDate == null)
        {
            return NotFound();
        }

        await importantDateService.DeleteDateAsync(id, householdId, ct);

        TempData["Success"] = "Important date deleted successfully.";
        return RedirectToAction(nameof(Index));
    }

    /// <summary>
    /// Populate dropdown lists for family members and date types.
    /// </summary>
    private async Task PopulateDropdownsAsync(CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var members = await familyMemberService.GetFamilyMembersAsync(householdId, ct);

        ViewData["FamilyMembers"] = new SelectList(
            members.Select(m => new { m.Id, m.FullName }),
            "Id",
            "FullName"
        );

        ViewData["DateTypes"] = new SelectList(
            Enum.GetValues<ImportantDateType>()
                .Select(d => new { Value = d.ToString(), Text = d.ToString() }),
            "Value",
            "Text"
        );
    }
}
