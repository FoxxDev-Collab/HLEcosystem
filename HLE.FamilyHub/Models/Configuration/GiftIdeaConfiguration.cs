using HLE.FamilyHub.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyHub.Models.Configuration;

/// <summary>
/// Entity Framework Core configuration for GiftIdea entity
/// </summary>
public class GiftIdeaConfiguration : IEntityTypeConfiguration<GiftIdea>
{
    public void Configure(EntityTypeBuilder<GiftIdea> builder)
    {
        builder.HasKey(i => i.Id);

        builder.Property(i => i.Idea)
            .HasMaxLength(300)
            .IsRequired();

        builder.Property(i => i.Source)
            .HasMaxLength(200);

        builder.Property(i => i.EstimatedCost)
            .HasPrecision(18, 2);

        builder.Property(i => i.Url)
            .HasMaxLength(500);

        builder.Property(i => i.Notes)
            .HasMaxLength(1000);

        builder.Property(i => i.CreatedAt)
            .HasColumnType("timestamptz");

        builder.Property(i => i.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(i => i.Household)
            .WithMany()
            .HasForeignKey(i => i.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        // SetNull allows ideas to remain when family member is deleted
        builder.HasOne(i => i.FamilyMember)
            .WithMany(f => f.GiftIdeas)
            .HasForeignKey(i => i.FamilyMemberId)
            .OnDelete(DeleteBehavior.SetNull);

        // Index for household queries
        builder.HasIndex(i => i.HouseholdId);

        // Index for family member queries
        builder.HasIndex(i => i.FamilyMemberId);

        // Index for status-based queries within household
        builder.HasIndex(i => new { i.HouseholdId, i.Status });
    }
}
