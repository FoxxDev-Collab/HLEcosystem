# HLEcosystem — NIST SP 800-53 Rev 5 Control Traceability

**Version:** 1.0
**Last updated:** 2026-04-08
**Control baseline:** NIST SP 800-53 Rev 5 Moderate (subset)
**Scope:** Application-layer controls only. Platform controls (host hardening, network segmentation, physical security, backup/restore, continuity planning) are the operator's responsibility and are intentionally out of scope for this document.
**Status convention:**

| Status | Meaning |
|--------|---------|
| ✅ **Implemented** | Control is enforced in code; citation points to the enforcement point. |
| 🟡 **Partial** | Control is implemented in some apps or configurations but not comprehensively. Gap is documented. |
| ❌ **Not implemented** | Control is not addressed at the application layer. Operator must compensate. |
| N/A | Control does not apply to this application type. |

**Important disclaimer:** This document is a *self-assessment* by the project author (Jeremiah Price, CISSP, ISSO with 8 years RMF/GRC experience). It is not the output of an independent assessor and is not an ATO package. Operators deploying HLEcosystem in a regulated environment must perform their own assessment against their system categorization, tailoring, and boundary definition.

---

## AC — Access Control

### AC-2 Account Management

**Status:** ✅ Implemented

- User accounts are created, disabled, and deleted through `hle-family_manager` with explicit admin authorization.
- **Evidence:**
  - User CRUD: `hle-family_manager/lib/users.ts`
  - `active` flag enforced on every session validation: `hle-family_manager/lib/session.ts:39` — disabled users cannot resume sessions even if a token exists.
  - Role assignment: `family_manager/prisma/schema.prisma:36` (`role Role @default(MEMBER)`)
- **Residual:** No automatic account disablement on inactivity (AC-2(3)). Operator must implement.

### AC-3 Access Enforcement

**Status:** ✅ Implemented

- Every Server Action enforces authentication and household scoping before performing any data access or mutation.
- **Canonical pattern:**
  ```typescript
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");
  // ... all subsequent queries are scoped by householdId
  ```
- **Evidence:**
  - `hle-family_finance/app/(app)/transactions/actions.ts:34-37` — canonical pattern
  - `hle-family_finance/app/(app)/transactions/actions.ts:55-66` — account ownership re-verification before cross-account balance mutations
  - `hle-family_home_care/app/api/documents/serve/[docId]/route.ts` — API route with explicit household scoping
- **Policy:** enforced via the PR template security checklist.

### AC-6 Least Privilege

**Status:** ✅ Implemented (household scope) / 🟡 Partial (role-based admin)

- Two-tier RBAC:
  - Global role (`Role` enum): `ADMIN`, `MEMBER` (`family_manager/prisma/schema.prisma:12`)
  - Household role (`HouseholdRole` enum): `ADMIN`, `MEMBER` (`family_manager/prisma/schema.prisma:17,79`)
- Least privilege at the tenancy boundary is absolute: no query returns rows from a household the caller is not a member of.
- **Gap:** Role checks are per-route, not centralized. A missing check in a new admin route would silently grant privilege. Mitigated by the PR template and by CodeQL in CI.

### AC-7 Unsuccessful Logon Attempts

**Status:** ❌ Not implemented at application layer.

- No application-layer account lockout or login-attempt throttling.
- **Operator duty:** Configure rate limiting on the reverse proxy for `/api/login` equivalents (`POST /login` in each app).
- **Documented in:** [`SECURITY.md`](../SECURITY.md), [`THREAT_MODEL.md`](./THREAT_MODEL.md) §6 G-1.

### AC-12 Session Termination

**Status:** ✅ Implemented

- Sessions expire 30 days after creation (`hle-family_manager/lib/session.ts:5,17`).
- Expired sessions are deleted on access (`session.ts:35-37`).
- Logout explicitly deletes the session row (`session.ts:48-49`).
- Admin can terminate all sessions for a user (`session.ts:52-54`) — useful for incident response.
- Background sweep for expired sessions is available (`session.ts:56-59`) — operator must wire to cron.

### AC-17 Remote Access

