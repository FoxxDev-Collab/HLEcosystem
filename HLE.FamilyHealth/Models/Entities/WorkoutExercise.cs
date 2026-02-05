using System.ComponentModel.DataAnnotations;

namespace HLE.FamilyHealth.Models.Entities;

public class WorkoutExercise
{
    public int Id { get; set; }

    public int WorkoutId { get; set; }

    [Required]
    [MaxLength(200)]
    public string ExerciseName { get; set; } = string.Empty;

    public int OrderIndex { get; set; }

    public int? SupersetGroupId { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    // Navigation properties
    public Workout Workout { get; set; } = null!;
    public ICollection<ExerciseSet> Sets { get; set; } = [];
}
