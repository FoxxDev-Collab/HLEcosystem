# hle-all-in-one

The consolidated HLEcosystem app. One TanStack Start + Bun process, one
database, one login — replacing the fleet of per-app Next.js services that each
owned a Postgres schema and its own session cookie.

- **TanStack Start** (file routes under `src/routes/`), React 19, Tailwind 4,
  shadcn/ui **base-ui flavor** (`@base-ui/react`, style "base-nova") — not the
  Radix builds the legacy apps used.
- **Bun runtime**, dev and prod. Build output is `.output/server/index.mjs`, run
  with `bun .output/server/index.mjs`.
- **Raw SQL via `Bun.sql`** (`import { sql } from "@/server/db"`). No Prisma, no
  ORM, no driver adapter. Tagged templates parameterize automatically.
- **Dedicated PostgreSQL 18** (`hle-aio-postgres`, host port **5433**), database
  `hle_aio`, single `public` schema. Isolated from the legacy foxxlab PG16 so
  the old apps keep running untouched during the migration.
- Quoted PascalCase tables, camelCase columns: `"FamilyMember"."householdId"`.

Porting contract for new modules: [`docs/PORTING.md`](./docs/PORTING.md). Read
it before adding a module — it is the style and security contract, not a
suggestion.

## Modules

`src/lib/modules.ts` is the single source of truth for the app switcher, the
contextual sidebar nav, and the Playwright page sweep. Adding a nav item there
automatically adds it to the e2e sweep.

| Module | `key` | Base route | Ported from | Nav groups |
|---|---|---|---|---|
| Manager | `manager` | `/manager` | `hle-family_manager` | Overview, Organization (Users — admin-only, Households), Account (Security, Settings) |
| Hub | `hub` | `/hub` | `hle-familyhub` | Overview, Family, Planning, Education, Requests |
| Finance | `finance` | `/finance` | `hle-family_finance` | Overview, Planning, Wealth, Tools, More |
| Health | `health` | `/health` | `hle-family_health` | Overview, Care, Network, More |
| Home Care | `home` | `/home-care` | `hle-family_home_care` | Overview, Home, Vehicles, Maintenance, Chores, Emergency |
| Meals | `meals` | `/meals` | `hle-meal_prep` | Meals, Shopping, Catalog, System |
| Wiki | `wiki` | `/wiki` | `hle-family_wiki` | Wiki |
| Travel | `travel` | `/travel` | `hle-family_travel` | Overview, Planning, Management |
| Media | `media` | `/media` | `hle-media` (Bun app) | Library (+ Parental Controls, admin-only) |
| Files | `files` | `/files` | `hle-file_server` | **Not ported** — `enabled: false`, greys out in the switcher |

Two `placeholder: true` slots (`slot-1`, `slot-2`) render as dashed tiles and
are reserved for future apps.

`/` redirects to `/manager/dashboard`.

## Quick start

```bash
podman-compose up -d hle-aio-postgres   # PG18 on :5433
cp .env.example .env                    # then fix the seed values, see below
bun install
bun run migrate                         # applies migrations/*.sql
bun run seed                            # provisions the admin + a household
bun run dev                             # http://localhost:3000
```

Dev login (defaults in `scripts/seed.ts`, override via env):

- email — `SEED_ADMIN_EMAIL`, default `admin@hle.local`
- password — `SEED_ADMIN_PASSWORD`, default `ChangeMe123!`

The seed is idempotent: on conflict it refreshes the admin's name but **not**
the password, so an existing admin keeps whatever password it already has —
re-seeding will not rescue a database whose admin password you have lost.

Full stack in containers:

```bash
podman-compose up -d      # app on :8100 → container :3000
```

The container entrypoint runs `bun scripts/migrate.ts` before serving; a failed
migration aborts startup rather than serving against a half-migrated schema.
Health probe: `GET /api/health` → `{"status":"ok"}`, or 503 `degraded` if
`SELECT 1` fails.

## Scripts

