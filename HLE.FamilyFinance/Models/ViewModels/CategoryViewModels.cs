using System.ComponentModel.DataAnnotations;
using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Models.ViewModels;

public class CategoryCreateViewModel
{
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = "";

    [Required]
    public CategoryType Type { get; set; }

    public int? ParentCategoryId { get; set; }

    [StringLength(50)]
    public string? Icon { get; set; }

    [StringLength(7)]
    public string? Color { get; set; }
}

public class CategoryEditViewModel
{
    public int Id { get; set; }

    [Required]
    [StringLength(100)]
    public string Name { get; set; } = "";

    [Required]
    public CategoryType Type { get; set; }

    public int? ParentCategoryId { get; set; }

    [StringLength(50)]
    public string? Icon { get; set; }

    [StringLength(7)]
    public string? Color { get; set; }
}
