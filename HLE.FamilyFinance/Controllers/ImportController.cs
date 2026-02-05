using HLE.FamilyFinance.Extensions;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace HLE.FamilyFinance.Controllers;

[Authorize]
public class ImportController(
    IImportService importService,
    IAccountService accountService,
    ICategoryService categoryService,
    ILogger<ImportController> logger) : Controller
{
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var history = await importService.GetImportHistoryAsync(householdId, ct);

        // Find any pending imports
        var pendingBatch = history.FirstOrDefault(b => !b.IsFinalized && b.PendingCount > 0);
        ViewData["PendingBatchId"] = pendingBatch?.Id;

        await PopulateAccountsAsync(householdId, ct);
        return View(history);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Upload(int accountId, IFormFile file, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var userId = HttpContext.GetCurrentUserId();

        if (file == null || file.Length == 0)
        {
            TempData["Error"] = "Please select a file to upload.";
            return RedirectToAction(nameof(Index));
        }

        // Determine format from file extension
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var format = extension switch
        {
            ".csv" => ImportFileFormat.CSV,
            ".qfx" => ImportFileFormat.QFX,
            ".ofx" => ImportFileFormat.OFX,
            _ => (ImportFileFormat?)null
        };

        if (!format.HasValue)
        {
            TempData["Error"] = "Unsupported file format. Please upload a CSV, QFX, or OFX file.";
            return RedirectToAction(nameof(Index));
        }

        try
        {
            using var stream = file.OpenReadStream();
            var batch = await importService.ImportFileAsync(householdId, accountId, file.FileName, stream, format.Value, userId, ct);

            TempData["Success"] = $"Imported {batch.TotalRows} transactions. {batch.DuplicateCount} duplicates detected.";
            return RedirectToAction(nameof(Review), new { id = batch.Id });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error importing file {FileName}", file.FileName);
            TempData["Error"] = "An error occurred while importing the file.";
            return RedirectToAction(nameof(Index));
        }
    }

    public async Task<IActionResult> Review(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var review = await importService.GetPendingImportAsync(id, householdId, ct);

        if (review == null)
        {
            return NotFound();
        }

        await PopulateCategoriesAsync(householdId, ct);
        return View(review);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Confirm(
        int batchId,
        List<int>? selectedTransactionIds,
        List<int>? transactionIds,
        List<int?>? categoryIds,
        CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            // Build confirmation DTOs from form data
            var confirmations = new List<ImportConfirmationDto>();
            var selectedSet = new HashSet<int>(selectedTransactionIds ?? []);

            // Process all transactions in the batch
            if (transactionIds != null)
            {
                for (var i = 0; i < transactionIds.Count; i++)
                {
                    var txnId = transactionIds[i];
                    var categoryId = categoryIds != null && i < categoryIds.Count ? categoryIds[i] : null;
                    var skip = !selectedSet.Contains(txnId);

                    confirmations.Add(new ImportConfirmationDto(txnId, categoryId, null, skip));
                }
            }

            await importService.ConfirmImportAsync(batchId, householdId, confirmations, ct);
            TempData["Success"] = "Transactions imported successfully.";
            return RedirectToAction(nameof(Index));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error confirming import batch {BatchId}", batchId);
            TempData["Error"] = "An error occurred while confirming the import.";
            return RedirectToAction(nameof(Review), new { id = batchId });
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Cancel(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await importService.CancelImportAsync(id, householdId, ct);
            TempData["Success"] = "Import cancelled.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error cancelling import batch {BatchId}", id);
            TempData["Error"] = "Failed to cancel import.";
        }

        return RedirectToAction(nameof(Index));
    }

    public async Task<IActionResult> Rules(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var rules = await importService.GetCategoryRulesAsync(householdId, ct);

        await PopulateCategoriesAsync(householdId, ct);
        return View(rules);
    }

    public async Task<IActionResult> CreateRule(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        await PopulateCategoriesAsync(householdId, ct);
        PopulateMatchTypes();
        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CreateRule(CategoryRuleCreateDto model, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        if (!ModelState.IsValid)
        {
            await PopulateCategoriesAsync(householdId, ct);
            PopulateMatchTypes();
            return View(model);
        }

        try
        {
            await importService.CreateCategoryRuleAsync(householdId, model, ct);
            TempData["Success"] = "Category rule created.";
            return RedirectToAction(nameof(Rules));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error creating category rule");
            ModelState.AddModelError("", "An error occurred while creating the rule.");
            await PopulateCategoriesAsync(householdId, ct);
            PopulateMatchTypes();
            return View(model);
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteRule(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await importService.DeleteCategoryRuleAsync(id, householdId, ct);
            TempData["Success"] = "Rule deleted.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error deleting category rule {RuleId}", id);
            TempData["Error"] = "Failed to delete rule.";
        }

        return RedirectToAction(nameof(Rules));
    }

    public async Task<IActionResult> History(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var history = await importService.GetImportHistoryAsync(householdId, ct);

        return View(history.Where(b => b.IsFinalized).ToList());
    }

    private async Task PopulateAccountsAsync(int householdId, CancellationToken ct)
    {
        var accounts = await accountService.GetAccountsAsync(householdId, ct);
        ViewData["Accounts"] = new SelectList(accounts, "Id", "Name");
    }

    private async Task PopulateCategoriesAsync(int householdId, CancellationToken ct)
    {
        var categories = await categoryService.GetCategoriesAsync(householdId, ct);
        ViewData["Categories"] = new SelectList(categories, "Id", "Name");
    }

    private void PopulateMatchTypes()
    {
        ViewData["MatchTypes"] = new SelectList(
            Enum.GetValues<CategoryRuleMatchType>().Select(t => new { Value = t, Text = t.ToString() }),
            "Value", "Text");
    }
}
