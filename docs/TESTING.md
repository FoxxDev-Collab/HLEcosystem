# Testing Strategy

**Status:** Honest gap analysis — HLEcosystem does not currently ship an automated test suite.

This document exists because a project preparing for public FOSS release should not silently omit its testing story. Pretending there are tests when there aren't, or hand-waving about "manual QA", would be worse than explicit honesty. This page documents the current quality gate, the gap, and the roadmap.

## Current quality gate

Every push and every pull request is subject to the following automated checks:

| Check | Tool | Workflow | Fails build on |
|-------|------|----------|----------------|
| Lint | ESLint (`eslint-config-next`) | `.github/workflows/ci.yml` | Any lint error |
| Type check | TypeScript `tsc --noEmit` | `.github/workflows/ci.yml` | Any type error |
| Dependency CVEs | `npm audit --audit-level=high` | `.github/workflows/security.yml` | Any high or critical advisory |
| Filesystem security scan | Trivy | `.github/workflows/security.yml` | Any critical/high finding |
| Secret scan | gitleaks (full history on PR) | `.github/workflows/security.yml` | Any detected secret |
| Static analysis | CodeQL (security-extended + security-and-quality) | `.github/workflows/security.yml` | Any security alert |

Dependencies are kept current by Dependabot running weekly per-app.

This is a **real** quality gate: a PR that introduces a type error, a lint violation, a known vulnerability, or a committed secret will not merge.

## What's missing

No unit, integration, or end-to-end test suite exists. Specifically:

- No Vitest, Jest, or Node test runner configuration in any app
- No Playwright or Cypress end-to-end tests
- No Prisma mock or testcontainers-based database integration tests
- No Server Action test harness

This is a meaningful gap. It means:

- **Refactors rely on type safety plus manual verification.** TypeScript catches a lot, but not logic bugs.
- **Regression risk is real.** A future contributor fixing a bug could silently reintroduce the household-scoping fix from 2026-04-08 (see [ADR-0005](./adr/0005-household-scoped-tenancy.md)) and CI would not catch it.
- **Behavioral changes to Prisma queries are not covered** — the lint/typecheck gate catches *structural* breakage, not incorrect `where` clauses.

## Why no tests yet?

Honest answer: this project started as internal tooling for one family. The test suite that would make sense for a multi-tenant SaaS company is overhead that didn't earn its keep for one user. Now that the project is going public, the ROI has shifted and tests are on the roadmap.

## Roadmap

In priority order:

1. **Vitest bootstrap** in one pilot app (likely `hle-family_finance` — highest complexity, highest risk). Tests live in `app/(app)/<feature>/__tests__/` next to the code they cover.
2. **Server Action unit tests** that mock `prisma` and verify household scoping is enforced. This is the single highest-value test category for this codebase because it directly guards the critical tenancy rule.
3. **Cross-schema query tests** for `lib/users.ts` and `lib/household.ts` — these are the only places where `$queryRaw` is used, and they are duplicated across apps. Testing once in a shared location would catch regressions.
4. **Prisma seed-based integration tests** using testcontainers (Podman-compatible) for the critical flows: login, session validation, household creation, transaction CRUD with household scoping.
5. **Playwright smoke tests** for login + one "happy path" per app, wired into CI on a nightly schedule (not per-PR, to keep CI fast).

**When should a test be added?** The floor rule going forward: any PR that introduces a new Server Action touching money, health data, or file uploads must include a unit test that asserts the auth + household scoping checks are present and fail-closed. Bug-fix PRs should add a regression test for the specific bug.

## Contributing tests

Tests are welcome contributions. If you pick up any item from the roadmap, open a PR with your proposed test structure and a few sample tests — we'll lock in the patterns together before building out coverage.

See [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the PR process.
