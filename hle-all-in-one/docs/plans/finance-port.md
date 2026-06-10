# Finance module port plan

Port of `hle-family_finance` (the most complex legacy app) into hle-all-in-one.
Groundwork already landed: `migrations/0009_finance.sql` (24 tables, 16 enums,
balance trigger, `process_due_recurring()` PG function). This doc is the
contract for the feature agents. Read `docs/PORTING.md` first — it overrides
anything here on style questions.

## Schema notes every agent must know

- Renames vs legacy: `Trip` → `"FinanceTrip"`, `TripExpense` →
  `"FinanceTripExpense"`, enum `TripStatus` → `"FinanceTripStatus"`, enum
  `TripExpenseType` → `"FinanceTripExpenseType"` (travel module owns the plain
  names). Everything else keeps its legacy name (`Category`, `Budget`,
  `Account`, `Transaction`, ...).
- `Account."currentBalance"` is maintained by the `sync_account_balance()`
  trigger on `Transaction` INSERT/DELETE. **Never UPDATE the balance directly
  for normal transactions.** Transaction edits that change amount/type/account
  are delete + re-insert in the server layer (legacy behavior). The legacy
  "adjust balance" flow inserts an `isBalanceAdjustment` transaction — it also
  goes through the trigger.
- Account deletion is an explicit server-layer cascade (delete imported
  transactions/batches, bill/debt payment links, transactions, then the
  account) — `Transaction."accountId"` deliberately has no `ON DELETE`. Copy
  the ordering from legacy `accounts/actions.ts:deleteAccountAction`.
- Money columns are `NUMERIC(14,2)` → always `SELECT ... ::float8` per
  PORTING.md. `DATE` columns → `::text`.
- `Transaction."createdByUserId"` / `ImportBatch."importedByUserId"` are now
  real nullable FKs to `"User"` — populate from `context.userId`.
- Legacy RLS / `getScopedPrisma` is gone; tenancy = `householdMiddleware` +
  `"householdId" = ${context.householdId}` on every query, joins through the
  parent for child tables (`DebtPayment`→`Debt`, `BillPayment`→`MonthlyBill`,
  `TaxDocument`→`TaxYear`, `ImportedTransaction`→`ImportBatch`,
  `WishlistItem`→`Wishlist`, `BudgetPlannerItem`→`BudgetPlannerProject`,
  `AssetValueHistory`→`Asset`, `FinanceTripExpense`→`FinanceTrip`).

## Feature inventory (legacy paths under `hle-family_finance/app/(app)/`)

