# Modern Minimalistic Theme Documentation

This application uses a modern, minimalistic theme inspired by shadcn/ui with full dark mode support.

## Features

- **CSS Variables**: All colors and styles use CSS custom properties for easy customization
- **Dark Mode**: Full dark mode support with automatic detection and manual toggle
- **Smooth Transitions**: All theme changes animate smoothly
- **Persistent Preferences**: User's theme choice is saved in localStorage
- **System Preference Detection**: Automatically detects user's OS theme preference
- **Accessible**: Proper focus states and ARIA attributes

## Color System

### Light Mode Colors

| Variable | Color | Usage |
|----------|-------|-------|
| `--background` | `rgb(255, 255, 255)` | Main background |
| `--foreground` | `rgb(15, 20, 25)` | Main text color |
| `--card` | `rgb(247, 248, 248)` | Card backgrounds |
| `--primary` | `rgb(30, 157, 241)` | Primary brand color |
| `--secondary` | `rgb(15, 20, 25)` | Secondary actions |
| `--destructive` | `rgb(244, 33, 46)` | Error/danger states |
| `--muted` | `rgb(229, 229, 230)` | Muted backgrounds |
| `--accent` | `rgb(227, 236, 246)` | Accent backgrounds |
| `--border` | `rgb(225, 234, 239)` | Border colors |

### Dark Mode Colors

| Variable | Color | Usage |
|----------|-------|-------|
| `--background` | `rgb(0, 0, 0)` | Main background |
| `--foreground` | `rgb(231, 233, 234)` | Main text color |
| `--card` | `rgb(23, 24, 28)` | Card backgrounds |
| `--primary` | `rgb(28, 156, 240)` | Primary brand color |
| `--muted` | `rgb(24, 24, 24)` | Muted backgrounds |
| `--border` | `rgb(36, 38, 40)` | Border colors |

## Typography

The theme uses a modern font stack:

```css
--font-sans: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
--font-serif: Georgia, serif;
--font-mono: Menlo, Monaco, Consolas, 'Courier New', monospace;
```

## Border Radius

Consistent border radius values:

```css
--radius-sm: calc(var(--radius) - 0.125rem);  /* ~0.375rem */
--radius-md: var(--radius);                    /* 0.5rem */
--radius-lg: calc(var(--radius) + 0.125rem);  /* ~0.625rem */
--radius-xl: calc(var(--radius) + 0.25rem);   /* ~0.75rem */
```

## Shadows

Multiple shadow levels for depth:

```css
--shadow-2xs: Minimal shadow
--shadow-xs: Extra small shadow
--shadow-sm: Small shadow
--shadow: Default shadow
--shadow-md: Medium shadow
--shadow-lg: Large shadow
--shadow-xl: Extra large shadow
--shadow-2xl: Maximum shadow
```

## Dark Mode Toggle

### JavaScript API

```javascript
// Toggle between light and dark
ThemeToggle.toggle();

// Set specific theme
ThemeToggle.setTheme('dark');
ThemeToggle.setTheme('light');

// Get current theme
const currentTheme = ThemeToggle.getCurrentTheme(); // 'light' or 'dark'
```

### Events

Listen for theme changes:

```javascript
window.addEventListener('themechange', function(e) {
    console.log('Theme changed to:', e.detail.theme);
});
```

### Toggle Button

A floating toggle button is automatically added to the bottom-right corner of the page. You can customize its position by modifying the `.theme-toggle` class in `theme.css`.

## Using Theme Variables

### In CSS

```css
.my-component {
    background-color: var(--card);
    color: var(--card-foreground);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
}

.my-button {
    background-color: var(--primary);
    color: var(--primary-foreground);
}

.my-button:hover {
    opacity: 0.9;
}
```

### Utility Classes

The theme provides utility classes for common use cases:

```html
<!-- Background colors -->
<div class="bg-background">Background</div>
<div class="bg-card">Card background</div>
<div class="bg-primary">Primary background</div>
<div class="bg-muted">Muted background</div>

<!-- Text colors -->
<p class="text-foreground">Foreground text</p>
<p class="text-primary">Primary text</p>
<p class="text-muted-foreground">Muted text</p>

<!-- Border radius -->
<div class="rounded-sm">Small radius</div>
<div class="rounded-md">Medium radius</div>
<div class="rounded-lg">Large radius</div>
<div class="rounded-xl">Extra large radius</div>

<!-- Shadows -->
<div class="shadow-sm">Small shadow</div>
<div class="shadow-md">Medium shadow</div>
<div class="shadow-lg">Large shadow</div>
```

## Component Integration

All UI components automatically use theme variables:

- **Cards**: Use `--card` background and `--border` for borders
- **Buttons**: Use variant colors (`--primary`, `--destructive`, etc.)
- **Modals**: Use `--card` background with `--shadow-2xl`
- **Dropdowns**: Use `--popover` background
- **Forms**: Use `--input` background with `--ring` for focus
- **Alerts**: Use variant colors with transparency
- **Navigation**: Uses `--card` background

## Customization

### Changing Colors

Edit `wwwroot/css/theme.css` and modify the CSS variables in `:root` and `.dark`:

```css
:root {
  --primary: rgb(30, 157, 241); /* Change to your brand color */
  --radius: 0.5rem; /* Adjust border radius */
}
```

### Changing Fonts

Update the font variables:

```css
:root {
  --font-sans: 'Your Font', sans-serif;
}
```

Don't forget to include the font in your `_Layout.cshtml`:

```html
<link href="https://fonts.googleapis.com/css2?family=Your+Font&display=swap" rel="stylesheet">
```

### Disabling Dark Mode

To disable dark mode, remove the theme toggle script from `_Layout.cshtml`:

```html
<!-- Remove this line -->
<script src="~/js/theme-toggle.js" asp-append-version="true"></script>
```

And remove the dark mode toggle button by adding this CSS:

```css
.theme-toggle {
    display: none;
}
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

CSS custom properties are supported in all modern browsers.

## Accessibility

The theme includes:

- Proper focus states with `--ring` color
- High contrast ratios for text
- ARIA attributes on interactive elements
- Keyboard navigation support
- Screen reader friendly

## Best Practices

1. **Always use theme variables** instead of hardcoded colors
2. **Test in both light and dark modes** when creating new components
3. **Use semantic color names** (e.g., `--destructive` instead of `--red`)
4. **Maintain contrast ratios** for accessibility
5. **Use the provided shadow variables** for consistent depth

## Migration from Bootstrap Colors

| Bootstrap | Theme Variable |
|-----------|---------------|
| `primary` | `var(--primary)` |
| `secondary` | `var(--secondary)` |
| `success` | `var(--chart-2)` |
| `danger` | `var(--destructive)` |
| `warning` | `var(--chart-3)` |
| `info` | `var(--primary)` |
| `light` | `var(--muted)` |
| `dark` | `var(--foreground)` |

## Files

- **Theme CSS**: `wwwroot/css/theme.css`
- **Component Styles**: `wwwroot/css/components.css`
- **Theme Toggle JS**: `wwwroot/js/theme-toggle.js`
- **Site CSS**: `wwwroot/css/site.css`

## Examples

See the Components Demo page (`/Components/Demo`) to view all components styled with the theme in both light and dark modes.
