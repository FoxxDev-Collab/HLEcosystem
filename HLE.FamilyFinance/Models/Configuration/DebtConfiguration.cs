using HLE.FamilyFinance.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyFinance.Models.Configuration;

public class DebtConfiguration : IEntityTypeConfiguration<Debt>
{
    public void Configure(EntityTypeBuilder<Debt> builder)
    {
        builder.HasKey(d => d.Id);

        builder.Property(d => d.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(d => d.Lender)
            .HasMaxLength(100);

        builder.Property(d => d.AccountNumberLast4)
            .HasMaxLength(4);

        builder.Property(d => d.OriginalPrincipal)
            .HasPrecision(18, 2);

        builder.Property(d => d.CurrentBalance)
            .HasPrecision(18, 2);

        builder.Property(d => d.InterestRate)
            .HasPrecision(5, 3);

        builder.Property(d => d.MinimumPayment)
            .HasPrecision(18, 2);

        builder.Property(d => d.Icon)
            .HasMaxLength(50);

        builder.Property(d => d.Color)
            .HasMaxLength(7);

        builder.Property(d => d.CreatedAt)
            .HasColumnType("timestamptz");

        builder.Property(d => d.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(d => d.Household)
            .WithMany()
            .HasForeignKey(d => d.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(d => d.LinkedAccount)
            .WithMany()
            .HasForeignKey(d => d.LinkedAccountId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(d => d.HouseholdId);
        builder.HasIndex(d => new { d.HouseholdId, d.Type });
    }
}
