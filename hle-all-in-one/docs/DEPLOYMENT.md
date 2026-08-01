# Deploying hle-all-in-one

How to run this on your own hardware. Everything here assumes the published
image (`ghcr.io/foxxdev-collab/hle-aio`) and [`compose.release.yaml`](../compose.release.yaml);
building from source works the same way with the dev `compose.yaml`.

## What you need

- Podman (with `podman-compose`) or Docker with compose. Rootless is fine.
- ~1 GB RAM headroom for the app + database.
- Somewhere for the volumes to live (database, uploads, backups).
- **A TLS front door before anyone reaches it from outside your LAN** — see
  [Exposing it](#exposing-it-tls-is-not-optional).

## Install

```bash
mkdir hle && cd hle
curl -LO https://raw.githubusercontent.com/FoxxDev-Collab/HLEcosystem/master/hle-all-in-one/compose.release.yaml
printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 24)" > .env
podman-compose -f compose.release.yaml up -d
```

Then open `http://<host>:8100`. A fresh instance routes you to the **/setup
wizard**: it asks for the setup token from the logs —

```bash
podman logs hle-aio | grep -A2 "First-run setup"
```

— then creates your admin account and first household and signs you in. The
wizard permanently deactivates itself the moment the first user exists
(enforced in SQL, not just by redirect; see ADR-0006 in the repo's
`docs/adr/`). Set `SETUP_TOKEN` in `.env` beforehand if you want a fixed
token for automated provisioning.

On boot the container applies database migrations before serving and refuses
to start against a schema newer than itself, and a supervised background
scheduler starts alongside the server (backups, session pruning, recurring
transactions).

## Exposing it (TLS is not optional)

The app serves plain HTTP on port 8100 and its session cookie is marked
`Secure` — over remote plain HTTP, browsers silently drop it and **login
breaks**. That is by design: put a TLS-terminating proxy in front and point
it at `127.0.0.1:8100`. Any of these work:

**Caddy** (easiest — automatic certificates):

```
hle.example.com {
    reverse_proxy 127.0.0.1:8100
}
```

**nginx**:

```nginx
server {
    listen 443 ssl;
    server_name hle.example.com;
    # ssl_certificate / ssl_certificate_key via certbot or your CA
    add_header Strict-Transport-Security "max-age=31536000" always;
    location / {
        proxy_pass http://127.0.0.1:8100;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        client_max_body_size 64m;   # match MAX_FILE_SIZE_MB + slack
    }
}
```

**Cloudflare Tunnel** (no open inbound ports):

```bash
cloudflared tunnel create hle
cloudflared tunnel route dns hle hle.example.com
# config.yml: service: http://127.0.0.1:8100
cloudflared tunnel run hle
```

Notes:

- Forward `X-Forwarded-For` (as above). The app uses it for login throttling
  and audit records — advisory data, never an auth decision.
- Set HSTS at the proxy (shown in the nginx block; Caddy does it via its
  `header` directive; Cloudflare in the dashboard).
- `COOKIE_SECURE=false` exists **only** for LAN-only instances accessed over
  plain `http://<ip>:8100`. If the instance is reachable from the internet,
  never set it — fix the TLS instead.
- Do not publish port 8100 itself to the internet (don't port-forward it,
  keep it firewalled; the proxy is the only public entrance).

## Backups

Automatic: the scheduler writes a `pg_dump` custom-format dump into the
`hle-aio-backups` volume daily (`BACKUP_INTERVAL_HOURS`), keeping the newest
7 (`BACKUP_RETENTION`). Copy them off the host — a backup on the same disk
as the database is a convenience, not disaster recovery:

```bash
podman cp hle-aio:/data/backups ./offsite-copy
```

Manual: Manager → Settings (admin) downloads the same dump plus a tar of all
file uploads. The full restore runbook is in the
[README "Backup & migration"](../README.md#backup--migration) section — dumps
restore with `pg_restore` on any machine with PostgreSQL 18.

The dump contains every household's data and credential hashes. Treat backup
files like the database itself.

## Upgrades

```bash
podman-compose -f compose.release.yaml pull hle-aio
podman-compose -f compose.release.yaml up -d hle-aio
```

Migrations run automatically on boot; a failed migration aborts startup
instead of serving a half-migrated schema, and a checksum mismatch against
an already-applied migration fails fast. Take a backup first (or let the
scheduler's daily one count, if it's recent enough for you).

Images are published by CI on every merge to `master` (`:latest`). Pin a
digest if you want reproducible deploys:
`ghcr.io/foxxdev-collab/hle-aio@sha256:...`.

## Configuration reference

`compose.release.yaml` reads everything from `.env`:

| Var | Required | Notes |
|---|---|---|
| `POSTGRES_PASSWORD` | **yes** | Database password; also fed to the app's `DATABASE_URL`. Generate it, don't invent it. |
| `SETUP_TOKEN` | no | Fixed first-run token (else generated + printed to logs). |
| `BACKUP_INTERVAL_HOURS` / `BACKUP_RETENTION` | no | Default daily / keep 7. |
| `COOKIE_SECURE` | no | `false` only for LAN-only plain-HTTP use. |
| `TMDB_API_KEY` | no | Media metadata enrichment. |
| `CLAUDE_API_URL` + `CLAUDE_API_SERVICE_SECRET` | no | AI features; both or neither. Unset → manual paths. |
| `MAX_FILE_SIZE_MB` | no | Upload cap, default 50. |

The full environment reference (including dev-only vars) is in the
[README](../README.md#environment-variables).

## Media library

Replace the placeholder named volume with your real library, read-only:

```yaml
volumes:
  - /mnt/media:/data/library:ro
```

Then scan from Media → Library in the UI, or headless:
`podman exec hle-aio bun scripts/scan.ts <householdId>`.

## Host quirks

- **SELinux**: if either container exits `127` with "cannot apply additional
  memory protection after relocation" in the logs, uncomment the
  `security_opt: [label=disable]` lines in the compose file (observed on
  enforcing el10 hosts; the alternative musl images hit the same RELRO
  issue, which is why the images are Debian-based).
- **Resource limits**: both services carry `mem_limit: 1g`; raise them for
  large media libraries or lots of concurrent users.
