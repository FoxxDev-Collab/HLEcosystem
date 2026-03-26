"use client";

import { useState } from "react";

type Member = {
  id: string;
  displayName: string;
};

export function ChoreAssigneePicker({ members }: { members: Member[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">Assign To</label>
      <div className="flex flex-wrap gap-2">
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => toggle(m.id)}
            className={`rounded-md border px-3 py-1.5 text-sm cursor-pointer transition-colors ${
              selected.has(m.id)
                ? "bg-primary/10 border-primary text-primary"
                : "hover:bg-accent"
            }`}
          >
            {m.displayName}
          </button>
        ))}
      </div>
      {/* Emit hidden inputs for selected members */}
      {members
        .filter((m) => selected.has(m.id))
        .map((m) => (
          <div key={m.id}>
            <input type="hidden" name="assigneeId" value={m.id} />
            <input type="hidden" name="assigneeName" value={m.displayName} />
          </div>
        ))}
      <p className="text-xs text-muted-foreground">
        Click to select household members for this chore.
      </p>
    </div>
  );
}
