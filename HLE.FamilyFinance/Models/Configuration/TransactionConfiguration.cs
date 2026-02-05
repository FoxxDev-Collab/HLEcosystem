using HLE.FamilyFinance.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyFinance.Models.Configuration;

public class TransactionConfiguration : IEntityTypeConfiguration<Transaction>
{
    public void Configure(EntityTypeBuilder<Transaction> builder)
    {
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Amount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(t => t.Date)
            .HasColumnType("date")
            .IsRequired();

        builder.Property(t => t.Payee)
            .HasMaxLength(200);

        builder.Property(t => t.Description)
            .HasMaxLength(500);

        builder.Property(t => t.Tags)
            .HasColumnType("text[]");

        builder.Property(t => t.CreatedByUserId)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(t => t.CreatedAt)
            .HasColumnType("timestamptz");

        builder.Property(t => t.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(t => t.Household)
            .WithMany(h => h.Transactions)
            .HasForeignKey(t => t.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(t => t.Account)
            .WithMany(a => a.Transactions)
            .HasForeignKey(t => t.AccountId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(t => t.Category)
            .WithMany(c => c.Transactions)
            .HasForeignKey(t => t.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(t => t.TransferToAccount)
            .WithMany()
            .HasForeignKey(t => t.TransferToAccountId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(t => t.LinkedTransaction)
            .WithOne()
            .HasForeignKey<Transaction>(t => t.LinkedTransactionId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(t => t.RecurringTransaction)
            .WithMany(r => r.GeneratedTransactions)
            .HasForeignKey(t => t.RecurringTransactionId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes for common queries
        builder.HasIndex(t => new { t.HouseholdId, t.Date });
        builder.HasIndex(t => new { t.AccountId, t.Date });
        builder.HasIndex(t => new { t.CategoryId, t.Date });
        builder.HasIndex(t => t.Date);
    }
}
