# Porting a legacy HLE app into hle-all-in-one

This guide is the contract for porting a feature module from a legacy Next.js
app (`hle-<app>/`) into this TanStack Start + Bun app. Follow it exactly —
every module must look like it was written by the same person.

## Architecture

- **TanStack Start** (file routes under `src/routes/`), React 19, Tailwind 4,
  shadcn/ui **base-ui flavor** (`@base-ui/react`, style "base-nova") — NOT the
  Radix versions from the legacy apps. Import existing primitives from
  `@/components/ui/*`; do not add new primitives without checking they exist.
- **Raw SQL via Bun.sql** (`import { sql } from "@/server/db"`). No Prisma, no
  ORM. Tagged templates only: `` sql`SELECT ... WHERE "id" = ${id}` `` —
  parameterized automatically. NEVER build SQL strings by concatenation.
- **One database, single `public` schema.** Quoted PascalCase tables,
  camelCase columns: `"FamilyMember"."householdId"`.
- Code style: no semicolons, double quotes, 2-space indent (prettier enforces).

## Security invariants (non-negotiable)

1. Every server function uses `householdMiddleware` (or `authMiddleware` for
   the rare non-household feature — e.g. media requests are cross-household by
   design). The middleware re-verifies household membership per request
   (ADR-0005). Never accept a householdId from the client.
2. Every household-scoped query includes `"householdId" = ${context.householdId}`
   in the WHERE clause. For mutations by id, scope the UPDATE/DELETE itself:
   `WHERE "id" = ${id} AND "householdId" = ${context.householdId}`.
   For child tables without their own householdId (e.g. `"Address"` →
   `"FamilyMember"`), join through the parent to enforce scoping.
3. Validate input with zod via `.inputValidator()` before the handler runs.
4. Failed mutations return `{ error: string }` — never throw to the client.
5. No `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `any`,
   `dangerouslySetInnerHTML`. CI greps the diff and fails the build.

## Server layer pattern

Two files per feature, under `src/server/<module>/`:

- `src/server/<module>/<feature>.ts` — row types + query functions taking
  explicit `householdId` params.
- `src/server/<module>/fns.<feature>.ts` — `createServerFn` wrappers: zod
  input validation + middleware + thin handlers calling the query layer.

```ts
// src/server/hub/people.ts
import { sql } from "@/server/db"

export type FamilyMemberRow = {
  id: string
  firstName: string
  lastName: string
  birthday: string | null // DATE columns are selected ::text → "YYYY-MM-DD"
  estimatedCost: number | null // NUMERIC columns are selected ::float8
  createdAt: Date // TIMESTAMPTZ comes back as Date
}

export async function listMembers(householdId: string) {
  return sql<Array<FamilyMemberRow>>`
    SELECT "id", "firstName", "lastName", "birthday"::text, "createdAt"
    FROM "FamilyMember"
    WHERE "householdId" = ${householdId}
    ORDER BY "firstName"`
}
```

```ts
// src/server/hub/fns.people.ts
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { listMembers } from "./people"

export const listPeopleFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => listMembers(context.householdId))

const createSchema = z.object({
  firstName: z.string().min(1).max(120),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
})

export const createPersonFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    // ...INSERT scoped to context.householdId
    return { ok: true as const }
  })
```

### Data type rules

- `DATE` columns: always `SELECT "col"::text` (→ `"YYYY-MM-DD"` string) and
  type them `string | null`. Insert/update from the `<input type="date">`
  string directly. Format for display with `formatDate` from `@/lib/format`.
- `NUMERIC` columns: always `SELECT "col"::float8` and type them
  `number | null`. (Money in these apps is display-level; float8 is fine.)
- `TIMESTAMPTZ`: comes back as `Date`. Fine to return — TanStack serializes.
- Tables with `"updatedAt"`: every UPDATE must include `"updatedAt" = now()`.
- Optional text inputs: empty string from a form means NULL — normalize with
  zod `.transform((v) => v || null)` or before the query.
- `sql` returns plain arrays; `const [row] = await sql...` for single rows.
  INSERT/UPDATE ... `RETURNING "id"` when the caller needs it.

## Route pattern

File routes under `src/routes/_authed/<module>/<page>.tsx`. Detail pages use
`$param` files (e.g. `people.$id.tsx` → `/hub/people/:id`).

```tsx
import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { listPeopleFn } from "@/server/hub/fns.people"

export const Route = createFileRoute("/_authed/hub/people")({
  loader: () => listPeopleFn(),
  component: PeoplePage,
})

function PeoplePage() {
  const people = Route.useLoaderData()
  const router = useRouter()
  // after a mutation: router.invalidate() to re-run the loader
}
```

- Loader calls a GET server fn; mutations call POST server fns from event
  handlers, then `router.invalidate()`.
- Mutation results: check `if ("error" in result)` and render the message in
  the dialog (`<p className="text-sm text-destructive">{error}</p>`).
- Dialogs: controlled, conditional-rendered (`{open && <SomeDialog .../>}`),
  with `<Dialog open onOpenChange={(o) => !o && onClose()}>`. Destructive
  confirms use `AlertDialog`. Copy the structure from
  `src/routes/_authed/manager/households.tsx` — it is the canonical page.
- Native `<select>` with the shared `selectClass` string (see households.tsx)
  is fine for enum dropdowns; `@/components/ui/select` also available.
- Page skeleton: `<div className="space-y-6">`, header row with `h1
  text-xl font-semibold` + muted description + primary action button.
- Icons: lucide-react. Empty states: muted text + helpful hint.
- Keep the legacy app's features and UX semantics, not its exact markup.
  Same columns, same filters, same computed values (ages, day counts, totals).

## Porting semantics

- Port **all** behavior of the legacy page: filters, sorts, computed stats,
  badges, edge cases. Read the legacy `actions.ts` carefully — business rules
  live there (e.g. duplicate checks, cascade behavior, status transitions).
- Legacy `revalidatePath(...)` → not needed (router.invalidate on the client).
- Legacy `getCurrentUser()/getCurrentHouseholdId()` gates → replaced by
  middleware; do not re-implement.
- Legacy Prisma enums → string literal union types matching the PG enum.
- Member/user pickers that listed `family_manager."User"` rows now list
  household members via `listMembers` in `src/server/households.ts`.

## Verification (before you call a port done)

```bash
cd /home/foxx-dev/HLEcosystem/hle-all-in-one
bun run typecheck   # tsc --noEmit — must be clean
bun run lint        # 0 errors (warnings in files you didn't touch are OK)
bun run check       # prettier
```

Do NOT edit shared files (`src/lib/modules.ts`, `src/routeTree.gen.ts`,
`migrations/*`, `src/server/middleware.ts`, `scripts/*`) unless the task
explicitly says so — the integrator owns them. routeTree.gen.ts is generated;
if it's stale, run `bun run build` or touch nothing and let the integrator
regenerate.
