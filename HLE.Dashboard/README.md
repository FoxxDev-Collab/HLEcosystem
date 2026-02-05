# HLE Template - ASP.NET Core MVC with Authentik & PostgreSQL

> **Template Version:** v2.0 (January 2026)
> **Runtime:** .NET 10 (LTS)
> **Database:** PostgreSQL 17.7
> **Authentication:** Authentik (OIDC)
> **Deployment:** Podman containers on Linux

---

## Overview

This is the golden copy template for all HLEcosystem applications. It provides a pre-configured ASP.NET Core MVC application with:

- ✅ **.NET 10 LTS** - Latest long-term support release
- ✅ **PostgreSQL 17.7** - Production-ready database via Npgsql
- ✅ **Authentik OIDC** - Centralized authentication (no local user management)
- ✅ **Dark/Light Mode** - Theme toggle with localStorage persistence
- ✅ **Responsive UI** - Mobile-first design with modern components
- ✅ **Podman Ready** - Dockerfile included for containerized deployment

---

## Quick Start

### 1. Copy the Template

```bash
# From HLEcosystem root directory
cp -r MVC_Template_DB_Start/ HLE.YourApp/
cd HLE.YourApp/
```

### 2. Rename Project Files

```bash
# Rename project and solution files
mv HLE.Template.csproj HLE.YourApp.csproj
mv HLE.Template.sln HLE.YourApp.sln

# Update solution file to reference new .csproj
sed -i 's/HLE.Template/HLE.YourApp/g' HLE.YourApp.sln
```

### 3. Update Namespaces

Find and replace throughout the project:
- `HLE.Template` → `HLE.YourApp`

Files to update:
- All `.cs` files in Controllers/, Models/, Data/, Extensions/, ViewComponents/
- Views/_ViewImports.cshtml
- Program.cs

### 4. Configure Database

Update `appsettings.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=hle_yourapp;Username=hle_user;Password=CHANGE_ME"
  }
}
```

Create the database:

```bash
# If using containerized PostgreSQL
podman exec hle-postgres psql -U hle_admin -c "CREATE DATABASE hle_yourapp;"

# Or use psql directly
psql -h localhost -U hle_admin -c "CREATE DATABASE hle_yourapp;"
```

### 5. Configure Authentik

Update `appsettings.json`:

```json
{
  "Authentik": {
    "Authority": "https://auth.yourdomain.com/application/o/yourapp/",
    "ClientId": "your-client-id",
    "ClientSecret": "your-client-secret"
  }
}
```

**In Authentik:**
1. Create new OAuth2/OIDC Provider
2. Create Application linked to provider
3. Set Redirect URIs:
   - Production: `https://yourapp.domain.com/signin-oidc`
   - Development: `http://localhost:5000/signin-oidc`
4. Set Post Logout Redirect URIs:
   - Production: `https://yourapp.domain.com/signout-callback-oidc`
   - Development: `http://localhost:5000/signout-callback-oidc`

### 6. Use User Secrets for Development

```bash
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=hle_yourapp_dev;Username=dev_user;Password=dev_password"
dotnet user-secrets set "Authentik:ClientSecret" "your-secret-here"
```

### 7. Create Initial Migration

```bash
dotnet ef migrations add InitialCreate
dotnet ef database update
```

### 8. Run Locally

```bash
dotnet watch run
```

Navigate to `http://localhost:5000` and test authentication flow.

---

## Project Structure

```
HLE.YourApp/
├── Controllers/               # MVC controllers (thin, delegate to services)
│   ├── HomeController.cs
│   ├── ComponentsController.cs
│   └── SettingsController.cs
├── Data/
│   └── ApplicationDbContext.cs  # EF Core DbContext
├── Models/
│   ├── Entities/              # Database entities (add here)
│   ├── ViewModels/            # View-specific models (add here)
│   ├── ErrorViewModel.cs
│   └── ComponentModels.cs
├── Services/                  # Business logic (create as needed)
│   └── Interfaces/
├── Extensions/
│   └── ViewDataExtensions.cs
├── ViewComponents/
│   └── UserAvatarViewComponent.cs
├── Views/
│   ├── _ViewImports.cshtml
│   ├── _ViewStart.cshtml
│   ├── Home/
│   ├── Components/
│   ├── Settings/
│   └── Shared/
│       ├── _Layout.cshtml
│       ├── _Sidebar.cshtml
│       └── Components/
├── wwwroot/
│   ├── css/
│   ├── js/
│   └── lib/
├── Dockerfile
├── .dockerignore
├── appsettings.json
├── appsettings.Development.json
├── Program.cs
└── README.md (this file - update for your app)
```

---

## Key Features

### Authentication (Authentik OIDC)

User information is available via claims:

```csharp
// In controllers
if (User.Identity?.IsAuthenticated == true)
{
    var userName = User.Identity.Name;
    var email = User.FindFirst("email")?.Value;
    var preferredUsername = User.FindFirst("preferred_username")?.Value;
}
```

**No local user management needed.** All user profile updates, password changes, and registration are handled in Authentik.

### Database (PostgreSQL + EF Core)

Add entities to `Models/Entities/`:

