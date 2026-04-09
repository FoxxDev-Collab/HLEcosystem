# ADR-0002: Podman over Docker for container runtime

**Status:** Accepted
**Date:** 2025-11-14 (retroactively documented 2026-04-08)
**Deciders:** Jeremiah Price

## Context

HLEcosystem ships as a set of containerized Next.js applications. We needed a container runtime for both local development and production deployment. The production target is RHEL 9 / Rocky Linux 9 — the same platform that hosts Foxx Cyber LLC's commercial compliance products — where Docker is not the native choice.

## Options considered

### Option A — Docker + docker-compose

- ✅ Ubiquitous, huge documentation pool
- ✅ Developer familiarity
- ❌ Requires a long-running root daemon (`dockerd`) — STIG findings on RHEL production
- ❌ Licensing uncertainty for larger deployments (Docker Desktop)
- ❌ Not the native container stack on RHEL 9; extra repo and support burden
- ❌ Root daemon increases blast radius of a container escape

### Option B — Podman + podman-compose (chosen)

- ✅ Daemonless and rootless-capable — a compromised container cannot escalate to host root as easily
- ✅ Native on RHEL 9 / Rocky / Alma — shipped in the base distro
- ✅ Drop-in compatible CLI: `alias docker=podman` works for almost everything
- ✅ OCI-compliant images, pulls from Docker Hub and Quay without modification
- ✅ No licensing friction
- ✅ Compose v3 compatibility via `podman-compose`
- ❌ Smaller community, slightly more rough edges
- ❌ Some third-party tooling still assumes `docker` binary

### Option C — Kubernetes (k3s or similar)

- ✅ Production-grade orchestration
- ❌ Wildly over-engineered for a self-hosted family deployment
- ❌ Operational complexity far exceeds what HLEcosystem's target user will manage

## Decision

We use **Podman + podman-compose** for both development and production. The project explicitly does **not** support Docker — contributors who want to use Docker can, since the CLI is compatible, but CI, documentation, and support are Podman-first.

## Consequences

### Positive

- Matches the production target (RHEL 9) natively
- Rootless execution by default reduces attack surface
- No long-running daemon to harden
- SELinux policies integrate cleanly with Podman
- Container runtime is governed by a clear open-source foundation, not a single vendor

### Negative

- Contributors on macOS need Podman Desktop, which is less polished than Docker Desktop
- Some documentation snippets online reference `docker` commands that need translation
- `podman-compose` has had intermittent gaps compared to `docker compose` v2; we have pinned to a version that works

## Enforcement

- `CLAUDE.md` states explicitly: "Do not install Docker — use Podman"
- The container management wrapper `hle.sh` invokes `podman-compose` directly
- `Containerfile.nextjs` (not `Dockerfile`) signals the preferred tool
- PRs referencing `docker run` or `docker-compose` in documentation are updated during review
