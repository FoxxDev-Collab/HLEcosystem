using HLE.FamilyFinance.Data;
using HLE.FamilyFinance.Middleware;
using HLE.FamilyFinance.Services;
using HLE.FamilyFinance.Services.Interfaces;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();

// Increase form value count limit for large imports (default is 1024)
builder.Services.Configure<FormOptions>(options =>
{
    options.ValueCountLimit = 10000;
});

// Add session support for authentication flows
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

// Configure PostgreSQL Database
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

// Register application services
builder.Services.AddScoped<IHouseholdService, HouseholdService>();
builder.Services.AddScoped<IAccountService, AccountService>();
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<ITransactionService, TransactionService>();
builder.Services.AddScoped<IBudgetService, BudgetService>();
builder.Services.AddScoped<IRecurringTransactionService, RecurringTransactionService>();
builder.Services.AddScoped<IReportService, ReportService>();

// Asset & Debt services
builder.Services.AddScoped<IAssetService, AssetService>();
builder.Services.AddScoped<IDebtService, DebtService>();

// Bill tracking services
builder.Services.AddScoped<IBillService, BillService>();

// Tax services
builder.Services.Configure<TaxDocumentStorageSettings>(
    builder.Configuration.GetSection("TaxDocumentStorage"));
builder.Services.AddScoped<ITaxDocumentStorageService, TaxDocumentStorageService>();
builder.Services.AddScoped<ITaxService, TaxService>();

// Import services
builder.Services.AddScoped<IImportService, ImportService>();

// Budget Planner services
builder.Services.AddScoped<IBudgetPlannerService, BudgetPlannerService>();

// Configure Authentik OIDC Authentication
builder.Services.AddAuthentication(options =>
{
    options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = OpenIdConnectDefaults.AuthenticationScheme;
})
.AddCookie(options =>
{
    options.ExpireTimeSpan = TimeSpan.FromHours(8);
    options.SlidingExpiration = true;
})
.AddOpenIdConnect(options =>
{
    options.Authority = builder.Configuration["Authentik:Authority"];
    options.ClientId = builder.Configuration["Authentik:ClientId"];
    options.ClientSecret = builder.Configuration["Authentik:ClientSecret"];
    options.ResponseType = "code";
    options.SaveTokens = true;
    options.GetClaimsFromUserInfoEndpoint = true;

    // Allow HTTP for local Authentik development (set to true in production)
    options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();

    options.Scope.Clear();
    options.Scope.Add("openid");
    options.Scope.Add("profile");
    options.Scope.Add("email");

    // Map Authentik claims to .NET identity
    options.TokenValidationParameters = new TokenValidationParameters
    {
        NameClaimType = "name",
        RoleClaimType = "groups"
    };
});

var app = builder.Build();

// Ensure database is created and apply migrations
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    dbContext.Database.Migrate();
}

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseRouting();

app.UseSession();
app.UseAuthentication();
app.UseAuthorization();

// Add household context for authenticated users (after auth middleware)
app.UseHouseholdContext();

app.MapStaticAssets();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();

app.Run();
