using System.Diagnostics;
using HLE.Dashboard.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HLE.Dashboard.Controllers;

public class HomeController : Controller
{
    private readonly ILogger<HomeController> _logger;

    public HomeController(ILogger<HomeController> logger)
    {
        _logger = logger;
    }

    public IActionResult Index()
    {
        // User claims from Authentik are available via User.Claims
        if (User.Identity?.IsAuthenticated == true)
        {
            ViewData["UserName"] = User.Identity.Name;
            ViewData["Email"] = User.FindFirst("email")?.Value;
        }
        return View();
    }

    /// <summary>
    /// Temporary endpoint to debug Authentik claims. Remove after fixing claim mappings.
    /// </summary>
    [Authorize]
    public IActionResult DebugClaims()
    {
        var claims = User.Claims.Select(c => new { Type = c.Type, Value = c.Value }).ToList();
        return Json(new
        {
            IsAuthenticated = User.Identity?.IsAuthenticated,
            IdentityName = User.Identity?.Name,
            AuthenticationType = User.Identity?.AuthenticationType,
            Claims = claims
        });
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