| Script | Command | What it does |
|---|---|---|
| `dev` | `bun --bun vite dev --port 3000` | Dev server. The `--bun` flag is required — see gotchas. |
| `build` | `vite build` | Nitro `bun` preset → `.output/server/index.mjs`. Also regenerates `src/routeTree.gen.ts`. |
| `preview` | `vite preview` | Serve the built output. |
| `migrate` | `bun scripts/migrate.ts` | Apply pending `migrations/*.sql`. |
| `seed` | `bun scripts/seed.ts` | Idempotent dev seed: ADMIN user + OWNER household. |
| `test` | `vitest run` | Unit suites (`src/**/*.test.ts`), node environment. |
| `e2e` | `playwright test` | Browser suite against `PW_BASE_URL` (default `http://localhost:8100`). |
| `lint` | `eslint` | `@tanstack/eslint-config`. |
| `typecheck` | `tsc --noEmit` | Must be clean. |
| `format` / `check` | `prettier --write` / `--check` | No semicolons, double quotes, 2-space indent. |

`scripts/smoke-crud.ts` (`bun scripts/smoke-crud.ts`) is not wired to an npm
script — it exercises the raw-SQL user/household data layer against the live DB
and cleans up after itself.

`scripts/scan.ts` (`bun scripts/scan.ts <householdId> [rootPath] [--enrich]`)
is the headless media scan — the cron / first-boot indexing path the UI's Scan
button doesn't cover. Works in-container too, where the library volume is
mounted: `podman exec hle-aio bun scripts/scan.ts <householdId>`. Exits 1 if
any file failed to index, 2 on usage/unknown-household errors.

## Environment variables

Every `process.env.*` actually referenced under `src/` and `scripts/`:

### Required

| Var | Notes |
|---|---|
| `DATABASE_URL` | `src/server/db.ts` throws at import time if unset. **No `?schema=` suffix** — see gotchas. |

### Optional — behavior when unset

| Var | Default / effect when unset |
|---|---|
| `UPLOAD_DIR` | Falls back to `./uploads` (`src/server/file-storage.ts`, `src/server/finance/taxes.ts`). Container sets `/data/uploads`. |
| `MAX_FILE_SIZE_MB` | Defaults to `50` (`src/lib/file-validation.ts`). |
| `MEDIA_LIBRARY_PATH` | Scan root. Unset → `startScanFn` returns `{ error: "MEDIA_LIBRARY_PATH not configured" }`; nothing else is affected. Container sets `/data/library`. |
| `TMDB_API_KEY` | Unset → `tmdbConfigured()` is false, every TMDB call returns `null`, the scanner runs unaffected without enrichment, and `enrichLibraryFn` returns `{ error: "TMDB not configured" }`. |
| `CLAUDE_API_URL` + `CLAUDE_API_SERVICE_SECRET` | Both required together. Either unset → `isAiConfigured()` is false and every gateway call resolves to `{ success: false, code: "NOT_CONFIGURED" }` (`"AI gateway not configured"` in finance, `"AI features not configured"` in meals). Affects receipt OCR, smart categorize, smart link, the finance advisor, and shopping-list generation — each falls back to its manual path. |
| `NODE_ENV` | Only read for the session cookie's `secure` flag (`production` → secure). |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | `admin@hle.local` / `ChangeMe123!`. Read by both `scripts/seed.ts` and `e2e/auth.setup.ts` — keep them in sync or the e2e login fails. |
| `SEED_ADMIN_FIRST_NAME` / `SEED_ADMIN_LAST_NAME` | `Admin` / `User`. |
| `PW_BASE_URL` | Playwright base URL, default `http://localhost:8100`. |

Bun auto-loads `.env`; it is gitignored.

## Architecture

### Auth and tenancy

Session is a server-side token in the `hle_session` cookie (httpOnly,
SameSite=lax, `secure` in production). Three middlewares in
`src/server/middleware.ts` compose in one chain:

- `authMiddleware` — validates the session token, else `redirect({ to: "/login" })`.
  Provides `context.user`, `context.sessionToken`, `context.activeHouseholdId`.
- `adminMiddleware` — builds on auth; non-`ADMIN` users are redirected to
  `/manager/dashboard`. Used for user provisioning, parental controls, and the
  expensive media operations (library scan, TMDB enrichment).
- `householdMiddleware` — builds on auth; **this is the ADR-0005 tenancy
  boundary**. It re-verifies household membership via `getMembership()` on every
  request instead of trusting the cookie, then provides `context.householdId`
  and `context.membership`. A householdId is never accepted from the client, and
  every household-scoped query must carry
  `"householdId" = ${context.householdId}` — including the WHERE clause of
  UPDATE/DELETE by id.

Server functions live in `src/server/<module>/fns.<feature>.ts`
(`createServerFn` + zod `.inputValidator()` + middleware + a thin handler); the
query layer in `src/server/<module>/<feature>.ts` takes an explicit
`householdId` param. `src/routes/api/*` is reserved for the health check, file
upload/download/serve, and media streaming.

