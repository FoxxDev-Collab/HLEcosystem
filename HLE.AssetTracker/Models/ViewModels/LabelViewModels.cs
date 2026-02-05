using System.ComponentModel.DataAnnotations;

namespace HLE.AssetTracker.Models.ViewModels;

public record LabelListItemDto(
    int Id,
    string Name,
    string? Color,
    int AssetCount
);

public class LabelIndexViewModel
{
    public List<LabelListItemDto> Labels { get; set; } = [];
}

public class CreateLabelViewModel
{
    [Required(ErrorMessage = "Label name is required")]
    [StringLength(50, ErrorMessage = "Name cannot exceed 50 characters")]
    public string Name { get; set; } = string.Empty;

    [StringLength(7, ErrorMessage = "Color must be a valid hex code (e.g., #FF5733)")]
    [RegularExpression("^#[0-9A-Fa-f]{6}$", ErrorMessage = "Color must be a valid hex code (e.g., #FF5733)")]
    public string? Color { get; set; }
}

public class EditLabelViewModel
{
    public int Id { get; set; }

    [Required(ErrorMessage = "Label name is required")]
    [StringLength(50, ErrorMessage = "Name cannot exceed 50 characters")]
    public string Name { get; set; } = string.Empty;

    [StringLength(7, ErrorMessage = "Color must be a valid hex code (e.g., #FF5733)")]
    [RegularExpression("^#[0-9A-Fa-f]{6}$", ErrorMessage = "Color must be a valid hex code (e.g., #FF5733)")]
    public string? Color { get; set; }

    public int AssetCount { get; set; }
}