| Feature | Behavior | Legacy files to read |
|---|---|---|
| Dashboard | Net worth (accounts + assets − debts), per-type account balances, recent transactions, month income/expense vs previous month, upcoming bills, budget snapshot, quick actions | `dashboard/page.tsx` |
| Accounts | List grouped by type with balances; create/edit (all `AccountType`s incl. credit limit, HSA limit/coverage, interest rate); archive; delete (manual cascade); adjust-balance flow inserts an `isBalanceAdjustment` transaction | `accounts/page.tsx`, `accounts/[id]/page.tsx`, `accounts/[id]/edit/page.tsx`, `accounts/new/page.tsx`, `accounts/actions.ts`, `components/account-form.tsx`, `components/adjust-balance-form.tsx` |
| Transactions | Filterable/paginated ledger (account, category, type, date range, search on payee/description — trgm indexed); create INCOME/EXPENSE/TRANSFER (transfer re-verifies BOTH accounts — ADR-0005); edit = delete+recreate semantics for balance; delete; tags; AI category suggestion | `transactions/page.tsx`, `transactions/actions.ts`, `transactions/actions.test.ts` (MUST port, see below), `components/transaction-form.tsx` |
| Bulk categorize | Lists uncategorized transactions, AI-suggests categories in bulk (Claude API), apply one/all; uses `CategoryRule` matching first | `transactions/categorize/page.tsx`, `transactions/categorize/actions.ts`, `components/bulk-categorizer.tsx` |
| Smart link | AI matches transactions to debts/bills/recurring; accept links (creates `DebtPayment`/`BillPayment`/sets `recurringTransactionId`); suggests new bills/recurring from patterns; learned `TransactionLinkPattern` rows enable one-click auto-link | `transactions/smart-link/page.tsx`, `transactions/smart-link/actions.ts` |
| Recurring | CRUD recurring rules (frequency, interval, dayOfPeriod, start/end, autoCreate); toggle active; skip next occurrence; "Process due now" button calls `process_due_recurring()` PG function | `recurring/page.tsx`, `recurring/actions.ts`, `recurring/actions.test.ts` |
| Categories | Two-level hierarchy CRUD per `CategoryType`; archive; unique (household, name, parent); `lib/default-categories.ts` seeding helper (exported but un-wired in legacy — wire it to an empty-state "Seed defaults" button) | `categories/page.tsx`, `categories/actions.ts`, `categories/actions.test.ts`, `lib/default-categories.ts` |
| Budgets | Month-grid budget vs actual per category (year/month query params); set amount per category; copy from previous month | `budgets/page.tsx`, `budgets/actions.ts` |
| Budget planner | Project list with status; project detail with line items (qty × unitCost = lineTotal, totalCost rollup), purchased toggles, duplicate project | `budget-planner/page.tsx`, `budget-planner/[id]/page.tsx`, `budget-planner/actions.ts`, `budget-planner/actions.test.ts` |
| Assets | Asset list/detail by type (real-estate and vehicle field groups), value history chart + `updateAssetValue` appends `AssetValueHistory`, link to debt, mark sold, archive | `assets/page.tsx`, `assets/[id]/page.tsx`, `assets/actions.ts` |
| Debts | Debt list with payoff stats; detail with amortization schedule + extra-payment savings calc (`lib/amortization.ts`), record payment (principal/interest/escrow/extra split, optional transaction link), refinance (closes old debt, creates linked new one), archive | `debts/page.tsx`, `debts/[id]/page.tsx`, `debts/actions.ts`, `lib/amortization.ts` |
| Bills | Monthly bill CRUD; per-month `BillPayment` rows (PENDING/PAID/OVERDUE/SCHEDULED), mark paid (optional transaction link), autopay account, linked debt/default category | `bills/page.tsx`, `bills/actions.ts` |
| Taxes | Tax year tracking (filing status, filed dates, refund/owed amounts + received/paid flags); per-year document checklist (`TaxDocumentType`) with received/expected dates and withholding amounts; file upload/download/delete | `taxes/page.tsx`, `taxes/[id]/page.tsx`, `taxes/actions.ts`, `components/tax-file-upload.tsx`, `app/api/taxes/download/[id]/route.ts` |
| Bank import | Upload CSV/QFX/OFX (Wells Fargo + generic CSV + OFX parsers in `lib/import-parser.ts` — port verbatim with its test `lib/import-parser.test.ts`); duplicate detection via `externalId`/date+amount; review batch (match/skip/import each row), category suggestion via rules; finalize | `import/page.tsx`, `import/[id]/page.tsx`, `import/actions.ts`, `lib/import-parser.ts`, `lib/import-parser.test.ts` |
| Receipt scanner | Upload receipt image → Claude API parses store/items/total → user reviews → creates transaction(s) | `receipts/page.tsx`, `receipts/actions.ts`, `components/receipt-scanner.tsx`, `lib/claude-api.ts` |
| Reports | Year/month spending by category, income vs expense trend, account flows; CSV export of a year's transactions | `reports/page.tsx`, `reports/actions.ts` |
| Advisor | "Generate insights" sends finance summary to Claude API → health score + spending analysis + recommendations, cached in `AdvisorReport` (JSONB); shows latest cached report | `advisor/page.tsx`, `advisor/actions.ts`, `lib/claude-api.ts` |
| Trips | Trip expense tracker (tax-deductible trips, GAS/FOOD/LODGING/... expense types), optional link to budget-planner project and to a transaction per expense, receipt upload per expense | `trips/page.tsx`, `trips/[id]/page.tsx`, `trips/actions.ts` |
| Wishlist | Wishlists with priced items (low/high range), purchased toggles | `wishlist/page.tsx`, `wishlist/[id]/page.tsx`, `wishlist/actions.ts` |
| Settings | Read-only household/data-summary/user cards — superseded by the manager module; **do not port** (fold "Data Summary" counts into the dashboard if cheap) |  `settings/page.tsx` |

## Proposed monolith routes (`src/routes/_authed/finance/`)

Flat-route convention from `src/routes/_authed/health/` (`x.index.tsx` +
`x.$id.tsx` siblings). Legacy `/new` and `/[id]/edit` pages become dialogs.

