using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace HLE.FamilyHealth.Models.ViewModels;

// List/Index DTOs
public record WorkoutListDto
{
    public int Id { get; init; }
    public int FamilyMemberId { get; init; }
    public string FamilyMemberName { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public DateTime StartTime { get; init; }
    public DateTime? EndTime { get; init; }
    public TimeSpan? Duration => EndTime.HasValue ? EndTime.Value - StartTime : null;
    public int ExerciseCount { get; init; }
    public int TotalSets { get; init; }
}

public class WorkoutIndexViewModel
{
    public List<WorkoutListDto> Workouts { get; set; } = [];
    public List<SelectListItem> FamilyMembers { get; set; } = [];
    public int? SelectedFamilyMemberId { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
}

// Detail DTOs
public record ExerciseSetDto
{
    public int Id { get; init; }
    public int SetIndex { get; init; }
    public string SetType { get; init; } = "normal";
    public decimal? WeightLbs { get; init; }
    public int? Reps { get; init; }
    public decimal? DistanceMiles { get; init; }
    public int? DurationSeconds { get; init; }
    public decimal? Rpe { get; init; }

    public string DisplayValue
    {
        get
        {
            var parts = new List<string>();
            if (WeightLbs.HasValue) parts.Add($"{WeightLbs:0.##} lbs");
            if (Reps.HasValue) parts.Add($"{Reps} reps");
            if (DistanceMiles.HasValue) parts.Add($"{DistanceMiles:0.###} mi");
            if (DurationSeconds.HasValue)
            {
                var ts = TimeSpan.FromSeconds(DurationSeconds.Value);
                parts.Add(ts.TotalHours >= 1 ? $"{ts:h\\:mm\\:ss}" : $"{ts:m\\:ss}");
            }
            if (Rpe.HasValue) parts.Add($"RPE {Rpe:0.#}");
            return parts.Count > 0 ? string.Join(" × ", parts) : "-";
        }
    }
}

public record WorkoutExerciseDto
{
    public int Id { get; init; }
    public string ExerciseName { get; init; } = string.Empty;
    public int OrderIndex { get; init; }
    public int? SupersetGroupId { get; init; }
    public string? Notes { get; init; }
    public List<ExerciseSetDto> Sets { get; init; } = [];
}

public record WorkoutDetailDto
{
    public int Id { get; init; }
    public int FamilyMemberId { get; init; }
    public string FamilyMemberName { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public DateTime StartTime { get; init; }
    public DateTime? EndTime { get; init; }
    public string? Description { get; init; }
    public TimeSpan? Duration => EndTime.HasValue ? EndTime.Value - StartTime : null;
    public List<WorkoutExerciseDto> Exercises { get; init; } = [];
}

// Create/Edit DTOs
public class WorkoutCreateDto
{
    [Required(ErrorMessage = "Please select a family member")]
    [Display(Name = "Family Member")]
    public int FamilyMemberId { get; set; }

    [Required(ErrorMessage = "Title is required")]
    [MaxLength(200)]
    [Display(Name = "Workout Title")]
    public string Title { get; set; } = string.Empty;

    [Required(ErrorMessage = "Start time is required")]
    [Display(Name = "Start Time")]
    public DateTime StartTime { get; set; } = DateTime.Now;

    [Display(Name = "End Time")]
    public DateTime? EndTime { get; set; }

    [MaxLength(1000)]
    [Display(Name = "Description")]
    [DataType(DataType.MultilineText)]
    public string? Description { get; set; }
}

public class WorkoutEditDto : WorkoutCreateDto
{
    public int Id { get; set; }
}

// Exercise Create/Edit DTOs
public class ExerciseCreateDto
{
    public int WorkoutId { get; set; }

    [Required(ErrorMessage = "Exercise name is required")]
    [MaxLength(200)]
    [Display(Name = "Exercise Name")]
    public string ExerciseName { get; set; } = string.Empty;

    [Display(Name = "Order")]
    public int OrderIndex { get; set; }

    [Display(Name = "Superset Group")]
    public int? SupersetGroupId { get; set; }

    [MaxLength(500)]
    [Display(Name = "Notes")]
    public string? Notes { get; set; }
}

public class ExerciseEditDto : ExerciseCreateDto
{
    public int Id { get; set; }
}

// Set Create/Edit DTOs
public class SetCreateDto
{
    public int WorkoutExerciseId { get; set; }

    [Display(Name = "Set Number")]
    public int SetIndex { get; set; }

    [Display(Name = "Set Type")]
    public string SetType { get; set; } = "normal";

