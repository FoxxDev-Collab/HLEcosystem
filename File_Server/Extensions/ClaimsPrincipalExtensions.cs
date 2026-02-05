using System.Security.Claims;

namespace HLE.FileServer.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static string? GetUserId(this ClaimsPrincipal principal)
    {
        return principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    }

    public static string? GetEmail(this ClaimsPrincipal principal)
    {
        return principal.FindFirst(ClaimTypes.Email)?.Value;
    }

    public static string? GetFirstName(this ClaimsPrincipal principal)
    {
        return principal.FindFirst(ClaimTypes.GivenName)?.Value;
    }

    public static string? GetLastName(this ClaimsPrincipal principal)
    {
        return principal.FindFirst(ClaimTypes.Surname)?.Value;
    }

    public static string GetDisplayName(this ClaimsPrincipal principal)
    {
        var firstName = principal.GetFirstName();
        var lastName = principal.GetLastName();
        if (!string.IsNullOrEmpty(firstName) || !string.IsNullOrEmpty(lastName))
        {
            return $"{firstName} {lastName}".Trim();
        }
        return principal.Identity?.Name ?? "User";
    }
}
