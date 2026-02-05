using HLE.FamilyHub.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyHub.Data;

/// <summary>
/// Database context for the Family Hub application
/// </summary>
public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    public DbSet<Household> Households => Set<Household>();

    public DbSet<HouseholdMember> HouseholdMembers => Set<HouseholdMember>();

    public DbSet<FamilyMember> FamilyMembers => Set<FamilyMember>();

    public DbSet<ImportantDate> ImportantDates => Set<ImportantDate>();

    public DbSet<Gift> Gifts => Set<Gift>();

    public DbSet<GiftIdea> GiftIdeas => Set<GiftIdea>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Apply all entity configurations from the assembly
        builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }
}
