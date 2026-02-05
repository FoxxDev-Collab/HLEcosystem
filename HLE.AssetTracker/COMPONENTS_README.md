# Reusable UI Components Documentation

This document provides comprehensive documentation for all reusable UI components in the Compliance Tracker application.

## Table of Contents
1. [Button Component](#button-component)
2. [Card Component](#card-component)
3. [Navigation Bar Component](#navigation-bar-component)
4. [Dialog/Modal Component](#dialogmodal-component)
5. [Toast Notification Component](#toast-notification-component)
6. [Alert Component](#alert-component)
7. [Badge Component](#badge-component)
8. [Spinner Component](#spinner-component)
9. [Breadcrumb Component](#breadcrumb-component)
10. [Dropdown Component](#dropdown-component)
11. [Pagination Component](#pagination-component)
12. [Progress Bar Component](#progress-bar-component)

---

## Button Component

**Location:** `Views/Shared/_Button.cshtml`

### Usage

```cshtml
@{
    ViewData["Text"] = "Click Me";
    ViewData["Variant"] = "primary";
    ViewData["Size"] = "md";
    ViewData["Type"] = "button";
}
<partial name="_Button" />
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| Text | string | "Button" | Button text |
| Variant | string | "primary" | Button style (primary, secondary, success, danger, warning, info, light, dark, link, outline-*) |
| Size | string | "md" | Button size (sm, md, lg) |
| Type | string | "button" | Button type (button, submit, reset) |
| CssClass | string | "" | Additional CSS classes |
| Id | string | "" | Button ID attribute |
| Disabled | string | "False" | Disable button |
| Icon | string | "" | Icon class (e.g., "bi bi-check") |
| IconPosition | string | "left" | Icon position (left, right) |
| OnClick | string | "" | JavaScript onclick handler |
| Href | string | "" | If set, renders as link instead of button |

### Examples

```cshtml
<!-- Primary button -->
@{ ViewData["Text"] = "Save"; ViewData["Variant"] = "primary"; }
<partial name="_Button" />

<!-- Large success button with icon -->
@{ 
    ViewData["Text"] = "Submit"; 
    ViewData["Variant"] = "success"; 
    ViewData["Size"] = "lg";
    ViewData["Icon"] = "bi bi-check-circle";
}
<partial name="_Button" />

<!-- Outline button as link -->
@{ 
    ViewData["Text"] = "Learn More"; 
    ViewData["Variant"] = "outline-primary"; 
    ViewData["Href"] = "/about";
}
<partial name="_Button" />
```

---

## Card Component

**Location:** `Views/Shared/_Card.cshtml`

### Usage

```cshtml
@{
    ViewData["Title"] = "Card Title";
    ViewData["Body"] = "<p>Card content goes here</p>";
    ViewData["Footer"] = "Optional footer";
    ViewData["Variant"] = "default";
}
<partial name="_Card" />
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| Title | string | "" | Card header title |
| Body | string | "" | Card body content (HTML) |
| Footer | string | "" | Card footer content |
| Variant | string | "default" | Card style (default, primary, success, warning, danger, info) |
| CssClass | string | "" | Additional CSS classes |
| HeaderClass | string | "" | Additional header CSS classes |
| BodyClass | string | "" | Additional body CSS classes |

### Examples

```cshtml
<!-- Simple card -->
@{
    ViewData["Title"] = "Welcome";
    ViewData["Body"] = "<p>Welcome to our application!</p>";
    ViewData["Variant"] = "primary";
}
<partial name="_Card" />

<!-- Card with footer -->
@{
    ViewData["Title"] = "Statistics";
    ViewData["Body"] = "<h3>1,234</h3><p>Total Users</p>";
    ViewData["Footer"] = "Last updated: Today";
    ViewData["Variant"] = "success";
}
<partial name="_Card" />
```

---

## Navigation Bar Component

**Location:** `Views/Shared/_NavBar.cshtml`

### Usage

```cshtml
@{
    ViewData["Brand"] = "My App";
    ViewData["BrandUrl"] = "/";
    ViewData["Variant"] = "light";
    ViewData["Position"] = "sticky";
}
<partial name="_NavBar">
    <li class="nav-item">
        <a class="nav-link" href="/">Home</a>
    </li>
    <li class="nav-item">
        <a class="nav-link" href="/about">About</a>
    </li>
</partial>
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| Brand | string | "Compliance Tracker" | Brand name |
| BrandUrl | string | "/" | Brand link URL |
| BrandLogo | string | "" | Logo image URL |
| Variant | string | "light" | Navbar style (light, dark, primary) |
| Position | string | "sticky" | Navbar position (sticky, fixed, static) |
| RightContent | string | "" | Content for right side of navbar |

---

## Dialog/Modal Component

**Location:** `Views/Shared/_Dialog.cshtml`

### Usage

```cshtml
<!-- Button to trigger modal -->
<button type="button" class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#myModal">
    Open Modal
</button>

<!-- Modal definition -->
@{
    ViewData["Id"] = "myModal";
    ViewData["Title"] = "Modal Title";
    ViewData["Body"] = "<p>Modal content here</p>";
    ViewData["Size"] = "md";
}
<partial name="_Dialog" />
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| Id | string | auto-generated | Modal ID |
| Title | string | "Dialog" | Modal title |
| Body | string | "" | Modal body content (HTML) |
| Footer | string | "" | Custom footer content |
| Size | string | "md" | Modal size (sm, md, lg, xl) |
| Centered | string | "False" | Center modal vertically |
| Scrollable | string | "False" | Make modal body scrollable |
| Backdrop | string | "true" | Backdrop behavior (true, false, static) |
| Keyboard | string | "true" | Close on ESC key |
| ShowCloseButton | string | "True" | Show close button |
| ShowFooter | string | "True" | Show footer |

### Examples

```cshtml
<!-- Large centered modal -->
@{
    ViewData["Id"] = "confirmModal";
    ViewData["Title"] = "Confirm Action";
    ViewData["Body"] = "<p>Are you sure you want to proceed?</p>";
    ViewData["Size"] = "lg";
    ViewData["Centered"] = "True";
    ViewData["Footer"] = "<button class='btn btn-secondary' data-bs-dismiss='modal'>Cancel</button><button class='btn btn-danger'>Confirm</button>";
}
<partial name="_Dialog" />
```

---

## Toast Notification Component

**Location:** `Views/Shared/_ToastContainer.cshtml` and `wwwroot/js/toast.js`

### Setup

Add the toast container to your layout (before closing `</body>` tag):

```cshtml
<partial name="_ToastContainer" />
```

### JavaScript Usage

```javascript
// Success toast
Toast.success('Operation completed successfully!');

// Error toast
Toast.error('An error occurred!');

// Warning toast
Toast.warning('Please be careful!');

// Info toast
Toast.info('Here is some information');

// Custom toast
Toast.show({
    message: 'Custom message',
    title: 'Custom Title',
    variant: 'primary',
    duration: 5000,
    position: 'top-end',
    icon: 'bi bi-star-fill'
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| message | string | "" | Toast message |
| title | string | "" | Toast title |
| variant | string | "info" | Toast style (primary, secondary, success, danger, warning, info) |
| duration | number | 5000 | Auto-hide duration in ms (0 = no auto-hide) |
| icon | string | "" | Custom icon class |
| position | string | "top-end" | Toast position (top-start, top-center, top-end, bottom-start, bottom-center, bottom-end) |
| dismissible | boolean | true | Show close button |
| animation | boolean | true | Enable fade animation |

---

## Alert Component

**Location:** `Views/Shared/_Alert.cshtml`

### Usage

```cshtml
@{
    ViewData["Message"] = "This is an alert!";
    ViewData["Variant"] = "success";
    ViewData["Dismissible"] = "True";
}
<partial name="_Alert" />
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| Message | string | "" | Alert message (HTML) |
| Variant | string | "info" | Alert style (primary, secondary, success, danger, warning, info, light, dark) |
| Dismissible | string | "False" | Show close button |
| Icon | string | "" | Icon class |
| Title | string | "" | Alert title |
| CssClass | string | "" | Additional CSS classes |

---

## Badge Component

**Location:** `Views/Shared/_Badge.cshtml`

### Usage

```cshtml
@{
    ViewData["Text"] = "New";
    ViewData["Variant"] = "primary";
    ViewData["Pill"] = "True";
}
<partial name="_Badge" />
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| Text | string | "" | Badge text |
| Variant | string | "primary" | Badge style (primary, secondary, success, danger, warning, info, light, dark) |
| Pill | string | "False" | Rounded pill style |
| CssClass | string | "" | Additional CSS classes |

---

## Spinner Component

**Location:** `Views/Shared/_Spinner.cshtml`

### Usage

```cshtml
@{
    ViewData["Variant"] = "primary";
    ViewData["Type"] = "border";
    ViewData["Size"] = "md";
}
<partial name="_Spinner" />
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| Variant | string | "primary" | Spinner color |
| Type | string | "border" | Spinner type (border, grow) |
| Size | string | "md" | Spinner size (sm, md) |
| Text | string | "Loading..." | Screen reader text |
| CssClass | string | "" | Additional CSS classes |

---

## Breadcrumb Component

**Location:** `Views/Shared/_Breadcrumb.cshtml`

### Usage

```cshtml
@{
    ViewData["Items"] = new List<dynamic> {
        new { Text = "Home", Url = "/" },
        new { Text = "Library", Url = "/library" },
        new { Text = "Data", Url = "" }
    };
}
<partial name="_Breadcrumb" />
```

---

## Dropdown Component

**Location:** `Views/Shared/_Dropdown.cshtml`

### Usage

```cshtml
@{
    ViewData["ButtonText"] = "Dropdown";
    ViewData["Variant"] = "primary";
    ViewData["Items"] = new List<dynamic> {
        new { Text = "Action", Url = "#", Divider = false },
        new { Text = "Another action", Url = "#", Divider = false },
        new { Divider = true },
        new { Text = "Something else", Url = "#", Divider = false }
    };
}
<partial name="_Dropdown" />
```

---

## Pagination Component

**Location:** `Views/Shared/_Pagination.cshtml`

### Usage

```cshtml
@{
    ViewData["CurrentPage"] = "3";
    ViewData["TotalPages"] = "10";
    ViewData["BaseUrl"] = "/items";
}
<partial name="_Pagination" />
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| CurrentPage | string | "1" | Current page number |
| TotalPages | string | "1" | Total number of pages |
| BaseUrl | string | "#" | Base URL for pagination links |
| Size | string | "md" | Pagination size (sm, md, lg) |
| ShowFirstLast | string | "True" | Show first/last buttons |
| MaxVisible | string | "5" | Maximum visible page numbers |

---

## Progress Bar Component

**Location:** `Views/Shared/_ProgressBar.cshtml`

### Usage

```cshtml
@{
    ViewData["Value"] = "75";
    ViewData["Variant"] = "success";
    ViewData["Striped"] = "True";
    ViewData["Animated"] = "True";
}
<partial name="_ProgressBar" />
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| Value | string | "0" | Progress value (0-100) |
| Variant | string | "primary" | Progress bar color |
| Striped | string | "False" | Striped style |
| Animated | string | "False" | Animated stripes |
| Label | string | "" | Custom label |
| ShowPercentage | string | "False" | Show percentage |
| Height | string | "" | Custom height |
| CssClass | string | "" | Additional CSS classes |

---

## Demo Page

Visit `/Components/Demo` to see all components in action with live examples.

## Styling

All components use Bootstrap 5 classes with custom enhancements in `wwwroot/css/components.css`.

### Custom Features
- Hover effects on cards and buttons
- Smooth transitions and animations
- Dark mode support (respects system preferences)
- Responsive design
- Accessibility features

## Best Practices

1. **Consistency**: Use the same variant names across components (primary, success, danger, etc.)
2. **Accessibility**: Components include ARIA attributes and semantic HTML
3. **Responsive**: All components are mobile-friendly
4. **Performance**: Components are lightweight and use native Bootstrap functionality
5. **Customization**: Use ViewData parameters to customize components without modifying source files

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Dependencies

- Bootstrap 5.x
- jQuery (for Bootstrap components)
- Bootstrap Icons (optional, for icons)
