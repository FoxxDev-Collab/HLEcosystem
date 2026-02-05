using HLE.FamilyFinance.Extensions;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace HLE.FamilyFinance.Controllers;

[Authorize]
public class TaxController(
    ITaxService taxService,
    ILogger<TaxController> logger) : Controller
{
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var taxYears = await taxService.GetTaxYearsAsync(householdId, ct);

        return View(taxYears);
    }

    public async Task<IActionResult> Details(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var taxYear = await taxService.GetTaxYearAsync(id, householdId, ct);

        if (taxYear == null)
        {
            return NotFound();
        }

        var pendingDocs = await taxService.GetPendingDocumentsAsync(id, householdId, ct);
        ViewData["PendingDocuments"] = pendingDocs;

        // Get HSA health summary for the tax year
        var healthSummary = await taxService.GetHealthSummaryAsync(householdId, taxYear.Year, ct);
        ViewData["HealthSummary"] = healthSummary;

        PopulateDocumentTypes();

        return View(taxYear);
    }

    public IActionResult Create()
    {
        PopulateDropdowns();
        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(TaxYearCreateDto model, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        if (!ModelState.IsValid)
        {
            PopulateDropdowns();
            return View(model);
        }

        try
        {
            var taxYear = await taxService.CreateTaxYearAsync(householdId, model, ct);
            TempData["Success"] = "Tax year created successfully.";
            return RedirectToAction(nameof(Details), new { id = taxYear.Id });
        }
        catch (InvalidOperationException ex)
        {
            ModelState.AddModelError("Year", ex.Message);
            PopulateDropdowns();
            return View(model);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error creating tax year");
            ModelState.AddModelError("", "An error occurred while creating the tax year.");
            PopulateDropdowns();
            return View(model);
        }
    }

    public async Task<IActionResult> Edit(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var taxYear = await taxService.GetTaxYearAsync(id, householdId, ct);

        if (taxYear == null)
        {
            return NotFound();
        }

        PopulateDropdowns();
        return View(taxYear);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, TaxYearEditDto model, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        if (!ModelState.IsValid)
        {
            var taxYear = await taxService.GetTaxYearAsync(id, householdId, ct);
            if (taxYear == null) return NotFound();
            PopulateDropdowns();
            return View(taxYear);
        }

        try
        {
            await taxService.UpdateTaxYearAsync(id, householdId, model, ct);
            TempData["Success"] = "Tax year updated successfully.";
            return RedirectToAction(nameof(Details), new { id });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error updating tax year {TaxYearId}", id);
            ModelState.AddModelError("", "An error occurred while updating the tax year.");
            var taxYear = await taxService.GetTaxYearAsync(id, householdId, ct);
            if (taxYear == null) return NotFound();
            PopulateDropdowns();
            return View(taxYear);
        }
    }

    public async Task<IActionResult> AddDocument(int taxYearId, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var taxYear = await taxService.GetTaxYearAsync(taxYearId, householdId, ct);

        if (taxYear == null)
        {
            return NotFound();
        }

        ViewData["TaxYearId"] = taxYearId;
        ViewData["TaxYear"] = taxYear.Year;
        PopulateDocumentTypes();
        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> AddDocument(int taxYearId, TaxDocumentCreateDto model, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        if (!ModelState.IsValid)
        {
            ViewData["TaxYearId"] = taxYearId;
            PopulateDocumentTypes();
            return View(model);
        }

        try
        {
            await taxService.AddDocumentAsync(taxYearId, householdId, model, ct);
            TempData["Success"] = "Document added successfully.";
            return RedirectToAction(nameof(Details), new { id = taxYearId });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error adding document to tax year {TaxYearId}", taxYearId);
            ModelState.AddModelError("", "An error occurred while adding the document.");
            ViewData["TaxYearId"] = taxYearId;
            PopulateDocumentTypes();
            return View(model);
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> MarkDocumentReceived(int documentId, int taxYearId, DateOnly receivedDate, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await taxService.MarkDocumentReceivedAsync(documentId, householdId, receivedDate, ct);
            TempData["Success"] = "Document marked as received.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error marking document {DocumentId} as received", documentId);
            TempData["Error"] = "Failed to update document status.";
        }

        return RedirectToAction(nameof(Details), new { id = taxYearId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteDocument(int documentId, int taxYearId, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await taxService.DeleteDocumentAsync(documentId, householdId, ct);
            TempData["Success"] = "Document deleted.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error deleting document {DocumentId}", documentId);
            TempData["Error"] = "Failed to delete document.";
        }

        return RedirectToAction(nameof(Details), new { id = taxYearId });
    }

    // File upload/download endpoints
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UploadDocumentFile(int documentId, int taxYearId, IFormFile file, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        if (file == null || file.Length == 0)
        {
            TempData["Error"] = "Please select a file to upload.";
            return RedirectToAction(nameof(Details), new { id = taxYearId });
        }

        try
        {
            await taxService.UploadDocumentFileAsync(documentId, householdId, file, ct);
            TempData["Success"] = "File uploaded successfully.";
        }
        catch (ArgumentException ex)
        {
            TempData["Error"] = ex.Message;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error uploading file for document {DocumentId}", documentId);
            TempData["Error"] = "Failed to upload file.";
        }

        return RedirectToAction(nameof(Details), new { id = taxYearId });
    }

    public async Task<IActionResult> DownloadDocumentFile(int documentId, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            var fileResult = await taxService.GetDocumentFileAsync(documentId, householdId, ct);

            if (fileResult == null)
            {
                return NotFound();
            }

            return File(fileResult.FileStream, fileResult.ContentType, fileResult.FileName);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error downloading file for document {DocumentId}", documentId);
            return NotFound();
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteDocumentFile(int documentId, int taxYearId, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await taxService.DeleteDocumentFileAsync(documentId, householdId, ct);
            TempData["Success"] = "File deleted.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error deleting file for document {DocumentId}", documentId);
            TempData["Error"] = "Failed to delete file.";
        }

        return RedirectToAction(nameof(Details), new { id = taxYearId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await taxService.DeleteTaxYearAsync(id, householdId, ct);
            TempData["Success"] = "Tax year deleted.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error deleting tax year {TaxYearId}", id);
            TempData["Error"] = "Failed to delete tax year.";
        }

        return RedirectToAction(nameof(Index));
    }

    private void PopulateDropdowns()
    {
        ViewData["FilingStatuses"] = new SelectList(
            Enum.GetValues<TaxFilingStatus>().Select(t => new { Value = t, Text = FormatEnumName(t.ToString()) }),
            "Value", "Text");
    }

    private void PopulateDocumentTypes()
    {
        ViewData["DocumentTypes"] = new SelectList(
            Enum.GetValues<TaxDocumentType>().Select(t => new { Value = t, Text = FormatDocumentType(t) }),
            "Value", "Text");
    }

    private static string FormatEnumName(string name)
    {
        return string.Concat(name.Select((c, i) => i > 0 && char.IsUpper(c) ? " " + c : c.ToString()));
    }

    private static string FormatDocumentType(TaxDocumentType type)
    {
        return type switch
        {
            TaxDocumentType.W2 => "W-2",
            TaxDocumentType.Form1099_INT => "1099-INT (Interest)",
            TaxDocumentType.Form1099_DIV => "1099-DIV (Dividends)",
            TaxDocumentType.Form1099_NEC => "1099-NEC (Non-Employee Compensation)",
            TaxDocumentType.Form1098 => "1098 (Mortgage Interest)",
            TaxDocumentType.Form1099_B => "1099-B (Brokerage)",
            TaxDocumentType.Form1099_R => "1099-R (Retirement)",
            TaxDocumentType.K1 => "K-1 (Partnership)",
            TaxDocumentType.Form1099_SA => "1099-SA (HSA Distributions)",
            TaxDocumentType.Form5498_SA => "5498-SA (HSA Contributions)",
            _ => "Other"
        };
    }
}
