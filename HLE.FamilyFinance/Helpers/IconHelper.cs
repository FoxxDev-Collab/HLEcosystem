using HLE.FamilyFinance.Models.Enums;

namespace HLE.FamilyFinance.Helpers;

/// <summary>
/// Provides Bootstrap Icon class mappings for various entity types
/// </summary>
public static class IconHelper
{
    /// <summary>
    /// Gets the Bootstrap Icon class for an AccountType
    /// </summary>
    public static string GetAccountIcon(AccountType type) => type switch
    {
        AccountType.Checking => "bi-bank",
        AccountType.Savings => "bi-piggy-bank",
        AccountType.CreditCard => "bi-credit-card",
        AccountType.Cash => "bi-cash-stack",
        AccountType.Investment => "bi-graph-up-arrow",
        AccountType.Loan => "bi-file-text",
        AccountType.HSA => "bi-heart-pulse",
        _ => "bi-wallet2"
    };

    /// <summary>
    /// Gets the Bootstrap Icon class for an AssetType
    /// </summary>
    public static string GetAssetIcon(AssetType type) => type switch
    {
        AssetType.RealEstate => "bi-house-door",
        AssetType.Vehicle => "bi-car-front",
        AssetType.Jewelry => "bi-gem",
        AssetType.Electronics => "bi-laptop",
        AssetType.Collectibles => "bi-collection",
        AssetType.Retirement => "bi-piggy-bank-fill",
        AssetType.Investment => "bi-graph-up",
        _ => "bi-box"
    };

    /// <summary>
    /// Gets the Bootstrap Icon class for a DebtType
    /// </summary>
    public static string GetDebtIcon(DebtType type) => type switch
    {
        DebtType.Mortgage => "bi-house",
        DebtType.AutoLoan => "bi-car-front",
        DebtType.StudentLoan => "bi-mortarboard",
        DebtType.PersonalLoan => "bi-person-lines-fill",
        DebtType.HELOC => "bi-house-door",
        DebtType.CreditCard => "bi-credit-card-2-back",
        DebtType.MedicalDebt => "bi-hospital",
        _ => "bi-file-earmark-text"
    };

    /// <summary>
    /// Gets the Bootstrap Icon class for a BillCategory
    /// </summary>
    public static string GetBillIcon(BillCategory category) => category switch
    {
        BillCategory.Utilities => "bi-lightning-charge",
        BillCategory.Insurance => "bi-shield-check",
        BillCategory.Subscriptions => "bi-arrow-repeat",
        BillCategory.Phone => "bi-phone",
        BillCategory.Internet => "bi-wifi",
        BillCategory.Rent => "bi-house-door",
        BillCategory.Mortgage => "bi-house",
        BillCategory.CarPayment => "bi-car-front",
        BillCategory.ChildCare => "bi-people",
        BillCategory.Streaming => "bi-tv",
        _ => "bi-receipt"
    };

    /// <summary>
    /// Gets the Bootstrap Icon class for a TaxDocumentType
    /// </summary>
    public static string GetTaxDocumentIcon(TaxDocumentType type) => type switch
    {
        TaxDocumentType.W2 => "bi-file-earmark-text",
        TaxDocumentType.Form1099_INT => "bi-bank",
        TaxDocumentType.Form1099_DIV => "bi-graph-up",
        TaxDocumentType.Form1099_NEC => "bi-person-workspace",
        TaxDocumentType.Form1098 => "bi-house",
        TaxDocumentType.Form1099_B => "bi-currency-exchange",
        TaxDocumentType.Form1099_R => "bi-calendar2-check",
        TaxDocumentType.Form1099_SA => "bi-heart-pulse",
        TaxDocumentType.Form5498_SA => "bi-heart-pulse",
        _ => "bi-file-earmark"
    };

    /// <summary>
    /// Default category icons mapped to Bootstrap Icons
    /// </summary>
    public static readonly Dictionary<string, string> CategoryIcons = new()
    {
        // Income categories
        ["Salary"] = "bi-cash-coin",
        ["Freelance"] = "bi-briefcase",
        ["Investments"] = "bi-graph-up-arrow",
        ["Rental Income"] = "bi-house-door",
        ["Gifts"] = "bi-gift",
        ["Other Income"] = "bi-cash-stack",

        // Expense categories
        ["Housing"] = "bi-house",
        ["Transportation"] = "bi-car-front",
        ["Food"] = "bi-basket",
        ["Utilities"] = "bi-lightning-charge",
        ["Healthcare"] = "bi-heart-pulse",
        ["Entertainment"] = "bi-film",
        ["Shopping"] = "bi-bag",
        ["Personal"] = "bi-person",
        ["Education"] = "bi-book",
        ["Financial"] = "bi-bank",
        ["Gifts & Donations"] = "bi-gift",
        ["Travel"] = "bi-airplane",

        // Default fallbacks
        ["Income"] = "bi-cash-coin",
        ["Expense"] = "bi-cart",
        ["Default"] = "bi-folder"
    };

    /// <summary>
    /// Gets a category icon by name, with fallback
    /// </summary>
    public static string GetCategoryIcon(string categoryName, bool isIncome = false)
    {
        if (CategoryIcons.TryGetValue(categoryName, out var icon))
            return icon;

        return isIncome ? CategoryIcons["Income"] : CategoryIcons["Expense"];
    }

    /// <summary>
    /// Renders an icon from a stored value (Bootstrap Icon class or emoji)
    /// If the value starts with "bi-", renders as Bootstrap Icon
    /// Otherwise renders as text (emoji or fallback)
    /// </summary>
    public static string RenderIcon(string? iconValue, string fallbackIcon = "bi-circle")
    {
        if (string.IsNullOrEmpty(iconValue))
            return fallbackIcon;

        // Already a Bootstrap Icon class
        if (iconValue.StartsWith("bi-"))
            return iconValue;

        // Legacy emoji - return as-is for backward compatibility
        return iconValue;
    }

    /// <summary>
    /// Dashboard/stat card icons
    /// </summary>
    public static class Dashboard
    {
        public const string NetWorth = "bi-gem";
        public const string Income = "bi-cash-stack";
        public const string Expenses = "bi-credit-card";
        public const string Savings = "bi-piggy-bank";
        public const string Budget = "bi-pie-chart";
        public const string Bills = "bi-receipt";
        public const string Assets = "bi-building";
        public const string Debts = "bi-file-text";
        public const string TaxCenter = "bi-calculator";
        public const string Import = "bi-upload";
    }

    /// <summary>
    /// Navigation icons
    /// </summary>
    public static class Nav
    {
        public const string Dashboard = "bi-speedometer2";
        public const string Accounts = "bi-bank";
        public const string Transactions = "bi-arrow-left-right";
        public const string Budgets = "bi-pie-chart";
        public const string Categories = "bi-tags";
        public const string Recurring = "bi-arrow-repeat";
        public const string Reports = "bi-bar-chart-line";
        public const string Assets = "bi-building";
        public const string Debts = "bi-file-text";
        public const string Bills = "bi-receipt";
        public const string TaxCenter = "bi-calculator";
        public const string Import = "bi-upload";
        public const string Settings = "bi-gear";
    }

    /// <summary>
    /// Status icons
    /// </summary>
    public static class Status
    {
        public const string Pending = "bi-hourglass-split";
        public const string Paid = "bi-check-circle";
        public const string Overdue = "bi-exclamation-triangle";
        public const string Scheduled = "bi-calendar-check";
        public const string Completed = "bi-check-circle-fill";
        public const string Filed = "bi-file-check";
        public const string Received = "bi-inbox";
    }
}
