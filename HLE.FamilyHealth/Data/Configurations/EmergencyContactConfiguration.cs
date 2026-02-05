using HLE.FamilyHealth.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyHealth.Data.Configurations;

public class EmergencyContactConfiguration : IEntityTypeConfiguration<EmergencyContact>
{
    public void Configure(EntityTypeBuilder<EmergencyContact> builder)
    {
        builder.HasKey(e => e.Id);

        builder.Property(e => e.FamilyMemberId).IsRequired();
        builder.Property(e => e.Name).IsRequired().HasMaxLength(100);
        builder.Property(e => e.Relationship).IsRequired().HasMaxLength(50);
        builder.Property(e => e.PhoneNumber).IsRequired().HasMaxLength(20);
        builder.Property(e => e.AlternatePhone).HasMaxLength(20);
        builder.Property(e => e.Email).HasMaxLength(200);
        builder.Property(e => e.Address).HasMaxLength(500);

        // PostgreSQL-specific: Use timestamptz for dates
        builder.Property(e => e.CreatedAt).HasColumnType("timestamptz");
        builder.Property(e => e.UpdatedAt).HasColumnType("timestamptz");

        // Index for ordering by priority
        builder.HasIndex(e => new { e.FamilyMemberId, e.Priority });
    }
}
