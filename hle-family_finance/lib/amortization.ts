export type AmortizationRow = {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
};

export type PayoffProjection = {
  schedule: AmortizationRow[];
  totalPayments: number;
  totalInterest: number;
  totalPrincipal: number;
  monthsRemaining: number;
  payoffDate: Date;
};

/**
 * Calculate amortization schedule for a debt.
 * @param balance Current outstanding balance
 * @param annualRate Annual interest rate as decimal (e.g. 0.065 for 6.5%)
 * @param monthlyPayment Fixed monthly payment amount
 * @param extraMonthly Optional extra principal payment per month
 * @param maxMonths Safety limit to prevent infinite loops
 */
export function calculateAmortization(
  balance: number,
  annualRate: number,
  monthlyPayment: number,
  extraMonthly = 0,
  maxMonths = 600 // 50 years
): PayoffProjection {
  const monthlyRate = annualRate / 12;
  const schedule: AmortizationRow[] = [];
  let remaining = balance;
  let totalInterest = 0;
  let totalPrincipal = 0;
  let month = 0;

  while (remaining > 0.01 && month < maxMonths) {
    month++;
    const interest = remaining * monthlyRate;
    const totalPaymentThisMonth = Math.min(remaining + interest, monthlyPayment + extraMonthly);
    const principal = totalPaymentThisMonth - interest;
    remaining = Math.max(0, remaining - principal);

    totalInterest += interest;
    totalPrincipal += principal;

    schedule.push({
      month,
      payment: Math.round(totalPaymentThisMonth * 100) / 100,
      principal: Math.round(principal * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      balance: Math.round(remaining * 100) / 100,
    });
  }

  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + month);

  return {
    schedule,
    totalPayments: Math.round((totalInterest + totalPrincipal) * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalPrincipal: Math.round(totalPrincipal * 100) / 100,
    monthsRemaining: month,
    payoffDate,
  };
}

/**
 * Calculate savings from making extra payments.
 */
export function calculateExtraPaymentSavings(
  balance: number,
  annualRate: number,
  monthlyPayment: number,
  extraMonthly: number
): {
  withoutExtra: PayoffProjection;
  withExtra: PayoffProjection;
  monthsSaved: number;
  interestSaved: number;
} {
  const withoutExtra = calculateAmortization(balance, annualRate, monthlyPayment);
  const withExtra = calculateAmortization(balance, annualRate, monthlyPayment, extraMonthly);

  return {
    withoutExtra,
    withExtra,
    monthsSaved: withoutExtra.monthsRemaining - withExtra.monthsRemaining,
    interestSaved: withoutExtra.totalInterest - withExtra.totalInterest,
  };
}
