using HLE.FamilyFinance.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyFinance.Models.Configuration;

public class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(c => c.Icon)
            .HasMaxLength(50);

        builder.Property(c => c.Color)
            .HasMaxLength(7);

        builder.Property(c => c.DefaultBudgetAmount)
            .HasPrecision(18, 2);

        builder.Property(c => c.CreatedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(c => c.Household)
            .WithMany(h => h.Categories)
            .HasForeignKey(c => c.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(c => c.ParentCategory)
            .WithMany(c => c.SubCategories)
            .HasForeignKey(c => c.ParentCategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        // Unique name within parent (or top-level if no parent)
        builder.HasIndex(c => new { c.HouseholdId, c.ParentCategoryId, c.Name })
            .IsUnique();

        builder.HasIndex(c => c.HouseholdId);
        builder.HasIndex(c => c.Type);
    }
}
