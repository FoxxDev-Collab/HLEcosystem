# HLEcosystem

A family management platform built as a set of purpose-specific web applications sharing a single PostgreSQL database. Each app owns its own database schema and handles one domain — finances, health, home maintenance, meal planning, and so on. Family Manager sits at the center as the identity provider and user directory.

## Applications

| App | Directory | Port | What it does |
|-----|-----------|------|--------------|
| Family Manager | `hle-family_manager/` | 8080 | User accounts, households, authentication, SSO |
| FamilyHub | `hle-familyhub/` | 8081 | Family members, relationships, events, gifts, family tree |
| Family Finance | `hle-family_finance/` | 8082 | Accounts, transactions, budgets, debts, tax tracking, bank imports |
| Family Health | `hle-family_health/` | 8083 | Health profiles, appointments, medications, vaccinations, workouts |
| Home Care | `hle-family_home_care/` | 8084 | Household items, vehicles, maintenance schedules, repairs, documents |
| File Server | `hle-file_server/` | 8085 | File browsing, uploads, sharing, tagging |
| Meal Prep | `hle-meal_prep/` | 8086 | Grocery tracking, shopping list optimization |
| Family Wiki | `hle-family_wiki/` | 8087 | Knowledge base for household reference material |

## Architecture

All applications are Next.js 16 with React 19 and TypeScript. They connect to the same PostgreSQL 16 database (`foxxlab`) but each operates within its own schema. Cross-schema access is handled through Prisma raw SQL queries — no app duplicates the User table. Every data query is scoped to a household ID for tenant isolation.

```
Family Manager (identity + auth)
        |
        v
  ┌─────────────┐
  │  PostgreSQL  │  ── one database, one schema per app
  └─────────────┘
        ^
        |
  All other apps (read users via raw SQL, own their schema)
```

Authentication is cookie-based. Family Manager issues sessions, and all apps validate against the shared session table. There is no third-party auth provider.

## Tech Stack

- Next.js 16, React 19, TypeScript 5
- Tailwind CSS 4, shadcn/ui
- Prisma 6 (per-app client, raw SQL for cross-schema queries)
- PostgreSQL 16
- Podman and podman-compose (not Docker)
- Node 22-alpine in containers

## Getting Started

### Prerequisites

- Podman and podman-compose
- Node.js 22+ (for local development outside containers)

### Running the Stack

Everything is managed through `hle.sh`:

```bash
# Start all services
./hle up all

# Start a single service
./hle up hle-family-finance

# Rebuild after code changes
./hle rebuild hle-familyhub

# Check health of all services
./hle status

# View logs
./hle logs hle-family-manager
./hle logs hle-family-finance -f

# Shell into a container
./hle shell hle-familyhub
./hle shell postgres

# Stop everything
./hle down all
```

### Environment

Each app expects a `.env` file in its directory with at minimum a `DATABASE_URL` pointing to the shared PostgreSQL instance. See the individual app directories for any additional environment variables.

## Project Structure

```
HLEcosystem/
├── hle-family_manager/    # Identity provider
├── hle-familyhub/         # Family relationships and events
├── hle-family_finance/    # Financial tracking
├── hle-family_health/     # Health records
├── hle-family_home_care/  # Home and vehicle maintenance
├── hle-file_server/       # File management
├── hle-meal_prep/         # Grocery and meal planning
├── hle-family_wiki/       # Knowledge base
├── compose.yaml           # Podman compose definition
├── Containerfile.nextjs   # Shared container build
├── config/                # PostgreSQL init scripts, shared config
├── hle.sh                 # Container management CLI
└── CLAUDE.md              # Development conventions
```

Each app follows the same internal layout: `app/` for routes and server actions, `components/` for UI, `lib/` for shared utilities (auth, Prisma client, cross-schema queries), and `prisma/` for the schema definition.

## Development Conventions

Detailed coding standards, auth patterns, and architectural rules are documented in `CLAUDE.md`. The short version:

- Only Prisma touches the database. Raw SQL for cross-schema reads.
- Server Actions for all mutations. No client-side fetch for writes.
- Household ID scoping on every query. This is the tenancy boundary.
- Passwords hashed with bcrypt (cost 12+). Cookies are httpOnly.
- No secrets in code. Environment variables only.

## License

Private. All rights reserved, Foxx Cyber LLC.