```csharp
namespace HLE.YourApp.Models.Entities;

public class YourEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}
```

Register in `ApplicationDbContext`:

```csharp
public DbSet<YourEntity> YourEntities { get; set; }
```

Create configuration class (recommended):

```csharp
public class YourEntityConfiguration : IEntityTypeConfiguration<YourEntity>
{
    public void Configure(EntityTypeBuilder<YourEntity> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Name).HasMaxLength(200).IsRequired();
        builder.Property(e => e.CreatedAt).HasColumnType("timestamptz");
    }
}
```

Run migration:

```bash
dotnet ef migrations add AddYourEntity
dotnet ef database update
```

### Dark/Light Mode

Theme toggle is automatic. JavaScript in `wwwroot/js/theme-toggle.js` handles:
- User preference persistence in `localStorage`
- System preference detection
- Dynamic theme switching

CSS variables are defined in `wwwroot/css/themes.css`.

### UI Components

Reusable components available in `Views/Shared/`:
- `_Alert.cshtml` - Alert messages
- `_Avatar.cshtml` - User avatars
- `_Sidebar.cshtml` - Navigation sidebar

Component models in `Models/ComponentModels.cs`.

Demo page: `/Components/Demo`

---

## Deployment

### Build Container

```bash
podman build -t hle-yourapp:latest .
```

### Run Container

```bash
podman run -d \
  --name hle-yourapp \
  -p 8080:8080 \
  -e ASPNETCORE_ENVIRONMENT=Production \
  -e ConnectionStrings__DefaultConnection="Host=postgres.local;Port=5432;Database=hle_yourapp;Username=hle_user;Password=PASSWORD" \
  -e Authentik__ClientSecret="your-secret" \
  hle-yourapp:latest
```

### Quadlet (systemd integration)

Create `~/.config/containers/systemd/hle-yourapp.container`:

```ini
[Container]
Image=localhost/hle-yourapp:latest
PublishPort=8081:8080
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=ConnectionStrings__DefaultConnection=Host=postgres.local;Port=5432;Database=hle_yourapp;Username=hle_user;Password=PASSWORD
Environment=Authentik__ClientSecret=your-secret

[Service]
Restart=always

[Install]
WantedBy=default.target
```

Reload and start:

```bash
systemctl --user daemon-reload
systemctl --user start hle-yourapp.service
systemctl --user enable hle-yourapp.service
```

---

## Development Guidelines

### Code Patterns

See [CLAUDE.md](../CLAUDE.md) in the repository root for detailed patterns:
- Always use async/await for I/O operations
- Pass `CancellationToken` through async chains
- Use `AsNoTracking()` for read-only queries
- Project with `.Select()` to avoid over-fetching
- Thin controllers, logic in services
- Use ViewModels, not entities, in views

### Common Tasks

**Add a new page:**
1. Create controller action
2. Create view in `Views/[Controller]/[Action].cshtml`
3. Update sidebar navigation in `Views/Shared/_Sidebar.cshtml`

**Add a new service:**
1. Create interface in `Services/Interfaces/`
2. Create implementation in `Services/`
3. Register in `Program.cs`: `builder.Services.AddScoped<IYourService, YourService>()`

**Add background job:**
Consider using `IHostedService` or external tools like Hangfire.

---

## Best Practices

✅ **DO:**
- Keep controllers thin - delegate to services
- Use `[Authorize]` attribute on protected controllers/actions
- Validate all user input with `ModelState`
- Use anti-forgery tokens on forms (`@Html.AntiForgeryToken()`)
- Log with `ILogger<T>`
- Use migrations for database changes

❌ **DON'T:**
- Pass EF entities directly to views - use ViewModels
- Block async code with `.Result` or `.Wait()`
- Store secrets in source control
- Expose stack traces in production
- Over-fetch data from database

---

## Troubleshooting

### Authentication not working
- Verify Authentik Authority URL ends with trailing slash
- Check redirect URIs match exactly (https vs http, port numbers)
- Ensure Authentik is accessible from your dev machine
- Check browser console for CORS or redirect errors

### Database connection fails
- Verify PostgreSQL is running: `podman ps` or `systemctl status postgresql`
- Test connection: `psql -h localhost -U hle_user -d hle_yourapp`
- Check connection string format (semicolons, not spaces)

### Build fails
- Ensure .NET 10 SDK is installed: `dotnet --version`
- Restore packages: `dotnet restore`
- Clean and rebuild: `dotnet clean && dotnet build`

### Migration issues
- Check `ApplicationDbContext` is properly configured
- Verify connection string in active environment
- Delete Migrations folder and recreate if needed

---

## Support & Documentation

- **ASP.NET Core:** https://learn.microsoft.com/aspnet/core
- **Entity Framework Core:** https://learn.microsoft.com/ef/core
- **Authentik:** https://goauthentik.io/docs
- **Podman:** https://docs.podman.io
- **HLEcosystem plan.txt:** See repository root for architecture details

---

## Template Maintenance

When this template is updated:
1. Check `plan.txt` for version notes
2. Review `tracker.md` for change log
3. Consider updating existing apps with critical fixes
4. Update your app's README with app-specific details

---

**Last Updated:** January 2026
**Maintained by:** FoxxDev
