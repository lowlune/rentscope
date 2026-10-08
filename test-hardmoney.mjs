import assert from 'node:assert';
import { hardMoney } from './hardmoney.js';

let passed = 0;
function close(actual, expected, tol, name) {
  assert.ok(Math.abs(actual - expected) <= tol, `${name}: got ${actual}, want ${expected}±${tol}`);
  passed++;
}
function ok(name, cond) { assert.ok(cond, name); passed++; }

// ---------------------------------------------------------------------------
// Reference values were computed independently (plain closed-form arithmetic
// in Python) before this engine existed, so they are not circular.
// Default: $300,000 price + $50,000 rehab, 85% purchase LTV, 100% rehab LTC,
// 12% rate, 3 points, 12-month term, $1,500 other fees, interest-only.
// ---------------------------------------------------------------------------
const d = hardMoney();
close(d.purchaseLoan, 255000, 1e-9, 'purchase loan = 85% of 300k');
close(d.rehabLoan, 50000, 1e-9, 'rehab loan = 100% of 50k');
close(d.loanAmount, 305000, 1e-9, 'total loan = purchase + rehab');
close(d.pointsCost, 9150, 1e-9, 'points = 3% of 305k');
close(d.feesAtClosing, 10650, 1e-9, 'fees at closing = points + other fees');
close(d.monthlyRate, 0.01, 1e-12, 'monthly rate = 12%/12');
close(d.monthlyPayment, 3050, 1e-9, 'interest-only payment = loan * monthly rate');
close(d.totalInterest, 36600, 1e-6, 'interest-only interest over 12 months');
close(d.totalCostOfCapital, 47250, 1e-6, 'total cost of capital = fees + interest');
close(d.totalCashToClose, 55650, 1e-6, 'cash to close = price + rehab - loan + fees');
close(d.totalProjectCost, 397250, 1e-6, 'all-in project cost = price + rehab + cost of capital');
close(d.dueAtPayoff, 305000, 1e-9, 'interest-only principal due at payoff');
close(d.totalRepaid, 341600, 1e-6, 'total repaid = principal + interest');
close(d.effectiveCostPctOfLoan, 15.491803278688524, 1e-9, 'cost of capital as % of loan');
close(d.annualizedCostPct, 15.491803278688524, 1e-9, 'annualized cost over a 12-month term');
ok('ARV not entered -> no ARV LTV', d.arvLtvPct === null);

const withArv = hardMoney({ arv: 450000 });
close(withArv.arvLtvPct, 67.77777777777779, 1e-9, 'ARV-based LTV = loan / ARV');

// ---------------------------------------------------------------------------
// Fully amortizing: higher monthly payment, lower total interest, nothing due
// at payoff.
// ---------------------------------------------------------------------------
const amort = hardMoney({ interestOnly: false });
close(amort.monthlyPayment, 27098.88054689419, 0.01, 'fully amortizing payment over 12 months');
close(amort.totalInterest, 20186.566562730295, 0.02, 'amortizing total interest < interest-only');
ok('amortizing total interest is lower', amort.totalInterest < d.totalInterest);
close(amort.dueAtPayoff, 0, 1e-9, 'amortizing loan has nothing due at payoff');
close(amort.totalRepaid, amort.loanAmount + amort.totalInterest, 1e-6, 'amortizing repaid = principal + interest');
close(amort.monthlyPayment * amort.termMonths, amort.totalRepaid, 0.02, 'payments sum to total repaid');

// ---------------------------------------------------------------------------
// Zero-interest loan.
// ---------------------------------------------------------------------------
const zero = hardMoney({
  purchasePrice: 120000, rehabCost: 0, purchaseLtvPct: 100, interestRatePct: 0,
  pointsPct: 0, termMonths: 10, otherFees: 0, interestOnly: false,
});
close(zero.loanAmount, 120000, 1e-9, 'zero-interest loan amount');
close(zero.monthlyPayment, 12000, 1e-9, 'zero-interest payment = principal / months');
close(zero.totalInterest, 0, 1e-9, 'zero-interest pays no interest');
close(zero.totalCostOfCapital, 0, 1e-9, 'zero-interest has no cost of capital');
close(zero.totalCashToClose, 0, 1e-9, 'financed price -> no cash to close');

