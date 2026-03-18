"use client";

import { useRef } from "react";
import { adjustBalanceAction } from "@/app/(app)/accounts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scale } from "lucide-react";

export function AdjustBalanceForm({
  accountId,
  currentBalance,
}: {
  accountId: string;
  currentBalance: number;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await adjustBalanceAction(formData);
        formRef.current?.reset();
      }}
      className="flex items-end gap-3"
    >
      <input type="hidden" name="accountId" value={accountId} />
      <div className="flex-1 space-y-1">
        <Label className="text-xs">Correct Balance</Label>
        <Input
          name="targetBalance"
          type="number"
          step="0.01"
          placeholder={currentBalance.toFixed(2)}
          required
        />
      </div>
      <Button type="submit" variant="outline" size="sm">
        <Scale className="size-3.5 mr-1.5" />
        Adjust
      </Button>
    </form>
  );
}
