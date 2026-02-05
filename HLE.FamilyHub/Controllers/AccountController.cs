using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HLE.FamilyHub.Controllers;

public class AccountController : Controller
{
    [HttpGet]
    public IActionResult Login(string returnUrl = "/")
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            return LocalRedirect(returnUrl);
        }

        if (!string.IsNullOrEmpty(returnUrl) && returnUrl != "/")
        {
            HttpContext.Session.SetString("ReturnUrl", returnUrl);
        }

        return Challenge(new AuthenticationProperties
        {
            RedirectUri = Url.Action(nameof(LoginCallback), new { returnUrl })
        }, OpenIdConnectDefaults.AuthenticationScheme);
    }

    [HttpGet]
    public IActionResult LoginCallback(string returnUrl = "/")
    {
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
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Redirect("/");
    }

    [HttpGet]
    public IActionResult AccessDenied()
    {
        return View();
    }
}
