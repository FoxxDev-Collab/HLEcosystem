using HLE.FamilyFinance.Extensions;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Models.ViewModels;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace HLE.FamilyFinance.Controllers;

[Authorize]
public class RecurringTransactionsController(
    IRecurringTransactionService recurringService,
    IAccountService accountService,
    ICategoryService categoryService,
    ILogger<RecurringTransactionsController> logger) : Controller
{
    public async Task<IActionResult> Index(bool includeInactive = false, CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var recurring = await recurringService.GetRecurringTransactionsAsync(householdId, includeInactive, ct);

        ViewData["IncludeInactive"] = includeInactive;
        return View(recurring);
    }

    public async Task<IActionResult> Upcoming(int days = 30, CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var upcoming = await recurringService.GetUpcomingTransactionsAsync(householdId, days, ct);

        ViewData["Days"] = days;
        return View(upcoming);
    }

    public async Task<IActionResult> Create(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        await PopulateDropdownsAsync(householdId, ct);
        return View(new RecurringTransactionCreateViewModel());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(RecurringTransactionCreateViewModel model, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        if (!ModelState.IsValid)
        {
            await PopulateDropdownsAsync(householdId, ct);
            return View(model);
        }

        try
        {
            var recurring = await recurringService.CreateRecurringTransactionAsync(
                householdId,
                model.Name,
                model.Type,
                model.AccountId,
                model.CategoryId,
                model.Amount,
                model.Payee,
                model.Description,
                model.Frequency,
                model.FrequencyInterval,
                model.DayOfPeriod,
                model.StartDate,
                model.EndDate,
                model.AutoCreate,
                model.TransferToAccountId,
                ct);

            TempData["Success"] = "Recurring transaction created successfully.";
            return RedirectToAction(nameof(Index));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error creating recurring transaction");
            ModelState.AddModelError("", "An error occurred while creating the recurring transaction.");
            await PopulateDropdownsAsync(householdId, ct);
            return View(model);
        }
    }

    public async Task<IActionResult> Edit(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var recurring = await recurringService.GetRecurringTransactionAsync(id, householdId, ct);

        if (recurring == null)
        {
            return NotFound();
        }

        var model = new RecurringTransactionEditViewModel
        {
            Id = recurring.Id,
            Name = recurring.Name,
            AccountId = recurring.AccountId,
            CategoryId = recurring.CategoryId,
            Amount = recurring.Amount,
            Payee = recurring.Payee,
            Description = recurring.Description,
            Frequency = recurring.Frequency,
            FrequencyInterval = recurring.FrequencyInterval,
            DayOfPeriod = recurring.DayOfPeriod,
            EndDate = recurring.EndDate,
            AutoCreate = recurring.AutoCreate,
            IsActive = recurring.IsActive
        };

        await PopulateDropdownsAsync(householdId, ct);
        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, RecurringTransactionEditViewModel model, CancellationToken ct)
    {
        if (id != model.Id)
        {
            return BadRequest();
        }

        var householdId = HttpContext.GetCurrentHouseholdId();

        if (!ModelState.IsValid)
        {
            await PopulateDropdownsAsync(householdId, ct);
            return View(model);
        }

        try
        {
            await recurringService.UpdateRecurringTransactionAsync(
                id,
                householdId,
                model.Name,
                model.AccountId,
                model.CategoryId,
                model.Amount,
                model.Payee,
                model.Description,
                model.Frequency,
                model.FrequencyInterval,
                model.DayOfPeriod,
                model.EndDate,
                model.AutoCreate,
                model.IsActive,
                ct);

            TempData["Success"] = "Recurring transaction updated successfully.";
            return RedirectToAction(nameof(Index));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error updating recurring transaction {RecurringId}", id);
            ModelState.AddModelError("", "An error occurred while updating the recurring transaction.");
            await PopulateDropdownsAsync(householdId, ct);
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
            await recurringService.DeleteRecurringTransactionAsync(id, householdId, ct);
            TempData["Success"] = "Recurring transaction deleted.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error deleting recurring transaction {RecurringId}", id);
            TempData["Error"] = "Failed to delete recurring transaction.";
        }

        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Skip(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await recurringService.SkipNextOccurrenceAsync(id, householdId, ct);
            TempData["Success"] = "Next occurrence skipped.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error skipping occurrence for recurring transaction {RecurringId}", id);
            TempData["Error"] = "Failed to skip occurrence.";
        }

        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ProcessDue(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var userId = HttpContext.GetCurrentUserId();

        try
        {
            await recurringService.ProcessDueRecurringTransactionsAsync(householdId, userId, ct);
            TempData["Success"] = "Due recurring transactions processed.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error processing due recurring transactions");
            TempData["Error"] = "Failed to process recurring transactions.";
        }

        return RedirectToAction(nameof(Index));
    }

    private async Task PopulateDropdownsAsync(int householdId, CancellationToken ct)
    {
        var accounts = await accountService.GetAccountsAsync(householdId, ct);
        var categories = await categoryService.GetCategoriesAsync(householdId, ct);

        ViewData["Accounts"] = new SelectList(accounts, "Id", "Name");
        ViewData["Categories"] = new SelectList(
            categories.Select(c => new { c.Id, Name = c.ParentCategoryId.HasValue ? $"  - {c.Name}" : c.Name }),
            "Id", "Name");
        ViewData["TransactionTypes"] = new SelectList(
            Enum.GetValues<TransactionType>().Where(t => t != TransactionType.Transfer)
                .Select(t => new { Value = t, Text = t.ToString() }),
            "Value", "Text");
        ViewData["Frequencies"] = new SelectList(
            Enum.GetValues<RecurrenceFrequency>().Select(f => new { Value = f, Text = f.ToString() }),
            "Value", "Text");
    }
}
