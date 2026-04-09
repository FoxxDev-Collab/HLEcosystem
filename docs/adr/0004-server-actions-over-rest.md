# ADR-0004: Server Actions over REST API for mutations

**Status:** Accepted
**Date:** 2025-12-18 (retroactively documented 2026-04-08)
**Deciders:** Jeremiah Price

## Context

Next.js 13+ introduced Server Actions, a mechanism that lets components call server-side functions directly without a hand-written API route. Before Next.js 14, the conventional pattern was:

1. Client component calls `fetch('/api/things', { method: 'POST', body: ... })`
2. An `app/api/things/route.ts` handler validates, mutates, and responds
3. Client revalidates or router-refreshes on success

Server Actions let you skip step 1 and 2 — mark a function `"use server"`, import it into a component, and call it directly. Next.js handles the RPC plumbing, CSRF protection, and revalidation.

We needed to decide whether to use Server Actions exclusively for mutations or continue with traditional API routes.

## Options considered

### Option A — Traditional REST API routes

- ✅ Explicit, well-understood pattern
- ✅ Can be called by non-browser clients (mobile apps, external integrations)
- ✅ HTTP semantics are native (status codes, methods)
- ❌ Every mutation needs a hand-written route, a hand-written fetch call, and matching TypeScript types on both sides
- ❌ Client-side fetch code is boilerplate — zod, error handling, loading states, revalidation — repeated for every action
- ❌ No built-in CSRF protection — must implement double-submit cookies or SameSite reliance

### Option B — Server Actions exclusively (chosen)

- ✅ One function call from component to database — no API contract to maintain
- ✅ TypeScript types flow end-to-end without serialization boilerplate
- ✅ Revalidation is one call: `revalidatePath("/transactions")`
- ✅ Next.js framework enforces origin checking and signed action IDs — CSRF protection by default
- ✅ Form submission is native: `<form action={serverAction}>` just works, progressive enhancement included
- ❌ Cannot be called by non-browser clients — but we don't need that today
- ❌ Server Actions are newer and have had some rough edges in earlier Next.js releases (mitigated by pinning to Next.js 16)
- ❌ Debugging is slightly less visible than a REST call in the Network tab

### Option C — Hybrid

- Use Server Actions for most mutations, carve out REST routes for specific cases where mobile clients or webhooks are needed.
- This is where we land for `app/api/health` (container healthchecks) and file download routes.

## Decision

We use **Server Actions for all state mutations.** REST API routes under `app/api/` are reserved exclusively for:

1. Health checks (`/api/health`)
2. File downloads (raw binary response, not JSON)
3. Webhook receivers (if/when needed)
4. Service-to-service endpoints (`hle-claude_api` exposes REST because it is called from other apps, not browsers)

Every Server Action must:

- Be marked `"use server"` at the top of the file
- Start with `getCurrentUser()` + `getCurrentHouseholdId()` checks
- Validate inputs with a `zod` schema
- Return `{ error: string }` on failure (do not throw to the client)
- Call `revalidatePath()` on success for any affected route

## Consequences

### Positive

- **Massive reduction in boilerplate.** A new mutation is one file (`actions.ts`), one function, and one form. No TypeScript contract duplication, no fetch wrapper, no loading state plumbing.
- **CSRF protection is built in.** Next.js 14+ signs action IDs and enforces same-origin checks on Server Action invocations. We don't implement or configure anything.
- **Household scoping is enforced at the function level.** Because every action is a plain TypeScript function, the `getCurrentUser() + getCurrentHouseholdId()` check is a single copy-paste away, and reviewers can grep for it.
- **Progressive enhancement.** Forms work without JavaScript. An attacker who disables JS cannot bypass auth — the action still runs server-side.

### Negative

- **No mobile client support today.** If we ever need a React Native or Flutter client, we will implement a parallel REST layer for the mutations that app needs. We accept this cost because the current target is browser-only.
- **Server Action invocations are opaque in browser devtools** — they look like POSTs to the page URL with encoded bodies. Debugging requires reading server logs, not the Network tab. Mitigated by good server-side logging.
- **Third-party services that want to `curl` an endpoint cannot use Server Actions** — this is what the `app/api/` exceptions exist for.

## Enforcement

- `CLAUDE.md` states: "Use Next.js Server Actions (`"use server"`) for all create/update/delete operations. No client-side fetch for mutations. Server Actions only."
- CLAUDE.md also states: "Only use `app/api/` routes for: health checks, file downloads, webhook receivers."
- PR template security checklist requires every new Server Action to call `getCurrentUser()` and `getCurrentHouseholdId()`.
- CodeQL and manual review catch any `fetch` call that POSTs to an `/api/` route for data mutation.
