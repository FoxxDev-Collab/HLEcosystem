using HLE.FamilyHealth.Data;
using HLE.FamilyHealth.Models.Entities;
using HLE.FamilyHealth.Models.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyHealth.Controllers;

[Authorize]
public class VisitSummariesController(ApplicationDbContext context) : Controller
{
    public async Task<IActionResult> Index()
    {
        var visits = await context.VisitSummaries
            .AsNoTracking()
            .Include(v => v.FamilyMember)
            .Include(v => v.Provider)
            .Include(v => v.Appointment)
            .OrderByDescending(v => v.VisitDate)
            .ToListAsync();

        var viewModel = new VisitSummaryIndexViewModel
        {
            VisitSummaries = visits.Select(v => new VisitSummaryListDto
            {
                Id = v.Id,
                AppointmentId = v.AppointmentId,
                FamilyMemberId = v.FamilyMemberId,
                FamilyMemberName = $"{v.FamilyMember.FirstName} {v.FamilyMember.LastName}",
                ProviderId = v.ProviderId,
                ProviderName = v.Provider?.Name,
                VisitDate = v.VisitDate,
                ChiefComplaint = v.ChiefComplaint,
                Diagnosis = v.Diagnosis,
                VisitType = v.VisitType,
                NextVisitRecommended = v.NextVisitRecommended
            }).ToList(),
            FamilyMembers = await GetFamilyMembersSelectList(),
            Providers = await GetProvidersSelectList()
        };

        return View(viewModel);
    }

