# HLEcosystem Threat Model

**Version:** 1.0
**Last updated:** 2026-04-08
**Methodology:** STRIDE per trust boundary, informed by NIST SP 800-154 (Guide to Data-Centric System Threat Modeling).
**Scope:** All ten apps under `hle-*/`, the shared PostgreSQL instance, and the `hle.sh` / `compose.yaml` deployment surface.
**Audience:** Contributors evaluating security impact of a change; self-hosters deciding whether to expose HLEcosystem to the public internet; reviewers filing security issues.

---

## 1. Purpose and system overview

HLEcosystem is a self-hosted multi-app family management platform. Ten Next.js 16 applications share one PostgreSQL 16 database with **schema-level isolation**. `hle-family_manager` owns the `User` and `Session` tables and acts as the identity provider; every other app reads those tables via Prisma `$queryRaw` across the schema boundary. All tenancy is enforced via a `householdId` column on every tenant-scoped table.

The design assumption is that operators run HLEcosystem **behind a trusted reverse proxy** (Cloudflare Tunnel, nginx, Traefik, or equivalent) that terminates TLS. The application layer does not serve raw HTTPS and does not implement rate limiting.

## 2. Trust boundaries (data flow diagram)

```
       ┌──────────────────────────────────────────────────────────────┐
       │                 HOSTILE INTERNET (TB-1)                      │
       │   - Untrusted browsers, bots, crawlers, attackers            │
       └──────────────────┬───────────────────────────────────────────┘
                          │  TLS (terminated by operator reverse proxy)
                          ▼
       ┌──────────────────────────────────────────────────────────────┐
       │          REVERSE PROXY / CDN (TB-2, operator-provided)       │
       │   - TLS termination, WAF, rate limiting (operator duty)      │
       └──────────────────┬───────────────────────────────────────────┘
                          │  Plain HTTP inside Podman network
        ┌─────────────────┼───────────────┬────────────────┐
        ▼                 ▼               ▼                ▼
┌────────────────┐┌──────────────┐┌──────────────┐┌─────────────────┐
│ family_manager ││ finance/hub/ ││ file_server  ││  claude_api     │
│   (TB-3a)      ││ health/...   ││   (TB-3c)    ││   (TB-3d)       │
│ issues sessions││   (TB-3b)    ││ file storage ││ AI gateway      │
└───────┬────────┘└──────┬───────┘└──────┬───────┘└────────┬────────┘
        │                │               │                  │
        │  Prisma $queryRaw (cross-schema reads User/Session)│
        │                │               │                  │
        ▼                ▼               ▼                  │
 ┌─────────────────────────────────────────────────┐        │
 │           PostgreSQL (TB-4)                     │        │
 │   Schemas: family_manager, finance, health,     │        │
 │   hub, home_care, file_server, meal_prep,       │        │
 │   wiki, travel, claude_api                      │        │
 └─────────────────────────────────────────────────┘        │
                                                            ▼
                                               ┌────────────────────┐
                                               │ api.anthropic.com  │
                                               │   (TB-5, egress)   │
                                               └────────────────────┘
```

**Trust boundaries:**

| ID | Boundary | Crossing asset(s) | Trust delta |
|----|----------|-------------------|-------------|
| TB-1 | Internet ↔ Reverse proxy | TLS, auth cookies, form data, file uploads | Untrusted → Operator-controlled |
| TB-2 | Reverse proxy ↔ App container | HTTP requests, `hle_session` cookie | Operator-controlled → Trusted within Podman network |
| TB-3a/b/c/d | App ↔ App (lateral) | Only via DB; no direct HTTP between apps except finance/health/hub → claude_api | Trusted ↔ Trusted (shared DB) |
| TB-4 | App ↔ PostgreSQL | SQL queries over Podman network | Trusted (dev) → Trusted (prod, assumed network-segmented) |
| TB-5 | `claude_api` → `api.anthropic.com` | Egress HTTPS, bearer token, user prompt content | Trusted → External SaaS (data-sharing risk) |

