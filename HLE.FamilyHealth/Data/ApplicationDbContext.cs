using HLE.FamilyHealth.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyHealth.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    // Phase 1 Entities
    public DbSet<FamilyMember> FamilyMembers { get; set; }
    public DbSet<HealthProfile> HealthProfiles { get; set; }
    public DbSet<EmergencyContact> EmergencyContacts { get; set; }
    public DbSet<Insurance> InsurancePolicies { get; set; }
    public DbSet<Provider> Providers { get; set; }

    // Phase 2+ Entities
    public DbSet<Vaccination> Vaccinations { get; set; }
    public DbSet<Medication> Medications { get; set; }
    public DbSet<Appointment> Appointments { get; set; }
    public DbSet<VisitSummary> VisitSummaries { get; set; }

    // Workout Tracking
    public DbSet<Workout> Workouts { get; set; }
    public DbSet<WorkoutExercise> WorkoutExercises { get; set; }
    public DbSet<ExerciseSet> ExerciseSets { get; set; }

    // Cost Tracking
    public DbSet<MedicalExpense> MedicalExpenses { get; set; }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Apply configurations from assembly
        builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);

        // PostgreSQL-specific configurations can be added here
    }
}