### Migrations

`src/server/migrate.ts` is a hand-rolled runner (ported from `hle-media`).
Applies `migrations/*.sql` in lexical order, each inside a transaction, and
records a sha256 checksum per file in `"_migrations"`. **Editing an
already-applied migration is a hard error** ("migration drift") — write a new
migration instead. Current set: `0001_init` (identity + tenancy), `0002_user_names`,
then one per module `0003_hub` … `0010_media`.

### Generated files

`src/routeTree.gen.ts` is gitignored and regenerated by `bun run build` (and by
the dev server). Do not hand-edit it; if it is stale, build.

## Host gotchas

These workarounds are load-bearing on this el10 / podman host. Do not "clean
them up".

- **SELinux `label=disable`** on both compose services. SELinux is enforcing
  here and blocks the RELRO `mprotect` newer glibc performs at load ("cannot
  apply additional memory protection after relocation"), so containers exit 127.
  Seccomp was not the cause.
- **Debian-based images, not `-alpine`** (`postgres:18`, `oven/bun:1.3`) — the
  musl variants hit that same RELRO failure.
- **PG18 volume mounts at `/var/lib/postgresql`**, not
  `/var/lib/postgresql/data`: the PG18+ official image stores data in a version
  subdir (docker-library#1259).
- **`DATABASE_URL` must not carry `?schema=`.** `Bun.sql` forwards unknown URL
  query params as Postgres startup options and the server rejects them with
  `unrecognized configuration parameter`. Single schema = `public`.
- **`bun --bun vite dev`.** `src/server/db.ts` reads `Bun.sql` off the runtime
  global rather than `import { sql } from "bun"`, because a `"bun"` module
  specifier fails to resolve in the dev SSR module runner. That only works when
  Vite itself runs under Bun. `"bun"` is also kept external in both
  `ssr.external` and `build.rolldownOptions.external` so Rolldown never tries to
  resolve it.
- **Healthchecks probe with `bun -e ... fetch`** — the Debian-slim bun image has
  no `wget` or `curl`. Podman builds OCI images where `HEALTHCHECK` is ignored,
  so `compose.yaml` carries the same check as the `Containerfile`.
- **`@playwright/test` is pinned exactly (`1.58.2`, no caret)** so it matches the
  browser build already installed in the host's `~/.cache/ms-playwright`.
  Bumping it means reinstalling browsers.
- **`ffprobe` is not in the runtime image.** The media scanner degrades per
  file: a missing or failing `ffprobe` skips that file and records it in the
  scan summary's errors rather than crashing the scan.

## Testing

### Unit — `bun run test` (vitest, node env, `src/**/*.test.ts`)

- `src/server/finance/transactions.test.ts` — ADR-0005 regression: the legacy
  `createTransactionAction()` updated `Account.currentBalance` by `accountId`
  alone, letting a forged form field mutate another household's balance.
- `src/server/finance/budget-planner.test.ts` — ADR-0005 regression for the five
  budget-planner mutations that previously lacked an auth gate or a
  `householdId` in their WHERE clause.
- `src/server/finance/import-parser.test.ts` — pure-function tests for the Wells
  Fargo CSV parser.
- `src/server/media/scanner.test.ts` — pure-function tests for the media
  filename/path parser.

### E2E — `bun run e2e` (Playwright, chromium only, `workers: 1`)

Runs against a **running** app; it does not start one. Default target is the
container on `http://localhost:8100` — set `PW_BASE_URL=http://localhost:3000`
to point it at the dev server. Serial by design: the suite writes to the shared
dev database.

- `e2e/auth.setup.ts` — logs in once through the real login form using the
  `SEED_ADMIN_*` credentials and saves `e2e/.auth/state.json`; every other test
  starts authenticated.
- `e2e/pages.spec.ts` — sweeps every nav href of every enabled module in
  `src/lib/modules.ts`, asserting HTTP ok, a visible non-404 `h1`, no router
  error boundary, and no leftover `<ModulePlaceholder/>`.
- `e2e/crud.spec.ts` — one create → verify → delete flow per module (hub,
  health, finance, home-care, meals, travel, wiki; manager is read-only). Every
  entity is named with an "E2E Smoke" + timestamp marker so any leftover is
  identifiable.

Pre-flight before a PR: `bun run typecheck && bun run lint && bun run check && bun run test`.
