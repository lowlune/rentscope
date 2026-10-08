import { analyze } from './calc.js';
import { PRO_URL } from './store.js';

// Store link comes from ./store.js (single source of truth). '#pro' means "not on
// sale yet" — the anchors then scroll to the on-page Pro section.
const GUMROAD_URL = PRO_URL || '#pro';

const $ = (id) => document.getElementById(id);
const FIELDS = [
  'purchasePrice','closingCostsPct','rehabCost','downPaymentPct','interestRate','loanTermYears',
  'rentMonthly','otherIncomeMonthly','vacancyPct','mgmtPct','maintenancePct','propertyTaxAnnual',
  'insuranceAnnual','hoaMonthly','utilitiesMonthly','rentGrowthPct','expenseGrowthPct',
  'appreciationPct','holdYears','sellingCostPct',
];

const money = (n, d = 0) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n, d = 2) => (n === Infinity ? '∞' : (n ?? 0).toFixed(d) + '%');

function readInputs() {
  const o = {};
  for (const f of FIELDS) { const v = parseFloat($(f).value); o[f] = isNaN(v) ? 0 : v; }
  return o;
}

function syncURL(o) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (o[k] !== undefined) p.set(k, v);
  history.replaceState(null, '', location.pathname + '?' + p.toString());
}
function loadFromURL() {
  const p = new URLSearchParams(location.search);
  for (const f of FIELDS) if (p.has(f)) { const v = parseFloat(p.get(f)); if (!isNaN(v)) $(f).value = v; }
}

function metricHTML(r) {
  const cfClass = r.monthlyCashFlow >= 0 ? 'pos' : 'neg';
  const cards = [
    ['Monthly cash flow', money(r.monthlyCashFlow), cfClass, `${money(r.cashFlowYear1)}/yr after debt`],
    ['Cap rate', pct(r.capRate), '', `${money(r.noi)} NOI`],
    ['Cash-on-cash', pct(r.cashOnCash), r.cashOnCash >= 0 ? 'pos' : 'neg', `${money(r.totalCashInvested)} invested`],
    ['DSCR', r.dscr === Infinity ? '∞' : r.dscr.toFixed(2), r.dscr >= 1.25 ? 'pos' : (r.dscr < 1 ? 'neg' : ''), r.dscr >= 1.25 ? 'Lender-friendly' : 'Below 1.25'],
    ['IRR (levered)', r.irrPct === null ? '—' : pct(r.irrPct), (r.irrPct ?? 0) >= 0 ? 'pos' : 'neg', `${r.inputs.holdYears}-yr hold`],
    ['Total profit', money(r.totalProfit), r.totalProfit >= 0 ? 'pos' : 'neg', `${pct(r.totalReturn, 0)} return`],
  ];
  return cards.map(([k, v, c, s]) =>
    `<div class="metric"><div class="k">${k}</div><div class="v ${c}">${v}</div><div class="sub">${s}</div></div>`).join('');
}

