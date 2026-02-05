# Icon Library System

A custom, theme-aware icon library for File Server MVC that replaces external CDN dependencies.

## Features

- **Theme-Aware**: Icons automatically adapt to light/dark themes
- **No External Dependencies**: All icons are embedded in the application
- **Consistent Design**: Based on Bootstrap Icons style
- **Easy to Use**: Simple API for rendering icons
- **Performance**: No external requests, instant loading

## Usage

### Method 1: Using the Icons Helper (Recommended)

```csharp
@using file_server.Helpers

<!-- Basic usage -->
@Html.Raw(Icons.Get("icon-name"))

<!-- With custom size -->
@Html.Raw(Icons.Get("upload", 24))

<!-- With CSS class -->
@Html.Raw(Icons.Get("download", 16, "me-2"))

<!-- In a button -->
<button class="btn btn-primary">
    @Html.Raw(Icons.Get("upload", 16, "me-2"))
    Upload Files
</button>
```

### Method 2: Using the Partial View

```csharp
@{
    ViewData["Name"] = "icon-name";
    ViewData["Size"] = 16;           // Optional, default is 16
    ViewData["Class"] = "me-2";      // Optional CSS classes
}
@await Html.PartialAsync("_Icon")
```

## Available Icons

### Files & Folders
- `file` - Generic file icon
- `folder` - Folder icon
- `folder-plus` - Create folder icon

### Actions
- `download` - Download action
- `upload` - Upload action
- `edit` - Edit/rename action
- `trash` - Delete action
- `move` - Move action
- `share` - Share action

### UI Elements
- `x` - Close/cancel
- `check` - Checkmark
- `check-circle` - Success indicator
- `menu` - Hamburger menu
- `search` - Search icon
- `user` - User profile
- `settings` - Settings/configuration

### Dashboard & Stats
- `cloud-download` - Cloud storage
- `grid` - Grid/dashboard
- `activity` - Activity/document

### Navigation
- `arrow-left` - Navigate left
- `arrow-right` - Navigate right
- `chevron-down` - Dropdown
- `chevron-up` - Collapse

### Alerts & Status
- `info` - Information
- `alert` - Warning
- `lock` - Security/locked

## Viewing All Icons

Navigate to `/Shared/Icons` (you'll need to create a route) or access the Icons.cshtml view directly to see all available icons with examples.

## Icon Sizes

Default size is 16px. Common sizes:
- 14px - Small inline icons
- 16px - Default, for buttons and inline text
- 20px - Medium icons
- 24px - Large icons
- 32px - Extra large icons
- 48px - Hero icons

## Styling

Icons automatically inherit the text color from their parent element:

```html
<div class="text-primary">
    @Html.Raw(Icons.Get("check"))  <!-- Will be blue -->
</div>

<div class="text-danger">
    @Html.Raw(Icons.Get("alert"))  <!-- Will be red -->
</div>
```

## CSS Classes

The `icons.css` file provides utility classes:

```css
.icon-sm    /* 14px */
.icon-md    /* 20px */
.icon-lg    /* 24px */
.icon-xl    /* 32px */
.icon-2xl   /* 48px */

.icon-primary    /* Primary theme color */
.icon-success    /* Success color */
.icon-danger     /* Danger color */
/* ... etc */
```

## Adding New Icons

To add a new icon:

1. Open `Helpers/Icons.cs`
2. Add the SVG path to the `IconPaths` dictionary:
```csharp
["your-icon-name"] = "M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0z..."
```
3. The icon is immediately available via `Icons.Get("your-icon-name")`

## Migration Guide

### Before (with inline SVG):
```html
<button class="btn btn-primary">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
        <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
    </svg>
    Upload
</button>
```

### After (with icon library):
```csharp
@using file_server.Helpers

<button class="btn btn-primary">
    @Html.Raw(Icons.Get("upload", 16, "me-2"))
    Upload
</button>
```

## Benefits

1. **Cleaner Code**: No more cluttered SVG markup in views
2. **Consistency**: All icons use the same system
3. **Maintainability**: Update icons in one place
4. **Performance**: No external CDN requests
5. **Theme Support**: Automatic dark/light mode adaptation
6. **Type Safety**: Icons are defined in C# with IntelliSense support
