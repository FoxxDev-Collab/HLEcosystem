using HLE.FamilyFinance.Extensions;
using HLE.FamilyFinance.Helpers;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace HLE.FamilyFinance.Controllers;

[Authorize]
public class DebtsController(
    IDebtService debtService,
    IAccountService accountService,
    ILogger<DebtsController> logger) : Controller
{
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var debts = await debtService.GetDebtsAsync(householdId, ct);
        var totalDebt = await debtService.GetTotalDebtAsync(householdId, ct);

        ViewData["TotalDebt"] = totalDebt;
        return View(debts);
    }

    public async Task<IActionResult> Details(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var debt = await debtService.GetDebtAsync(id, householdId, ct);

        if (debt == null)
        {
            return NotFound();
        }

        var paymentHistory = await debtService.GetPaymentHistoryAsync(id, householdId, ct);
        var amortization = await debtService.GetAmortizationScheduleAsync(id, householdId, ct);
        var payoffDate = await debtService.GetPayoffProjectionAsync(id, householdId, ct: ct);

        ViewData["PaymentHistory"] = paymentHistory;
        ViewData["Amortization"] = amortization;
        ViewData["PayoffDate"] = payoffDate;

        return View(debt);
    }

    public async Task<IActionResult> Create(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        await PopulateDropdownsAsync(householdId, ct);
        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(DebtCreateDto model, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        if (!ModelState.IsValid)
        {
            await PopulateDropdownsAsync(householdId, ct);
            return View(model);
        }

        try
        {
            var debt = await debtService.CreateDebtAsync(householdId, model, ct);
            TempData["Success"] = "Debt created successfully.";
            return RedirectToAction(nameof(Details), new { id = debt.Id });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error creating debt");
            ModelState.AddModelError("", "An error occurred while creating the debt.");
            await PopulateDropdownsAsync(householdId, ct);
            return View(model);
        }
    }

    public async Task<IActionResult> Edit(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var debt = await debtService.GetDebtAsync(id, householdId, ct);

        if (debt == null)
        {
            return NotFound();
        }

        var model = new DebtCreateDto(
            debt.Name,
            debt.Type,
            debt.Lender,
            debt.AccountNumberLast4,
            debt.OriginalPrincipal,
            debt.CurrentBalance,
            debt.InterestRate,
            debt.TermMonths,
            debt.MinimumPayment,
            debt.PaymentDayOfMonth,
            debt.OriginationDate,
            debt.LinkedAccountId,
            debt.Icon,
            debt.Color,
            debt.Notes,
            debt.IncludeInNetWorth
        );

        ViewData["DebtId"] = id;
        await PopulateDropdownsAsync(householdId, ct);
        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, DebtCreateDto model, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        if (!ModelState.IsValid)
        {
            ViewData["DebtId"] = id;
            await PopulateDropdownsAsync(householdId, ct);
            return View(model);
        }

        try
        {
            await debtService.UpdateDebtAsync(id, householdId, model, ct);
            TempData["Success"] = "Debt updated successfully.";
            return RedirectToAction(nameof(Details), new { id });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error updating debt {DebtId}", id);
            ModelState.AddModelError("", "An error occurred while updating the debt.");
            ViewData["DebtId"] = id;
            await PopulateDropdownsAsync(householdId, ct);
            return View(model);
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> RecordPayment(int id, DebtPaymentCreateDto model, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await debtService.RecordPaymentAsync(id, householdId, model, ct);
            TempData["Success"] = "Payment recorded successfully.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error recording payment for debt {DebtId}", id);
            TempData["Error"] = "Failed to record payment.";
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
            await debtService.ArchiveDebtAsync(id, householdId, ct);
            TempData["Success"] = "Debt archived.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error archiving debt {DebtId}", id);
            TempData["Error"] = "Failed to archive debt.";
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
            await debtService.DeleteDebtAsync(id, householdId, ct);
            TempData["Success"] = "Debt deleted.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error deleting debt {DebtId}", id);
            TempData["Error"] = "Failed to delete debt.";
        }

        return RedirectToAction(nameof(Index));
    }

    private async Task PopulateDropdownsAsync(int householdId, CancellationToken ct)
    {
        ViewData["DebtTypes"] = new SelectList(
            Enum.GetValues<DebtType>().Select(t => new { Value = t, Text = FormatEnumName(t.ToString()) }),
            "Value", "Text");

        var accounts = await accountService.GetAccountsAsync(householdId, ct);
        ViewData["Accounts"] = new SelectList(accounts, "Id", "Name");
    }

    private static string FormatEnumName(string name)
    {
        return string.Concat(name.Select((c, i) => i > 0 && char.IsUpper(c) ? " " + c : c.ToString()));
    }
}