| File | `createFileRoute` literal |
|---|---|
| `dashboard.tsx` | `/_authed/finance/dashboard` |
| `accounts.index.tsx` | `/_authed/finance/accounts/` |
| `accounts.$id.tsx` | `/_authed/finance/accounts/$id` |
| `transactions.index.tsx` | `/_authed/finance/transactions/` |
| `transactions.categorize.tsx` | `/_authed/finance/transactions/categorize` |
| `transactions.smart-link.tsx` | `/_authed/finance/transactions/smart-link` |
| `recurring.tsx` | `/_authed/finance/recurring` |
| `categories.tsx` | `/_authed/finance/categories` |
| `budgets.tsx` | `/_authed/finance/budgets` |
| `budget-planner.index.tsx` | `/_authed/finance/budget-planner/` |
| `budget-planner.$id.tsx` | `/_authed/finance/budget-planner/$id` |
| `assets.index.tsx` | `/_authed/finance/assets/` |
| `assets.$id.tsx` | `/_authed/finance/assets/$id` |
| `debts.index.tsx` | `/_authed/finance/debts/` |
| `debts.$id.tsx` | `/_authed/finance/debts/$id` |
| `bills.tsx` | `/_authed/finance/bills` |
| `taxes.index.tsx` | `/_authed/finance/taxes/` |
| `taxes.$id.tsx` | `/_authed/finance/taxes/$id` |
| `import.index.tsx` | `/_authed/finance/import/` |
| `import.$id.tsx` | `/_authed/finance/import/$id` |
| `receipts.tsx` | `/_authed/finance/receipts` |
| `reports.tsx` | `/_authed/finance/reports` |
| `advisor.tsx` | `/_authed/finance/advisor` |
| `trips.index.tsx` | `/_authed/finance/trips/` |
| `trips.$id.tsx` | `/_authed/finance/trips/$id` |
| `wishlist.index.tsx` | `/_authed/finance/wishlist/` |
| `wishlist.$id.tsx` | `/_authed/finance/wishlist/$id` |

Tax document download and trip-expense receipt download need API routes (file
streaming, like the existing home-care document preview) — follow whatever
pattern home-care/wiki used for file serving (`src/server/file-storage.ts`).

## Server layer (`src/server/finance/`)

Pairs of `<feature>.ts` (row types + queries) and `fns.<feature>.ts`
(createServerFn + zod + `householdMiddleware`):

- `accounts.ts` / `fns.accounts.ts` — accounts CRUD, archive, manual-cascade
  delete, adjust-balance; **owns `listAccountsForPicker`** (used by
  transactions, recurring, bills, debts, import).
- `categories.ts` / `fns.categories.ts` — category CRUD + default seeding;
  **owns `listCategoriesForPicker`**; also `CategoryRule` queries (rules are
  conceptually category metadata; the categorize page consumes them).
- `transactions.ts` / `fns.transactions.ts` — ledger query w/ filters +
  pagination, create/update/delete (ADR-0005 ownership checks, transfer pair
  handling, delete+recreate on edit).
- `categorize.ts` / `fns.categorize.ts` — uncategorized list, rule matching,
  AI bulk suggest, apply.
- `smart-link.ts` / `fns.smart-link.ts` — analyze, accept links, pattern
  learning (`TransactionLinkPattern`), auto-link.
- `recurring.ts` / `fns.recurring.ts` — CRUD, skip-next, toggle, and
  `processDueRecurringFn` calling `SELECT process_due_recurring(${householdId}, ${userId})`.
- `budgets.ts` / `fns.budgets.ts` — month grid, set, copy-previous-month.
- `budget-planner.ts` / `fns.budget-planner.ts` — projects + items + duplicate.
- `assets.ts` / `fns.assets.ts` — assets, value history, mark sold.
- `debts.ts` / `fns.debts.ts` — debts, payments, refinance; pure
  `amortization.ts` helper ports to `src/server/finance/amortization.ts`
  (or `src/lib/` if the chart needs it client-side — it does; put it in
  `src/lib/finance/amortization.ts`).
- `bills.ts` / `fns.bills.ts` — bills + bill payments + mark paid.
- `taxes.ts` / `fns.taxes.ts` — tax years, documents, file upload/delete via
  `src/server/file-storage.ts`.
- `import.ts` / `fns.import.ts` — batches, rows, confirm/skip, finalize;
  parser ports to `src/server/finance/import-parser.ts` (+ its vitest file).
