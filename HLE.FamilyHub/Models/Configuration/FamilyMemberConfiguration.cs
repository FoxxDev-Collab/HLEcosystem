using HLE.FamilyHub.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyHub.Models.Configuration;

/// <summary>
/// Entity Framework Core configuration for FamilyMember entity
/// </summary>
public class FamilyMemberConfiguration : IEntityTypeConfiguration<FamilyMember>
{
    public void Configure(EntityTypeBuilder<FamilyMember> builder)
    {
        builder.HasKey(f => f.Id);

        builder.Property(f => f.FirstName)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(f => f.LastName)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(f => f.Nickname)
            .HasMaxLength(50);

        builder.Property(f => f.RelationshipNotes)
            .HasMaxLength(200);

        builder.Property(f => f.Phone)
            .HasMaxLength(20);

        builder.Property(f => f.Email)
            .HasMaxLength(255);

        builder.Property(f => f.AddressLine1)
            .HasMaxLength(200);

        builder.Property(f => f.AddressLine2)
            .HasMaxLength(200);

        builder.Property(f => f.City)
            .HasMaxLength(100);

        builder.Property(f => f.State)
            .HasMaxLength(50);

        builder.Property(f => f.ZipCode)
            .HasMaxLength(20);

        builder.Property(f => f.Country)
            .HasMaxLength(100);

        builder.Property(f => f.ProfilePhotoUrl)
            .HasMaxLength(500);

        builder.Property(f => f.Notes)
            .HasMaxLength(2000);

        builder.Property(f => f.CreatedAt)
            .HasColumnType("timestamptz");

        builder.Property(f => f.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(f => f.Household)
            .WithMany(h => h.FamilyMembers)
            .HasForeignKey(f => f.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(f => f.ImportantDates)
            .WithOne(d => d.FamilyMember)
            .HasForeignKey(d => d.FamilyMemberId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(f => f.Gifts)
            .WithOne(g => g.FamilyMember)
            .HasForeignKey(g => g.FamilyMemberId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(f => f.GiftIdeas)
            .WithOne(i => i.FamilyMember)
            .HasForeignKey(i => i.FamilyMemberId)
            .OnDelete(DeleteBehavior.Cascade);

        // Index for household queries
        builder.HasIndex(f => f.HouseholdId);

        // Index for sorting by name within household
        builder.HasIndex(f => new { f.HouseholdId, f.LastName, f.FirstName });
    }
}
