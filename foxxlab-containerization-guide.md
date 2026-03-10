# FoxxLab Containerization Guide

> **Version:** 1.0 — February 2026
> **Target:** All FoxxLab ecosystem apps under one Podman Compose file
> **Stack:** Next.js standalone + Prisma + PostgreSQL 16 + Authentik + NGINX Proxy Manager
> **Runtime:** Podman with podman-compose (Docker Compose compatible)

---

## Table of Contents

1. [Why One Compose File](#1-why-one-compose-file)
2. [Architecture Overview](#2-architecture-overview)
3. [Prerequisites](#3-prerequisites)
4. [Directory Structure](#4-directory-structure)
5. [The Shared Containerfile](#5-the-shared-containerfile)
6. [The Compose File](#6-the-compose-file)
7. [Environment Configuration](#7-environment-configuration)
8. [NGINX Proxy Manager](#8-nginx-proxy-manager)
9. [PostgreSQL Setup](#9-postgresql-setup)
10. [Authentik Integration](#10-authentik-integration)
11. [Prisma in Containers](#11-prisma-in-containers)
12. [Networking & DNS](#12-networking--dns)
13. [Volume Strategy](#13-volume-strategy)
14. [Health Checks](#14-health-checks)
15. [Building & Deploying](#15-building--deploying)
16. [Development Compose Override](#16-development-compose-override)
17. [Backup Strategy](#17-backup-strategy)
18. [Monitoring & Logs](#18-monitoring--logs)
19. [Troubleshooting](#19-troubleshooting)
20. [Operational Runbook](#20-operational-runbook)

---

## 1. Why One Compose File

### The Case For

A single compose file gives you **one command to bring up your entire ecosystem.** `podman-compose up -d` and every app, the database, the proxy, and auth are all running and networked together. No manually starting six services in the right order, no forgetting that Finance.App needs PostgreSQL to be healthy first.

More importantly, compose handles:

- **Service dependencies** — PostgreSQL starts before any app. Authentik starts before apps that need SSO.
- **Shared networking** — all services can reach each other by container name (`postgres`, `authentik`, `finance-app`). No hardcoded IPs.
- **Unified lifecycle** — `podman-compose down` stops everything cleanly. `podman-compose logs -f finance-app` tails one service. `podman-compose restart health-app` bounces just that app.
- **Reproducibility** — the compose file IS your infrastructure documentation. Anyone (including future-you) can read it and understand the entire stack.

### The Case Against (And Why It Still Works)

The main argument against is "blast radius" — if the compose file breaks, everything goes down. But for a homelab:

- You're the only operator. You're not coordinating deploys across teams.
- Your apps are family tools, not revenue-generating services. A few minutes of downtime while you fix something is fine.
- If a single app misbehaves, you restart just that service. The rest stay up.

The real risk would be coupling all apps into one container. We're not doing that. Each app is its own container with its own image. The compose file just orchestrates them.

---

## 2. Architecture Overview

```
                    ┌─────────────────────────────────────┐
                    │        NGINX Proxy Manager          │
                    │     *.foxxlab.local → containers    │
                    │        Ports: 80, 443, 81           │
                    └──────────────┬──────────────────────┘
                                   │
        ┌──────────┬───────────────┼───────────┬──────────────┐
        ▼          ▼               ▼           ▼              ▼
   ┌─────────┐ ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐
   │Finance  │ │Family   │  │Health   │  │Home     │  │Household │
   │  :3001  │ │Hub:3002 │  │  :3003  │  │  :3004  │  │  :3005   │
   └────┬────┘ └────┬────┘  └────┬────┘  └────┬────┘  └────┬─────┘
        │           │            │            │             │
        └───────────┴────────────┼────────────┴─────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
               ┌────┴─────┐          ┌────────┴───────┐
               │PostgreSQL│          │   Authentik     │
               │  :5432   │          │ Server + Worker │
               │          │          │    + Redis      │
               └──────────┘          └────────────────┘

  Network: foxxlab-net (bridge)
  All containers communicate by service name.
```

### What Lives in Compose

| Service | Image | Purpose |
|---------|-------|---------|
| `postgres` | postgres:16-alpine | Centralized database for all apps |
| `redis` | redis:7-alpine | Authentik session/cache backend |
| `authentik-server` | ghcr.io/goauthentik/server | SSO identity provider (web) |
| `authentik-worker` | ghcr.io/goauthentik/server | Authentik background tasks |
| `nginx-proxy` | jc21/nginx-proxy-manager | Reverse proxy + SSL |
| `finance-app` | Built from source | Finance.App |
| `familyhub-app` | Built from source | FamilyHub.App |
| `health-app` | Built from source | HealthTracker.App |
| `home-app` | Built from source | HomeManager.App |
| `household-app` | Built from source | HouseholdOps.App |
| `dashboard-app` | Built from source | Central dashboard |

---

## 3. Prerequisites

### Podman + podman-compose

```bash
# Rocky Linux 10
sudo dnf install podman podman-compose

# Verify
podman --version        # Should be 5.x+
podman-compose --version
```

### Why Podman Over Docker

- **Daemonless** — no background service eating resources when you're not deploying.
- **Rootless** — containers run as your user, not root. Better security posture.
- **Systemd integration** — generate Quadlet files later if you want auto-start on boot.
- **Docker-compatible** — compose files work as-is. Container images are interchangeable.

### System Requirements

For running the full ecosystem (6 apps + PostgreSQL + Authentik + NGINX):

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 4 GB | 8 GB |
| CPU | 4 cores | 8 cores |
| Storage | 20 GB | 50 GB |

Each Next.js standalone app uses roughly 100-200 MB RAM. PostgreSQL and Authentik are the heavier services.

---

## 4. Directory Structure

```
foxxlab-compose/
├── compose.yaml                    # The main compose file
├── compose.dev.yaml                # Development overrides
├── .env                            # Shared environment variables
├── .env.example                    # Template (committed to git)
│
├── containerfile/
│   └── Containerfile.nextjs        # Shared multi-stage build for all apps
│
├── config/
│   ├── postgres/
│   │   └── init-schemas.sql        # Creates schemas + roles on first boot
│   ├── nginx/
│   │   └── custom.conf             # Any custom NGINX config
│   └── authentik/
│       └── (managed via UI)
│
├── apps/                           # App source code (or git submodules)
│   ├── finance-app/
│   ├── familyhub-app/
│   ├── health-app/
│   ├── home-app/
│   ├── household-app/
│   └── dashboard-app/
│
├── scripts/
│   ├── build-all.sh                # Build all app images
│   ├── backup-db.sh                # PostgreSQL backup
│   └── deploy.sh                   # Full deploy workflow
│
└── volumes/                        # Persistent data (git-ignored)
    ├── postgres-data/
    ├── authentik-media/
    ├── authentik-templates/
    ├── nginx-data/
    ├── nginx-letsencrypt/
    └── redis-data/
```

### Why This Layout

- **`compose.yaml` at the root** — it's the entry point. Everything else supports it.
- **Apps as subdirectories (or git submodules)** — each app is its own repo, pulled into this structure for building. You develop in the app repo, build from compose.
- **Shared Containerfile** — all Next.js apps use the same build pattern. No duplicating Dockerfiles.
- **Config directory** — initialization scripts, custom configs. Mounted read-only into containers.
- **Volumes directory** — persistent data, git-ignored. This is where your database lives.

---

## 5. The Shared Containerfile

Every Next.js app in your ecosystem builds the same way. One Containerfile, parameterized with build args.

```dockerfile
# containerfile/Containerfile.nextjs
# Multi-stage build for Next.js standalone apps with Prisma

# ============================================
# Stage 1: Install dependencies
# ============================================
FROM node:22-alpine AS deps
WORKDIR /app

# Copy package files only (cache layer)
COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci --ignore-scripts && \
    npx prisma generate

# ============================================
# Stage 2: Build the application
# ============================================
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma client was generated in deps stage
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma

# Build-time environment variables (non-sensitive only)
ARG NEXT_PUBLIC_APP_NAME="FoxxLab App"
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ============================================
# Stage 3: Production runtime (minimal)
# ============================================
FROM node:22-alpine AS runner
WORKDIR /app

# Security: run as non-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy only what's needed for standalone
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma client for runtime (Server Actions need it)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

USER nextjs
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
```

### Why This Structure

**Three stages minimize the final image size:**

1. **deps** — installs `node_modules` and generates Prisma client. This layer caches aggressively — it only rebuilds when `package.json` or `prisma/schema.prisma` changes.
2. **builder** — copies source, runs `next build`. This rebuilds when any source file changes.
3. **runner** — copies only the standalone output, Prisma client, and public assets. No `node_modules` (standalone bundles what it needs), no source code, no dev dependencies.

**Result:** Final images are typically 150-250 MB instead of 1+ GB.

**Prisma in the final image:** Server Actions run at request time and need the Prisma client to query PostgreSQL. We copy `.prisma` (the generated client) and `@prisma` (the engine) into the runner stage. The `prisma/` directory is included for potential runtime migrations.

### Health Check Endpoint

Every app needs this route:

```tsx
// src/app/api/health/route.ts
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "healthy", timestamp: new Date().toISOString() });
  } catch {
    return Response.json({ status: "unhealthy" }, { status: 503 });
  }
}
```

This validates both the Node.js process AND the database connection.

---

## 6. The Compose File

```yaml
# compose.yaml
# FoxxLab Ecosystem — All services, one file

# ============================================
#  Reusable YAML anchors for Next.js apps
# ============================================
x-nextjs-app: &nextjs-app
  restart: unless-stopped
  networks:
    - foxxlab-net
  depends_on:
    postgres:
      condition: service_healthy
    authentik-server:
      condition: service_healthy
  environment: &nextjs-env
    NODE_ENV: production
    NEXT_TELEMETRY_DISABLED: "1"
    AUTHENTIK_ISSUER: "https://auth.foxxlab.local/application/o"
  deploy:
    resources:
      limits:
        memory: 512M
      reservations:
        memory: 128M

# ============================================
#  Services
# ============================================
services:

  # ------------------------------------------
  #  PostgreSQL 16 — Centralized Database
  # ------------------------------------------
  postgres:
    image: postgres:16-alpine
    container_name: foxxlab-postgres
    restart: unless-stopped
    networks:
      - foxxlab-net
    ports:
      - "127.0.0.1:5432:5432"        # Localhost only — not exposed to LAN
    environment:
      POSTGRES_DB: foxxlab
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./config/postgres/init-schemas.sql:/docker-entrypoint-initdb.d/01-init-schemas.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d foxxlab"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 256M

  # ------------------------------------------
  #  Redis — Authentik Backend
  # ------------------------------------------
  redis:
    image: redis:7-alpine
    container_name: foxxlab-redis
    restart: unless-stopped
    networks:
      - foxxlab-net
    command: redis-server --save 60 1 --loglevel warning --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 256M

  # ------------------------------------------
  #  Authentik — SSO Identity Provider
  # ------------------------------------------
  authentik-server:
    image: ghcr.io/goauthentik/server:2025.1
    container_name: foxxlab-authentik
    restart: unless-stopped
    command: server
    networks:
      - foxxlab-net
    environment:
      AUTHENTIK_REDIS__HOST: redis
      AUTHENTIK_REDIS__PASSWORD: ${REDIS_PASSWORD}
      AUTHENTIK_POSTGRESQL__HOST: postgres
      AUTHENTIK_POSTGRESQL__USER: ${POSTGRES_USER}
      AUTHENTIK_POSTGRESQL__NAME: authentik
      AUTHENTIK_POSTGRESQL__PASSWORD: ${POSTGRES_PASSWORD}
      AUTHENTIK_SECRET_KEY: ${AUTHENTIK_SECRET_KEY}
    volumes:
      - authentik-media:/media
      - authentik-templates:/templates
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "ak", "healthcheck"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s
    deploy:
      resources:
        limits:
          memory: 1G

  authentik-worker:
    image: ghcr.io/goauthentik/server:2025.1
    container_name: foxxlab-authentik-worker
    restart: unless-stopped
    command: worker
    networks:
      - foxxlab-net
    environment:
      AUTHENTIK_REDIS__HOST: redis
      AUTHENTIK_REDIS__PASSWORD: ${REDIS_PASSWORD}
      AUTHENTIK_POSTGRESQL__HOST: postgres
      AUTHENTIK_POSTGRESQL__USER: ${POSTGRES_USER}
      AUTHENTIK_POSTGRESQL__NAME: authentik
      AUTHENTIK_POSTGRESQL__PASSWORD: ${POSTGRES_PASSWORD}
      AUTHENTIK_SECRET_KEY: ${AUTHENTIK_SECRET_KEY}
    volumes:
      - authentik-media:/media
      - authentik-templates:/templates
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    deploy:
      resources:
        limits:
          memory: 1G

  # ------------------------------------------
  #  NGINX Proxy Manager — Reverse Proxy
  # ------------------------------------------
  nginx-proxy:
    image: jc21/nginx-proxy-manager:latest
    container_name: foxxlab-nginx
    restart: unless-stopped
    networks:
      - foxxlab-net
    ports:
      - "80:80"                       # HTTP
      - "443:443"                     # HTTPS
      - "127.0.0.1:81:81"            # Admin UI — localhost only
    volumes:
      - nginx-data:/data
      - nginx-letsencrypt:/etc/letsencrypt
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:81/api/"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 256M

  # ------------------------------------------
  #  Dashboard — Central Landing Page
  # ------------------------------------------
  dashboard-app:
    <<: *nextjs-app
    container_name: foxxlab-dashboard
    build:
      context: ./apps/dashboard-app
      dockerfile: ../../containerfile/Containerfile.nextjs
      args:
        NEXT_PUBLIC_APP_NAME: "FoxxLab Dashboard"
    environment:
      <<: *nextjs-env
      PORT: "3000"
      HOSTNAME: "0.0.0.0"
      DATABASE_URL: "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/foxxlab?schema=dashboard"
      NEXTAUTH_URL: "https://dashboard.foxxlab.local"
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      AUTHENTIK_CLIENT_ID: "dashboard-app"
      AUTHENTIK_CLIENT_SECRET: ${DASHBOARD_AUTHENTIK_SECRET}

  # ------------------------------------------
  #  Finance.App
  # ------------------------------------------
  finance-app:
    <<: *nextjs-app
    container_name: foxxlab-finance
    build:
      context: ./apps/finance-app
      dockerfile: ../../containerfile/Containerfile.nextjs
      args:
        NEXT_PUBLIC_APP_NAME: "FoxxLab Finance"
    environment:
      <<: *nextjs-env
      PORT: "3000"
      HOSTNAME: "0.0.0.0"
      DATABASE_URL: "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/foxxlab?schema=finance"
      NEXTAUTH_URL: "https://finance.foxxlab.local"
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      AUTHENTIK_CLIENT_ID: "finance-app"
      AUTHENTIK_CLIENT_SECRET: ${FINANCE_AUTHENTIK_SECRET}

  # ------------------------------------------
  #  FamilyHub.App
  # ------------------------------------------
  familyhub-app:
    <<: *nextjs-app
    container_name: foxxlab-familyhub
    build:
      context: ./apps/familyhub-app
      dockerfile: ../../containerfile/Containerfile.nextjs
      args:
        NEXT_PUBLIC_APP_NAME: "FoxxLab FamilyHub"
    environment:
      <<: *nextjs-env
      PORT: "3000"
      HOSTNAME: "0.0.0.0"
      DATABASE_URL: "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/foxxlab?schema=familyhub"
      NEXTAUTH_URL: "https://familyhub.foxxlab.local"
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      AUTHENTIK_CLIENT_ID: "familyhub-app"
      AUTHENTIK_CLIENT_SECRET: ${FAMILYHUB_AUTHENTIK_SECRET}

  # ------------------------------------------
  #  HealthTracker.App
  # ------------------------------------------
  health-app:
    <<: *nextjs-app
    container_name: foxxlab-health
    build:
      context: ./apps/health-app
      dockerfile: ../../containerfile/Containerfile.nextjs
      args:
        NEXT_PUBLIC_APP_NAME: "FoxxLab HealthTracker"
    environment:
      <<: *nextjs-env
      PORT: "3000"
      HOSTNAME: "0.0.0.0"
      DATABASE_URL: "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/foxxlab?schema=health"
      NEXTAUTH_URL: "https://health.foxxlab.local"
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      AUTHENTIK_CLIENT_ID: "health-app"
      AUTHENTIK_CLIENT_SECRET: ${HEALTH_AUTHENTIK_SECRET}

  # ------------------------------------------
  #  HomeManager.App
  # ------------------------------------------
  home-app:
    <<: *nextjs-app
    container_name: foxxlab-home
    build:
      context: ./apps/home-app
      dockerfile: ../../containerfile/Containerfile.nextjs
      args:
        NEXT_PUBLIC_APP_NAME: "FoxxLab HomeManager"
    environment:
      <<: *nextjs-env
      PORT: "3000"
      HOSTNAME: "0.0.0.0"
      DATABASE_URL: "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/foxxlab?schema=home"
      NEXTAUTH_URL: "https://home.foxxlab.local"
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      AUTHENTIK_CLIENT_ID: "home-app"
      AUTHENTIK_CLIENT_SECRET: ${HOME_AUTHENTIK_SECRET}

  # ------------------------------------------
  #  HouseholdOps.App
  # ------------------------------------------
  household-app:
    <<: *nextjs-app
    container_name: foxxlab-household
    build:
      context: ./apps/household-app
      dockerfile: ../../containerfile/Containerfile.nextjs
      args:
        NEXT_PUBLIC_APP_NAME: "FoxxLab HouseholdOps"
    environment:
      <<: *nextjs-env
      PORT: "3000"
      HOSTNAME: "0.0.0.0"
      DATABASE_URL: "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/foxxlab?schema=household"
      NEXTAUTH_URL: "https://household.foxxlab.local"
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      AUTHENTIK_CLIENT_ID: "household-app"
      AUTHENTIK_CLIENT_SECRET: ${HOUSEHOLD_AUTHENTIK_SECRET}

# ============================================
#  Networks
# ============================================
networks:
  foxxlab-net:
    driver: bridge
    name: foxxlab-net

# ============================================
#  Volumes (persistent data)
# ============================================
volumes:
  postgres-data:
    name: foxxlab-postgres-data
  redis-data:
    name: foxxlab-redis-data
  authentik-media:
    name: foxxlab-authentik-media
  authentik-templates:
    name: foxxlab-authentik-templates
  nginx-data:
    name: foxxlab-nginx-data
  nginx-letsencrypt:
    name: foxxlab-nginx-letsencrypt
```

### Key Design Decisions Explained

**YAML anchors (`x-nextjs-app`, `&nextjs-app`, `<<: *nextjs-app`):** Every Next.js app shares the same restart policy, network, dependencies, and resource limits. Instead of copying 15 lines per service, the anchor defines it once and every app merges it in. When you need to change the memory limit for all apps, you change it in one place.

**Every app listens on port 3000 internally.** Containers have their own network namespace. There's no port conflict because each container thinks it's the only thing running. NGINX Proxy Manager routes by hostname, not port — `finance.foxxlab.local` → `finance-app:3000`, `health.foxxlab.local` → `health-app:3000`.

**No published ports for apps.** Notice the app services don't have `ports:` entries. They're only accessible through NGINX Proxy Manager on the compose network. This is intentional — the proxy handles SSL termination, and apps don't need direct exposure.

**`HOSTNAME: "0.0.0.0"`** is required for Next.js standalone inside containers. Without it, the server binds to `127.0.0.1` and other containers can't reach it.

**PostgreSQL port is `127.0.0.1:5432:5432`.** Bound to localhost only — accessible from the host for Prisma Studio and migrations, but not exposed to the LAN. Inside the compose network, apps reach it via `postgres:5432`.

**NGINX Proxy Manager admin on `127.0.0.1:81`.** Same principle. Admin panel is only accessible from the host machine.

---

## 7. Environment Configuration

### The `.env` File

```bash
# .env — Shared secrets for compose
# NEVER commit this file. Commit .env.example instead.

# ── PostgreSQL ──
POSTGRES_USER=foxxlab_admin
POSTGRES_PASSWORD=generate-a-strong-password-here

# ── Redis ──
REDIS_PASSWORD=generate-another-strong-password

# ── Authentik ──
AUTHENTIK_SECRET_KEY=generate-a-64-char-random-string

# ── NextAuth (shared across all apps) ──
NEXTAUTH_SECRET=generate-a-32-char-random-string

# ── Per-App Authentik Client Secrets ──
# (Generated when you create each app in Authentik UI)
DASHBOARD_AUTHENTIK_SECRET=
FINANCE_AUTHENTIK_SECRET=
FAMILYHUB_AUTHENTIK_SECRET=
HEALTH_AUTHENTIK_SECRET=
HOME_AUTHENTIK_SECRET=
HOUSEHOLD_AUTHENTIK_SECRET=
```

### Generating Secrets

```bash
# 64-character random string (for AUTHENTIK_SECRET_KEY)
openssl rand -base64 48

# 32-character random string (for NEXTAUTH_SECRET, passwords)
openssl rand -base64 24

# Generate all secrets at once
cat > .env << 'EOF'
POSTGRES_USER=foxxlab_admin
POSTGRES_PASSWORD=$(openssl rand -base64 24)
REDIS_PASSWORD=$(openssl rand -base64 24)
AUTHENTIK_SECRET_KEY=$(openssl rand -base64 48)
NEXTAUTH_SECRET=$(openssl rand -base64 24)
DASHBOARD_AUTHENTIK_SECRET=
FINANCE_AUTHENTIK_SECRET=
FAMILYHUB_AUTHENTIK_SECRET=
HEALTH_AUTHENTIK_SECRET=
HOME_AUTHENTIK_SECRET=
HOUSEHOLD_AUTHENTIK_SECRET=
EOF
```

### Why Shared `NEXTAUTH_SECRET`

All apps use the same Authentik as their identity provider, and the `NEXTAUTH_SECRET` is used to encrypt the session JWT. Using the same secret across apps means a session token is valid across all of them — true SSO behavior. If you wanted strict isolation (each app has its own session), use different secrets.

---

## 8. NGINX Proxy Manager

### Why NPM Over Raw NGINX

NGINX Proxy Manager gives you a web UI for managing proxy hosts, SSL certificates, and access lists. For a homelab where you're adding apps over time, this is faster than editing nginx config files.

### Initial Setup

After `podman-compose up -d`, access the admin panel at `http://localhost:81`:

- **Default login:** `admin@example.com` / `changeme`
- **Change immediately** on first login.

### Adding Proxy Hosts

For each app, create a Proxy Host:

| Domain | Scheme | Forward Host | Forward Port | SSL |
|--------|--------|-------------|-------------|-----|
| `dashboard.foxxlab.local` | http | `foxxlab-dashboard` | 3000 | Let's Encrypt or custom |
| `finance.foxxlab.local` | http | `foxxlab-finance` | 3000 | Let's Encrypt or custom |
| `familyhub.foxxlab.local` | http | `foxxlab-familyhub` | 3000 | Let's Encrypt or custom |
| `health.foxxlab.local` | http | `foxxlab-health` | 3000 | Let's Encrypt or custom |
| `home.foxxlab.local` | http | `foxxlab-home` | 3000 | Let's Encrypt or custom |
| `household.foxxlab.local` | http | `foxxlab-household` | 3000 | Let's Encrypt or custom |
| `auth.foxxlab.local` | http | `foxxlab-authentik` | 9000 | Let's Encrypt or custom |

**Forward hostname** uses the container name (set by `container_name:` in compose). Since they're on the same network, NGINX can resolve them by name.

### WebSocket Support

In the "Custom Locations" or "Advanced" tab for each proxy host, add:

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

Next.js uses WebSockets for HMR in development and potentially for real-time features.

### SSL for `.local` Domains

Let's Encrypt doesn't issue certificates for `.local` domains. Options:

1. **Self-signed certificates** — Create in NPM, accept the browser warning. Fine for homelab.
2. **Internal CA** — If you have an OPNsense CA or your own, import those certs into NPM.
3. **Use a real domain** — If you own `foxxlab.com`, use `finance.foxxlab.com` with DNS challenge for Let's Encrypt. Your Pangolin tunnel setup could support this.

---

## 9. PostgreSQL Setup

### Schema Initialization

This script runs automatically on first boot (mounted into `docker-entrypoint-initdb.d/`):

```sql
-- config/postgres/init-schemas.sql
-- Creates separate schemas and roles for each app

-- Authentik gets its own database
CREATE DATABASE authentik;

-- App schemas (all within the 'foxxlab' database)
CREATE SCHEMA IF NOT EXISTS dashboard;
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS familyhub;
CREATE SCHEMA IF NOT EXISTS health;
CREATE SCHEMA IF NOT EXISTS home;
CREATE SCHEMA IF NOT EXISTS household;

-- If you want per-app database roles (recommended for isolation):
-- Uncomment and set passwords. Apps would use these instead of the admin user.
--
-- CREATE ROLE dashboard_app LOGIN PASSWORD 'dashboard_password';
-- GRANT USAGE ON SCHEMA dashboard TO dashboard_app;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA dashboard TO dashboard_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA dashboard GRANT ALL ON TABLES TO dashboard_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA dashboard GRANT ALL ON SEQUENCES TO dashboard_app;
--
-- Repeat for each app...

-- For simplicity in homelab, the admin user accessing specific schemas
-- via the ?schema= URL parameter works fine. Per-app roles add security
-- but also complexity in secret management.

-- Grant the admin user access to all schemas
GRANT ALL PRIVILEGES ON SCHEMA dashboard TO foxxlab_admin;
GRANT ALL PRIVILEGES ON SCHEMA finance TO foxxlab_admin;
GRANT ALL PRIVILEGES ON SCHEMA familyhub TO foxxlab_admin;
GRANT ALL PRIVILEGES ON SCHEMA health TO foxxlab_admin;
GRANT ALL PRIVILEGES ON SCHEMA home TO foxxlab_admin;
GRANT ALL PRIVILEGES ON SCHEMA household TO foxxlab_admin;
```

### Per-App Roles vs Shared Admin

The compose file uses the shared admin user with `?schema=` in the connection URL for simplicity. This means all apps technically have access to all schemas through the same credentials.

**For a homelab, this is a pragmatic trade-off.** You're the only developer, the apps are behind auth, and the complexity of managing six database passwords isn't worth the marginal security gain.

**If you want stricter isolation later**, uncomment the per-app role section in `init-schemas.sql` and update each app's `DATABASE_URL` to use its own role. Prisma doesn't care — it just needs a valid connection string.

### Connecting from the Host

For running Prisma Studio, migrations during development, or manual queries:

```bash
# Prisma Studio (from any app directory)
DATABASE_URL="postgresql://foxxlab_admin:password@localhost:5432/foxxlab?schema=finance" npx prisma studio

# psql
psql -h localhost -U foxxlab_admin -d foxxlab
```

This works because PostgreSQL is published on `127.0.0.1:5432`.

---

## 10. Authentik Integration

### First Boot

1. Start the stack: `podman-compose up -d postgres redis authentik-server authentik-worker`
2. Wait for Authentik to be healthy: `podman-compose logs -f authentik-server`
3. Access the initial setup: `https://auth.foxxlab.local/if/flow/initial-setup/`
4. Create your admin account.

### Creating an App in Authentik

For each FoxxLab app, repeat:

1. **Go to:** Admin → Applications → Providers → Create
2. **Provider type:** OAuth2/OIDC
3. **Name:** `finance-app` (matches `AUTHENTIK_CLIENT_ID`)
4. **Authorization flow:** default-provider-authorization-explicit-consent
5. **Redirect URI:** `https://finance.foxxlab.local/api/auth/callback/authentik`
6. **Signing Key:** Select your default signing key
7. **Scopes:** `openid`, `profile`, `email`
8. **Copy the Client Secret** → paste into `.env` as `FINANCE_AUTHENTIK_SECRET`

Then create the Application:

1. **Admin → Applications → Create**
2. **Name:** Finance App
3. **Slug:** `finance-app`
4. **Provider:** Select the provider you just created
5. **Launch URL:** `https://finance.foxxlab.local`

### Authentik Issuer URL Pattern

Each app's `AUTHENTIK_ISSUER` in Auth.js should be:

```
https://auth.foxxlab.local/application/o/{slug}/
```

So for Finance.App: `https://auth.foxxlab.local/application/o/finance-app/`

---

## 11. Prisma in Containers

### The Migration Problem

Prisma migrations need to run against the database before the app starts. There are two approaches:

**Option A: Run migrations at build time (not recommended)**
Migrations depend on the database being available. During `podman-compose build`, PostgreSQL isn't running. This doesn't work.

**Option B: Run migrations as part of the container startup (recommended)**

Modify the CMD in your Containerfile or use an entrypoint script:

```bash
#!/bin/sh
# scripts/entrypoint.sh

# Run pending migrations
npx prisma migrate deploy

# Start the app
exec node server.js
```

Update the Containerfile's final stage:

```dockerfile
# Add to the runner stage
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY scripts/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

CMD ["./entrypoint.sh"]
```

Or, if you prefer to keep the Containerfile clean, run migrations manually after deploy:

```bash
# After podman-compose up -d
podman exec foxxlab-finance npx prisma migrate deploy
podman exec foxxlab-familyhub npx prisma migrate deploy
# ... etc
```

### Prisma Generate at Build Time

The Containerfile already handles this. `npx prisma generate` runs in the deps stage, and the generated client is copied into the builder and runner stages. No runtime generation needed.

---

## 12. Networking & DNS

### Compose Network

All services share `foxxlab-net`. Within this network:

- Apps reach PostgreSQL at `postgres:5432`
- Apps reach Authentik at `authentik-server:9000`
- NGINX reaches apps at `{container_name}:3000`
- Apps can reach each other by container name (for cross-app API calls if needed)

### DNS Resolution

For `*.foxxlab.local` to resolve to your host machine, configure your DNS:

**Option A: Split-horizon DNS (OPNsense / UDR 7)**
```
*.foxxlab.local → 192.168.x.x (your host IP)
```

**Option B: `/etc/hosts` on client machines**
```
192.168.x.x  dashboard.foxxlab.local
192.168.x.x  finance.foxxlab.local
192.168.x.x  familyhub.foxxlab.local
192.168.x.x  health.foxxlab.local
192.168.x.x  home.foxxlab.local
192.168.x.x  household.foxxlab.local
192.168.x.x  auth.foxxlab.local
```

**Option C: Wildcard DNS on your router**
If your router supports it, a single wildcard entry `*.foxxlab.local → host IP` handles everything — no per-app entries needed.

---

## 13. Volume Strategy

### Named Volumes vs Bind Mounts

The compose file uses **named volumes** for persistent data (PostgreSQL, Redis, NGINX, Authentik). Named volumes are managed by Podman — they're stored in a standard location, survive container removal, and are easy to back up.

Bind mounts are used only for **read-only configuration** (init scripts, custom configs).

| Volume | Contains | Backup Priority |
|--------|----------|-----------------|
| `postgres-data` | All app data, Authentik data | **Critical** |
| `redis-data` | Authentik sessions/cache | Low (ephemeral) |
| `nginx-data` | Proxy host configs, access lists | Medium |
| `nginx-letsencrypt` | SSL certificates | Medium |
| `authentik-media` | Uploaded icons, branding | Low |
| `authentik-templates` | Custom email templates | Low |

### Where Volumes Live

```bash
# Find volume location
podman volume inspect foxxlab-postgres-data --format '{{.Mountpoint}}'

# Typically: ~/.local/share/containers/storage/volumes/foxxlab-postgres-data/_data
```

---

## 14. Health Checks

Every service in the compose file has a health check. This matters because:

- `depends_on: { condition: service_healthy }` means apps won't start until PostgreSQL is actually accepting connections — not just when the container is "up."
- NGINX Proxy Manager can monitor backend health.
- `podman-compose ps` shows you at a glance which services are healthy.

### Health Check Summary

| Service | Check | Interval | Start Period |
|---------|-------|----------|-------------|
| PostgreSQL | `pg_isready` | 10s | 30s |
| Redis | `redis-cli ping` | 10s | — |
| Authentik | `ak healthcheck` | 30s | 60s |
| NGINX PM | `curl localhost:81/api/` | 30s | — |
| Each App | `wget localhost:3000/api/health` | 30s | 10s |

The **start period** is important — it tells Podman "don't count failures during this window." PostgreSQL needs time to initialize on first boot, and Authentik needs even longer.

---

## 15. Building & Deploying

### Build All Apps

```bash
#!/bin/bash
# scripts/build-all.sh

set -e

echo "Building all FoxxLab apps..."

podman-compose build \
  dashboard-app \
  finance-app \
  familyhub-app \
  health-app \
  home-app \
  household-app

echo "Build complete."
```

### Build a Single App

```bash
# Rebuild only finance-app (after code changes)
podman-compose build finance-app

# Recreate the container with new image
podman-compose up -d finance-app
```

### Full Deploy Workflow

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

echo "=== FoxxLab Full Deploy ==="

# 1. Pull latest images for infrastructure
podman-compose pull postgres redis authentik-server nginx-proxy

# 2. Build all app images
podman-compose build

# 3. Start/update everything
podman-compose up -d

# 4. Run migrations for each app
echo "Running database migrations..."
for app in dashboard finance familyhub health home household; do
  echo "  Migrating ${app}..."
  podman exec foxxlab-${app} npx prisma migrate deploy 2>/dev/null || \
    echo "  Warning: Migration for ${app} skipped (may not have pending migrations)"
done

# 5. Health check
echo "Waiting for services to be healthy..."
sleep 10
podman-compose ps

echo "=== Deploy complete ==="
```

### Updating a Single App

The common workflow when you've made changes to Finance.App:

```bash
cd foxxlab-compose

# Rebuild just the finance image
podman-compose build finance-app

# Restart just finance (zero downtime for other apps)
podman-compose up -d --no-deps finance-app

# Run migrations if schema changed
podman exec foxxlab-finance npx prisma migrate deploy
```

`--no-deps` prevents compose from also restarting PostgreSQL and Authentik (which finance depends on). They're already running.

---

## 16. Development Compose Override

For local development, you want hot reload — not rebuilt images. The override file layers on top of the main compose:

```yaml
# compose.dev.yaml
# Usage: podman-compose -f compose.yaml -f compose.dev.yaml up

services:
  # Override apps with bind-mounted source for hot reload
  finance-app:
    build: !reset null
    image: node:22-alpine
    working_dir: /app
    command: sh -c "npm install && npx prisma generate && npm run dev"
    volumes:
      - ./apps/finance-app:/app
      - finance-node-modules:/app/node_modules  # Persist node_modules
    environment:
      NODE_ENV: development
      PORT: "3000"
      HOSTNAME: "0.0.0.0"
      DATABASE_URL: "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/foxxlab?schema=finance"
      NEXTAUTH_URL: "http://localhost:3001"
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      AUTHENTIK_CLIENT_ID: "finance-app"
      AUTHENTIK_CLIENT_SECRET: ${FINANCE_AUTHENTIK_SECRET}
    ports:
      - "3001:3000"  # Expose directly for dev access

  # Add dev overrides for other apps as needed...

volumes:
  finance-node-modules:
```

### Running in Dev Mode

```bash
# Start infrastructure + finance in dev mode
podman-compose -f compose.yaml -f compose.dev.yaml up -d postgres redis authentik-server finance-app
```

Or more commonly, just run the infrastructure in compose and develop apps directly on the host:

```bash
# Start only infrastructure
podman-compose up -d postgres redis authentik-server authentik-worker nginx-proxy

# Develop on host
cd apps/finance-app
DATABASE_URL="postgresql://foxxlab_admin:pass@localhost:5432/foxxlab?schema=finance" npm run dev
```

This is usually simpler and faster. The compose dev override is useful when you need the full stack running with inter-service communication.

---

## 17. Backup Strategy

### PostgreSQL Backups

```bash
#!/bin/bash
# scripts/backup-db.sh

BACKUP_DIR="./backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# Dump the entire foxxlab database (all schemas)
podman exec foxxlab-postgres pg_dump \
  -U foxxlab_admin \
  -d foxxlab \
  --format=custom \
  --file=/tmp/foxxlab_${TIMESTAMP}.dump

# Copy from container to host
podman cp foxxlab-postgres:/tmp/foxxlab_${TIMESTAMP}.dump \
  "${BACKUP_DIR}/foxxlab_${TIMESTAMP}.dump"

# Also dump Authentik's database
podman exec foxxlab-postgres pg_dump \
  -U foxxlab_admin \
  -d authentik \
  --format=custom \
  --file=/tmp/authentik_${TIMESTAMP}.dump

podman cp foxxlab-postgres:/tmp/authentik_${TIMESTAMP}.dump \
  "${BACKUP_DIR}/authentik_${TIMESTAMP}.dump"

# Cleanup old backups (keep last 7 days)
find "$BACKUP_DIR" -name "*.dump" -mtime +7 -delete

echo "Backup complete: ${BACKUP_DIR}/*_${TIMESTAMP}.dump"
```

### Automate with cron

```bash
# Run daily at 2 AM
crontab -e
0 2 * * * /path/to/foxxlab-compose/scripts/backup-db.sh >> /var/log/foxxlab-backup.log 2>&1
```

### Restoring

```bash
# Restore foxxlab database
podman cp backup.dump foxxlab-postgres:/tmp/backup.dump
podman exec foxxlab-postgres pg_restore \
  -U foxxlab_admin \
  -d foxxlab \
  --clean \
  --if-exists \
  /tmp/backup.dump
```

### Volume Backups

For NGINX config and Authentik media:

```bash
# Export a named volume to a tar
podman volume export foxxlab-nginx-data > backups/nginx-data.tar
podman volume export foxxlab-authentik-media > backups/authentik-media.tar
```

---

## 18. Monitoring & Logs

### Viewing Logs

```bash
# All services
podman-compose logs -f

# Single service
podman-compose logs -f finance-app

# Last 100 lines
podman-compose logs --tail 100 postgres

# Multiple services
podman-compose logs -f finance-app familyhub-app postgres
```

### Service Status

```bash
# Overview with health status
podman-compose ps

# Resource usage
podman stats --no-stream
```

### Simple Log Rotation

Podman uses journald by default on systems with systemd. For compose-managed containers, add to your Podman configuration:

```bash
# ~/.config/containers/containers.conf
[containers]
log_driver = "journald"
log_size_max = "10m"
```

### Wazuh Integration

If you want to feed container logs into your Wazuh SIEM:

```bash
# Wazuh can monitor journald, which captures Podman container logs
# Add to /var/ossec/etc/ossec.conf on the Wazuh agent:
<localfile>
  <log_format>journald</log_format>
  <location>CONTAINER_NAME=foxxlab-*</location>
</localfile>
```

---

## 19. Troubleshooting

### Common Issues

**"Connection refused" from app to PostgreSQL:**
PostgreSQL isn't healthy yet. Check `podman-compose ps` — is postgres showing "healthy"? If it's stuck in "starting," check logs: `podman-compose logs postgres`. Most common cause: bad password in `.env`.

**"ECONNREFUSED" in Next.js for Authentik:**
The app is trying to reach Authentik before it's ready. Authentik takes 30-60 seconds to start. The `depends_on: condition: service_healthy` should handle this, but if you're seeing it during initial setup, just wait and refresh.

**Build fails with "prisma generate" errors:**
Make sure `prisma/schema.prisma` is in your app directory and the datasource URL uses an environment variable (`env("DATABASE_URL")`). Prisma generate doesn't need a running database — it only reads the schema file.

**"Port already in use":**
Another service is using port 80, 443, or 5432. Check with `ss -tlnp | grep :80`. Stop the conflicting service or adjust ports in compose.

**App builds but shows blank page:**
Missing `HOSTNAME: "0.0.0.0"` in the environment. Without it, Next.js standalone binds to localhost inside the container, unreachable from other containers.

### Debugging a Container

```bash
# Shell into a running container
podman exec -it foxxlab-finance sh

# Check if the app can reach postgres
wget -q -O- http://postgres:5432 || echo "Connection check done"

# Check environment variables
podman exec foxxlab-finance env | grep DATABASE

# Check if the app process is running
podman exec foxxlab-finance ps aux
```

### Nuclear Reset

```bash
# Stop everything and remove containers
podman-compose down

# Also remove volumes (DESTROYS ALL DATA)
podman-compose down -v

# Clean up dangling images
podman image prune -f

# Start fresh
podman-compose up -d
```

---

## 20. Operational Runbook

### Daily Operations

| Task | Command |
|------|---------|
| Check all services | `podman-compose ps` |
| View recent logs | `podman-compose logs --tail 50` |
| Restart a crashing app | `podman-compose restart finance-app` |

### Weekly Operations

| Task | Command |
|------|---------|
| Database backup | `./scripts/backup-db.sh` |
| Check disk usage | `podman system df` |
| Update infrastructure images | `podman-compose pull` |

### Deploying App Updates

```bash
# Single app update
podman-compose build finance-app
podman-compose up -d --no-deps finance-app

# Full ecosystem update
./scripts/deploy.sh
```

### Adding a New App

1. Clone the template into `apps/new-app/`
2. Add the service to `compose.yaml` (copy an existing app block, change names)
3. Add the schema to `config/postgres/init-schemas.sql`
4. Create the Authentik provider + application
5. Add the Authentik secret to `.env`
6. Create the proxy host in NGINX Proxy Manager
7. Add DNS entry for `newapp.foxxlab.local`
8. `podman-compose build new-app && podman-compose up -d new-app`

### Emergency: Rolling Back

```bash
# If a new build broke finance-app, tag images before deploying:
podman tag foxxlab-compose_finance-app:latest foxxlab-compose_finance-app:rollback-$(date +%Y%m%d)

# To rollback:
podman tag foxxlab-compose_finance-app:rollback-20260206 foxxlab-compose_finance-app:latest
podman-compose up -d --no-deps finance-app
```

---

## Appendix A: Complete `.env.example`

```bash
# ── Database ──
POSTGRES_USER=foxxlab_admin
POSTGRES_PASSWORD=

# ── Redis ──
REDIS_PASSWORD=

# ── Authentik ──
AUTHENTIK_SECRET_KEY=

# ── NextAuth (shared) ──
NEXTAUTH_SECRET=

# ── Per-App Authentik Secrets ──
# Create each in Authentik UI → copy Client Secret here
DASHBOARD_AUTHENTIK_SECRET=
FINANCE_AUTHENTIK_SECRET=
FAMILYHUB_AUTHENTIK_SECRET=
HEALTH_AUTHENTIK_SECRET=
HOME_AUTHENTIK_SECRET=
HOUSEHOLD_AUTHENTIK_SECRET=
```

## Appendix B: Systemd Auto-Start

To have the compose stack start on boot:

```bash
# Generate a systemd service for the compose stack
podman-compose systemd --action create-unit

# Or manually create:
cat > ~/.config/systemd/user/foxxlab-compose.service << 'EOF'
[Unit]
Description=FoxxLab Compose Stack
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/path/to/foxxlab-compose
ExecStart=/usr/bin/podman-compose up -d
ExecStop=/usr/bin/podman-compose down
TimeoutStartSec=300

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable foxxlab-compose.service
loginctl enable-linger $(whoami)  # Keep user services running after logout
```

## Appendix C: Resource Planning

### Estimated Memory Usage (Steady State)

| Service | Memory |
|---------|--------|
| PostgreSQL | 200–500 MB |
| Redis | 50–100 MB |
| Authentik Server | 400–600 MB |
| Authentik Worker | 300–500 MB |
| NGINX Proxy Manager | 50–100 MB |
| Each Next.js App (×6) | 100–200 MB each |
| **Total** | **~2.5–4 GB** |

This fits comfortably on a host with 8 GB RAM, leaving headroom for the OS and other services.

---

*Companion to the Next.js Best Practices Guide (v3.0). Covers full ecosystem containerization for FoxxLab using Podman Compose.*
