using HLE.FamilyFinance.Extensions;
using HLE.FamilyFinance.Models.Enums;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace HLE.FamilyFinance.Filters;

/// <summary>
/// Filter that requires the user to have at least the specified role in their household
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class RequireHouseholdRoleAttribute : Attribute, IAsyncAuthorizationFilter
{
    private readonly HouseholdRole _minimumRole;

    public RequireHouseholdRoleAttribute(HouseholdRole minimumRole = HouseholdRole.Viewer)
    {
        _minimumRole = minimumRole;
    }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        if (context.HttpContext.User.Identity?.IsAuthenticated != true)
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        var householdId = context.HttpContext.TryGetCurrentHouseholdId();
        var userId = context.HttpContext.TryGetCurrentUserId();

        if (householdId == null || userId == null)
        {
            context.Result = new ForbidResult();
            return;
        }

        var householdService = context.HttpContext.RequestServices.GetRequiredService<IHouseholdService>();
        var hasRole = await householdService.HasRoleAsync(householdId.Value, userId, _minimumRole);

        if (!hasRole)
        {
            context.Result = new ForbidResult();
        }
    }
}
