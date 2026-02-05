using HLE.FamilyFinance.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyFinance.Models.Configuration;

public class TaxDocumentConfiguration : IEntityTypeConfiguration<TaxDocument>
{
    public void Configure(EntityTypeBuilder<TaxDocument> builder)
    {
        builder.HasKey(d => d.Id);

        builder.Property(d => d.Issuer)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(d => d.Description)
            .HasMaxLength(500);

        builder.Property(d => d.GrossAmount)
            .HasPrecision(18, 2);

        builder.Property(d => d.FederalWithheld)
            .HasPrecision(18, 2);

        builder.Property(d => d.StateWithheld)
            .HasPrecision(18, 2);

        builder.Property(d => d.SocialSecurityWithheld)
            .HasPrecision(18, 2);

        builder.Property(d => d.MedicareWithheld)
            .HasPrecision(18, 2);

        builder.Property(d => d.Notes)
            .HasMaxLength(500);

        // File attachment properties
        builder.Property(d => d.UploadedFileName)
            .HasMaxLength(255);

        builder.Property(d => d.StoragePath)
            .HasMaxLength(500);

        builder.Property(d => d.ContentHash)
            .HasMaxLength(64);

        builder.Property(d => d.UploadedAt)
            .HasColumnType("timestamptz");

        builder.Property(d => d.CreatedAt)
            .HasColumnType("timestamptz");

        builder.Property(d => d.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.HasOne(d => d.TaxYear)
            .WithMany(t => t.Documents)
            .HasForeignKey(d => d.TaxYearId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(d => d.TaxYearId);
    }
}
