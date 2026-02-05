using System.ComponentModel.DataAnnotations;
using HLE.AssetTracker.Models.Entities;
using HLE.AssetTracker.Models.Enums;

namespace HLE.AssetTracker.Models.ViewModels;

public record CategoryListItemDto(
    int Id,
    string Name,
    string? Icon,
    string? Color,
    int AssetCount,
    int CustomFieldCount
);

public class CategoryIndexViewModel
{
    public List<CategoryListItemDto> Categories { get; set; } = [];
}

public class CreateCategoryViewModel
{
    [Required(ErrorMessage = "Category name is required")]
    [StringLength(100, ErrorMessage = "Name cannot exceed 100 characters")]
    public string Name { get; set; } = string.Empty;

    [StringLength(10, ErrorMessage = "Icon cannot exceed 10 characters")]
    public string? Icon { get; set; }

    [StringLength(7, ErrorMessage = "Color must be a valid hex code (e.g., #FF5733)")]
    [RegularExpression("^#[0-9A-Fa-f]{6}$", ErrorMessage = "Color must be a valid hex code (e.g., #FF5733)")]
    public string? Color { get; set; }
}

public class EditCategoryViewModel
{
    public int Id { get; set; }

    [Required(ErrorMessage = "Category name is required")]
    [StringLength(100, ErrorMessage = "Name cannot exceed 100 characters")]
    public string Name { get; set; } = string.Empty;

    [StringLength(10, ErrorMessage = "Icon cannot exceed 10 characters")]
    public string? Icon { get; set; }

    [StringLength(7, ErrorMessage = "Color must be a valid hex code (e.g., #FF5733)")]
    [RegularExpression("^#[0-9A-Fa-f]{6}$", ErrorMessage = "Color must be a valid hex code (e.g., #FF5733)")]
    public string? Color { get; set; }

    public int AssetCount { get; set; }
    public List<CustomFieldDefinition> CustomFields { get; set; } = [];
}

public class AddCustomFieldViewModel
{
    public int CategoryId { get; set; }

    [Required(ErrorMessage = "Field name is required")]
    [StringLength(50, ErrorMessage = "Name cannot exceed 50 characters")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Field type is required")]
    public CustomFieldType FieldType { get; set; }

    public bool IsRequired { get; set; }

    [StringLength(500, ErrorMessage = "Options cannot exceed 500 characters")]
    public string? SelectOptions { get; set; }
}

public class EditCustomFieldViewModel
{
    public int Id { get; set; }
    public int CategoryId { get; set; }

    [Required(ErrorMessage = "Field name is required")]
    [StringLength(50, ErrorMessage = "Name cannot exceed 50 characters")]
    public string Name { get; set; } = string.Empty;

    public CustomFieldType FieldType { get; set; }
    public bool IsRequired { get; set; }

    [StringLength(500, ErrorMessage = "Options cannot exceed 500 characters")]
    public string? SelectOptions { get; set; }
}