// ---------------------------------------------------------------------------
// Financing caps and edge cases.
// ---------------------------------------------------------------------------
const noRehabFinancing = hardMoney({ rehabLtcPct: 0 });
close(noRehabFinancing.rehabLoan, 0, 1e-9, '0% LTC -> rehab not financed');
close(noRehabFinancing.loanAmount, 255000, 1e-9, 'loan is purchase only');
const allCashRehab = hardMoney({ purchaseLtvPct: 100, rehabLtcPct: 100, otherFees: 0, pointsPct: 0 });
close(allCashRehab.totalCashToClose, 0, 1e-9, '100% LTV/LTC with no fees -> nothing down');
const overLtv = hardMoney({ purchaseLtvPct: 150, rehabLtcPct: 220 });
close(overLtv.purchaseLtvPct, 100, 1e-9, 'purchase LTV clamps to 100%');
close(overLtv.rehabLtcPct, 100, 1e-9, 'rehab LTC clamps to 100%');
const negative = hardMoney({ purchaseLtvPct: -10, rehabLtcPct: -5, pointsPct: -2, otherFees: -100 });
close(negative.purchaseLtvPct, 0, 1e-9, 'negative purchase LTV clamps to 0%');
close(negative.rehabLtcPct, 0, 1e-9, 'negative rehab LTC clamps to 0%');
close(negative.loanAmount, 0, 1e-9, 'no financing -> no loan');
close(negative.pointsCost, 0, 1e-9, 'no loan -> no points');
close(negative.monthlyPayment, 0, 1e-9, 'no loan -> no payment');
close(negative.dueAtPayoff, 0, 1e-9, 'no loan -> nothing due');
const zeroTerm = hardMoney({ termMonths: 0, interestOnly: false });
close(zeroTerm.monthlyPayment, 0, 1e-9, 'zero term -> no payment');
close(zeroTerm.totalInterest, 0, 1e-9, 'zero term -> no interest');

// ---------------------------------------------------------------------------
// Structural invariants across a grid of scenarios.
// ---------------------------------------------------------------------------
for (const price of [150000, 300000, 750000]) {
  for (const rehab of [0, 50000, 120000]) {
    for (const ltv of [70, 85, 90]) {
      for (const rate of [0, 9.5, 12, 15]) {
        for (const io of [true, false]) {
          const r = hardMoney({
            purchasePrice: price, rehabCost: rehab, purchaseLtvPct: ltv,
            interestRatePct: rate, interestOnly: io,
          });
          const tag = `price=${price} rehab=${rehab} ltv=${ltv} rate=${rate} io=${io}`;
          ok(`${tag}: non-negative loan`, r.loanAmount >= -1e-9);
          ok(`${tag}: non-negative cost`, r.totalCostOfCapital >= -1e-9);
          ok(`${tag}: non-negative interest`, r.totalInterest >= -1e-9);
          ok(`${tag}: points = pct of loan`, Math.abs(r.pointsCost - r.loanAmount * r.pointsPct / 100) < 1e-6);
          ok(`${tag}: fees match`, Math.abs(r.feesAtClosing - (r.pointsCost + r.otherFees)) < 1e-6);
          ok(`${tag}: cash-to-close identity`,
            Math.abs(r.totalCashToClose - (price + rehab - r.loanAmount + r.feesAtClosing)) < 1e-6);
          ok(`${tag}: project-cost identity`,
            Math.abs(r.totalProjectCost - (price + rehab + r.totalCostOfCapital)) < 1e-6);
          ok(`${tag}: repaid = principal + interest`,
            Math.abs(r.totalRepaid - (r.loanAmount + r.totalInterest)) < 1e-6);
          if (io) {
            ok(`${tag}: interest-only principal untouched`, Math.abs(r.dueAtPayoff - r.loanAmount) < 1e-6);
            ok(`${tag}: interest-only payment = loan * r`,
              Math.abs(r.monthlyPayment - r.loanAmount * r.monthlyRate) < 1e-6);
          } else {
            ok(`${tag}: amortizing balance cleared`, r.dueAtPayoff === 0);
            ok(`${tag}: amortizing payments sum to repaid`,
              Math.abs(r.monthlyPayment * r.termMonths - r.totalRepaid) < 0.05);
          }
        }
      }
    }
  }
}

console.log(`\nRentScope hard-money tests: ${passed} assertions passed.`);
