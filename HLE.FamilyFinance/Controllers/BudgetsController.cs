using System.Globalization;
using HLE.FamilyFinance.Extensions;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Models.ViewModels;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace HLE.FamilyFinance.Controllers;

[Authorize]
public class BudgetsController(
    IBudgetService budgetService,
    ICategoryService categoryService,
    ITransactionService transactionService,
    ILogger<BudgetsController> logger) : Controller
{
    public async Task<IActionResult> Index(int? year, int? month, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var now = DateTime.UtcNow;

        year ??= now.Year;
        month ??= now.Month;

        var budgets = await budgetService.GetBudgetsAsync(householdId, year.Value, month.Value, ct);
        var categories = await categoryService.GetCategoriesAsync(householdId, ct);
        var expenseCategories = categories.Where(c => c.Type == CategoryType.Expense && !c.ParentCategoryId.HasValue).ToList();

        // Get spending for each category
        var startDate = new DateOnly(year.Value, month.Value, 1);
        var endDate = startDate.AddMonths(1).AddDays(-1);

        var spendingByCategory = await transactionService.GetSpendingByCategoryAsync(
            householdId, startDate, endDate, ct);

        var viewModel = new BudgetPlanningViewModel
        {
            Year = year.Value,
            Month = month.Value,
            MonthName = CultureInfo.CurrentCulture.DateTimeFormat.GetMonthName(month.Value),
            Categories = expenseCategories.Select(c =>
            {
                var budget = budgets.FirstOrDefault(b => b.CategoryId == c.Id);
                var spent = spendingByCategory.FirstOrDefault(s => s.CategoryId == c.Id)?.Amount ?? 0;
                return new BudgetCategoryViewModel
                {
                    CategoryId = c.Id,
                    CategoryName = c.Name,
                    CategoryIcon = c.Icon,
                    CategoryColor = c.Color,
                    BudgetId = budget?.Id,
                    BudgetedAmount = budget?.Amount ?? 0,
                    SpentAmount = spent
                };
            }).ToList(),
            TotalBudgeted = budgets.Sum(b => b.Amount),
            TotalSpent = spendingByCategory.Sum(s => s.Amount)
        };

        return View(viewModel);
    }

    public async Task<IActionResult> Create(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        await PopulateDropdownsAsync(householdId, ct);
        return View(new BudgetCreateViewModel());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(BudgetCreateViewModel model, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        if (!ModelState.IsValid)
        {
            await PopulateDropdownsAsync(householdId, ct);
            return View(model);
        }

        try
        {
            await budgetService.CreateBudgetAsync(
                householdId,
                model.CategoryId,
                model.Year,
                model.Month,
                model.Amount,
                ct);

            TempData["Success"] = "Budget created successfully.";
            return RedirectToAction(nameof(Index), new { year = model.Year, month = model.Month });
        }
        catch (InvalidOperationException ex)
        {
            ModelState.AddModelError("", ex.Message);
            await PopulateDropdownsAsync(householdId, ct);
            return View(model);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error creating budget");
            ModelState.AddModelError("", "An error occurred while creating the budget.");
            await PopulateDropdownsAsync(householdId, ct);
            return View(model);
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateAmount(int id, decimal amount, int year, int month, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await budgetService.UpdateBudgetAsync(id, householdId, amount, ct);
            TempData["Success"] = "Budget updated.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error updating budget {BudgetId}", id);
            TempData["Error"] = "Failed to update budget.";
        }

        return RedirectToAction(nameof(Index), new { year, month });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SetBudget(int categoryId, decimal amount, int year, int month, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            if (amount > 0)
            {
                await budgetService.CreateBudgetAsync(householdId, categoryId, year, month, amount, ct);
            }
            TempData["Success"] = "Budget saved.";
        }
        catch (InvalidOperationException)
        {
            // Budget already exists, update it instead
            var budgets = await budgetService.GetBudgetsAsync(householdId, year, month, ct);
            var existingBudget = budgets.FirstOrDefault(b => b.CategoryId == categoryId);
            if (existingBudget != null)
            {
                await budgetService.UpdateBudgetAsync(existingBudget.Id, householdId, amount, ct);
                TempData["Success"] = "Budget updated.";
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error setting budget");
            TempData["Error"] = "Failed to set budget.";
        }

        return RedirectToAction(nameof(Index), new { year, month });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id, int year, int month, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await budgetService.DeleteBudgetAsync(id, householdId, ct);
            TempData["Success"] = "Budget removed.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error deleting budget {BudgetId}", id);
            TempData["Error"] = "Failed to delete budget.";
        }

        return RedirectToAction(nameof(Index), new { year, month });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CopyFromPreviousMonth(int year, int month, CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            await budgetService.CopyBudgetsFromPreviousMonthAsync(householdId, year, month, ct);
            TempData["Success"] = "Budgets copied from previous month.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error copying budgets from previous month");
            TempData["Error"] = "Failed to copy budgets.";
        }

        return RedirectToAction(nameof(Index), new { year, month });
    }

    public async Task<IActionResult> Trends(CancellationToken ct)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var trends = await budgetService.GetBudgetTrendsAsync(householdId, 6, ct);
        return View(trends);
    }

    private async Task PopulateDropdownsAsync(int householdId, CancellationToken ct)
    {
        var categories = await categoryService.GetCategoriesAsync(householdId, ct);
        var expenseCategories = categories.Where(c => c.Type == CategoryType.Expense);

        ViewData["Categories"] = new SelectList(expenseCategories, "Id", "Name");
    }
}
