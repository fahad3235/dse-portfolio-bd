// dse-portfolio-bd -- tests/test-core.js
// Node unit tests for js/core.js. Usage: node tests/test-core.js
// Exits non-zero on any failure.
const C = require('../js/core.js');

let count = 0, failures = 0;
function check(name, cond, extra) {
  count++;
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}
function eq(name, actual, expected) {
  check(name, actual === expected, 'got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected));
}

const GP = { ticker: 'GP', sector: 'Telecommunication', shares: 100, avgBuyPaisa: 32000, currentPaisa: 34550 };
const SQ = { ticker: 'SQURPHARMA', sector: 'Pharmaceuticals', shares: 50, avgBuyPaisa: 21025, currentPaisa: 19800 };

// --- toPaisa ---
eq('toPaisa "320.50" -> 32050', C.toPaisa('320.50'), 32050);
eq('toPaisa Bengali "৩২০.৫০" -> 32050', C.toPaisa('৩২০.৫০'), 32050);
eq('toPaisa Bengali "৩২০" -> 32000', C.toPaisa('৩২০'), 32000);
eq('toPaisa commas "32,000.00" -> 3200000', C.toPaisa('32,000.00'), 3200000);
eq('toPaisa "0.40" -> 40', C.toPaisa('0.40'), 40);
eq('toPaisa "100" -> 10000', C.toPaisa('100'), 10000);
eq('toPaisa "" -> null', C.toPaisa(''), null);
eq('toPaisa "abc" -> null', C.toPaisa('abc'), null);
eq('toPaisa "12.345" (3dp) -> null', C.toPaisa('12.345'), null);
eq('toPaisa "-5" -> null', C.toPaisa('-5'), null);
eq('toPaisa "1,2x" -> null', C.toPaisa('1,2x'), null);
eq('paisaToString 3200000 -> 32,000.00', C.paisaToString(3200000), '32,000.00');
eq('paisaToString -61250 -> -612.50', C.paisaToString(-61250), '-612.50');

// --- hand-verified holdings ---
eq('GP invested 32,000.00', C.holdingInvested(GP), 3200000);
eq('GP value 34,550.00', C.holdingValue(GP), 3455000);
eq('GP gain +2,550.00', C.holdingGain(GP), 255000);
eq('GP gainPct 7.97', C.holdingGainPct(GP), 7.97);
eq('SQ invested 10,512.50', C.holdingInvested(SQ), 1051250);
eq('SQ value 9,900.00', C.holdingValue(SQ), 990000);
eq('SQ gain -612.50', C.holdingGain(SQ), -61250);
eq('SQ gainPct -5.83', C.holdingGainPct(SQ), -5.83);

// --- portfolio totals + allocation ---
const tot = C.portfolioTotals([GP, SQ]);
eq('totals invested 42,512.50', tot.invested, 4251250);
eq('totals value 44,450.00', tot.value, 4445000);
eq('totals gain +1,937.50', tot.gain, 193750);
eq('totals gainPct 4.56', tot.gainPct, 4.56);
const alloc = C.sectorAllocation([GP, SQ]);
eq('allocation 2 sectors', alloc.length, 2);
eq('allocation #1 Telecommunication', alloc[0].sector, 'Telecommunication');
eq('allocation Telecom 77.73%', alloc[0].pct, 77.73);
eq('allocation Pharma 22.27%', alloc[1].pct, 22.27);
eq('empty portfolio totals 0', C.portfolioTotals([]).invested, 0);
eq('empty allocation []', C.sectorAllocation([]).length, 0);

// --- dividends ---
eq('cash dividend yield GP 3.13%', C.cashDividendYield(GP, 100000), 3.13);
const sd = C.applyStockDividend(SQ, 10);
eq('stock div SQ bonus 5', sd.bonusShares, 5);
eq('stock div SQ shares 55', sd.shares, 55);
eq('stock div SQ new avg 191.14', sd.avgBuyPaisa, 19114);
eq('stock div SQ new value 10,890.00', 55 * 19800, 1089000);
const sd33 = C.applyStockDividend({ shares: 33, avgBuyPaisa: 10000 }, 10);
eq('rounding: 33 shares @10% bonus 3', sd33.bonusShares, 3);
eq('rounding: 33 shares @10% -> 36', sd33.shares, 36);

// --- trade calc ---
const buy = C.tradeCost({ side: 'buy', shares: 100, pricePaisa: 34550, commissionPct: 0.40 });
eq('trade buy gross 34,550.00', buy.gross, 3455000);
eq('trade buy commission 138.20', buy.commission, 13820);
eq('trade buy total 34,688.20', buy.total, 3468820);
const sell = C.tradeCost({ side: 'sell', shares: 100, pricePaisa: 34550, commissionPct: 0.40 });
eq('trade sell net 34,411.80', sell.total, 3441180);
const zero = C.tradeCost({ side: 'buy', shares: 10, pricePaisa: 10000, commissionPct: 0 });
eq('trade zero commission total = gross', zero.total, 100000);

// --- validation ---
eq('validateHolding valid -> []', C.validateHolding({ ticker: 'GP', shares: 100, avgBuyPaisa: 32000, currentPaisa: 34550, buyDate: '' }).length, 0);
check('validateHolding rejects ticker with space', C.validateHolding({ ticker: 'G P', shares: 1, avgBuyPaisa: 1, currentPaisa: 1 }).includes('ticker'));
check('validateHolding rejects lowercase ticker', C.validateHolding({ ticker: 'gp', shares: 1, avgBuyPaisa: 1, currentPaisa: 1 }).includes('ticker'));
check('validateHolding rejects 13-char ticker', C.validateHolding({ ticker: 'ABCDEFGHIJKLM', shares: 1, avgBuyPaisa: 1, currentPaisa: 1 }).includes('ticker'));
check('validateHolding rejects shares 0', C.validateHolding({ ticker: 'GP', shares: 0, avgBuyPaisa: 1, currentPaisa: 1 }).includes('shares'));
check('validateHolding rejects fractional shares', C.validateHolding({ ticker: 'GP', shares: 1.5, avgBuyPaisa: 1, currentPaisa: 1 }).includes('shares'));
check('validateHolding rejects negative price', C.validateHolding({ ticker: 'GP', shares: 1, avgBuyPaisa: -100, currentPaisa: 1 }).includes('avgBuy'));
check('validateHolding rejects zero current', C.validateHolding({ ticker: 'GP', shares: 1, avgBuyPaisa: 1, currentPaisa: 0 }).includes('current'));
check('validateHolding rejects future buy date', C.validateHolding({ ticker: 'GP', shares: 1, avgBuyPaisa: 1, currentPaisa: 1, buyDate: '2999-01-01' }).includes('buyDate'));
eq('validateDividend cash valid -> []', C.validateDividend({ holdingId: 'x', type: 'cash', amountPaisa: 100000, date: '' }).length, 0);
eq('validateDividend stock valid -> []', C.validateDividend({ holdingId: 'x', type: 'stock', pct: 10, date: '' }).length, 0);
check('validateDividend rejects cash 0', C.validateDividend({ holdingId: 'x', type: 'cash', amountPaisa: 0 }).includes('amount'));
check('validateDividend rejects stock pct 0', C.validateDividend({ holdingId: 'x', type: 'stock', pct: 0 }).includes('pct'));
check('validateDividend rejects stock pct 101', C.validateDividend({ holdingId: 'x', type: 'stock', pct: 101 }).includes('pct'));
check('validateDividend rejects missing holding', C.validateDividend({ holdingId: '', type: 'cash', amountPaisa: 100 }).includes('holding'));
eq('validateWatch valid -> []', C.validateWatch({ ticker: 'BATBC', targetPaisa: 40000 }).length, 0);
check('validateWatch rejects bad ticker', C.validateWatch({ ticker: 'ba', targetPaisa: 40000 }).includes('ticker'));
check('validateWatch rejects target 0', C.validateWatch({ ticker: 'BATBC', targetPaisa: 0 }).includes('target'));

// --- import validation ---
const good = { app: 'dse-portfolio-bd', version: 1, data: { holdings: [GP], dividends: [], watchlist: [] } };
eq('validateImport valid -> []', C.validateImport(good).length, 0);
check('validateImport rejects wrong app', C.validateImport({ app: 'other-app', version: 1, data: { holdings: [], dividends: [], watchlist: [] } }).includes('app'));
check('validateImport rejects wrong version', C.validateImport({ app: 'dse-portfolio-bd', version: 2, data: { holdings: [], dividends: [], watchlist: [] } }).includes('version'));
check('validateImport rejects missing holdings', C.validateImport({ app: 'dse-portfolio-bd', version: 1, data: { dividends: [], watchlist: [] } }).includes('holdings'));
check('validateImport rejects null', C.validateImport(null).length > 0);
check('validateImport rejects malformed JSON value', C.validateImport('nope').length > 0);
check('validateImport rejects bad holding row', C.validateImport({ app: 'dse-portfolio-bd', version: 1, data: { holdings: [{ ticker: 'G P', shares: 0, avgBuyPaisa: 0, currentPaisa: 0 }], dividends: [], watchlist: [] } }).includes('holding-row'));

console.log('\n' + count + ' checks, ' + failures + ' failed');
process.exit(failures ? 1 : 0);
