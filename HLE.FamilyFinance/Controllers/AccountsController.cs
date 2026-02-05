using HLE.FamilyFinance.Extensions;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Models.ViewModels;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace HLE.FamilyFinance.Controllers;

[Authorize]
public class AccountsController(
    IAccountService accountService,
    ILogger<AccountsController> logger) : Controller
{
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var accounts = await accountService.GetAccountsAsync(householdId, ct);
        var netWorth = await accountService.GetNetWorthAsync(householdId, ct);

        ViewData["NetWorth"] = netWorth;
        return View(accounts);
    }

    public async Task<IActionResult> Details(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var account = await accountService.GetAccountAsync(id, householdId, ct);

        if (account == null)
        {
            return NotFound();
        }

        return View(account);
    }

    public IActionResult Create()
    {
        PopulateAccountTypes();
        return View(new AccountCreateViewModel());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(AccountCreateViewModel model, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        if (!ModelState.IsValid)
        {
            PopulateAccountTypes();
            return View(model);
        }

        try
        {
            var account = await accountService.CreateAccountAsync(
                householdId,
                model.Name,
                model.Type,
                model.Institution,
                model.AccountNumber,
                model.CurrentBalance,
                model.Currency,
                model.Notes,
                model.HsaAnnualLimit,
                model.HsaFamilyCoverage,
                ct);

            TempData["Success"] = "Account created successfully.";
            return RedirectToAction(nameof(Details), new { id = account.Id });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error creating account");
            ModelState.AddModelError("", "An error occurred while creating the account.");
            PopulateAccountTypes();
            return View(model);
        }
    }

    public async Task<IActionResult> Edit(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var account = await accountService.GetAccountAsync(id, householdId, ct);

        if (account == null)
        {
            return NotFound();
        }

        var model = new AccountEditViewModel
        {
            Id = account.Id,
            Name = account.Name,
            Type = account.Type,
            Institution = account.Institution,
            AccountNumber = account.AccountNumber,
            CurrentBalance = account.CurrentBalance,
            Currency = account.Currency,
            Notes = account.Notes,
            IsArchived = account.IsArchived,
            HsaAnnualLimit = account.HsaAnnualLimit,
            HsaFamilyCoverage = account.HsaFamilyCoverage
        };

        PopulateAccountTypes();
        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, AccountEditViewModel model, CancellationToken ct)
    {
        if (id != model.Id)
        {
            return BadRequest();
        }

        var householdId = HttpContext.GetCurrentHouseholdId();

        if (!ModelState.IsValid)
        {
            PopulateAccountTypes();
            return View(model);
        }

        try
        {
            await accountService.UpdateAccountAsync(
                id,
                householdId,
                model.Name,
                model.Type,
                model.Institution,
                model.AccountNumber,
                model.Currency,
                model.Notes,
                model.HsaAnnualLimit,
                model.HsaFamilyCoverage,
                ct);

            TempData["Success"] = "Account updated successfully.";
            return RedirectToAction(nameof(Details), new { id });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error updating account {AccountId}", id);
            ModelState.AddModelError("", "An error occurred while updating the account.");
            PopulateAccountTypes();
            return View(model);
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Archive(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await accountService.ArchiveAccountAsync(id, householdId, ct);
            TempData["Success"] = "Account archived.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error archiving account {AccountId}", id);
            TempData["Error"] = "Failed to archive account.";
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
            await accountService.RestoreAccountAsync(id, householdId, ct);
            TempData["Success"] = "Account restored.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error restoring account {AccountId}", id);
            TempData["Error"] = "Failed to restore account.";
        }

        return RedirectToAction(nameof(Details), new { id });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> AdjustBalance(int id, decimal newBalance, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await accountService.AdjustBalanceAsync(id, householdId, newBalance, ct);
            TempData["Success"] = "Balance adjusted successfully.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error adjusting balance for account {AccountId}", id);
            TempData["Error"] = "Failed to adjust balance.";
        }

        return RedirectToAction(nameof(Details), new { id });
    }

    private void PopulateAccountTypes()
    {
        ViewData["AccountTypes"] = new SelectList(
            Enum.GetValues<AccountType>().Select(t => new { Value = t, Text = t.ToString() }),
            "Value", "Text");
    }
}
