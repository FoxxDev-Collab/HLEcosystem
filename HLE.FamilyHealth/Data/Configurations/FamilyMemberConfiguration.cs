using HLE.FamilyHealth.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyHealth.Data.Configurations;

public class FamilyMemberConfiguration : IEntityTypeConfiguration<FamilyMember>
{
    public void Configure(EntityTypeBuilder<FamilyMember> builder)
    {
        builder.HasKey(f => f.Id);

        builder.Property(f => f.FirstName).IsRequired().HasMaxLength(100);
        builder.Property(f => f.LastName).IsRequired().HasMaxLength(100);
        builder.Property(f => f.DateOfBirth).IsRequired();
        builder.Property(f => f.Relationship).HasMaxLength(50);
        builder.Property(f => f.Gender).HasMaxLength(20);

        // PostgreSQL-specific: Use timestamptz for dates
        builder.Property(f => f.CreatedAt).HasColumnType("timestamptz");
        builder.Property(f => f.UpdatedAt).HasColumnType("timestamptz");

        // Relationships
        builder.HasOne(f => f.HealthProfile)
            .WithOne(h => h.FamilyMember)
            .HasForeignKey<HealthProfile>(h => h.FamilyMemberId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(f => f.EmergencyContacts)
            .WithOne(e => e.FamilyMember)
            .HasForeignKey(e => e.FamilyMemberId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(f => f.InsurancePolicies)
            .WithOne(i => i.FamilyMember)
            .HasForeignKey(i => i.FamilyMemberId)
            .OnDelete(DeleteBehavior.Cascade);

        // Index for common queries
        builder.HasIndex(f => new { f.LastName, f.FirstName });
        builder.HasIndex(f => f.IsActive);
        builder.HasIndex(f => f.HouseholdId);
    }
}
