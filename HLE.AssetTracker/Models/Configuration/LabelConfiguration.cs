using HLE.AssetTracker.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.AssetTracker.Models.Configuration;

public class LabelConfiguration : IEntityTypeConfiguration<Label>
{
    public void Configure(EntityTypeBuilder<Label> builder)
    {
        builder.HasKey(l => l.Id);

        builder.Property(l => l.Name)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(l => l.Color)
            .HasMaxLength(7); // #RRGGBB

        builder.HasOne(l => l.Household)
            .WithMany(h => h.Labels)
            .HasForeignKey(l => l.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        // Unique label name within household
        builder.HasIndex(l => new { l.HouseholdId, l.Name })
            .IsUnique();
    }
}

public class AssetLabelConfiguration : IEntityTypeConfiguration<AssetLabel>
{
    public void Configure(EntityTypeBuilder<AssetLabel> builder)
    {
        // Composite primary key
        builder.HasKey(al => new { al.AssetId, al.LabelId });

        builder.HasOne(al => al.Asset)
            .WithMany(a => a.AssetLabels)
            .HasForeignKey(al => al.AssetId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(al => al.Label)
            .WithMany(l => l.AssetLabels)
            .HasForeignKey(al => al.LabelId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
