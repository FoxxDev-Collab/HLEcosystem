using HLE.FamilyHub.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyHub.Models.Configuration;

/// <summary>
/// Entity Framework Core configuration for Household and HouseholdMember entities
/// </summary>
public class HouseholdConfiguration : IEntityTypeConfiguration<Household>
{
    public void Configure(EntityTypeBuilder<Household> builder)
    {
        builder.HasKey(h => h.Id);

        builder.Property(h => h.Name)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(h => h.OwnerId)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(h => h.CreatedAt)
            .HasColumnType("timestamptz");

        builder.HasMany(h => h.Members)
            .WithOne(m => m.Household)
            .HasForeignKey(m => m.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(h => h.FamilyMembers)
            .WithOne(f => f.Household)
            .HasForeignKey(f => f.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

/// <summary>
/// Entity Framework Core configuration for HouseholdMember entity
/// </summary>
public class HouseholdMemberConfiguration : IEntityTypeConfiguration<HouseholdMember>
{
    public void Configure(EntityTypeBuilder<HouseholdMember> builder)
    {
        builder.HasKey(m => m.Id);

        builder.Property(m => m.UserId)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(m => m.DisplayName)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(m => m.Email)
            .HasMaxLength(255);

        builder.Property(m => m.JoinedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(m => m.Household)
            .WithMany(h => h.Members)
            .HasForeignKey(m => m.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        // Ensure a user can only be a member of a household once
        builder.HasIndex(m => new { m.HouseholdId, m.UserId })
            .IsUnique();
    }
}
