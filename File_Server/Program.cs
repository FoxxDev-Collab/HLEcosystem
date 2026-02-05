using System.Security.Claims;
using HLE.FileServer.Data;
using HLE.FileServer.Models;
using HLE.FileServer.Services;
using HLE.FileServer.ViewEngine;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Mvc.Razor;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();

// Add session support for authentication flows
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

// Register mobile detection service
builder.Services.AddSingleton<IMobileDetectionService, MobileDetectionService>();

// Configure Razor view engine with mobile view location expander
builder.Services.Configure<RazorViewEngineOptions>(options =>
{
    options.ViewLocationExpanders.Add(new MobileViewLocationExpander());
});

// Configure PostgreSQL Database
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

// Configure Storage Settings
builder.Services.Configure<StorageSettings>(builder.Configuration.GetSection("Storage"));
builder.Services.AddSingleton<IStorageService, StorageService>();

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

    // Allow HTTP for local Authentik development
    options.RequireHttpsMetadata = false;

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

    options.Events = new OpenIdConnectEvents
    {
        OnTokenValidated = async context =>
        {
            // Sync user to local database on login
            var dbContext = context.HttpContext.RequestServices.GetRequiredService<ApplicationDbContext>();
            var userId = context.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (!string.IsNullOrEmpty(userId))
            {
                var user = await dbContext.Users.FindAsync(userId);
                if (user == null)
                {
                    user = new ApplicationUser
                    {
                        Id = userId,
                        ExternalId = userId,
                        Email = context.Principal?.FindFirst(ClaimTypes.Email)?.Value,
                        FirstName = context.Principal?.FindFirst(ClaimTypes.GivenName)?.Value,
                        LastName = context.Principal?.FindFirst(ClaimTypes.Surname)?.Value,
                        CreatedDate = DateTime.UtcNow,
                        IsActive = true
                    };
                    dbContext.Users.Add(user);
                }
                else
                {
                    // Update user info from Authentik
                    user.Email = context.Principal?.FindFirst(ClaimTypes.Email)?.Value;
                    user.FirstName = context.Principal?.FindFirst(ClaimTypes.GivenName)?.Value;
                    user.LastName = context.Principal?.FindFirst(ClaimTypes.Surname)?.Value;
                    user.LastLoginDate = DateTime.UtcNow;
                }
                await dbContext.SaveChangesAsync();
            }
        }
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

app.MapStaticAssets();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();

app.Run();
