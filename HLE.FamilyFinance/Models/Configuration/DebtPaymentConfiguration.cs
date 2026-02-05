using HLE.FamilyFinance.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyFinance.Models.Configuration;

public class DebtPaymentConfiguration : IEntityTypeConfiguration<DebtPayment>
{
    public void Configure(EntityTypeBuilder<DebtPayment> builder)
    {
        builder.HasKey(p => p.Id);

        builder.Property(p => p.TotalAmount)
            .HasPrecision(18, 2);

        builder.Property(p => p.PrincipalAmount)
            .HasPrecision(18, 2);

        builder.Property(p => p.InterestAmount)
            .HasPrecision(18, 2);

        builder.Property(p => p.EscrowAmount)
            .HasPrecision(18, 2);

        builder.Property(p => p.ExtraPrincipal)
            .HasPrecision(18, 2);

        builder.Property(p => p.RemainingBalance)
            .HasPrecision(18, 2);

        builder.Property(p => p.Notes)
            .HasMaxLength(500);

        builder.Property(p => p.CreatedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(p => p.Debt)
            .WithMany(d => d.Payments)
            .HasForeignKey(p => p.DebtId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(p => p.LinkedTransaction)
            .WithMany()
            .HasForeignKey(p => p.LinkedTransactionId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(p => p.DebtId);
        builder.HasIndex(p => new { p.DebtId, p.PaymentDate });
    }
}
