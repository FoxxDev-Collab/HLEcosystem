# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in HLEcosystem, please report it privately. Do **not** open a public GitHub issue.

- **Email:** security@foxxcyber.com
- Please include: affected app(s), version / commit, a description of the vulnerability, reproduction steps, and the potential impact.
- Expect an acknowledgment within 72 hours and a triage update within 7 days.

We follow coordinated disclosure. Once a fix is available and deployed (or a reasonable disclosure window has elapsed), the reporter will be credited unless they prefer to remain anonymous.

## Supported versions

HLEcosystem is developed on `master`. Only the latest commit on `master` receives security fixes. There are no long-term-support branches.

## Scope

In scope:
- All applications under `hle-*/`
- Shared infrastructure (`Containerfile.nextjs`, `compose.yaml`, `hle.sh`)
- Cross-schema auth and household scoping

Out of scope:
- Third-party dependencies (report those upstream; we'll track via `npm audit`)
- Self-hosted deployment misconfigurations not caused by default settings
- Vulnerabilities requiring physical access to the server

## Security model — things operators must know

- **Self-hosted deployment.** HLEcosystem is designed to be self-hosted behind a trusted reverse proxy (Cloudflare Tunnel, nginx, Traefik, etc.). Exposing it directly to the public internet is not recommended without additional hardening.
- **Share links are public by design.** File Server share links are unauthenticated by default — anyone with the token can download. Tokens use 256 bits of CSPRNG entropy but links should still be treated as secret URLs.
- **Cookie `secure` flag** defaults to on in production (`NODE_ENV=production`). Set `SECURE_COOKIES=false` only if terminating TLS elsewhere and you understand the risk.
- **Shared service secret.** The `hle-claude_api` service uses a single `CLAUDE_API_SERVICE_SECRET` shared across all calling apps. For multi-tenant deployments, consider per-app secrets.
- **Household scoping is the tenancy boundary.** Every data query must include `householdId`. Reviewers: look for this on every PR.

## Branch protection and merge policy

All changes to `master` are governed by a GitHub repository ruleset (`master protection`):

- **No direct pushes to `master`** — every change goes through a pull request
- **No force pushes** to `master`
- **No deletion** of `master`
- **Linear history required** — squash or rebase merges only, no merge commits
- **Required status checks (must all pass before merge):**
  - `CI passed` — lint + typecheck + Vitest per affected app
  - `Workflow audit (zizmor)` — static analysis of the workflow YAML itself
  - `Security invariant gate` — diff grep blocking `$queryRawUnsafe`, `dangerouslySetInnerHTML`, lint/type suppressions, and explicit `any`
  - `Secret scan (gitleaks)` — full-history secret detection
  - `Dependency + config scan (trivy)` — SARIF to GitHub Security, fails on HIGH/CRITICAL
  - `CodeQL (JavaScript/TypeScript)` — security-extended + security-and-quality query suites
  - `Dependency review (PR only)` — blocks PRs that introduce vulnerable or incompatibly-licensed dependencies
- **Strict mode:** the PR branch must be up-to-date with `master` before merging
- **Conversation resolution required** before merge

The repository owner is in the bypass list with `always` mode so that a single-dev hotfix path exists. The backstop for bypass abuse is mandatory GitHub account 2FA on the owner account. For a multi-maintainer future, bypass will be narrowed to `pull_request` mode and a CODEOWNERS file will be added.

## Container image supply chain

Every container image built by `.github/workflows/build-push.yml` is:

1. **Scanned by Trivy** (image scanner) before push to GHCR. Any HIGH or CRITICAL finding fails the job and the image never reaches the registry.
2. **Inventoried via SBOM** — Anchore's `sbom-action` generates a CycloneDX JSON SBOM per image, archived as a workflow artifact. Evidence for SP 800-53 SR-4 (Provenance) and SR-11 (Component Authenticity).
3. **Built from a pinned base image** (`node:22-alpine`) running as a non-root user (`nextjs:1001`).

Trivy actions in all workflows are pinned to commit SHAs rather than floating `@master` tags to prevent action-supply-chain poisoning of jobs that have `security-events: write`.

## OpenSSF Scorecard

`.github/workflows/scorecard.yml` runs the OpenSSF Scorecard weekly and on branch-protection changes. Results are published to GitHub Code Scanning and publicly visible on the Scorecard dashboard.

## Security practices in the codebase

- bcrypt cost factor 12 for password hashing
- Session tokens: 64 bytes CSPRNG (`crypto.randomBytes`) — 512 bits entropy
- Share-link tokens: 32 bytes CSPRNG — 256 bits entropy
- httpOnly + SameSite=Lax cookies for sessions; Secure flag defaults to `NODE_ENV=production`
- Parameterized SQL via Prisma tagged templates — zero `$queryRawUnsafe` with user input in the entire codebase (enforced by invariant-gate CI)
- zod validation on all Server Action inputs at the trust boundary
- Magic-byte MIME detection + extension blocklist + size cap on file uploads
- Audit logging on write operations in `hle-file_server`; **tracked gap** for the other apps (see `docs/THREAT_MODEL.md` §6 G-2)
- Unit tests for the authentication core (`hle-family_manager/lib/session.test.ts`, `users.test.ts`) and a regression suite for the ADR-0005 household-scoping incident (`hle-family_finance/app/(app)/transactions/actions.test.ts`)

## Dependency hygiene

We run `npm audit` and `trivy` against the repo periodically. Contributors are encouraged to do the same before opening PRs that touch `package.json`.
