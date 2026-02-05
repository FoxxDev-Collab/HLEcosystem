using HLE.FamilyHealth.Data;
using HLE.FamilyHealth.Models.Entities;
using HLE.FamilyHealth.Models.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyHealth.Controllers;

[Authorize]
public class EmergencyContactsController(ApplicationDbContext context) : Controller
{
    public async Task<IActionResult> Index()
    {
        var contacts = await context.EmergencyContacts
            .AsNoTracking()
            .Include(e => e.FamilyMember)
            .OrderBy(e => e.FamilyMember.LastName)
            .ThenBy(e => e.Priority)
            .ToListAsync();

        var viewModel = new EmergencyContactIndexViewModel
        {
            EmergencyContacts = contacts.Select(c => new EmergencyContactSummary
            {
                Id = c.Id,
                FamilyMemberId = c.FamilyMemberId,
                FamilyMemberName = $"{c.FamilyMember.FirstName} {c.FamilyMember.LastName}",
                Name = c.Name,
                Relationship = c.Relationship,
                PhoneNumber = c.PhoneNumber,
                Priority = c.Priority
            }).ToList(),
            TotalContacts = contacts.Count
        };

        return View(viewModel);
    }

    public async Task<IActionResult> Create()
    {
        await PopulateFamilyMembersDropdown();
        return View(new EmergencyContactViewModel());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(EmergencyContactViewModel model)
    {
        if (!ModelState.IsValid)
        {
            await PopulateFamilyMembersDropdown();
            return View(model);
        }

        var contact = new EmergencyContact
        {
            FamilyMemberId = model.FamilyMemberId,
            Name = model.Name,
            Relationship = model.Relationship,
            PhoneNumber = model.PhoneNumber,
            AlternatePhone = model.AlternatePhone,
            Email = model.Email,
            Address = model.Address,
            Priority = model.Priority,
            CreatedAt = DateTime.UtcNow
        };

        context.EmergencyContacts.Add(contact);
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Emergency contact {contact.Name} added successfully!";
        return RedirectToAction(nameof(Index));
    }

    public async Task<IActionResult> Edit(int id)
    {
        var contact = await context.EmergencyContacts
            .Include(e => e.FamilyMember)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (contact == null)
            return NotFound();

        var viewModel = new EmergencyContactViewModel
        {
            Id = contact.Id,
            FamilyMemberId = contact.FamilyMemberId,
            Name = contact.Name,
            Relationship = contact.Relationship,
            PhoneNumber = contact.PhoneNumber,
            AlternatePhone = contact.AlternatePhone,
            Email = contact.Email,
            Address = contact.Address,
            Priority = contact.Priority
        };

        await PopulateFamilyMembersDropdown(contact.FamilyMemberId);
        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, EmergencyContactViewModel model)
    {
        if (id != model.Id)
            return NotFound();

        if (!ModelState.IsValid)
        {
            await PopulateFamilyMembersDropdown(model.FamilyMemberId);
            return View(model);
        }

        var contact = await context.EmergencyContacts.FindAsync(id);
        if (contact == null)
            return NotFound();

        contact.Name = model.Name;
        contact.Relationship = model.Relationship;
        contact.PhoneNumber = model.PhoneNumber;
        contact.AlternatePhone = model.AlternatePhone;
        contact.Email = model.Email;
        contact.Address = model.Address;
        contact.Priority = model.Priority;
        contact.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Emergency contact {contact.Name} updated successfully!";
        return RedirectToAction(nameof(Index));
    }

    public async Task<IActionResult> Details(int id)
    {
        var contact = await context.EmergencyContacts
            .AsNoTracking()
            .Include(e => e.FamilyMember)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (contact == null)
            return NotFound();

        return View(contact);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var contact = await context.EmergencyContacts.FindAsync(id);
        if (contact == null)
            return NotFound();

        context.EmergencyContacts.Remove(contact);
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Emergency contact {contact.Name} deleted successfully!";
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
