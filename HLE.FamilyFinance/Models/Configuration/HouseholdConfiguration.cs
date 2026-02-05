using HLE.FamilyFinance.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyFinance.Models.Configuration;

public class HouseholdConfiguration : IEntityTypeConfiguration<Household>
{
    public void Configure(EntityTypeBuilder<Household> builder)
    {
        builder.HasKey(h => h.Id);

        builder.Property(h => h.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(h => h.OwnerId)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(h => h.CreatedAt)
            .HasColumnType("timestamptz");

        builder.HasIndex(h => h.OwnerId);
    }
}

public class HouseholdMemberConfiguration : IEntityTypeConfiguration<HouseholdMember>
{
    public void Configure(EntityTypeBuilder<HouseholdMember> builder)
    {
        builder.HasKey(m => m.Id);

        builder.Property(m => m.UserId)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(m => m.DisplayName)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(m => m.Email)
            .HasMaxLength(255);

        builder.Property(m => m.JoinedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(m => m.Household)
            .WithMany(h => h.Members)
            .HasForeignKey(m => m.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        // Each user can only be a member of a household once
        builder.HasIndex(m => new { m.HouseholdId, m.UserId })
            .IsUnique();

        // Index for finding all households a user belongs to
        builder.HasIndex(m => m.UserId);
    }
}
