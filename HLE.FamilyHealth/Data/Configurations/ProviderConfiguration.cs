using HLE.FamilyHealth.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyHealth.Data.Configurations;

public class ProviderConfiguration : IEntityTypeConfiguration<Provider>
{
    public void Configure(EntityTypeBuilder<Provider> builder)
    {
        builder.HasKey(p => p.Id);

        builder.Property(p => p.Name).IsRequired().HasMaxLength(200);
        builder.Property(p => p.Specialty).HasMaxLength(100);
        builder.Property(p => p.Type).IsRequired().HasMaxLength(50);
        builder.Property(p => p.Address).HasMaxLength(500);
        builder.Property(p => p.PhoneNumber).HasMaxLength(20);
        builder.Property(p => p.FaxNumber).HasMaxLength(20);
        builder.Property(p => p.Email).HasMaxLength(200);
        builder.Property(p => p.Website).HasMaxLength(200);
        builder.Property(p => p.PortalUrl).HasMaxLength(200);
        builder.Property(p => p.PreferredContactMethod).HasMaxLength(100);

        // PostgreSQL-specific: Use timestamptz for dates
        builder.Property(p => p.CreatedAt).HasColumnType("timestamptz");
        builder.Property(p => p.UpdatedAt).HasColumnType("timestamptz");

        // Indexes for common queries
        builder.HasIndex(p => p.Type);
        builder.HasIndex(p => new { p.Name, p.Type });
        builder.HasIndex(p => p.IsActive);
    }
}
