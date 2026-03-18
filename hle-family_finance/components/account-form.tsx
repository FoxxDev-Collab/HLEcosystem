"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ACCOUNT_TYPES = [
  { value: "CHECKING", label: "Checking" },
  { value: "SAVINGS", label: "Savings" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "CASH", label: "Cash" },
  { value: "INVESTMENT", label: "Investment" },
  { value: "LOAN", label: "Loan" },
  { value: "HSA", label: "HSA" },
  { value: "OTHER", label: "Other" },
];

const COLORS = [
  "#6366f1", "#3b82f6", "#0ea5e9", "#14b8a6", "#22c55e",
  "#84cc16", "#eab308", "#f97316", "#ef4444", "#ec4899",
  "#a855f7", "#8b5cf6", "#64748b", "#78716c",
];

type Props = {
  action: (formData: FormData) => Promise<void>;
  defaultValues?: {
    id?: string;
    name?: string;
    type?: string;
    institution?: string;
    initialBalance?: number;
    color?: string;
  };
  submitLabel: string;
};

export function AccountForm({ action, defaultValues, submitLabel }: Props) {
  return (
    <form action={action} className="space-y-4 max-w-lg">
      {defaultValues?.id && <input type="hidden" name="id" value={defaultValues.id} />}

      <div className="space-y-2">
        <Label htmlFor="name">Account Name</Label>
        <Input id="name" name="name" defaultValue={defaultValues?.name} placeholder="e.g. Wells Fargo Checking" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Account Type</Label>
        <Select name="type" defaultValue={defaultValues?.type || "CHECKING"}>
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {ACCOUNT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="institution">Institution</Label>
        <Input id="institution" name="institution" defaultValue={defaultValues?.institution ?? ""} placeholder="e.g. Wells Fargo" />
      </div>

      {!defaultValues?.id && (
        <div className="space-y-2">
          <Label htmlFor="initialBalance">Starting Balance</Label>
          <Input
            id="initialBalance"
            name="initialBalance"
            type="number"
            step="0.01"
            defaultValue={defaultValues?.initialBalance ?? 0}
            placeholder="0.00"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((color) => (
            <label key={color} className="cursor-pointer">
              <input
                type="radio"
                name="color"
                value={color}
                defaultChecked={color === (defaultValues?.color || "#6366f1")}
                className="sr-only peer"
              />
              <div
                className="w-8 h-8 rounded-full border-2 border-transparent peer-checked:border-foreground peer-checked:ring-2 peer-checked:ring-offset-2 peer-checked:ring-foreground/20 transition-all"
                style={{ backgroundColor: color }}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
