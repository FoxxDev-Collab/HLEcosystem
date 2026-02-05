using System.ComponentModel.DataAnnotations;

namespace HLE.FamilyHealth.Models.Entities;

public class ExerciseSet
{
    public int Id { get; set; }

    public int WorkoutExerciseId { get; set; }

    public int SetIndex { get; set; }

    [MaxLength(50)]
    public string SetType { get; set; } = "normal"; // normal, warmup, failure, dropset

    public decimal? WeightLbs { get; set; }

    public int? Reps { get; set; }

    public decimal? DistanceMiles { get; set; }

    public int? DurationSeconds { get; set; }

    public decimal? Rpe { get; set; } // Rate of Perceived Exertion (1-10)

    // Navigation property
    public WorkoutExercise WorkoutExercise { get; set; } = null!;
}
