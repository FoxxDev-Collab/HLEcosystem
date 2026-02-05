using HLE.FamilyFinance.Extensions;
using HLE.FamilyFinance.Helpers;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace HLE.FamilyFinance.Controllers;

[Authorize]
public class BillsController(
    IBillService billService,
    IAccountService accountService,
    IDebtService debtService,
    ICategoryService categoryService,
    ILogger<BillsController> logger) : Controller
{
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var bills = await billService.GetBillsAsync(householdId, ct);
        var upcoming = await billService.GetUpcomingBillsAsync(householdId, 14, ct);

        ViewData["UpcomingBills"] = upcoming;
        return View(bills);
    }

    public async Task<IActionResult> Upcoming(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var upcoming = await billService.GetUpcomingBillsAsync(householdId, 30, ct);

        return View(upcoming);
    }

    public async Task<IActionResult> Calendar(int? year, int? month, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var now = DateTime.UtcNow;
        year ??= now.Year;
        month ??= now.Month;

        var calendar = await billService.GetBillCalendarAsync(householdId, year.Value, month.Value, ct);

        ViewData["Year"] = year;
        ViewData["Month"] = month;
        ViewData["MonthName"] = new DateTime(year.Value, month.Value, 1).ToString("MMMM yyyy");

        return View(calendar);
    }

    public async Task<IActionResult> Details(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var bill = await billService.GetBillAsync(id, householdId, ct);

        if (bill == null)
        {
            return NotFound();
        }

        var paymentHistory = await billService.GetPaymentHistoryAsync(id, householdId, ct);
        ViewData["PaymentHistory"] = paymentHistory;

        return View(bill);
    }

    public async Task<IActionResult> Create(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        await PopulateDropdownsAsync(householdId, ct);
        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(BillCreateDto model, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        if (!ModelState.IsValid)
        {
            await PopulateDropdownsAsync(householdId, ct);
            return View(model);
        }

        try
        {
            var bill = await billService.CreateBillAsync(householdId, model, ct);
            TempData["Success"] = "Bill created successfully.";
            return RedirectToAction(nameof(Details), new { id = bill.Id });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error creating bill");
            ModelState.AddModelError("", "An error occurred while creating the bill.");
            await PopulateDropdownsAsync(householdId, ct);
            return View(model);
        }
    }

    public async Task<IActionResult> Edit(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var bill = await billService.GetBillAsync(id, householdId, ct);

        if (bill == null)
        {
            return NotFound();
        }

        var model = new BillCreateDto(
            bill.Name,
            bill.Payee,
            bill.Category,
            bill.ExpectedAmount,
            bill.IsVariableAmount,
            bill.DueDayOfMonth,
            bill.AutoPay,
            bill.AutoPayAccountId,
            bill.LinkedDebtId,
            bill.DefaultCategoryId,
            bill.Icon,
            bill.Color,
            bill.WebsiteUrl,
            bill.Notes
        );

        ViewData["BillId"] = id;
        await PopulateDropdownsAsync(householdId, ct);
        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, BillCreateDto model, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        if (!ModelState.IsValid)
        {
            ViewData["BillId"] = id;
            await PopulateDropdownsAsync(householdId, ct);
            return View(model);
        }

        try
        {
            await billService.UpdateBillAsync(id, householdId, model, ct);
            TempData["Success"] = "Bill updated successfully.";
            return RedirectToAction(nameof(Details), new { id });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error updating bill {BillId}", id);
            ModelState.AddModelError("", "An error occurred while updating the bill.");
            ViewData["BillId"] = id;
            await PopulateDropdownsAsync(householdId, ct);
            return View(model);
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> MarkPaid(int paymentId, decimal? amountPaid, string? confirmationNumber, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await billService.MarkAsPaidAsync(paymentId, householdId, amountPaid, confirmationNumber, ct);
            TempData["Success"] = "Bill marked as paid.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error marking payment {PaymentId} as paid", paymentId);
            TempData["Error"] = "Failed to mark bill as paid.";
        }

        return RedirectToAction(nameof(Upcoming));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Deactivate(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await billService.DeactivateBillAsync(id, householdId, ct);
            TempData["Success"] = "Bill deactivated.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error deactivating bill {BillId}", id);
            TempData["Error"] = "Failed to deactivate bill.";
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
            await billService.DeleteBillAsync(id, householdId, ct);
            TempData["Success"] = "Bill deleted.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error deleting bill {BillId}", id);
            TempData["Error"] = "Failed to delete bill.";
        }

        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> GenerateMonthlyPayments(int year, int month, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await billService.GenerateMonthlyPaymentsAsync(householdId, year, month, ct);
            TempData["Success"] = $"Generated bill payments for {new DateTime(year, month, 1):MMMM yyyy}.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error generating monthly payments");
            TempData["Error"] = "Failed to generate monthly payments.";
        }

        return RedirectToAction(nameof(Calendar), new { year, month });
    }

    private async Task PopulateDropdownsAsync(int householdId, CancellationToken ct)
    {
        ViewData["BillCategories"] = new SelectList(
            Enum.GetValues<BillCategory>().Select(t => new { Value = t, Text = FormatEnumName(t.ToString()) }),
            "Value", "Text");

        var accounts = await accountService.GetAccountsAsync(householdId, ct);
        ViewData["Accounts"] = new SelectList(accounts, "Id", "Name");

        var debts = await debtService.GetDebtsAsync(householdId, ct);
        ViewData["Debts"] = new SelectList(debts, "Id", "Name");

        var categories = await categoryService.GetCategoriesAsync(householdId, ct);
        ViewData["Categories"] = new SelectList(categories, "Id", "Name");
    }

    private static string FormatEnumName(string name)
    {
        return string.Concat(name.Select((c, i) => i > 0 && char.IsUpper(c) ? " " + c : c.ToString()));
    }
}
