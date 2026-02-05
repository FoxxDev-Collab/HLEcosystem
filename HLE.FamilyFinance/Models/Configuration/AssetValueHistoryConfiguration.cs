using HLE.FamilyFinance.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyFinance.Models.Configuration;

public class AssetValueHistoryConfiguration : IEntityTypeConfiguration<AssetValueHistory>
{
    public void Configure(EntityTypeBuilder<AssetValueHistory> builder)
    {
        builder.HasKey(v => v.Id);

        builder.Property(v => v.Value)
            .HasPrecision(18, 2);

        builder.Property(v => v.Source)
            .HasMaxLength(100);

        builder.Property(v => v.Notes)
            .HasMaxLength(500);

        builder.Property(v => v.CreatedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(v => v.Asset)
            .WithMany(a => a.ValueHistory)
            .HasForeignKey(v => v.AssetId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(v => v.AssetId);
        builder.HasIndex(v => new { v.AssetId, v.Date });
    }
}
