using System.ComponentModel.DataAnnotations;

namespace HLE.AssetTracker.Models.ViewModels;

public record LocationTreeItemDto(
    int Id,
    string Name,
    string? Description,
    int? ParentId,
    string Path,
    int AssetCount,
    List<LocationTreeItemDto> Children
);

public class LocationIndexViewModel
{
    public List<LocationTreeItemDto> Locations { get; set; } = [];
}

public class CreateLocationViewModel
{
    public int? ParentId { get; set; }
    public string? ParentName { get; set; }

    [Required(ErrorMessage = "Location name is required")]
    [StringLength(100, ErrorMessage = "Name cannot exceed 100 characters")]
    public string Name { get; set; } = string.Empty;

    [StringLength(500, ErrorMessage = "Description cannot exceed 500 characters")]
    public string? Description { get; set; }

    public List<LocationSelectDto> AvailableParents { get; set; } = [];
}

public class EditLocationViewModel
{
    public int Id { get; set; }

    [Required(ErrorMessage = "Location name is required")]
    [StringLength(100, ErrorMessage = "Name cannot exceed 100 characters")]
    public string Name { get; set; } = string.Empty;

    [StringLength(500, ErrorMessage = "Description cannot exceed 500 characters")]
    public string? Description { get; set; }

    public int? ParentId { get; set; }
    public string? CurrentPath { get; set; }
    public int AssetCount { get; set; }

    public List<LocationSelectDto> AvailableParents { get; set; } = [];
}

public record LocationSelectDto(
    int Id,
    string Name,
    string Path,
    int Level
);
