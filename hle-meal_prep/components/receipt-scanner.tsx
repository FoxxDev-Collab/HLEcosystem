"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Camera, Loader2, Check, RotateCcw, DollarSign, Package } from "lucide-react";
import { scanReceiptAction, processReceiptAction } from "@/app/(app)/receipts/actions";
import type { ReceiptScanResult } from "@/app/(app)/receipts/actions";

type Store = { id: string; name: string };
type FinanceAccount = { id: string; name: string; type: string };
type FinanceCategory = { id: string; name: string; color: string | null };

type ReceiptData = {
  store: string;
  date: string;
  items: { name: string; price: number; category: string }[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string | null;
};

type Props = {
  stores: Store[];
  financeAccounts: FinanceAccount[];
  financeCategories: FinanceCategory[];
};

export function ReceiptScanner({ stores, financeAccounts, financeCategories }: Props) {
  const [scanning, startScan] = useTransition();
  const [processing, startProcess] = useTransition();
  const [result, setResult] = useState<ReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [addToFinance, setAddToFinance] = useState(true);
  const [success, setSuccess] = useState(false);

  const handleScan = (formData: FormData) => {
    setError(null);
    setResult(null);
    setSuccess(false);

    const file = formData.get("receipt") as File;
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    }

    startScan(async () => {
      const res: ReceiptScanResult = await scanReceiptAction(formData);
      if (res.success) {
        setResult(res.data);
      } else {
        setError(res.error);
      }
    });
  };

  const handleProcess = (formData: FormData) => {
    startProcess(async () => {
      const res = await processReceiptAction(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(true);
      }
    });
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setSuccess(false);
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
  };

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  // Try to auto-match store from receipt
  const matchedStore = result
    ? stores.find((s) => s.name.toLowerCase().includes(result.store.toLowerCase()) || result.store.toLowerCase().includes(s.name.toLowerCase()))
    : null;

  if (success) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Check className="size-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Receipt Processed</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {result?.items.length} price{result?.items.length !== 1 ? "s" : ""} recorded
              {addToFinance && " and expense added to Family Finance"}
            </p>
          </div>
          <Button variant="outline" onClick={handleReset}>
            <Camera className="size-4 mr-2" />
            Scan Another Receipt
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload */}
      {!result && (
        <Card>
          <CardHeader>
            <CardTitle>Scan Grocery Receipt</CardTitle>
            <CardDescription>
              Upload a receipt photo to track prices and optionally log the expense in Family Finance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={handleScan} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="receipt">Receipt Image</Label>
                <Input
                  id="receipt"
                  name="receipt"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  capture="environment"
                  required
                  disabled={scanning}
                />
                <p className="text-xs text-muted-foreground">
                  JPEG, PNG, WebP, or GIF. Max 25 MB.
                </p>
              </div>
              <Button type="submit" disabled={scanning}>
                {scanning ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Camera className="size-4 mr-2" />
                    Scan Receipt
                  </>
                )}
              </Button>
            </form>

            {scanning && preview && (
              <div className="mt-4 flex items-start gap-4">
                <img src={preview} alt="Receipt preview" className="w-32 rounded-lg border object-cover" />
                <div className="text-sm text-muted-foreground pt-2">Analyzing receipt with Claude...</div>
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{result.store}</CardTitle>
                  <CardDescription>{result.date}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="size-4 mr-2" />
                  Scan Another
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-6">
                {preview && (
                  <img
                    src={preview}
                    alt="Receipt"
                    className="w-28 rounded-lg border object-cover shrink-0 hidden sm:block"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.items.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell><Badge variant="outline">{item.category}</Badge></TableCell>
                          <TableCell className="text-right font-mono">{formatPrice(item.price)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="mt-4 space-y-1 text-sm border-t pt-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-mono">{formatPrice(result.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="font-mono">{formatPrice(result.tax)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-base border-t pt-2">
                      <span>Total</span>
                      <span className="font-mono">{formatPrice(result.total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Process Card */}
          <Card>
            <CardHeader>
              <CardTitle>Save Receipt Data</CardTitle>
              <CardDescription>
                Track item prices and optionally create an expense in Family Finance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={handleProcess} className="space-y-5">
                <input type="hidden" name="receiptData" value={JSON.stringify(result)} />
                <input type="hidden" name="addToFinance" value={addToFinance ? "true" : "false"} />

                {/* Store selection */}
                <div className="space-y-2 max-w-xs">
                  <Label className="flex items-center gap-2">
                    <Package className="size-4" />
                    Store
                  </Label>
                  {stores.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No stores configured. Add a store in the Stores page first.
                    </p>
                  ) : (
                    <Select name="storeId" defaultValue={matchedStore?.id || stores[0]?.id}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {stores.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Finance integration toggle */}
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="addToFinance"
                      checked={addToFinance}
                      onCheckedChange={(c) => setAddToFinance(c === true)}
                    />
                    <Label htmlFor="addToFinance" className="flex items-center gap-2 cursor-pointer">
                      <DollarSign className="size-4 text-primary" />
                      Also add expense to Family Finance
                    </Label>
                  </div>

                  {addToFinance && financeAccounts.length > 0 && (
                    <div className="grid gap-4 sm:grid-cols-2 pl-7">
                      <div className="space-y-2">
                        <Label className="text-xs">Finance Account</Label>
                        <Select name="financeAccountId" defaultValue={financeAccounts[0]?.id}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {financeAccounts.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Expense Category</Label>
                        <Select name="financeCategoryId" defaultValue={financeCategories.find((c) => c.name.toLowerCase().includes("grocer"))?.id || financeCategories[0]?.id}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {financeCategories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                <span className="flex items-center gap-2">
                                  {c.color && <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: c.color }} />}
                                  {c.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {addToFinance && financeAccounts.length === 0 && (
                    <p className="text-xs text-muted-foreground pl-7">
                      No finance accounts found. Create one in Family Finance first.
                    </p>
                  )}
                </div>

                <Button type="submit" disabled={processing || stores.length === 0}>
                  {processing ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Check className="size-4 mr-2" />
                      Save Prices{addToFinance ? " & Create Expense" : ""} &mdash; {formatPrice(result.total)}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
