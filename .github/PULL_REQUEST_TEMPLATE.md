<!--
  Thanks for contributing! Please fill out the sections below.
  Review the guidelines in CONTRIBUTING.md before submitting.
-->

## Summary

<!-- What does this PR do and why? Keep it to 1-3 sentences. -->

## Affected apps

<!-- Check all that apply -->
- [ ] `hle-family_manager` (identity provider)
- [ ] `hle-familyhub`
- [ ] `hle-family_finance`
- [ ] `hle-family_health`
- [ ] `hle-family_home_care`
- [ ] `hle-file_server`
- [ ] `hle-meal_prep`
- [ ] `hle-family_wiki`
- [ ] `hle-family_travel`
- [ ] `hle-claude_api`
- [ ] Shared infra (`compose.yaml`, `Containerfile.nextjs`, `hle.sh`)
- [ ] Documentation

## Type of change

- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change (requires migration / config update)
- [ ] Refactor / code quality
- [ ] Security fix
- [ ] Documentation
- [ ] Dependency update
- [ ] CI / tooling

## Security checklist

**Required for any PR touching server actions, auth, database queries, file handling, or external integrations.** See [`docs/THREAT_MODEL.md`](../docs/THREAT_MODEL.md) and [`docs/SECURITY_CONTROLS.md`](../docs/SECURITY_CONTROLS.md).

- [ ] Every Server Action calls `getCurrentUser()` and (where applicable) `getCurrentHouseholdId()`
- [ ] Every data query is scoped by `householdId` (tenant isolation boundary)
- [ ] All user input is validated with `zod` at the boundary
- [ ] No `$queryRawUnsafe` with user-controlled input
- [ ] No secrets added to code, commits, or logs
- [ ] No new `any` types introduced
- [ ] No new `dangerouslySetInnerHTML` without sanitization justification
- [ ] File upload paths validated against traversal
- [ ] If this changes authentication, MFA, or session handling, I have re-reviewed AC-2, IA-2, and IA-5 in `SECURITY_CONTROLS.md`
- [ ] N/A — this PR does not touch the items above

## Database schema changes

- [ ] No schema changes
- [ ] Prisma migration added and tested locally (`npx prisma migrate dev`)
- [ ] Migration is backwards-compatible with previously deployed code
- [ ] Household / tenant scoping preserved on new tables

## Testing

<!-- What did you verify and how? "Ran it locally and it worked" is not enough. -->

- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] Manually tested in dev (`./hle.sh rebuild <app>`)
- [ ] Tested as a non-admin household member (where RBAC is involved)

## Screenshots / recordings

<!-- For UI changes. Delete if not applicable. -->

## Related issues

<!-- Fixes #123, Refs #456, etc. -->
