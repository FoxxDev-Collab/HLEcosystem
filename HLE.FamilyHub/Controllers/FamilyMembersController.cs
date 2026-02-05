using HLE.FamilyHub.Extensions;
using HLE.FamilyHub.Models.Entities;
using HLE.FamilyHub.Models.Enums;
using HLE.FamilyHub.Models.ViewModels;
using HLE.FamilyHub.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace HLE.FamilyHub.Controllers;

/// <summary>
/// Controller for managing family members.
/// </summary>
[Authorize]
public class FamilyMembersController(
    IFamilyMemberService familyMemberService,
    IImportantDateService importantDateService,
    IGiftService giftService,
    IGiftIdeaService giftIdeaService) : Controller
{
    /// <summary>
    /// List all family members with optional search.
    /// </summary>
    /// <param name="search">Optional search term for filtering by name</param>
    /// <param name="ct">Cancellation token</param>
    public async Task<IActionResult> Index(string? search, CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var members = await familyMemberService.GetFamilyMembersAsync(householdId, ct);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchTerm = search.Trim().ToLowerInvariant();
            members = members.Where(m =>
                m.FullName.ToLowerInvariant().Contains(searchTerm) ||
                (m.Nickname != null && m.Nickname.ToLowerInvariant().Contains(searchTerm))
            ).ToList();
        }

        ViewData["CurrentSearch"] = search;
        return View(members);
    }

    /// <summary>
    /// Display details for a specific family member.
    /// </summary>
    /// <param name="id">Family member ID</param>
    /// <param name="ct">Cancellation token</param>
    public async Task<IActionResult> Details(int id, CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var member = await familyMemberService.GetFamilyMemberAsync(id, householdId, ct);

        if (member == null)
        {
            return NotFound();
        }

        // Load related data
        var dates = await importantDateService.GetDatesForMemberAsync(id, householdId, ct);
        var gifts = await giftService.GetGiftsAsync(householdId, id, ct);
        var ideas = await giftIdeaService.GetIdeasForMemberAsync(id, householdId, ct);

        ViewData["ImportantDates"] = dates;
        ViewData["Gifts"] = gifts;
        ViewData["GiftIdeas"] = ideas;

        return View(member);
    }

    /// <summary>
    /// Display form to create a new family member.
    /// </summary>
    public IActionResult Create()
    {
        PopulateDropdowns();
        return View();
    }

    /// <summary>
    /// Create a new family member.
    /// </summary>
    /// <param name="model">Family member creation data</param>
    /// <param name="ct">Cancellation token</param>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(FamilyMemberCreateViewModel model, CancellationToken ct = default)
    {
        if (!ModelState.IsValid)
        {
            PopulateDropdowns();
            return View(model);
        }

        var householdId = HttpContext.GetCurrentHouseholdId();
        var member = await familyMemberService.CreateFamilyMemberAsync(
            householdId,
            model.FirstName,
            model.LastName,
            model.Nickname,
            model.Relationship,
            model.RelationshipNotes,
            model.Birthday,
            model.Anniversary,
            model.Phone,
            model.Email,
            model.PreferredContact,
            model.AddressLine1,
            model.AddressLine2,
            model.City,
            model.State,
            model.ZipCode,
            model.Country,
            model.ProfilePhotoUrl,
            model.Notes,
            model.IncludeInHolidayCards,
            ct);

        TempData["Success"] = $"Family member '{model.FirstName} {model.LastName}' created successfully.";
        return RedirectToAction(nameof(Details), new { id = member.Id });
    }

    /// <summary>
    /// Display form to edit a family member.
    /// </summary>
    /// <param name="id">Family member ID</param>
    /// <param name="ct">Cancellation token</param>
    public async Task<IActionResult> Edit(int id, CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var member = await familyMemberService.GetFamilyMemberAsync(id, householdId, ct);

        if (member == null)
        {
            return NotFound();
        }

        var viewModel = new FamilyMemberEditViewModel
        {
            Id = member.Id,
            FirstName = member.FirstName,
            LastName = member.LastName,
            Nickname = member.Nickname,
            Relationship = member.Relationship,
            RelationshipNotes = member.RelationshipNotes,
            Birthday = member.Birthday,
            Anniversary = member.Anniversary,
            Phone = member.Phone,
            Email = member.Email,
            PreferredContact = member.PreferredContact,
            AddressLine1 = member.AddressLine1,
            AddressLine2 = member.AddressLine2,
            City = member.City,
            State = member.State,
            ZipCode = member.ZipCode,
            Country = member.Country,
            ProfilePhotoUrl = member.ProfilePhotoUrl,
            Notes = member.Notes,
            IncludeInHolidayCards = member.IncludeInHolidayCards
        };

        PopulateDropdowns();
        return View(viewModel);
    }

    /// <summary>
    /// Update an existing family member.
    /// </summary>
    /// <param name="id">Family member ID</param>
    /// <param name="model">Updated family member data</param>
    /// <param name="ct">Cancellation token</param>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, FamilyMemberEditViewModel model, CancellationToken ct = default)
    {
        if (!ModelState.IsValid)
        {
            PopulateDropdowns();
            return View(model);
        }

        var householdId = HttpContext.GetCurrentHouseholdId();

        // Verify the member exists
        var existingMember = await familyMemberService.GetFamilyMemberAsync(id, householdId, ct);
        if (existingMember == null)
        {
            return NotFound();
        }

        await familyMemberService.UpdateFamilyMemberAsync(
            id,
            householdId,
            model.FirstName,
            model.LastName,
            model.Nickname,
            model.Relationship,
            model.RelationshipNotes,
            model.Birthday,
            model.Anniversary,
            model.Phone,
            model.Email,
            model.PreferredContact,
            model.AddressLine1,
            model.AddressLine2,
            model.City,
            model.State,
            model.ZipCode,
            model.Country,
            model.ProfilePhotoUrl,
            model.Notes,
            model.IncludeInHolidayCards,
            ct);

        TempData["Success"] = "Family member updated successfully.";
        return RedirectToAction(nameof(Details), new { id });
    }

    /// <summary>
    /// Delete a family member (soft delete).
    /// </summary>
    /// <param name="id">Family member ID</param>
    /// <param name="ct">Cancellation token</param>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id, CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        // Verify the member exists
        var existingMember = await familyMemberService.GetFamilyMemberAsync(id, householdId, ct);
        if (existingMember == null)
        {
            return NotFound();
        }

        await familyMemberService.DeleteFamilyMemberAsync(id, householdId, ct);

        TempData["Success"] = "Family member deleted successfully.";
        return RedirectToAction(nameof(Index));
    }

    /// <summary>
    /// Display address book for holiday cards.
    /// </summary>
    /// <param name="ct">Cancellation token</param>
    public async Task<IActionResult> AddressBook(CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var summaryMembers = await familyMemberService.GetHolidayCardListAsync(householdId, ct);

        // Load detailed data for each member since the address book needs full address info
        var detailedMembers = new List<FamilyMemberDetailDto>();
        foreach (var summary in summaryMembers)
        {
            var detail = await familyMemberService.GetFamilyMemberAsync(summary.Id, householdId, ct);
            if (detail != null)
            {
                detailedMembers.Add(detail);
            }
        }

        return View(detailedMembers);
    }

    /// <summary>
    /// Populate dropdown lists for relationships and contact methods.
    /// </summary>
    private void PopulateDropdowns()
    {
        ViewData["Relationships"] = new SelectList(
            Enum.GetValues<Relationship>()
                .Select(r => new { Value = r.ToString(), Text = r.ToString() }),
            "Value",
            "Text"
        );

        ViewData["PreferredContactMethods"] = new SelectList(
            Enum.GetValues<PreferredContactMethod>()
                .Select(c => new { Value = c.ToString(), Text = c.ToString() }),
            "Value",
            "Text"
        );
    }
}