**Public endpoint exceptions** (cross TB-1 without authentication):
- `GET /api/health` on every app (liveness probe)
- `GET /api/share/[token]/download` in `hle-file_server` — token-gated public file download

## 3. Assets and data classification

| Asset | Sensitivity | Location | Notes |
|-------|-------------|----------|-------|
| User passwords | **Critical** | `family_manager.User.password` | bcrypt cost 12 (`hle-family_manager/lib/users.ts:61,94`) |
| TOTP secrets | **Critical** | `family_manager.User.totpSecret` | Stripped from public user type (`lib/session.ts:41`, `lib/users.ts:18`) |
| Session tokens | **High** | `family_manager.Session.token` | 64 bytes CSPRNG, 30-day expiry (`lib/session.ts:5,7-9`) |
| Share-link tokens | **High** | `file_server.ShareLink.token` | 256-bit CSPRNG (`hle-file_server/app/(app)/shared/actions.ts`) |
| Financial transactions | **High** | `family_finance.*` | Household-scoped; PII adjacent |
| Health records | **High** | `family_health.*` | Medical PII; household-scoped |
| Uploaded files | **Medium-High** | `hle-file_server/uploads/` volume + `file_server.File` | Magic-byte validated, size capped, extension blocklisted |
| Transaction descriptions sent to Claude | **Medium** | Ephemeral, POSTed to `api.anthropic.com` | Subject to Anthropic's data handling policy |
| Claude API key | **Critical** | `.env` (not committed) | Shared across calling apps |
| `CLAUDE_API_SERVICE_SECRET` | **High** | `.env` | Shared bearer between apps and `claude_api` |

## 4. STRIDE analysis per trust boundary

### TB-1: Internet ↔ Reverse Proxy

| Threat | Description | Mitigation | Residual risk |
|--------|-------------|------------|---------------|
| **S**poofing | Attacker impersonates a user by stealing a session cookie in transit | Session cookie marked `httpOnly`, `SameSite=Lax`, and `Secure` in production (`hle-family_manager/lib/auth.ts:29-31`). TLS termination is the operator's responsibility. | Operator misconfiguration (no TLS, no HSTS) is the main residual. Documented in SECURITY.md. |
| **T**ampering | Form data modified to escalate privileges or poison another household | All Server Actions validate with `zod` at the boundary (e.g. `hle-family_finance/app/(app)/transactions/actions.ts:11-31`) and check `getCurrentUser()` + `getCurrentHouseholdId()`. Account ownership re-verified before balance mutations (`transactions/actions.ts:55-66`). | Any new Server Action that forgets these checks. Mitigated by PR template checklist. |
| **R**epudiation | User denies performing a destructive action | Partial: `hle-file_server` writes audit events (`hle-file_server/lib/audit.ts:13`, schema at `prisma/schema.prisma:245`). **Other apps do not yet audit-log writes — this is an acknowledged gap (see §6).** | HIGH — without audit logs, disputed deletions or modifications cannot be reconstructed. |
| **I**nfo disclosure | Attacker reads another household's data | `WHERE householdId = ${currentHouseholdId}` on every query. Password + TOTP secret stripped before user object leaves the server (`lib/session.ts:41`). | Developer error — a new query without household scoping. |
| **D**oS | Flooding the app layer or file upload endpoint | Upload size capped via `MAX_FILE_SIZE_MB` env (`hle-file_server/lib/file-validation.ts:7`). **No application-layer rate limiting.** | HIGH if exposed without a rate-limiting proxy. Documented as operator duty. |
| **E**oP | Non-admin household member performs an admin action | RBAC via `Role` enum (`family_manager/prisma/schema.prisma:12,17`) and explicit role checks in admin routes. | Medium — role checks are per-route; there is no centralized policy engine. |

