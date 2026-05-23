# hle-media

Family media library, IPTV channels, and a focused Plex-lite player. Tenth app
in the HLEcosystem; runs on Bun + React + Tailwind + shadcn/ui and connects to
the shared `foxxlab` Postgres in its own `media` schema.

## Stack

- **Runtime:** Bun (no Node, no Next.js, no Vite)
- **Server:** `Bun.serve` with route handlers; `Bun.sql` for Postgres
- **UI:** React 19 + Tailwind 4 + shadcn/ui
- **Auth:** shared `hle_session` cookie validated against `family_manager."Session"`
- **Migrations:** plain `.sql` files in `migrations/`, applied by `scripts/migrate.ts`

## Layout

```
hle-media/
├── migrations/         # 0001_init.sql, 0002_*.sql, ... applied in lexical order
├── scripts/
│   └── migrate.ts      # `bun run migrate` — runs pending migrations and exits
├── src/
│   ├── index.ts        # Bun.serve entry; mounts API routes + SPA shell
│   ├── index.html      # SPA shell (loads frontend.tsx)
│   ├── frontend.tsx    # React entry
│   ├── App.tsx         # Top-level UI
│   ├── index.css       # Tailwind + shadcn theme
│   ├── components/ui/  # shadcn/ui primitives — do not edit
│   ├── lib/            # client-side helpers
│   └── server/
│       ├── db.ts          # Bun.sql singleton (DATABASE_URL required)
│       ├── migrate.ts     # migration runner with checksum drift guard
│       ├── cookies.ts     # parse/serialize for Bun.serve Request/Response
│       ├── session.ts     # validate hle_session against family_manager."Session"
│       ├── users.ts       # cross-schema user fetch from family_manager."User"
│       ├── household.ts   # mv_household_id cookie + membership checks
│       └── auth.ts        # requireAuth / requireHousehold middleware
├── styles/globals.css  # shadcn theme tokens
├── package.json
├── bunfig.toml
├── build.ts            # production bundle to dist/
└── tsconfig.json
```

## Environment

Bun auto-loads `.env`. Required:

```
DATABASE_URL=postgresql://foxxlab_admin:...@postgres:5432/foxxlab?sslmode=disable
```

Optional:

```
PORT=8090            # default 8090
AUTH_DOMAIN=         # set in production for cross-subdomain cookies
SECURE_COOKIES=true  # set in production
```

The `media` schema is created by `migrations/0001_init.sql` — no need to add
it to `config/postgres/init-schemas.sql`, though doing so on the next infra
sweep keeps the rest of the ecosystem consistent.

## Local development

```bash
bun install
bun run migrate        # creates the `media` schema and applies migrations
bun dev                # http://localhost:8090
```

## Migrations

Migrations are plain `.sql` files in `migrations/`, applied in lexical order.
Filenames look like `0001_init.sql`, `0002_add_<thing>.sql`, etc.

The runner (`src/server/migrate.ts`) records a sha256 checksum for every
applied migration in `media."_migrations"`. If the on-disk file diverges from
the recorded checksum on a future run, the runner refuses to start with a
clear error. **Do not edit applied migrations.** Write a new migration that
fixes the prior one instead. (See the file_server pg_trgm incident, ADR not
yet written, for why this matters.)

## Roadmap

Phase 1 (in progress):

- [x] Foundation: schema, migration runner, session auth, mv_household_id scoping
- [ ] Library scanner (filesystem walk + ffprobe)
- [ ] Metadata fetcher (TMDB / TVDB)
- [ ] Library browse UI (movies / series grid, detail pages)
- [ ] Browser playback (HLS.js for HLS sources, native `<video>` for direct-play)
- [ ] Parental control enforcement at query time

Phase 2:

- [ ] Channels: schedule rules, ffmpeg-driven HLS streams, lazy spin-up
- [ ] EPG: precomputed program guide, XMLTV export
- [ ] M3U playlist export for IPTV clients (Channels DVR, Jellyfin, VLC)
