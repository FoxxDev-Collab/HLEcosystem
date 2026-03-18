import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Search, X } from "lucide-react";
import { TransactionForm } from "@/components/transaction-form";
import { createTransactionAction, deleteTransactionAction } from "./actions";
import type { Prisma } from "@prisma/client";

const TYPE_COLORS: Record<string, string> = {
  INCOME: "text-green-600",
  EXPENSE: "text-red-600",
  TRANSFER: "text-blue-600",
};

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    account?: string;
    category?: string;
    page?: string;
    q?: string;
    from?: string;
    to?: string;
    minAmount?: string;
    maxAmount?: string;
  }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const page = parseInt(params.page || "1");
  const pageSize = 50;

  // Build filter
  const where: Prisma.TransactionWhereInput = { householdId };
  if (params.type) where.type = params.type as Prisma.TransactionWhereInput["type"];
  if (params.account) where.accountId = params.account;
  if (params.category) where.categoryId = params.category;

  // Text search
  if (params.q) {
    where.OR = [
      { payee: { contains: params.q, mode: "insensitive" } },
      { description: { contains: params.q, mode: "insensitive" } },
    ];
  }

  // Date range
  if (params.from || params.to) {
    where.date = {};
    if (params.from) (where.date as Prisma.DateTimeFilter).gte = new Date(params.from);
    if (params.to) (where.date as Prisma.DateTimeFilter).lte = new Date(params.to);
  }

  // Amount range
  if (params.minAmount || params.maxAmount) {
    where.amount = {};
    if (params.minAmount) (where.amount as Prisma.DecimalFilter).gte = parseFloat(params.minAmount);
    if (params.maxAmount) (where.amount as Prisma.DecimalFilter).lte = parseFloat(params.maxAmount);
  }

  const [transactions, totalCount, accounts, categories] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { category: true, account: true },
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.transaction.count({ where }),
    prisma.account.findMany({
      where: { householdId, isArchived: false },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { householdId, isArchived: false },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const hasFilters = !!(params.q || params.from || params.to || params.minAmount || params.maxAmount || params.category || params.account);

  // Build query string preserving filters for pagination
  function buildQS(overrides: Record<string, string | undefined> = {}) {
    const merged = { ...params, ...overrides };
    const qs = Object.entries(merged)
      .filter(([, v]) => v !== undefined && v !== "" && v !== "all")
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join("&");
    return qs ? `?${qs}` : "";
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>

      {/* Quick Add */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Add</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Create an account first before adding transactions.</p>
          ) : (
            <TransactionForm
              action={createTransactionAction}
              accounts={accounts.map((a) => ({ id: a.id, name: a.name, type: a.type }))}
              categories={categories.map((c) => ({ id: c.id, name: c.name, type: c.type, color: c.color }))}
            />
          )}
        </CardContent>
      </Card>

      {/* Advanced Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="size-4" />
            Search & Filter
            {hasFilters && (
              <a href="/transactions"><Badge variant="secondary" className="cursor-pointer ml-2"><X className="size-3 mr-1" />Clear</Badge></a>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Search payee / description</Label>
              <Input name="q" placeholder="Search..." defaultValue={params.q || ""} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">From Date</Label>
              <Input name="from" type="date" defaultValue={params.from || ""} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To Date</Label>
              <Input name="to" type="date" defaultValue={params.to || ""} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Account</Label>
              <Select name="account" defaultValue={params.account || "all"}>
                <SelectTrigger className="h-9"><SelectValue placeholder="All accounts" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All accounts</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select name="category" defaultValue={params.category || "all"}>
                <SelectTrigger className="h-9"><SelectValue placeholder="All categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Min Amount</Label>
              <Input name="minAmount" type="number" step="0.01" placeholder="0.00" defaultValue={params.minAmount || ""} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max Amount</Label>
              <Input name="maxAmount" type="number" step="0.01" placeholder="0.00" defaultValue={params.maxAmount || ""} />
            </div>
            <div className="flex gap-2 lg:col-span-4">
              <Button type="submit" size="sm"><Search className="size-3.5 mr-1" />Search</Button>
              {hasFilters && (
                <a href="/transactions"><Button type="button" variant="outline" size="sm"><X className="size-3.5 mr-1" />Clear</Button></a>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Type Filters */}
      <div className="flex flex-wrap gap-2">
        <a href={`/transactions${buildQS({ type: undefined, page: undefined })}`}>
          <Badge variant={!params.type ? "default" : "outline"} className="cursor-pointer">All</Badge>
        </a>
        <a href={`/transactions${buildQS({ type: "EXPENSE", page: undefined })}`}>
          <Badge variant={params.type === "EXPENSE" ? "default" : "outline"} className="cursor-pointer">Expenses</Badge>
        </a>
        <a href={`/transactions${buildQS({ type: "INCOME", page: undefined })}`}>
          <Badge variant={params.type === "INCOME" ? "default" : "outline"} className="cursor-pointer">Income</Badge>
        </a>
        <a href={`/transactions${buildQS({ type: "TRANSFER", page: undefined })}`}>
          <Badge variant={params.type === "TRANSFER" ? "default" : "outline"} className="cursor-pointer">Transfers</Badge>
        </a>
      </div>

      {/* Transaction List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>History</span>
            <span className="text-sm font-normal text-muted-foreground">{totalCount} transactions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No transactions found</p>
          ) : (
            <div className="divide-y">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-3 gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {tx.payee || tx.description || "Transaction"}
                      </span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {tx.type}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(tx.date)} &middot; {tx.account.name}
                      {tx.category && (
                        <>
                          {" "}&middot;{" "}
                          <span style={{ color: tx.category.color || undefined }}>{tx.category.name}</span>
                        </>
                      )}
                      {tx.description && tx.payee && (
                        <> &middot; {tx.description}</>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-sm font-medium ${TYPE_COLORS[tx.type] || ""}`}>
                      {tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : ""}
                      {formatCurrency(tx.amount)}
                    </span>
                    <form action={deleteTransactionAction}>
                      <input type="hidden" name="id" value={tx.id} />
                      <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              {page > 1 && (
                <a href={`/transactions${buildQS({ page: String(page - 1) })}`}>
                  <Button variant="outline" size="sm">Previous</Button>
                </a>
              )}
              <span className="flex items-center text-sm text-muted-foreground px-3">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <a href={`/transactions${buildQS({ page: String(page + 1) })}`}>
                  <Button variant="outline" size="sm">Next</Button>
                </a>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
