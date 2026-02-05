# HLE Dashboard - Setup Guide

This guide will walk you through setting up the HLE Dashboard with Authentik authentication and PostgreSQL database.

---

## Prerequisites

- [ ] .NET 10 SDK installed
- [ ] PostgreSQL 17.7 running (local or containerized)
- [ ] Authentik instance accessible
- [ ] Access to create Authentik applications

---

## Step 1: Configure Authentik

### Create OAuth2/OpenID Provider

1. Log into Authentik admin: `https://your-authentik-domain.com/if/admin/`
2. Navigate to **Applications → Providers**
3. Click **Create**
4. Select **OAuth2/OpenID Provider**

**Provider Settings:**
```
Name: HLE Dashboard Provider
Authorization flow: default-provider-authorization-implicit-consent

Protocol settings:
  Client type: Confidential
  Client ID: (copy this - you'll need it)
  Client Secret: (copy this - you'll need it)

Redirect URIs/Origins (REGEX):
  http://localhost:5000/signin-oidc
  http://localhost:5000.*

Scopes:
  - openid
  - profile
  - email

Subject mode: Based on the User's hashed ID
Include claims in id_token: ✓ (checked)
```

5. Click **Create**
6. **Copy the Client ID and Client Secret** - you'll need these!

### Create Application

1. Navigate to **Applications → Applications**
2. Click **Create**

**Application Settings:**
```
Name: HLE Dashboard
Slug: hle-dashboard
Provider: (select the provider you just created)
Launch URL: http://localhost:5000
```

3. Click **Create**

---

## Step 2: Set Up PostgreSQL Database

### Option A: Using Existing PostgreSQL

```bash
# Connect to PostgreSQL
psql -h localhost -U hle_admin

# Create database
CREATE DATABASE hle_dashboard_dev;

# Grant permissions (if needed)
GRANT ALL PRIVILEGES ON DATABASE hle_dashboard_dev TO hle_user;

# Exit
\q
```

### Option B: Using Podman Container

```bash
# If you don't have PostgreSQL running yet
podman run -d \
  --name hle-postgres \
  -p 5432:5432 \
  -e POSTGRES_USER=hle_admin \
  -e POSTGRES_PASSWORD=your_secure_password \
  -v hle-postgres-data:/var/lib/postgresql/data \
  docker.io/library/postgres:17.7

# Create the database
podman exec hle-postgres psql -U hle_admin -c "CREATE DATABASE hle_dashboard_dev;"
```

---

## Step 3: Configure the Application

### Set User Secrets

Navigate to the project directory and configure secrets:

```bash
cd HLE.Dashboard

# Initialize user secrets
dotnet user-secrets init

# Set database connection
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=hle_dashboard_dev;Username=hle_user;Password=your_password"

# Set Authentik configuration (replace with YOUR values)
dotnet user-secrets set "Authentik:Authority" "https://your-authentik.com/application/o/hle-dashboard/"
dotnet user-secrets set "Authentik:ClientId" "paste-client-id-here"
dotnet user-secrets set "Authentik:ClientSecret" "paste-client-secret-here"
```

**Important Notes:**
- Replace `your-authentik.com` with your actual Authentik domain
- The Authority URL **must end with a trailing slash** `/`
- Client ID and Secret are from Step 1

---

## Step 4: Run Database Migrations

```bash
# Create initial migration
dotnet ef migrations add InitialCreate

# Apply to database
dotnet ef database update
```

You should see output indicating the migration was successful.

---

## Step 5: Run the Application

```bash
dotnet run
```

You should see:
```
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5000
```

---

## Step 6: Test Authentication

1. Open browser and navigate to: `http://localhost:5000`
2. You should be redirected to Authentik login
3. Log in with your Authentik credentials
4. You should be redirected back to the Dashboard home page
5. Your username should appear in the top-right corner

### Expected Flow:

```
http://localhost:5000
  ↓
https://your-authentik.com/... (login page)
  ↓ (after successful login)
http://localhost:5000/signin-oidc
  ↓
http://localhost:5000 (authenticated)
```

---

## Troubleshooting

### Issue: "Redirect URI mismatch"

**Solution:**
- Check that Authentik redirect URI is exactly: `http://localhost:5000/signin-oidc`
- Verify http vs https
- Verify port number (5000)

### Issue: "Unable to obtain configuration"

**Solution:**
- Verify Authority URL ends with `/`
- Test URL manually: `https://your-authentik.com/application/o/hle-dashboard/.well-known/openid-configuration`
- Ensure Authentik is accessible from your machine

### Issue: Database connection fails

**Solution:**
- Verify PostgreSQL is running: `psql -h localhost -U hle_user -d hle_dashboard_dev`
- Check connection string in user secrets
- Ensure database exists: `psql -l`

### Issue: No user info showing

**Solution:**
- In Authentik Provider, ensure "Include claims in id_token" is checked
- Verify scopes include `openid`, `profile`, `email`
- Check browser console for errors

---

## Verify Setup Checklist

- [ ] Authentik Provider created with correct redirect URIs
- [ ] Authentik Application created and linked to provider
- [ ] Client ID and Secret obtained and stored in user secrets
- [ ] PostgreSQL database created
- [ ] User secrets configured with all required values
- [ ] Database migrations run successfully
- [ ] Application starts without errors
- [ ] Browser redirects to Authentik login
- [ ] After login, returns to application
- [ ] User name displays in top-right corner
- [ ] Settings page shows user info
- [ ] Logout works

---

## Next Steps

Once authentication is working:

1. Customize the home page for your dashboard needs
2. Add application launcher cards
3. Integrate with other HLE applications
4. Set up reverse proxy for production (Caddy/Nginx)
5. Configure production Authentik redirect URIs

---

## Production Deployment

See [README.md](README.md) for production deployment instructions using Podman containers and Quadlet.

---

**Need Help?**
- Check [README.md](README.md) for detailed documentation
- Review [../CLAUDE.md](../CLAUDE.md) for code patterns
- See [../plan.txt](../plan.txt) for architecture overview
