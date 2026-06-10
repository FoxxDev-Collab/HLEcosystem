import { useState } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { ArchiveRestore, Plus } from "lucide-react"
import {
  getAccountsPageFn,
  toggleAccountArchivedFn,
} from "@/server/finance/fns.accounts"
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from "@/lib/finance-constants"
import { AccountFormDialog } from "@/components/finance/account-form"
import { formatCurrency } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const Route = createFileRoute("/_authed/finance/accounts/")({
  loader: () => getAccountsPageFn(),
  component: AccountsPage,
})

function AccountsPage() {
  const { accounts } = Route.useLoaderData()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)

  const activeAccounts = accounts.filter((a) => !a.isArchived)
  const archivedAccounts = accounts.filter((a) => a.isArchived)
  const totalBalance = activeAccounts.reduce(
    (sum, a) => sum + a.currentBalance,
    0
  )

  function refresh() {
    router.invalidate()
  }

  async function onRestore(id: string) {
    await toggleAccountArchivedFn({ data: { id, isArchived: false } })
    refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            {activeAccounts.length} account
            {activeAccounts.length !== 1 ? "s" : ""} ·{" "}
            {formatCurrency(totalBalance)} total
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Add Account
        </Button>
      </div>

      {activeAccounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-muted-foreground">
              No accounts yet. Add your first account to start tracking.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Add Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        ACCOUNT_TYPES.filter((type) =>
          activeAccounts.some((a) => a.type === type)
        ).map((type) => (
          <div key={type} className="space-y-3">
            <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              {ACCOUNT_TYPE_LABELS[type]}
            </h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {activeAccounts
                .filter((a) => a.type === type)
                .map((account) => (
                  <Link
                    key={account.id}
                    to="/finance/accounts/$id"
                    params={{ id: account.id }}
                  >
                    <div className="cursor-pointer rounded-lg border p-4 transition-colors hover:bg-accent/30">
                      <div className="mb-2 flex items-center gap-2">
                        <div
                          className="size-3 shrink-0 rounded-full"
                          style={{
                            backgroundColor: account.color ?? "#6366f1",
                          }}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {account.name}
                          </p>
                          {account.institution && (
                            <p className="truncate text-[10px] text-muted-foreground">
                              {account.institution}
                            </p>
                          )}
                        </div>
                      </div>
                      <div
                        className={`text-lg font-bold tabular-nums ${account.currentBalance < 0 ? "text-red-600" : ""}`}
                      >
                        {formatCurrency(account.currentBalance)}
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {account.transactionCount} transaction
                        {account.transactionCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        ))
      )}

      {archivedAccounts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">
            Archived
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {archivedAccounts.map((account) => (
              <Card key={account.id} className="opacity-60">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: account.color ?? "#6366f1" }}
                    />
                    <CardTitle className="truncate text-base">
                      {account.name}
                    </CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Restore"
                    onClick={() => onRestore(account.id)}
                  >
                    <ArchiveRestore className="size-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-medium tabular-nums">
                    {formatCurrency(account.currentBalance)}
                  </div>
                  <Badge variant="secondary" className="mt-1">
                    Archived
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {createOpen && (
        <AccountFormDialog
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false)
            refresh()
          }}
        />
      )}
    </div>
  )
}
