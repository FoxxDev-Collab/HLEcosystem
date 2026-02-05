using HLE.FamilyHealth.Data;
using HLE.FamilyHealth.Models.Entities;
using HLE.FamilyHealth.Models.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyHealth.Controllers;

[Authorize]
public class InsuranceController(ApplicationDbContext context) : Controller
{
    public async Task<IActionResult> Index()
    {
        var policies = await context.InsurancePolicies
            .AsNoTracking()
            .Include(i => i.FamilyMember)
            .OrderBy(i => i.FamilyMember.LastName)
            .ThenBy(i => i.InsuranceType)
            .ToListAsync();

        var viewModel = new InsuranceIndexViewModel
        {
            InsurancePolicies = policies.Select(p => new InsuranceSummary
            {
                Id = p.Id,
                FamilyMemberId = p.FamilyMemberId,
                FamilyMemberName = $"{p.FamilyMember.FirstName} {p.FamilyMember.LastName}",
                ProviderName = p.ProviderName,
                PolicyNumber = p.PolicyNumber,
                InsuranceType = p.InsuranceType,
                ExpirationDate = p.ExpirationDate,
                IsActive = p.IsActive
            }).ToList(),
            TotalPolicies = policies.Count,
            ActivePolicies = policies.Count(p => p.IsActive)
        };

        return View(viewModel);
    }

    public async Task<IActionResult> Create()
    {
        await PopulateFamilyMembersDropdown();
        return View(new InsuranceViewModel());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(InsuranceViewModel model)
    {
        if (!ModelState.IsValid)
        {
            await PopulateFamilyMembersDropdown();
            return View(model);
        }

        var insurance = new Insurance
        {
            FamilyMemberId = model.FamilyMemberId,
            ProviderName = model.ProviderName,
            PolicyNumber = model.PolicyNumber,
            GroupNumber = model.GroupNumber,
            PolicyHolderName = model.PolicyHolderName,
            InsuranceType = model.InsuranceType,
            PhoneNumber = model.PhoneNumber,
            Website = model.Website,
            EffectiveDate = model.EffectiveDate,
            ExpirationDate = model.ExpirationDate,
            Deductible = model.Deductible,
            OutOfPocketMax = model.OutOfPocketMax,
            Copay = model.Copay,
            Notes = model.Notes,
            IsActive = model.IsActive,
            CreatedAt = DateTime.UtcNow
        };

        context.InsurancePolicies.Add(insurance);
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Insurance policy for {insurance.ProviderName} added successfully!";
        return RedirectToAction(nameof(Index));
    }

    public async Task<IActionResult> Edit(int id)
    {
        var insurance = await context.InsurancePolicies
            .Include(i => i.FamilyMember)
            .FirstOrDefaultAsync(i => i.Id == id);

        if (insurance == null)
            return NotFound();

        var viewModel = new InsuranceViewModel
        {
            Id = insurance.Id,
            FamilyMemberId = insurance.FamilyMemberId,
            ProviderName = insurance.ProviderName,
            PolicyNumber = insurance.PolicyNumber,
            GroupNumber = insurance.GroupNumber,
            PolicyHolderName = insurance.PolicyHolderName,
            InsuranceType = insurance.InsuranceType,
            PhoneNumber = insurance.PhoneNumber,
            Website = insurance.Website,
            EffectiveDate = insurance.EffectiveDate,
            ExpirationDate = insurance.ExpirationDate,
            Deductible = insurance.Deductible,
            OutOfPocketMax = insurance.OutOfPocketMax,
            Copay = insurance.Copay,
            Notes = insurance.Notes,
            IsActive = insurance.IsActive
        };

        await PopulateFamilyMembersDropdown(insurance.FamilyMemberId);
        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, InsuranceViewModel model)
    {
        if (id != model.Id)
            return NotFound();

        if (!ModelState.IsValid)
        {
            await PopulateFamilyMembersDropdown(model.FamilyMemberId);
            return View(model);
        }

        var insurance = await context.InsurancePolicies.FindAsync(id);
        if (insurance == null)
            return NotFound();

        insurance.ProviderName = model.ProviderName;
        insurance.PolicyNumber = model.PolicyNumber;
        insurance.GroupNumber = model.GroupNumber;
        insurance.PolicyHolderName = model.PolicyHolderName;
        insurance.InsuranceType = model.InsuranceType;
        insurance.PhoneNumber = model.PhoneNumber;
        insurance.Website = model.Website;
        insurance.EffectiveDate = model.EffectiveDate;
        insurance.ExpirationDate = model.ExpirationDate;
        insurance.Deductible = model.Deductible;
        insurance.OutOfPocketMax = model.OutOfPocketMax;
        insurance.Copay = model.Copay;
        insurance.Notes = model.Notes;
        insurance.IsActive = model.IsActive;
        insurance.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Insurance policy for {insurance.ProviderName} updated successfully!";
        return RedirectToAction(nameof(Index));
    }

    public async Task<IActionResult> Details(int id)
    {
        var insurance = await context.InsurancePolicies
            .AsNoTracking()
            .Include(i => i.FamilyMember)
            .FirstOrDefaultAsync(i => i.Id == id);

        if (insurance == null)
            return NotFound();

        return View(insurance);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var insurance = await context.InsurancePolicies.FindAsync(id);
        if (insurance == null)
            return NotFound();

        context.InsurancePolicies.Remove(insurance);
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Insurance policy for {insurance.ProviderName} deleted successfully!";
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
