import assert from 'node:assert';
import { sellerFinancing } from './sellerfinancing.js';

let passed = 0;
function close(actual, expected, tol, name) {
  assert.ok(Math.abs(actual - expected) <= tol, `${name}: got ${actual}, want ${expected}±${tol}`);
  passed++;
}
function ok(name, cond) { assert.ok(cond, name); passed++; }

// ---------------------------------------------------------------------------
// Reference values were computed independently (closed-form amortization in
// Python) before this engine existed, so they are not circular.
// Default: $300,000 sale, 10% down, 6% note, 30-yr amortization, 5-yr balloon.
// ---------------------------------------------------------------------------
const d = sellerFinancing();
close(d.salePrice, 300000, 1e-9, 'sale price');
close(d.downPaymentPct, 10, 1e-9, 'down payment percent');
close(d.downPaymentAmount, 30000, 1e-9, 'down payment amount');
close(d.loanAmount, 270000, 1e-9, 'loan amount = price - down');
close(d.ltvPct, 90, 1e-9, 'LTV = 90%');
close(d.amortizationMonths, 360, 1e-9, '30-year amortization = 360 months');
close(d.balloonMonths, 60, 1e-9, '5-year balloon = 60 months');
close(d.monthlyPayment, 1618.786418, 0.01, 'monthly payment 270k @ 6% / 30 yr');
close(d.totalInterest, 78373.948496, 0.02, 'interest paid through the 5-year balloon');
close(d.totalPrincipal, 270000 - 251246.763422, 0.02, 'principal paid through the balloon');
close(d.balloonBalance, 251246.763422, 0.02, 'remaining balance at the balloon');
close(d.balloonPayment, d.balloonBalance, 1e-9, 'balloon payment equals remaining balance');
ok('has a balloon', d.hasBalloon === true);
ok('not fully amortizing when balloon < amortization', d.fullyAmortizing === false);
close(d.totalPaid, 300000 + d.totalInterest, 0.02, 'every dollar paid = price + total interest');
close(d.totalPaid, d.downPaymentAmount + d.monthlyPayment * 60 + d.balloonPayment, 1e-6, 'total paid = down + payments + balloon');

// ---------------------------------------------------------------------------
// Full amortization: no balloon when the balloon term reaches the end.
// ---------------------------------------------------------------------------
const full = sellerFinancing({ balloonYears: 30 });
ok('30-yr balloon is fully amortizing', full.fullyAmortizing === true);
ok('no balloon payment', full.hasBalloon === false);
close(full.balloonPayment, 0, 1e-9, 'balloon payment is zero');
close(full.balloonBalance, 0, 1e-6, 'balance is zero at the end');
close(full.totalPaid, 300000 + full.totalInterest, 0.02, 'full term total = price + interest');
close(full.monthlyPayment, d.monthlyPayment, 1e-9, 'same payment regardless of balloon');
const fullNoBalloon = sellerFinancing({ balloonYears: 0 });
ok('zero balloon means no balloon', fullNoBalloon.fullyAmortizing === true);
const fullOver = sellerFinancing({ balloonYears: 40 });
ok('balloon beyond term clamps to full amortization', fullOver.fullyAmortizing === true);
close(fullOver.balloonMonths, 360, 1e-9, 'balloon months clamped to amortization');

// ---------------------------------------------------------------------------
// Zero-interest note.
// ---------------------------------------------------------------------------
const zero = sellerFinancing({ salePrice: 120000, downPaymentPct: 0, interestRatePct: 0, amortizationYears: 10, balloonYears: 5 });
close(zero.loanAmount, 120000, 1e-9, 'zero-interest loan amount');
close(zero.monthlyPayment, 1000, 1e-9, 'zero-interest payment = principal / months');
close(zero.totalInterest, 0, 1e-9, 'zero-interest pays no interest');
close(zero.balloonBalance, 60000, 1e-6, 'zero-interest balance after 5 of 10 years');
close(zero.balloonPayment, 60000, 1e-6, 'zero-interest balloon');
close(zero.totalPaid, 120000, 1e-6, 'zero-interest total = price');

