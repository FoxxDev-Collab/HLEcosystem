using HLE.FamilyFinance.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyFinance.Models.Configuration;

public class BudgetPlannerProjectConfiguration : IEntityTypeConfiguration<BudgetPlannerProject>
{
    public void Configure(EntityTypeBuilder<BudgetPlannerProject> builder)
    {
        builder.HasKey(p => p.Id);

        builder.Property(p => p.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(p => p.Description)
            .HasMaxLength(500);

        builder.Property(p => p.TotalCost)
            .HasPrecision(18, 2);

        builder.Property(p => p.Icon)
            .HasMaxLength(50);

        builder.Property(p => p.Color)
            .HasMaxLength(7);

        builder.Property(p => p.Notes)
            .HasMaxLength(2000);

        builder.Property(p => p.CreatedAt)
            .HasColumnType("timestamptz");

        builder.Property(p => p.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(p => p.Household)
            .WithMany()
            .HasForeignKey(p => p.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(p => p.HouseholdId);
        builder.HasIndex(p => new { p.HouseholdId, p.Status });
    }
}
