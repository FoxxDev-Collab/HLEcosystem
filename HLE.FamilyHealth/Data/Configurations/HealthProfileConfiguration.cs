using HLE.FamilyHealth.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyHealth.Data.Configurations;

public class HealthProfileConfiguration : IEntityTypeConfiguration<HealthProfile>
{
    public void Configure(EntityTypeBuilder<HealthProfile> builder)
    {
        builder.HasKey(h => h.Id);

        builder.Property(h => h.FamilyMemberId).IsRequired();
        builder.Property(h => h.BloodType).HasMaxLength(10);
        builder.Property(h => h.HeightCm).HasPrecision(5, 2);
        builder.Property(h => h.WeightKg).HasPrecision(5, 2);
        builder.Property(h => h.PrimaryCareProvider).HasMaxLength(200);
        builder.Property(h => h.PreferredHospital).HasMaxLength(200);

        // PostgreSQL-specific: Use timestamptz for dates
        builder.Property(h => h.CreatedAt).HasColumnType("timestamptz");
        builder.Property(h => h.UpdatedAt).HasColumnType("timestamptz");

        // Index for quick lookup by family member
        builder.HasIndex(h => h.FamilyMemberId).IsUnique();
    }
}
