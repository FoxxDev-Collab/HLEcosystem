using HLE.FamilyHub.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyHub.Models.Configuration;

/// <summary>
/// Entity Framework Core configuration for ImportantDate entity
/// </summary>
public class ImportantDateConfiguration : IEntityTypeConfiguration<ImportantDate>
{
    public void Configure(EntityTypeBuilder<ImportantDate> builder)
    {
        builder.HasKey(d => d.Id);

        builder.Property(d => d.Label)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(d => d.Notes)
            .HasMaxLength(1000);

        builder.Property(d => d.CreatedAt)
            .HasColumnType("timestamptz");

        // Household relationship - no navigation collection on Household
        builder.HasOne(d => d.Household)
            .WithMany()
            .HasForeignKey(d => d.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        // Family member relationship - with navigation collection
        builder.HasOne(d => d.FamilyMember)
            .WithMany(f => f.ImportantDates)
            .HasForeignKey(d => d.FamilyMemberId)
            .OnDelete(DeleteBehavior.Cascade);

        // Index for household queries
        builder.HasIndex(d => d.HouseholdId);

        // Index for date-based queries within household
        builder.HasIndex(d => new { d.HouseholdId, d.Date });

        // Index for family member queries
        builder.HasIndex(d => d.FamilyMemberId);
    }
}