- `receipts.ts` / `fns.receipts.ts` — receipt scan → transactions.
- `reports.ts` / `fns.reports.ts` — report aggregates + CSV export.
- `advisor.ts` / `fns.advisor.ts` — summary builder, cached report read/write.
- `trips.ts` / `fns.trips.ts` — FinanceTrip + FinanceTripExpense + receipt files.
- `wishlist.ts` / `fns.wishlist.ts` — wishlists + items.
- `dashboard.ts` / `fns.dashboard.ts` — read-only aggregates (may import row
  types from the other query files, but executes its own SQL — same approach
  as `src/server/health/dashboard.ts`).
- `claude-api.ts` — gateway client (copy the shape of
  `src/server/meals/claude-api.ts`; uses `CLAUDE_API_URL` +
  `CLAUDE_API_SERVICE_SECRET` env vars). Owned by Agent C.

## Agent split (disjoint file ownership)

Order matters only for pickers: Agent A lands first (or its picker fns get
stubbed first), since B/C/D consume account+category pickers via imports.

**Agent A — Core ledger (foundation):**
`accounts.*`, `categories.*` (+ rules), `transactions.*`, `recurring.*`,
`dashboard.*`; routes `dashboard.tsx`, `accounts.*`, `transactions.index.tsx`,
`recurring.tsx`, `categories.tsx`; `src/components/finance/transaction-form.tsx`,
`account-form.tsx`. Owns the ADR-0005 regression test (below) and a
`process_due_recurring` smoke test.

**Agent B — Obligations & net worth:**
`debts.*`, `bills.*`, `assets.*`, `budgets.*`, `budget-planner.*`,
`src/lib/finance/amortization.ts`; routes `debts.*`, `bills.tsx`, `assets.*`,
`budgets.tsx`, `budget-planner.*`. Imports pickers from A.

**Agent C — Intelligence & import (Claude API + files):**
`claude-api.ts`, `import.*` (+ `import-parser.ts` + its test), `receipts.*`,
`categorize.*`, `smart-link.*`, `advisor.*`; routes `import.*`, `receipts.tsx`,
`transactions.categorize.tsx`, `transactions.smart-link.tsx`, `advisor.tsx`.
Imports pickers from A; smart-link reads debts/bills row types from B (read-only
imports are fine; B owns the files).

**Agent D — Long tail:**
`taxes.*` (+ file upload/download), `reports.*` (+ CSV export), `trips.*`,
`wishlist.*`; routes `taxes.*`, `reports.tsx`, `trips.*`, `wishlist.*`.
Only depends on A's pickers (trips link to transactions; reports read
transactions via their own SQL).

No agent touches `src/lib/modules.ts`, `migrations/*`, `src/routeTree.gen.ts`,
or another agent's files. The integrator applies nav + regenerates the route
tree.

## Nav proposal (`src/lib/modules.ts`, finance module — integrator applies)

Set `enabled: true` and:

- **Overview**: Dashboard `/finance/dashboard` (LayoutDashboard); Accounts
  `/finance/accounts` (Landmark); Transactions `/finance/transactions`
  (ArrowLeftRight); Recurring `/finance/recurring` (Repeat)
- **Planning**: Budgets `/finance/budgets` (PiggyBank); Budget Planner
  `/finance/budget-planner` (ClipboardList); Categories `/finance/categories`
  (Tag); Bills `/finance/bills` (ReceiptText)
- **Wealth**: Assets `/finance/assets` (Landmark — or Gem to avoid reuse);
  Debts `/finance/debts` (TrendingDown); Taxes `/finance/taxes` (FileText);
  Reports `/finance/reports` (BarChart3)
- **Tools**: Import `/finance/import` (Upload); Receipt Scanner
  `/finance/receipts` (ScanLine); Categorize `/finance/transactions/categorize`
  (Wand2); Smart Link `/finance/transactions/smart-link` (Link2); Advisor
  `/finance/advisor` (Sparkles)
- **More**: Trips `/finance/trips` (Route); Wishlists `/finance/wishlist`
  (Star)

## Special items

### ADR-0005 regression test (MANDATORY — Agent A)

Legacy: `hle-family_finance/app/(app)/transactions/actions.test.ts`. It guards
the 2026-04-08 cross-tenant incident. What it asserts:

