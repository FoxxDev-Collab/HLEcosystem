using HLE.FamilyFinance.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyFinance.Models.Configuration;

public class AccountConfiguration : IEntityTypeConfiguration<Account>
{
    public void Configure(EntityTypeBuilder<Account> builder)
    {
        builder.HasKey(a => a.Id);

        builder.Property(a => a.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(a => a.Institution)
            .HasMaxLength(100);

        builder.Property(a => a.AccountNumberLast4)
            .HasMaxLength(4);

        builder.Property(a => a.InitialBalance)
            .HasPrecision(18, 2);

        builder.Property(a => a.CurrentBalance)
            .HasPrecision(18, 2);

        builder.Property(a => a.CreditLimit)
            .HasPrecision(18, 2);

        builder.Property(a => a.InterestRate)
            .HasPrecision(5, 2);

        builder.Property(a => a.HsaAnnualLimit)
            .HasPrecision(18, 2);

        builder.Property(a => a.Color)
            .HasMaxLength(7);

        builder.Property(a => a.Icon)
            .HasMaxLength(50);

        builder.Property(a => a.CreatedAt)
            .HasColumnType("timestamptz");

        builder.Property(a => a.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(a => a.Household)
            .WithMany(h => h.Accounts)
            .HasForeignKey(a => a.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(a => new { a.HouseholdId, a.Name })
            .IsUnique();

        builder.HasIndex(a => a.HouseholdId);
    }
}
