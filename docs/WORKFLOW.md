# VibeSecOps — How HLEcosystem Is Actually Built

> **TL;DR:** I use Claude Code (Anthropic's CLI coding agent) to execute the tasks I direct. I set strategy, architecture, and the non-negotiable rules. Claude drafts code, proposes plans, and executes multi-step work. I verify, correct, and authorize everything that lands. The guardrails in this repo — CLAUDE.md, the invariant-gate CI job, the threat model, the incident regression tests — exist because an AI assistant without rules is a liability, but an AI assistant with rules and verification is a force multiplier. This document describes how the collaboration actually works.

---

## Who I am, and why that matters

I'm Jeremiah Price, founder of Foxx Cyber LLC. CISSP, CISM, 8 years of DoD cybersecurity experience in Risk Management Framework and GRC work, TS/SCI clearance. I build compliance platforms for contractors and assessors (Bedrock CMMC / Bedrock C3PAO) as my commercial product line. HLEcosystem is my personal project — the multi-app family management platform I use for my own household — and it doubles as a public FOSS project where I can demonstrate security engineering practices in the open.

This context matters because the rest of this document is written from the perspective of someone whose professional obligation is to reason about security controls, threat models, and compliance evidence. I don't treat AI-assisted development as a way to skip the hard parts of building software. I treat it as a way to move faster at the parts I already know how to do right.

## The core premise: "VibeSecOps"

"Vibe coding" — asking an AI for code and pasting what comes out without understanding or verifying it — is indefensible for anything that touches user data. The Reddit skepticism is earned. I've seen the output of that workflow and it reliably ships bugs I'd expect a first-year intern to catch.

But "never use AI for code" is also wrong. The tools are useful. The question is what workflow makes them useful *without* degrading into vibe coding.

I call my approach **VibeSecOps**: AI-assisted development constrained by explicit, written-down, machine-enforceable security and quality rules. The "vibe" is the speed and conversational fluency. The "SecOps" is the non-negotiable discipline that catches AI mistakes before they ship.

Three things make it work:

1. **A rulebook the AI must read before touching code** ([`CLAUDE.md`](../CLAUDE.md))
2. **Guardrails that fire on every change** (CI, branch protection, invariant-gate, threat model reviews)
3. **A human who verifies, pushes back, and owns the outcome** (me)

If any one of those is missing, it's vibe coding with extra steps.

## How the collaboration actually works

### I set direction. Claude executes.

I decide what to build and what the constraints are. Claude proposes a plan, I review it, Claude executes. I never delegate the strategic decisions — architecture, threat model, what trust boundary to introduce, which ADR to write — even when Claude offers good options.

When I say "build me a financial advisor feature," I don't mean "figure out if we should build it." I mean "I've decided we're building it; show me the implementation plan and ask questions if the plan is unclear."

### Claude drafts. I verify.

Every non-trivial change Claude proposes, I read. I check that:

- It matches what I asked for
- It follows the rules in CLAUDE.md
- The reasoning in the commit message is honest
- The file changes actually do what the summary claims
- Any assumptions about the codebase are grounded (I grep and verify when in doubt)

Claude will sometimes state things as facts that are close but not quite right — "the test suite uses Jest" when it's Vitest, "the .env was committed" when it was only on disk. I catch these. When I catch a mistake, I point it out specifically, and Claude corrects. I don't accept "you're right, sorry" without the correction being real.

### I push back when I disagree.

Early in this project's FOSS-prep pass, Claude started fixing lint errors by adding `eslint-disable` comments in several places. I stopped it immediately with "I hate that, make sure this never happens. Lint exists for a reason." The correct response was to fix the underlying code, not to silence the tool. Claude acknowledged, removed the disables, and we added a CLAUDE.md rule banning rule suppressions outright. Then we added a CI job (`Security invariant gate`) that greps every PR diff for `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `$queryRawUnsafe`, `dangerouslySetInnerHTML`, and explicit `any` — any match fails the build.

That exchange is the VibeSecOps workflow in miniature: the AI suggested a shortcut, the human rejected it, and the rejection became a durable rule enforced by a machine check. The next AI session (or contributor) can't backslide into the same shortcut.

### Claude proposes, I choose.

Whenever there's a decision with meaningful trade-offs, Claude presents options and their implications and asks me to pick. Example from this session:

> **Decision point:** are you OK with the documented VEX-style risk acceptance in point 2? The alternative is blocking every merge until Next.js publishes a picomatch 4.0.4 bump upstream, which is not in your control and could take weeks. Documenting as accepted risk is the industry-standard move and explicitly called out in NIST SP 800-53 RA-3 and SA-11.

I said yes. Claude executed. The alternative would have been Claude silently accepting or silently blocking — both of which would be wrong. An AI that commits to risk decisions unilaterally is an AI I can't trust.

### When Claude doesn't know, Claude says so.

Early in the scanner debugging, Claude spent several tool calls searching for the root cause of a Trivy false positive. When the evidence kept being inconclusive, Claude stopped and said "I think this is an upstream issue, here's what I'd need to verify it." I dropped an external Grype scan JSON into the conversation and we pivoted off that. The useful thing was that Claude admitted the scope of what it did and did not know, rather than pretending confidence.

## The rulebook — what's in CLAUDE.md

Every AI coding agent that touches this repo reads [`CLAUDE.md`](../CLAUDE.md) before writing any code. The rules aren't aspirational — they're the contract. The ones that matter most:

1. **Auth gate + household scoping on every Server Action.** No exceptions. The ADR-0005 incident was exactly a violation of this rule; it's now guarded by a regression test and the CI invariant gate.
2. **Parameterized SQL only.** Zero `$queryRawUnsafe` or `$executeRawUnsafe` with user-controlled input anywhere in the codebase. The invariant gate fails PRs that introduce either.
3. **zod validation at every trust boundary.** Server Actions validate `FormData` before destructuring. API routes validate request bodies.
4. **No secrets in code or logs.** `process.env` only. Gitleaks scans history on every PR.
5. **No rule suppressions, ever.** The 11th rule exists because I watched Claude almost ship `eslint-disable` comments and that's how vibe code sneaks past review. Non-negotiable.
6. **Every security fix gets a regression test.** If you fix an auth or tenancy bug, you write a test that fails on the pre-fix code. Rule 12, added after the ADR-0005 incident.
7. **Read the threat model before touching security-relevant code.** Claude is instructed to load `docs/THREAT_MODEL.md` and `docs/SECURITY_CONTROLS.md` before any change that crosses a trust boundary.

CLAUDE.md also includes the **pre-PR checklist** — an exact sequence of commands Claude must run and verify before declaring a change complete. Lint, typecheck, tests, and a local grep that mimics the CI invariant gate. "It should work" is not an acceptable answer; the verification has to be actual.

## The guardrails — what runs on every change

Reading rules isn't enough. Rules have to be enforced by machines that don't get tired. HLEcosystem's enforcement layer:

- **Branch protection** on `master`. No direct pushes. Every change goes through a PR with 7 required status checks.
- **`CI passed`** — lint, typecheck, Vitest per affected app, via change-detecting matrix
- **`Workflow audit (zizmor)`** — static analysis of the GitHub Actions workflow YAML itself (script-injection sinks, unpinned actions, overly permissive tokens)
- **`Security invariant gate`** — diff grep for forbidden patterns; the backstop for the CLAUDE.md rules
- **`Secret scan (gitleaks)`** — full-history secret detection, not just the diff
- **`Dependency + config scan (trivy)`** — filesystem scanning, SARIF to GitHub Security
- **`CodeQL`** — security-extended + security-and-quality SAST
- **`Dependency review (PR only)`** — blocks PRs that introduce vulnerable or incompatibly-licensed deps at review time
- **`Grype`** image scan — VEX-aware container vulnerability scanning with a documented risk-acceptance list
- **Weekly `npm audit`** + **OpenSSF Scorecard** + **Dependabot** for prod/dev/docker/github-actions ecosystems

Any of these failing blocks the merge. My own commits are subject to the same checks as anyone else's.

## Documentation is the source of truth

Code can lie. Documentation that's tied to file:line references and updated on every change can't lie for long. HLEcosystem has:

- [`docs/THREAT_MODEL.md`](./THREAT_MODEL.md) — STRIDE analysis per trust boundary, known gaps with severity and tracking, VEX-style risk acceptances with review-by dates
- [`docs/SECURITY_CONTROLS.md`](./SECURITY_CONTROLS.md) — NIST SP 800-53 Rev 5 control traceability matrix with file:line citations. Self-assessment, not an ATO package, but an honest one: 16 implemented, 11 partial, 2 not implemented
- [`docs/adr/`](./adr/) — Architecture Decision Records for the five most-relitigated choices (schema isolation, Podman, cookie sessions, Server Actions, household tenancy), including ADR-0005 which documents the 2026-04-08 cross-tenant balance-mutation incident as a warning to future contributors
- [`docs/TESTING.md`](./TESTING.md) — honest gap analysis of test coverage with a prioritized roadmap

These documents are written by me, edited with Claude's help, and updated whenever the underlying code changes. Every security-relevant PR is expected to update the docs if it invalidates a claim.

## When things go wrong in this workflow

Nothing works first try every time. Failures in this session that the workflow caught:

- **Claude initially claimed the `.env` file was committed to history.** I asked it to verify; it ran `git log --all --full-history -- '**/.env'` and confirmed it was not. False alarm. The verification step is what makes the workflow trustworthy.
- **The first Containerfile fix still left dev dependencies in the runtime image.** Trivy's image scan failed on all 10 apps because vite/esbuild/picomatch from the builder stage were leaking through. The fix was a dedicated `prod-deps` stage that does a clean `npm ci --omit=dev`. The scanner caught the mistake, the workflow iterated, the fix shipped.
- **Trivy and Grype disagreed on whether picomatch 4.0.3 was in the image.** My cached `grype-findings` directory showed zero findings; a fresh Grype scan I pasted into the conversation showed the finding was real after all. The resolution was to document the finding as a VEX-style accepted risk (upstream-gated, not user-reachable, reviewed by a specific date) — not to suppress it, not to pretend it wasn't there.
- **Dependabot opened 55 PRs in a few hours** because my initial `dependabot.yml` didn't block major version updates or group prod/dev patches. The fix was to tighten the config; Dependabot then auto-closed the superseded individual PRs, leaving 21 grouped ones.

In every case, the recovery path was: notice the problem (usually via a scanner, CI job, or me asking "wait, that doesn't look right"), diagnose the root cause, fix it properly, document what happened, add a guardrail if possible. The guardrail step is what distinguishes this from vibe coding — every incident becomes a future prevention.

## What this is NOT

This workflow is **not**:

- Asking an AI to build features without supervision
- Accepting AI suggestions without reading them
- Merging code that passes the type checker but hasn't been thought through
- Using AI as a replacement for understanding the code
- Claiming the AI "built" the project. The AI drafted, I directed, verified, corrected, and authorized.

It is also **not free**. It requires:

- A rulebook you're willing to enforce without exceptions
- A CI pipeline that catches the mistakes the rules are designed to prevent
- Documentation that reflects reality, not aspiration
- A human who treats verification as part of the job, not an afterthought

## Recommendations if you want to try this

1. **Write down the rules before the first commit.** Not after. The rules are easier to enforce when they predate the code.
2. **Make the rules machine-checkable wherever possible.** A lint rule beats a CLAUDE.md sentence, and a CI job beats both.
3. **Treat documentation as code.** Threat model, ADRs, security controls — these are as important as the source files. Update them in the same PR as the behavior change.
4. **Enforce branch protection from day one.** Even solo. Zero required approvals with 0 reviewers is fine for a solo repo — the value is the mandatory check suite, not the review ceremony.
5. **Run multiple scanners.** Trivy and Grype disagree sometimes. CodeQL catches things neither of them sees. A single scanner is a single point of failure.
6. **Document accepted risks explicitly (VEX).** Don't suppress findings. Accept them with rationale, link to an upstream tracker, and set a review-by date.
7. **Treat every bug fix as an opportunity for a regression test.** Especially security bugs. The test is the only thing that prevents the same bug from shipping twice.
8. **Push back on your AI.** When the suggestion is wrong, say so specifically. "That's a rule suppression and we don't do those" is better than "no, try again."
9. **Be honest about the gaps.** TESTING.md acknowledges the test suite is incomplete. The NIST controls doc marks 11 controls as "Partial." That honesty is what makes the parts you HAVE completed credible.
10. **Understand what you ship.** If you can't explain why a change is correct, don't merge it, regardless of which AI wrote it.

## Credits

HLEcosystem is developed by [Jeremiah Price](https://github.com/FoxxDev-Collab) / Foxx Cyber LLC. The AI coding assistant used throughout this project is [Claude Code](https://claude.com/claude-code), Anthropic's CLI coding agent. The workflow described above is the result of trial and error across this project and Foxx Cyber's commercial Bedrock CMMC / Bedrock C3PAO platform work.

Questions, critiques, and "this is still vibe coding because X" feedback are welcome via GitHub Discussions or Issues.
