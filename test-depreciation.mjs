import assert from 'node:assert';
import { depreciation, RECOVERY_YEARS } from './depreciation.js';

let passed = 0;
function close(actual, expected, tol, name) {
  assert.ok(Math.abs(actual - expected) <= tol, `${name}: got ${actual}, want ${expected}±${tol}`);
  passed++;
}
function ok(name, cond) { assert.ok(cond, name); passed++; }

// Recovery periods.
close(RECOVERY_YEARS.residential, 27.5, 1e-9, 'residential 27.5 years');
close(RECOVERY_YEARS.commercial, 39, 1e-9, 'commercial 39 years');

// Default example: 350k price + 25k improvements, 90k land, June, residential.
const d = depreciation();
close(d.totalBasis, 375000, 1e-9, 'total basis = price + improvements');
close(d.landValue, 90000, 1e-9, 'land value');
close(d.depreciableBasis, 285000, 1e-9, 'depreciable basis = basis - land');
close(d.recoveryYears, 27.5, 1e-9, 'default recovery 27.5');
close(d.annualDepreciation, 285000 / 27.5, 1e-9, 'annual straight-line depreciation');
close(d.monthlyDepreciation, 285000 / 27.5 / 12, 1e-9, 'monthly depreciation');
close(d.firstYearMonths, 6.5, 1e-9, 'mid-month convention June -> 6.5 months');
close(d.firstYearFactorPct, 6.5 / 12 / 27.5 * 100, 1e-9, 'first-year factor percent');
close(d.firstYearDepreciation, (285000 / 27.5) * 6.5 / 12, 1e-9, 'first-year deduction');
close(d.firstYearDepreciation + d.schedule[1].deduction, (285000 / 27.5) * (6.5 / 12 + 1), 1e-9, 'first two years sum');
close(d.annualTaxSavings, d.annualDepreciation * 0.24, 1e-9, 'annual tax savings at marginal rate');
close(d.monthlyTaxSavings, d.annualTaxSavings / 12, 1e-9, 'monthly tax savings');
close(d.firstYearTaxSavings, d.firstYearDepreciation * 0.24, 1e-9, 'first-year tax savings');
ok('schedule length = holdYears', d.schedule.length === 10);
close(d.schedule[0].deduction, d.firstYearDepreciation, 1e-9, 'schedule year 1 = first-year deduction');
close(d.schedule[1].deduction, d.annualDepreciation, 1e-9, 'schedule year 2 = full annual');
close(d.schedule[9].accumulated, d.totalDepreciation, 1e-9, 'accumulated over hold = total');
close(d.adjustedBasisAtEnd, d.totalBasis - d.totalDepreciation, 1e-9, 'adjusted basis at end');
close(d.recaptureTax, d.totalDepreciation * 0.25, 1e-9, 'recapture at 25%');
ok('not fully depreciated in 10 years', d.fullyDepreciated === false);

// Mid-month convention endpoints: January gets 11.5 months, December gets 0.5.
const jan = depreciation({ placedInServiceMonth: 1 });
close(jan.firstYearMonths, 11.5, 1e-9, 'January = 11.5 months');
close(jan.firstYearFactorPct, 11.5 / 12 / 27.5 * 100, 1e-9, 'January factor ~3.485%');
const dec = depreciation({ placedInServiceMonth: 12 });
close(dec.firstYearMonths, 0.5, 1e-9, 'December = 0.5 months');
close(dec.firstYearFactorPct, 0.5 / 12 / 27.5 * 100, 1e-9, 'December factor ~0.152%');
ok('January first year > December first year', jan.firstYearDepreciation > dec.firstYearDepreciation);

// Month clamping.
close(depreciation({ placedInServiceMonth: 0 }).firstYearMonths, 11.5, 1e-9, 'month 0 clamps to January');
close(depreciation({ placedInServiceMonth: 13 }).firstYearMonths, 0.5, 1e-9, 'month 13 clamps to December');

// Commercial property uses a 39-year recovery period.
const com = depreciation({ propertyType: 'commercial' });
close(com.recoveryYears, 39, 1e-9, 'commercial recovery 39');
close(com.annualDepreciation, 285000 / 39, 1e-9, 'commercial annual depreciation');
ok('commercial annual < residential annual', com.annualDepreciation < d.annualDepreciation);

// Land bases.
const noLand = depreciation({ landValue: 0 });
close(noLand.depreciableBasis, 375000, 1e-9, 'no land -> full basis depreciable');
const allLand = depreciation({ landValue: 500000 });
close(allLand.landValue, 375000, 1e-9, 'land clamped to total basis');
close(allLand.depreciableBasis, 0, 1e-9, 'all-land -> zero depreciable basis');
close(allLand.annualDepreciation, 0, 1e-9, 'zero annual depreciation');
close(allLand.totalDepreciation, 0, 1e-9, 'zero total depreciation');
ok('all-land not flagged fully depreciated', allLand.fullyDepreciated === false);

// Long hold fully depreciates and never exceeds basis.
const long = depreciation({ holdYears: 30 });
close(long.totalDepreciation, long.depreciableBasis, 1e-9, '30 years fully depreciates');
ok('fully depreciated flag', long.fullyDepreciated === true);
close(long.remainingDepreciable, 0, 1e-9, 'nothing left to depreciate');
close(long.adjustedBasisAtEnd, long.landValue, 1e-9, 'adjusted basis floors at land value');
ok('no single year exceeds annual', long.schedule.every((r, idx) => idx === 0 || r.deduction <= long.annualDepreciation + 1e-9));
ok('accumulated never exceeds basis', long.schedule.every((r) => r.accumulated <= long.depreciableBasis + 1e-9));

// Zero/negative purchase price is harmless.
const zero = depreciation({ purchasePrice: 0, improvements: 0, landValue: 0 });
close(zero.totalBasis, 0, 1e-9, 'zero basis');
close(zero.depreciableBasis, 0, 1e-9, 'zero depreciable basis');
close(zero.totalDepreciation, 0, 1e-9, 'zero depreciation');

console.log(`\nRentScope depreciation tests: ${passed} assertions passed.`);
