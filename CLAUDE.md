# HLEcosystem — Family Management Platform

> **Read this before touching security-relevant code.** If your change affects authentication, session handling, Server Actions, database queries, file uploads, external integrations, or role enforcement, you MUST read [`docs/THREAT_MODEL.md`](./docs/THREAT_MODEL.md) and the relevant section of [`docs/SECURITY_CONTROLS.md`](./docs/SECURITY_CONTROLS.md) before proposing changes. The failure mode documented in [`docs/adr/0005-household-scoped-tenancy.md`](./docs/adr/0005-household-scoped-tenancy.md) is the single most important rule in this codebase. It has already happened once.

## What This Is

A multi-app family management ecosystem: 10 Next.js apps sharing a single PostgreSQL database with schema-level isolation. Each app owns its own Prisma schema and database schema. Family Manager is the central identity provider.

## Security workflow (MANDATORY for any AI assistant or contributor)

This project is security-critical. It stores health, financial, and identity data. Every change must pass through the workflow below. Skipping steps is not acceptable, even "just this once" — the 2026-04-08 cross-tenant account-balance incident documented in ADR-0005 happened because a reasonable-looking shortcut skipped the household ownership check.

### Before you write any code

1. **Understand what trust boundary you are crossing.** Look up the relevant row in [`docs/THREAT_MODEL.md`](./docs/THREAT_MODEL.md) §4. If you are introducing a *new* public endpoint, a new external service call, or a new storage surface, you are creating a new trust boundary — stop and update the threat model first.
2. **Identify which NIST 800-53 controls apply** to your change using [`docs/SECURITY_CONTROLS.md`](./docs/SECURITY_CONTROLS.md). Auth changes → AC-2/3/6/12, IA-2/5. Data access → AC-3, SI-10. New endpoints → SC-7, SI-10. File handling → SI-10, SC-28.
3. **If the change contradicts an ADR, read the ADR first.** See [`docs/adr/README.md`](./docs/adr/README.md) for the index. If the ADR is wrong, the right move is a new ADR that supersedes it, not a silent deviation.

### While you write code

Every Server Action, API route, or database query MUST satisfy the following invariants. No exceptions.

1. **Authentication gate first.** Every Server Action starts with:
   ```typescript
   const user = await getCurrentUser();
   if (!user) redirect("/login");
   const householdId = await getCurrentHouseholdId();
   if (!householdId) redirect("/setup");
   ```
   This is the canonical pattern. Copy it exactly.

2. **Household scoping on every query.** Every `prisma.<model>.*` call on a tenant-scoped table MUST include `householdId` in the `where` clause. For mutations referencing a foreign ID (e.g. "update account X's balance"), **re-verify ownership first** via `findFirst({ where: { id: someId, householdId } })` before mutating. Do not trust IDs from form data. The 2026-04-08 incident was exactly this bug.

3. **Input validation at the boundary.** Every Server Action validates `FormData` with a `zod` schema before destructuring. Never interpolate user input into SQL strings.

4. **Parameterized SQL only.** Prisma tagged templates (`prisma.$queryRaw\`...\``) parameterize automatically. Never use `$queryRawUnsafe` or `$executeRawUnsafe` with anything that came from user input, not even "sanitized" input. If you think you need it, you don't — restructure the query.

5. **Return `{ error: string }` from failed Server Actions.** Never throw raw errors to the client. Stack traces leak implementation details.

6. **No secrets in code or logs.** API keys, tokens, passwords, connection strings come from `process.env.*`. If you need to log something for debugging, assume the log will be read by an attacker.

7. **Strip sensitive fields from user objects.** Follow the pattern in `hle-family_manager/lib/session.ts:41` — `password` and `totpSecret` are stripped before any User object leaves the server.

8. **No new `any` types.** TypeScript strict mode is a security control, not a stylistic preference. `any` in a Server Action is a CVE waiting to happen.

9. **No `dangerouslySetInnerHTML`** without a zod-validated, bounded, escaped input source *and* a comment explaining the justification. CodeQL will flag it.

10. **File uploads go through `lib/file-validation.ts`.** Magic-byte MIME check, extension blocklist, size cap. Do not trust client-reported Content-Type.

11. **Never suppress lint or type-check rules.** Do not write `// eslint-disable`, `// eslint-disable-next-line`, `// @ts-ignore`, `// @ts-expect-error`, or `// @ts-nocheck`. Ever. Lint exists because it catches real bugs; suppressing it is how "reasonable looking" vibe code ships exploitable bugs. If a rule is wrong for a specific case, either (a) fix the underlying code so the rule no longer applies, (b) refactor so the construct isn't needed, or (c) propose a reasoned change to the shared ESLint config in a separate PR that explains why the rule is inappropriate project-wide. CI enforces this: `no-disable-smuggling` fails any PR that introduces new suppression comments in the diff. This rule is non-negotiable.

### Before you open a PR

Run the full pre-flight locally:

```bash
# In the app(s) you touched:
cd hle-<app>
npm run lint           # must pass
npx tsc --noEmit       # must pass
npm audit --audit-level=high --omit=dev   # must pass

# Then manually verify the PR template security checklist:
#   .github/PULL_REQUEST_TEMPLATE.md
# Every applicable box must be honestly checkable.
```

If you are an AI assistant, you must execute the equivalent checks (Read the changed files, grep for the required patterns, verify the invariants) before declaring the change complete. "It should work" is not acceptable.

### Security-sensitive change types that require extra scrutiny

| Change type | Required reading | Required review |
|-------------|------------------|------------------|
| Authentication, session, password, MFA | ADR-0003, SECURITY_CONTROLS.md §IA | Manual re-read of `hle-family_manager/lib/session.ts` and `lib/users.ts` |
| New Server Action touching money, health, files, or identity | ADR-0005, THREAT_MODEL.md §4 TB-1 | Verify auth + household scoping gate present |
| New public (unauthenticated) endpoint | THREAT_MODEL.md §5 (share-link case study) | New ADR documenting the decision |
| Database schema migration | ADR-0001, ADR-0005 | Verify `householdId` column on every new tenant-scoped table |
| New external service integration | THREAT_MODEL.md §4 TB-5 | Update threat model with new trust boundary |
| Dependency update (security) | — | Verify Trivy CI run is green after merge |

### When you discover a security issue in existing code

1. Do **not** file a public issue or mention it in a public PR description.
2. See [`SECURITY.md`](./SECURITY.md) for the private disclosure process.
3. If you fix it as part of another change, note it in the commit message with the `[security]` prefix and reference the specific invariant that was violated.

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
| Home Care | `hle-family_home_care/` | 8084 | `family_home_care` | `hc_` | Active |
| File Server | `hle-file_server/` | 8085 | `file_server` | `fs_` | Active |
| Meal Prep | `hle-meal_prep/` | 8086 | `meal_prep` | `mp_` | Active |
| Family Wiki | `hle-family_wiki/` | 8087 | `family_wiki` | `fw_` | Active |
| Claude API | `hle-claude_api/` | 8088 | `claude_api` | — | Active (internal AI gateway) |
| Family Travel | `hle-family_travel/` | 8089 | `family_travel` | `ft_` | Active |

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

> The invariants below are repeated and expanded in the [Security workflow](#security-workflow-mandatory-for-any-ai-assistant-or-contributor) section above. If there is ever a conflict, the Security workflow section wins.

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
