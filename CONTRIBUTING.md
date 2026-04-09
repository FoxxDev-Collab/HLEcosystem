# Contributing to HLEcosystem

Thanks for your interest. HLEcosystem is a self-hostable family management platform and we welcome patches, bug reports, and new app ideas.

## Ground rules

- **Read [`CLAUDE.md`](./CLAUDE.md) first.** It documents the architecture, critical rules (schema isolation, household scoping, auth pattern), and coding conventions. Every PR is expected to follow them.
- **One database, seven schemas.** Never introduce a second database or bypass the shared `family_manager."User"` table.
- **Every data query must be scoped by `householdId`** in the finance / health / hub apps. This is the tenant isolation boundary.
- **Server Actions for mutations** — no client-side `fetch` for writes.
- **Parameterized SQL only.** Prisma tagged templates or `$queryRaw`. Never `$queryRawUnsafe` with user input.

## Development setup

```bash
git clone https://github.com/<your-fork>/HLEcosystem.git
cd HLEcosystem
cp .env.example .env    # fill in secrets — see below
./hle.sh rebuild all    # Podman build + start
./hle.sh status         # verify health
```

You need Podman + podman-compose (not Docker) and Node 22+ locally for running Prisma migrations or scripts outside containers.

## Pull request process

1. Fork and create a feature branch off `master`.
2. Make focused changes. Keep commits small and use the `[app] brief description` format documented in `CLAUDE.md`.
3. Run `npm run lint` and `npm run build` in any app you touched.
4. Describe the change, testing performed, and any schema migrations in the PR body.
5. Security-sensitive changes (auth, tenant scoping, file uploads, SQL) get an extra review pass.

## Filing issues

- **Bug reports** — include the affected app, steps to reproduce, expected vs actual behavior, and any relevant logs (`./hle.sh logs <service>`).
- **Security issues** — do NOT open a public issue. See [`SECURITY.md`](./SECURITY.md).
- **Feature requests** — explain the use case. HLEcosystem is opinionated; not every request will land.

## Code style

- TypeScript strict mode. No `any`.
- `react-hook-form` + `zod` for forms.
- Tailwind + shadcn/ui for styling — do not edit files in `components/ui/`.
- `lib/format.ts` for dates/currency — never inline-format.
- Delete dead code; don't comment it out.

## License

By contributing, you agree that your contributions will be licensed under the MIT License (see [`LICENSE`](./LICENSE)).
