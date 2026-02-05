using System.ComponentModel.DataAnnotations;
using HLE.AssetTracker.Services.Interfaces;

namespace HLE.AssetTracker.Models.ViewModels;

public class MaintenanceIndexViewModel
{
    public MaintenanceDashboardDto Dashboard { get; set; } = null!;
}

public class MaintenanceByAssetViewModel
{
    public int AssetId { get; set; }
    public string AssetName { get; set; } = string.Empty;
    public List<MaintenanceScheduleDto> Schedules { get; set; } = [];
    public List<MaintenanceLogDto> Logs { get; set; } = [];
}

public class CreateScheduleViewModel
{
    public int AssetId { get; set; }
    public string? AssetName { get; set; }

    [Required(ErrorMessage = "Schedule name is required")]
    [StringLength(100, ErrorMessage = "Name cannot exceed 100 characters")]
    public string Name { get; set; } = string.Empty;

    [StringLength(500, ErrorMessage = "Description cannot exceed 500 characters")]
    public string? Description { get; set; }

    [Required(ErrorMessage = "Next due date is required")]
    [DataType(DataType.Date)]
    public DateOnly NextDueDate { get; set; } = DateOnly.FromDateTime(DateTime.Today.AddDays(30));

    public bool IsRecurring { get; set; }

    [Range(1, 3650, ErrorMessage = "Interval must be between 1 and 3650 days")]
    public int? IntervalDays { get; set; }

    [Range(0, 365, ErrorMessage = "Notification days must be between 0 and 365")]
    public int NotifyDaysBefore { get; set; } = 7;
}

public class EditScheduleViewModel
{
    public int Id { get; set; }
    public int AssetId { get; set; }
    public string? AssetName { get; set; }

    [Required(ErrorMessage = "Schedule name is required")]
    [StringLength(100, ErrorMessage = "Name cannot exceed 100 characters")]
    public string Name { get; set; } = string.Empty;

    [StringLength(500, ErrorMessage = "Description cannot exceed 500 characters")]
    public string? Description { get; set; }

    [Required(ErrorMessage = "Next due date is required")]
    [DataType(DataType.Date)]
    public DateOnly NextDueDate { get; set; }

    public bool IsRecurring { get; set; }

    [Range(1, 3650, ErrorMessage = "Interval must be between 1 and 3650 days")]
    public int? IntervalDays { get; set; }

    [Range(0, 365, ErrorMessage = "Notification days must be between 0 and 365")]
    public int NotifyDaysBefore { get; set; } = 7;

    public bool IsActive { get; set; } = true;
}

public class LogMaintenanceViewModel
{
    public int AssetId { get; set; }
    public string? AssetName { get; set; }
    public int? ScheduleId { get; set; }
    public string? ScheduleName { get; set; }

    [Required(ErrorMessage = "Performed date is required")]
    [DataType(DataType.Date)]
    public DateOnly PerformedAt { get; set; } = DateOnly.FromDateTime(DateTime.Today);

    [Required(ErrorMessage = "Description is required")]
    [StringLength(500, ErrorMessage = "Description cannot exceed 500 characters")]
    public string Description { get; set; } = string.Empty;

    [Range(0, 1000000, ErrorMessage = "Cost must be between 0 and 1,000,000")]
    [DataType(DataType.Currency)]
    public decimal? Cost { get; set; }

    [StringLength(1000, ErrorMessage = "Notes cannot exceed 1000 characters")]
    public string? Notes { get; set; }
}

public class MaintenanceHistoryViewModel
{
    public int? AssetId { get; set; }
    public string? AssetName { get; set; }
    public PagedResult<MaintenanceLogDto> Logs { get; set; } = null!;
}
