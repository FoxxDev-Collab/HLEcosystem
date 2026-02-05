using HLE.FamilyFinance.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyFinance.Models.Configuration;

public class MonthlyBillConfiguration : IEntityTypeConfiguration<MonthlyBill>
{
    public void Configure(EntityTypeBuilder<MonthlyBill> builder)
    {
        builder.HasKey(b => b.Id);

        builder.Property(b => b.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(b => b.Payee)
            .HasMaxLength(100);

        builder.Property(b => b.ExpectedAmount)
            .HasPrecision(18, 2);

        builder.Property(b => b.Icon)
            .HasMaxLength(50);

        builder.Property(b => b.Color)
            .HasMaxLength(7);

        builder.Property(b => b.WebsiteUrl)
            .HasMaxLength(500);

        builder.Property(b => b.Notes)
            .HasMaxLength(500);

        builder.Property(b => b.CreatedAt)
            .HasColumnType("timestamptz");

        builder.Property(b => b.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(b => b.Household)
            .WithMany()
            .HasForeignKey(b => b.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(b => b.AutoPayAccount)
            .WithMany()
            .HasForeignKey(b => b.AutoPayAccountId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(b => b.LinkedDebt)
            .WithMany(d => d.LinkedBills)
            .HasForeignKey(b => b.LinkedDebtId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(b => b.DefaultCategory)
            .WithMany()
            .HasForeignKey(b => b.DefaultCategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(b => b.HouseholdId);
        builder.HasIndex(b => new { b.HouseholdId, b.DueDayOfMonth });
    }
}
