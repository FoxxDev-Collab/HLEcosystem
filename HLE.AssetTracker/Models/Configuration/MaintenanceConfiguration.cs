using HLE.AssetTracker.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.AssetTracker.Models.Configuration;

public class MaintenanceScheduleConfiguration : IEntityTypeConfiguration<MaintenanceSchedule>
{
    public void Configure(EntityTypeBuilder<MaintenanceSchedule> builder)
    {
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(s => s.Description)
            .HasColumnType("text");

        builder.Property(s => s.CreatedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(s => s.Asset)
            .WithMany(a => a.MaintenanceSchedules)
            .HasForeignKey(s => s.AssetId)
            .OnDelete(DeleteBehavior.Cascade);

        // Index for querying upcoming maintenance
        builder.HasIndex(s => new { s.NextDueDate, s.IsActive });
        builder.HasIndex(s => s.AssetId);
    }
}

public class MaintenanceLogConfiguration : IEntityTypeConfiguration<MaintenanceLog>
{
    public void Configure(EntityTypeBuilder<MaintenanceLog> builder)
    {
        builder.HasKey(l => l.Id);

        builder.Property(l => l.Description)
            .HasColumnType("text")
            .IsRequired();

        builder.Property(l => l.Cost)
            .HasPrecision(18, 2);

        builder.Property(l => l.PerformedByUserId)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(l => l.Notes)
            .HasColumnType("text");

        builder.Property(l => l.CreatedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(l => l.Asset)
            .WithMany(a => a.MaintenanceLogs)
            .HasForeignKey(l => l.AssetId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(l => l.Schedule)
            .WithMany(s => s.MaintenanceLogs)
            .HasForeignKey(l => l.ScheduleId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(l => l.AssetId);
        builder.HasIndex(l => l.PerformedAt);
    }
}
