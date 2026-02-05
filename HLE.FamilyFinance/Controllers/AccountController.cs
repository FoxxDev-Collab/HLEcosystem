using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HLE.FamilyFinance.Controllers;

public class AccountController : Controller
{
    [HttpGet]
    public IActionResult Login(string returnUrl = "/")
    {
        // If already authenticated, redirect to return URL
        if (User.Identity?.IsAuthenticated == true)
        {
            return LocalRedirect(returnUrl);
        }

        // Store return URL for post-authentication redirect
        if (!string.IsNullOrEmpty(returnUrl) && returnUrl != "/")
        {
            HttpContext.Session.SetString("ReturnUrl", returnUrl);
        }

        // Initiate OIDC challenge to redirect to Authentik
        return Challenge(new AuthenticationProperties
        {
            RedirectUri = Url.Action(nameof(LoginCallback), new { returnUrl })
        }, OpenIdConnectDefaults.AuthenticationScheme);
    }

    [HttpGet]
    public IActionResult LoginCallback(string returnUrl = "/")
    {
        // Check if we have a stored return URL
        if (HttpContext.Session.TryGetValue("ReturnUrl", out var storedUrlBytes))
        {
            var storedUrl = System.Text.Encoding.UTF8.GetString(storedUrlBytes);
            HttpContext.Session.Remove("ReturnUrl");
            returnUrl = storedUrl;
        }

        if (User.Identity?.IsAuthenticated == true)
        {
            return LocalRedirect(returnUrl);
        }

        return RedirectToAction("Index", "Home");
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
