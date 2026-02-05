using HLE.FamilyHealth.Models.Entities;
using HLE.FamilyHealth.Models.ViewModels;

namespace HLE.FamilyHealth.Services;

public interface IWorkoutImportService
{
    Task<(List<Workout> Workouts, List<string> Errors)> ParseCsvAsync(Stream csvStream, CancellationToken ct = default);
    Task<WorkoutImportPreviewViewModel> PreviewImportAsync(int familyMemberId, Stream csvStream, string fileName, CancellationToken ct = default);
    Task<WorkoutImportResultViewModel> ImportWorkoutsAsync(int familyMemberId, List<Workout> workouts, CancellationToken ct = default);
    void CacheWorkouts(string key, List<Workout> workouts);
    List<Workout>? GetCachedWorkouts(string key);
    void RemoveCachedWorkouts(string key);
}