// ---------------------------------------------------------------------------
// Interest-only note: principal untouched until the balloon.
// ---------------------------------------------------------------------------
const io = sellerFinancing({ interestOnly: true });
close(io.monthlyPayment, 1350, 1e-9, 'interest-only payment = loan * monthly rate');
close(io.totalInterest, 81000, 1e-9, 'interest-only interest over 60 months');
close(io.totalPrincipal, 0, 1e-9, 'interest-only pays no principal');
close(io.balloonBalance, 270000, 1e-9, 'interest-only balloon is the full loan');
close(io.balloonPayment, 270000, 1e-9, 'interest-only balloon payment');
close(io.totalPaid, 30000 + 1350 * 60 + 270000, 1e-6, 'interest-only total paid');
ok('interest-only has a balloon', io.hasBalloon === true);
const ioNoBalloon = sellerFinancing({ interestOnly: true, balloonYears: 0 });
close(ioNoBalloon.balloonMonths, 360, 1e-9, 'interest-only with no balloon is due at term end');
close(ioNoBalloon.balloonBalance, 270000, 1e-9, 'interest-only no-balloon balance at term end');

// ---------------------------------------------------------------------------
// Down-payment edge cases.
// ---------------------------------------------------------------------------
const allCash = sellerFinancing({ downPaymentPct: 100 });
close(allCash.loanAmount, 0, 1e-9, '100% down -> no loan');
close(allCash.monthlyPayment, 0, 1e-9, 'no loan -> no payment');
close(allCash.totalInterest, 0, 1e-9, 'no loan -> no interest');
ok('no loan is fully amortizing', allCash.fullyAmortizing === true);
close(allCash.totalPaid, 300000, 1e-9, 'all-cash total = price');
const noDown = sellerFinancing({ downPaymentPct: 0 });
close(noDown.loanAmount, 300000, 1e-9, '0% down -> full price financed');
close(noDown.downPaymentAmount, 0, 1e-9, '0% down -> no cash down');
close(noDown.ltvPct, 100, 1e-9, '0% down -> 100% LTV');
const over = sellerFinancing({ downPaymentPct: 150 });
close(over.downPaymentPct, 100, 1e-9, 'down > 100% clamps to 100%');
const under = sellerFinancing({ downPaymentPct: -20 });
close(under.downPaymentPct, 0, 1e-9, 'down < 0% clamps to 0%');

// ---------------------------------------------------------------------------
// Structural invariants across a grid of scenarios.
// ---------------------------------------------------------------------------
for (const price of [150000, 300000, 750000]) {
  for (const dp of [0, 5, 10, 20, 50]) {
    for (const rate of [0, 4.5, 6, 9.5]) {
      for (const ioFlag of [false, true]) {
        const r = sellerFinancing({ salePrice: price, downPaymentPct: dp, interestRatePct: rate, interestOnly: ioFlag });
        const tag = `price=${price} dp=${dp} rate=${rate} io=${ioFlag}`;
        ok(`${tag}: non-negative balance`, r.balloonBalance >= -1e-6);
        ok(`${tag}: non-negative interest`, r.totalInterest >= -1e-9);
        ok(`${tag}: principal + balloon = loan`, Math.abs((r.totalPrincipal + r.balloonPayment) - r.loanAmount) < 0.05);
        ok(`${tag}: total paid = price + interest`, Math.abs(r.totalPaid - (price + r.totalInterest)) < 0.05);
        ok(`${tag}: schedule principal + balloon = loan`, Math.abs(r.schedule.reduce((s, y) => s + y.principal, 0) + r.balloonPayment - r.loanAmount) < 0.05);
        ok(`${tag}: schedule interest = total interest`, Math.abs(r.schedule.reduce((s, y) => s + y.interest, 0) - r.totalInterest) < 0.05);
        ok(`${tag}: balances non-increasing`, r.schedule.every((y, idx) => idx === 0 || y.endBalance <= r.schedule[idx - 1].endBalance + 1e-6));
        ok(`${tag}: end balance matches balloon`, Math.abs(r.schedule[r.schedule.length - 1].endBalance - r.balloonBalance) < 1e-6);
        if (ioFlag) ok(`${tag}: interest-only pays no principal`, r.totalPrincipal < 1e-9);
      }
    }
  }
}

console.log(`\nRentScope seller-financing tests: ${passed} assertions passed.`);
