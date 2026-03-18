# HLEcosystem — Family Management Platform

## What This Is

A multi-app family management ecosystem: 7 Next.js apps sharing a single PostgreSQL database with schema-level isolation. Each app owns its own Prisma schema and database schema. Family Manager is the central identity provider.

## Architecture

```
                         ┌──────────────┐
                         │  PostgreSQL   │
                         │   (foxxlab)   │
                         └──────┬───────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
  ┌──────┴──────┐   ┌──────────┴──────────┐   ┌──────┴──────┐
  │ family_mgr  │   │ familyhub │ finance  │   │ health │... │
  │  (schema)   │   │ (schemas, read User  │   │             │
  │  owns User  │   │  via raw SQL)        │   │             │
  └─────────────┘   └─────────────────────┘   └─────────────┘
```

**Every app** queries `family_manager."User"` via Prisma `$queryRaw` for identity. No app duplicates the User table.

## App Registry

| App | Directory | Port | DB Schema | Cookie Prefix | Status |
|-----|-----------|------|-----------|---------------|--------|
| Family Manager | `hle-family_manager/` | 8080 | `family_manager` | `fm_` | Core |
| FamilyHub | `hle-familyhub/` | 8081 | `familyhub` | `fh_` | Active |
| Family Finance | `hle-family_finance/` | 8082 | `family_finance` | `ff_` | Active |
| Family Health | `hle-family_health/` | 8083 | `family_health` | `fh_` | Active |
| Home Care | `hle-family_home_care/` | 8084 | `family_home_care` | — | Stub |
| File Server | `hle-file_server/` | 8085 | `file_server` | — | Stub |
| Grocery Planner | `hle-grocery_planner/` | 8086 | `grocery_planner` | — | Stub |

## Tech Stack

- **Runtime**: Next.js 16 + React 19 + TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui (Radix primitives)
- **ORM**: Prisma 6 (one client per app, raw SQL for cross-schema)
- **Database**: PostgreSQL 16 — single `foxxlab` DB, 7 schemas
- **Auth**: Cookie-based sessions (httpOnly, SameSite=lax)
- **Containers**: Podman + podman-compose (NOT Docker)
- **Node**: 22-alpine in containers
- **Forms**: react-hook-form + zod (finance app; adopt in new features)
- **Icons**: Lucide React

## Critical Rules

### Database
- **One database, seven schemas.** Never create a separate database per app.
- **Prisma for own schema, raw SQL for cross-schema.** Use `prisma.$queryRaw` to read `family_manager."User"` and `family_manager."Household"`.
- **Always parameterize.** Prisma tagged templates handle this — never string-concatenate SQL.
- **Household scoping.** Every data query in finance/health/hub MUST include `WHERE "householdId" = ${householdId}`. This is the tenant isolation boundary.
- **No Prisma migrations against production without explicit instruction.** Development runs against local containerized PostgreSQL.

### Auth Pattern
Every app follows this pattern. Do not deviate:
```typescript
// lib/auth.ts — cookie-based session
const SESSION_COOKIE = "xx_user_id";  // prefix varies per app
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!userId) return null;
  return getUserById(userId);  // cross-schema raw SQL
}
```

### Mutations
- Use **Next.js Server Actions** (`"use server"`) for all create/update/delete operations.
- Every Server Action MUST call `getCurrentUser()` and `getCurrentHouseholdId()` and reject if null.
- No client-side fetch for mutations. Server Actions only.

### API Routes
- Only use `app/api/` routes for: health checks (`/api/health`), file downloads, webhook receivers.
- Everything else goes through Server Actions.

### Security
- Passwords: bcryptjs, cost factor 12+
- Cookies: httpOnly, secure in production, SameSite=lax, 30-day expiry
- No secrets in code — `.env` only (never committed)
- Input validation with zod on all form submissions
- No sensitive data in cookies (user ID only)

## File Structure Convention

