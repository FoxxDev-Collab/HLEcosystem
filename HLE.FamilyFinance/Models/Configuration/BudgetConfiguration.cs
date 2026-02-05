using HLE.FamilyFinance.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyFinance.Models.Configuration;

public class BudgetConfiguration : IEntityTypeConfiguration<Budget>
{
    public void Configure(EntityTypeBuilder<Budget> builder)
    {
        builder.HasKey(b => b.Id);

        builder.Property(b => b.Amount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(b => b.Notes)
            .HasMaxLength(500);

        builder.Property(b => b.CreatedAt)
            .HasColumnType("timestamptz");

        builder.Property(b => b.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(b => b.Household)
            .WithMany(h => h.Budgets)
            .HasForeignKey(b => b.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(b => b.Category)
            .WithMany(c => c.Budgets)
            .HasForeignKey(b => b.CategoryId)
            .OnDelete(DeleteBehavior.Cascade);

        // Unique constraint: one budget per category per month
        builder.HasIndex(b => new { b.HouseholdId, b.CategoryId, b.Year, b.Month })
            .IsUnique();

        builder.HasIndex(b => new { b.HouseholdId, b.Year, b.Month });
    }
}
