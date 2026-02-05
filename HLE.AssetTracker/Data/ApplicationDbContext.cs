using HLE.AssetTracker.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace HLE.AssetTracker.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    // Household & Members
    public DbSet<Household> Households { get; set; }
    public DbSet<HouseholdMember> HouseholdMembers { get; set; }

    // Locations (hierarchical)
    public DbSet<Location> Locations { get; set; }

    // Categories & Custom Fields
    public DbSet<Category> Categories { get; set; }
    public DbSet<CustomFieldDefinition> CustomFieldDefinitions { get; set; }

    // Assets & Photos
    public DbSet<Asset> Assets { get; set; }
    public DbSet<AssetPhoto> AssetPhotos { get; set; }

    // Labels (tags)
    public DbSet<Label> Labels { get; set; }
    public DbSet<AssetLabel> AssetLabels { get; set; }

    // Maintenance
    public DbSet<MaintenanceSchedule> MaintenanceSchedules { get; set; }
    public DbSet<MaintenanceLog> MaintenanceLogs { get; set; }

    // Vehicles
    public DbSet<Vehicle> Vehicles { get; set; }
    public DbSet<OdometerReading> OdometerReadings { get; set; }
    public DbSet<FuelLog> FuelLogs { get; set; }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Apply configurations from assembly
        builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }
}
