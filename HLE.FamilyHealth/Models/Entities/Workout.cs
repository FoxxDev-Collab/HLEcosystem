using System.ComponentModel.DataAnnotations;

namespace HLE.FamilyHealth.Models.Entities;

public class Workout
{
    public int Id { get; set; }

    public int FamilyMemberId { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    public DateTime StartTime { get; set; }

    public DateTime? EndTime { get; set; }

    [MaxLength(1000)]
    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public FamilyMember FamilyMember { get; set; } = null!;
    public ICollection<WorkoutExercise> Exercises { get; set; } = [];
}
