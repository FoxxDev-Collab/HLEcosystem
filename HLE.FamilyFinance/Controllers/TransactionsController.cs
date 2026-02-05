using HLE.FamilyFinance.Extensions;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Models.ViewModels;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace HLE.FamilyFinance.Controllers;

[Authorize]
public class TransactionsController(
    ITransactionService transactionService,
    IAccountService accountService,
    ICategoryService categoryService,
    ILogger<TransactionsController> logger) : Controller
{
    public async Task<IActionResult> Index(TransactionFilterViewModel filter, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        var filterDto = new TransactionFilterDto(
            HouseholdId: householdId,
            AccountId: filter.AccountId,
            CategoryId: filter.CategoryId,
            Type: filter.Type,
            StartDate: filter.StartDate,
            EndDate: filter.EndDate,
            SearchTerm: filter.Search,
            Page: filter.Page,
            PageSize: 25,
            SortBy: filter.SortBy,
            SortDescending: filter.SortDesc
        );

        var result = await transactionService.GetTransactionsAsync(filterDto, ct);

        await PopulateDropdownsAsync(householdId, ct);
        ViewData["Filter"] = filter;

        return View(result);
    }

    public async Task<IActionResult> Details(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var transaction = await transactionService.GetTransactionAsync(id, householdId, ct);

        if (transaction == null)
        {
            return NotFound();
        }

        return View(transaction);
    }

    public async Task<IActionResult> Create(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        await PopulateDropdownsAsync(householdId, ct);
        return View(new TransactionCreateViewModel());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(TransactionCreateViewModel model, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var userId = HttpContext.GetCurrentUserId();

        if (!ModelState.IsValid)
        {
            await PopulateDropdownsAsync(householdId, ct);
            return View(model);
        }

        try
        {
            var dto = new TransactionCreateDto(
                model.AccountId,
                model.CategoryId,
                model.Type,
                model.Amount,
                model.Date,
                model.Payee,
                model.Description,
                model.TransferToAccountId
            );

            var transaction = await transactionService.CreateTransactionAsync(householdId, userId, dto, ct);

            TempData["Success"] = "Transaction created successfully.";
            return RedirectToAction(nameof(Details), new { id = transaction.Id });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error creating transaction");
            ModelState.AddModelError("", "An error occurred while creating the transaction.");
            await PopulateDropdownsAsync(householdId, ct);
            return View(model);
        }
    }

    public async Task<IActionResult> Edit(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var transaction = await transactionService.GetTransactionAsync(id, householdId, ct);

        if (transaction == null)
        {
            return NotFound();
        }

        var model = new TransactionEditViewModel
        {
            Id = transaction.Id,
            AccountId = transaction.AccountId,
            CategoryId = transaction.CategoryId,
            Type = transaction.Type,
            Amount = transaction.Amount,
            Date = transaction.Date,
            Payee = transaction.Payee,
            Description = transaction.Description
        };

        await PopulateDropdownsAsync(householdId, ct);
        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, TransactionEditViewModel model, CancellationToken ct)
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
            var dto = new TransactionUpdateDto(
                model.AccountId,
                model.CategoryId,
                model.Amount,
                model.Date,
                model.Payee,
                model.Description
            );

            await transactionService.UpdateTransactionAsync(id, householdId, dto, ct);

            TempData["Success"] = "Transaction updated successfully.";
            return RedirectToAction(nameof(Details), new { id });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error updating transaction {TransactionId}", id);
            ModelState.AddModelError("", "An error occurred while updating the transaction.");
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
            await transactionService.DeleteTransactionAsync(id, householdId, ct);
            TempData["Success"] = "Transaction deleted.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error deleting transaction {TransactionId}", id);
            TempData["Error"] = "Failed to delete transaction.";
        }

        return RedirectToAction(nameof(Index));
    }

    public async Task<IActionResult> Transfer(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        await PopulateDropdownsAsync(householdId, ct);
        return View(new TransactionCreateViewModel { Type = TransactionType.Transfer });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Transfer(TransactionCreateViewModel model, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var userId = HttpContext.GetCurrentUserId();

        if (!model.TransferToAccountId.HasValue)
        {
            ModelState.AddModelError("TransferToAccountId", "Destination account is required for transfers.");
        }

        if (!ModelState.IsValid)
        {
            await PopulateDropdownsAsync(householdId, ct);
            return View(model);
        }

        try
        {
            await transactionService.CreateTransferAsync(
                householdId,
                userId,
                model.AccountId,
                model.TransferToAccountId!.Value,
                model.Amount,
                model.Date,
                model.Description,
                ct);

            TempData["Success"] = "Transfer created successfully.";
            return RedirectToAction(nameof(Index));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error creating transfer");
            ModelState.AddModelError("", "An error occurred while creating the transfer.");
            await PopulateDropdownsAsync(householdId, ct);
            return View(model);
        }
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
            Enum.GetValues<TransactionType>().Select(t => new { Value = t, Text = t.ToString() }),
            "Value", "Text");
    }
}
