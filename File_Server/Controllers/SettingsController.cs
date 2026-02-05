using HLE.FileServer.Data;
using HLE.FileServer.Extensions;
using HLE.FileServer.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HLE.FileServer.Controllers;

[Authorize]
public class SettingsController : Controller
{
    private readonly ApplicationDbContext _context;

    public SettingsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> Index()
    {
        var userId = User.GetUserId();
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return RedirectToAction("Login", "Account");
        }

        var model = new UserSettingsViewModel
        {
            Id = user.Id,
            Username = user.Email ?? "",
            Email = user.Email ?? "",
            FirstName = user.FirstName,
            LastName = user.LastName,
            AvatarColor = user.AvatarColor
        };

        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateProfile(UserSettingsViewModel model)
    {
        var userId = User.GetUserId();
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return RedirectToAction("Login", "Account");
        }

        // Only avatar color can be changed locally - profile info is managed in Authentik
        user.AvatarColor = model.AvatarColor;

        await _context.SaveChangesAsync();

        TempData["SuccessMessage"] = "Your avatar color has been updated successfully.";
        return RedirectToAction(nameof(Index));
    }
}
