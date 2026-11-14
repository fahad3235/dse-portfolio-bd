# TEST_RESULTS.md — dse-portfolio-bd

Run date: 2026-11-14. Node v24.22.1. Headless shell: `~/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell` (raw CDP, port 9365).

## Core unit tests — `node tests/test-core.js`

**68/68 passed, 0 failed.**

Covers: `toPaisa` (ASCII + Bengali digits + commas, invalid inputs rejected), `paisaToString`, holding invested/value/gain/gain%, portfolio totals, sector allocation, cash-dividend yield, stock-dividend application + rounding, trade cost (buy/sell), all validators, import-envelope validation.

## Smoke tests — `node tests/smoke.js`

**72/72 passed, 0 failed. 0 console/page errors. Zero non-file network requests.**

Full hand-verified scenario end-to-end in the UI: add GP + SQURPHARMA → dashboard totals → allocation bars → cash dividend → stock dividend (55 shares / 191.14 / 10,890.00) → delete reverses it → watchlist BATBC 385 vs 400 → trade calc buy/sell → validation blocks (empty ticker, 0 shares, future date) → export/erase/import round-trip → malformed import rejected with data intact → BN toggle + persistence after reload → 390px no-overflow on all 6 tabs.

## Hand-verified numbers (asserted in both suites)

| Case | Expected | Verified |
|---|---|---|
| GP 100 sh, buy 320.00, cur 345.50 | invested 32,000.00, value 34,550.00, gain +2,550.00 (+7.97%) | yes |
| SQURPHARMA 50 sh, buy 210.25, cur 198.00 | invested 10,512.50, value 9,900.00, gain −612.50 (−5.83%) | yes |
| Portfolio totals | invested 42,512.50, value 44,450.00, gain +1,937.50 (+4.56%) | yes |
| Allocation | Telecommunication 77.73%, Pharmaceuticals 22.27% | yes |
| Cash dividend GP 1,000 | income 1,000.00; yield 3.13% | yes |
| Stock dividend SQURPHARMA 10% | 50 → 55 sh, bonus 5, new avg 191.14, new value 10,890.00 | yes |
| Trade buy 100 × 345.50 @ 0.40% | commission 138.20, total 34,688.20 | yes |
| Trade sell same | net 34,411.80 | yes |
| Rounding 33 sh @ 10% | bonus 3, 36 shares | yes |
| Bengali parsing "৩২০.৫০" | 32050 paisa | yes |

## Repairs made

1. **Smoke test BN-title check (test-only fix, not an app bug):** the first smoke run was 71/72. The title comparison failed on Unicode normalisation — the app stores য় as the single code point U+09DF while the test literal used the decomposed sequence য (U+09AF) + ় (U+09BC). Fixed the test to compare the rendered title against `window.DSE_I18N.bn.appTitle` instead of a hand-typed literal. Re-ran: **72/72**.
2. **Non-ASCII hygiene:** the initial `grep -rP '[^\x00-\x7F]'` sweep found stray em/en dashes in `index.html` and `js/app.js` (static fallback text). Replaced with ASCII hyphens. Final sweep: **zero non-ASCII bytes** in `index.html`, `css/`, `js/` (Bengali exists only as `\uXXXX` escapes in `js/i18n.js`).

## ASCII audit

```
grep -rP '[^\x00-\x7F]' index.html css js   → no matches
```
