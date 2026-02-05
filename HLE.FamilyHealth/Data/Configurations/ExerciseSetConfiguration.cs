using HLE.FamilyHealth.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyHealth.Data.Configurations;

public class ExerciseSetConfiguration : IEntityTypeConfiguration<ExerciseSet>
{
    public void Configure(EntityTypeBuilder<ExerciseSet> builder)
    {
        builder.HasKey(s => s.Id);

        builder.Property(s => s.SetType).HasMaxLength(50).HasDefaultValue("normal");

        // Precision for decimal fields
        builder.Property(s => s.WeightLbs).HasPrecision(8, 2);
        builder.Property(s => s.DistanceMiles).HasPrecision(8, 3);
        builder.Property(s => s.Rpe).HasPrecision(3, 1);

        // Indexes
        builder.HasIndex(s => s.WorkoutExerciseId);
        builder.HasIndex(s => new { s.WorkoutExerciseId, s.SetIndex });
    }
}
