namespace HLE.FileServer.Services;

/// <summary>
/// Service for detecting mobile devices and managing view mode preferences
/// </summary>
public interface IMobileDetectionService
{
    /// <summary>
    /// Checks if the current request is from a mobile device based on User-Agent
    /// </summary>
    bool IsMobileDevice(HttpContext context);

    /// <summary>
    /// Checks if mobile view should be served (considers device detection and cookie override)
    /// </summary>
    bool ShouldUseMobileView(HttpContext context);

    /// <summary>
    /// Sets a cookie to override the view mode (allows users to switch between mobile/desktop)
    /// </summary>
    void SetViewModeOverride(HttpContext context, bool useMobile);

    /// <summary>
    /// Clears the view mode override cookie (returns to automatic detection)
    /// </summary>
    void ClearViewModeOverride(HttpContext context);
}
