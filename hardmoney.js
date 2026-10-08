// RentScope — hard-money / bridge-loan estimator.
// Pure ESM, usable in the browser and in Node tests. All values are USD;
// rates and percentages are annual where noted.
//
// Hard money is a short-term, higher-rate loan used mainly for fix-and-flip
// and bridge deals. It is usually priced with origination "points" (a percent
// of the loan paid at closing) and interest-only payments, with the full
// principal repaid when the property is sold or refinanced. This module models
// the cost of that capital:
//
//   * Loan amount from a purchase-price LTV and/or a rehab cost LTC.
//   * Origination points + flat closing fees.
//   * Interest-only payments (the common structure) OR a fully amortizing
//     payment over the term.
//   * Total cost of capital, cash to close and the optional ARV-based LTV.
//
// It is an educational estimate, not lending, legal, tax or investment advice.
// It does NOT model: draws on the rehab budget (many lenders disburse in
// phases), prepayment penalties, extension fees, late fees, taxes/insurance
// escrow, the profit on a flip once sold, or the credit/legal terms of any
// loan. Lender rates, LTV/LTC caps and fee schedules vary widely — treat every
// number here as an editable assumption.

const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);

export const defaultInputsHardMoney = {
  purchasePrice: 300000,   // contract price of the property
  rehabCost: 50000,        // planned renovation budget
  purchaseLtvPct: 85,      // price financed, % of purchase price
  rehabLtcPct: 100,        // rehab financed, % of rehab cost (loan-to-cost)
  arv: 0,                  // after-repair value (optional; 0 = not entered)
  interestRatePct: 12,     // annual note rate
  pointsPct: 3,            // origination points, % of the loan, paid at closing
  termMonths: 12,          // loan term (hard money is typically 6–18 months)
  otherFees: 1500,         // flat lender/closing fees (appraisal, doc, etc.)
  interestOnly: true,      // true = interest-only; false = fully amortizing
};

export function hardMoney(input) {
  const i = { ...defaultInputsHardMoney, ...input };

  const purchasePrice = Math.max(i.purchasePrice, 0);
  const rehabCost = Math.max(i.rehabCost, 0);
  const purchaseLtvPct = clamp(i.purchaseLtvPct, 0, 100);
  const rehabLtcPct = clamp(i.rehabLtcPct, 0, 100);
  const arv = Math.max(i.arv, 0);
  const interestRatePct = Math.max(i.interestRatePct, 0);
  const pointsPct = Math.max(i.pointsPct, 0);
  const termMonths = Math.max(Math.round(i.termMonths), 0);
  const otherFees = Math.max(i.otherFees, 0);
  const interestOnly = !!i.interestOnly;

  const purchaseLoan = purchasePrice * purchaseLtvPct / 100;
  const rehabLoan = rehabCost * rehabLtcPct / 100;
  const loanAmount = purchaseLoan + rehabLoan;

  const pointsCost = loanAmount * pointsPct / 100;
  const feesAtClosing = pointsCost + otherFees;
  const monthlyRate = interestRatePct / 100 / 12;

  // Monthly payment: interest-only (the usual hard-money structure) or a
  // fully amortizing payment over the stated term.
  let monthlyPayment = 0;
  let totalInterest = 0;
  if (loanAmount > 0 && termMonths > 0) {
    if (interestOnly) {
      monthlyPayment = loanAmount * monthlyRate;
      totalInterest = monthlyPayment * termMonths;
    } else if (monthlyRate === 0) {
      monthlyPayment = loanAmount / termMonths;
      totalInterest = 0;
    } else {
      const f = Math.pow(1 + monthlyRate, termMonths);
      monthlyPayment = loanAmount * monthlyRate * f / (f - 1);
      totalInterest = monthlyPayment * termMonths - loanAmount;
    }
  }

  // Points and fees are paid in cash at closing; interest is paid monthly.
  // A loan that is not interest-only repays principal along the way, so
  // nothing large is due at payoff; an interest-only loan returns the full
  // principal at sale/refinance.
  const totalCostOfCapital = feesAtClosing + totalInterest;
  const totalCashToClose = purchasePrice + rehabCost - loanAmount + feesAtClosing;
  const totalProjectCost = purchasePrice + rehabCost + totalCostOfCapital;

  const dueAtPayoff = interestOnly ? loanAmount : 0;
  const totalRepaid = loanAmount + totalInterest;
  const effectiveCostPctOfLoan = loanAmount > 0 ? totalCostOfCapital / loanAmount * 100 : 0;
  const annualizedCostPct = termMonths > 0 ? effectiveCostPctOfLoan / (termMonths / 12) : 0;
  const arvLtvPct = arv > 0 ? loanAmount / arv * 100 : null;

  return {
    inputs: i,
    purchasePrice,
    rehabCost,
    purchaseLtvPct,
    rehabLtcPct,
    arv,
    purchaseLoan,
    rehabLoan,
    loanAmount,
    interestRatePct,
    pointsPct,
    pointsCost,
    otherFees,
    feesAtClosing,
    termMonths,
    interestOnly,
    monthlyRate,
    monthlyPayment,
    totalInterest,
    totalRepaid,
    totalCostOfCapital,
    totalCashToClose,
    totalProjectCost,
    dueAtPayoff,
    effectiveCostPctOfLoan,
    annualizedCostPct,
    arvLtvPct,
  };
}
