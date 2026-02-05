# CLAUDE.md - HLEcosystem Development Guidelines

> This file provides context for Claude Code when working on HLEcosystem projects.
> Target: .NET 10 LTS | ASP.NET Core MVC | Entity Framework Core | Linux/Docker Compose

---

## Related Documentation

| File | Purpose |
|------|---------|
| `plan.txt` | Project scope, architecture, deployment strategy, app roadmap |
| `CLAUDE.md` | Code patterns, best practices, conventions (this file) |
| `tracker.md` | Living progress log, decision history, task tracking |

For architecture decisions, authentication setup, or deployment config, see `plan.txt`.
For project history, completed tasks, and current status, see `tracker.md`.

---

## Quick Reference

- **Runtime**: .NET 10 (LTS)
- **Language**: C# 14
- **Database**: PostgreSQL 17.7 via EF Core + Npgsql
- **Auth**: Authentik (OIDC)
- **Deploy**: Docker Compose on Linux (all apps + PostgreSQL orchestrated together)

---

## Code Patterns

### Async/Await (Always for I/O)

```csharp
// ✅ DO: Async for all I/O operations
public async Task<List<Budget>> GetBudgetsAsync(int userId, CancellationToken ct = default)
{
    return await _context.Budgets
        .Where(b => b.UserId == userId)
        .ToListAsync(ct);
}

// ❌ DON'T: Block on async code
public List<Budget> GetBudgets(int userId)
{
    return _context.Budgets.Where(b => b.UserId == userId).ToList(); // Blocking
}
```

### Entity Framework Core

```csharp
// ✅ DO: No-tracking for read-only queries
var items = await _context.Items
    .AsNoTracking()
    .Where(i => i.CategoryId == categoryId)
    .Select(i => new ItemDto { Id = i.Id, Name = i.Name }) // Project only needed fields
    .ToListAsync(ct);

// ✅ DO: Use FindAsync for single entity by PK
var item = await _context.Items.FindAsync(new object[] { id }, ct);

// ❌ DON'T: Fetch entire entities for display
var items = await _context.Items.Include(i => i.Category).ToListAsync(); // Over-fetching
```

### Dependency Injection

```csharp
// ✅ DO: Constructor injection, interface-based
public class BudgetService : IBudgetService
{
    private readonly AppDbContext _context;
    private readonly ILogger<BudgetService> _logger;

    public BudgetService(AppDbContext context, ILogger<BudgetService> logger)
    {
        _context = context;
        _logger = logger;
    }
}

// ✅ DO: Register services by lifetime
builder.Services.AddScoped<IBudgetService, BudgetService>();    // Per-request
builder.Services.AddSingleton<ICacheService, MemoryCacheService>(); // App lifetime
builder.Services.AddTransient<IEmailSender, SmtpEmailSender>(); // Per-injection

// ❌ DON'T: Store HttpContext in fields or use from background tasks
```

### Exception Handling

```csharp
// ✅ DO: Catch specific exceptions you can handle
public async Task<IActionResult> CreateItem(ItemCreateDto dto)
{
    try
    {
        await _itemService.CreateAsync(dto);
        return RedirectToAction(nameof(Index));
    }
    catch (DuplicateItemException ex)
    {
        ModelState.AddModelError("Name", ex.Message);
        return View(dto);
    }
    // Let other exceptions bubble up to global handler
}

// ✅ DO: Use global exception handler in Program.cs
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
}

// ❌ DON'T: Catch generic Exception unless logging/rethrowing
catch (Exception ex) { /* swallowed */ } // Bad
```

### Caching

```csharp
// ✅ DO: Cache stable data
public async Task<List<Category>> GetCategoriesAsync()
{
    const string cacheKey = "categories_all";
    
    if (!_cache.TryGetValue(cacheKey, out List<Category>? categories))
    {
        categories = await _context.Categories.AsNoTracking().ToListAsync();
        _cache.Set(cacheKey, categories, TimeSpan.FromHours(1));
    }
    
    return categories!;
}

// Register in Program.cs
builder.Services.AddMemoryCache();
```

---

## MVC Patterns

### Controller Structure

```csharp
// ✅ DO: Thin controllers, logic in services
public class BudgetController : Controller
{
    private readonly IBudgetService _budgetService;

    public BudgetController(IBudgetService budgetService)
    {
        _budgetService = budgetService;
    }

    public async Task<IActionResult> Index()
    {
        var budgets = await _budgetService.GetUserBudgetsAsync(User.GetUserId());
        return View(budgets);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(BudgetCreateViewModel model)
    {
        if (!ModelState.IsValid)
            return View(model);

        await _budgetService.CreateAsync(model, User.GetUserId());
        return RedirectToAction(nameof(Index));
    }
}
```

### ViewModels (Not Entities)

```csharp
// ✅ DO: Use ViewModels for views
public class BudgetIndexViewModel
{
    public List<BudgetSummaryDto> Budgets { get; set; } = [];
    public decimal TotalBudgeted { get; set; }
    public decimal TotalSpent { get; set; }
}

// ❌ DON'T: Pass EF entities directly to views
return View(await _context.Budgets.ToListAsync()); // Exposes too much
```

### Anti-Forgery Tokens

```csharp
// ✅ DO: Always on POST/PUT/DELETE forms
<form asp-action="Create" method="post">
    @Html.AntiForgeryToken()
    <!-- or use asp-antiforgery="true" on form tag -->
</form>

// Controller
[HttpPost]
[ValidateAntiForgeryToken]
public async Task<IActionResult> Create(Model model)
```

---

## C# 14 Features to Use

