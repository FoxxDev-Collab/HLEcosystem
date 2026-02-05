using System.ComponentModel.DataAnnotations;

namespace HLE.FamilyFinance.Models.ViewModels;

public class BudgetCreateViewModel
{
    [Required]
    public int CategoryId { get; set; }

    [Required]
    [Range(1, 12)]
    public int Month { get; set; } = DateTime.Now.Month;

    [Required]
    [Range(2000, 2100)]
    public int Year { get; set; } = DateTime.Now.Year;

    [Required]
    [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be greater than zero")]
    public decimal Amount { get; set; }
}

public class BudgetEditViewModel
{
    public int Id { get; set; }

    [Required]
    public int CategoryId { get; set; }

    [Required]
    [Range(1, 12)]
    public int Month { get; set; }

    [Required]
    [Range(2000, 2100)]
    public int Year { get; set; }

    [Required]
    [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be greater than zero")]
    public decimal Amount { get; set; }
}

public class BudgetPlanningViewModel
{
    public int Year { get; set; }
    public int Month { get; set; }
    public string MonthName { get; set; } = "";
    public List<BudgetCategoryViewModel> Categories { get; set; } = [];
    public decimal TotalBudgeted { get; set; }
    public decimal TotalSpent { get; set; }
    public decimal RemainingBudget => TotalBudgeted - TotalSpent;
}

public class BudgetCategoryViewModel
{
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = "";
    public string? CategoryIcon { get; set; }
    public string? CategoryColor { get; set; }
    public int? BudgetId { get; set; }
    public decimal BudgetedAmount { get; set; }
    public decimal SpentAmount { get; set; }
    public decimal RemainingAmount => BudgetedAmount - SpentAmount;
    public decimal PercentUsed => BudgetedAmount > 0 ? (SpentAmount / BudgetedAmount) * 100 : 0;
}