**Status:** 🟡 Partial — delegated to operator reverse proxy.

- The application does not terminate TLS. Operators deploy HLEcosystem behind a reverse proxy (nginx, Cloudflare Tunnel, Traefik) that enforces TLS 1.2+.
- Cookie `Secure` flag defaults to `NODE_ENV === "production"` (`lib/auth.ts:29`, applied uniformly across all apps). Operators can explicitly opt out via `SECURE_COOKIES=false` for local testing only.

---

## AU — Audit and Accountability

### AU-2 Event Logging

**Status:** 🟡 Partial — **known gap, tracked**.

- **Implemented in `hle-file_server`:**
  - Audit table: `hle-file_server/prisma/schema.prisma:245` (`model AuditLog`)
  - Emission helper: `hle-file_server/lib/audit.ts:13` (`prisma.auditLog.create`)
  - Events logged: file create, delete, share, download.
- **Not implemented in other apps.** `finance`, `health`, `hub`, `home_care`, `meal_prep`, `wiki`, `travel` do not currently emit audit events for write operations. This contradicts CLAUDE.md's stated policy and is tracked as threat model gap **G-2**.
- **Operators needing AU-2 compliance cannot rely on the current codebase for apps other than file_server.** PostgreSQL native logging (`log_statement = mod`) is a compensating control at the platform layer.

### AU-3 Content of Audit Records

**Status:** 🟡 Partial (where implemented)

- `AuditLog` entries in file_server include: timestamp (`createdAt`), user ID, action type, resource ID, and metadata JSON. This meets the AU-3 minimum (who/what/when/where/outcome) for the file_server surface only.

### AU-12 Audit Record Generation

**Status:** 🟡 Partial

- `hle-file_server` generates audit records synchronously with the triggering action, ensuring no in-flight events are lost. Other apps: see AU-2 gap.

---

## IA — Identification and Authentication

### IA-2 Identification and Authentication (Organizational Users)

**Status:** ✅ Implemented

- Username (email) + password primary factor.
- Optional TOTP second factor (`hle-family_manager/lib/totp.ts`).
  - Generation: `totp.ts:57`
  - Verification: `totp.ts:63`
  - Provisioning URI format: `totp.ts:86`
- Sessions are token-bound (not cookie-bound), so cookie replay across the `AUTH_DOMAIN` cannot survive a session token rotation.

### IA-2(1) IA-2(2) Multi-factor Authentication

**Status:** 🟡 Partial — TOTP available, **not enforced**.

- TOTP is opt-in per user. Admins cannot currently require MFA for all accounts. This is a documented gap (threat model G-7).
- Recommendation for deployments needing IA-2(1) compliance: mark as an accepted risk, track, and wait for enforced-MFA feature.

### IA-5 Authenticator Management

**Status:** ✅ Implemented

- Passwords are bcrypt-hashed with cost factor 12 (exceeds the OWASP ASVS v4.0.3 recommendation of cost ≥ 10).
  - Hash on create: `hle-family_manager/lib/users.ts:61`
  - Hash on password change: `lib/users.ts:94`
  - Constant-time compare via bcrypt: `lib/users.ts:113`
- Session tokens are 64 bytes from `crypto.randomBytes` (`lib/session.ts:7-9`).
- Share-link tokens are 32 bytes from `crypto.randomBytes` (`hle-file_server/app/(app)/shared/actions.ts`).
- **No password complexity / history / reuse policy is enforced in code.** Operator must document acceptable password policy externally; per OWASP ASVS 2.1, long passphrases are preferred over complex short passwords and no enforcement is often the right call.

### IA-5(1) Password-Based Authentication

**Status:** 🟡 Partial — storage is compliant, enrollment policy is operator-defined.

- Storage: compliant (bcrypt cost 12, per-user salt via bcrypt format).
- Transmission: TLS is operator duty (see AC-17).
- Complexity / minimum length: not enforced in code. Forms only require non-empty.

---

## SC — System and Communications Protection

### SC-7 Boundary Protection

**Status:** 🟡 Partial — delegated.

