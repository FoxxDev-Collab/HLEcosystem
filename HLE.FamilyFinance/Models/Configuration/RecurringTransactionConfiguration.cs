using HLE.FamilyFinance.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyFinance.Models.Configuration;

public class RecurringTransactionConfiguration : IEntityTypeConfiguration<RecurringTransaction>
{
    public void Configure(EntityTypeBuilder<RecurringTransaction> builder)
    {
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(r => r.Amount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(r => r.Payee)
            .HasMaxLength(200);

        builder.Property(r => r.Description)
            .HasMaxLength(500);

        builder.Property(r => r.StartDate)
            .HasColumnType("date")
            .IsRequired();

        builder.Property(r => r.EndDate)
            .HasColumnType("date");

        builder.Property(r => r.NextOccurrence)
            .HasColumnType("date")
            .IsRequired();

        builder.Property(r => r.LastProcessed)
            .HasColumnType("date");

        builder.Property(r => r.CreatedAt)
            .HasColumnType("timestamptz");

        builder.Property(r => r.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(r => r.Household)
            .WithMany(h => h.RecurringTransactions)
            .HasForeignKey(r => r.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.Account)
            .WithMany(a => a.RecurringTransactions)
            .HasForeignKey(r => r.AccountId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(r => r.Category)
            .WithMany(c => c.RecurringTransactions)
            .HasForeignKey(r => r.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(r => r.TransferToAccount)
            .WithMany()
            .HasForeignKey(r => r.TransferToAccountId)
            .OnDelete(DeleteBehavior.Restrict);

        // Index for finding due recurring transactions
        builder.HasIndex(r => new { r.HouseholdId, r.NextOccurrence })
            .HasFilter("\"IsActive\" = true");

        builder.HasIndex(r => r.HouseholdId);
    }
}
