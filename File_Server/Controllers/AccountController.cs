using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HLE.FileServer.Controllers;

public class AccountController : Controller
{
    [HttpGet]
    public IActionResult Login(string? returnUrl = "/")
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            return LocalRedirect(returnUrl ?? "/");
        }

        return Challenge(new AuthenticationProperties
        {
            RedirectUri = returnUrl ?? "/"
        }, OpenIdConnectDefaults.AuthenticationScheme);
    }

    [Authorize]
    [HttpGet]
    public async Task<IActionResult> Logout()
    {
        // Sign out locally (clear cookie) - doesn't sign out from Authentik
        // This allows quick re-login without re-entering credentials
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Redirect("/");
    }

    [HttpGet]
    public IActionResult AccessDenied()
    {
        return View();
    }
}