- The app layer does not enforce ingress filtering. Operators place HLEcosystem behind a reverse proxy or mesh.
- Egress is limited: the only external call is `claude_api` → `api.anthropic.com` (documented in threat model TB-5). All other apps only talk to the local database.

### SC-8 Transmission Confidentiality and Integrity

**Status:** 🟡 Partial — TLS termination is operator duty.

- Application sets `Secure` on all auth cookies in production (`lib/auth.ts:29`, consistent across 10 `lib/auth.ts` and `lib/household.ts` files).
- `httpOnly` and `SameSite=Lax` are universal: `lib/auth.ts:29-31`.
- The operator is responsible for TLS 1.2+ at the reverse proxy. HLEcosystem documents this requirement in README and SECURITY.md.

### SC-13 Cryptographic Protection

**Status:** ✅ Implemented

- **Password hashing:** bcrypt (adaptive; cost 12) via `bcryptjs`. See IA-5.
- **Session token generation:** `crypto.randomBytes(64)` — 512 bits entropy (`hle-family_manager/lib/session.ts:7-9`).
- **Share-link token generation:** `crypto.randomBytes(32)` — 256 bits entropy (`hle-file_server/app/(app)/shared/actions.ts`).
- **TOTP:** RFC 6238 SHA-1 HMAC, 6 digits, 30-second period (`hle-family_manager/lib/totp.ts`).
- **No use of weak primitives:** repository-wide audit confirms no MD5 or SHA-1 for password storage, no JWT `alg: none`, no DES/RC4, no hardcoded keys.

### SC-28 Protection of Information at Rest

**Status:** ❌ Not implemented at application layer.

- Database and filesystem encryption are operator responsibilities. HLEcosystem does **not** encrypt file uploads or database columns at the application layer.
- **Operator duty:** deploy on encrypted volumes (LUKS, EBS with KMS, RDS with encryption-at-rest).
- **Documented in:** SECURITY.md.

---

## SI — System and Information Integrity

### SI-2 Flaw Remediation

**Status:** ✅ Implemented

- Dependabot configured for all 10 apps + GitHub Actions (`.github/dependabot.yml`), weekly schedule, grouped dev-dependency and security-update PRs.
- Trivy filesystem scan runs on every push, every PR, and weekly via cron (`.github/workflows/security.yml`).
- `npm audit --audit-level=high` enforced per-app in CI (`.github/workflows/security.yml`).
- CodeQL security-extended + security-and-quality query suites run on every push/PR.
- Results surfaced via GitHub Code Scanning (SARIF upload).

### SI-4 System Monitoring

**Status:** 🟡 Partial

- Container healthchecks implemented (`Containerfile.nextjs:78-79`).
- Application logs go to stdout/stderr; operators aggregate via journald, Loki, etc.
- **No built-in SIEM integration.** Operator duty.

### SI-10 Information Input Validation

**Status:** ✅ Implemented

- Every Server Action validates inputs with `zod` schemas at the trust boundary:
  - Finance transactions: `hle-family_finance/app/(app)/transactions/actions.ts:11-31`
  - Finance accounts: `hle-family_finance/app/(app)/accounts/actions.ts:10-38`
  - Applies consistently across all apps
- File uploads: magic-byte MIME detection, extension blocklist, size cap — `hle-file_server/lib/file-validation.ts:7,95,111,139`
- SQL injection: repository-wide audit confirms zero occurrences of `$queryRawUnsafe` or `$executeRawUnsafe` with user-controlled input. All cross-schema reads use `prisma.$queryRaw` tagged templates.

### SI-11 Error Handling

**Status:** ✅ Implemented

- Server Actions return `{ error: string }` objects to the client instead of throwing. Raw stack traces are not surfaced to end users.
- Next.js App Router error boundaries handle unhandled rendering errors.

---

## CM — Configuration Management

### CM-2 Baseline Configuration

**Status:** ✅ Implemented

- `Containerfile.nextjs` pins Node.js to `node:22-alpine` and uses a repeatable multi-stage build.
- `package-lock.json` is committed for every app — builds are reproducible given the lock file.
- All configuration is sourced from environment variables documented in `.env.example`.

