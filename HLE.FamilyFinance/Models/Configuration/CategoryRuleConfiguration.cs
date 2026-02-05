using HLE.FamilyFinance.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyFinance.Models.Configuration;

public class CategoryRuleConfiguration : IEntityTypeConfiguration<CategoryRule>
{
    public void Configure(EntityTypeBuilder<CategoryRule> builder)
    {
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Pattern)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(r => r.AssignPayee)
            .HasMaxLength(100);

        builder.Property(r => r.Notes)
            .HasMaxLength(500);

        builder.Property(r => r.CreatedAt)
            .HasColumnType("timestamptz");

        builder.Property(r => r.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(r => r.LastMatchedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(r => r.Household)
            .WithMany()
            .HasForeignKey(r => r.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.Category)
            .WithMany()
            .HasForeignKey(r => r.CategoryId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(r => r.HouseholdId);
        builder.HasIndex(r => new { r.HouseholdId, r.Priority });
    }
}
