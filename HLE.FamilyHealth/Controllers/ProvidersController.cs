using HLE.FamilyHealth.Data;
using HLE.FamilyHealth.Models.Entities;
using HLE.FamilyHealth.Models.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HLE.FamilyHealth.Controllers;

[Authorize]
public class ProvidersController(ApplicationDbContext context) : Controller
{
    public async Task<IActionResult> Index()
    {
        var providers = await context.Providers
            .AsNoTracking()
            .OrderBy(p => p.Type)
            .ThenBy(p => p.Name)
            .ToListAsync();

        var providersByType = providers
            .GroupBy(p => p.Type)
            .ToDictionary(g => g.Key, g => g.Count());

        var viewModel = new ProviderIndexViewModel
        {
            Providers = providers.Select(p => new ProviderSummary
            {
                Id = p.Id,
                Name = p.Name,
                Specialty = p.Specialty,
                Type = p.Type,
                PhoneNumber = p.PhoneNumber,
                Email = p.Email,
                PortalUrl = p.PortalUrl,
                IsActive = p.IsActive
            }).ToList(),
            TotalProviders = providers.Count,
            ProvidersByType = providersByType
        };

        return View(viewModel);
    }

    public IActionResult Create()
    {
        return View(new ProviderViewModel());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(ProviderViewModel model)
    {
        if (!ModelState.IsValid)
            return View(model);

        var provider = new Provider
        {
            Name = model.Name,
            Specialty = model.Specialty,
            Type = model.Type,
            Address = model.Address,
            PhoneNumber = model.PhoneNumber,
            FaxNumber = model.FaxNumber,
            Email = model.Email,
            Website = model.Website,
            PortalUrl = model.PortalUrl,
            PreferredContactMethod = model.PreferredContactMethod,
            Notes = model.Notes,
            IsActive = model.IsActive,
            CreatedAt = DateTime.UtcNow
        };

        context.Providers.Add(provider);
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Provider {provider.Name} added successfully!";
        return RedirectToAction(nameof(Index));
    }

    public async Task<IActionResult> Edit(int id)
    {
        var provider = await context.Providers.FindAsync(id);
        if (provider == null)
            return NotFound();

        var viewModel = new ProviderViewModel
        {
            Id = provider.Id,
            Name = provider.Name,
            Specialty = provider.Specialty,
            Type = provider.Type,
            Address = provider.Address,
            PhoneNumber = provider.PhoneNumber,
            FaxNumber = provider.FaxNumber,
            Email = provider.Email,
            Website = provider.Website,
            PortalUrl = provider.PortalUrl,
            PreferredContactMethod = provider.PreferredContactMethod,
            Notes = provider.Notes,
            IsActive = provider.IsActive
        };

        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, ProviderViewModel model)
    {
        if (id != model.Id)
            return NotFound();

        if (!ModelState.IsValid)
            return View(model);

        var provider = await context.Providers.FindAsync(id);
        if (provider == null)
            return NotFound();

        provider.Name = model.Name;
        provider.Specialty = model.Specialty;
        provider.Type = model.Type;
        provider.Address = model.Address;
        provider.PhoneNumber = model.PhoneNumber;
        provider.FaxNumber = model.FaxNumber;
        provider.Email = model.Email;
        provider.Website = model.Website;
        provider.PortalUrl = model.PortalUrl;
        provider.PreferredContactMethod = model.PreferredContactMethod;
        provider.Notes = model.Notes;
        provider.IsActive = model.IsActive;
        provider.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Provider {provider.Name} updated successfully!";
        return RedirectToAction(nameof(Index));
    }

    public async Task<IActionResult> Details(int id)
    {
        var provider = await context.Providers
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id);

        if (provider == null)
            return NotFound();

        return View(provider);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var provider = await context.Providers.FindAsync(id);
        if (provider == null)
            return NotFound();

        context.Providers.Remove(provider);
        await context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Provider {provider.Name} deleted successfully!";
        return RedirectToAction(nameof(Index));
    }
}
