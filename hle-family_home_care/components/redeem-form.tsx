"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { redeemRewardAction } from "@/app/(app)/chores/actions";

type Member = {
  id: string;
  name: string;
  balance: number;
};

export function RedeemForm({
  rewardId,
  rewardCost,
  members,
}: {
  rewardId: string;
  rewardCost: number;
  members: Member[];
}) {
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const eligible = members.filter((m) => m.balance >= rewardCost);
  const selectedMember = members.find((m) => m.id === selectedId);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await redeemRewardAction(formData);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-2">
      <input type="hidden" name="rewardId" value={rewardId} />
      <input type="hidden" name="redeemedByName" value={selectedMember?.name ?? ""} />
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Redeem for</Label>
          <Select
            name="redeemedById"
            value={selectedId}
            onValueChange={setSelectedId}
            required
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select member" />
            </SelectTrigger>
            <SelectContent>
              {eligible.length === 0 ? (
                <SelectItem value="__none" disabled>
                  No one has enough points
                </SelectItem>
              ) : (
                eligible.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} ({m.balance} pts)
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" size="sm" className="h-8" disabled={!selectedId || eligible.length === 0}>
          Redeem
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
