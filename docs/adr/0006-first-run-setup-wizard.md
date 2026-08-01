# ADR-0006: First-run setup wizard as an unauthenticated endpoint

**Status:** Accepted
**Date:** 2026-08-01
**Deciders:** Jeremiah Price

## Context

`hle-all-in-one` is being released to self-hosted community members. A fresh
install boots with an empty database: migrations run automatically, but no
user exists and no login is possible. Until now the only bootstrap path was
`scripts/seed.ts` — a developer tool that is not shipped in the runtime image
and requires shell access plus environment variables. That is acceptable for
the developer's own machine and unacceptable as a first-run experience for
strangers installing the product.

Per the security workflow, any new public (unauthenticated) endpoint requires
this ADR. The threat is concrete: an unauthenticated endpoint that creates an
**instance administrator** is the single most valuable target in the app, and
"unclaimed fresh instance" takeovers are a well-known real-world failure mode
of self-hosted software (e.g. Portainer's unauthenticated first-user window,
CVE-2019-16878 class of issues).

## Decision

Add `/setup`, an unauthenticated first-run wizard (route + two server fns in
`hle-all-in-one/src/server/fns.setup.ts`), constrained by three independent
controls:

1. **Atomic empty-instance guard.** The admin `INSERT` itself carries
   `WHERE NOT EXISTS (SELECT 1 FROM "User")` and runs inside a transaction
   that first takes `pg_advisory_xact_lock` (`src/server/setup.ts`). The
   moment any user exists, the endpoint creates nothing — enforced in SQL,
   not by a read-then-write check that could race under READ COMMITTED.
   Concurrent submissions serialize on the lock; exactly one wins.

2. **Boot-printed setup token.** While the instance is uninitialized, the
   server prints a random 16-hex-char token to its logs
   (`src/server/setup-token.ts`); the wizard requires it (constant-time
   comparison). Reaching the port is therefore not enough to claim the
   instance — the claimant must also read the container logs, i.e. already
   control the host. `SETUP_TOKEN` overrides generation for automated
   provisioning. 64 bits of entropy makes remote guessing unrealistic, so no
   dedicated throttle is applied; rejected tokens are audited
   (`setup.token_rejected`).

3. **Audit trail.** Completion writes `setup.complete` with the new admin's
   id, email, household, IP, and user agent (ADR requirement AU-2 posture
   from the audit-logging work).

The wizard collects token → admin account (shared password policy) → first
household name, then creates the session directly (no second login step).
`getSetupStatusFn` is a public read that leaks only "is this instance
initialized" — the login page needs exactly that bit to route first-boot
visitors into the wizard.

`scripts/seed.ts` remains a development/e2e tool and is still not shipped in
the runtime image.

## Consequences

- A fresh container is claimable only by someone who can read its logs —
  effectively the host owner — closing the unclaimed-instance window while
  keeping install friction near zero.
- The wizard is dead code after first run: `/setup` redirects to `/login`
  and the guarded INSERT makes the redirect cosmetic rather than the actual
  control.
- An attacker spamming wrong tokens while the instance is uninitialized can
  write `setup.token_rejected` audit rows; the window is short-lived and the
  rows are the evidence, so this is accepted.
- Automated/headless provisioning sets `SETUP_TOKEN` (and may still drive
  the wizard programmatically) instead of needing shell access.
- Regression coverage: `src/server/setup.test.ts` pins the advisory lock,
  the `NOT EXISTS` guard, and token semantics; `e2e/setup-wizard.spec.ts`
  drives the full flow (own Playwright project, self-skipping on an
  initialized instance); `src/server/audit.test.ts` pins both audit events.
