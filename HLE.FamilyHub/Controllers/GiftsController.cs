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
/// Controller for managing gifts.
/// </summary>
[Authorize]
public class GiftsController(
    IGiftService giftService,
    IFamilyMemberService familyMemberService) : Controller
{
    /// <summary>
    /// List all gifts with optional filtering by family member.
    /// </summary>
    /// <param name="familyMemberId">Optional family member ID to filter by</param>
    /// <param name="ct">Cancellation token</param>
    public async Task<IActionResult> Index(int? familyMemberId, CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        var gifts = await giftService.GetGiftsAsync(householdId, familyMemberId, ct);

        if (familyMemberId.HasValue)
        {
            var member = await familyMemberService.GetFamilyMemberAsync(familyMemberId.Value, householdId, ct);
            ViewData["FilteredMemberName"] = member?.FullName;
        }

        ViewData["FamilyMemberId"] = familyMemberId;
        return View(gifts);
    }

    /// <summary>
    /// Display details for a specific gift.
    /// </summary>
    /// <param name="id">Gift ID</param>
    /// <param name="ct">Cancellation token</param>
    public async Task<IActionResult> Details(int id, CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var gift = await giftService.GetGiftAsync(id, householdId, ct);

        if (gift == null)
        {
            return NotFound();
        }

        return View(gift);
    }

    /// <summary>
    /// Display form to create a new gift.
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
    /// Create a new gift.
    /// </summary>
    /// <param name="model">Gift creation data</param>
    /// <param name="ct">Cancellation token</param>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(GiftCreateViewModel model, CancellationToken ct = default)
    {
        if (!ModelState.IsValid)
        {
            await PopulateDropdownsAsync(ct);
            return View(model);
        }

        var householdId = HttpContext.GetCurrentHouseholdId();
        var gift = await giftService.CreateGiftAsync(
            householdId,
            model.FamilyMemberId,
            model.Description,
            model.GiftDate,
            model.Occasion,
            model.Status,
            model.EstimatedCost,
            model.ActualCost,
            model.Rating,
            model.Notes,
            ct);

        TempData["Success"] = "Gift created successfully.";
        return RedirectToAction(nameof(Details), new { id = gift.Id });
    }

    /// <summary>
    /// Display form to edit a gift.
    /// </summary>
    /// <param name="id">Gift ID</param>
    /// <param name="ct">Cancellation token</param>
    public async Task<IActionResult> Edit(int id, CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var gift = await giftService.GetGiftAsync(id, householdId, ct);

        if (gift == null)
        {
            return NotFound();
        }

        var viewModel = new GiftEditViewModel
        {
            Id = gift.Id,
            FamilyMemberId = gift.FamilyMemberId,
            Description = gift.Description,
            GiftDate = gift.GiftDate,
            Occasion = gift.Occasion,
            Status = gift.Status,
            EstimatedCost = gift.EstimatedCost,
            ActualCost = gift.ActualCost,
            Rating = gift.Rating,
            Notes = gift.Notes
        };

        await PopulateDropdownsAsync(ct);
        return View(viewModel);
    }

    /// <summary>
    /// Update an existing gift.
    /// </summary>
    /// <param name="id">Gift ID</param>
    /// <param name="model">Updated gift data</param>
    /// <param name="ct">Cancellation token</param>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, GiftEditViewModel model, CancellationToken ct = default)
    {
        if (!ModelState.IsValid)
        {
            await PopulateDropdownsAsync(ct);
            return View(model);
        }

        var householdId = HttpContext.GetCurrentHouseholdId();

        // Verify the gift exists
        var existingGift = await giftService.GetGiftAsync(id, householdId, ct);
        if (existingGift == null)
        {
            return NotFound();
        }

        await giftService.UpdateGiftAsync(
            id,
            householdId,
            model.FamilyMemberId,
            model.Description,
            model.GiftDate,
            model.Occasion,
            model.Status,
            model.EstimatedCost,
            model.ActualCost,
            model.Rating,
            model.Notes,
            ct);

        TempData["Success"] = "Gift updated successfully.";
        return RedirectToAction(nameof(Details), new { id });
    }

    /// <summary>
    /// Update the status of a gift.
    /// </summary>
    /// <param name="id">Gift ID</param>
    /// <param name="status">New gift status</param>
    /// <param name="ct">Cancellation token</param>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateStatus(int id, GiftStatus status, CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        // Verify the gift exists
        var existingGift = await giftService.GetGiftAsync(id, householdId, ct);
        if (existingGift == null)
        {
            return NotFound();
        }

        await giftService.UpdateGiftStatusAsync(id, householdId, status, ct);

        TempData["Success"] = $"Gift status updated to {status}.";
        return RedirectToAction(nameof(Details), new { id });
    }

    /// <summary>
    /// Delete a gift.
    /// </summary>
    /// <param name="id">Gift ID</param>
    /// <param name="ct">Cancellation token</param>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id, CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();

        // Verify the gift exists
        var existingGift = await giftService.GetGiftAsync(id, householdId, ct);
        if (existingGift == null)
        {
            return NotFound();
        }

        await giftService.DeleteGiftAsync(id, householdId, ct);

        TempData["Success"] = "Gift deleted successfully.";
        return RedirectToAction(nameof(Index));
    }

    /// <summary>
    /// Populate dropdown lists for family members and gift statuses.
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

        ViewData["GiftStatuses"] = new SelectList(
            Enum.GetValues<GiftStatus>()
                .Select(s => new { Value = s.ToString(), Text = s.ToString() }),
            "Value",
            "Text"
        );
    }
}
