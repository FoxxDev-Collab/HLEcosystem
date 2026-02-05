using HLE.FamilyHealth.Data;
using HLE.FamilyHealth.Models.Entities;
using HLE.FamilyHealth.Models.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyHealth.Controllers;

[Authorize]
public class MedicationsController(ApplicationDbContext context) : Controller
{
    public async Task<IActionResult> Index()
    {
        var medications = await context.Medications
            .AsNoTracking()
            .Include(m => m.FamilyMember)
            .OrderBy(m => m.FamilyMember.LastName)
            .ThenBy(m => m.FamilyMember.FirstName)
            .ThenBy(m => m.MedicationName)
            .ToListAsync();

        var today = DateOnly.FromDateTime(DateTime.Now);
        var refillAlerts = medications
            .Where(m => m.IsActive && m.NextRefillDate.HasValue && m.NextRefillDate.Value <= today.AddDays(14))
            .OrderBy(m => m.NextRefillDate)
            .ToList();

        var viewModel = new MedicationIndexViewModel
        {
            ActiveMedications = medications.Where(m => m.IsActive).Select(m => new MedicationListDto
            {
                Id = m.Id,
                FamilyMemberId = m.FamilyMemberId,
                FamilyMemberName = $"{m.FamilyMember.FirstName} {m.FamilyMember.LastName}",
                MedicationName = m.MedicationName,
                Dosage = m.Dosage,
                Frequency = m.Frequency,
                IsActive = m.IsActive,
                NextRefillDate = m.NextRefillDate,
                DaysUntilRefill = m.NextRefillDate.HasValue
                    ? m.NextRefillDate.Value.DayNumber - today.DayNumber
                    : null,
                RefillsRemaining = m.RefillsRemaining
            }).ToList(),
            InactiveMedications = medications.Where(m => !m.IsActive).Select(m => new MedicationListDto
            {
                Id = m.Id,
                FamilyMemberId = m.FamilyMemberId,
                FamilyMemberName = $"{m.FamilyMember.FirstName} {m.FamilyMember.LastName}",
                MedicationName = m.MedicationName,
                Dosage = m.Dosage,
                Frequency = m.Frequency,
                IsActive = m.IsActive,
                NextRefillDate = m.NextRefillDate,
                DaysUntilRefill = m.NextRefillDate.HasValue
                    ? m.NextRefillDate.Value.DayNumber - today.DayNumber
                    : null,
                RefillsRemaining = m.RefillsRemaining
            }).ToList(),
            RefillAlerts = refillAlerts.Select(m => new MedicationListDto
            {
                Id = m.Id,
                FamilyMemberId = m.FamilyMemberId,
                FamilyMemberName = $"{m.FamilyMember.FirstName} {m.FamilyMember.LastName}",
                MedicationName = m.MedicationName,
                Dosage = m.Dosage,
                Frequency = m.Frequency,
                IsActive = m.IsActive,
                NextRefillDate = m.NextRefillDate,
                DaysUntilRefill = m.NextRefillDate.HasValue
                    ? m.NextRefillDate.Value.DayNumber - today.DayNumber
                    : null,
                RefillsRemaining = m.RefillsRemaining
            }).ToList(),
            FamilyMembers = await GetFamilyMembersSelectList()
        };

        return View(viewModel);
    }

    public async Task<IActionResult> Create()
    {
        var viewModel = new MedicationCreateDto();
        ViewBag.FamilyMembers = await GetFamilyMembersSelectList();
        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(MedicationCreateDto model)
    {
        if (!ModelState.IsValid)
        {
            ViewBag.FamilyMembers = await GetFamilyMembersSelectList();
            return View(model);
        }

        var medication = new Medication
        {
            FamilyMemberId = model.FamilyMemberId,
            MedicationName = model.MedicationName,
            Dosage = model.Dosage,
            Frequency = model.Frequency,
            StartDate = model.StartDate,
            EndDate = model.EndDate,
            IsActive = model.IsActive,
            PrescribedBy = model.PrescribedBy,
            Pharmacy = model.Pharmacy,
            LastRefillDate = model.LastRefillDate,
            NextRefillDate = model.NextRefillDate,
            RefillsRemaining = model.RefillsRemaining,
            Purpose = model.Purpose,
            SideEffects = model.SideEffects,
            Notes = model.Notes,
            CreatedAt = DateTime.UtcNow
        };

        context.Medications.Add(medication);
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Medication '{medication.MedicationName}' added successfully!";
        return RedirectToAction(nameof(Index));
    }

    public async Task<IActionResult> Edit(int id)
    {
        var medication = await context.Medications.FindAsync(id);
        if (medication == null)
            return NotFound();

        var viewModel = new MedicationEditDto
        {
            Id = medication.Id,
            FamilyMemberId = medication.FamilyMemberId,
            MedicationName = medication.MedicationName,
            Dosage = medication.Dosage,
            Frequency = medication.Frequency,
            StartDate = medication.StartDate,
            EndDate = medication.EndDate,
            IsActive = medication.IsActive,
            PrescribedBy = medication.PrescribedBy,
            Pharmacy = medication.Pharmacy,
            LastRefillDate = medication.LastRefillDate,
            NextRefillDate = medication.NextRefillDate,
            RefillsRemaining = medication.RefillsRemaining,
            Purpose = medication.Purpose,
            SideEffects = medication.SideEffects,
            Notes = medication.Notes
        };

        ViewBag.FamilyMembers = await GetFamilyMembersSelectList();
        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, MedicationEditDto model)
    {
        if (id != model.Id)
            return NotFound();

        if (!ModelState.IsValid)
        {
            ViewBag.FamilyMembers = await GetFamilyMembersSelectList();
            return View(model);
        }

        var medication = await context.Medications.FindAsync(id);
        if (medication == null)
            return NotFound();

        medication.FamilyMemberId = model.FamilyMemberId;
        medication.MedicationName = model.MedicationName;
        medication.Dosage = model.Dosage;
        medication.Frequency = model.Frequency;
        medication.StartDate = model.StartDate;
        medication.EndDate = model.EndDate;
        medication.IsActive = model.IsActive;
        medication.PrescribedBy = model.PrescribedBy;
        medication.Pharmacy = model.Pharmacy;
        medication.LastRefillDate = model.LastRefillDate;
        medication.NextRefillDate = model.NextRefillDate;
        medication.RefillsRemaining = model.RefillsRemaining;
        medication.Purpose = model.Purpose;
        medication.SideEffects = model.SideEffects;
        medication.Notes = model.Notes;
        medication.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Medication '{medication.MedicationName}' updated successfully!";
        return RedirectToAction(nameof(Index));
    }

    public async Task<IActionResult> Details(int id)
    {
        var medication = await context.Medications
            .AsNoTracking()
            .Include(m => m.FamilyMember)
            .FirstOrDefaultAsync(m => m.Id == id);

        if (medication == null)
            return NotFound();

        return View(medication);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var medication = await context.Medications.FindAsync(id);
        if (medication == null)
            return NotFound();

        context.Medications.Remove(medication);
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Medication '{medication.MedicationName}' deleted successfully!";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ToggleActive(int id)
    {
        var medication = await context.Medications.FindAsync(id);
        if (medication == null)
            return NotFound();

        medication.IsActive = !medication.IsActive;
        medication.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Medication '{medication.MedicationName}' marked as {(medication.IsActive ? "active" : "inactive")}.";
        return RedirectToAction(nameof(Index));
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
}
