"use client";

import { useState } from "react";
import { calculateExtraPaymentSavings } from "@/lib/amortization";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ExtraPaymentCalculator({
  balance,
  annualRate,
  monthlyPayment,
}: {
  balance: number;
  annualRate: number;
  monthlyPayment: number;
}) {
  const [extra, setExtra] = useState(0);
  const [result, setResult] = useState<ReturnType<typeof calculateExtraPaymentSavings> | null>(null);

  function calculate() {
    if (extra <= 0) return;
    const r = calculateExtraPaymentSavings(balance, annualRate, monthlyPayment, extra);
    setResult(r);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Extra Payment Calculator</CardTitle>
        <CardDescription>See how extra payments accelerate your payoff</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3 items-end">
          <div className="space-y-1">
            <Label>Extra Monthly Payment</Label>
            <Input
              type="number"
              step="25"
              min="0"
              value={extra || ""}
              onChange={(e) => setExtra(parseFloat(e.target.value) || 0)}
              placeholder="e.g. 100"
              className="w-40"
            />
          </div>
          <Button onClick={calculate} disabled={extra <= 0}>Calculate</Button>
        </div>

        {result && (
          <div className="grid gap-4 md:grid-cols-3 pt-4 border-t">
            <div className="text-center p-3 rounded-lg border border-green-200 bg-green-50">
              <div className="text-2xl font-bold text-green-700">{result.monthsSaved}</div>
              <div className="text-xs text-muted-foreground">Months saved</div>
            </div>
            <div className="text-center p-3 rounded-lg border border-green-200 bg-green-50">
              <div className="text-2xl font-bold text-green-700">{formatCurrency(result.interestSaved)}</div>
              <div className="text-xs text-muted-foreground">Interest saved</div>
            </div>
            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold">{result.withExtra.monthsRemaining}</div>
              <div className="text-xs text-muted-foreground">New payoff ({Math.floor(result.withExtra.monthsRemaining / 12)}y {result.withExtra.monthsRemaining % 12}m)</div>
            </div>
          </div>
        )}

        {/* Quick presets */}
        <div className="flex flex-wrap gap-2">
          {[50, 100, 200, 500].map((amount) => (
            <Button
              key={amount}
              variant="outline"
              size="sm"
              onClick={() => {
                setExtra(amount);
                const r = calculateExtraPaymentSavings(balance, annualRate, monthlyPayment, amount);
                setResult(r);
              }}
            >
              +{formatCurrency(amount)}/mo
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
