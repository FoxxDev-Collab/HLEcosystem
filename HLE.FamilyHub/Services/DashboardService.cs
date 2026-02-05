using HLE.FamilyHub.Data;
using HLE.FamilyHub.Models.Enums;
using HLE.FamilyHub.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HLE.FamilyHub.Services;

/// <summary>
/// Implementation of dashboard aggregation service.
/// </summary>
public class DashboardService(
    ApplicationDbContext context,
    IFamilyMemberService familyMemberService,
    IImportantDateService importantDateService,
    IGiftService giftService,
    IGiftIdeaService giftIdeaService,
    ILogger<DashboardService> logger) : IDashboardService
{
    /// <inheritdoc/>
    public async Task<DashboardStatsDto> GetDashboardStatsAsync(int householdId, CancellationToken ct = default)
    {
        // Get total active family members
        var familyMembers = await familyMemberService.GetFamilyMembersAsync(householdId, ct);
        var activeFamilyMembers = familyMembers.Count(fm => fm.IsActive);

        // Get upcoming dates count (next 30 days)
        var upcomingDates = await importantDateService.GetUpcomingDatesAsync(householdId, 30, ct);
        var upcomingDatesCount = upcomingDates.Count;

        // Get active gift ideas count
        var activeGiftIdeas = await giftIdeaService.GetActiveIdeasAsync(householdId, ct);
        var activeGiftIdeasCount = activeGiftIdeas.Count;

        // Get total spent this year
        var currentYear = DateTime.UtcNow.Year;
        var totalSpentThisYear = await giftService.GetTotalSpentAsync(householdId, currentYear, ct);

        return new DashboardStatsDto(
            activeFamilyMembers,
            upcomingDatesCount,
            activeGiftIdeasCount,
            totalSpentThisYear
        );
    }

    /// <inheritdoc/>
    public async Task<List<UpcomingEventDto>> GetUpcomingEventsAsync(int householdId, int daysAhead = 30, CancellationToken ct = default)
    {
        var upcomingDates = await importantDateService.GetUpcomingDatesAsync(householdId, daysAhead, ct);

        return upcomingDates
            .Select(d => new UpcomingEventDto(
                d.Id,
                d.Label,
                d.NextOccurrence,
                d.DaysUntilNext,
                d.FamilyMemberName,
                d.Type.ToString()
            ))
            .OrderBy(e => e.NextOccurrence)
            .ToList();
    }

    /// <inheritdoc/>
    public async Task<List<RecentGiftActivityDto>> GetRecentGiftActivityAsync(int householdId, int count = 10, CancellationToken ct = default)
    {
        // Get recent gifts
        var gifts = await context.Gifts
            .AsNoTracking()
            .Include(g => g.FamilyMember)
            .Where(g => g.HouseholdId == householdId)
            .OrderByDescending(g => g.CreatedAt)
            .Take(count)
            .Select(g => new
            {
                g.Id,
                g.Description,
                FamilyMemberName = g.FamilyMember.FirstName + " " + g.FamilyMember.LastName,
                Status = g.Status.ToString(),
                g.GiftDate,
                g.CreatedAt,
                EntityType = "Gift"
            })
            .ToListAsync(ct);

        // Get recent gift ideas
        var giftIdeas = await context.GiftIdeas
            .AsNoTracking()
            .Include(gi => gi.FamilyMember)
            .Where(gi => gi.HouseholdId == householdId)
            .OrderByDescending(gi => gi.CreatedAt)
            .Take(count)
            .Select(gi => new
            {
                gi.Id,
                Description = gi.Idea,
                FamilyMemberName = gi.FamilyMember != null ? gi.FamilyMember.FirstName + " " + gi.FamilyMember.LastName : "General",
                Status = gi.Status.ToString(),
                GiftDate = (DateOnly?)null,
                gi.CreatedAt,
                EntityType = "Gift Idea"
            })
            .ToListAsync(ct);

        // Combine and sort by creation date
        var combined = gifts.Concat(giftIdeas)
            .OrderByDescending(item => item.CreatedAt)
            .Take(count)
            .Select(item => new RecentGiftActivityDto(
                item.Id,
                item.Description,
                item.FamilyMemberName,
                item.Status,
                item.GiftDate,
                item.EntityType
            ))
            .ToList();

        return combined;
    }
}