    [Display(Name = "Weight (lbs)")]
    [Range(0, 9999.99)]
    public decimal? WeightLbs { get; set; }

    [Display(Name = "Reps")]
    [Range(0, 9999)]
    public int? Reps { get; set; }

    [Display(Name = "Distance (miles)")]
    [Range(0, 999.999)]
    public decimal? DistanceMiles { get; set; }

    [Display(Name = "Duration (seconds)")]
    [Range(0, 86400)]
    public int? DurationSeconds { get; set; }

    [Display(Name = "RPE (1-10)")]
    [Range(1, 10)]
    public decimal? Rpe { get; set; }
}

public class SetEditDto : SetCreateDto
{
    public int Id { get; set; }
}

// ==================== Stats ViewModels ====================

public class WorkoutStatsViewModel
{
    // Filter properties
    public int? SelectedFamilyMemberId { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string? SelectedExercise { get; set; }
    public List<SelectListItem> FamilyMembers { get; set; } = [];
    public List<SelectListItem> Exercises { get; set; } = [];

    // Summary stats
    public int TotalWorkouts { get; set; }
    public int TotalExercises { get; set; }
    public int TotalSets { get; set; }
    public int TotalDurationMinutes { get; set; }
    public decimal TotalVolume { get; set; } // weight x reps

    // Formatted duration display
    public string TotalDurationFormatted
    {
        get
        {
            var hours = TotalDurationMinutes / 60;
            var minutes = TotalDurationMinutes % 60;
            return hours > 0 ? $"{hours}h {minutes}m" : $"{minutes}m";
        }
    }

    // Chart data
    public List<ChartDataPoint> WorkoutFrequencyData { get; set; } = [];
    public List<ChartDataPoint> TopExercisesData { get; set; } = [];
    public List<ExerciseProgressionDataPoint> ExerciseProgressionData { get; set; } = [];
    public List<ChartDataPoint> VolumeTrendsData { get; set; } = [];
    public List<ChartDataPoint> DurationTrendsData { get; set; } = [];

    // Exercise-specific stats (when an exercise is selected)
    public ExerciseStatsDto? ExerciseStats { get; set; }

    // Flag to indicate if there's any data
    public bool HasData => TotalWorkouts > 0;
    public bool HasExerciseSelected => !string.IsNullOrEmpty(SelectedExercise) && ExerciseStats != null;
}

public record ChartDataPoint
{
    public string Label { get; init; } = string.Empty;
    public decimal Value { get; init; }
}

public record ExerciseProgressionDataPoint
{
    public string Date { get; init; } = string.Empty;
    public decimal? MaxWeight { get; init; }
    public int? MaxReps { get; init; }
}

public class ExerciseStatsDto
{
    public string ExerciseName { get; set; } = string.Empty;

    // Summary stats
    public int TimesPerformed { get; set; }
    public int TotalSets { get; set; }
    public int TotalReps { get; set; }
    public decimal TotalVolume { get; set; } // weight x reps

    // Personal Records
    public decimal? WeightPR { get; set; }
    public DateTime? WeightPRDate { get; set; }
    public int? MaxRepsAtPRWeight { get; set; }

    public int? RepsPR { get; set; } // Most reps in a single set (any weight)
    public DateTime? RepsPRDate { get; set; }
    public decimal? WeightAtRepsPR { get; set; }

    // Volume PR (single session)
    public decimal? SessionVolumePR { get; set; }
    public DateTime? SessionVolumePRDate { get; set; }

    // Averages
    public decimal? AverageWeight { get; set; }
    public decimal? AverageRepsPerSet { get; set; }

    // Recent performance (last 5 sessions)
    public decimal? RecentAverageWeight { get; set; }
    public string Trend { get; set; } = "stable"; // "improving", "declining", "stable"
    public decimal? TrendPercentage { get; set; }

    // First and last performed
    public DateTime? FirstPerformed { get; set; }
    public DateTime? LastPerformed { get; set; }

    // Formatted displays
    public string WeightPRDisplay => WeightPR.HasValue ? $"{WeightPR:0.##} lbs × {MaxRepsAtPRWeight}" : "-";
    public string RepsPRDisplay => RepsPR.HasValue ? $"{RepsPR} reps @ {WeightAtRepsPR:0.##} lbs" : "-";
    public string TrendDisplay => Trend switch
    {
        "improving" => $"↑ {TrendPercentage:0.#}%",
        "declining" => $"↓ {Math.Abs(TrendPercentage ?? 0):0.#}%",
        _ => "→ Stable"
    };
}
