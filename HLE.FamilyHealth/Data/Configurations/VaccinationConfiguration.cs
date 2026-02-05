using HLE.FamilyHealth.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HLE.FamilyHealth.Data.Configurations;

public class VaccinationConfiguration : IEntityTypeConfiguration<Vaccination>
{
    public void Configure(EntityTypeBuilder<Vaccination> builder)
    {
        builder.HasKey(v => v.Id);

        builder.Property(v => v.VaccineName).IsRequired().HasMaxLength(200);
        builder.Property(v => v.DoseNumber).HasMaxLength(50);
        builder.Property(v => v.DateAdministered).IsRequired();
        builder.Property(v => v.AdministeredBy).HasMaxLength(200);
        builder.Property(v => v.LotNumber).HasMaxLength(100);

        // PostgreSQL-specific: Use timestamptz for timestamps
        builder.Property(v => v.CreatedAt).HasColumnType("timestamptz");
        builder.Property(v => v.UpdatedAt).HasColumnType("timestamptz");

        // Relationship
        builder.HasOne(v => v.FamilyMember)
            .WithMany()
            .HasForeignKey(v => v.FamilyMemberId)
            .OnDelete(DeleteBehavior.Cascade);

        // Index for query performance
        builder.HasIndex(v => v.FamilyMemberId);
        builder.HasIndex(v => v.NextDoseDate);
    }
}
