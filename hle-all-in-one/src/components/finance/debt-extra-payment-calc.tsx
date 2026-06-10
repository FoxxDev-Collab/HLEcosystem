// Extra-payment savings calculator (legacy extra-payment-calc.tsx). Pure
// client-side math via src/lib/finance/amortization.ts — no server round-trip.
import { useState } from "react"
import { calculateExtraPaymentSavings } from "@/lib/finance/amortization"
import { formatCurrency } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function DebtExtraPaymentCalc({
  balance,
  annualRate,
  monthlyPayment,
}: {
  balance: number
  annualRate: number
  monthlyPayment: number
}) {
  const [extra, setExtra] = useState(0)
  const [result, setResult] = useState<ReturnType<
    typeof calculateExtraPaymentSavings
  > | null>(null)

  function calculate(amount: number) {
    if (amount <= 0) return
    setResult(
      calculateExtraPaymentSavings(balance, annualRate, monthlyPayment, amount)
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Extra Payment Calculator</CardTitle>
        <CardDescription>
          See how extra payments accelerate your payoff
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="extra-payment">Extra Monthly Payment</Label>
            <Input
              id="extra-payment"
              type="number"
              step="25"
              min="0"
              value={extra || ""}
              onChange={(e) => setExtra(parseFloat(e.target.value) || 0)}
              placeholder="e.g. 100"
              className="w-40"
            />
          </div>
          <Button onClick={() => calculate(extra)} disabled={extra <= 0}>
            Calculate
          </Button>
        </div>

        {result && (
          <div className="grid gap-4 border-t pt-4 md:grid-cols-3">
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center dark:border-green-900 dark:bg-green-950/30">
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                {result.monthsSaved}
              </div>
              <div className="text-xs text-muted-foreground">Months saved</div>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center dark:border-green-900 dark:bg-green-950/30">
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                {formatCurrency(result.interestSaved)}
              </div>
              <div className="text-xs text-muted-foreground">
                Interest saved
              </div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold">
                {result.withExtra.monthsRemaining}
              </div>
              <div className="text-xs text-muted-foreground">
                New payoff ({Math.floor(result.withExtra.monthsRemaining / 12)}y{" "}
                {result.withExtra.monthsRemaining % 12}m)
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {[50, 100, 200, 500].map((amount) => (
            <Button
              key={amount}
              variant="outline"
              size="sm"
              onClick={() => {
                setExtra(amount)
                calculate(amount)
              }}
            >
              +{formatCurrency(amount)}/mo
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
