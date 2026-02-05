using HLE.FamilyFinance.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyFinance.Models.Configuration;

public class BudgetPlannerItemConfiguration : IEntityTypeConfiguration<BudgetPlannerItem>
{
    public void Configure(EntityTypeBuilder<BudgetPlannerItem> builder)
    {
        builder.HasKey(i => i.Id);

        builder.Property(i => i.Name)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(i => i.Description)
            .HasMaxLength(500);

        builder.Property(i => i.Quantity)
            .HasPrecision(10, 2);

        builder.Property(i => i.UnitCost)
            .HasPrecision(18, 2);

        builder.Property(i => i.LineTotal)
            .HasPrecision(18, 2);

        builder.Property(i => i.ReferenceUrl)
            .HasMaxLength(500);

        builder.Property(i => i.CreatedAt)
            .HasColumnType("timestamptz");

        builder.Property(i => i.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(i => i.Project)
            .WithMany(p => p.Items)
            .HasForeignKey(i => i.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(i => i.ProjectId);
        builder.HasIndex(i => new { i.ProjectId, i.SortOrder });
    }
}
