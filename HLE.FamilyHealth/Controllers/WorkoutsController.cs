using HLE.FamilyHealth.Data;
using HLE.FamilyHealth.Models.Entities;
using HLE.FamilyHealth.Models.ViewModels;
using HLE.FamilyHealth.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyHealth.Controllers;

[Authorize]
public class WorkoutsController(
    ApplicationDbContext context,
    IWorkoutImportService importService) : Controller
{
    public async Task<IActionResult> Index(int? familyMemberId, DateTime? startDate, DateTime? endDate)
    {
        var query = context.Workouts
            .AsNoTracking()
            .Include(w => w.FamilyMember)
            .Include(w => w.Exercises)
                .ThenInclude(e => e.Sets)
            .AsQueryable();

        if (familyMemberId.HasValue)
        {
            query = query.Where(w => w.FamilyMemberId == familyMemberId.Value);
        }

        if (startDate.HasValue)
        {
            query = query.Where(w => w.StartTime >= startDate.Value);
        }

        if (endDate.HasValue)
        {
            var endOfDay = endDate.Value.Date.AddDays(1);
            query = query.Where(w => w.StartTime < endOfDay);
        }

        var workouts = await query
            .OrderByDescending(w => w.StartTime)
            .ToListAsync();

        var viewModel = new WorkoutIndexViewModel
        {
            Workouts = workouts.Select(w => new WorkoutListDto
            {
                Id = w.Id,
                FamilyMemberId = w.FamilyMemberId,
                FamilyMemberName = $"{w.FamilyMember.FirstName} {w.FamilyMember.LastName}",
                Title = w.Title,
                StartTime = w.StartTime,
                EndTime = w.EndTime,
                ExerciseCount = w.Exercises.Count,
                TotalSets = w.Exercises.Sum(e => e.Sets.Count)
            }).ToList(),
            FamilyMembers = await GetFamilyMembersSelectList(),
            SelectedFamilyMemberId = familyMemberId,
            StartDate = startDate,
            EndDate = endDate
        };

        return View(viewModel);
    }

    public async Task<IActionResult> Stats(int? familyMemberId, DateTime? startDate, DateTime? endDate, string? selectedExercise)
    {
        // Default to last 90 days if no date range specified
        var effectiveEndDate = endDate ?? DateTime.Today;
        var effectiveStartDate = startDate ?? effectiveEndDate.AddDays(-90);

        // Convert to UTC for PostgreSQL timestamptz queries
        var utcStartDate = DateTime.SpecifyKind(effectiveStartDate.Date, DateTimeKind.Utc);
        var utcEndDate = DateTime.SpecifyKind(effectiveEndDate.Date.AddDays(1), DateTimeKind.Utc);

        var query = context.Workouts
            .AsNoTracking()
            .Include(w => w.FamilyMember)
            .Include(w => w.Exercises)
                .ThenInclude(e => e.Sets)
            .Where(w => w.StartTime >= utcStartDate && w.StartTime < utcEndDate)
            .AsQueryable();

        if (familyMemberId.HasValue)
        {
            query = query.Where(w => w.FamilyMemberId == familyMemberId.Value);
        }

        var workouts = await query.OrderBy(w => w.StartTime).ToListAsync();

        // Get all unique exercises for the filter dropdown
        var allExercises = workouts
            .SelectMany(w => w.Exercises)
            .Select(e => e.ExerciseName)
            .Distinct()
            .OrderBy(e => e)
            .Select(e => new SelectListItem { Value = e, Text = e })
            .ToList();

        var viewModel = new WorkoutStatsViewModel
        {
            SelectedFamilyMemberId = familyMemberId,
            StartDate = effectiveStartDate,
            EndDate = effectiveEndDate,
            SelectedExercise = selectedExercise,
            FamilyMembers = await GetFamilyMembersSelectList(),
            Exercises = allExercises,
            TotalWorkouts = workouts.Count,
            TotalExercises = workouts.Sum(w => w.Exercises.Count),
            TotalSets = workouts.Sum(w => w.Exercises.Sum(e => e.Sets.Count)),
            TotalDurationMinutes = (int)workouts
                .Where(w => w.EndTime.HasValue)
                .Sum(w => (w.EndTime!.Value - w.StartTime).TotalMinutes),
            TotalVolume = workouts
                .SelectMany(w => w.Exercises)
                .SelectMany(e => e.Sets)
                .Where(s => s.WeightLbs.HasValue && s.Reps.HasValue)
                .Sum(s => s.WeightLbs!.Value * s.Reps!.Value),
            WorkoutFrequencyData = BuildWorkoutFrequencyData(workouts, effectiveStartDate, effectiveEndDate),
            TopExercisesData = BuildTopExercisesData(workouts),
            ExerciseProgressionData = BuildExerciseProgressionData(workouts, selectedExercise),
            VolumeTrendsData = BuildVolumeTrendsData(workouts),
            DurationTrendsData = BuildDurationTrendsData(workouts),
            ExerciseStats = BuildExerciseStats(workouts, selectedExercise)
        };

        return View(viewModel);
    }

    private static List<ChartDataPoint> BuildWorkoutFrequencyData(
        List<Workout> workouts, DateTime startDate, DateTime endDate)
    {
        var weeklyGroups = workouts
            .GroupBy(w => GetWeekStart(w.StartTime))
            .ToDictionary(g => g.Key, g => g.Count());

        var result = new List<ChartDataPoint>();
        var currentWeek = GetWeekStart(startDate);
        var lastWeek = GetWeekStart(endDate);

        while (currentWeek <= lastWeek)
        {
            var count = weeklyGroups.GetValueOrDefault(currentWeek, 0);
            result.Add(new ChartDataPoint
            {
                Label = currentWeek.ToString("MMM d"),
                Value = count
            });
            currentWeek = currentWeek.AddDays(7);
        }

        return result;
    }

    private static DateTime GetWeekStart(DateTime date)
    {
        var diff = (7 + (date.DayOfWeek - DayOfWeek.Monday)) % 7;
        return date.AddDays(-diff).Date;
    }

    private static List<ChartDataPoint> BuildTopExercisesData(List<Workout> workouts)
    {
        return workouts
            .SelectMany(w => w.Exercises)
            .GroupBy(e => e.ExerciseName)
            .Select(g => new ChartDataPoint
            {
                Label = g.Key,
                Value = g.Count()
            })
            .OrderByDescending(x => x.Value)
            .Take(10)
            .ToList();
    }

    private static List<ExerciseProgressionDataPoint> BuildExerciseProgressionData(
        List<Workout> workouts, string? selectedExercise)
    {
        if (string.IsNullOrEmpty(selectedExercise))
            return [];

        return workouts
            .SelectMany(w => w.Exercises
                .Where(e => e.ExerciseName.Equals(selectedExercise, StringComparison.OrdinalIgnoreCase))
                .Select(e => new { w.StartTime, Exercise = e }))
            .OrderBy(x => x.StartTime)
            .Select(x => new ExerciseProgressionDataPoint
            {
                Date = x.StartTime.ToString("MMM d"),
                MaxWeight = x.Exercise.Sets.Where(s => s.WeightLbs.HasValue).Max(s => s.WeightLbs),
                MaxReps = x.Exercise.Sets.Where(s => s.Reps.HasValue).Max(s => s.Reps)
            })
            .ToList();
    }

    private static List<ChartDataPoint> BuildVolumeTrendsData(List<Workout> workouts)
    {
        return workouts
            .OrderBy(w => w.StartTime)
            .Select(w => new ChartDataPoint
            {
                Label = w.StartTime.ToString("MMM d"),
                Value = w.Exercises.Sum(e => e.Sets.Count)
            })
            .ToList();
    }

    private static List<ChartDataPoint> BuildDurationTrendsData(List<Workout> workouts)
    {
        return workouts
            .Where(w => w.EndTime.HasValue)
            .OrderBy(w => w.StartTime)
            .Select(w => new ChartDataPoint
            {
                Label = w.StartTime.ToString("MMM d"),
                Value = (decimal)(w.EndTime!.Value - w.StartTime).TotalMinutes
            })
            .ToList();
    }

    private static ExerciseStatsDto? BuildExerciseStats(List<Workout> workouts, string? selectedExercise)
    {
        if (string.IsNullOrEmpty(selectedExercise))
            return null;

        // Get all instances of this exercise across workouts
        var exerciseInstances = workouts
            .SelectMany(w => w.Exercises
                .Where(e => e.ExerciseName.Equals(selectedExercise, StringComparison.OrdinalIgnoreCase))
                .Select(e => new { Workout = w, Exercise = e }))
            .OrderBy(x => x.Workout.StartTime)
            .ToList();

        if (exerciseInstances.Count == 0)
            return null;

        // Get all sets for this exercise
        var allSets = exerciseInstances
            .SelectMany(x => x.Exercise.Sets.Select(s => new { x.Workout, x.Exercise, Set = s }))
            .ToList();

        var weightedSets = allSets.Where(x => x.Set.WeightLbs.HasValue && x.Set.Reps.HasValue).ToList();

        // Find Weight PR (heaviest weight lifted)
        var weightPRSet = weightedSets
            .OrderByDescending(x => x.Set.WeightLbs)
            .ThenByDescending(x => x.Set.Reps)
            .FirstOrDefault();

        // Find Reps PR (most reps in a single set)
        var repsPRSet = allSets
            .Where(x => x.Set.Reps.HasValue)
            .OrderByDescending(x => x.Set.Reps)
            .ThenByDescending(x => x.Set.WeightLbs ?? 0)
            .FirstOrDefault();

        // Calculate session volumes
        var sessionVolumes = exerciseInstances
            .Select(x => new
            {
                x.Workout.StartTime,
                Volume = x.Exercise.Sets
                    .Where(s => s.WeightLbs.HasValue && s.Reps.HasValue)
                    .Sum(s => s.WeightLbs!.Value * s.Reps!.Value)
            })
            .Where(x => x.Volume > 0)
            .OrderByDescending(x => x.Volume)
            .ToList();

        var sessionVolumePR = sessionVolumes.FirstOrDefault();

        // Calculate averages
        var avgWeight = weightedSets.Any() ? weightedSets.Average(x => x.Set.WeightLbs!.Value) : (decimal?)null;
        var avgReps = allSets.Where(x => x.Set.Reps.HasValue).Any()
            ? allSets.Where(x => x.Set.Reps.HasValue).Average(x => x.Set.Reps!.Value)
            : (double?)null;

        // Calculate trend (compare first half avg to second half avg of max weights per session)
        var sessionMaxWeights = exerciseInstances
            .Where(x => x.Exercise.Sets.Any(s => s.WeightLbs.HasValue))
            .Select(x => x.Exercise.Sets.Where(s => s.WeightLbs.HasValue).Max(s => s.WeightLbs!.Value))
            .ToList();

        string trend = "stable";
        decimal? trendPercentage = null;

        if (sessionMaxWeights.Count >= 4)
        {
            var halfPoint = sessionMaxWeights.Count / 2;
            var firstHalfAvg = sessionMaxWeights.Take(halfPoint).Average();
            var secondHalfAvg = sessionMaxWeights.Skip(halfPoint).Average();

            if (firstHalfAvg > 0)
            {
                trendPercentage = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
                trend = trendPercentage > 2 ? "improving" : trendPercentage < -2 ? "declining" : "stable";
            }
        }

        // Recent average (last 5 sessions)
        var recentSessions = exerciseInstances.TakeLast(5).ToList();
        var recentAvgWeight = recentSessions
            .SelectMany(x => x.Exercise.Sets.Where(s => s.WeightLbs.HasValue))
            .Select(s => s.WeightLbs!.Value)
            .DefaultIfEmpty()
            .Average();

        return new ExerciseStatsDto
        {
            ExerciseName = selectedExercise,
            TimesPerformed = exerciseInstances.Count,
            TotalSets = allSets.Count,
            TotalReps = allSets.Where(x => x.Set.Reps.HasValue).Sum(x => x.Set.Reps!.Value),
            TotalVolume = weightedSets.Sum(x => x.Set.WeightLbs!.Value * x.Set.Reps!.Value),

            WeightPR = weightPRSet?.Set.WeightLbs,
            WeightPRDate = weightPRSet?.Workout.StartTime,
            MaxRepsAtPRWeight = weightPRSet?.Set.Reps,

            RepsPR = repsPRSet?.Set.Reps,
            RepsPRDate = repsPRSet?.Workout.StartTime,
            WeightAtRepsPR = repsPRSet?.Set.WeightLbs,

            SessionVolumePR = sessionVolumePR?.Volume,
            SessionVolumePRDate = sessionVolumePR?.StartTime,

            AverageWeight = avgWeight,
            AverageRepsPerSet = avgReps.HasValue ? (decimal)avgReps.Value : null,

            RecentAverageWeight = recentAvgWeight > 0 ? recentAvgWeight : null,
            Trend = trend,
            TrendPercentage = trendPercentage,

            FirstPerformed = exerciseInstances.First().Workout.StartTime,
            LastPerformed = exerciseInstances.Last().Workout.StartTime
        };
    }

    public async Task<IActionResult> Details(int id)
    {
        var workout = await context.Workouts
            .AsNoTracking()
            .Include(w => w.FamilyMember)
            .Include(w => w.Exercises.OrderBy(e => e.OrderIndex))
                .ThenInclude(e => e.Sets.OrderBy(s => s.SetIndex))
            .FirstOrDefaultAsync(w => w.Id == id);

        if (workout == null)
            return NotFound();

        var viewModel = new WorkoutDetailDto
        {
            Id = workout.Id,
            FamilyMemberId = workout.FamilyMemberId,
            FamilyMemberName = $"{workout.FamilyMember.FirstName} {workout.FamilyMember.LastName}",
            Title = workout.Title,
            StartTime = workout.StartTime,
            EndTime = workout.EndTime,
            Description = workout.Description,
            Exercises = workout.Exercises.Select(e => new WorkoutExerciseDto
            {
                Id = e.Id,
                ExerciseName = e.ExerciseName,
                OrderIndex = e.OrderIndex,
                SupersetGroupId = e.SupersetGroupId,
                Notes = e.Notes,
                Sets = e.Sets.Select(s => new ExerciseSetDto
                {
                    Id = s.Id,
                    SetIndex = s.SetIndex,
                    SetType = s.SetType,
                    WeightLbs = s.WeightLbs,
                    Reps = s.Reps,
                    DistanceMiles = s.DistanceMiles,
                    DurationSeconds = s.DurationSeconds,
                    Rpe = s.Rpe
                }).ToList()
            }).ToList()
        };

        return View(viewModel);
    }

    public async Task<IActionResult> Create()
    {
        var viewModel = new WorkoutCreateDto
        {
            StartTime = DateTime.Now
        };
        ViewBag.FamilyMembers = await GetFamilyMembersSelectList();
        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(WorkoutCreateDto model)
    {
        if (!ModelState.IsValid)
        {
            ViewBag.FamilyMembers = await GetFamilyMembersSelectList();
            return View(model);
        }

        var workout = new Workout
        {
            FamilyMemberId = model.FamilyMemberId,
            Title = model.Title,
            StartTime = ToUtc(model.StartTime),
            EndTime = model.EndTime.HasValue ? ToUtc(model.EndTime.Value) : null,
            Description = model.Description,
            CreatedAt = DateTime.UtcNow
        };

        context.Workouts.Add(workout);
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Workout '{workout.Title}' created successfully!";
        return RedirectToAction(nameof(Details), new { id = workout.Id });
    }

    public async Task<IActionResult> Edit(int id)
    {
        var workout = await context.Workouts.FindAsync(id);
        if (workout == null)
            return NotFound();

        var viewModel = new WorkoutEditDto
        {
            Id = workout.Id,
            FamilyMemberId = workout.FamilyMemberId,
            Title = workout.Title,
            StartTime = workout.StartTime.ToLocalTime(),
            EndTime = workout.EndTime?.ToLocalTime(),
            Description = workout.Description
        };

        ViewBag.FamilyMembers = await GetFamilyMembersSelectList();
        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, WorkoutEditDto model)
    {
        if (id != model.Id)
            return NotFound();

        if (!ModelState.IsValid)
        {
            ViewBag.FamilyMembers = await GetFamilyMembersSelectList();
            return View(model);
        }

        var workout = await context.Workouts.FindAsync(id);
        if (workout == null)
            return NotFound();

        workout.FamilyMemberId = model.FamilyMemberId;
        workout.Title = model.Title;
        workout.StartTime = ToUtc(model.StartTime);
        workout.EndTime = model.EndTime.HasValue ? ToUtc(model.EndTime.Value) : null;
        workout.Description = model.Description;
        workout.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Workout '{workout.Title}' updated successfully!";
        return RedirectToAction(nameof(Details), new { id = workout.Id });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var workout = await context.Workouts.FindAsync(id);
        if (workout == null)
            return NotFound();

        context.Workouts.Remove(workout);
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Workout '{workout.Title}' deleted successfully!";
        return RedirectToAction(nameof(Index));
    }

    // ==================== Exercise Management ====================

    public async Task<IActionResult> AddExercise(int workoutId)
    {
        var workout = await context.Workouts.FindAsync(workoutId);
        if (workout == null)
            return NotFound();

        var nextOrder = await context.WorkoutExercises
            .Where(e => e.WorkoutId == workoutId)
            .MaxAsync(e => (int?)e.OrderIndex) ?? -1;

        var viewModel = new ExerciseCreateDto
        {
            WorkoutId = workoutId,
            OrderIndex = nextOrder + 1
        };

        ViewBag.WorkoutTitle = workout.Title;
        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> AddExercise(ExerciseCreateDto model)
    {
        if (!ModelState.IsValid)
        {
            var workout = await context.Workouts.FindAsync(model.WorkoutId);
            ViewBag.WorkoutTitle = workout?.Title;
            return View(model);
        }

        var exercise = new WorkoutExercise
        {
            WorkoutId = model.WorkoutId,
            ExerciseName = model.ExerciseName,
            OrderIndex = model.OrderIndex,
            SupersetGroupId = model.SupersetGroupId,
            Notes = model.Notes
        };

        context.WorkoutExercises.Add(exercise);
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Exercise '{exercise.ExerciseName}' added!";
        return RedirectToAction(nameof(Details), new { id = model.WorkoutId });
    }

    public async Task<IActionResult> EditExercise(int id)
    {
        var exercise = await context.WorkoutExercises
            .Include(e => e.Workout)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (exercise == null)
            return NotFound();

        var viewModel = new ExerciseEditDto
        {
            Id = exercise.Id,
            WorkoutId = exercise.WorkoutId,
            ExerciseName = exercise.ExerciseName,
            OrderIndex = exercise.OrderIndex,
            SupersetGroupId = exercise.SupersetGroupId,
            Notes = exercise.Notes
        };

        ViewBag.WorkoutTitle = exercise.Workout.Title;
        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> EditExercise(ExerciseEditDto model)
    {
        if (!ModelState.IsValid)
        {
            var workout = await context.Workouts.FindAsync(model.WorkoutId);
            ViewBag.WorkoutTitle = workout?.Title;
            return View(model);
        }

        var exercise = await context.WorkoutExercises.FindAsync(model.Id);
        if (exercise == null)
            return NotFound();

        exercise.ExerciseName = model.ExerciseName;
        exercise.OrderIndex = model.OrderIndex;
        exercise.SupersetGroupId = model.SupersetGroupId;
        exercise.Notes = model.Notes;

        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Exercise '{exercise.ExerciseName}' updated!";
        return RedirectToAction(nameof(Details), new { id = model.WorkoutId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteExercise(int id)
    {
        var exercise = await context.WorkoutExercises.FindAsync(id);
        if (exercise == null)
            return NotFound();

        var workoutId = exercise.WorkoutId;
        var exerciseName = exercise.ExerciseName;

        context.WorkoutExercises.Remove(exercise);
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Exercise '{exerciseName}' deleted!";
        return RedirectToAction(nameof(Details), new { id = workoutId });
    }

    // ==================== Set Management ====================

    public async Task<IActionResult> AddSet(int exerciseId)
    {
        var exercise = await context.WorkoutExercises
            .Include(e => e.Workout)
            .FirstOrDefaultAsync(e => e.Id == exerciseId);

        if (exercise == null)
            return NotFound();

        var nextIndex = await context.ExerciseSets
            .Where(s => s.WorkoutExerciseId == exerciseId)
            .MaxAsync(s => (int?)s.SetIndex) ?? -1;

        var viewModel = new SetCreateDto
        {
            WorkoutExerciseId = exerciseId,
            SetIndex = nextIndex + 1,
            SetType = "normal"
        };

        ViewBag.ExerciseName = exercise.ExerciseName;
        ViewBag.WorkoutId = exercise.WorkoutId;
        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> AddSet(SetCreateDto model)
    {
        var exercise = await context.WorkoutExercises.FindAsync(model.WorkoutExerciseId);
        if (exercise == null)
            return NotFound();

        if (!ModelState.IsValid)
        {
            ViewBag.ExerciseName = exercise.ExerciseName;
            ViewBag.WorkoutId = exercise.WorkoutId;
            return View(model);
        }

        var set = new ExerciseSet
        {
            WorkoutExerciseId = model.WorkoutExerciseId,
            SetIndex = model.SetIndex,
            SetType = model.SetType,
            WeightLbs = model.WeightLbs,
            Reps = model.Reps,
            DistanceMiles = model.DistanceMiles,
            DurationSeconds = model.DurationSeconds,
            Rpe = model.Rpe
        };

        context.ExerciseSets.Add(set);
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = "Set added!";
        return RedirectToAction(nameof(Details), new { id = exercise.WorkoutId });
    }

    public async Task<IActionResult> EditSet(int id)
    {
        var set = await context.ExerciseSets
            .Include(s => s.WorkoutExercise)
                .ThenInclude(e => e.Workout)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (set == null)
            return NotFound();

        var viewModel = new SetEditDto
        {
            Id = set.Id,
            WorkoutExerciseId = set.WorkoutExerciseId,
            SetIndex = set.SetIndex,
            SetType = set.SetType,
            WeightLbs = set.WeightLbs,
            Reps = set.Reps,
            DistanceMiles = set.DistanceMiles,
            DurationSeconds = set.DurationSeconds,
            Rpe = set.Rpe
        };

        ViewBag.ExerciseName = set.WorkoutExercise.ExerciseName;
        ViewBag.WorkoutId = set.WorkoutExercise.WorkoutId;
        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> EditSet(SetEditDto model)
    {
        var set = await context.ExerciseSets
            .Include(s => s.WorkoutExercise)
            .FirstOrDefaultAsync(s => s.Id == model.Id);

        if (set == null)
            return NotFound();

        if (!ModelState.IsValid)
        {
            ViewBag.ExerciseName = set.WorkoutExercise.ExerciseName;
            ViewBag.WorkoutId = set.WorkoutExercise.WorkoutId;
            return View(model);
        }

        set.SetIndex = model.SetIndex;
        set.SetType = model.SetType;
        set.WeightLbs = model.WeightLbs;
        set.Reps = model.Reps;
        set.DistanceMiles = model.DistanceMiles;
        set.DurationSeconds = model.DurationSeconds;
        set.Rpe = model.Rpe;

        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = "Set updated!";
        return RedirectToAction(nameof(Details), new { id = set.WorkoutExercise.WorkoutId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteSet(int id)
    {
        var set = await context.ExerciseSets
            .Include(s => s.WorkoutExercise)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (set == null)
            return NotFound();

        var workoutId = set.WorkoutExercise.WorkoutId;

        context.ExerciseSets.Remove(set);
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = "Set deleted!";
        return RedirectToAction(nameof(Details), new { id = workoutId });
    }

    public async Task<IActionResult> Import()
    {
        var viewModel = new WorkoutImportViewModel
        {
            FamilyMembers = await GetFamilyMembersSelectList()
        };
        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Import(WorkoutImportViewModel model)
    {
        if (!ModelState.IsValid || model.CsvFile == null)
        {
            model.FamilyMembers = await GetFamilyMembersSelectList();
            return View(model);
        }

        using var stream = model.CsvFile.OpenReadStream();
        var preview = await importService.PreviewImportAsync(
            model.FamilyMemberId,
            stream,
            model.CsvFile.FileName);

        if (string.IsNullOrEmpty(preview.FamilyMemberName))
        {
            ModelState.AddModelError("FamilyMemberId", "Family member not found");
            model.FamilyMembers = await GetFamilyMembersSelectList();
            return View(model);
        }

        return View("ImportPreview", preview);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ImportConfirm(WorkoutImportConfirmViewModel model)
    {
        if (!ModelState.IsValid)
        {
            TempData["ErrorMessage"] = "Invalid import request";
            return RedirectToAction(nameof(Import));
        }

        var workouts = importService.GetCachedWorkouts(model.CachedDataKey);
        if (workouts == null)
        {
            TempData["ErrorMessage"] = "Import session expired. Please upload the file again.";
            return RedirectToAction(nameof(Import));
        }

        var result = await importService.ImportWorkoutsAsync(model.FamilyMemberId, workouts);

        importService.RemoveCachedWorkouts(model.CachedDataKey);

        return View("ImportResult", result);
    }

    private async Task<List<SelectListItem>> GetFamilyMembersSelectList()
    {
        return await context.FamilyMembers
            .Where(f => f.IsActive)
            .OrderBy(f => f.LastName)
            .ThenBy(f => f.FirstName)
            .Select(f => new SelectListItem
            {
                Value = f.Id.ToString(),
                Text = $"{f.FirstName} {f.LastName}"
            })
            .ToListAsync();
    }

    private static DateTime ToUtc(DateTime dateTime)
    {
        return dateTime.Kind switch
        {
            DateTimeKind.Utc => dateTime,
            DateTimeKind.Local => dateTime.ToUniversalTime(),
            _ => DateTime.SpecifyKind(dateTime, DateTimeKind.Local).ToUniversalTime()
        };
    }
}
