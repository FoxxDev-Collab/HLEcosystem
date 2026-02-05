# UI Components Quick Reference

## Quick Usage Examples

### Button
```cshtml
@{ ViewData["Text"] = "Click Me"; ViewData["Variant"] = "primary"; }
<partial name="_Button" />
```

### Card
```cshtml
@{
    ViewData["Title"] = "Card Title";
    ViewData["Body"] = "<p>Content here</p>";
    ViewData["Variant"] = "primary";
}
<partial name="_Card" />
```

### Alert
```cshtml
@{
    ViewData["Message"] = "Success!";
    ViewData["Variant"] = "success";
    ViewData["Dismissible"] = "True";
}
<partial name="_Alert" />
```

### Badge
```cshtml
@{ ViewData["Text"] = "New"; ViewData["Variant"] = "primary"; ViewData["Pill"] = "True"; }
<partial name="_Badge" />
```

### Modal
```cshtml
<!-- Trigger -->
<button data-bs-toggle="modal" data-bs-target="#myModal">Open</button>

<!-- Modal -->
@{
    ViewData["Id"] = "myModal";
    ViewData["Title"] = "Title";
    ViewData["Body"] = "<p>Content</p>";
}
<partial name="_Dialog" />
```

### Toast (JavaScript)
```javascript
Toast.success('Success message!');
Toast.error('Error message!');
Toast.warning('Warning message!');
Toast.info('Info message!');
```

### Spinner
```cshtml
@{ ViewData["Variant"] = "primary"; ViewData["Type"] = "border"; }
<partial name="_Spinner" />
```

### Progress Bar
```cshtml
@{
    ViewData["Value"] = "75";
    ViewData["Variant"] = "success";
    ViewData["Striped"] = "True";
}
<partial name="_ProgressBar" />
```

### Breadcrumb
```cshtml
@{
    ViewData["Items"] = new List<dynamic> {
        new { Text = "Home", Url = "/" },
        new { Text = "Current", Url = "" }
    };
}
<partial name="_Breadcrumb" />
```

### Dropdown
```cshtml
@{
    ViewData["ButtonText"] = "Menu";
    ViewData["Variant"] = "primary";
    ViewData["Items"] = new List<dynamic> {
        new { Text = "Action", Url = "#" },
        new { Divider = true },
        new { Text = "Another", Url = "#" }
    };
}
<partial name="_Dropdown" />
```

### Pagination
```cshtml
@{
    ViewData["CurrentPage"] = "3";
    ViewData["TotalPages"] = "10";
    ViewData["BaseUrl"] = "/items";
}
<partial name="_Pagination" />
```

## Common Variants

- **primary** - Blue
- **secondary** - Gray
- **success** - Green
- **danger** - Red
- **warning** - Yellow
- **info** - Cyan
- **light** - Light gray
- **dark** - Dark gray

## Common Sizes

- **sm** - Small
- **md** - Medium (default)
- **lg** - Large
- **xl** - Extra large (modals only)

## File Locations

- **Components**: `Views/Shared/_*.cshtml`
- **Styles**: `wwwroot/css/components.css`
- **Toast JS**: `wwwroot/js/toast.js`
- **Models**: `Models/ComponentModels.cs`
- **Demo**: `/Components/Demo`

## Setup Checklist

1. ✅ Add to `_Layout.cshtml`:
   ```cshtml
   <link rel="stylesheet" href="~/css/components.css" asp-append-version="true" />
   ```

2. ✅ For Toast notifications, add before `</body>`:
   ```cshtml
   <partial name="_ToastContainer" />
   ```

3. ✅ Ensure Bootstrap 5 is included in your layout

## Tips

- Use `ViewData` to pass parameters to components
- Components support HTML in content fields
- All components are responsive by default
- Components follow Bootstrap 5 conventions
- Toast notifications require JavaScript
- Check `COMPONENTS_README.md` for full documentation