1. `createTransaction` with an `accountId` from another household: the
   ownership check runs scoped `{ id, householdId }`, and **no**
   transaction INSERT and **no** account balance UPDATE happen.
2. TRANSFER with a foreign `transferToAccountId`: source passes, destination
   check fails, nothing is mutated (both accounts must be re-verified).
3. Legitimate EXPENSE: exactly one transaction INSERT; the app layer does
   **not** update the balance (the `sync_account_balance` trigger owns that).
4. Non-numeric amount fails zod before any DB call (defense in depth).
5. `deleteTransaction` scoped lookup `{ id, householdId }` returns nothing →
   no DELETE.

Port as `src/server/finance/transactions.test.ts` (vitest is already
configured: `bun run test`). Mock `@/server/db`'s `sql` (or extract the query
layer so it can be called with a fake sql executor) and the middleware context;
assert the same five behaviors against the new server fns / query functions.
Keep the legacy header comment explaining the incident. Do not skip, do not
mark flaky.

### Cross-app bridges marked `TODO(finance)` (restore after port)

`grep -rn "TODO(finance)" src/` currently hits 8 places in two bridges:

- **Meals receipts → finance** (`src/server/meals/receipts.ts`,
  `src/server/meals/fns.receipts.ts`, `src/routes/_authed/meals/receipts.tsx`):
  legacy offered "Also add expense to Family Finance" when saving a scanned
  grocery receipt. Restore = INSERT a finance `"Transaction"` (EXPENSE,
  account picked by user, grocery category) from the meals receipt flow —
  meals server fn calls a finance query function with the same
  `context.householdId`. Needs an account/category picker exposed by Agent A.
- **Health expenses/visits → finance** (`src/server/health/expenses.ts`,
  `fns.expenses.ts`, `visits.ts`, `fns.visits.ts`,
  `src/routes/_authed/health/expenses.tsx`): legacy optionally mirrored
  medical expenses / visit out-of-pocket costs into finance (HSA accounts are
  modeled: `Account.type = 'HSA'`, `hsaAnnualLimit`, `paidFromHsa` flags on the
  health side). Same restore shape as meals.

These are integrator-scheduled follow-ups after Agent A lands — not part of the
four agents' scopes (they cross module ownership).

### Background jobs / recurring processing

The legacy app had **no cron**. `process_due_recurring()` was invoked manually
via a "Process due" button on the recurring page (`recurring/page.tsx` →
`processDueRecurringAction`). Auto-create rules therefore only fire when a user
clicks. Proposal for the monolith, in order of preference:

1. **Port as-is** (button on `/finance/recurring` calling
   `processDueRecurringFn`) — zero new infrastructure, matches legacy.
2. Additionally call `processDueRecurringFn` fire-and-forget in the finance
   dashboard loader (cheap idempotent catch-up per household visit).
3. If real scheduling is ever wanted: a Bun `setInterval` in the server entry
   that loops households, or pg_cron in the PG18 container — needs a new ADR
   (new trust boundary: job runs without a user session, so it must iterate
   householdIds server-side, never accept one).

Recommend 1 now, 2 as a one-line enhancement, 3 deferred.

### Other notes / open questions for the integrator

- Money precision: 0009 uses `NUMERIC(14,2)` per the porting instruction;
  legacy was `NUMERIC(18,2)` and the other monolith modules use
  `NUMERIC(10,2)` for casual costs. 14,2 comfortably covers household net
  worth; flag if you want it aligned either direction before first deploy.
- Legacy RLS + `getScopedPrisma` were dropped (house convention is middleware
  scoping). If defense-in-depth RLS is wanted on the monolith DB, that is a
  separate migration + ADR.
- `import-parser.test.ts` should be ported alongside the parser (pure
  functions, trivial vitest port) — Agent C.
- Legacy tests `recurring/actions.test.ts`, `categories/actions.test.ts`,
  `budget-planner/actions.test.ts` also exist; port their assertions where the
  behavior survives (Agent A / Agent B), but only `transactions/actions.test.ts`
  is mandatory per CLAUDE.md rule 12.
- Tax document + trip receipt files: legacy stored under an app-local uploads
  dir with magic-byte validation; monolith equivalent is
  `src/server/file-storage.ts` — verify it exposes hash + size, and reuse the
  home-care document download route pattern.
- `AdvisorReport.reportData` is JSONB with a GIN index (ported); the advisor
  page only ever reads the latest row per household, so feel free to ignore
  the index in queries.