function tableHTML(r) {
  const rows = r.years.map(y => `<tr>
    <td>${y.year}</td><td>${money(y.grossIncome)}</td><td>${money(y.opex)}</td>
    <td>${money(y.noi)}</td><td class="${y.cashFlow >= 0 ? 'pos' : 'neg'}">${money(y.cashFlow)}</td>
    <td>${money(y.propertyValue)}</td><td>${money(y.equity)}</td></tr>`).join('');
  return `<div class="tbl-wrap"><table><thead><tr>
    <th>Year</th><th>Gross income</th><th>Op. expenses</th><th>NOI</th>
    <th>Cash flow</th><th>Property value</th><th>Equity</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function drawChart(r) {
  const c = $('chart'); if (!c) return;
  const dpr = window.devicePixelRatio || 1;
  const w = c.clientWidth, h = c.clientHeight;
  c.width = w * dpr; c.height = h * dpr;
  const x = c.getContext('2d'); if (!x) return;
  x.scale(dpr, dpr); x.clearRect(0, 0, w, h);
  const pad = { l: 52, r: 12, t: 16, b: 26 };
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const cfs = r.years.map(y => y.cashFlow);
  const eq = r.years.map(y => y.equity);
  const maxV = Math.max(1, ...cfs.map(Math.abs), ...eq);
  const x0 = pad.l, y0 = pad.t + ih;
  const barW = iw / r.years.length * 0.55;
  // bars: annual cash flow
  r.years.forEach((y, i) => {
    const cx = x0 + (iw / r.years.length) * i + (iw / r.years.length) / 2;
    const bh = Math.abs(y.cashFlow) / maxV * ih * 0.45;
    x.fillStyle = y.cashFlow >= 0 ? 'rgba(61,220,151,.85)' : 'rgba(255,107,107,.85)';
    x.fillRect(cx - barW / 2, y0 - bh, barW, bh);
  });
  // line: equity
  x.beginPath(); x.strokeStyle = '#4aa8ff'; x.lineWidth = 2.5;
  eq.forEach((v, i) => {
    const cx = x0 + (iw / r.years.length) * i + (iw / r.years.length) / 2;
    const cy = y0 - (v / maxV) * ih;
    i ? x.lineTo(cx, cy) : x.moveTo(cx, cy);
  });
  x.stroke();
  // axis + labels
  x.strokeStyle = 'rgba(147,162,189,.4)'; x.lineWidth = 1;
  x.beginPath(); x.moveTo(x0, pad.t); x.lineTo(x0, y0); x.lineTo(x0 + iw, y0); x.stroke();
  x.fillStyle = '#93a2bd'; x.font = '11px sans-serif';
  x.fillText(money(maxV), 4, pad.t + 8);
  x.fillText('$0', 30, y0 - 3);
  const step = Math.ceil(r.years.length / 10);
  r.years.forEach((y, i) => {
    if (i % step) return;
    const cx = x0 + (iw / r.years.length) * i + (iw / r.years.length) / 2;
    x.fillText(String(y.year), cx - 4, h - 8);
  });
  x.fillStyle = '#3ddc97'; x.fillText('■ cash flow', x0 + iw - 150, 12);
  x.fillStyle = '#4aa8ff'; x.fillText('— equity', x0 + iw - 60, 12);
}

export function render() {
  const o = readInputs();
  const r = analyze(o);
  $('metrics').innerHTML = metricHTML(r);
  $('projection').innerHTML = tableHTML(r);
  drawChart(r);
  syncURL(o);
  window.__rentscope = r; // for debugging / tests
  return r;
}

function csv() {
  const r = window.__rentscope || render();
  const head = ['Year', 'GrossIncome', 'OperatingExpenses', 'NOI', 'DebtService', 'CashFlow', 'CumCashFlow', 'PropertyValue', 'LoanBalance', 'Equity'];
  const lines = [head.join(',')];
  for (const y of r.years) lines.push([y.year, y.grossIncome, y.opex, y.noi, y.debtService, y.cashFlow, y.cumCashFlow, y.propertyValue, y.loanBalance, y.equity].map(n => Math.round(n * 100) / 100).join(','));
  lines.push('');
  lines.push(['Summary'].join(','));
  for (const [k, v] of Object.entries({ MonthlyCashFlow: r.monthlyCashFlow, NOI: r.noi, CapRatePct: r.capRate, CashOnCashPct: r.cashOnCash, DSCR: r.dscr, IRR_Pct: r.irrPct, TotalProfit: r.totalProfit }))
    lines.push([k, v].join(','));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'rentscope-projection.csv';
  a.click(); URL.revokeObjectURL(a.href);
}

window.addEventListener('DOMContentLoaded', () => {
  loadFromURL();
  for (const f of FIELDS) $(f).addEventListener('input', render);
  $('reset')?.addEventListener('click', () => { location.href = location.pathname; });
  $('csv')?.addEventListener('click', csv);
  document.querySelectorAll('[data-gumroad]').forEach(a => { if (GUMROAD_URL !== '#pro') a.href = GUMROAD_URL; });
  window.addEventListener('resize', () => drawChart(window.__rentscope || render()));
  render();
});
