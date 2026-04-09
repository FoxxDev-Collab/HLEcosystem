# ADR-0003: Custom cookie sessions over NextAuth/Auth.js

**Status:** Accepted
**Date:** 2025-12-02 (retroactively documented 2026-04-08)
**Deciders:** Jeremiah Price

## Context

Every app in HLEcosystem needs to authenticate users and resume sessions. The dominant solution in the Next.js ecosystem is NextAuth (now Auth.js) which handles OAuth providers, database adapters, and callback flows out of the box.

We needed to decide between adopting Auth.js or implementing a small custom session layer.

## Options considered

### Option A — NextAuth / Auth.js

- ✅ Mature, widely used, well-known to contributors
- ✅ Built-in support for 20+ OAuth providers
- ✅ Prisma adapter ships ready to go
- ❌ Assumes one auth flow per Next.js app — we have ten apps that need to share sessions
- ❌ Getting a shared session across apps requires a shared JWT with matching `NEXTAUTH_SECRET` everywhere and careful cookie domain configuration, plus awkward workarounds for the fact that every app has its own Next.js runtime
- ❌ JWT-by-default means session revocation is hard — you must either ship a blocklist or wait for TTL
- ❌ The "database session" strategy writes a row per request in most adapter versions — not what we want for a 10-app setup reading the same session table
- ❌ Upgrades to NextAuth have broken APIs between versions (v4 → v5 "Auth.js" rename was painful)
- ❌ We don't need OAuth providers — this is a self-hosted family app, not a public SaaS

### Option B — Custom cookie-bound opaque session tokens (chosen)

- ✅ One table (`family_manager.Session`), one source of truth for all apps
- ✅ Opaque token stored server-side — revocation is a `DELETE` away
- ✅ Zero OAuth machinery we don't need
- ✅ ~150 lines of code, fully understood and auditable
- ✅ Cross-app session sharing is trivial: every app validates the same `hle_session` cookie against the same `family_manager.Session` table via `$queryRaw`
- ✅ No upgrade treadmill
- ❌ We own the code — if we introduce a bug, we introduce a security bug
- ❌ No out-of-the-box social login — must implement OAuth ourselves if ever needed

### Option C — Lucia Auth

- ✅ Smaller than NextAuth, less opinionated
- ❌ Still adds abstraction we don't need
- ❌ Active development and breaking changes

## Decision

We use **Option B: custom cookie-bound opaque session tokens.**

- Session tokens are generated with `crypto.randomBytes(64).toString("hex")` — 512 bits of entropy ([`hle-family_manager/lib/session.ts:7-9`](../../hle-family_manager/lib/session.ts)).
- Sessions are stored in `family_manager.Session` with `userId`, `expiresAt`, `userAgent`, `ipAddress`.
- TTL is 30 days.
- Every app reads this one table via `$queryRaw` in its own `lib/auth.ts`.
- Cookie is `hle_session`, `httpOnly`, `SameSite=Lax`, `Secure` in production.
- Logout deletes the row. Admin can force-revoke all sessions for a user in one call.
- TOTP MFA is layered on top in a separate `lib/totp.ts` module.

## Consequences

### Positive

- **Revocation works instantly** — no JWT blocklist to ship
- **Cross-app session sharing is one `$queryRaw` line** — no domain-cookie choreography, no JWT secret distribution beyond the single database
- **No external auth vendor dependency** — the entire auth code path lives in `hle-family_manager/lib/session.ts` + `lib/auth.ts`, ~150 lines
- **Operators can audit sessions directly** — `SELECT * FROM family_manager."Session" WHERE "userId" = ...`
- **Admin session termination** for incident response is one function call ([`session.ts:52-54`](../../hle-family_manager/lib/session.ts))

### Negative

- We are responsible for the correctness of the auth code. The mitigation is code simplicity — the entire session layer fits on two screens — plus CodeQL static analysis, bcrypt cost 12, and constant-time compare via the bcrypt library.
- No social login. If we ever need "sign in with Google" for a particular deployment, we will implement it as a separate endpoint that resolves to the same session table, not migrate to NextAuth.

## Enforcement

- `CLAUDE.md` states: "Do not use NextAuth/Auth.js — the cookie-based auth pattern is intentional"
- New apps bootstrap by copying `lib/auth.ts` and `lib/session.ts` from `hle-family_manager`
- The PR template security checklist flags any change that touches auth for extra review
