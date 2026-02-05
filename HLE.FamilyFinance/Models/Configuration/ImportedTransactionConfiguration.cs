using HLE.FamilyFinance.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyFinance.Models.Configuration;

public class ImportedTransactionConfiguration : IEntityTypeConfiguration<ImportedTransaction>
{
    public void Configure(EntityTypeBuilder<ImportedTransaction> builder)
    {
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Amount)
            .HasPrecision(18, 2);

        builder.Property(t => t.Description)
            .HasMaxLength(500);

        builder.Property(t => t.Payee)
            .HasMaxLength(200);

        builder.Property(t => t.CheckNumber)
            .HasMaxLength(20);

        builder.Property(t => t.ReferenceNumber)
            .HasMaxLength(100);

        builder.Property(t => t.RawData)
            .HasMaxLength(2000);

        builder.Property(t => t.Notes)
            .HasMaxLength(500);

        builder.Property(t => t.CreatedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(t => t.ImportBatch)
            .WithMany(b => b.Transactions)
            .HasForeignKey(t => t.ImportBatchId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(t => t.MatchedTransaction)
            .WithMany()
            .HasForeignKey(t => t.MatchedTransactionId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(t => t.SuggestedCategory)
            .WithMany()
            .HasForeignKey(t => t.SuggestedCategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(t => t.CreatedTransaction)
            .WithMany()
            .HasForeignKey(t => t.CreatedTransactionId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(t => t.ImportBatchId);
        builder.HasIndex(t => new { t.ImportBatchId, t.MatchStatus });
    }
}
