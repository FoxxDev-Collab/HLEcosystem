# Testing Strategy

HLEcosystem uses Vitest for unit tests. The suite is deliberately small and targeted at the highest-value security boundaries — auth, session handling, user sanitization, and household-scoped tenancy — rather than chasing coverage numbers.

## Current quality gate

Every push and every pull request is subject to the following automated checks:

| Check | Tool | Workflow | Fails build on |
|-------|------|----------|----------------|
| Lint | ESLint (`eslint-config-next`) with React 19 purity rules | `.github/workflows/ci.yml` | Any lint error |
| Type check | TypeScript `tsc --noEmit` | `.github/workflows/ci.yml` | Any type error |
| Unit tests | Vitest | `.github/workflows/ci.yml` | Any test failure |
| No rule suppressions | Diff grep | `.github/workflows/ci.yml` | Any new `eslint-disable` / `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` |
| Dependency CVEs | `npm audit --audit-level=high` | `.github/workflows/security.yml` | Any high or critical advisory |
| Filesystem security scan | Trivy (SARIF to GitHub Security) | `.github/workflows/security.yml` | Any critical/high finding |
| Secret scan | gitleaks (full history on PR) | `.github/workflows/security.yml` | Any detected secret |
| Static analysis | CodeQL (security-extended + security-and-quality) | `.github/workflows/security.yml` | Any security alert |

Dependencies are kept current by Dependabot running weekly per-app.

## Current test coverage

**Vitest is configured in:**

- `hle-family_manager` — owns auth, sessions, TOTP, user CRUD (the identity core)
- `hle-family_finance` — pilot app with the ADR-0005 incident regression suite

**Apps without tests yet:** `hle-claude_api`, `hle-family_health`, `hle-family_home_care`, `hle-family_travel`, `hle-family_wiki`, `hle-familyhub`, `hle-file_server`, `hle-meal_prep`. The CI workflow conditionally runs `npm test` only where `vitest.config.ts` exists, so these apps don't fail CI — but they should grow tests over time (see Roadmap below).

### What is tested

**`hle-family_manager/lib/users.test.ts`** — 5 tests
- `toPublic()` strips `password` field
- `toPublic()` strips `totpSecret` field
- `toPublic()` preserves all non-sensitive fields verbatim
- `toPublic()` preserves `totpEnabled` (which is metadata, not the secret itself)
- **Allow-list guard:** the returned public object contains only the documented public fields. If a contributor adds a new sensitive field to `User` without updating `toPublic()`, this test fails and blocks the PR.

**`hle-family_manager/lib/session.test.ts`** — 6 tests
- `generateSessionToken()` returns a 128-character lowercase hex string (64 bytes = 512 bits entropy)
- `generateSessionToken()` produces unique tokens across 100 calls (CSPRNG sanity)
- `validateSession()` returns `null` for an unknown token
- `validateSession()` returns `null` **and deletes the expired row** when called with an expired session token
- `validateSession()` returns `null` when the underlying user is inactive (`active: false`) — even with a valid session row. Critical: a disabled user must not be able to resume a pre-existing session.
- `validateSession()` returns a `UserPublic` (never `password` or `totpSecret`) for a valid live session

**`hle-family_finance/app/(app)/transactions/actions.test.ts`** — 5 tests (ADR-0005 incident regression)
- **`createTransactionAction` rejects a foreign `accountId`.** Simulates the exact pre-fix vulnerability: a user in household A submits a form with an `accountId` belonging to household B. The test asserts that `prisma.transaction.create` and `prisma.account.update` are **never called**.
- **`createTransactionAction` rejects a foreign `transferToAccountId`.** Source account is legitimate; destination account belongs to a different household. The entire transfer operation must abort without any DB mutation.
- **`createTransactionAction` permits a legitimate EXPENSE** in the user's own household and correctly updates the account balance.
- **`createTransactionAction` rejects invalid input** (zod validation failure short-circuits before any DB call).
- **`deleteTransactionAction` refuses to delete a foreign transaction** — the `findUnique` gate scoped by `(id, householdId)` returns null and the handler must not call `delete`.

If any of these tests fail in the future, the tenancy boundary documented in [`docs/adr/0005-household-scoped-tenancy.md`](./adr/0005-household-scoped-tenancy.md) has been breached again. Do not mark them flaky. Do not delete them. Do not skip them. Read the ADR and fix the code.

### Total

**16 tests** across 3 files, covering the auth core and the most security-critical Server Action.

## Running tests

```bash
# Family Manager (auth, sessions, user sanitization)
cd hle-family_manager
npm test                 # one-shot run, used by CI
npm run test:watch       # watch mode for development
npm run test:coverage    # with v8 coverage report

# Family Finance (transaction regression suite)
cd hle-family_finance
npm test
```

## Roadmap

In priority order:

1. **TOTP RFC 6238 vector tests** — add to `hle-family_manager/lib/totp.test.ts` using the canonical RFC test vectors. Easy high-value win.
2. **`hle-file_server/lib/file-validation.test.ts`** — magic-byte detection tests for upload validation. Feed in `.exe` renamed to `.jpg`, verify rejection. Feed in legitimate PNG/PDF/JPEG, verify acceptance.
3. **`hle-claude_api/lib/service-auth.test.ts`** — verify `CLAUDE_API_SERVICE_SECRET` bearer-token validation is constant-time and rejects all malformed headers.
4. **Extend the finance regression suite** to cover `updateTransactionAction`, `createAccountAction`, `deleteAccountAction`, and `adjustBalanceAction` — each should get a "foreign accountId / foreign household" test.
5. **Repeat the pattern** in the other tenant-scoped apps (health, hub, home_care, travel, meal_prep, wiki). Each needs at least one Server Action regression test for the household-scoping invariant.
6. **Cross-schema query tests** for `lib/users.ts` `getUserById()` / `lib/household.ts` `getHouseholdMembership()` — these are duplicated across apps and regression-critical.
7. **Playwright smoke tests** for login + one "happy path" per app, wired into CI on a nightly schedule (not per-PR, to keep CI fast).

## Testing philosophy

- **Target security boundaries first.** The household scoping check, the user sanitization, the session validation — these are where bugs turn into CVEs. Test them before testing pure utility helpers.
- **Mock the boundary, not the logic.** The finance regression test mocks Prisma so it runs in milliseconds against the actual handler code. We are testing the handler logic, not Prisma itself.
- **Every bug fix gets a regression test.** If a PR fixes a security issue or a tenancy bug, the PR must include a test that fails on the pre-fix code and passes on the post-fix code. The incident documented in ADR-0005 is the proof-of-concept: the fix and the test were paired.
- **No `toHaveBeenCalledTimes(0)` padding.** We assert that dangerous calls are **not** made in the attack scenarios, not that the handler was "called somewhere". Pattern: mock the attack, invoke the handler, assert *exactly* which mutations must not have happened.
- **No ignored or skipped tests in committed code.** `.skip` / `.only` / `xit` are all banned. If a test is broken, fix it or delete it.

## Contributing tests

Tests are welcome contributions. If you pick up any item from the roadmap, open a PR with your proposed test structure and a few sample tests — we'll lock in the patterns together before building out coverage. See [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the PR process.
