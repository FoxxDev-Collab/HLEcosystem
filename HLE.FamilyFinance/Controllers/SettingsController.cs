using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HLE.FamilyFinance.Controllers;

[Authorize]
public class SettingsController : Controller
{
    private readonly ILogger<SettingsController> _logger;

    public SettingsController(ILogger<SettingsController> logger)
    {
        _logger = logger;
    }

    [HttpGet]
    public IActionResult Index()
    {
        // User information comes from Authentik OIDC claims
        // Profile management is handled in Authentik
        ViewData["UserName"] = User.Identity?.Name;
        ViewData["Email"] = User.FindFirst("email")?.Value;
        ViewData["PreferredUsername"] = User.FindFirst("preferred_username")?.Value;

        return View();
    }
}
