using HLE.FamilyHub.Models.Enums;

namespace HLE.FamilyHub.Helpers;

/// <summary>
/// Provides Bootstrap Icon class mappings for various entity types
/// </summary>
public static class IconHelper
{
    /// <summary>
    /// Gets the Bootstrap Icon class for a Relationship
    /// </summary>
    public static string GetRelationshipIcon(Relationship relationship) => relationship switch
    {
        Relationship.Spouse => "bi-heart-fill",
        Relationship.Partner => "bi-heart",
        Relationship.Parent => "bi-person-standing",
        Relationship.Child => "bi-emoji-smile",
        Relationship.Sibling => "bi-people",
        Relationship.Grandparent => "bi-person-hearts",
        Relationship.Grandchild => "bi-emoji-laughing",
        Relationship.AuntUncle => "bi-person-plus",
        Relationship.NieceNephew => "bi-person-plus",
        Relationship.Cousin => "bi-person-badge",
        Relationship.InLaw => "bi-person-lines-fill",
        Relationship.StepParent => "bi-person-standing-dress",
        Relationship.StepChild => "bi-emoji-neutral",
        Relationship.StepSibling => "bi-people-fill",
        Relationship.Godparent => "bi-star",
        Relationship.Godchild => "bi-star-half",
        Relationship.Friend => "bi-hand-thumbs-up",
        Relationship.Other => "bi-person",
        _ => "bi-person"
    };

    /// <summary>
    /// Gets the Bootstrap Icon class for an ImportantDateType
    /// </summary>
    public static string GetDateTypeIcon(ImportantDateType type) => type switch
    {
        ImportantDateType.Birthday => "bi-cake2",
        ImportantDateType.Anniversary => "bi-heart-pulse",
        ImportantDateType.Graduation => "bi-mortarboard",
        ImportantDateType.Memorial => "bi-flower1",
        ImportantDateType.Holiday => "bi-tree",
        ImportantDateType.Custom => "bi-calendar-event",
        _ => "bi-calendar-event"
    };

    /// <summary>
    /// Gets the Bootstrap Icon class for a GiftStatus
    /// </summary>
    public static string GetGiftStatusIcon(GiftStatus status) => status switch
    {
        GiftStatus.Idea => "bi-lightbulb",
        GiftStatus.Purchased => "bi-bag-check",
        GiftStatus.Wrapped => "bi-box-seam",
        GiftStatus.Given => "bi-gift-fill",
        _ => "bi-gift"
    };

    /// <summary>
    /// Gets the CSS badge class for a GiftStatus
    /// </summary>
    public static string GetGiftStatusBadge(GiftStatus status) => status switch
    {
        GiftStatus.Idea => "bg-info",
        GiftStatus.Purchased => "bg-warning",
        GiftStatus.Wrapped => "bg-primary",
        GiftStatus.Given => "bg-success",
        _ => "bg-secondary"
    };

    /// <summary>
    /// Gets the Bootstrap Icon class for a GiftIdeaPriority
    /// </summary>
    public static string GetPriorityIcon(GiftIdeaPriority priority) => priority switch
    {
        GiftIdeaPriority.Low => "bi-arrow-down-circle",
        GiftIdeaPriority.Medium => "bi-dash-circle",
        GiftIdeaPriority.High => "bi-arrow-up-circle-fill",
        _ => "bi-dash-circle"
    };

    /// <summary>
    /// Gets the CSS badge class for a GiftIdeaPriority
    /// </summary>
    public static string GetPriorityBadge(GiftIdeaPriority priority) => priority switch
    {
        GiftIdeaPriority.Low => "bg-secondary",
        GiftIdeaPriority.Medium => "bg-warning",
        GiftIdeaPriority.High => "bg-danger",
        _ => "bg-secondary"
    };

    /// <summary>
    /// Gets the Bootstrap Icon class for a GiftIdeaStatus
    /// </summary>
    public static string GetIdeaStatusIcon(GiftIdeaStatus status) => status switch
    {
        GiftIdeaStatus.Active => "bi-lightbulb-fill",
        GiftIdeaStatus.Purchased => "bi-bag-check-fill",
        GiftIdeaStatus.NotInterested => "bi-x-circle",
        _ => "bi-lightbulb"
    };

    /// <summary>
    /// Gets the CSS badge class for a GiftIdeaStatus
    /// </summary>
    public static string GetIdeaStatusBadge(GiftIdeaStatus status) => status switch
    {
        GiftIdeaStatus.Active => "bg-success",
        GiftIdeaStatus.Purchased => "bg-info",
        GiftIdeaStatus.NotInterested => "bg-secondary",
        _ => "bg-secondary"
    };

    /// <summary>
    /// Gets the Bootstrap Icon class for a RecurrenceType
    /// </summary>
    public static string GetRecurrenceIcon(RecurrenceType type) => type switch
    {
        RecurrenceType.Once => "bi-1-circle",
        RecurrenceType.Annual => "bi-arrow-repeat",
        _ => "bi-calendar"
    };

    /// <summary>
    /// Gets the Bootstrap Icon class for a PreferredContactMethod
    /// </summary>
    public static string GetContactMethodIcon(PreferredContactMethod method) => method switch
    {
        PreferredContactMethod.None => "bi-dash",
        PreferredContactMethod.Phone => "bi-telephone",
        PreferredContactMethod.Email => "bi-envelope",
        PreferredContactMethod.Text => "bi-chat-dots",
        _ => "bi-dash"
    };

    /// <summary>
    /// Gets the CSS badge class for an ImportantDateType
    /// </summary>
    public static string GetDateTypeBadge(ImportantDateType type) => type switch
    {
        ImportantDateType.Birthday => "bg-primary",
        ImportantDateType.Anniversary => "bg-danger",
        ImportantDateType.Graduation => "bg-success",
        ImportantDateType.Memorial => "bg-secondary",
        ImportantDateType.Holiday => "bg-warning",
        ImportantDateType.Custom => "bg-info",
        _ => "bg-secondary"
    };

    /// <summary>
    /// Renders an icon from a stored value (Bootstrap Icon class or emoji)
    /// </summary>
    public static string RenderIcon(string? iconValue, string fallbackIcon = "bi-circle")
    {
        if (string.IsNullOrEmpty(iconValue))
            return fallbackIcon;

        if (iconValue.StartsWith("bi-"))
            return iconValue;

        return iconValue;
    }

    /// <summary>
    /// Dashboard/stat card icons
    /// </summary>
    public static class Dashboard
    {
        public const string FamilyMembers = "bi-people-fill";
        public const string UpcomingEvents = "bi-calendar-event";
        public const string GiftIdeas = "bi-lightbulb";
        public const string GiftSpending = "bi-currency-dollar";
    }

    /// <summary>
    /// Navigation icons
    /// </summary>
    public static class Nav
    {
        public const string Dashboard = "bi-speedometer2";
        public const string Family = "bi-people";
        public const string Dates = "bi-calendar-heart";
        public const string Gifts = "bi-gift";
        public const string GiftIdeas = "bi-lightbulb";
        public const string GiftHistory = "bi-gift";
        public const string AddressBook = "bi-envelope";
        public const string Calendar = "bi-calendar3";
        public const string Settings = "bi-gear";
    }

    /// <summary>
    /// Status icons
    /// </summary>
    public static class Status
    {
        public const string Active = "bi-check-circle-fill";
        public const string Inactive = "bi-x-circle";
        public const string Upcoming = "bi-clock";
        public const string Overdue = "bi-exclamation-triangle";
        public const string Today = "bi-calendar-check";
    }
}
