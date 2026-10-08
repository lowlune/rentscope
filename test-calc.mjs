import assert from 'node:assert';
import { monthlyPayment, amortization, irr, analyze } from './calc.js';

let passed = 0;
function ok(name, cond) { assert.ok(cond, name); passed++; }
function close(actual, expected, tol, name) {
  assert.ok(Math.abs(actual - expected) <= tol, `${name}: got ${actual}, want ${expected}±${tol}`);
  passed++;
}

// monthly payment — standard mortgage
close(monthlyPayment(240000, 6.5, 30), 1517.06, 0.5, 'monthlyPayment');
close(monthlyPayment(200000, 0, 30), 555.5556, 0.01, 'monthlyPayment zero-rate');
close(monthlyPayment(0, 5, 30), 0, 1e-9, 'monthlyPayment zero principal');

// amortization pays off exactly
const a = amortization(240000, 6.5, 30);
ok('amort length', a.schedule.length === 360);
close(a.schedule[359].balance, 0, 1e-6, 'final balance zero');
close(a.balanceAt(0), 240000, 1e-9, 'balanceAt 0');
close(a.balanceAt(360), 0, 1e-9, 'balanceAt 360');
// balance strictly decreasing
ok('balance decreases', a.schedule.every((r, i) => i === 0 || r.balance <= a.schedule[i - 1].balance + 1e-9));

// IRR known cases
close(irr([-1000, 500, 500]) * 100, 0, 0.001, 'irr zero');
close(irr([-1000, 0, 1210]) * 100, 10, 0.001, 'irr ten');
ok('irr no sign change -> null', irr([-1, -2, -3]) === null);

// analyze — coherent relationships
const r = analyze({ purchasePrice: 300000, rentMonthly: 2400, propertyTaxAnnual: 3600, insuranceAnnual: 1500, downPaymentPct: 20, interestRate: 6.5, loanTermYears: 30 });
close(r.downPayment, 60000, 1e-9, 'downPayment');
close(r.loanAmount, 240000, 1e-9, 'loanAmount');
close(r.totalCashInvested, 60000 + 6000 + 10000, 1e-6, 'totalCashInvested');
close(r.noi, r.egi - r.opex, 1e-6, 'noi identity');
close(r.cashFlowYear1, r.noi - r.annualDebtService, 1e-6, 'cashflow identity');
close(r.monthlyCashFlow, r.cashFlowYear1 / 12, 1e-9, 'monthly cashflow');
close(r.breakEvenOccupancy, (r.opex + r.annualDebtService) / r.grossIncome * 100, 1e-9, 'breakeven');
ok('dscr positive', r.dscr > 0);
ok('10y projection', r.years.length === 10);
close(r.years[9].loanBalance, amortization(240000, 6.5, 30).balanceAt(120), 1e-6, 'balance at year10');
// total profit identity
close(r.totalProfit, r.years.reduce((s, y) => s + y.cashFlow, 0) + r.netSaleProceeds - r.totalCashInvested, 1e-6, 'totalProfit identity');
ok('irr is finite', r.irrPct !== null && isFinite(r.irrPct));

// no-loan scenario: cap rate == cash-on-cash when no debt and no other costs
const allCash = analyze({ purchasePrice: 100000, downPaymentPct: 100, interestRate: 0, closingCostsPct: 0, rehabCost: 0, rentMonthly: 1000, vacancyPct: 0, mgmtPct: 0, maintenancePct: 0, propertyTaxAnnual: 0, insuranceAnnual: 0, hoaMonthly: 0, utilitiesMonthly: 0 });
close(allCash.capRate, allCash.cashOnCash, 1e-9, 'all-cash cap==coc');

console.log(`\nRentScope calc tests: ${passed} assertions passed.`);
