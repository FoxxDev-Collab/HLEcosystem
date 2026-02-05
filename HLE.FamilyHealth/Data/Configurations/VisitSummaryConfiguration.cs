using HLE.FamilyHealth.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyHealth.Data.Configurations;

public class VisitSummaryConfiguration : IEntityTypeConfiguration<VisitSummary>
{
    public void Configure(EntityTypeBuilder<VisitSummary> builder)
    {
        builder.HasKey(v => v.Id);

        builder.Property(v => v.ChiefComplaint).HasMaxLength(500);
        builder.Property(v => v.VisitType).HasMaxLength(100);

        // Cost tracking fields
        builder.Property(v => v.BilledAmount).HasPrecision(10, 2);
        builder.Property(v => v.InsurancePaid).HasPrecision(10, 2);
        builder.Property(v => v.OutOfPocketCost).HasPrecision(10, 2);

        // PostgreSQL-specific: Use timestamptz for timestamps
        builder.Property(v => v.VisitDate).HasColumnType("timestamptz");
        builder.Property(v => v.NextVisitRecommended).HasColumnType("timestamptz");
        builder.Property(v => v.CreatedAt).HasColumnType("timestamptz");
        builder.Property(v => v.UpdatedAt).HasColumnType("timestamptz");

        // Relationships
        builder.HasOne(v => v.FamilyMember)
            .WithMany()
            .HasForeignKey(v => v.FamilyMemberId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(v => v.Provider)
            .WithMany()
            .HasForeignKey(v => v.ProviderId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes for query performance
        builder.HasIndex(v => v.FamilyMemberId);
        builder.HasIndex(v => v.ProviderId);
        builder.HasIndex(v => v.VisitDate);
        builder.HasIndex(v => v.AppointmentId);
    }
}
