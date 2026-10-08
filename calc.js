// RentScope — rental property analysis engine.
// Pure functions, ESM, usable in browser and Node (for tests).
// All monetary values are in dollars. Rates are annual percentages unless noted.

export function monthlyPayment(principal, annualRatePct, years) {
  if (principal <= 0) return 0;
  const n = years * 12;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  const f = Math.pow(1 + r, n);
  return principal * r * f / (f - 1);
}

// Returns { schedule: [...], balanceAt: (months)=>number }
export function amortization(principal, annualRatePct, years) {
  const n = years * 12;
  const r = annualRatePct / 100 / 12;
  const pay = monthlyPayment(principal, annualRatePct, years);
  let bal = principal;
  const schedule = [];
  for (let m = 1; m <= n; m++) {
    const interest = bal * r;
    let principalPaid = pay - interest;
    if (principalPaid > bal) principalPaid = bal;
    bal = bal - principalPaid;
    schedule.push({ month: m, payment: pay, interest, principal: principalPaid, balance: Math.max(bal, 0) });
  }
  return {
    schedule,
    balanceAt(months) {
      if (months <= 0) return principal;
      if (months >= n) return 0;
      return schedule[months - 1].balance;
    },
    monthlyPayment: pay,
  };
}

export function irr(cashflows, guessLow = -0.9999, guessHigh = 10) {
  const npv = (rate) => cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
  let lo = guessLow, hi = guessHigh;
  let flo = npv(lo), fhi = npv(hi);
  if (flo * fhi > 0) return null; // no sign change → no IRR in range
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fmid = npv(mid);
    if (Math.abs(fmid) < 1e-7) return mid;
    if (flo * fmid < 0) { hi = mid; fhi = fmid; } else { lo = mid; flo = fmid; }
  }
  return (lo + hi) / 2;
}

const DEFAULTS = {
  purchasePrice: 300000,
  closingCostsPct: 2,
  rehabCost: 10000,
  downPaymentPct: 20,
  interestRate: 6.5,
  loanTermYears: 30,
  rentMonthly: 2400,
  otherIncomeMonthly: 0,
  vacancyPct: 5,
  mgmtPct: 8,
  maintenancePct: 5,
  propertyTaxAnnual: 3600,
  insuranceAnnual: 1500,
  hoaMonthly: 0,
  utilitiesMonthly: 0,
  rentGrowthPct: 3,
  expenseGrowthPct: 2.5,
  appreciationPct: 3,
  holdYears: 10,
  sellingCostPct: 6,
};

export function analyze(input) {
  const i = { ...DEFAULTS, ...input };
  const closingCosts = i.purchasePrice * i.closingCostsPct / 100;
  const downPayment = i.purchasePrice * i.downPaymentPct / 100;
  const loanAmount = Math.max(i.purchasePrice - downPayment, 0);
  const totalCashInvested = downPayment + closingCosts + i.rehabCost;

  const amort = amortization(loanAmount, i.interestRate, i.loanTermYears);
  const annualDebtService = amort.monthlyPayment * 12;

  // Effective gross income (year 1)
  const grossRent = i.rentMonthly * 12;
  const otherIncome = i.otherIncomeMonthly * 12;
  const grossIncome = grossRent + otherIncome;
  const vacancyLoss = grossIncome * i.vacancyPct / 100;
  const egi = grossIncome - vacancyLoss;

  // Operating expenses (year 1) — management on collected rent, maintenance on gross rent
  const mgmt = grossRent * (1 - i.vacancyPct / 100) * i.mgmtPct / 100;
  const maintenance = grossRent * i.maintenancePct / 100;
  const opex = mgmt + maintenance + i.propertyTaxAnnual + i.insuranceAnnual +
    i.hoaMonthly * 12 + i.utilitiesMonthly * 12;

  const noi = egi - opex;
  const cashFlowYear1 = noi - annualDebtService;
  const capRate = noi / i.purchasePrice * 100;
  const totalCapRate = noi / (i.purchasePrice + closingCosts + i.rehabCost) * 100;
  const cashOnCash = totalCashInvested > 0 ? cashFlowYear1 / totalCashInvested * 100 : 0;
  const dscr = annualDebtService > 0 ? noi / annualDebtService : Infinity;
  const grossRentMultiplier = grossIncome > 0 ? i.purchasePrice / grossIncome : 0;
  const onePercentRule = i.rentMonthly / i.purchasePrice * 100;
  const breakEvenOccupancy = grossIncome > 0
    ? (opex + annualDebtService) / grossIncome * 100 : 0;

  // Multi-year projection
  const years = [];
  let cumCashFlow = 0;
  const cashflows = [-totalCashInvested];
  for (let y = 1; y <= i.holdYears; y++) {
    const rentY = grossRent * Math.pow(1 + i.rentGrowthPct / 100, y - 1);
    const otherY = otherIncome * Math.pow(1 + i.rentGrowthPct / 100, y - 1);
    const grossY = rentY + otherY;
    const egiY = grossY * (1 - i.vacancyPct / 100);
    const growth = Math.pow(1 + i.expenseGrowthPct / 100, y - 1);
    const opexY = (mgmt + maintenance + i.propertyTaxAnnual + i.insuranceAnnual) * growth +
      (i.hoaMonthly + i.utilitiesMonthly) * 12 * growth;
    const noiY = egiY - opexY;
    const cfY = noiY - annualDebtService;
    cumCashFlow += cfY;
    cashflows.push(cfY);
    const valueY = i.purchasePrice * Math.pow(1 + i.appreciationPct / 100, y);
    const balanceY = amort.balanceAt(Math.min(y * 12, i.loanTermYears * 12));
    const equityY = valueY - balanceY;
    years.push({
      year: y, grossIncome: grossY, opex: opexY, noi: noiY,
      debtService: annualDebtService, cashFlow: cfY, cumCashFlow,
      propertyValue: valueY, loanBalance: balanceY, equity: equityY,
    });
  }

  // Exit
  const exitYear = years[years.length - 1];
  const salePrice = exitYear.propertyValue;
  const sellingCosts = salePrice * i.sellingCostPct / 100;
  const loanPayoff = exitYear.loanBalance;
  const netSaleProceeds = salePrice - sellingCosts - loanPayoff;
  const totalProfit = cumCashFlow + netSaleProceeds - totalCashInvested;
  const totalReturn = totalCashInvested > 0 ? totalProfit / totalCashInvested * 100 : 0;
  const equityMultiple = totalCashInvested > 0 ? (cumCashFlow + netSaleProceeds) / totalCashInvested : 0;

  // Put sale proceeds into the final cashflow for IRR
  const irrFlows = cashflows.slice();
  irrFlows[irrFlows.length - 1] += netSaleProceeds;
  const irrPct = irr(irrFlows);

  return {
    inputs: i,
    loanAmount, downPayment, closingCosts, totalCashInvested,
    monthlyPayment: amort.monthlyPayment, annualDebtService,
    grossIncome, vacancyLoss, egi, opex, noi,
    cashFlowYear1, monthlyCashFlow: cashFlowYear1 / 12,
    capRate, totalCapRate, cashOnCash, dscr, grossRentMultiplier,
    onePercentRule, breakEvenOccupancy,
    years,
    salePrice, sellingCosts, loanPayoff, netSaleProceeds,
    totalProfit, totalReturn, equityMultiple,
    irrPct: irrPct === null ? null : irrPct * 100,
    projectionIrrFlows: irrFlows,
  };
}

export const defaultInputs = DEFAULTS;
