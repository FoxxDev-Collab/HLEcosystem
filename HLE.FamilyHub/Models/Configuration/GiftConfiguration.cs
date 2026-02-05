using HLE.FamilyHub.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyHub.Models.Configuration;

/// <summary>
/// Entity Framework Core configuration for Gift entity
/// </summary>
public class GiftConfiguration : IEntityTypeConfiguration<Gift>
{
    public void Configure(EntityTypeBuilder<Gift> builder)
    {
        builder.HasKey(g => g.Id);

        builder.Property(g => g.Description)
            .HasMaxLength(300)
            .IsRequired();

        builder.Property(g => g.Occasion)
            .HasMaxLength(100);

        builder.Property(g => g.EstimatedCost)
            .HasPrecision(18, 2);

        builder.Property(g => g.ActualCost)
            .HasPrecision(18, 2);

        builder.Property(g => g.Notes)
            .HasMaxLength(1000);

        builder.Property(g => g.CreatedAt)
            .HasColumnType("timestamptz");

        builder.Property(g => g.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(g => g.Household)
            .WithMany()
            .HasForeignKey(g => g.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(g => g.FamilyMember)
            .WithMany(f => f.Gifts)
            .HasForeignKey(g => g.FamilyMemberId)
            .OnDelete(DeleteBehavior.Cascade);

        // Index for household queries
        builder.HasIndex(g => g.HouseholdId);

        // Index for family member queries
        builder.HasIndex(g => g.FamilyMemberId);

        // Index for date-based queries within household
        builder.HasIndex(g => new { g.HouseholdId, g.GiftDate });
    }
}
