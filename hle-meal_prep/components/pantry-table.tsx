"use client";

import { useRef, useTransition } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatUnit, formatDate } from "@/lib/format";
import {
  updatePantryQuantityAction,
  adjustPantryAction,
  setPantryMinAction,
  setExpirationAction,
  removeFromPantryAction,
} from "@/app/(app)/pantry/actions";
import type { PantryItemData } from "@/hooks/use-pantry";

type FilterTab = "all" | "in-stock" | "low-stock" | "out-of-stock" | "expiring";

function getStockStatus(
  quantity: number,
  minQuantity: number | null
): { label: string; variant: "default" | "secondary" | "destructive" | "outline"; key: FilterTab } {
  if (quantity <= 0) {
    return { label: "Out", variant: "destructive", key: "out-of-stock" };
  }
  if (minQuantity !== null && quantity <= minQuantity) {
    return { label: "Low", variant: "secondary", key: "low-stock" };
  }
  return { label: "In Stock", variant: "default", key: "in-stock" };
}

function getExpirationStatus(expiresAt: string | null): {
  label: string;
  className: string;
  isExpired: boolean;
  isExpiringSoon: boolean;
} | null {
  if (!expiresAt) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expDate = new Date(expiresAt);
  const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) {
    return { label: `Expired ${Math.abs(diffDays)}d ago`, className: "pantry-out font-medium", isExpired: true, isExpiringSoon: false };
  }
  if (diffDays === 0) {
    return { label: "Expires today", className: "pantry-out font-medium", isExpired: false, isExpiringSoon: true };
  }
  if (diffDays <= 3) {
    return { label: `Expires in ${diffDays}d`, className: "pantry-low font-medium", isExpired: false, isExpiringSoon: true };
  }
  if (diffDays <= 7) {
    return { label: `Expires in ${diffDays}d`, className: "pantry-low", isExpired: false, isExpiringSoon: true };
  }
  return { label: formatDate(expiresAt), className: "text-muted-foreground", isExpired: false, isExpiringSoon: false };
}

const ROW_HEIGHT = 52;
const OVERSCAN = 10;

export function PantryTable({ items }: { items: PantryItemData[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["pantry"] });
  }

  function handleAction(action: (formData: FormData) => Promise<void>, formData: FormData) {
    startTransition(async () => {
      await action(formData);
      invalidate();
    });
  }

  return (
    <div
      ref={parentRef}
      className="overflow-auto"
      style={{ maxHeight: "70vh" }}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead className="w-36">Quantity</TableHead>
            <TableHead className="w-28">Min Qty</TableHead>
            <TableHead className="w-32">Expires</TableHead>
            <TableHead className="w-20">Status</TableHead>
            <TableHead className="w-24">Quick</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {virtualizer.getVirtualItems().length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                No items found
              </TableCell>
            </TableRow>
          ) : null}
          {/* Spacer for virtual items above */}
          {virtualizer.getVirtualItems().length > 0 && virtualizer.getVirtualItems()[0].start > 0 && (
            <TableRow style={{ height: virtualizer.getVirtualItems()[0].start }}>
              <TableCell colSpan={7} className="p-0" />
            </TableRow>
          )}
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = items[virtualRow.index];
            const qty = item.quantity;
            const min = item.minQuantity;
            const status = getStockStatus(qty, min);
            const expStatus = getExpirationStatus(item.expiresAt);
            const unitLabel = item.unit
              ? formatUnit(item.unit)
              : formatUnit(item.product.defaultUnit);

            return (
              <TableRow
                key={item.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className={expStatus?.isExpired ? "bg-destructive/5" : ""}
              >
                <TableCell>
                  <div>
                    <span className="font-medium">{item.product.name}</span>
                    {item.product.brand && (
                      <span className="text-muted-foreground"> ({item.product.brand})</span>
                    )}
                  </div>
                  {item.product.category && (
                    <Badge variant="secondary" className="mt-0.5 text-xs">
                      {item.product.category.name}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <form
                    action={(formData) => handleAction(updatePantryQuantityAction, formData)}
                    className="flex items-center gap-1"
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <Input
                      name="quantity"
                      type="number"
                      step="0.001"
                      min="0"
                      defaultValue={qty}
                      className="h-8 w-20"
                    />
                    <span className="text-xs text-muted-foreground">{unitLabel}</span>
                    <Button type="submit" variant="ghost" size="sm" className="h-8 px-2 text-xs" disabled={isPending}>
                      Set
                    </Button>
                  </form>
                </TableCell>
                <TableCell>
                  <form
                    action={(formData) => handleAction(setPantryMinAction, formData)}
                    className="flex items-center gap-1"
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <Input
                      name="minQuantity"
                      type="number"
                      step="0.001"
                      min="0"
                      defaultValue={min ?? ""}
                      placeholder="-"
                      className="h-8 w-16"
                    />
                    <Button type="submit" variant="ghost" size="sm" className="h-8 px-2 text-xs" disabled={isPending}>
                      Set
                    </Button>
                  </form>
                </TableCell>
                <TableCell>
                  <form
                    action={(formData) => handleAction(setExpirationAction, formData)}
                    className="flex items-center gap-1"
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <Input
                      name="expiresAt"
                      type="date"
                      defaultValue={item.expiresAt ? new Date(item.expiresAt).toISOString().split("T")[0] : ""}
                      className="h-8 w-32"
                    />
                    <Button type="submit" variant="ghost" size="sm" className="h-8 px-2 text-xs" disabled={isPending}>
                      Set
                    </Button>
                  </form>
                  {expStatus && (
                    <span className={`text-[10px] ${expStatus.className}`}>
                      {expStatus.label}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <form action={(formData) => handleAction(adjustPantryAction, formData)}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="amount" value="-1" />
                      <Button type="submit" variant="outline" size="sm" className="h-8 w-8 p-0" disabled={isPending}>
                        <Minus className="size-3" />
                      </Button>
                    </form>
                    <form action={(formData) => handleAction(adjustPantryAction, formData)}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="amount" value="1" />
                      <Button type="submit" variant="outline" size="sm" className="h-8 w-8 p-0" disabled={isPending}>
                        <Plus className="size-3" />
                      </Button>
                    </form>
                  </div>
                </TableCell>
                <TableCell>
                  <form action={(formData) => handleAction(removeFromPantryAction, formData)}>
                    <input type="hidden" name="id" value={item.id} />
                    <Button type="submit" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" disabled={isPending}>
                      <Trash2 className="size-4" />
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            );
          })}
          {/* Spacer for virtual items below */}
          {virtualizer.getVirtualItems().length > 0 && (
            <TableRow
              style={{
                height:
                  virtualizer.getTotalSize() -
                  (virtualizer.getVirtualItems()[virtualizer.getVirtualItems().length - 1].end),
              }}
            >
              <TableCell colSpan={7} className="p-0" />
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
