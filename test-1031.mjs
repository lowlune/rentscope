import assert from 'node:assert';
import { exchange1031 } from './exchange1031.js';

let passed = 0;
function close(actual, expected, tol, name) {
  assert.ok(Math.abs(actual - expected) <= tol, `${name}: got ${actual}, want ${expected}±${tol}`);
  passed++;
}
function ok(name, cond) { assert.ok(cond, name); passed++; }

// Fully deferred example: all equity reinvested, debt fully replaced.
const full = exchange1031({
  purchasePrice: 250000, improvements: 20000, accumulatedDepreciation: 60000,
  salePrice: 400000, sellingCostsPct: 6, mortgagePayoff: 150000, newMortgage: 150000,
  cashBoot: 0, taxRatePct: 25,
});
close(full.sellingCosts, 24000, 1e-9, 'sellingCosts');
close(full.amountRealized, 376000, 1e-9, 'amountRealized');
close(full.adjustedBasis, 210000, 1e-9, 'adjustedBasis');
close(full.realizedGain, 166000, 1e-9, 'realizedGain');
close(full.netProceeds, 226000, 1e-9, 'netProceeds');
close(full.boot, 0, 1e-9, 'boot zero when debt replaced');
close(full.recognizedGain, 0, 1e-9, 'recognized zero');
close(full.deferredGain, 166000, 1e-9, 'all gain deferred');
close(full.estimatedTaxOnBoot, 0, 1e-9, 'no tax on full deferral');
ok('fullyDeferred true', full.fullyDeferred === true);

// Cash boot is taxable, capped at realized gain.
const cash = exchange1031({ cashBoot: 50000 });
close(cash.debtRelief, 0, 1e-9, 'no debt relief');
close(cash.boot, 50000, 1e-9, 'boot = cash');
close(cash.recognizedGain, 50000, 1e-9, 'recognized = cash boot');
close(cash.deferredGain, 116000, 1e-9, 'remainder deferred');
close(cash.estimatedTaxOnBoot, 12500, 1e-9, 'tax at 25%');
ok('not fully deferred', cash.fullyDeferred === false);

// Mortgage boot: taking on less new debt than paid off.
const debt = exchange1031({ newMortgage: 100000, cashBoot: 0 });
close(debt.debtRelief, 50000, 1e-9, 'debt relief');
close(debt.recognizedGain, 50000, 1e-9, 'recognized = debt relief');
close(debt.deferredGain, 116000, 1e-9, 'remainder deferred');

// Recognition can never exceed realized gain.
const cap = exchange1031({ cashBoot: 500000, newMortgage: 150000 });
close(cap.boot, 500000, 1e-9, 'large boot');
close(cap.recognizedGain, cap.realizedGain, 1e-9, 'recognized capped at realized gain');
close(cap.deferredGain, 0, 1e-9, 'nothing deferred');

// A loss produces no recognized/deferred gain and no tax.
const loss = exchange1031({ purchasePrice: 400000, improvements: 0, accumulatedDepreciation: 0, salePrice: 380000, sellingCostsPct: 6, mortgagePayoff: 300000, newMortgage: 300000, cashBoot: 0 });
ok('loss realizedGain negative', loss.realizedGain < 0);
close(loss.recognizedGain, 0, 1e-9, 'no recognized gain on loss');
close(loss.deferredGain, 0, 1e-9, 'no deferred gain on loss');
close(loss.estimatedTaxOnBoot, 0, 1e-9, 'no tax on loss');
ok('loss not fully deferred flag', loss.fullyDeferred === false);

// Basis floor at zero when depreciation exceeds cost.
const basis0 = exchange1031({ purchasePrice: 100000, improvements: 0, accumulatedDepreciation: 130000 });
close(basis0.adjustedBasis, 0, 1e-9, 'adjusted basis floored at 0');
close(basis0.realizedGain, basis0.amountRealized, 1e-9, 'realized = amount realized at zero basis');

console.log(`\nRentScope 1031 tests: ${passed} assertions passed.`);
