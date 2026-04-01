"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Link2 } from "lucide-react";
import { linkPaymentToTransactionAction } from "../actions";

type TransactionOption = {
  id: string;
  payee: string | null;
  description: string | null;
  amount: number;
  date: string;
};

export function PaymentTransactionLink({
  paymentId,
  paymentAmount,
  transactions,
}: {
  paymentId: string;
  paymentAmount: number;
  transactions: TransactionOption[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Filter and sort: exact amount matches first, then by search term
  const filtered = transactions
    .filter((t) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        t.payee?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        Math.abs(t.amount).toFixed(2).includes(q)
      );
    })
    .sort((a, b) => {
      // Prioritize amount matches
      const aMatch = Math.abs(Math.abs(a.amount) - paymentAmount) < 0.01 ? 0 : 1;
      const bMatch = Math.abs(Math.abs(b.amount) - paymentAmount) < 0.01 ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

  const amountMatches = filtered.filter(
    (t) => Math.abs(Math.abs(t.amount) - paymentAmount) < 0.01
  );

  async function handleLink(transactionId: string) {
    setError(null);
    const result = await linkPaymentToTransactionAction(paymentId, transactionId);
    if (result?.error) {
      setError(result.error);
    } else {
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs text-muted-foreground hover:text-foreground gap-1">
          <Link2 className="size-3" />Link
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Link Transaction</DialogTitle>
          <DialogDescription>
            Link this {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(paymentAmount)} payment to a bank transaction.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Search by payee, description, or amount..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Amount matches highlighted */}
        {amountMatches.length > 0 && !search && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-green-600">Suggested matches (same amount)</p>
            {amountMatches.map((t) => (
              <TransactionRow key={t.id} transaction={t} onLink={handleLink} highlighted />
            ))}
          </div>
        )}

        <div className="space-y-1 overflow-y-auto max-h-[40vh]">
          {!search && amountMatches.length > 0 && filtered.length > amountMatches.length && (
            <p className="text-xs font-medium text-muted-foreground pt-2">All recent transactions</p>
          )}
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No matching transactions found.</p>
          ) : (
            filtered
              .filter((t) => search || !amountMatches.find((m) => m.id === t.id))
              .slice(0, 20)
              .map((t) => (
                <TransactionRow key={t.id} transaction={t} onLink={handleLink} />
              ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransactionRow({
  transaction,
  onLink,
  highlighted,
}: {
  transaction: TransactionOption;
  onLink: (id: string) => void;
  highlighted?: boolean;
}) {
  const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

  return (
    <button
      type="button"
      onClick={() => onLink(transaction.id)}
      className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left hover:bg-accent/50 transition-colors ${
        highlighted ? "border-green-300 bg-green-50/50 dark:bg-green-950/20" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">
          {transaction.payee || transaction.description || "Unknown"}
        </div>
        <div className="text-xs text-muted-foreground">
          {dateFmt.format(new Date(transaction.date))}
          {transaction.description && transaction.payee && (
            <> &middot; {transaction.description}</>
          )}
        </div>
      </div>
      <div className="text-sm font-medium shrink-0 ml-3">
        {fmt.format(Math.abs(transaction.amount))}
      </div>
    </button>
  );
}
