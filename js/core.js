// dse-portfolio-bd -- js/core.js
// Pure portfolio math. No DOM, no network, no storage access.
// Money is integer paisa everywhere (1 BDT = 100 paisa) so no float error.
// CommonJS-compatible so tests can require() it; also usable in the browser.
(function (root) {
  'use strict';

  var BN_DIGITS = { '\u09e6': '0', '\u09e7': '1', '\u09e8': '2', '\u09e9': '3', '\u09ea': '4',
    '\u09eb': '5', '\u09ec': '6', '\u09ed': '7', '\u09ee': '8', '\u09ef': '9' };

  function round2(x) { return Math.round(x * 100) / 100; }

  // Parse a BDT amount string into integer paisa.
  // Accepts ASCII or Bengali digits, commas, optional 2-decimal fraction.
  // Returns integer paisa, or null when invalid.
  function toPaisa(input) {
    if (typeof input === 'number') {
      if (!isFinite(input) || input < 0) return null;
      return Math.round(input * 100);
    }
    if (typeof input !== 'string') return null;
    var s = input.trim();
    if (!s) return null;
    s = s.replace(/[\u09e6-\u09ef]/g, function (ch) { return BN_DIGITS[ch]; });
    s = s.replace(/[,\s]/g, '');
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    var parts = s.split('.');
    var taka = parseInt(parts[0], 10);
    var paisa = parts[1] ? parseInt((parts[1] + '00').slice(0, 2), 10) : 0;
    return taka * 100 + paisa;
  }

  // Format integer paisa as "32,000.00" (ASCII, no currency symbol).
  function paisaToString(paisa) {
    var neg = paisa < 0;
    var abs = Math.abs(paisa);
    var taka = Math.floor(abs / 100);
    var p = abs % 100;
    var t = String(taka).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + t + '.' + (p < 10 ? '0' : '') + p;
  }

  function holdingInvested(h) { return h.shares * h.avgBuyPaisa; }
  function holdingValue(h) { return h.shares * h.currentPaisa; }
  function holdingGain(h) { return holdingValue(h) - holdingInvested(h); }
  function holdingGainPct(h) {
    var inv = holdingInvested(h);
    if (!inv) return 0;
    return round2(holdingGain(h) / inv * 100);
  }

  function portfolioTotals(holdings) {
    var invested = 0, value = 0;
    holdings.forEach(function (h) { invested += holdingInvested(h); value += holdingValue(h); });
    var gain = value - invested;
    return { invested: invested, value: value, gain: gain,
      gainPct: invested ? round2(gain / invested * 100) : 0 };
  }

  // Sector share of total current value, sorted desc. pct rounded to 2dp.
  function sectorAllocation(holdings) {
    var totals = portfolioTotals(holdings);
    if (!totals.value) return [];
    var bySector = {};
    holdings.forEach(function (h) {
      bySector[h.sector] = (bySector[h.sector] || 0) + holdingValue(h);
    });
    return Object.keys(bySector).map(function (sector) {
      return { sector: sector, value: bySector[sector],
        pct: round2(bySector[sector] / totals.value * 100) };
    }).sort(function (a, b) { return b.value - a.value; });
  }

  // Stock (bonus) dividend: bonus shares added, avg buy recalculated
  // as invested / new shares so total invested is unchanged.
  function applyStockDividend(h, pct) {
    var bonusShares = Math.round(h.shares * pct / 100);
    var newShares = h.shares + bonusShares;
    var newAvg = Math.round(holdingInvested(h) / newShares);
    return { shares: newShares, avgBuyPaisa: newAvg, bonusShares: bonusShares };
  }

  // Cash dividend yield % on invested capital.
  function cashDividendYield(holding, cashTotalPaisa) {
    var inv = holdingInvested(holding);
    if (!inv) return 0;
    return round2(cashTotalPaisa / inv * 100);
  }

  // Trade cost. commissionPct is a plain number (e.g. 0.40 means 0.40%).
  // buy:  total = gross + commission. sell: total = gross - commission (net proceeds).
  function tradeCost(o) {
    var gross = o.shares * o.pricePaisa;
    var commission = Math.round(gross * o.commissionPct / 100);
    var total = o.side === 'buy' ? gross + commission : gross - commission;
    return { gross: gross, commission: commission, total: total };
  }

  function isValidTicker(ticker) {
    return typeof ticker === 'string' && /^[A-Z0-9]{1,12}$/.test(ticker.trim());
  }
  function isFutureDate(dateStr) {
    if (!dateStr) return false;
    var d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return true;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    return d > today;
  }

  // Each validator returns an array of error keys (empty = valid).
  function validateHolding(o) {
    var errs = [];
    if (!isValidTicker(o.ticker)) errs.push('ticker');
    if (!Number.isInteger(o.shares) || o.shares <= 0) errs.push('shares');
    if (!Number.isInteger(o.avgBuyPaisa) || o.avgBuyPaisa <= 0) errs.push('avgBuy');
    if (!Number.isInteger(o.currentPaisa) || o.currentPaisa <= 0) errs.push('current');
    if (o.buyDate && isFutureDate(o.buyDate)) errs.push('buyDate');
    if (o.buyDate && isNaN(new Date(o.buyDate + 'T00:00:00').getTime())) errs.push('buyDate');
    return errs;
  }

  function validateDividend(o) {
    var errs = [];
    if (!o.holdingId) errs.push('holding');
    if (o.type === 'cash') {
      if (!Number.isInteger(o.amountPaisa) || o.amountPaisa <= 0) errs.push('amount');
    } else if (o.type === 'stock') {
      if (typeof o.pct !== 'number' || !isFinite(o.pct) || o.pct <= 0 || o.pct > 100) errs.push('pct');
    } else {
      errs.push('type');
    }
    if (o.date && isFutureDate(o.date)) errs.push('date');
    return errs;
  }

  function validateWatch(o) {
    var errs = [];
    if (!isValidTicker(o.ticker)) errs.push('ticker');
    if (!Number.isInteger(o.targetPaisa) || o.targetPaisa <= 0) errs.push('target');
    return errs;
  }

  // Strict import envelope validation.
  // {app:'dse-portfolio-bd', version:1, data:{holdings:[], dividends:[], watchlist:[]}}
  function validateImport(obj) {
    var errs = [];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) { errs.push('envelope'); return errs; }
    if (obj.app !== 'dse-portfolio-bd') errs.push('app');
    if (obj.version !== 1) errs.push('version');
    if (!obj.data || typeof obj.data !== 'object') { errs.push('data'); return errs; }
    if (!Array.isArray(obj.data.holdings)) errs.push('holdings');
    if (!Array.isArray(obj.data.dividends)) errs.push('dividends');
    if (!Array.isArray(obj.data.watchlist)) errs.push('watchlist');
    if (errs.length) return errs;
    obj.data.holdings.forEach(function (h) {
      if (validateHolding({
        ticker: h.ticker, shares: h.shares, avgBuyPaisa: h.avgBuyPaisa,
        currentPaisa: h.currentPaisa, buyDate: h.buyDate || ''
      }).length) errs.push('holding-row');
    });
    obj.data.watchlist.forEach(function (w) {
      if (validateWatch({ ticker: w.ticker, targetPaisa: w.targetPaisa }).length) errs.push('watch-row');
    });
    return errs;
  }

  var api = {
    toPaisa: toPaisa, paisaToString: paisaToString,
    holdingInvested: holdingInvested, holdingValue: holdingValue,
    holdingGain: holdingGain, holdingGainPct: holdingGainPct,
    portfolioTotals: portfolioTotals, sectorAllocation: sectorAllocation,
    applyStockDividend: applyStockDividend, cashDividendYield: cashDividendYield,
    tradeCost: tradeCost, isValidTicker: isValidTicker,
    validateHolding: validateHolding, validateDividend: validateDividend,
    validateWatch: validateWatch, validateImport: validateImport
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DSECore = api;
})(typeof window !== 'undefined' ? window : globalThis);
