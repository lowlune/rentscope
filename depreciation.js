// RentScope — rental property depreciation estimator.
// Pure ESM, usable in the browser and in Node tests. All values are USD;
// rates are annual percentages where noted.
//
// This is a transparent, simplified model of straight-line depreciation for
// income-producing real property under the Modified Accelerated Cost Recovery
// System (MACRS) using the mid-month convention:
//
//   * Residential rental property: 27.5-year recovery period.
//   * Nonresidential real property: 39-year recovery period.
//   * Land is not depreciable, so only the building basis is recovered.
//   * First-year deduction uses the mid-month convention: (12 - month + 0.5) / 12
//     of the annual amount (e.g. placed in service in June -> 6.5/12).
//
// It is an educational estimate, not tax advice. It does NOT model:
//   * cost segregation or bonus depreciation,
//   * Section 179 expensing,
//   * state depreciation differences,
//   * the 25% unrecaptured Section 1250 recapture rate interacting with capital
//     gains, the 3.8% net investment income tax, or passive-activity limits,
//   * personal-property depreciation for appliances/furniture,
//   * short-year or mid-quarter conventions.

export const RECOVERY_YEARS = {
  residential: 27.5, // residential rental property (IRS Pub. 946, Table A-6)
  commercial: 39,    // nonresidential real property (Table A-7a)
};

export const defaultInputsDepreciation = {
  purchasePrice: 350000,   // price paid for the property, including building + land
  improvements: 25000,     // capital improvements added to basis after purchase
  landValue: 90000,        // non-depreciable land value (building basis = basis - land)
  placedInServiceMonth: 6, // 1 = January ... 12 = December
  propertyType: 'residential',
  marginalTaxRatePct: 24,  // ordinary income-tax rate shielding the deduction
  holdYears: 10,           // years of depreciation to total
  recaptureRatePct: 25,    // unrecaptured Section 1250 gain rate at sale
};

export function depreciation(input) {
  const i = { ...defaultInputsDepreciation, ...input };

  const month = Math.min(12, Math.max(1, Math.round(i.placedInServiceMonth)));
  const recoveryYears = RECOVERY_YEARS[i.propertyType] || RECOVERY_YEARS.residential;

  const totalBasis = Math.max(i.purchasePrice, 0) + Math.max(i.improvements, 0);
  const landValue = Math.min(Math.max(i.landValue, 0), totalBasis);
  const depreciableBasis = totalBasis - landValue;

  const annualDepreciation = depreciableBasis / recoveryYears;
  const monthlyDepreciation = annualDepreciation / 12;

  // Mid-month convention: the property is treated as placed in service at the
  // midpoint of the month, so the first year gets (12 - month + 0.5) months.
  const firstYearMonths = 12 - month + 0.5;
  const firstYearDepreciation = Math.min(annualDepreciation * firstYearMonths / 12, depreciableBasis);
  const firstYearFactorPct = firstYearMonths / 12 / recoveryYears * 100;

  // Year-by-year deduction schedule over the requested holding period.
  const years = Math.max(0, Math.round(i.holdYears));
  const schedule = [];
  let accumulated = 0;
  for (let y = 1; y <= years; y++) {
    const base = y === 1 ? firstYearDepreciation : annualDepreciation;
    const deduction = Math.max(Math.min(base, depreciableBasis - accumulated), 0);
    accumulated += deduction;
    schedule.push({
      year: y,
      deduction,
      accumulated,
      adjustedBasis: totalBasis - accumulated,
    });
  }

  const totalDepreciation = accumulated;
  const remainingDepreciable = Math.max(depreciableBasis - totalDepreciation, 0);
  const fullyDepreciated = depreciableBasis > 0 && totalDepreciation >= depreciableBasis - 1e-9;

  const annualTaxSavings = annualDepreciation * i.marginalTaxRatePct / 100;
  const monthlyTaxSavings = annualTaxSavings / 12;
  const firstYearTaxSavings = firstYearDepreciation * i.marginalTaxRatePct / 100;
  const totalTaxSavings = totalDepreciation * i.marginalTaxRatePct / 100;

  // Unrecaptured Section 1250 gain on the depreciation actually claimed.
  const recaptureTax = totalDepreciation * i.recaptureRatePct / 100;

  return {
    inputs: i,
    propertyType: i.propertyType,
    recoveryYears,
    month,
    totalBasis,
    landValue,
    depreciableBasis,
    annualDepreciation,
    monthlyDepreciation,
    firstYearMonths,
    firstYearFactorPct,
    firstYearDepreciation,
    annualTaxSavings,
    monthlyTaxSavings,
    firstYearTaxSavings,
    schedule,
    totalDepreciation,
    totalTaxSavings,
    remainingDepreciable,
    fullyDepreciated,
    adjustedBasisAtEnd: totalBasis - totalDepreciation,
    recaptureTax,
  };
}
