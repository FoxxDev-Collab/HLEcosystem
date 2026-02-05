using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace HLE.FamilyHealth.Models.ViewModels;

public class WorkoutImportViewModel
{
    [Required(ErrorMessage = "Please select a family member")]
    [Display(Name = "Family Member")]
    public int FamilyMemberId { get; set; }

    [Required(ErrorMessage = "Please select a CSV file")]
    [Display(Name = "CSV File")]
    public IFormFile? CsvFile { get; set; }

    public List<SelectListItem> FamilyMembers { get; set; } = [];
}

public record WorkoutImportPreviewWorkout
{
    public string Title { get; init; } = string.Empty;
    public DateTime StartTime { get; init; }
    public DateTime? EndTime { get; init; }
    public string? Description { get; init; }
    public int ExerciseCount { get; init; }
    public int TotalSets { get; init; }
    public bool AlreadyExists { get; init; }
}

public class WorkoutImportPreviewViewModel
{
    public int FamilyMemberId { get; set; }
    public string FamilyMemberName { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public List<WorkoutImportPreviewWorkout> Workouts { get; set; } = [];
    public int NewWorkoutsCount => Workouts.Count(w => !w.AlreadyExists);
    public int ExistingWorkoutsCount => Workouts.Count(w => w.AlreadyExists);
    public int TotalExercises => Workouts.Where(w => !w.AlreadyExists).Sum(w => w.ExerciseCount);
    public int TotalSets => Workouts.Where(w => !w.AlreadyExists).Sum(w => w.TotalSets);
    public string? CachedDataKey { get; set; }
}

public class WorkoutImportConfirmViewModel
{
    [Required]
    public int FamilyMemberId { get; set; }

    [Required]
    public string CachedDataKey { get; set; } = string.Empty;
}

public record WorkoutImportResultViewModel
{
    public int WorkoutsImported { get; init; }
    public int ExercisesImported { get; init; }
    public int SetsImported { get; init; }
    public int WorkoutsSkipped { get; init; }
    public List<string> Errors { get; init; } = [];
    public bool Success => !Errors.Any();
}
