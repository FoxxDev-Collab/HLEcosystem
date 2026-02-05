using System.Diagnostics;
using HLE.FamilyHealth.Data;
using HLE.FamilyHealth.Models;
using HLE.FamilyHealth.Models.ViewModels;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyHealth.Controllers;

public class HomeController(ILogger<HomeController> logger, ApplicationDbContext context) : Controller
{
    public async Task<IActionResult> Index()
    {
        // User claims from Authentik are available via User.Claims
        if (User.Identity?.IsAuthenticated == true)
        {
            ViewData["UserName"] = User.Identity.Name;
            ViewData["Email"] = User.FindFirst("email")?.Value;
            ViewData["FirstName"] = User.FindFirst("given_name")?.Value;
            ViewData["LastName"] = User.FindFirst("family_name")?.Value;

            // Dashboard stats
            var today = DateOnly.FromDateTime(DateTime.Now);
            var now = DateTime.UtcNow;
            var startOfWeek = now.AddDays(-(int)now.DayOfWeek).Date;
            var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

            var viewModel = new DashboardViewModel
            {
                TotalFamilyMembers = await context.FamilyMembers.CountAsync(),
                ActiveFamilyMembers = await context.FamilyMembers.CountAsync(f => f.IsActive),
                TotalHealthProfiles = await context.HealthProfiles.CountAsync(),
                TotalEmergencyContacts = await context.EmergencyContacts.CountAsync(),
                ActiveInsurancePolicies = await context.InsurancePolicies.CountAsync(i => i.IsActive),
                ExpiringInsurancePolicies = await context.InsurancePolicies
                    .CountAsync(i => i.IsActive && i.ExpirationDate.HasValue &&
                        i.ExpirationDate.Value <= DateOnly.FromDateTime(DateTime.Now.AddDays(30))),
                TotalProviders = await context.Providers.CountAsync(p => p.IsActive),
                ActiveMedicationsCount = await context.Medications.CountAsync(m => m.IsActive),
                TotalVaccinationsCount = await context.Vaccinations.CountAsync(),

                // Workout stats
                TotalWorkouts = await context.Workouts.CountAsync(),
                WorkoutsThisWeek = await context.Workouts.CountAsync(w => w.StartTime >= startOfWeek),
                WorkoutsThisMonth = await context.Workouts.CountAsync(w => w.StartTime >= startOfMonth),
                TotalExercisesPerformed = await context.WorkoutExercises.CountAsync(),
                TotalSetsCompleted = await context.ExerciseSets.CountAsync(),
                TotalVolumeThisMonth = await context.Workouts
                    .Where(w => w.StartTime >= startOfMonth)
                    .SelectMany(w => w.Exercises)
                    .SelectMany(e => e.Sets)
                    .Where(s => s.WeightLbs.HasValue && s.Reps.HasValue)
                    .SumAsync(s => s.WeightLbs!.Value * s.Reps!.Value),
                AverageWorkoutMinutes = await CalculateAverageWorkoutMinutesAsync(),
                CurrentStreakDays = await CalculateWorkoutStreakAsync(),

                RecentFamilyMembers = await context.FamilyMembers
                    .AsNoTracking()
                    .Where(f => f.IsActive)
                    .OrderByDescending(f => f.CreatedAt)
                    .Take(5)
                    .Include(f => f.HealthProfile)
                    .Include(f => f.EmergencyContacts)
                    .Include(f => f.InsurancePolicies)
                    .Select(m => new FamilyMemberSummary
                    {
                        Id = m.Id,
                        FullName = $"{m.FirstName} {m.LastName}",
                        DateOfBirth = m.DateOfBirth,
                        Age = DateTime.Now.Year - m.DateOfBirth.Year,
                        Relationship = m.Relationship,
                        IsActive = m.IsActive,
                        HasHealthProfile = m.HealthProfile != null,
                        EmergencyContactsCount = m.EmergencyContacts.Count,
                        InsurancePoliciesCount = m.InsurancePolicies.Count(i => i.IsActive)
                    })
                    .ToListAsync(),

                ExpiringPolicies = await context.InsurancePolicies
                    .AsNoTracking()
                    .Where(i => i.IsActive && i.ExpirationDate.HasValue &&
                        i.ExpirationDate.Value <= DateOnly.FromDateTime(DateTime.Now.AddDays(30)))
                    .Include(i => i.FamilyMember)
                    .Select(i => new InsuranceSummary
                    {
                        Id = i.Id,
                        FamilyMemberId = i.FamilyMemberId,
                        FamilyMemberName = $"{i.FamilyMember.FirstName} {i.FamilyMember.LastName}",
                        ProviderName = i.ProviderName,
                        PolicyNumber = i.PolicyNumber,
                        InsuranceType = i.InsuranceType,
                        ExpirationDate = i.ExpirationDate,
                        IsActive = i.IsActive
                    })
                    .ToListAsync(),

                UpcomingVaccinations = await context.Vaccinations
                    .AsNoTracking()
                    .Where(v => v.NextDoseDate.HasValue && v.NextDoseDate.Value > today && v.NextDoseDate.Value <= today.AddDays(60))
                    .Include(v => v.FamilyMember)
                    .OrderBy(v => v.NextDoseDate)
                    .Select(v => new VaccinationListDto
                    {
                        Id = v.Id,
                        FamilyMemberId = v.FamilyMemberId,
                        FamilyMemberName = $"{v.FamilyMember.FirstName} {v.FamilyMember.LastName}",
                        VaccineName = v.VaccineName,
                        DoseNumber = v.DoseNumber,
                        DateAdministered = v.DateAdministered,
                        NextDoseDate = v.NextDoseDate,
                        DaysUntilNextDose = v.NextDoseDate.HasValue ? v.NextDoseDate.Value.DayNumber - today.DayNumber : null
                    })
                    .ToListAsync(),

                MedicationRefillAlerts = await context.Medications
                    .AsNoTracking()
                    .Where(m => m.IsActive && m.NextRefillDate.HasValue && m.NextRefillDate.Value <= today.AddDays(14))
                    .Include(m => m.FamilyMember)
                    .OrderBy(m => m.NextRefillDate)
                    .Select(m => new MedicationListDto
                    {
                        Id = m.Id,
                        FamilyMemberId = m.FamilyMemberId,
                        FamilyMemberName = $"{m.FamilyMember.FirstName} {m.FamilyMember.LastName}",
                        MedicationName = m.MedicationName,
                        Dosage = m.Dosage,
                        Frequency = m.Frequency,
                        IsActive = m.IsActive,
                        NextRefillDate = m.NextRefillDate,
                        DaysUntilRefill = m.NextRefillDate.HasValue ? m.NextRefillDate.Value.DayNumber - today.DayNumber : null,
                        RefillsRemaining = m.RefillsRemaining
                    })
                    .ToListAsync(),

                RecentWorkouts = await context.Workouts
                    .AsNoTracking()
                    .Include(w => w.FamilyMember)
                    .Include(w => w.Exercises)
                        .ThenInclude(e => e.Sets)
                    .OrderByDescending(w => w.StartTime)
                    .Take(5)
                    .Select(w => new RecentWorkoutDto
                    {
                        Id = w.Id,
                        Title = w.Title,
                        FamilyMemberName = $"{w.FamilyMember.FirstName} {w.FamilyMember.LastName}",
                        StartTime = w.StartTime,
                        Duration = w.EndTime.HasValue ? w.EndTime.Value - w.StartTime : null,
                        ExerciseCount = w.Exercises.Count,
                        TotalSets = w.Exercises.Sum(e => e.Sets.Count)
                    })
                    .ToListAsync()
            };

            return View(viewModel);
        }

        return View();
    }

