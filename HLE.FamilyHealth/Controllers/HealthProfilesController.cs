using HLE.FamilyHealth.Data;
using HLE.FamilyHealth.Models.Entities;
using HLE.FamilyHealth.Models.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyHealth.Controllers;

[Authorize]
public class HealthProfilesController(ApplicationDbContext context) : Controller
{
    public async Task<IActionResult> Index()
    {
        var profiles = await context.HealthProfiles
            .AsNoTracking()
            .Include(h => h.FamilyMember)
            .OrderBy(h => h.FamilyMember.LastName)
            .ThenBy(h => h.FamilyMember.FirstName)
            .ToListAsync();

        var viewModel = new HealthProfileIndexViewModel
        {
            HealthProfiles = profiles.Select(p => new HealthProfileSummary
            {
                Id = p.Id,
                FamilyMemberId = p.FamilyMemberId,
                FamilyMemberName = $"{p.FamilyMember.FirstName} {p.FamilyMember.LastName}",
                BloodType = p.BloodType,
                HasAllergies = !string.IsNullOrWhiteSpace(p.Allergies),
                HasChronicConditions = !string.IsNullOrWhiteSpace(p.ChronicConditions),
                PrimaryCareProvider = p.PrimaryCareProvider
            }).ToList(),
            TotalProfiles = profiles.Count,
            ProfilesWithAllergies = profiles.Count(p => !string.IsNullOrWhiteSpace(p.Allergies))
        };

        return View(viewModel);
    }

    public async Task<IActionResult> Create()
    {
        await PopulateFamilyMembersDropdown();
        return View(new HealthProfileViewModel());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(HealthProfileViewModel model)
    {
        if (!ModelState.IsValid)
        {
            await PopulateFamilyMembersDropdown();
            return View(model);
        }

        // Check if profile already exists for this family member
        var exists = await context.HealthProfiles.AnyAsync(h => h.FamilyMemberId == model.FamilyMemberId);
        if (exists)
        {
            ModelState.AddModelError("FamilyMemberId", "A health profile already exists for this family member.");
            await PopulateFamilyMembersDropdown();
            return View(model);
        }

        var profile = new HealthProfile
        {
            FamilyMemberId = model.FamilyMemberId,
            BloodType = model.BloodType,
            HeightCm = model.HeightCm,
            WeightKg = model.WeightKg,
            Allergies = model.Allergies,
            ChronicConditions = model.ChronicConditions,
            MajorSurgeries = model.MajorSurgeries,
            PrimaryCareProvider = model.PrimaryCareProvider,
            PreferredHospital = model.PreferredHospital,
            MedicalNotes = model.MedicalNotes,
            IsOrganDonor = model.IsOrganDonor,
            CreatedAt = DateTime.UtcNow
        };

        context.HealthProfiles.Add(profile);
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = "Health profile created successfully!";
        return RedirectToAction(nameof(Index));
    }

    public async Task<IActionResult> Edit(int id)
    {
        var profile = await context.HealthProfiles
            .Include(h => h.FamilyMember)
            .FirstOrDefaultAsync(h => h.Id == id);

        if (profile == null)
            return NotFound();

        var viewModel = new HealthProfileViewModel
        {
            Id = profile.Id,
            FamilyMemberId = profile.FamilyMemberId,
            BloodType = profile.BloodType,
            HeightCm = profile.HeightCm,
            WeightKg = profile.WeightKg,
            Allergies = profile.Allergies,
            ChronicConditions = profile.ChronicConditions,
            MajorSurgeries = profile.MajorSurgeries,
            PrimaryCareProvider = profile.PrimaryCareProvider,
            PreferredHospital = profile.PreferredHospital,
            MedicalNotes = profile.MedicalNotes,
            IsOrganDonor = profile.IsOrganDonor
        };

        await PopulateFamilyMembersDropdown(profile.FamilyMemberId);
        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, HealthProfileViewModel model)
    {
        if (id != model.Id)
            return NotFound();

        if (!ModelState.IsValid)
        {
            await PopulateFamilyMembersDropdown(model.FamilyMemberId);
            return View(model);
        }

        var profile = await context.HealthProfiles.FindAsync(id);
        if (profile == null)
            return NotFound();

        profile.BloodType = model.BloodType;
        profile.HeightCm = model.HeightCm;
        profile.WeightKg = model.WeightKg;
        profile.Allergies = model.Allergies;
        profile.ChronicConditions = model.ChronicConditions;
        profile.MajorSurgeries = model.MajorSurgeries;
        profile.PrimaryCareProvider = model.PrimaryCareProvider;
        profile.PreferredHospital = model.PreferredHospital;
        profile.MedicalNotes = model.MedicalNotes;
        profile.IsOrganDonor = model.IsOrganDonor;
        profile.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = "Health profile updated successfully!";
        return RedirectToAction(nameof(Index));
    }

    public async Task<IActionResult> Details(int id)
    {
        var profile = await context.HealthProfiles
            .AsNoTracking()
            .Include(h => h.FamilyMember)
            .FirstOrDefaultAsync(h => h.Id == id);

        if (profile == null)
            return NotFound();

        return View(profile);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var profile = await context.HealthProfiles.FindAsync(id);
        if (profile == null)
            return NotFound();

        context.HealthProfiles.Remove(profile);
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = "Health profile deleted successfully!";
        return RedirectToAction(nameof(Index));
    }

    private async Task PopulateFamilyMembersDropdown(int? selectedId = null)
    {
        var members = await context.FamilyMembers
            .Where(f => f.IsActive)
            .OrderBy(f => f.LastName)
            .ThenBy(f => f.FirstName)
            .Select(f => new
            {
                f.Id,
                Name = $"{f.FirstName} {f.LastName}"
            })
            .ToListAsync();

        ViewBag.FamilyMembers = new SelectList(members, "Id", "Name", selectedId);
    }
}