### TB-2: Reverse Proxy ↔ App Container

Assumed trusted within the Podman network. The primary concern is **cookie scope leakage** between apps: because all apps share the `hle_session` cookie name and (in production) the `AUTH_DOMAIN` is typically `.example.com`, a vulnerability in any one app yields session access to all. Mitigation is the single source-of-truth session store (`family_manager.Session`) and consistent `validateSession()` implementations (`hle-family_manager/lib/session.ts:26`).

**Residual:** an XSS in any app would let an attacker exfiltrate session data via `document.cookie` — except `httpOnly` prevents that. An XSS could still hit the session-bound Server Actions of all apps. **Mitigated** by the project-wide policy of no `dangerouslySetInnerHTML` (enforced by CodeQL in CI).

### TB-3: App ↔ App lateral movement

Apps do not call each other over HTTP except for `finance`, `health`, `hub` → `claude_api`. That lateral channel is authenticated with a shared bearer (`CLAUDE_API_SERVICE_SECRET`, validated at `hle-claude_api/lib/service-auth.ts:7-42`).

| Threat | Mitigation | Residual |
|--------|------------|----------|
| Spoofing as a different calling app | The `X-Requesting-App` header is client-reported and only logged, not trusted. The shared bearer is identical for all callers. | **Medium** — any single leaked app secret compromises the gateway for all callers. Documented in SECURITY.md. Recommended fix is per-app secrets, tracked as a future improvement. |
| Prompt injection via user-controlled fields | Transaction description/payee are length-capped at 500 chars before being embedded in the prompt (`hle-claude_api/app/api/v1/categorize/route.ts`). Output is parsed as JSON (hard constraint). | Low — worst case is miscategorized transactions, not data exfiltration. |
| Request smuggling | N/A — no streaming / chunked-encoding tricks, standard Next.js request handling. | N/A |

### TB-4: App ↔ PostgreSQL

| Threat | Mitigation |
|--------|------------|
| **SQL injection** | Prisma tagged templates parameterize all inputs. Repository-wide audit: **zero occurrences of `$queryRawUnsafe` or `$executeRawUnsafe` with user-controlled input**. Cross-schema reads use `prisma.$queryRaw` with tagged-template parameterization (e.g. `hle-family_manager/lib/users.ts`). |
| **Credential theft** | `DATABASE_URL` is not committed (`.gitignore:.env`, `!.env.example`). Secrets live in env vars consumed by Podman Compose. |
| **At-rest disclosure** | Not mitigated at the application layer. Operators are expected to deploy on encrypted volumes or RDS with KMS. Documented. |
| **Schema boundary violation** | Each app is pinned to a single schema in its connection string (`?schema=<name>`). Cross-schema reads are explicit `$queryRaw` calls, reviewable in `grep`. |

### TB-5: `claude_api` → `api.anthropic.com`

| Threat | Mitigation |
|--------|------------|
| **Data leakage** — user-controlled transaction descriptions sent to a third party | Operator-visible: documented in README and SECURITY.md. Input is length-capped. Users can disable the feature by not configuring `ANTHROPIC_API_KEY`. |
| **API key theft** | `ANTHROPIC_API_KEY` lives in `.env` only; never logged; never sent to the browser. Server-side fetch only. |
| **Upstream availability** | Graceful degradation: UI still works if Claude API is unreachable — only "smart" features fail. |

## 5. Authenticated public attack surface (share links)

The one intentional TB-1 exception is the file-server share link flow. This deserves its own section because it is the highest-risk endpoint in the platform.

- **Endpoint:** `GET /api/share/[token]/download` and `GET /share/[token]` (`hle-file_server/app/share/[token]/page.tsx`, `.../api/share/[token]/download/route.ts`)
- **Auth:** None — knowledge of the token is the capability
- **Token entropy:** 256 bits from `crypto.randomBytes(32)` (`hle-file_server/app/(app)/shared/actions.ts`)
- **Expiration:** Optional `expiresAt`, enforced at download time
- **Download cap:** Optional `maxDownloads`, enforced at download time
- **Revocation:** `isActive` flag, settable via `revokeShareLinkAction`
- **Password:** **Not implemented.** Knowledge of the URL = full capability.
- **Rate limiting:** Not implemented at the application layer.

