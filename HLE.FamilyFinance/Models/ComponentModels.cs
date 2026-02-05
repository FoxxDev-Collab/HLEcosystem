namespace HLE.FamilyFinance.Models
{
    /// <summary>
    /// Model for Button component
    /// </summary>
    public class ButtonModel
    {
        public string Text { get; set; } = "Button";
        public string Variant { get; set; } = "primary";
        public string Size { get; set; } = "md";
        public string Type { get; set; } = "button";
        public string? CssClass { get; set; }
        public string? Id { get; set; }
        public bool Disabled { get; set; }
        public string? Icon { get; set; }
        public string IconPosition { get; set; } = "left";
        public string? OnClick { get; set; }
        public string? Href { get; set; }
    }

    /// <summary>
    /// Model for Card component
    /// </summary>
    public class CardModel
    {
        public string? Title { get; set; }
        public string? Body { get; set; }
        public string? Footer { get; set; }
        public string Variant { get; set; } = "default";
        public string? CssClass { get; set; }
        public string? HeaderClass { get; set; }
        public string? BodyClass { get; set; }
    }

    /// <summary>
    /// Model for Alert component
    /// </summary>
    public class AlertModel
    {
        public string Message { get; set; } = "";
        public string Variant { get; set; } = "info";
        public bool Dismissible { get; set; }
        public string? Icon { get; set; }
        public string? Title { get; set; }
        public string? CssClass { get; set; }
    }

    /// <summary>
    /// Model for Badge component
    /// </summary>
    public class BadgeModel
    {
        public string Text { get; set; } = "";
        public string Variant { get; set; } = "primary";
        public bool Pill { get; set; }
        public string? CssClass { get; set; }
    }

    /// <summary>
    /// Model for Dialog/Modal component
    /// </summary>
    public class DialogModel
    {
        public string? Id { get; set; }
        public string Title { get; set; } = "Dialog";
        public string? Body { get; set; }
        public string? Footer { get; set; }
        public string Size { get; set; } = "md";
        public bool Centered { get; set; }
        public bool Scrollable { get; set; }
        public string Backdrop { get; set; } = "true";
        public string Keyboard { get; set; } = "true";
        public bool ShowCloseButton { get; set; } = true;
        public bool ShowFooter { get; set; } = true;
    }

    /// <summary>
    /// Model for Spinner component
    /// </summary>
    public class SpinnerModel
    {
        public string Variant { get; set; } = "primary";
        public string Size { get; set; } = "md";
        public string Type { get; set; } = "border";
        public string Text { get; set; } = "Loading...";
        public string? CssClass { get; set; }
    }

    /// <summary>
    /// Model for Progress Bar component
    /// </summary>
    public class ProgressBarModel
    {
        public int Value { get; set; }
        public string Variant { get; set; } = "primary";
        public bool Striped { get; set; }
        public bool Animated { get; set; }
        public string? Label { get; set; }
        public bool ShowPercentage { get; set; }
        public string? Height { get; set; }
        public string? CssClass { get; set; }
    }

    /// <summary>
    /// Model for Breadcrumb items
    /// </summary>
    public class BreadcrumbItem
    {
        public string Text { get; set; } = "";
        public string? Url { get; set; }
    }

    /// <summary>
    /// Model for Dropdown items
    /// </summary>
    public class DropdownItem
    {
        public string? Text { get; set; }
        public string? Url { get; set; }
        public bool Divider { get; set; }
        public bool Disabled { get; set; }
    }

    /// <summary>
    /// Model for Dropdown component
    /// </summary>
    public class DropdownModel
    {
        public string ButtonText { get; set; } = "Dropdown";
        public string Variant { get; set; } = "primary";
        public string Size { get; set; } = "md";
        public bool Split { get; set; }
        public string Direction { get; set; } = "down";
        public List<DropdownItem> Items { get; set; } = new();
        public string? Id { get; set; }
    }

    /// <summary>
    /// Model for Pagination component
    /// </summary>
    public class PaginationModel
    {
        public int CurrentPage { get; set; } = 1;
        public int TotalPages { get; set; } = 1;
        public string BaseUrl { get; set; } = "#";
        public string Size { get; set; } = "md";
        public bool ShowFirstLast { get; set; } = true;
        public int MaxVisible { get; set; } = 5;
    }

    /// <summary>
    /// Model for Navigation Bar component
    /// </summary>
    public class NavBarModel
    {
        public string Brand { get; set; } = "HLE App";
        public string BrandUrl { get; set; } = "/";
        public string? BrandLogo { get; set; }
        public string Variant { get; set; } = "light";
        public string Position { get; set; } = "sticky";
        public string? RightContent { get; set; }
    }
}
