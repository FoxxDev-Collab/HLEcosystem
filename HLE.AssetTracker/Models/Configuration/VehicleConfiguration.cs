using HLE.AssetTracker.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.AssetTracker.Models.Configuration;

public class VehicleConfiguration : IEntityTypeConfiguration<Vehicle>
{
    public void Configure(EntityTypeBuilder<Vehicle> builder)
    {
        builder.HasKey(v => v.Id);

        builder.Property(v => v.Make)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(v => v.Model)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(v => v.VIN)
            .HasMaxLength(17);

        builder.Property(v => v.LicensePlate)
            .HasMaxLength(20);

        builder.Property(v => v.Color)
            .HasMaxLength(50);

        builder.Property(v => v.VehicleType)
            .HasMaxLength(50);

        builder.Property(v => v.OdometerUnit)
            .HasMaxLength(20)
            .HasDefaultValue("Miles");

        builder.Property(v => v.Notes)
            .HasMaxLength(1000);

        builder.Property(v => v.CreatedAt)
            .HasColumnType("timestamptz")
            .HasDefaultValueSql("NOW()");

        builder.Property(v => v.UpdatedAt)
            .HasColumnType("timestamptz")
            .HasDefaultValueSql("NOW()");

        // Indexes
        builder.HasIndex(v => v.HouseholdId);
        builder.HasIndex(v => v.VIN);

        // Relationships
        builder.HasOne(v => v.Household)
            .WithMany()
            .HasForeignKey(v => v.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(v => v.Asset)
            .WithMany()
            .HasForeignKey(v => v.AssetId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(v => v.OdometerReadings)
            .WithOne(or => or.Vehicle)
            .HasForeignKey(or => or.VehicleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(v => v.FuelLogs)
            .WithOne(fl => fl.Vehicle)
            .HasForeignKey(fl => fl.VehicleId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
