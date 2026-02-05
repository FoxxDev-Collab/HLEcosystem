using HLE.AssetTracker.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.AssetTracker.Models.Configuration;

public class OdometerReadingConfiguration : IEntityTypeConfiguration<OdometerReading>
{
    public void Configure(EntityTypeBuilder<OdometerReading> builder)
    {
        builder.HasKey(or => or.Id);

        builder.Property(or => or.ReadingDate)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(or => or.Odometer)
            .IsRequired();

        builder.Property(or => or.Notes)
            .HasMaxLength(500);

        builder.Property(or => or.CreatedAt)
            .HasColumnType("timestamptz")
            .HasDefaultValueSql("NOW()");

        // Indexes
        builder.HasIndex(or => or.VehicleId);
        builder.HasIndex(or => or.ReadingDate);

        // Relationships
        builder.HasOne(or => or.Vehicle)
            .WithMany(v => v.OdometerReadings)
            .HasForeignKey(or => or.VehicleId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
