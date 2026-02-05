using System.Globalization;
using HLE.FamilyHealth.Data;
using HLE.FamilyHealth.Models.Entities;
using HLE.FamilyHealth.Models.ViewModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace HLE.FamilyHealth.Services;

public class WorkoutImportService(
    ApplicationDbContext context,
    IMemoryCache cache,
    ILogger<WorkoutImportService> logger) : IWorkoutImportService
{
    private static readonly string[] DateFormats = [
        "d MMM yyyy, HH:mm",
        "dd MMM yyyy, HH:mm",
        "d MMM yyyy, H:mm",
        "dd MMM yyyy, H:mm"
    ];

    public async Task<(List<Workout> Workouts, List<string> Errors)> ParseCsvAsync(Stream csvStream, CancellationToken ct = default)
    {
        var workouts = new List<Workout>();
        var errors = new List<string>();
        var workoutDict = new Dictionary<string, Workout>();

        using var reader = new StreamReader(csvStream);
        var lineNumber = 0;
        string? line;

        // Read header
        var headerLine = await reader.ReadLineAsync(ct);
        if (string.IsNullOrEmpty(headerLine))
        {
            errors.Add("CSV file is empty or missing header row");
            return (workouts, errors);
        }
        lineNumber++;

        var headers = ParseCsvLine(headerLine);
        var headerIndex = headers
            .Select((h, i) => (Header: h.ToLowerInvariant().Trim('"'), Index: i))
            .ToDictionary(x => x.Header, x => x.Index);

        // Validate required headers
        var requiredHeaders = new[] { "title", "start_time", "exercise_title", "set_index" };
        var missingHeaders = requiredHeaders.Where(h => !headerIndex.ContainsKey(h)).ToList();
        if (missingHeaders.Count > 0)
        {
            errors.Add($"Missing required headers: {string.Join(", ", missingHeaders)}");
            return (workouts, errors);
        }

        while ((line = await reader.ReadLineAsync(ct)) != null)
        {
            lineNumber++;
            if (string.IsNullOrWhiteSpace(line)) continue;

            try
            {
                var values = ParseCsvLine(line);

                var title = GetValue(values, headerIndex, "title");
                var startTimeStr = GetValue(values, headerIndex, "start_time");
                var endTimeStr = GetValue(values, headerIndex, "end_time");
                var description = GetValue(values, headerIndex, "description");
                var exerciseTitle = GetValue(values, headerIndex, "exercise_title");
                var supersetIdStr = GetValue(values, headerIndex, "superset_id");
                var exerciseNotes = GetValue(values, headerIndex, "exercise_notes");
                var setIndexStr = GetValue(values, headerIndex, "set_index");
                var setType = GetValue(values, headerIndex, "set_type");
                var weightStr = GetValue(values, headerIndex, "weight_lbs");
                var repsStr = GetValue(values, headerIndex, "reps");
                var distanceStr = GetValue(values, headerIndex, "distance_miles");
                var durationStr = GetValue(values, headerIndex, "duration_seconds");
                var rpeStr = GetValue(values, headerIndex, "rpe");

                if (string.IsNullOrEmpty(title) || string.IsNullOrEmpty(startTimeStr) || string.IsNullOrEmpty(exerciseTitle))
                {
                    errors.Add($"Line {lineNumber}: Missing required fields (title, start_time, or exercise_title)");
                    continue;
                }

                if (!TryParseDateTime(startTimeStr, out var startTime))
                {
                    errors.Add($"Line {lineNumber}: Invalid start_time format: {startTimeStr}");
                    continue;
                }

                DateTime? endTime = null;
                if (!string.IsNullOrEmpty(endTimeStr) && TryParseDateTime(endTimeStr, out var parsedEndTime))
                {
                    endTime = parsedEndTime;
                }

                // Create workout key for grouping
                var workoutKey = $"{title}|{startTime:O}|{endTime?.ToString("O") ?? ""}";

                if (!workoutDict.TryGetValue(workoutKey, out var workout))
                {
                    workout = new Workout
                    {
                        Title = title,
                        StartTime = startTime,
                        EndTime = endTime,
                        Description = string.IsNullOrWhiteSpace(description) ? null : description,
                        CreatedAt = DateTime.UtcNow
                    };
                    workoutDict[workoutKey] = workout;
                    workouts.Add(workout);
                }

                // Find or create exercise within workout
                var exercise = workout.Exercises.FirstOrDefault(e => e.ExerciseName == exerciseTitle);
                if (exercise == null)
                {
                    int? supersetId = null;
                    if (!string.IsNullOrEmpty(supersetIdStr) && int.TryParse(supersetIdStr, out var parsedSupersetId))
                    {
                        supersetId = parsedSupersetId;
                    }

                    exercise = new WorkoutExercise
                    {
                        ExerciseName = exerciseTitle,
                        OrderIndex = workout.Exercises.Count,
                        SupersetGroupId = supersetId,
                        Notes = string.IsNullOrWhiteSpace(exerciseNotes) ? null : exerciseNotes
                    };
                    workout.Exercises.Add(exercise);
                }

                // Parse set data
                if (!int.TryParse(setIndexStr, out var setIndex))
                {
                    setIndex = exercise.Sets.Count;
                }

                var exerciseSet = new ExerciseSet
                {
                    SetIndex = setIndex,
                    SetType = string.IsNullOrEmpty(setType) ? "normal" : setType.ToLowerInvariant()
                };

                if (!string.IsNullOrEmpty(weightStr) && decimal.TryParse(weightStr, NumberStyles.Any, CultureInfo.InvariantCulture, out var weight))
                    exerciseSet.WeightLbs = weight;

                if (!string.IsNullOrEmpty(repsStr) && int.TryParse(repsStr, out var reps))
                    exerciseSet.Reps = reps;

                if (!string.IsNullOrEmpty(distanceStr) && decimal.TryParse(distanceStr, NumberStyles.Any, CultureInfo.InvariantCulture, out var distance))
                    exerciseSet.DistanceMiles = distance;

                if (!string.IsNullOrEmpty(durationStr) && int.TryParse(durationStr, out var duration))
                    exerciseSet.DurationSeconds = duration;

                if (!string.IsNullOrEmpty(rpeStr) && decimal.TryParse(rpeStr, NumberStyles.Any, CultureInfo.InvariantCulture, out var rpe))
                    exerciseSet.Rpe = rpe;

                exercise.Sets.Add(exerciseSet);
            }
            catch (Exception ex)
            {
                errors.Add($"Line {lineNumber}: Error parsing row - {ex.Message}");
            }
        }

        logger.LogInformation("Parsed {WorkoutCount} workouts with {ExerciseCount} exercises from CSV",
            workouts.Count, workouts.Sum(w => w.Exercises.Count));

        return (workouts, errors);
    }

    public async Task<WorkoutImportPreviewViewModel> PreviewImportAsync(
        int familyMemberId,
        Stream csvStream,
        string fileName,
        CancellationToken ct = default)
    {
        var familyMember = await context.FamilyMembers
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == familyMemberId, ct);

        if (familyMember == null)
        {
            return new WorkoutImportPreviewViewModel
            {
                FamilyMemberId = familyMemberId,
                FileName = fileName
            };
        }

        var (workouts, errors) = await ParseCsvAsync(csvStream, ct);

        // Check for existing workouts
        var existingWorkouts = await context.Workouts
            .AsNoTracking()
            .Where(w => w.FamilyMemberId == familyMemberId)
            .Select(w => new { w.Title, w.StartTime })
            .ToListAsync(ct);

        var existingSet = existingWorkouts
            .Select(w => $"{w.Title}|{w.StartTime:O}")
            .ToHashSet();

        var previewWorkouts = workouts.Select(w => new WorkoutImportPreviewWorkout
        {
            Title = w.Title,
            StartTime = w.StartTime,
            EndTime = w.EndTime,
            Description = w.Description,
            ExerciseCount = w.Exercises.Count,
            TotalSets = w.Exercises.Sum(e => e.Sets.Count),
            AlreadyExists = existingSet.Contains($"{w.Title}|{w.StartTime:O}")
        }).ToList();

        // Cache the parsed workouts for later import
        var cacheKey = Guid.NewGuid().ToString();
        CacheWorkouts(cacheKey, workouts);

        return new WorkoutImportPreviewViewModel
        {
            FamilyMemberId = familyMemberId,
            FamilyMemberName = $"{familyMember.FirstName} {familyMember.LastName}",
            FileName = fileName,
            Workouts = previewWorkouts,
            CachedDataKey = cacheKey
        };
    }

    public async Task<WorkoutImportResultViewModel> ImportWorkoutsAsync(
        int familyMemberId,
        List<Workout> workouts,
        CancellationToken ct = default)
    {
        var errors = new List<string>();
        var workoutsImported = 0;
        var exercisesImported = 0;
        var setsImported = 0;
        var workoutsSkipped = 0;

        // Get existing workouts for duplicate check
        var existingWorkouts = await context.Workouts
            .AsNoTracking()
            .Where(w => w.FamilyMemberId == familyMemberId)
            .Select(w => new { w.Title, w.StartTime })
            .ToListAsync(ct);

        var existingSet = existingWorkouts
            .Select(w => $"{w.Title}|{w.StartTime:O}")
            .ToHashSet();

        foreach (var workout in workouts)
        {
            var key = $"{workout.Title}|{workout.StartTime:O}";
            if (existingSet.Contains(key))
            {
                workoutsSkipped++;
                continue;
            }

            workout.FamilyMemberId = familyMemberId;
            workout.CreatedAt = DateTime.UtcNow;

            context.Workouts.Add(workout);
            workoutsImported++;
            exercisesImported += workout.Exercises.Count;
            setsImported += workout.Exercises.Sum(e => e.Sets.Count);
        }

        if (workoutsImported > 0)
        {
            await context.SaveChangesAsync(ct);
        }

        logger.LogInformation(
            "Imported {WorkoutsImported} workouts, {ExercisesImported} exercises, {SetsImported} sets for FamilyMember {FamilyMemberId}. Skipped {WorkoutsSkipped} duplicates.",
            workoutsImported, exercisesImported, setsImported, familyMemberId, workoutsSkipped);

        return new WorkoutImportResultViewModel
        {
            WorkoutsImported = workoutsImported,
            ExercisesImported = exercisesImported,
            SetsImported = setsImported,
            WorkoutsSkipped = workoutsSkipped,
            Errors = errors
        };
    }

    public void CacheWorkouts(string key, List<Workout> workouts)
    {
        var options = new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(15)
        };
        cache.Set(key, workouts, options);
    }

    public List<Workout>? GetCachedWorkouts(string key)
    {
        return cache.TryGetValue<List<Workout>>(key, out var workouts) ? workouts : null;
    }

    public void RemoveCachedWorkouts(string key)
    {
        cache.Remove(key);
    }

    private static bool TryParseDateTime(string value, out DateTime result)
    {
        if (DateTime.TryParseExact(
            value.Trim(),
            DateFormats,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeLocal,
            out var localTime))
        {
            // Convert to UTC for PostgreSQL timestamptz
            result = localTime.ToUniversalTime();
            return true;
        }

        result = default;
        return false;
    }

    private static string GetValue(string[] values, Dictionary<string, int> headerIndex, string header)
    {
        if (!headerIndex.TryGetValue(header, out var index) || index >= values.Length)
            return string.Empty;
        return values[index].Trim('"');
    }

    private static string[] ParseCsvLine(string line)
    {
        var values = new List<string>();
        var inQuotes = false;
        var currentValue = new System.Text.StringBuilder();

        for (var i = 0; i < line.Length; i++)
        {
            var c = line[i];

            if (c == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    currentValue.Append('"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (c == ',' && !inQuotes)
            {
                values.Add(currentValue.ToString());
                currentValue.Clear();
            }
            else
            {
                currentValue.Append(c);
            }
        }

        values.Add(currentValue.ToString());
        return values.ToArray();
    }
}
