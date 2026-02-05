using HLE.FamilyHealth.Data;
using HLE.FamilyHealth.Models.Entities;
using HLE.FamilyHealth.Models.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyHealth.Controllers;

[Authorize]
public class AppointmentsController(ApplicationDbContext context) : Controller
{
    public async Task<IActionResult> Calendar(int? year, int? month)
    {
        var now = DateTime.UtcNow;
        var targetYear = year ?? now.Year;
        var targetMonth = month ?? now.Month;

        var startDate = new DateTime(targetYear, targetMonth, 1, 0, 0, 0, DateTimeKind.Utc);
        var endDate = startDate.AddMonths(1);

        var appointments = await context.Appointments
            .AsNoTracking()
            .Include(a => a.FamilyMember)
            .Include(a => a.Provider)
            .Where(a => a.AppointmentDateTime >= startDate && a.AppointmentDateTime < endDate)
            .OrderBy(a => a.AppointmentDateTime)
            .ToListAsync();

        var viewModel = new AppointmentCalendarViewModel
        {
            Year = targetYear,
            Month = targetMonth,
            Appointments = appointments.Select(a => new AppointmentCalendarDto
            {
                Id = a.Id,
                FamilyMemberName = $"{a.FamilyMember.FirstName} {a.FamilyMember.LastName}",
                AppointmentDateTime = a.AppointmentDateTime,
                DurationMinutes = a.DurationMinutes,
                AppointmentType = a.AppointmentType,
                Status = a.Status,
                ProviderName = a.Provider != null ? a.Provider.Name : null
            }).ToList(),
            FamilyMembers = await GetFamilyMembersSelectList()
        };

        return View(viewModel);
    }

    public async Task<IActionResult> Index()
    {
        var today = DateTime.UtcNow.Date;
        var appointments = await context.Appointments
            .AsNoTracking()
            .Include(a => a.FamilyMember)
            .Include(a => a.Provider)
            .Include(a => a.VisitSummary)
            .OrderBy(a => a.AppointmentDateTime)
            .ToListAsync();

        var viewModel = new AppointmentIndexViewModel
        {
            UpcomingAppointments = appointments
                .Where(a => a.AppointmentDateTime.Date >= today)
                .Select(a => MapToListDto(a, today))
                .ToList(),
            PastAppointments = appointments
                .Where(a => a.AppointmentDateTime.Date < today)
                .OrderByDescending(a => a.AppointmentDateTime)
                .Select(a => MapToListDto(a, today))
                .ToList(),
            FamilyMembers = await GetFamilyMembersSelectList(),
            Providers = await GetProvidersSelectList()
        };

        return View(viewModel);
    }

    public async Task<IActionResult> Create()
    {
        var viewModel = new AppointmentCreateDto();
        ViewBag.FamilyMembers = await GetFamilyMembersSelectList();
        ViewBag.Providers = await GetProvidersSelectList();
        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(AppointmentCreateDto model)
    {
        if (!ModelState.IsValid)
        {
            ViewBag.FamilyMembers = await GetFamilyMembersSelectList();
            ViewBag.Providers = await GetProvidersSelectList();
            return View(model);
        }

        var appointment = new Appointment
        {
            FamilyMemberId = model.FamilyMemberId,
            ProviderId = model.ProviderId,
            AppointmentDateTime = DateTime.SpecifyKind(model.AppointmentDateTime, DateTimeKind.Utc),
            DurationMinutes = model.DurationMinutes,
            AppointmentType = model.AppointmentType,
            Status = model.Status,
            Location = model.Location,
            ReasonForVisit = model.ReasonForVisit,
            PreAppointmentNotes = model.PreAppointmentNotes,
            CreatedAt = DateTime.UtcNow
        };

        context.Appointments.Add(appointment);
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = "Appointment scheduled successfully!";
        return RedirectToAction(nameof(Calendar));
    }

    public async Task<IActionResult> Edit(int id)
    {
        var appointment = await context.Appointments.FindAsync(id);
        if (appointment == null)
            return NotFound();

        var viewModel = new AppointmentEditDto
        {
            Id = appointment.Id,
            FamilyMemberId = appointment.FamilyMemberId,
            ProviderId = appointment.ProviderId,
            AppointmentDateTime = appointment.AppointmentDateTime,
            DurationMinutes = appointment.DurationMinutes,
            AppointmentType = appointment.AppointmentType,
            Status = appointment.Status,
            Location = appointment.Location,
            ReasonForVisit = appointment.ReasonForVisit,
            PreAppointmentNotes = appointment.PreAppointmentNotes,
            ReminderSent = appointment.ReminderSent
        };

        ViewBag.FamilyMembers = await GetFamilyMembersSelectList();
        ViewBag.Providers = await GetProvidersSelectList();
        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, AppointmentEditDto model)
    {
        if (id != model.Id)
            return NotFound();

        if (!ModelState.IsValid)
        {
            ViewBag.FamilyMembers = await GetFamilyMembersSelectList();
            ViewBag.Providers = await GetProvidersSelectList();
            return View(model);
        }

        var appointment = await context.Appointments.FindAsync(id);
        if (appointment == null)
            return NotFound();

        appointment.FamilyMemberId = model.FamilyMemberId;
        appointment.ProviderId = model.ProviderId;
        appointment.AppointmentDateTime = DateTime.SpecifyKind(model.AppointmentDateTime, DateTimeKind.Utc);
        appointment.DurationMinutes = model.DurationMinutes;
        appointment.AppointmentType = model.AppointmentType;
        appointment.Status = model.Status;
        appointment.Location = model.Location;
        appointment.ReasonForVisit = model.ReasonForVisit;
        appointment.PreAppointmentNotes = model.PreAppointmentNotes;
        appointment.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = "Appointment updated successfully!";
        return RedirectToAction(nameof(Calendar));
    }

    public async Task<IActionResult> Details(int id)
    {
        var appointment = await context.Appointments
            .AsNoTracking()
            .Include(a => a.FamilyMember)
            .Include(a => a.Provider)
            .Include(a => a.VisitSummary)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (appointment == null)
            return NotFound();

        return View(appointment);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var appointment = await context.Appointments.FindAsync(id);
        if (appointment == null)
            return NotFound();

        context.Appointments.Remove(appointment);
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = "Appointment deleted successfully!";
        return RedirectToAction(nameof(Calendar));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> MarkComplete(int id)
    {
        var appointment = await context.Appointments.FindAsync(id);
        if (appointment == null)
            return NotFound();

        appointment.Status = "Completed";
        appointment.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = "Appointment marked as completed!";
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

    private static AppointmentListDto MapToListDto(Appointment a, DateTime today)
    {
        var daysUntil = (a.AppointmentDateTime.Date - today).Days;
        return new AppointmentListDto
        {
            Id = a.Id,
            FamilyMemberId = a.FamilyMemberId,
            FamilyMemberName = $"{a.FamilyMember.FirstName} {a.FamilyMember.LastName}",
            ProviderId = a.ProviderId,
            ProviderName = a.Provider?.Name,
            AppointmentDateTime = a.AppointmentDateTime,
            DurationMinutes = a.DurationMinutes,
            AppointmentType = a.AppointmentType,
            Status = a.Status,
            Location = a.Location,
            ReasonForVisit = a.ReasonForVisit,
            ReminderSent = a.ReminderSent,
            DaysUntilAppointment = daysUntil,
            HasVisitSummary = a.VisitSummary != null
        };
    }
}
