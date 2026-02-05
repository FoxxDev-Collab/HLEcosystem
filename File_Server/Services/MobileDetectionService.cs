using System.Text.RegularExpressions;

namespace HLE.FileServer.Services;

/// <summary>
/// Implementation of mobile device detection using User-Agent parsing
/// </summary>
public partial class MobileDetectionService : IMobileDetectionService
{
    private const string ViewModeCookieName = "ViewMode";
    private const string MobileValue = "mobile";
    private const string DesktopValue = "desktop";
    private const string IsMobileContextKey = "IsMobileDevice";

    // Mobile User-Agent patterns
    [GeneratedRegex(@"Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS|FxiOS", RegexOptions.IgnoreCase)]
    private static partial Regex MobileRegex();

    // Tablet patterns (may want desktop view by default)
    [GeneratedRegex(@"iPad|Android(?!.*Mobile)|Tablet", RegexOptions.IgnoreCase)]
    private static partial Regex TabletRegex();

    public bool IsMobileDevice(HttpContext context)
    {
        // Check cache first
        if (context.Items.TryGetValue(IsMobileContextKey, out var cached) && cached is bool cachedResult)
        {
            return cachedResult;
        }

        var userAgent = context.Request.Headers.UserAgent.ToString();

        if (string.IsNullOrEmpty(userAgent))
        {
            context.Items[IsMobileContextKey] = false;
            return false;
        }

        // Check for mobile devices
        var isMobile = MobileRegex().IsMatch(userAgent);

        // Tablets are considered mobile for this implementation
        // (they'll still get mobile views but with tablet-friendly CSS)

        context.Items[IsMobileContextKey] = isMobile;
        return isMobile;
    }

    public bool ShouldUseMobileView(HttpContext context)
    {
        // Check for cookie override first
        if (context.Request.Cookies.TryGetValue(ViewModeCookieName, out var viewMode))
        {
            return viewMode?.ToLowerInvariant() == MobileValue;
        }

        // Fall back to device detection
        return IsMobileDevice(context);
    }

    public void SetViewModeOverride(HttpContext context, bool useMobile)
    {
        var cookieOptions = new CookieOptions
        {
            Expires = DateTimeOffset.UtcNow.AddYears(1),
            HttpOnly = false, // Allow JavaScript access for UI toggle
            Secure = true,
            SameSite = SameSiteMode.Lax,
            Path = "/"
        };

        context.Response.Cookies.Append(
            ViewModeCookieName,
            useMobile ? MobileValue : DesktopValue,
            cookieOptions);
    }

    public void ClearViewModeOverride(HttpContext context)
    {
        context.Response.Cookies.Delete(ViewModeCookieName);
    }
}
