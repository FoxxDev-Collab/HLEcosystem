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
/// Controller for managing gift ideas.
/// </summary>
[Authorize]
public class GiftIdeasController(
    IGiftIdeaService giftIdeaService,
    IFamilyMemberService familyMemberService) : Controller
{
    /// <summary>
    /// List all active gift ideas.
    /// </summary>
    /// <param name="ct">Cancellation token</param>
    public async Task<IActionResult> Index(CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var ideas = await giftIdeaService.GetActiveIdeasAsync(householdId, ct);

        return View(ideas);
    }

    /// <summary>
    /// Display form to create a new gift idea.
    /// </summary>
    /// <param name="familyMemberId">Optional pre-selected family member ID</param>
    /// <param name="ct">Cancellation token</param>
    public async Task<IActionResult> Create(int? familyMemberId, CancellationToken ct = default)
    {
        await PopulateDropdownsAsync(ct);

        if (familyMemberId.HasValue)
        {
            ViewData["PreselectedMemberId"] = familyMemberId.Value;
        }

        return View();
    }

    /// <summary>
    /// Create a new gift idea.
    /// </summary>
    /// <param name="model">Gift idea creation data</param>
    /// <param name="ct">Cancellation token</param>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(GiftIdeaCreateViewModel model, CancellationToken ct = default)
    {
        if (!ModelState.IsValid)
        {
            await PopulateDropdownsAsync(ct);
            return View(model);
        }

        var householdId = HttpContext.GetCurrentHouseholdId();
        await giftIdeaService.CreateIdeaAsync(
            householdId,
            model.FamilyMemberId,
            model.Idea,
            model.Source,
            model.Priority,
            model.EstimatedCost,
            model.Url,
            model.Notes,
            ct);

        TempData["Success"] = "Gift idea created successfully.";
        return RedirectToAction(nameof(Index));
    }

    /// <summary>
    /// Display form to edit a gift idea.
    /// </summary>
    /// <param name="id">Gift idea ID</param>
    /// <param name="ct">Cancellation token</param>
    public async Task<IActionResult> Edit(int id, CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var idea = await giftIdeaService.GetIdeaAsync(id, householdId, ct);

        if (idea == null)
        {
            return NotFound();
        }

        var viewModel = new GiftIdeaEditViewModel
        {
            Id = idea.Id,
            Idea = idea.Idea,
            FamilyMemberId = idea.FamilyMemberId,
            Source = idea.Source,
            Priority = idea.Priority,
            EstimatedCost = idea.EstimatedCost,
            Url = idea.Url,
            Notes = idea.Notes
        };

        await PopulateDropdownsAsync(ct);
        return View(viewModel);
    }

    /// <summary>
    /// Update an existing gift idea.
    /// </summary>
    /// <param name="id">Gift idea ID</param>
    /// <param name="model">Updated gift idea data</param>
    /// <param name="ct">Cancellation token</param>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, GiftIdeaEditViewModel model, CancellationToken ct = default)
    {
        if (!ModelState.IsValid)
        {
            await PopulateDropdownsAsync(ct);
            return View(model);
        }

        var householdId = HttpContext.GetCurrentHouseholdId();

        // Verify the gift idea exists before updating
        var existingIdea = await giftIdeaService.GetIdeaAsync(id, householdId, ct);
        if (existingIdea == null)
        {
            return NotFound();
        }

        await giftIdeaService.UpdateIdeaAsync(
            id,
            householdId,
            model.FamilyMemberId,
            model.Idea,
            model.Source,
            model.Priority,
            model.EstimatedCost,
            model.Url,
            model.Notes,
            ct);

        TempData["Success"] = "Gift idea updated successfully.";
        return RedirectToAction(nameof(Index));
    }

    /// <summary>
    /// Mark a gift idea as purchased.
    /// </summary>
    /// <param name="id">Gift idea ID</param>
    /// <param name="ct">Cancellation token</param>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> MarkPurchased(int id, CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        // Verify the gift idea exists before updating
        var existingIdea = await giftIdeaService.GetIdeaAsync(id, householdId, ct);
        if (existingIdea == null)
        {
            return NotFound();
        }

        await giftIdeaService.UpdateIdeaStatusAsync(id, householdId, GiftIdeaStatus.Purchased, ct);

        TempData["Success"] = "Gift idea marked as purchased.";
        return RedirectToAction(nameof(Index));
    }

    /// <summary>
    /// Convert a gift idea to an actual gift.
    /// </summary>
    /// <param name="id">Gift idea ID</param>
    /// <param name="ct">Cancellation token</param>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ConvertToGift(int id, CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        try
        {
            var gift = await giftIdeaService.ConvertToGiftAsync(id, householdId, ct);

            TempData["Success"] = "Gift idea converted to gift successfully.";
            return RedirectToAction("Details", "Gifts", new { id = gift.Id });
        }
        catch (InvalidOperationException ex)
        {
            TempData["Error"] = ex.Message;
            return RedirectToAction(nameof(Index));
        }
    }

    /// <summary>
    /// Delete a gift idea.
    /// </summary>
    /// <param name="id">Gift idea ID</param>
    /// <param name="ct">Cancellation token</param>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id, CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        // Verify the gift idea exists before deleting
        var existingIdea = await giftIdeaService.GetIdeaAsync(id, householdId, ct);
        if (existingIdea == null)
        {
            return NotFound();
        }

        await giftIdeaService.DeleteIdeaAsync(id, householdId, ct);

        TempData["Success"] = "Gift idea deleted successfully.";
        return RedirectToAction(nameof(Index));
    }

    /// <summary>
    /// Populate dropdown lists for family members and priorities.
    /// </summary>
    private async Task PopulateDropdownsAsync(CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var members = await familyMemberService.GetFamilyMembersAsync(householdId, ct);

        ViewData["FamilyMembers"] = new SelectList(
            members.Select(m => new { m.Id, m.FullName }),
            "Id",
            "FullName"
        );

        ViewData["Priorities"] = new SelectList(
            Enum.GetValues<GiftIdeaPriority>()
                .Select(p => new { Value = p.ToString(), Text = p.ToString() }),
            "Value",
            "Text"
        );
    }
}
