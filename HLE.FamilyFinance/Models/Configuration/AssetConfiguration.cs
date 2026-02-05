using HLE.FamilyFinance.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyFinance.Models.Configuration;

public class AssetConfiguration : IEntityTypeConfiguration<Asset>
{
    public void Configure(EntityTypeBuilder<Asset> builder)
    {
        builder.HasKey(a => a.Id);

        builder.Property(a => a.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(a => a.PurchasePrice)
            .HasPrecision(18, 2);

        builder.Property(a => a.CurrentValue)
            .HasPrecision(18, 2);

        builder.Property(a => a.PropertyTaxAnnual)
            .HasPrecision(18, 2);

        // Real estate properties
        builder.Property(a => a.Address)
            .HasMaxLength(200);

        builder.Property(a => a.City)
            .HasMaxLength(100);

        builder.Property(a => a.State)
            .HasMaxLength(50);

        builder.Property(a => a.ZipCode)
            .HasMaxLength(10);

        // Vehicle properties
        builder.Property(a => a.Make)
            .HasMaxLength(50);

        builder.Property(a => a.Model)
            .HasMaxLength(50);

        builder.Property(a => a.VIN)
            .HasMaxLength(17);

        builder.Property(a => a.LicensePlate)
            .HasMaxLength(20);

        builder.Property(a => a.Icon)
            .HasMaxLength(50);

        builder.Property(a => a.Color)
            .HasMaxLength(7);

        builder.Property(a => a.CreatedAt)
            .HasColumnType("timestamptz");

        builder.Property(a => a.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(a => a.Household)
            .WithMany()
            .HasForeignKey(a => a.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.LinkedDebt)
            .WithMany(d => d.LinkedAssets)
            .HasForeignKey(a => a.LinkedDebtId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(a => a.HouseholdId);
        builder.HasIndex(a => new { a.HouseholdId, a.Type });
    }
}
