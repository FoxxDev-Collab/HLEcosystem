using HLE.FamilyHealth.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyHealth.Data.Configurations;

public class WorkoutConfiguration : IEntityTypeConfiguration<Workout>
{
    public void Configure(EntityTypeBuilder<Workout> builder)
    {
        builder.HasKey(w => w.Id);

        builder.Property(w => w.Title).IsRequired().HasMaxLength(200);
        builder.Property(w => w.Description).HasMaxLength(1000);

        // PostgreSQL-specific: Use timestamptz for dates
        builder.Property(w => w.StartTime).HasColumnType("timestamptz").IsRequired();
        builder.Property(w => w.EndTime).HasColumnType("timestamptz");
        builder.Property(w => w.CreatedAt).HasColumnType("timestamptz");
        builder.Property(w => w.UpdatedAt).HasColumnType("timestamptz");

        // Foreign key to FamilyMember
        builder.HasOne(w => w.FamilyMember)
            .WithMany()
            .HasForeignKey(w => w.FamilyMemberId)
            .OnDelete(DeleteBehavior.Cascade);

        // One-to-many with WorkoutExercise
        builder.HasMany(w => w.Exercises)
            .WithOne(e => e.Workout)
            .HasForeignKey(e => e.WorkoutId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes for common queries
        builder.HasIndex(w => w.FamilyMemberId);
        builder.HasIndex(w => w.StartTime);
        builder.HasIndex(w => new { w.FamilyMemberId, w.StartTime });
    }
}
