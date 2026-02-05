using HLE.FileServer.Data;
using HLE.FileServer.Extensions;
using Microsoft.AspNetCore.Mvc;

namespace HLE.FileServer.ViewComponents;

public class UserAvatarViewComponent : ViewComponent
{
    private readonly ApplicationDbContext _context;

    public UserAvatarViewComponent(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IViewComponentResult> InvokeAsync()
    {
        if (UserClaimsPrincipal.Identity?.IsAuthenticated != true)
        {
            return Content("");
        }

        var userId = UserClaimsPrincipal.GetUserId();
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return Content("");
        }

        var model = new
        {
            FirstName = user.FirstName,
            LastName = user.LastName,
            Email = user.Email,
            AvatarColor = user.AvatarColor,
            Initials = GetInitials(user.FirstName, user.LastName)
        };

        return View(model);
    }

    private string GetInitials(string? firstName, string? lastName)
    {
        var first = !string.IsNullOrEmpty(firstName) ? firstName[0].ToString().ToUpper() : "";
        var last = !string.IsNullOrEmpty(lastName) ? lastName[0].ToString().ToUpper() : "";
        return first + last;
    }
}