**Threats:**
- **Link guessing:** Infeasible at 256 bits entropy.
- **Link leakage via referer/logs/screenshots:** Expected; documented to operators. Mitigated by optional expiration.
- **Brute-forcing `maxDownloads`:** Not possible — each request decrements the counter atomically.
- **Public search engine indexing:** Possible if operators share links publicly. Mitigated by `<meta name="robots" content="noindex">` on the share page (should be verified in CI — see §6 gaps).

## 6. Known gaps and accepted risks

This section is a **contract with contributors and operators**. Fix these or explicitly accept them. Do not pretend they don't exist.

| ID | Gap | Severity | Status |
|----|-----|----------|--------|
| G-1 | **No application-layer rate limiting.** DoS and credential stuffing mitigation is fully delegated to the operator's reverse proxy. | HIGH | Accepted — documented in SECURITY.md |
| G-2 | **Write-path audit logging is implemented only in `hle-file_server`.** CLAUDE.md prescribes audit logging on all mutations; other apps don't yet emit audit events. | HIGH | **Tracked** — will be added app-by-app. Meanwhile, disputed actions in finance/health/hub cannot be forensically reconstructed beyond raw DB rows. |
| G-3 | **Shared `CLAUDE_API_SERVICE_SECRET`** means any compromised calling app yields access to the gateway for all callers. | MEDIUM | Accepted for single-operator deployments. Per-app secrets is a future improvement. |
| G-4 | **No CSRF tokens.** Next.js Server Actions protect against cross-origin POSTs via `SameSite=Lax` and origin verification built into the framework, but there is no explicit double-submit cookie or HMAC token. | LOW–MEDIUM | Accepted — Next.js App Router default is considered sufficient per their docs. Revisit if Next.js changes guidance. |
| G-5 | **No formal test suite.** Quality gate is currently CI lint + typecheck + Trivy + CodeQL. | MEDIUM | Tracked — see `docs/TESTING.md`. |
| G-6 | **Robots meta on share pages is not enforced in CI.** | LOW | Add assertion to the CI matrix or manual review during PR. |
| G-7 | **No 2FA enforcement.** TOTP is implemented (`hle-family_manager/lib/totp.ts`) but not mandatory. | LOW | Operator/admin policy decision. |
| G-8 | **Cookie `Secure` flag defaults depend on `NODE_ENV=production`.** An operator running a production build with `NODE_ENV` unset would get a non-secure cookie. | LOW | Mitigated by sensible default. Documented in SECURITY.md. |

## 7. Out of scope

- Physical attacks on the database host
- Compromise of the operator's Podman host
- Supply-chain attacks on npm dependencies (tracked separately via Dependabot + Trivy + CodeQL in CI)
- Denial of service at Layer 3/4 — operator's network responsibility
- Attacks against the operator's reverse proxy (nginx, Cloudflare, etc.)
- Social engineering of legitimate users

## 8. Review cadence

This threat model should be reviewed:
- On every PR that adds a new trust boundary (a new public endpoint, a new external integration, a new app)
- On every PR that modifies authentication, session handling, or role enforcement
- Annually, regardless of change activity

Last reviewed: 2026-04-08 (initial publication).

## References

- NIST SP 800-154 — Guide to Data-Centric System Threat Modeling
- OWASP ASVS v4.0.3 — baseline verification standard
- Microsoft STRIDE — classification taxonomy
- [`docs/SECURITY_CONTROLS.md`](./SECURITY_CONTROLS.md) — NIST SP 800-53 Rev 5 control traceability
