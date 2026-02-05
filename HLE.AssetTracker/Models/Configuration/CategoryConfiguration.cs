using HLE.AssetTracker.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.AssetTracker.Models.Configuration;

public class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(c => c.Icon)
            .HasMaxLength(50);

        builder.Property(c => c.Color)
            .HasMaxLength(7); // #RRGGBB

        builder.Property(c => c.CreatedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(c => c.Household)
            .WithMany(h => h.Categories)
            .HasForeignKey(c => c.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        // Unique category name within household
        builder.HasIndex(c => new { c.HouseholdId, c.Name })
            .IsUnique();
    }
}

public class CustomFieldDefinitionConfiguration : IEntityTypeConfiguration<CustomFieldDefinition>
{
    public void Configure(EntityTypeBuilder<CustomFieldDefinition> builder)
    {
        builder.HasKey(f => f.Id);

        builder.Property(f => f.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(f => f.Options)
            .HasColumnType("jsonb");

        builder.HasOne(f => f.Category)
            .WithMany(c => c.CustomFields)
            .HasForeignKey(f => f.CategoryId)
            .OnDelete(DeleteBehavior.Cascade);

        // Unique field name within category
        builder.HasIndex(f => new { f.CategoryId, f.Name })
            .IsUnique();
    }
}