    public async Task<IActionResult> Create(int? appointmentId)
    {
        var viewModel = new VisitSummaryCreateDto
        {
            AppointmentId = appointmentId,
            VisitDate = DateTime.Now
        };

        if (appointmentId.HasValue)
        {
            var appointment = await context.Appointments
                .Include(a => a.FamilyMember)
                .FirstOrDefaultAsync(a => a.Id == appointmentId);

            if (appointment != null)
            {
                viewModel.FamilyMemberId = appointment.FamilyMemberId;
                viewModel.ProviderId = appointment.ProviderId;
                viewModel.VisitDate = appointment.AppointmentDateTime;
                viewModel.ChiefComplaint = appointment.ReasonForVisit;
            }
        }

        ViewBag.FamilyMembers = await GetFamilyMembersSelectList();
        ViewBag.Providers = await GetProvidersSelectList();
        ViewBag.Appointments = await GetAppointmentsSelectList();
        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(VisitSummaryCreateDto model)
    {
        if (!ModelState.IsValid)
        {
            ViewBag.FamilyMembers = await GetFamilyMembersSelectList();
            ViewBag.Providers = await GetProvidersSelectList();
            ViewBag.Appointments = await GetAppointmentsSelectList();
            return View(model);
        }

        var visit = new VisitSummary
        {
            AppointmentId = model.AppointmentId,
            FamilyMemberId = model.FamilyMemberId,
            ProviderId = model.ProviderId,
            VisitDate = DateTime.SpecifyKind(model.VisitDate, DateTimeKind.Utc),
            ChiefComplaint = model.ChiefComplaint,
            Diagnosis = model.Diagnosis,
            TreatmentProvided = model.TreatmentProvided,
            PrescriptionsWritten = model.PrescriptionsWritten,
            LabTestsOrdered = model.LabTestsOrdered,
            FollowUpInstructions = model.FollowUpInstructions,
            NextVisitRecommended = model.NextVisitRecommended.HasValue
                ? DateTime.SpecifyKind(model.NextVisitRecommended.Value, DateTimeKind.Utc)
                : null,
            AttachedDocuments = model.AttachedDocuments,
            Notes = model.Notes,
            VisitType = model.VisitType,
            CreatedAt = DateTime.UtcNow
        };

        context.VisitSummaries.Add(visit);
        await context.SaveChangesAsync();

        // Mark related appointment as completed if it exists
        if (model.AppointmentId.HasValue)
        {
            var appointment = await context.Appointments.FindAsync(model.AppointmentId.Value);
            if (appointment != null && appointment.Status == "Scheduled")
            {
                appointment.Status = "Completed";
                appointment.UpdatedAt = DateTime.UtcNow;
                await context.SaveChangesAsync();
            }
        }

        TempData["SuccessMessage"] = "Visit summary created successfully!";
        return RedirectToAction(nameof(Index));
    }

    public async Task<IActionResult> Edit(int id)
    {
        var visit = await context.VisitSummaries.FindAsync(id);
        if (visit == null)
            return NotFound();

        var viewModel = new VisitSummaryEditDto
        {
            Id = visit.Id,
            AppointmentId = visit.AppointmentId,
            FamilyMemberId = visit.FamilyMemberId,
            ProviderId = visit.ProviderId,
            VisitDate = visit.VisitDate,
            ChiefComplaint = visit.ChiefComplaint,
            Diagnosis = visit.Diagnosis,
            TreatmentProvided = visit.TreatmentProvided,
            PrescriptionsWritten = visit.PrescriptionsWritten,
            LabTestsOrdered = visit.LabTestsOrdered,
            FollowUpInstructions = visit.FollowUpInstructions,
            NextVisitRecommended = visit.NextVisitRecommended,
            AttachedDocuments = visit.AttachedDocuments,
            Notes = visit.Notes,
            VisitType = visit.VisitType
        };

        ViewBag.FamilyMembers = await GetFamilyMembersSelectList();
        ViewBag.Providers = await GetProvidersSelectList();
        ViewBag.Appointments = await GetAppointmentsSelectList();
        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, VisitSummaryEditDto model)
    {
        if (id != model.Id)
            return NotFound();

        if (!ModelState.IsValid)
        {
            ViewBag.FamilyMembers = await GetFamilyMembersSelectList();
            ViewBag.Providers = await GetProvidersSelectList();
            ViewBag.Appointments = await GetAppointmentsSelectList();
            return View(model);
        }

        var visit = await context.VisitSummaries.FindAsync(id);
        if (visit == null)
            return NotFound();

        visit.AppointmentId = model.AppointmentId;
        visit.FamilyMemberId = model.FamilyMemberId;
        visit.ProviderId = model.ProviderId;
        visit.VisitDate = DateTime.SpecifyKind(model.VisitDate, DateTimeKind.Utc);
        visit.ChiefComplaint = model.ChiefComplaint;
        visit.Diagnosis = model.Diagnosis;
        visit.TreatmentProvided = model.TreatmentProvided;
        visit.PrescriptionsWritten = model.PrescriptionsWritten;
        visit.LabTestsOrdered = model.LabTestsOrdered;
        visit.FollowUpInstructions = model.FollowUpInstructions;
        visit.NextVisitRecommended = model.NextVisitRecommended.HasValue
            ? DateTime.SpecifyKind(model.NextVisitRecommended.Value, DateTimeKind.Utc)
            : null;
        visit.AttachedDocuments = model.AttachedDocuments;
        visit.Notes = model.Notes;
        visit.VisitType = model.VisitType;
        visit.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = "Visit summary updated successfully!";
        return RedirectToAction(nameof(Index));
    }

    public async Task<IActionResult> Details(int id)
    {
        var visit = await context.VisitSummaries
            .AsNoTracking()
            .Include(v => v.FamilyMember)
            .Include(v => v.Provider)
            .Include(v => v.Appointment)
            .FirstOrDefaultAsync(v => v.Id == id);

        if (visit == null)
            return NotFound();

        return View(visit);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var visit = await context.VisitSummaries.FindAsync(id);
        if (visit == null)
            return NotFound();

        context.VisitSummaries.Remove(visit);
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = "Visit summary deleted successfully!";
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

    private async Task<List<SelectListItem>> GetProvidersSelectList()
    {
        var providers = await context.Providers
            .Where(p => p.IsActive)
            .OrderBy(p => p.Name)
            .Select(p => new SelectListItem
            {
                Value = p.Id.ToString(),
                Text = p.Name
            })
            .ToListAsync();

        providers.Insert(0, new SelectListItem { Value = "", Text = "No provider selected" });
        return providers;
    }

    private async Task<List<SelectListItem>> GetAppointmentsSelectList()
    {
        var appointments = await context.Appointments
            .Where(a => a.Status == "Scheduled" && a.VisitSummary == null)
            .OrderByDescending(a => a.AppointmentDateTime)
            .Include(a => a.FamilyMember)
            .Select(a => new SelectListItem
            {
                Value = a.Id.ToString(),
                Text = $"{a.FamilyMember.FirstName} {a.FamilyMember.LastName} - {a.AppointmentDateTime:MMM dd, yyyy}"
            })
            .ToListAsync();

        appointments.Insert(0, new SelectListItem { Value = "", Text = "No related appointment" });
        return appointments;
    }
}
