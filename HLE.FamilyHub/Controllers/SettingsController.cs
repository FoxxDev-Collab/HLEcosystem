using HLE.FamilyHub.Extensions;
using HLE.FamilyHub.Models.ViewModels;
using HLE.FamilyHub.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HLE.FamilyHub.Controllers;

/// <summary>
/// Controller for managing household settings.
/// </summary>
[Authorize]
public class SettingsController(
    IHouseholdService householdService,
    IFamilyMemberService familyMemberService,
    IImportantDateService importantDateService,
    IGiftIdeaService giftIdeaService,
    IGiftService giftService) : Controller
{
    /// <summary>
    /// Display household settings.
    /// </summary>
    /// <param name="ct">Cancellation token</param>
    public async Task<IActionResult> Index(CancellationToken ct = default)
    {
        var householdId = HttpContext.GetCurrentHouseholdId();
        var household = HttpContext.GetCurrentHousehold();

        var members = await familyMemberService.GetFamilyMembersAsync(householdId, ct);
        var allDates = await importantDateService.GetAllDatesAsync(householdId, ct);
        var activeIdeas = await giftIdeaService.GetActiveIdeasAsync(householdId, ct);
        var gifts = await giftService.GetGiftsAsync(householdId, null, ct);

        var viewModel = new SettingsViewModel
        {
            HouseholdName = household.Name,
            FamilyMembers = members,
            TotalDates = allDates.Count,
            TotalGiftIdeas = activeIdeas.Count,
            TotalGifts = gifts.Count
        };

        return View(viewModel);
    }

    /// <summary>
    /// Update household name.
    /// </summary>
    /// <param name="name">New household name</param>
    /// <param name="ct">Cancellation token</param>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Index(string name, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            ModelState.AddModelError("Name", "Household name is required.");

            // Reload the view model with current data
            var householdId = HttpContext.GetCurrentHouseholdId();
            var household = HttpContext.GetCurrentHousehold();

            var members = await familyMemberService.GetFamilyMembersAsync(householdId, ct);
            var allDates = await importantDateService.GetAllDatesAsync(householdId, ct);
            var activeIdeas = await giftIdeaService.GetActiveIdeasAsync(householdId, ct);
            var gifts = await giftService.GetGiftsAsync(householdId, null, ct);

            var viewModel = new SettingsViewModel
            {
                HouseholdName = household.Name,
                FamilyMembers = members,
                TotalDates = allDates.Count,
                TotalGiftIdeas = activeIdeas.Count,
                TotalGifts = gifts.Count
            };

            return View(viewModel);
        }

        var currentHouseholdId = HttpContext.GetCurrentHouseholdId();
        var userId = HttpContext.GetCurrentUserId();

        await householdService.UpdateHouseholdAsync(currentHouseholdId, name, userId, ct);

        // Update session
        HttpContext.Session.SetString("HouseholdName", name);

        TempData["Success"] = "Household settings updated successfully.";
        return RedirectToAction(nameof(Index));
    }
}
