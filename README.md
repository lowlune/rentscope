# RentScope — free rental property calculator

**Live: https://lowlune.github.io/rentscope/**

RentScope is a fast, private, browser-only rental property calculator. Enter a property's
price, rent and loan terms to get monthly cash flow, cap rate, cash-on-cash return, DSCR,
levered IRR, and a multi-year projection with exit analysis.

- No signup, no tracking, no server — all math runs in your browser.
- Shareable URLs: every input is saved in the query string.
- CSV export of the full projection.

## Free calculators

- [Rental property calculator](https://lowlune.github.io/rentscope/) — cash flow, cap rate, cash-on-cash, DSCR, IRR, multi-year projection
- [Cap rate calculator](https://lowlune.github.io/rentscope/cap-rate-calculator.html)
- [DSCR calculator](https://lowlune.github.io/rentscope/dscr-calculator.html)
- [Cash-on-cash return calculator](https://lowlune.github.io/rentscope/cash-on-cash-return-calculator.html)
- [BRRRR calculator](https://lowlune.github.io/rentscope/brrrr-calculator.html)
- [NOI calculator](https://lowlune.github.io/rentscope/noi-calculator.html)
- [Gross rent multiplier (GRM) calculator](https://lowlune.github.io/rentscope/gross-rent-multiplier-calculator.html)
- [Break-even occupancy calculator](https://lowlune.github.io/rentscope/break-even-occupancy-calculator.html)
- [1% rule calculator](https://lowlune.github.io/rentscope/one-percent-rule-calculator.html)
- [50% rule calculator](https://lowlune.github.io/rentscope/fifty-percent-rule-calculator.html)
- [House hack calculator](https://lowlune.github.io/rentscope/house-hack-calculator.html)
- [1031 exchange calculator](https://lowlune.github.io/rentscope/1031-exchange-calculator.html)
- [Rental property depreciation calculator](https://lowlune.github.io/rentscope/rental-property-depreciation-calculator.html)
- [Seller financing calculator](https://lowlune.github.io/rentscope/seller-financing-calculator.html)
- [Hard money loan calculator](https://lowlune.github.io/rentscope/hard-money-loan-calculator.html)

Each landing page's worked example is computed at build time by the same tested engine — the
numbers on the page come from the code, not from a spreadsheet.

## Accuracy & testing

The math lives in pure, dependency-free engines with assertions:

```bash
node test-calc.mjs              # 24 assertions  — core underwriting engine
node test-1031.mjs              # 29 assertions  — 1031 exchange (boot, deferred gain)
node test-depreciation.mjs      # 47 assertions  — 27.5/39-yr MACRS, mid-month, recapture
node test-sellerfinancing.mjs   # 1,070 assertions — owner-carried notes + balloons
node test-hardmoney.mjs         # 2,201 assertions — hard-money / bridge loans (points, interest-only)
```

## Develop

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Files

- `index.html` — the free calculator app
- `calc.js`, `exchange1031.js`, `depreciation.js`, `sellerfinancing.js`, `hardmoney.js` — pure, tested engines
- `app.js` — UI wiring, chart, CSV export
- `*-calculator.html` — SEO landing pages with build-time worked examples
- `styles.css`

## RentScope Pro

RentScope Pro is an offline, self-contained HTML underwriting model. It adds after-tax cash
flow (depreciation, interest, marginal tax), capital-gains and Section 1250 recapture on exit,
amortization schedules, 5×5 sensitivity tables, and a printable report. It is a separate paid
download; this repository contains only the free web tool.

## Related

- [FeeScope](https://lowlune.github.io/feescope/) — free reseller fee & profit calculator.

## Disclaimer

Educational estimation only — not financial, tax, or investment advice. Assumptions and
simplifications are documented in the engine source.

MIT licensed (free web tool only).
