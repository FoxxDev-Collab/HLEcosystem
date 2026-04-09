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

## Security practices in the codebase

- bcrypt cost factor 12 for password hashing
- httpOnly + SameSite=Lax cookies for sessions
- Parameterized SQL via Prisma tagged templates (no `$queryRawUnsafe` with user input)
- zod validation on all Server Action inputs
- Magic-byte MIME detection and extension blocklist on file uploads
- Audit logging on write operations

## Dependency hygiene

We run `npm audit` and `trivy` against the repo periodically. Contributors are encouraged to do the same before opening PRs that touch `package.json`.