    private async Task<int> CalculateAverageWorkoutMinutesAsync()
    {
        var workoutsWithDuration = await context.Workouts
            .Where(w => w.EndTime.HasValue)
            .Select(w => new { w.StartTime, w.EndTime })
            .ToListAsync();

        if (workoutsWithDuration.Count == 0)
            return 0;

        var totalMinutes = workoutsWithDuration
            .Sum(w => (w.EndTime!.Value - w.StartTime).TotalMinutes);

        return (int)(totalMinutes / workoutsWithDuration.Count);
    }

    private async Task<int> CalculateWorkoutStreakAsync()
    {
        // Get distinct workout dates (as dates only, not times)
        var workoutDates = await context.Workouts
            .Select(w => w.StartTime.Date)
            .Distinct()
            .OrderByDescending(d => d)
            .ToListAsync();

        if (workoutDates.Count == 0)
            return 0;

        var today = DateTime.UtcNow.Date;
        var streak = 0;
        var checkDate = today;

        // If no workout today, start from yesterday
        if (!workoutDates.Contains(today))
        {
            checkDate = today.AddDays(-1);
        }

        foreach (var _ in workoutDates)
        {
            if (workoutDates.Contains(checkDate))
            {
                streak++;
                checkDate = checkDate.AddDays(-1);
            }
            else
            {
                break;
            }
        }

        return streak;
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
