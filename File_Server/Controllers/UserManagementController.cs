using HLE.FileServer.Constants;
using HLE.FileServer.Data;
using HLE.FileServer.Extensions;
using HLE.FileServer.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HLE.FileServer.Controllers;

[Authorize(Roles = Roles.Admin)]
public class UserManagementController : Controller
{
    private readonly ApplicationDbContext _context;

    public UserManagementController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> Index()
    {
        var users = await _context.Users.ToListAsync();
        var userViewModels = users.Select(user => new UserListViewModel
        {
            Id = user.Id,
            Username = user.Email ?? string.Empty,
            Email = user.Email ?? string.Empty,
            FirstName = user.FirstName,
            LastName = user.LastName,
            IsActive = user.IsActive,
            CreatedDate = user.CreatedDate,
            LastLoginDate = user.LastLoginDate,
            Roles = new List<string>() // Roles come from Authentik claims, not stored locally
        }).ToList();

        return View(userViewModels);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ToggleActive(string id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null)
        {
            return Json(new { success = false, message = "User not found" });
        }

        // Prevent deactivating yourself
        var currentUserId = User.GetUserId();
        if (currentUserId == user.Id)
        {
            return Json(new { success = false, message = "You cannot deactivate your own account" });
        }

        user.IsActive = !user.IsActive;
        await _context.SaveChangesAsync();

        var status = user.IsActive ? "activated" : "deactivated";
        return Json(new { success = true, message = $"User {user.Email} {status} successfully", isActive = user.IsActive });
    }
}
