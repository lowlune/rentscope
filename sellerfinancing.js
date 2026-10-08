// RentScope — seller-financing (owner-carried note) estimator.
// Pure ESM, usable in the browser and in Node tests. All values are USD;
// rates are annual percentages where noted.
//
// Models a purchase where the seller carries the note instead of (or in
// addition to) a bank loan:
//
//   * Down payment at closing, the rest financed by the seller.
//   * A fully amortizing note (equal monthly principal + interest), OR an
//     interest-only note.
//   * An optional balloon: the note amortizes over a longer schedule but the
//     remaining balance comes due at the balloon date (common with seller
//     carry). Setting the balloon term to the amortization term removes it.
//
// It is an educational estimate, not lending, legal or tax advice. It does NOT
// model: buyer closing costs, lender/loan-origination fees, prepayment
// penalties, late fees, taxes/insurance escrows, the seller's tax treatment
// (installment sale under IRC §453), due-on-sale issues with an existing
// mortgage, or the credit/legal terms of any note.

const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);

export const defaultInputsSellerFinancing = {
  salePrice: 300000,        // contract price of the property
  downPaymentPct: 10,       // cash down at closing, % of sale price
  interestRatePct: 6,       // annual note rate
  amortizationYears: 30,    // schedule the payment is based on
  balloonYears: 5,          // year the remaining balance comes due (<= amortization = no balloon)
  interestOnly: false,      // true = pay interest only, principal due at the balloon
};

export function sellerFinancing(input) {
  const i = { ...defaultInputsSellerFinancing, ...input };

  const salePrice = Math.max(i.salePrice, 0);
  const downPaymentPct = clamp(i.downPaymentPct, 0, 100);
  const downPaymentAmount = salePrice * downPaymentPct / 100;
  const loanAmount = Math.max(salePrice - downPaymentAmount, 0);

  const amortizationYears = Math.max(i.amortizationYears, 0);
  const amortizationMonths = Math.round(amortizationYears * 12);
  const monthlyRate = Math.max(i.interestRatePct, 0) / 100 / 12;

  // Decide the balloon timing. A balloon that is at or beyond the end of the
  // amortization schedule is not a balloon at all; a zero/negative balloon on
  // an amortizing note means "no balloon".
  const balloonYears = Math.max(i.balloonYears, 0);
  let balloonMonths = Math.round(balloonYears * 12);
  const interestOnly = !!i.interestOnly;
  let fullyAmortizing = false;
  if (loanAmount === 0) {
    // Nothing financed, so there is no note and no balloon.
    fullyAmortizing = true;
  } else if (!interestOnly && (balloonYears <= 0 || balloonMonths >= amortizationMonths)) {
    fullyAmortizing = true;
  }
  if (interestOnly && balloonMonths <= 0) {
    // An interest-only note with no stated balloon is due at the end of its term.
    balloonMonths = amortizationMonths;
  }
  balloonMonths = clamp(balloonMonths, 0, amortizationMonths);

  // Monthly payment.
  let monthlyPayment = 0;
  if (loanAmount > 0) {
    if (interestOnly) {
      monthlyPayment = loanAmount * monthlyRate;
    } else if (monthlyRate === 0) {
      monthlyPayment = amortizationMonths > 0 ? loanAmount / amortizationMonths : 0;
    } else {
      const f = Math.pow(1 + monthlyRate, amortizationMonths);
      monthlyPayment = loanAmount * monthlyRate * f / (f - 1);
    }
  }

  // Walk the note month by month up to the balloon, aggregating by year.
  // This is exact and avoids closed-form rounding drift.
  let balance = loanAmount;
  let totalInterest = 0;
  let totalPrincipal = 0;
  const schedule = [];
  let yInterest = 0;
  let yPrincipal = 0;
  let yStart = loanAmount;

  const flushYear = (year) => {
    schedule.push({
      year,
      startBalance: yStart,
      interest: yInterest,
      principal: yPrincipal,
      endBalance: balance,
    });
    yInterest = 0;
    yPrincipal = 0;
    yStart = balance;
  };

  for (let m = 1; m <= balloonMonths; m++) {
    const interest = balance * monthlyRate;
    let principal = interestOnly ? 0 : monthlyPayment - interest;
    if (principal < 0) principal = 0;
    if (principal > balance) principal = balance; // final-month cents rounding
    balance = Math.max(balance - principal, 0);
    totalInterest += interest;
    totalPrincipal += principal;
    yInterest += interest;
    yPrincipal += principal;
    if (m % 12 === 0) flushYear(m / 12);
  }
  if (balloonMonths > 0 && balloonMonths % 12 !== 0) {
    flushYear(Math.ceil(balloonMonths / 12));
  }

  const balloonBalance = balance;
  const hasBalloon = !fullyAmortizing && balloonBalance > 0.005;
  const balloonPayment = hasBalloon ? balloonBalance : 0;

  // Every dollar the buyer sends the seller: down payment + principal + interest
  // + the balloon payoff. Because principal + balloon = loan, this equals the
  // sale price plus the note's total interest.
  const totalPaid = downPaymentAmount + totalPrincipal + totalInterest + balloonPayment;
  const ltvPct = salePrice > 0 ? loanAmount / salePrice * 100 : 0;

  return {
    inputs: i,
    salePrice,
    downPaymentPct,
    downPaymentAmount,
    loanAmount,
    ltvPct,
    interestRatePct: i.interestRatePct,
    monthlyRate,
    amortizationYears,
    amortizationMonths,
    balloonYears: balloonMonths / 12,
    balloonMonths,
    interestOnly,
    fullyAmortizing,
    hasBalloon,
    monthlyPayment,
    totalInterest,
    totalPrincipal,
    balloonBalance,
    balloonPayment,
    totalPaid,
    monthsToBalloon: balloonMonths,
    schedule,
  };
}
