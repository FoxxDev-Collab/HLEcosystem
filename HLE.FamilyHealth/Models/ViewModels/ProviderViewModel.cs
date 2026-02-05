using System.ComponentModel.DataAnnotations;

namespace HLE.FamilyHealth.Models.ViewModels;

public class ProviderViewModel
{
    public int Id { get; set; }

    [Required]
    [Display(Name = "Provider Name")]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [Display(Name = "Specialty")]
    [MaxLength(100)]
    public string? Specialty { get; set; }

    [Required]
    [Display(Name = "Type")]
    [MaxLength(50)]
    public string Type { get; set; } = "Doctor";

    [Display(Name = "Address")]
    [MaxLength(500)]
    [DataType(DataType.MultilineText)]
    public string? Address { get; set; }

    [Display(Name = "Phone Number")]
    [MaxLength(20)]
    [Phone]
    public string? PhoneNumber { get; set; }

    [Display(Name = "Fax Number")]
    [MaxLength(20)]
    public string? FaxNumber { get; set; }

    [Display(Name = "Email")]
    [MaxLength(200)]
    [EmailAddress]
    public string? Email { get; set; }

    [Display(Name = "Website")]
    [MaxLength(200)]
    [Url]
    public string? Website { get; set; }

    [Display(Name = "Patient Portal URL")]
    [MaxLength(200)]
    [Url]
    public string? PortalUrl { get; set; }

    [Display(Name = "Preferred Contact Method")]
    [MaxLength(100)]
    public string? PreferredContactMethod { get; set; }

    [Display(Name = "Notes")]
    [DataType(DataType.MultilineText)]
    public string? Notes { get; set; }

    [Display(Name = "Active")]
    public bool IsActive { get; set; } = true;
}

public class ProviderIndexViewModel
{
    public List<ProviderSummary> Providers { get; set; } = [];
    public int TotalProviders { get; set; }
    public Dictionary<string, int> ProvidersByType { get; set; } = new();
}

public class ProviderSummary
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Specialty { get; set; }
    public string Type { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public string? PortalUrl { get; set; }
    public bool IsActive { get; set; }
}

public class DashboardViewModel
{
    public int TotalFamilyMembers { get; set; }
    public int ActiveFamilyMembers { get; set; }
    public int TotalHealthProfiles { get; set; }
    public int TotalEmergencyContacts { get; set; }
    public int ActiveInsurancePolicies { get; set; }
    public int ExpiringInsurancePolicies { get; set; }
    public int TotalProviders { get; set; }
    public int ActiveMedicationsCount { get; set; }
    public int TotalVaccinationsCount { get; set; }

    // Workout stats
    public int TotalWorkouts { get; set; }
    public int WorkoutsThisWeek { get; set; }
    public int WorkoutsThisMonth { get; set; }
    public TimeSpan TotalWorkoutDuration { get; set; }
    public int TotalExercisesPerformed { get; set; }
    public int TotalSetsCompleted { get; set; }
    public decimal TotalVolumeThisMonth { get; set; } // weight x reps
    public int AverageWorkoutMinutes { get; set; }
    public int CurrentStreakDays { get; set; } // consecutive days with workouts

    public List<FamilyMemberSummary> RecentFamilyMembers { get; set; } = [];
    public List<InsuranceSummary> ExpiringPolicies { get; set; } = [];
    public List<VaccinationListDto> UpcomingVaccinations { get; set; } = [];
    public List<MedicationListDto> MedicationRefillAlerts { get; set; } = [];
    public List<RecentWorkoutDto> RecentWorkouts { get; set; } = [];
}

public class RecentWorkoutDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string FamilyMemberName { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public TimeSpan? Duration { get; set; }
    public int ExerciseCount { get; set; }
    public int TotalSets { get; set; }
}
