using HLE.FamilyFinance.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyFinance.Models.Configuration;

public class ImportBatchConfiguration : IEntityTypeConfiguration<ImportBatch>
{
    public void Configure(EntityTypeBuilder<ImportBatch> builder)
    {
        builder.HasKey(b => b.Id);

        builder.Property(b => b.FileName)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(b => b.ImportedByUserId)
            .HasMaxLength(100);

        builder.Property(b => b.Notes)
            .HasMaxLength(500);

        builder.Property(b => b.ImportedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(b => b.Household)
            .WithMany()
            .HasForeignKey(b => b.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(b => b.Account)
            .WithMany()
            .HasForeignKey(b => b.AccountId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(b => b.HouseholdId);
        builder.HasIndex(b => b.AccountId);
        builder.HasIndex(b => b.ImportedAt);
    }
}
