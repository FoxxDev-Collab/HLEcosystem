using HLE.FamilyHealth.Data;
using HLE.FamilyHealth.Models.Entities;
using HLE.FamilyHealth.Models.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyHealth.Controllers;

[Authorize]
public class VaccinationsController(ApplicationDbContext context) : Controller
{
    public async Task<IActionResult> Index()
    {
        var vaccinations = await context.Vaccinations
            .AsNoTracking()
            .Include(v => v.FamilyMember)
            .OrderBy(v => v.FamilyMember.LastName)
            .ThenBy(v => v.FamilyMember.FirstName)
            .ThenByDescending(v => v.DateAdministered)
            .ToListAsync();

        var today = DateOnly.FromDateTime(DateTime.Now);
        var upcomingDoses = vaccinations
            .Where(v => v.NextDoseDate.HasValue && v.NextDoseDate.Value > today)
            .OrderBy(v => v.NextDoseDate)
            .ToList();

        var viewModel = new VaccinationIndexViewModel
        {
            Vaccinations = vaccinations.Select(v => new VaccinationListDto
            {
                Id = v.Id,
                FamilyMemberId = v.FamilyMemberId,
                FamilyMemberName = $"{v.FamilyMember.FirstName} {v.FamilyMember.LastName}",
                VaccineName = v.VaccineName,
                DoseNumber = v.DoseNumber,
                DateAdministered = v.DateAdministered,
                NextDoseDate = v.NextDoseDate,
                DaysUntilNextDose = v.NextDoseDate.HasValue
                    ? v.NextDoseDate.Value.DayNumber - today.DayNumber
                    : null
            }).ToList(),
            UpcomingDoses = upcomingDoses.Select(v => new VaccinationListDto
            {
                Id = v.Id,
                FamilyMemberId = v.FamilyMemberId,
                FamilyMemberName = $"{v.FamilyMember.FirstName} {v.FamilyMember.LastName}",
                VaccineName = v.VaccineName,
                DoseNumber = v.DoseNumber,
                DateAdministered = v.DateAdministered,
                NextDoseDate = v.NextDoseDate,
                DaysUntilNextDose = v.NextDoseDate.HasValue
                    ? v.NextDoseDate.Value.DayNumber - today.DayNumber
                    : null
            }).ToList(),
            FamilyMembers = await GetFamilyMembersSelectList()
        };

        return View(viewModel);
    }

    public async Task<IActionResult> Create()
    {
        var viewModel = new VaccinationCreateDto
        {
            DateAdministered = DateOnly.FromDateTime(DateTime.Now)
        };
        ViewBag.FamilyMembers = await GetFamilyMembersSelectList();
        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(VaccinationCreateDto model)
    {
        if (!ModelState.IsValid)
        {
            ViewBag.FamilyMembers = await GetFamilyMembersSelectList();
            return View(model);
        }

        var vaccination = new Vaccination
        {
            FamilyMemberId = model.FamilyMemberId,
            VaccineName = model.VaccineName,
            DoseNumber = model.DoseNumber,
            DateAdministered = model.DateAdministered,
            NextDoseDate = model.NextDoseDate,
            AdministeredBy = model.AdministeredBy,
            LotNumber = model.LotNumber,
            Notes = model.Notes,
            CreatedAt = DateTime.UtcNow
        };

        context.Vaccinations.Add(vaccination);
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Vaccination '{vaccination.VaccineName}' added successfully!";
        return RedirectToAction(nameof(Index));
    }

    public async Task<IActionResult> Edit(int id)
    {
        var vaccination = await context.Vaccinations.FindAsync(id);
        if (vaccination == null)
            return NotFound();

        var viewModel = new VaccinationEditDto
        {
            Id = vaccination.Id,
            FamilyMemberId = vaccination.FamilyMemberId,
            VaccineName = vaccination.VaccineName,
            DoseNumber = vaccination.DoseNumber,
            DateAdministered = vaccination.DateAdministered,
            NextDoseDate = vaccination.NextDoseDate,
            AdministeredBy = vaccination.AdministeredBy,
            LotNumber = vaccination.LotNumber,
            Notes = vaccination.Notes
        };

        ViewBag.FamilyMembers = await GetFamilyMembersSelectList();
        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, VaccinationEditDto model)
    {
        if (id != model.Id)
            return NotFound();

        if (!ModelState.IsValid)
        {
            ViewBag.FamilyMembers = await GetFamilyMembersSelectList();
            return View(model);
        }

        var vaccination = await context.Vaccinations.FindAsync(id);
        if (vaccination == null)
            return NotFound();

        vaccination.FamilyMemberId = model.FamilyMemberId;
        vaccination.VaccineName = model.VaccineName;
        vaccination.DoseNumber = model.DoseNumber;
        vaccination.DateAdministered = model.DateAdministered;
        vaccination.NextDoseDate = model.NextDoseDate;
        vaccination.AdministeredBy = model.AdministeredBy;
        vaccination.LotNumber = model.LotNumber;
        vaccination.Notes = model.Notes;
        vaccination.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Vaccination '{vaccination.VaccineName}' updated successfully!";
        return RedirectToAction(nameof(Index));
    }

    public async Task<IActionResult> Details(int id)
    {
        var vaccination = await context.Vaccinations
            .AsNoTracking()
            .Include(v => v.FamilyMember)
            .FirstOrDefaultAsync(v => v.Id == id);

        if (vaccination == null)
            return NotFound();

        return View(vaccination);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var vaccination = await context.Vaccinations.FindAsync(id);
        if (vaccination == null)
            return NotFound();

        context.Vaccinations.Remove(vaccination);
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Vaccination '{vaccination.VaccineName}' deleted successfully!";
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
