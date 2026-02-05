# Quick Start Guide

Get started with the UI components and modern theme in 5 minutes!

## 1. View the Demo

Run your application and navigate to:
```
https://localhost:YOUR_PORT/Components/Demo
```

This page showcases all available components in both light and dark modes.

## 2. Toggle Dark Mode

Click the floating button in the bottom-right corner to switch between light and dark themes. Your preference is automatically saved!

## 3. Use Components in Your Views

### Method 1: Using ViewData (Simple)

```cshtml
@{
    ViewData["Text"] = "Save Changes";
    ViewData["Variant"] = "primary";
}
<partial name="_Button" />
```

### Method 2: Using Extension Methods (Cleaner)

```cshtml
@{
    ViewData.SetButton("Save Changes", "primary", "lg");
}
<partial name="_Button" />
```

### Method 3: Using Anonymous Objects (Inline)

```cshtml
<partial name="_Button" model='new { Text = "Save", Variant = "primary" }' />
```

## 4. Common Component Examples

### Button
```cshtml
@{ ViewData.SetButton("Click Me", "primary"); }
<partial name="_Button" />
```

### Card
```cshtml
@{ ViewData.SetCard("Card Title", "<p>Card content here</p>", "primary"); }
<partial name="_Card" />
```

### Alert
```cshtml
@{ ViewData.SetAlert("Success message!", "success", true); }
<partial name="_Alert" />
```

### Modal/Dialog
```cshtml
<!-- Trigger Button -->
<button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#myModal">
    Open Modal
</button>

<!-- Modal -->
@{ ViewData.SetDialog("myModal", "Modal Title", "<p>Modal content</p>"); }
<partial name="_Dialog" />
```

### Toast Notification (JavaScript)
```javascript
// In your JavaScript or inline script
Toast.success('Operation completed successfully!');
Toast.error('An error occurred!');
Toast.warning('Please check your input!');
Toast.info('Here is some information');
```

## 5. Available Component Variants

Most components support these variants:
- `primary` - Blue (main brand color)
- `secondary` - Dark gray
- `success` - Green
- `danger` - Red
- `warning` - Yellow
- `info` - Blue (same as primary)

## 6. Available Sizes

Buttons, modals, and other components support:
- `sm` - Small
- `md` - Medium (default)
- `lg` - Large
- `xl` - Extra large (modals only)

## 7. Customize the Theme

Edit `wwwroot/css/theme.css`:

```css
:root {
  --primary: rgb(30, 157, 241); /* Change to your brand color */
  --radius: 0.5rem; /* Adjust roundness */
}
```

## 8. Add Toast Container

For toast notifications to work, add this to your layout or page:

```cshtml
<partial name="_ToastContainer" />
```

This is already included in `_Layout.cshtml` if you're using the default layout.

## 9. JavaScript API

### Theme Toggle
```javascript
// Toggle theme
ThemeToggle.toggle();

// Set specific theme
ThemeToggle.setTheme('dark');
ThemeToggle.setTheme('light');

// Get current theme
const theme = ThemeToggle.getCurrentTheme(); // 'light' or 'dark'

// Listen for theme changes
window.addEventListener('themechange', (e) => {
    console.log('Theme changed to:', e.detail.theme);
});
```

### Toast Notifications
```javascript
// Quick methods
Toast.success('Success!');
Toast.error('Error!');
Toast.warning('Warning!');
Toast.info('Info!');

// Custom toast
Toast.show({
    message: 'Custom message',
    title: 'Custom Title',
    variant: 'primary',
    duration: 5000, // milliseconds
    position: 'top-end'
});
```

## 10. Full Example Page

```cshtml
@{
    ViewData["Title"] = "My Page";
}

<div class="container">
    <h1>My Page</h1>
    
    <!-- Alert -->
    @{ ViewData.SetAlert("Welcome to the page!", "info", true); }
    <partial name="_Alert" />
    
    <!-- Cards in a row -->
    <div class="row g-3 mt-3">
        <div class="col-md-4">
            @{ ViewData.SetCard("Card 1", "<p>First card</p>", "primary"); }
            <partial name="_Card" />
        </div>
        <div class="col-md-4">
            @{ ViewData.SetCard("Card 2", "<p>Second card</p>", "success"); }
            <partial name="_Card" />
        </div>
        <div class="col-md-4">
            @{ ViewData.SetCard("Card 3", "<p>Third card</p>", "warning"); }
            <partial name="_Card" />
        </div>
    </div>
    
    <!-- Buttons -->
    <div class="mt-4">
        @{ ViewData.SetButton("Primary", "primary"); }
        <partial name="_Button" />
        
        @{ ViewData.SetButton("Success", "success"); }
        <partial name="_Button" />
        
        <button class="btn btn-primary" onclick="Toast.success('Button clicked!')">
            Show Toast
        </button>
    </div>
</div>
```

## 11. Tips & Tricks

### Tip 1: Use Theme Variables in Custom CSS
```css
.my-custom-component {
    background-color: var(--card);
    color: var(--foreground);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
}
```

### Tip 2: Test in Both Themes
Always test your pages in both light and dark modes to ensure proper contrast and readability.

### Tip 3: Use Semantic Colors
Use `--destructive` for errors, `--primary` for actions, `--muted` for backgrounds, etc.

### Tip 4: Leverage Utility Classes
```html
<div class="bg-card text-foreground rounded-lg shadow-md p-4">
    Content with theme-aware styling
</div>
```

## 12. Common Patterns

### Success Message After Form Submit
```cshtml
@if (TempData["SuccessMessage"] != null)
{
    @{ ViewData.SetAlert(TempData["SuccessMessage"].ToString(), "success", true); }
    <partial name="_Alert" />
}
```

### Confirmation Modal
```cshtml
<!-- Trigger -->
<button class="btn btn-danger" data-bs-toggle="modal" data-bs-target="#confirmDelete">
    Delete
</button>

<!-- Modal -->
@{
    ViewData["Id"] = "confirmDelete";
    ViewData["Title"] = "Confirm Delete";
    ViewData["Body"] = "<p>Are you sure you want to delete this item?</p>";
    ViewData["Footer"] = "<button class='btn btn-secondary' data-bs-dismiss='modal'>Cancel</button><button class='btn btn-danger'>Delete</button>";
}
<partial name="_Dialog" />
```

### Loading State
```cshtml
<div class="text-center">
    @{ ViewData["Variant"] = "primary"; }
    <partial name="_Spinner" />
    <p class="mt-2">Loading...</p>
</div>
```

## Need More Help?

- **Full Documentation**: See `COMPONENTS_README.md`
- **Theme Guide**: See `THEME_README.md`
- **Quick Reference**: See `COMPONENTS_QUICK_REFERENCE.md`
- **Demo Page**: Visit `/Components/Demo`

## Troubleshooting

### Dark mode not working?
- Ensure `theme-toggle.js` is loaded in your layout
- Check browser console for errors
- Clear browser cache

### Components not styled correctly?
- Verify all CSS files are loaded in correct order
- Check that `theme.css` is loaded before `components.css`
- Inspect element to see which styles are applied

### Toast not appearing?
- Ensure `_ToastContainer` partial is included
- Check that `toast.js` is loaded
- Verify Bootstrap JavaScript is loaded

---

**Happy Coding! 🎉**
