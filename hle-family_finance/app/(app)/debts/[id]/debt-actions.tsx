"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";
import { updateDebtAction, deleteDebtAction } from "../actions";

const DEBT_TYPES = [
  { value: "MORTGAGE", label: "Mortgage" },
  { value: "AUTO_LOAN", label: "Auto Loan" },
  { value: "STUDENT_LOAN", label: "Student Loan" },
  { value: "PERSONAL_LOAN", label: "Personal Loan" },
  { value: "HELOC", label: "HELOC" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "MEDICAL_DEBT", label: "Medical Debt" },
  { value: "OTHER", label: "Other" },
];

type DebtData = {
  id: string;
  name: string;
  type: string;
  lender: string | null;
  originalPrincipal: number;
  currentBalance: number;
  interestRate: number;
  minimumPayment: number | null;
};

export function DebtEditDialog({ debt }: { debt: DebtData }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await updateDebtAction(formData);
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
        <Button variant="outline" size="sm">
          <Pencil className="size-4 mr-2" />Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Debt</DialogTitle>
          <DialogDescription>Update the details for this debt.</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="id" value={debt.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input name="name" defaultValue={debt.name} required />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select name="type" defaultValue={debt.type}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEBT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Original Amount</Label>
              <Input name="originalPrincipal" type="number" step="0.01" defaultValue={debt.originalPrincipal} required />
            </div>
            <div className="space-y-1">
              <Label>Current Balance</Label>
              <Input name="currentBalance" type="number" step="0.01" defaultValue={debt.currentBalance} required />
            </div>
            <div className="space-y-1">
              <Label>Interest Rate (%)</Label>
              <Input name="interestRate" type="number" step="0.01" defaultValue={debt.interestRate * 100} />
            </div>
            <div className="space-y-1">
              <Label>Min Payment</Label>
              <Input name="minimumPayment" type="number" step="0.01" defaultValue={debt.minimumPayment ?? ""} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Lender</Label>
              <Input name="lender" defaultValue={debt.lender ?? ""} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DebtDeleteDialog({ debtId, debtName }: { debtId: string; debtName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="size-4 mr-2" />Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Debt</DialogTitle>
          <DialogDescription>
            Are you sure you want to permanently delete &quot;{debtName}&quot;? This will also delete all recorded payments. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <form action={deleteDebtAction}>
            <input type="hidden" name="id" value={debtId} />
            <Button type="submit" variant="destructive">Delete Permanently</Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
