"use client";

import { useState, useTransition, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Camera, Loader2, Check, RotateCcw, Sparkles } from "lucide-react";
import {
  scanReceiptAction,
  createTransactionsFromReceiptAction,
  suggestCategoryAction,
} from "@/app/(app)/receipts/actions";
import type { ReceiptScanResult, CategorySuggestion } from "@/app/(app)/receipts/actions";

type Account = { id: string; name: string; type: string };
type Category = { id: string; name: string; color: string | null };

type ReceiptData = {
  store: string;
  date: string;
  items: { name: string; price: number; category: string }[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string | null;
};

export function ReceiptScanner({ accounts, categories }: { accounts: Account[]; categories: Category[] }) {
  const [scanning, startScan] = useTransition();
  const [creating, startCreate] = useTransition();
  const [suggesting, startSuggest] = useTransition();
  const [result, setResult] = useState<ReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [suggestion, setSuggestion] = useState<CategorySuggestion>(null);

  // Auto-suggest category when receipt is scanned.
  // Previously used a manual `suggesting` state flipped synchronously inside
  // the effect, which violates react-hooks/set-state-in-effect in React 19.
  // `useTransition` gives us the pending flag without a synchronous setState.
  useEffect(() => {
    if (!result || categories.length === 0) return;

    const itemSummary = result.items.map((i) => i.name).join(", ");
    const categoryNames = categories.map((c) => c.name);

    startSuggest(async () => {
      const s = await suggestCategoryAction(result.store, itemSummary, categoryNames);
      setSuggestion(s);
      if (s) {
        const match = categories.find(
          (c) => c.name.toLowerCase() === s.category.toLowerCase()
        );
        if (match) setSelectedCategoryId(match.id);
      }
    });
  }, [result, categories]);

  const handleScan = (formData: FormData) => {
    setError(null);
    setResult(null);
    setSuggestion(null);
    setSelectedCategoryId("");

    // Show image preview
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

  const handleReset = () => {
    setResult(null);
    setError(null);
    setSuggestion(null);
    setSelectedCategoryId("");
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
  };

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const confidenceColor = (c: number) =>
    c >= 0.85 ? "text-green-600 dark:text-green-400" : c >= 0.6 ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground";

  return (
    <div className="space-y-6">
      {/* Upload Card */}
      {!result && (
        <Card>
          <CardHeader>
            <CardTitle>Scan Receipt</CardTitle>
            <CardDescription>
              Take a photo or upload an image of your receipt. Claude will extract the store, items, prices, and total.
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
                  JPEG, PNG, WebP, or GIF. Max 25 MB. On mobile, tap to use your camera.
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
                <img
                  src={preview}
                  alt="Receipt preview"
                  className="w-32 rounded-lg border object-cover"
                />
                <div className="text-sm text-muted-foreground pt-2">
                  Analyzing receipt with Claude...
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results Card */}
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
                          <TableCell>
                            <Badge variant="outline">{item.category}</Badge>
                          </TableCell>
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
                    {result.paymentMethod && (
                      <div className="flex justify-between text-xs pt-1">
                        <span className="text-muted-foreground">Payment</span>
                        <span>{result.paymentMethod}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Create Transaction Card */}
          <Card>
            <CardHeader>
              <CardTitle>Create Transaction</CardTitle>
              <CardDescription>
                Add this receipt as an expense transaction to one of your accounts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Create an account first.</p>
              ) : (
                <form action={createTransactionsFromReceiptAction} className="space-y-4">
                  <input type="hidden" name="receiptData" value={JSON.stringify(result)} />
                  <input type="hidden" name="categoryId" value={selectedCategoryId || ""} />

                  <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
                    <div className="space-y-2">
                      <Label>Account</Label>
                      <Select name="accountId" defaultValue={accounts[0]?.id}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name} ({a.type.replace("_", " ").toLowerCase()})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        Category
                        {suggesting && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
                      </Label>
                      <Select
                        value={selectedCategoryId}
                        onValueChange={setSelectedCategoryId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              <span className="flex items-center gap-2">
                                {c.color && (
                                  <span
                                    className="w-2 h-2 rounded-full inline-block"
                                    style={{ backgroundColor: c.color }}
                                  />
                                )}
                                {c.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* AI suggestion badge */}
                  {suggestion && (
                    <div className="flex items-center gap-2 text-xs">
                      <Sparkles className="size-3.5 text-primary" />
                      <span className="text-muted-foreground">
                        AI suggested <strong>{suggestion.category}</strong>
                      </span>
                      <span className={confidenceColor(suggestion.confidence)}>
                        ({Math.round(suggestion.confidence * 100)}% confident)
                      </span>
                      {suggestion.reasoning && (
                        <span className="text-muted-foreground hidden sm:inline">
                          &mdash; {suggestion.reasoning}
                        </span>
                      )}
                    </div>
                  )}

                  <Button type="submit" disabled={creating}>
                    {creating ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Check className="size-4 mr-2" />
                        Create Expense &mdash; {formatPrice(result.total)}
                      </>
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
