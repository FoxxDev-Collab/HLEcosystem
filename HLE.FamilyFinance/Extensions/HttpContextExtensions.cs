using HLE.FamilyFinance.Models.Entities;

namespace HLE.FamilyFinance.Extensions;

/// <summary>
/// Extension methods for accessing household context from HttpContext
/// </summary>
public static class HttpContextExtensions
{
    public static int GetCurrentHouseholdId(this HttpContext context)
    {
        return context.Items["CurrentHouseholdId"] as int?
            ?? throw new InvalidOperationException("No household context available");
    }

    public static int? TryGetCurrentHouseholdId(this HttpContext context)
    {
        return context.Items["CurrentHouseholdId"] as int?;
    }

    public static Household GetCurrentHousehold(this HttpContext context)
    {
        return context.Items["CurrentHousehold"] as Household
            ?? throw new InvalidOperationException("No household context available");
    }

    public static HouseholdMember? GetCurrentMember(this HttpContext context)
    {
        return context.Items["CurrentMember"] as HouseholdMember;
    }

    public static string GetCurrentUserId(this HttpContext context)
    {
        return context.Items["CurrentUserId"] as string
            ?? throw new InvalidOperationException("No user context available");
    }

    public static string? TryGetCurrentUserId(this HttpContext context)
    {
        return context.Items["CurrentUserId"] as string;
    }
}
