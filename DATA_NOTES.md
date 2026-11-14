# DATA_NOTES.md — dse-portfolio-bd

## What the app claims, and where it came from

- **DSE trades Sunday–Thursday.** Verified 2026-11-14 via an RBC market profile of the Dhaka Stock Exchange and Financial Express market reporting: the DSE trading week runs Sunday to Thursday (Friday–Saturday weekend, matching Bangladesh's weekend). The app states this in its footer/README disclaimers.
- **Trading hours: NOT asserted.** DSE trading hours have varied by official notice, including Ramadan schedules and energy-saving cuts. The app therefore claims no opening/closing times anywhere in the UI or docs, and the disclaimer tells users to verify hours with their broker / dsebd.org.
- **Broker commission: user-entered, no rate claimed.** The trade calculator's commission field has no default and its placeholder is only an example ("e.g. 0.40"). No commission rate is asserted anywhere, because rates differ by broker and by trade type.
- **No live prices anywhere, by design.** There is no market-data feed, no API call, and no scraped price. Every price in the app is typed in by the user. The footer and README both say so explicitly.
- **Sectors:** the 12 sector options (Bank, NBFI, Pharmaceuticals, Textile, Engineering, Food & Allied, Fuel & Power, IT, Insurance, Cement, Telecommunication, Miscellaneous) follow DSE's standard sector classification used in its market summaries.
- **Example tickers in tests/docs** (GP = Grameenphone, SQURPHARMA = Square Pharmaceuticals, BATBC = British American Tobacco Bangladesh) are real DSE-listed companies, used only as worked examples with user-entered prices — the numbers are illustrative, not market data.

## Data handling

- All state lives in the user's browser (`localStorage`, key `dse-portfolio-bd-v1`); language in `dse-portfolio-bd-lang`.
- The app ships empty — no demo holdings, no seeded prices.
- Export/import uses a strict envelope `{app: 'dse-portfolio-bd', version: 1, data: {holdings, dividends, watchlist}}`; imports with a wrong app, wrong version, or malformed rows are rejected with existing data untouched.
