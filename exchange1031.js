// RentScope — Section 1031 like-kind exchange estimator.
// Pure ESM, usable in the browser and in Node tests. All values are USD;
// rates are annual percentages where noted.
//
// This is a transparent, simplified model of the federal recognition rules for a
// real-estate like-kind exchange. It is an educational estimate, not tax advice.
// It does NOT model state conformity, depreciation recapture rates separately from
// long-term capital gains, suspended passive losses, related-party rules, or the
// 45/180-day identification and closing deadlines.

export const defaultInputs1031 = {
  purchasePrice: 250000,        // original price paid for the relinquished property
  improvements: 20000,          // capital improvements added to basis over the hold
  accumulatedDepreciation: 60000, // total depreciation claimed (straight-line)
  salePrice: 400000,            // contract sale price of the relinquished property
  sellingCostsPct: 6,           // commissions + closing costs, % of sale price
  mortgagePayoff: 150000,       // loan balance paid off at closing
  newMortgage: 150000,          // new debt on the replacement property
  cashBoot: 0,                  // cash the taxpayer keeps out of the proceeds
  taxRatePct: 25,               // blended rate applied to the taxable (boot) gain
};

export function exchange1031(input) {
  const i = { ...defaultInputs1031, ...input };

  const sellingCosts = i.salePrice * i.sellingCostsPct / 100;
  const amountRealized = i.salePrice - sellingCosts;
  const adjustedBasis = Math.max(i.purchasePrice + i.improvements - i.accumulatedDepreciation, 0);
  const realizedGain = amountRealized - adjustedBasis;

  // Cash left after paying off the old loan — the equity that must be reinvested.
  const netProceeds = amountRealized - i.mortgagePayoff;

  // Mortgage ("debt relief") boot: taking on less new debt than you paid off.
  const debtRelief = Math.max(i.mortgagePayoff - i.newMortgage, 0);
  const cashBoot = Math.max(i.cashBoot, 0);
  const boot = cashBoot + debtRelief;

  // Recognition is capped at the lesser of the realized gain or the boot received.
  const recognizedGain = Math.max(Math.min(realizedGain, boot), 0);
  const deferredGain = Math.max(realizedGain - recognizedGain, 0);
  const estimatedTaxOnBoot = recognizedGain * i.taxRatePct / 100;
  const fullyDeferred = realizedGain > 0 && recognizedGain === 0;

  return {
    inputs: i,
    sellingCosts,
    amountRealized,
    adjustedBasis,
    realizedGain,
    netProceeds,
    debtRelief,
    cashBoot,
    boot,
    recognizedGain,
    deferredGain,
    estimatedTaxOnBoot,
    fullyDeferred,
    // Helpful "what would it take to defer it all" figures.
    debtToReplace: Math.max(i.mortgagePayoff - i.newMortgage, 0),
    cashToReinvest: netProceeds,
  };
}
