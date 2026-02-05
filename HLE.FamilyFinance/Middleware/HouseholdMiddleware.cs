using HLE.FamilyFinance.Services.Interfaces;

namespace HLE.FamilyFinance.Middleware;

/// <summary>
/// Middleware that ensures authenticated users have a household and stores it in HttpContext.Items
/// </summary>
public class HouseholdMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, IHouseholdService householdService)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var userId = context.User.FindFirst("sub")?.Value
                ?? context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

            if (!string.IsNullOrEmpty(userId))
            {
                var displayName = context.User.Identity.Name
                    ?? context.User.FindFirst("preferred_username")?.Value
                    ?? "User";
                var email = context.User.FindFirst("email")?.Value;

                // Get or create household for this user
                var household = await householdService.GetOrCreateHouseholdAsync(userId, displayName, email);
                var (_, member) = await householdService.GetUserHouseholdAsync(userId);

                // Store in HttpContext.Items for access in controllers
                context.Items["CurrentHouseholdId"] = household.Id;
                context.Items["CurrentHousehold"] = household;
                context.Items["CurrentMember"] = member;
                context.Items["CurrentUserId"] = userId;
            }
        }

        await next(context);
    }
}

/// <summary>
/// Extension method to add the middleware to the pipeline
/// </summary>
public static class HouseholdMiddlewareExtensions
{
    public static IApplicationBuilder UseHouseholdContext(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<HouseholdMiddleware>();
    }
}
