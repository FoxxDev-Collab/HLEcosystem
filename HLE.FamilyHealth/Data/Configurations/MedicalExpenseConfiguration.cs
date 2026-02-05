using HLE.FamilyHealth.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyHealth.Data.Configurations;

public class MedicalExpenseConfiguration : IEntityTypeConfiguration<MedicalExpense>
{
    public void Configure(EntityTypeBuilder<MedicalExpense> builder)
    {
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Description).IsRequired().HasMaxLength(200);
        builder.Property(e => e.Category).HasMaxLength(100);
        builder.Property(e => e.ReceiptPath).HasMaxLength(500);

        // Cost fields
        builder.Property(e => e.Amount).HasPrecision(10, 2);
        builder.Property(e => e.InsuranceReimbursement).HasPrecision(10, 2);

        // PostgreSQL-specific: Use timestamptz for timestamps
        builder.Property(e => e.CreatedAt).HasColumnType("timestamptz");
        builder.Property(e => e.UpdatedAt).HasColumnType("timestamptz");

        // Relationship
        builder.HasOne(e => e.FamilyMember)
            .WithMany()
            .HasForeignKey(e => e.FamilyMemberId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes for query performance
        builder.HasIndex(e => e.FamilyMemberId);
        builder.HasIndex(e => e.ExpenseDate);
        builder.HasIndex(e => e.Category);
    }
}
