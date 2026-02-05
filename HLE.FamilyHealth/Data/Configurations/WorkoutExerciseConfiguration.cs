using HLE.FamilyHealth.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyHealth.Data.Configurations;

public class WorkoutExerciseConfiguration : IEntityTypeConfiguration<WorkoutExercise>
{
    public void Configure(EntityTypeBuilder<WorkoutExercise> builder)
    {
        builder.HasKey(e => e.Id);

        builder.Property(e => e.ExerciseName).IsRequired().HasMaxLength(200);
        builder.Property(e => e.Notes).HasMaxLength(500);

        // One-to-many with ExerciseSet
        builder.HasMany(e => e.Sets)
            .WithOne(s => s.WorkoutExercise)
            .HasForeignKey(s => s.WorkoutExerciseId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(e => e.WorkoutId);
        builder.HasIndex(e => e.ExerciseName);
        builder.HasIndex(e => new { e.WorkoutId, e.OrderIndex });
    }
}