Every app follows this layout:
```
hle-<app>/
├── app/
│   ├── (app)/           # Authenticated routes (layout checks auth)
│   │   └── <feature>/
│   │       ├── page.tsx
│   │       └── actions.ts    # Server Actions
│   ├── api/health/route.ts   # Health check endpoint
│   ├── login/page.tsx
│   ├── setup/page.tsx        # First-run setup
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Landing/redirect
│   ├── actions.ts            # Shared Server Actions
│   └── globals.css
├── components/
│   ├── ui/                   # shadcn/ui primitives (DO NOT edit)
│   ├── app-sidebar.tsx       # Navigation sidebar
│   └── <feature>-*.tsx       # Feature components
├── hooks/                    # React hooks
├── lib/
│   ├── prisma.ts             # PrismaClient singleton
│   ├── auth.ts               # Session management
│   ├── users.ts              # Cross-schema User queries
│   ├── household.ts          # Household queries + cookie
│   ├── format.ts             # Date/currency formatters
│   └── utils.ts              # cn() helper
├── prisma/
│   ├── schema.prisma         # App's own schema
│   └── seed.ts               # Seed data (optional)
├── entrypoint.sh             # Container startup (prisma migrate + node)
├── package.json
└── next.config.ts
```

## Shared Patterns (copy exactly for new apps)

### Prisma Singleton (`lib/prisma.ts`)
```typescript
import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
export default prisma;
```

### Cross-Schema User Query (`lib/users.ts`)
```typescript
import { prisma } from "./prisma";
export type User = {
  id: string; email: string; name: string; avatar: string | null;
  role: "ADMIN" | "MEMBER"; active: boolean; createdAt: Date; updatedAt: Date;
};
export async function getUserById(id: string): Promise<User | null> {
  const users = await prisma.$queryRaw<User[]>`
    SELECT "id","email","name","avatar","role","active","createdAt","updatedAt"
    FROM family_manager."User" WHERE "id" = ${id}`;
  return users[0] ?? null;
}
```

### Household Scoping (`lib/household.ts`)
```typescript
const HOUSEHOLD_COOKIE = "xx_household_id";
export async function getCurrentHouseholdId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(HOUSEHOLD_COOKIE)?.value ?? null;
}
```

## Container Management

All containers are managed via `./hle.sh`:
```bash
./hle rebuild <service|all>     # Build + restart
./hle up <service|all>          # Start
./hle down <service|all>        # Stop
./hle restart <service|all>     # Restart without rebuild
./hle status                    # Health check all services
./hle logs <service> [-f]       # View logs
./hle shell <service|postgres>  # Shell into container
./hle clean                     # Prune stopped containers
./hle nuke                      # Full teardown (destructive)
```

Service names use hyphens: `hle-family-manager`, `hle-familyhub`, `hle-family-finance`, etc.

## Adding a New App

1. Copy an existing stub app (e.g., `hle-grocery_planner/`) as template
2. Add new schema to `config/postgres/init-schemas.sql`
3. Add service block to `compose.yaml` (follow the YAML anchor pattern)
4. Add to `hle.sh` SERVICES, PORTS, and CONTAINERS arrays
5. Create `prisma/schema.prisma` with the new schema name
6. Copy `lib/prisma.ts`, `lib/auth.ts`, `lib/users.ts`, `lib/household.ts` from an active app
7. Implement `app/api/health/route.ts` returning `{ status: "ok" }`
8. Add `entrypoint.sh` (prisma migrate deploy + node server.js)

## Code Quality Standards

- **No dead code.** Delete unused imports, variables, functions. Don't comment them out.
- **No over-engineering.** Build what's needed now. Three similar lines > premature abstraction.
- **Validate at boundaries.** Use zod for form inputs and API route params. Trust internal functions.
- **Type everything.** No `any`. Define explicit types for cross-schema queries.
- **Keep components small.** Extract when a component exceeds ~150 lines or has distinct responsibilities.
- **Format currency/dates consistently.** Use `lib/format.ts` — never format inline.
- **Error handling in Server Actions.** Return `{ error: string }` objects instead of throwing to client.

## Git

Single developer. Commit format:
```
[app] brief description

[finance] Add recurring transaction scheduler
[hub] Fix family tree relationship display
[infra] Update compose memory limits
[all] Upgrade Next.js to 16.2
```

## What NOT To Do

- Do not use Docker — use Podman (`podman-compose`)
- Do not create separate databases — one DB, multiple schemas
- Do not add ORM wrappers around Prisma — use it directly
- Do not use NextAuth/Auth.js — the cookie-based auth pattern is intentional
- Do not modify archived code in `HLEcosystem_Dotnet_Backup/`
- Do not add client-side state management (Redux, Zustand) — Server Components + Server Actions
- Do not install packages globally in containers — use `npm ci` in build stage
- Do not skip the household scoping check in queries — it's the tenancy boundary
