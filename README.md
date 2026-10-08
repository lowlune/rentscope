# RentScope — free rental property calculator

A fast, private, browser-only rental property calculator: cash flow, cap rate,
cash-on-cash return, DSCR, levered IRR, and a multi-year projection with exit analysis.

- No signup, no tracking, no server. All math runs in your browser.
- Shareable URLs: every input is saved in the query string.
- CSV export of the full projection.

## Develop / test
```bash
node test-calc.mjs      # 24 assertions over the finance engine
python3 -m http.server  # then open http://localhost:8000
```

## Files
- `index.html` — app + documentation
- `calc.js` — pure, tested finance engine
- `app.js` — UI wiring, chart, CSV export
- `styles.css`

## Disclaimer
Educational estimation tool, not financial, tax, or investment advice.

MIT licensed (free web tool only).
