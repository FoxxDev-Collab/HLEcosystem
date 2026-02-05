using HLE.FamilyHealth.Data;
using HLE.FamilyHealth.Models.Entities;
using HLE.FamilyHealth.Models.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyHealth.Controllers;

[Authorize]
public class FamilyMembersController(ApplicationDbContext context) : Controller
{
    public async Task<IActionResult> Index()
    {
        var members = await context.FamilyMembers
            .AsNoTracking()
            .Include(f => f.HealthProfile)
            .Include(f => f.EmergencyContacts)
            .Include(f => f.InsurancePolicies)
            .OrderBy(f => f.LastName)
            .ThenBy(f => f.FirstName)
            .ToListAsync();

        var viewModel = new FamilyMemberIndexViewModel
        {
            FamilyMembers = members.Select(m => new FamilyMemberSummary
            {
                Id = m.Id,
                FullName = $"{m.FirstName} {m.LastName}",
                DateOfBirth = m.DateOfBirth,
                Age = DateTime.Now.Year - m.DateOfBirth.Year -
                    (DateTime.Now.DayOfYear < m.DateOfBirth.DayOfYear ? 1 : 0),
                Relationship = m.Relationship,
                IsActive = m.IsActive,
                HasHealthProfile = m.HealthProfile != null,
                EmergencyContactsCount = m.EmergencyContacts.Count,
                InsurancePoliciesCount = m.InsurancePolicies.Count(i => i.IsActive)
            }).ToList(),
            TotalMembers = members.Count,
            ActiveMembers = members.Count(m => m.IsActive)
        };

        return View(viewModel);
    }

    public IActionResult Create()
    {
        return View(new FamilyMemberViewModel());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(FamilyMemberViewModel model)
    {
        if (!ModelState.IsValid)
            return View(model);

        var member = new FamilyMember
        {
            FirstName = model.FirstName,
            LastName = model.LastName,
            DateOfBirth = model.DateOfBirth,
            Relationship = model.Relationship,
            Gender = model.Gender,
            IsActive = model.IsActive,
            CreatedAt = DateTime.UtcNow
        };

        context.FamilyMembers.Add(member);
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Family member {member.FirstName} {member.LastName} added successfully!";
        return RedirectToAction(nameof(Index));
    }

    public async Task<IActionResult> Edit(int id)
    {
        var member = await context.FamilyMembers.FindAsync(id);
        if (member == null)
            return NotFound();

        var viewModel = new FamilyMemberViewModel
        {
            Id = member.Id,
            FirstName = member.FirstName,
            LastName = member.LastName,
            DateOfBirth = member.DateOfBirth,
            Relationship = member.Relationship,
            Gender = member.Gender,
            IsActive = member.IsActive
        };

        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, FamilyMemberViewModel model)
    {
        if (id != model.Id)
            return NotFound();

        if (!ModelState.IsValid)
            return View(model);

        var member = await context.FamilyMembers.FindAsync(id);
        if (member == null)
            return NotFound();

        member.FirstName = model.FirstName;
        member.LastName = model.LastName;
        member.DateOfBirth = model.DateOfBirth;
        member.Relationship = model.Relationship;
        member.Gender = model.Gender;
        member.IsActive = model.IsActive;
        member.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Family member {member.FirstName} {member.LastName} updated successfully!";
        return RedirectToAction(nameof(Index));
    }

    public async Task<IActionResult> Details(int id)
    {
        var member = await context.FamilyMembers
            .AsNoTracking()
            .Include(f => f.HealthProfile)
            .Include(f => f.EmergencyContacts)
            .Include(f => f.InsurancePolicies)
            .FirstOrDefaultAsync(f => f.Id == id);

        if (member == null)
            return NotFound();

        return View(member);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var member = await context.FamilyMembers.FindAsync(id);
        if (member == null)
            return NotFound();

        context.FamilyMembers.Remove(member);
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Family member {member.FirstName} {member.LastName} deleted successfully!";
        return RedirectToAction(nameof(Index));
    }
}
