using HLE.AssetTracker.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.AssetTracker.Models.Configuration;

public class FuelLogConfiguration : IEntityTypeConfiguration<FuelLog>
{
    public void Configure(EntityTypeBuilder<FuelLog> builder)
    {
        builder.HasKey(fl => fl.Id);

        builder.Property(fl => fl.FillUpDate)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(fl => fl.Odometer)
            .IsRequired();

        builder.Property(fl => fl.Quantity)
            .HasPrecision(10, 3)
            .IsRequired();

        builder.Property(fl => fl.QuantityUnit)
            .HasMaxLength(20)
            .HasDefaultValue("Gallons");

        builder.Property(fl => fl.TotalCost)
            .HasPrecision(10, 2)
            .IsRequired();

        builder.Property(fl => fl.PricePerUnit)
            .HasPrecision(10, 3)
            .IsRequired();

        builder.Property(fl => fl.FuelType)
            .HasMaxLength(50);

        builder.Property(fl => fl.CalculatedMPG)
            .HasPrecision(10, 2);

        builder.Property(fl => fl.Notes)
            .HasMaxLength(500);

        builder.Property(fl => fl.CreatedAt)
            .HasColumnType("timestamptz")
            .HasDefaultValueSql("NOW()");

        // Indexes
        builder.HasIndex(fl => fl.VehicleId);
        builder.HasIndex(fl => fl.FillUpDate);

        // Relationships
        builder.HasOne(fl => fl.Vehicle)
            .WithMany(v => v.FuelLogs)
            .HasForeignKey(fl => fl.VehicleId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
