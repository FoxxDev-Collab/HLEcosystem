using Microsoft.AspNetCore.Mvc.ViewFeatures;

namespace HLE.FamilyHub.Extensions
{
    /// <summary>
    /// Extension methods for easier ViewData manipulation when using UI components
    /// </summary>
    public static class ViewDataExtensions
    {
        public static void SetValues(this ViewDataDictionary viewData, object values)
        {
            if (values == null) return;

            var properties = values.GetType().GetProperties();
            foreach (var prop in properties)
            {
                var value = prop.GetValue(values);
                if (value != null)
                {
                    viewData[prop.Name] = value.ToString();
                }
            }
        }

        public static void SetButton(this ViewDataDictionary viewData, string text, string variant = "primary", string size = "md")
        {
            viewData["Text"] = text;
            viewData["Variant"] = variant;
            viewData["Size"] = size;
        }

        public static void SetCard(this ViewDataDictionary viewData, string title, string body, string variant = "default", string? footer = null)
        {
            viewData["Title"] = title;
            viewData["Body"] = body;
            viewData["Variant"] = variant;
            if (footer != null) viewData["Footer"] = footer;
        }

        public static void SetAlert(this ViewDataDictionary viewData, string message, string variant = "info", bool dismissible = false)
        {
            viewData["Message"] = message;
            viewData["Variant"] = variant;
            viewData["Dismissible"] = dismissible.ToString();
        }

        public static void SetBadge(this ViewDataDictionary viewData, string text, string variant = "primary", bool pill = false)
        {
            viewData["Text"] = text;
            viewData["Variant"] = variant;
            viewData["Pill"] = pill.ToString();
        }

        public static void SetDialog(this ViewDataDictionary viewData, string id, string title, string body, string size = "md")
        {
            viewData["Id"] = id;
            viewData["Title"] = title;
            viewData["Body"] = body;
            viewData["Size"] = size;
        }

        public static void SetProgressBar(this ViewDataDictionary viewData, int value, string variant = "primary", bool striped = false, bool animated = false)
        {
            viewData["Value"] = value.ToString();
            viewData["Variant"] = variant;
            viewData["Striped"] = striped.ToString();
            viewData["Animated"] = animated.ToString();
        }
    }
}
