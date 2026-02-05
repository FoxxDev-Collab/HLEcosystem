using System.ComponentModel.DataAnnotations;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Services.Interfaces;

namespace HLE.FamilyFinance.Models.ViewModels;

public class BudgetPlannerIndexViewModel
{
    public BudgetPlannerProjectStatus? FilterStatus { get; set; }
    public List<BudgetPlannerProjectSummaryDto> Projects { get; set; } = [];
    public decimal TotalPlannedCost { get; set; }
    public decimal TotalAvailableBalance { get; set; }
    public decimal AffordabilityDifference => TotalAvailableBalance - TotalPlannedCost;
}

public class BudgetPlannerProjectCreateViewModel
{
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = "";

    [StringLength(500)]
    public string? Description { get; set; }

    public BudgetPlannerProjectStatus Status { get; set; } = BudgetPlannerProjectStatus.Planning;

    [Display(Name = "Target Date")]
    public DateOnly? TargetDate { get; set; }

    [StringLength(50)]
    public string? Icon { get; set; }

    [StringLength(7)]
    [RegularExpression(@"^#[0-9A-Fa-f]{6}$", ErrorMessage = "Color must be a valid hex code (e.g., #FF5733)")]
    public string? Color { get; set; }

    [StringLength(2000)]
    public string? Notes { get; set; }
}

public class BudgetPlannerProjectEditViewModel
{
    public int Id { get; set; }

    [Required]
    [StringLength(100)]
    public string Name { get; set; } = "";

    [StringLength(500)]
    public string? Description { get; set; }

    public BudgetPlannerProjectStatus Status { get; set; }

    [Display(Name = "Target Date")]
    public DateOnly? TargetDate { get; set; }

    [StringLength(50)]
    public string? Icon { get; set; }

    [StringLength(7)]
    [RegularExpression(@"^#[0-9A-Fa-f]{6}$", ErrorMessage = "Color must be a valid hex code (e.g., #FF5733)")]
    public string? Color { get; set; }

    [StringLength(2000)]
    public string? Notes { get; set; }

    public int SortOrder { get; set; }
}

public class BudgetPlannerProjectDetailsViewModel
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public BudgetPlannerProjectStatus Status { get; set; }
    public DateOnly? TargetDate { get; set; }
    public decimal TotalCost { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public List<BudgetPlannerItemDto> Items { get; set; } = [];

    // For affordability comparison
    public decimal AvailableBalance { get; set; }
    public bool CanAfford => AvailableBalance >= TotalCost;
    public decimal Shortfall => TotalCost > AvailableBalance ? TotalCost - AvailableBalance : 0;

    // For inline add item form
    public BudgetPlannerItemCreateViewModel NewItem { get; set; } = new();
}

public class BudgetPlannerItemCreateViewModel
{
    [Required]
    [StringLength(200)]
    public string Name { get; set; } = "";

    [StringLength(500)]
    public string? Description { get; set; }

    [Required]
    [Range(0.01, double.MaxValue, ErrorMessage = "Quantity must be greater than zero")]
    public decimal Quantity { get; set; } = 1;

    [Required]
    [Range(0.01, double.MaxValue, ErrorMessage = "Unit cost must be greater than zero")]
    [Display(Name = "Unit Cost")]
    public decimal UnitCost { get; set; }

    [StringLength(500)]
    [Url(ErrorMessage = "Please enter a valid URL")]
    [Display(Name = "Reference URL")]
    public string? ReferenceUrl { get; set; }
}

public class BudgetPlannerItemEditViewModel
{
    public int Id { get; set; }

    [Required]
    [StringLength(200)]
    public string Name { get; set; } = "";

    [StringLength(500)]
    public string? Description { get; set; }

    [Required]
    [Range(0.01, double.MaxValue, ErrorMessage = "Quantity must be greater than zero")]
    public decimal Quantity { get; set; } = 1;

    [Required]
    [Range(0.01, double.MaxValue, ErrorMessage = "Unit cost must be greater than zero")]
    [Display(Name = "Unit Cost")]
    public decimal UnitCost { get; set; }

    public int SortOrder { get; set; }

    [Display(Name = "Purchased")]
    public bool IsPurchased { get; set; }

    [StringLength(500)]
    [Url(ErrorMessage = "Please enter a valid URL")]
    [Display(Name = "Reference URL")]
    public string? ReferenceUrl { get; set; }
}

public class AffordabilityViewModel
{
    public decimal TotalAvailableBalance { get; set; }
    public decimal TotalPlannedCosts { get; set; }
    public decimal RemainingAfterProjects { get; set; }
    public List<BudgetPlannerProjectSummaryDto> ActiveProjects { get; set; } = [];
    public List<AffordabilityAccountDto> AccountBalances { get; set; } = [];

    public bool CanAffordAll => RemainingAfterProjects >= 0;
}
