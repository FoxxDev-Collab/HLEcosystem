using HLE.AssetTracker.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.AssetTracker.Models.Configuration;

public class LocationConfiguration : IEntityTypeConfiguration<Location>
{
    public void Configure(EntityTypeBuilder<Location> builder)
    {
        builder.HasKey(l => l.Id);

        builder.Property(l => l.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(l => l.Description)
            .HasMaxLength(500);

        builder.Property(l => l.CreatedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(l => l.Household)
            .WithMany(h => h.Locations)
            .HasForeignKey(l => l.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        // Self-referencing relationship for hierarchy
        builder.HasOne(l => l.Parent)
            .WithMany(l => l.Children)
            .HasForeignKey(l => l.ParentId)
            .OnDelete(DeleteBehavior.Restrict);

        // Index for querying locations within a household
        builder.HasIndex(l => new { l.HouseholdId, l.ParentId });

        // Unique name within same parent in household
        builder.HasIndex(l => new { l.HouseholdId, l.ParentId, l.Name })
            .IsUnique();
    }
}
