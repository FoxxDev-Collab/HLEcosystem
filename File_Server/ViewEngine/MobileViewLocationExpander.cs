using HLE.FileServer.Services;
using Microsoft.AspNetCore.Mvc.Razor;

namespace HLE.FileServer.ViewEngine;

/// <summary>
/// View location expander that adds mobile view locations when a mobile device is detected.
/// Mobile views use the .Mobile.cshtml suffix (e.g., Index.Mobile.cshtml)
/// </summary>
public class MobileViewLocationExpander : IViewLocationExpander
{
    private const string MobileKey = "mobile";

    public void PopulateValues(ViewLocationExpanderContext context)
    {
        var httpContext = context.ActionContext.HttpContext;
        var mobileService = httpContext.RequestServices.GetService<IMobileDetectionService>();

        if (mobileService != null && mobileService.ShouldUseMobileView(httpContext))
        {
            context.Values[MobileKey] = "true";
        }
    }

    public IEnumerable<string> ExpandViewLocations(
        ViewLocationExpanderContext context,
        IEnumerable<string> viewLocations)
    {
        if (!context.Values.TryGetValue(MobileKey, out var isMobile) || isMobile != "true")
        {
            // Not mobile - return original locations
            return viewLocations;
        }

        // For mobile, add .Mobile versions first
        return ExpandMobileLocations(viewLocations);
    }

    private static IEnumerable<string> ExpandMobileLocations(IEnumerable<string> viewLocations)
    {
        foreach (var location in viewLocations)
        {
            // Add mobile version first (higher priority)
            // e.g., /Views/{1}/{0}.cshtml becomes /Views/{1}/{0}.Mobile.cshtml
            var mobileLocation = location.Replace(".cshtml", ".Mobile.cshtml");
            yield return mobileLocation;

            // Then add original location as fallback
            yield return location;
        }
    }
}