### CM-6 Configuration Settings

**Status:** ✅ Implemented

- Secure defaults in `Containerfile.nextjs`:
  - Non-root runtime user (`nextjs:1001`, line 48-49, 75)
  - Minimal runtime surface — standalone Next.js output only (line 55)
  - Telemetry disabled (`NEXT_TELEMETRY_DISABLED=1`, line 52)
- Secure cookie defaults: `httpOnly=true`, `sameSite=lax`, `secure=production` across all apps.

### CM-7 Least Functionality

**Status:** ✅ Implemented

- Each app container runs only the Next.js standalone server and the entrypoint script. No shell services, no sidecar daemons.
- No unnecessary packages installed in the runtime stage.
- `node_modules` in the runtime image contains only production deps + Prisma CLI for migrations.

---

## RA — Risk Assessment

### RA-5 Vulnerability Scanning

**Status:** ✅ Implemented

- **Trivy** (filesystem scan): every push, every PR, weekly cron, SARIF uploaded to GitHub Security. Fail-build on Critical/High.
- **npm audit** (per-app): every push, every PR. Fail-build on high.
- **CodeQL** (SAST): every push, every PR. security-extended + security-and-quality suites.
- **gitleaks** (secrets): every push, every PR, full history on PR.
- All four tools are defined in `.github/workflows/security.yml` and are runnable locally via the `hle.sh` wrapper.

---

## SA — System and Services Acquisition

### SA-11 Developer Testing and Evaluation

**Status:** 🟡 Partial

- Static analysis: ESLint + TypeScript strict mode, enforced in `ci.yml`.
- Security static analysis: CodeQL + Trivy + gitleaks, enforced in `security.yml`.
- **Unit/integration test suite: not yet implemented.** Gap tracked in `docs/TESTING.md`.

### SA-15 Development Process, Standards, and Tools

**Status:** ✅ Implemented

- Coding standards: [`CLAUDE.md`](../CLAUDE.md)
- Contribution process: [`CONTRIBUTING.md`](../CONTRIBUTING.md)
- Architectural decision records: [`docs/adr/`](./adr/)
- PR template enforces the security review checklist: `.github/PULL_REQUEST_TEMPLATE.md`
- Threat model: [`docs/THREAT_MODEL.md`](./THREAT_MODEL.md)
- Security policy: [`SECURITY.md`](../SECURITY.md)

---

## Controls explicitly out of scope

These controls apply to the platform on which HLEcosystem is deployed, not to the application codebase. Operators must address them separately.

| Family | Notes |
|--------|-------|
| CP — Contingency Planning | Backup, restore, DR — operator duty |
| IR — Incident Response | Operator duty |
| MA — Maintenance | Operator duty |
| MP — Media Protection | Operator duty |
| PE — Physical and Environmental Protection | Operator duty |
| PL — Planning | Operator duty |
| PS — Personnel Security | Operator duty |
| PM — Program Management | Operator duty |

---

## Summary

| Family | Implemented | Partial | Not implemented | N/A |
|--------|-------------|---------|-----------------|-----|
| AC | 4 | 2 | 1 | 0 |
| AU | 0 | 3 | 0 | 0 |
| IA | 2 | 2 | 0 | 0 |
| SC | 2 | 2 | 1 | 0 |
| SI | 3 | 1 | 0 | 0 |
| CM | 3 | 0 | 0 | 0 |
| RA | 1 | 0 | 0 | 0 |
| SA | 1 | 1 | 0 | 0 |
| **Total** | **16** | **11** | **2** | **0** |

**Bottom line:** HLEcosystem implements the core application-layer controls expected of a NIST SP 800-53 Moderate-baseline system, with two notable gaps (application-layer rate limiting and comprehensive audit logging outside `file_server`) that are documented, tracked, and communicated to operators. The remaining Partial controls reflect the project's deliberate delegation of platform concerns (TLS termination, at-rest encryption, physical security) to the deploying operator — the standard pattern for a self-hosted web application.

Maintained by: Jeremiah Price, CISSP — Founder, Foxx Cyber LLC
