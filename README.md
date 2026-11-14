# DSE Portfolio BD

An offline, bilingual (English / বাংলা) portfolio tracker for Dhaka Stock Exchange (DSE) holdings. Everything runs in the browser — no account, no server, no network requests. All prices are entered by you; the app never fetches live market data.

## Problem

Small DSE investors usually track holdings in scattered notebooks or spreadsheets: buy prices, bonus (stock) dividends that change share counts and average cost, cash dividends, and watchlist targets. This app keeps all of that in one place, with correct paisa math and a full export/import so the data is never locked in.

## Features

- **Holdings CRUD** — ticker (auto-uppercase, 1–12 chars A–Z0–9), optional company name, 12 DSE sectors, shares, avg buy price, current price, optional buy date. Inline validation; edit loads into the form; delete with confirm.
- **Dashboard** — total invested, current value, total gain/loss (৳ and %), dividend income, holdings count, best/worst holding by gain%, and sector-allocation bars.
- **Per-holding table** — invested, value, gain/loss in ৳ and %, dividend income per holding, green/red gain/loss.
- **Dividend log** — cash dividends (৳) and stock dividends (% → bonus shares added, avg buy recalculated as invested ÷ new shares). Deleting a stock dividend reverses the bonus shares and restores the old avg buy. Dividend yield per holding = cash dividends ÷ invested × 100.
- **Watchlist** — ticker + target price + note, with a per-row current price and a status badge: Below target / At or above target / No price yet.
- **Trade calculator** — buy/sell, shares, price, commission % (user-entered, no rate claimed). Outputs commission amount and total cost (buy) or net proceeds (sell). Price can be prefilled from a holding.
- **Data** — JSON export (download), strict import (file or paste; wrong-app or malformed files are rejected with your data intact), and typed-`DELETE` erase-all.
- **Bilingual** — EN/বাংলা toggle, persisted in localStorage. Bengali digits in BN mode.
- **Offline by design** — zero network requests, no CDN, no webfonts, system font stack only. Ships empty; no demo holdings.

## Stack

- Pure HTML + CSS + vanilla JavaScript (no framework, no build step).
- Money stored as integer paisa (1 BDT = 100 paisa) — no floating-point error.
- State in `localStorage` under key `dse-portfolio-bd-v1`; language under `dse-portfolio-bd-lang`.
- All pure math in `js/core.js` (CommonJS-compatible, no DOM), so it is unit-testable in Node.

## Prerequisites

- Any modern browser (Chrome, Firefox, Edge, Safari). No server needed.
- Node.js 18+ only for running the tests.

## Install / run

```bash
# just open it — no install, no build
open index.html
# or serve it locally
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Dev commands

```bash
node tests/test-core.js   # core unit tests
node tests/smoke.js       # headless-Chrome end-to-end smoke test (raw CDP)
```

## Env

None. No API keys, no secrets, no backend.

## Testing

- `node tests/test-core.js` — **68/68** assertions: paisa parsing (incl. Bengali digits `৩২০.৫০` → 32050), hand-verified GP/SQURPHARMA numbers, portfolio totals, allocation, stock-dividend math and rounding, trade-cost math, validation rejects, import-envelope validation.
- `node tests/smoke.js` — **72/72** checks in headless Chrome: the full hand-verified scenario end-to-end in the UI (add both holdings → dashboard totals → allocation bars → cash dividend → stock dividend → 55 shares / 191.14 / 10,890.00 → reversal on delete → watchlist BATBC 385 vs 400 → trade calc buy/sell → validation blocks → export/erase/import round-trip → malformed import rejected with data intact → BN toggle + persistence → 390px no-overflow on all 6 tabs → zero non-file network requests → 0 console/page errors).
- See `TEST_RESULTS.md` for the full numbers and repair history.

## Deployment

GitHub Pages: push the repo contents to the `main` branch and enable Pages (main branch, root). The site is fully static.

## Limitations

- Prices are user-entered; there is no live DSE feed and no price alerts.
- Data lives in one browser's localStorage — back it up with Export JSON; clearing browser data loses it unless exported.
- No multi-currency, no tax/BO-account fee modelling beyond the single commission % field.
- Stock dividends are rounded to whole bonus shares (`Math.round(shares × pct / 100)`); fractional entitlements are not modelled.
- The app asserts no DSE trading hours (they vary by notice, incl. Ramadan/energy-saving changes).

## Status

Complete MVP. All tests pass (68/68 core, 72/72 smoke), 0 console errors, zero network requests.

## Uniqueness

No DSE/stock/portfolio project exists in the factory ledger, `builds/`, or GitHub `user:fahad3235` (search "dse" = 0 repos, verified 2026-11-14). Nearest neighbours are adjacent money tools, not stock portfolios: `debt-payoff-bd` (payoff simulation, no holdings), `loan-compare-bd` (loan offers), `savings-interest-bd` (DPS/FDR), `gold-price-calc-bd` (single commodity). This is the first stock-portfolio lane.

## Disclaimer

Personal tracker, not investment advice. Prices are user-entered, not live market data. DSE trades Sunday–Thursday; verify trading hours and broker fees with your broker / dsebd.org.
