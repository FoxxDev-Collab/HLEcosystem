using HLE.FamilyHealth.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyHealth.Data.Configurations;

public class MedicationConfiguration : IEntityTypeConfiguration<Medication>
{
    public void Configure(EntityTypeBuilder<Medication> builder)
    {
        builder.HasKey(m => m.Id);

        builder.Property(m => m.MedicationName).IsRequired().HasMaxLength(200);
        builder.Property(m => m.Dosage).HasMaxLength(100);
        builder.Property(m => m.Frequency).HasMaxLength(100);
        builder.Property(m => m.PrescribedBy).HasMaxLength(200);
        builder.Property(m => m.Pharmacy).HasMaxLength(200);

        // Cost tracking fields
        builder.Property(m => m.CostPerRefill).HasPrecision(10, 2);
        builder.Property(m => m.Copay).HasPrecision(10, 2);

        // PostgreSQL-specific: Use timestamptz for timestamps
        builder.Property(m => m.CreatedAt).HasColumnType("timestamptz");
        builder.Property(m => m.UpdatedAt).HasColumnType("timestamptz");

        // Relationship
        builder.HasOne(m => m.FamilyMember)
            .WithMany()
            .HasForeignKey(m => m.FamilyMemberId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes for query performance
        builder.HasIndex(m => m.FamilyMemberId);
        builder.HasIndex(m => m.IsActive);
        builder.HasIndex(m => m.NextRefillDate);
    }
}
