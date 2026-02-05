using HLE.FamilyHealth.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyHealth.Data.Configurations;

public class AppointmentConfiguration : IEntityTypeConfiguration<Appointment>
{
    public void Configure(EntityTypeBuilder<Appointment> builder)
    {
        builder.HasKey(a => a.Id);

        builder.Property(a => a.AppointmentType).IsRequired().HasMaxLength(100);
        builder.Property(a => a.Status).IsRequired().HasMaxLength(50);
        builder.Property(a => a.Location).HasMaxLength(200);

        // PostgreSQL-specific: Use timestamptz for timestamps
        builder.Property(a => a.AppointmentDateTime).HasColumnType("timestamptz");
        builder.Property(a => a.ReminderSentAt).HasColumnType("timestamptz");
        builder.Property(a => a.CreatedAt).HasColumnType("timestamptz");
        builder.Property(a => a.UpdatedAt).HasColumnType("timestamptz");

        // Relationships
        builder.HasOne(a => a.FamilyMember)
            .WithMany()
            .HasForeignKey(a => a.FamilyMemberId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.Provider)
            .WithMany()
            .HasForeignKey(a => a.ProviderId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(a => a.VisitSummary)
            .WithOne(v => v.Appointment)
            .HasForeignKey<VisitSummary>(v => v.AppointmentId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes for query performance
        builder.HasIndex(a => a.FamilyMemberId);
        builder.HasIndex(a => a.ProviderId);
        builder.HasIndex(a => a.AppointmentDateTime);
        builder.HasIndex(a => a.Status);
    }
}
