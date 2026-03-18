"use client";

import { useActionState } from "react";
import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { createHouseholdAction, type ActionState } from "./actions";

export function CreateHouseholdForm() {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    createHouseholdAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state === null && !isPending) {
      formRef.current?.reset();
    }
  }, [state, isPending]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      {state?.error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}
      <div className="flex gap-3 items-end">
        <div className="space-y-1 flex-1 min-w-[200px]">
          <Label htmlFor="household-name" className="text-xs">
            Household Name
          </Label>
          <Input
            id="household-name"
            name="name"
            required
            placeholder="e.g. The Smith Family"
            className="h-9"
          />
        </div>
        <Button type="submit" size="sm" className="h-9" disabled={isPending}>
          <Plus className="size-4 mr-1" />
          {isPending ? "Creating..." : "Create"}
        </Button>
      </div>
    </form>
  );
}
