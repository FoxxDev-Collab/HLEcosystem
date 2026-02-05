using HLE.FamilyHealth.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyHealth.Data.Configurations;

public class InsuranceConfiguration : IEntityTypeConfiguration<Insurance>
{
    public void Configure(EntityTypeBuilder<Insurance> builder)
    {
        builder.HasKey(i => i.Id);

        builder.Property(i => i.FamilyMemberId).IsRequired();
        builder.Property(i => i.ProviderName).IsRequired().HasMaxLength(200);
        builder.Property(i => i.PolicyNumber).IsRequired().HasMaxLength(100);
        builder.Property(i => i.GroupNumber).HasMaxLength(100);
        builder.Property(i => i.PolicyHolderName).HasMaxLength(100);
        builder.Property(i => i.InsuranceType).HasMaxLength(50);
        builder.Property(i => i.PhoneNumber).HasMaxLength(20);
        builder.Property(i => i.Website).HasMaxLength(200);

        builder.Property(i => i.Deductible).HasPrecision(10, 2);
        builder.Property(i => i.OutOfPocketMax).HasPrecision(10, 2);
        builder.Property(i => i.Copay).HasPrecision(10, 2);

        // PostgreSQL-specific: Use timestamptz for dates
        builder.Property(i => i.CreatedAt).HasColumnType("timestamptz");
        builder.Property(i => i.UpdatedAt).HasColumnType("timestamptz");

        // Indexes
        builder.HasIndex(i => new { i.FamilyMemberId, i.IsActive });
        builder.HasIndex(i => i.PolicyNumber);
    }
}
