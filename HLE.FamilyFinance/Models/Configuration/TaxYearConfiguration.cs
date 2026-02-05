using HLE.FamilyFinance.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyFinance.Models.Configuration;

public class TaxYearConfiguration : IEntityTypeConfiguration<TaxYear>
{
    public void Configure(EntityTypeBuilder<TaxYear> builder)
    {
        builder.HasKey(t => t.Id);

        builder.Property(t => t.State)
            .HasMaxLength(50);

        builder.Property(t => t.FederalRefund)
            .HasPrecision(18, 2);

        builder.Property(t => t.StateRefund)
            .HasPrecision(18, 2);

        builder.Property(t => t.Notes)
            .HasMaxLength(1000);

        builder.Property(t => t.CreatedAt)
            .HasColumnType("timestamptz");

        builder.Property(t => t.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(t => t.Household)
            .WithMany()
            .HasForeignKey(t => t.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(t => t.HouseholdId);
        builder.HasIndex(t => new { t.HouseholdId, t.Year })
            .IsUnique();
    }
}
