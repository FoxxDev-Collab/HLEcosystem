using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HLE.FamilyHub.ViewComponents;

public class UserAvatarViewComponent : ViewComponent
{
    public Task<IViewComponentResult> InvokeAsync()
    {
        if (User.Identity?.IsAuthenticated != true)
        {
            return Task.FromResult<IViewComponentResult>(Content(""));
        }

        var claimsPrincipal = User as ClaimsPrincipal;
        var userName = User.Identity.Name ?? "";
        var email = claimsPrincipal?.FindFirst("email")?.Value ?? "";
        var preferredUsername = claimsPrincipal?.FindFirst("preferred_username")?.Value ?? userName;

        var nameParts = userName.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var initials = nameParts.Length switch
        {
            >= 2 => $"{nameParts[0][0]}{nameParts[^1][0]}".ToUpper(),
            1 => nameParts[0].Length >= 2 ? nameParts[0][..2].ToUpper() : nameParts[0].ToUpper(),
            _ => "?"
        };

        var model = new
        {
            UserName = userName,
            Email = email,
            PreferredUsername = preferredUsername,
            Initials = initials,
            AvatarColor = "primary"
        };

        return Task.FromResult<IViewComponentResult>(View(model));
    }
}
