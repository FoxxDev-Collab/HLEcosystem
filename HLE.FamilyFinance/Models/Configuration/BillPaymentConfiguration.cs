using HLE.FamilyFinance.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyFinance.Models.Configuration;

public class BillPaymentConfiguration : IEntityTypeConfiguration<BillPayment>
{
    public void Configure(EntityTypeBuilder<BillPayment> builder)
    {
        builder.HasKey(p => p.Id);

        builder.Property(p => p.AmountDue)
            .HasPrecision(18, 2);

        builder.Property(p => p.AmountPaid)
            .HasPrecision(18, 2);

        builder.Property(p => p.ConfirmationNumber)
            .HasMaxLength(100);

        builder.Property(p => p.Notes)
            .HasMaxLength(500);

        builder.Property(p => p.CreatedAt)
            .HasColumnType("timestamptz");

        builder.Property(p => p.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(p => p.MonthlyBill)
            .WithMany(b => b.Payments)
            .HasForeignKey(p => p.MonthlyBillId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(p => p.LinkedTransaction)
            .WithMany()
            .HasForeignKey(p => p.LinkedTransactionId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(p => p.MonthlyBillId);
        builder.HasIndex(p => new { p.MonthlyBillId, p.DueDate });
        builder.HasIndex(p => p.Status);
    }
}
