# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for HLEcosystem, following a lightweight variation of [Michael Nygard's template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions.html).

**Purpose.** An ADR captures *why* a significant design decision was made, not just *what* the code does. New contributors should be able to read the ADRs and understand the reasoning behind choices that are otherwise invisible — "why Podman instead of Docker", "why cookie sessions instead of NextAuth", etc. This is how we prevent relitigation of settled decisions and provide context for future changes.

**Status values:**
- **Proposed** — under discussion
- **Accepted** — decision is binding on new code
- **Deprecated** — no longer the recommended approach, but legacy code may still reflect it
- **Superseded by ADR-NNNN** — replaced by a later decision

**Index:**

| ADR | Title | Status |
|-----|-------|--------|
| [0001](./0001-single-database-schema-isolation.md) | Single database with schema-level isolation | Accepted |
| [0002](./0002-podman-over-docker.md) | Podman over Docker for container runtime | Accepted |
| [0003](./0003-cookie-sessions-over-nextauth.md) | Custom cookie sessions over NextAuth/Auth.js | Accepted |
| [0004](./0004-server-actions-over-rest.md) | Server Actions over REST API for mutations | Accepted |
| [0005](./0005-household-scoped-tenancy.md) | Household-scoped multi-tenancy | Accepted |

## Adding a new ADR

1. Copy the most recent numbered file as a template
2. Increment the number (zero-padded to 4 digits)
3. Pick a short kebab-case slug: `NNNN-short-slug.md`
4. Add an entry to the index above
5. Open a PR — the ADR is reviewed like code
