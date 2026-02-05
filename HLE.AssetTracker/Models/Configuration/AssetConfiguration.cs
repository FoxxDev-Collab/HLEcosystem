using HLE.AssetTracker.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.AssetTracker.Models.Configuration;

public class AssetConfiguration : IEntityTypeConfiguration<Asset>
{
    public void Configure(EntityTypeBuilder<Asset> builder)
    {
        builder.HasKey(a => a.Id);

        builder.Property(a => a.Name)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(a => a.Description)
            .HasColumnType("text");

        builder.Property(a => a.Manufacturer)
            .HasMaxLength(100);

        builder.Property(a => a.Model)
            .HasMaxLength(100);

        builder.Property(a => a.SerialNumber)
            .HasMaxLength(100);

        builder.Property(a => a.PurchasePrice)
            .HasPrecision(18, 2);

        builder.Property(a => a.PurchaseLocation)
            .HasMaxLength(200);

        builder.Property(a => a.WarrantyNotes)
            .HasColumnType("text");

        builder.Property(a => a.Notes)
            .HasColumnType("text");

        builder.Property(a => a.CustomFields)
            .HasColumnType("jsonb");

        builder.Property(a => a.CreatedByUserId)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(a => a.CreatedAt)
            .HasColumnType("timestamptz");

        builder.Property(a => a.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(a => a.Household)
            .WithMany(h => h.Assets)
            .HasForeignKey(a => a.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.Location)
            .WithMany(l => l.Assets)
            .HasForeignKey(a => a.LocationId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(a => a.Category)
            .WithMany(c => c.Assets)
            .HasForeignKey(a => a.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        // Index for common queries
        builder.HasIndex(a => new { a.HouseholdId, a.IsArchived });
        builder.HasIndex(a => new { a.HouseholdId, a.CategoryId });
        builder.HasIndex(a => new { a.HouseholdId, a.LocationId });
        builder.HasIndex(a => new { a.HouseholdId, a.Name });

        // Index for warranty expiration queries
        builder.HasIndex(a => a.WarrantyExpiration);
    }
}

public class AssetPhotoConfiguration : IEntityTypeConfiguration<AssetPhoto>
{
    public void Configure(EntityTypeBuilder<AssetPhoto> builder)
    {
        builder.HasKey(p => p.Id);

        builder.Property(p => p.FileName)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(p => p.FilePath)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(p => p.ContentType)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(p => p.UploadedByUserId)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(p => p.UploadedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(p => p.Asset)
            .WithMany(a => a.Photos)
            .HasForeignKey(p => p.AssetId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(p => p.AssetId);
    }
}