```csharp
// Field-backed properties (new in C# 14)
public string Name
{
    get => field;
    set => field = value?.Trim() ?? throw new ArgumentNullException();
}

// Null-conditional assignment (new in C# 14)
obj?.Property = value;

// Collection expressions
List<int> numbers = [1, 2, 3, 4, 5];
int[] array = [..existingList, 6, 7, 8];

// Primary constructors (use for simple DI)
public class ItemService(AppDbContext context, ILogger<ItemService> logger) : IItemService
{
    public async Task<Item?> GetAsync(int id) => await context.Items.FindAsync(id);
}

// Pattern matching
return item switch
{
    { IsArchived: true } => "Archived",
    { Quantity: 0 } => "Out of Stock",
    { Quantity: < 10 } => "Low Stock",
    _ => "In Stock"
};
```

---

## Project Structure

```
HLE.AppName/
├── Controllers/           # Thin, route handling only
├── Services/              # Business logic (interfaces + implementations)
├── Models/
│   ├── Entities/          # EF Core entities
│   └── ViewModels/        # View-specific models
├── Data/
│   ├── AppDbContext.cs
│   └── Migrations/
├── Views/
│   ├── Shared/
│   │   ├── _Layout.cshtml
│   │   ├── _Sidebar.cshtml
│   │   └── Components/    # View components
│   └── [Controller]/
├── wwwroot/
│   ├── css/
│   ├── js/
│   └── lib/
├── Program.cs
├── appsettings.json
└── Dockerfile
```

---

## Database Conventions

### NuGet Package

```bash
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL
```

### Entity Configuration

```csharp
// ✅ DO: Fluent API in separate configuration classes
public class BudgetConfiguration : IEntityTypeConfiguration<Budget>
{
    public void Configure(EntityTypeBuilder<Budget> builder)
    {
        builder.HasKey(b => b.Id);
        builder.Property(b => b.Name).HasMaxLength(100).IsRequired();
        builder.Property(b => b.Amount).HasPrecision(18, 2);
        builder.HasIndex(b => new { b.UserId, b.Month }).IsUnique();
        
        // PostgreSQL-specific: Use timestamptz for dates
        builder.Property(b => b.CreatedAt).HasColumnType("timestamptz");
    }
}

// Register in DbContext
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
}
```

### PostgreSQL Data Types

```csharp
// ✅ DO: Use appropriate PostgreSQL types
public class Entity
{
    public int Id { get; set; }                    // serial/integer
    public Guid ExternalId { get; set; }           // uuid
    public string Name { get; set; } = "";         // text/varchar
    public decimal Amount { get; set; }            // numeric(18,2)
    public DateTime CreatedAt { get; set; }        // timestamptz
    public DateOnly Date { get; set; }             // date
    public string[] Tags { get; set; } = [];       // text[] (PostgreSQL array)
    public JsonDocument? Metadata { get; set; }    // jsonb
}

// Configuration for arrays and JSON
builder.Property(e => e.Tags).HasColumnType("text[]");
builder.Property(e => e.Metadata).HasColumnType("jsonb");
```

### Migrations

```bash
# Create migration
dotnet ef migrations add AddBudgetTable

# Apply migrations
dotnet ef database update

# Generate SQL script (for production)
dotnet ef migrations script -o migration.sql

# Apply to specific database (connection string override)
dotnet ef database update --connection "Host=localhost;Database=hle_budgeting;..."
```

---

## Configuration

### appsettings.json Structure

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=postgres.local;Port=5432;Database=hle_appname;Username=hle_user;Password="
  },
  "Authentik": {
    "Authority": "https://auth.domain.com/application/o/app-name/",
    "ClientId": "",
    "ClientSecret": ""
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "Microsoft.EntityFrameworkCore": "Warning"
    }
  }
}
```

### Program.cs Database Setup

```csharp
// PostgreSQL with Npgsql
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));
```

### Secrets (Development)

```bash
# Use user-secrets for local dev, never commit secrets
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=hle_appname;Username=dev_user;Password=dev_password"
dotnet user-secrets set "Authentik:ClientSecret" "your-secret"
```

---

## Common Pitfalls

| Problem | Solution |
|---------|----------|
| N+1 queries | Use `.Include()` or project with `.Select()` |
| Blocking async | Never use `.Result` or `.Wait()` |
| Over-fetching | Use `.Select()` to project only needed fields |
| Missing cancellation | Pass `CancellationToken` through async chain |
| HttpContext in background | Capture needed values before spawning tasks |
| Large object allocations | Use `ArrayPool<T>`, `Span<T>` for hot paths |
| Swallowing exceptions | Catch specific types, let others bubble |

---

## Testing Checklist

- [ ] Unit tests for service methods
- [ ] Integration tests for critical paths
- [ ] Validate anti-forgery on all mutating endpoints
- [ ] Test with no-auth and wrong-user scenarios
- [ ] Verify EF queries with SQL logging enabled

---

## Deployment Notes

- All apps deployed via Docker Compose on Linux
- Container runs as non-root user
- PostgreSQL 17.7 as a compose service (`postgres`), shared by all apps
- Database per app: `hle_dashboard`, `hle_familyfinance`, `hle_assettracker`, `hle_familyhealth`, `hle_fileserver`, `hle_familyhub`
- Inter-app communication via Docker internal network (`hle-network`)
- Environment: `ASPNETCORE_ENVIRONMENT=Production`
- Health check endpoint: `/health`
- Logs to stdout (captured by Docker)
- Connection string via environment variable or Docker Compose config
- See `plan.txt` for full Docker Compose configuration and architecture