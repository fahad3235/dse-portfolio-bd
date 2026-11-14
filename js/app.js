// dse-portfolio-bd -- js/app.js
// UI layer: state in localStorage, rendering, forms. All math lives in core.js.
// Pure ASCII source. Bengali text comes from js/i18n.js only.
(function () {
  'use strict';
  var C = window.DSECore;
  var I18N = window.DSE_I18N;
  var STATE_KEY = 'dse-portfolio-bd-v1';
  var LANG_KEY = 'dse-portfolio-bd-lang';
  var TAKASIGN = '\u09f3';
  var SECTORS = ['Bank', 'NBFI', 'Pharmaceuticals', 'Textile', 'Engineering',
    'Food & Allied', 'Fuel & Power', 'IT', 'Insurance', 'Cement',
    'Telecommunication', 'Miscellaneous'];

  var lang = localStorage.getItem(LANG_KEY) || 'en';
  if (lang !== 'en' && lang !== 'bn') lang = 'en';

  function loadState() {
    try {
      var raw = localStorage.getItem(STATE_KEY);
      if (!raw) return { holdings: [], dividends: [], watchlist: [] };
      var s = JSON.parse(raw);
      if (!s || !Array.isArray(s.holdings)) return { holdings: [], dividends: [], watchlist: [] };
      s.dividends = Array.isArray(s.dividends) ? s.dividends : [];
      s.watchlist = Array.isArray(s.watchlist) ? s.watchlist : [];
      return s;
    } catch (e) { return { holdings: [], dividends: [], watchlist: [] }; }
  }
  var state = loadState();
  function save() { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }

  function uid() { return 'id' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
  function t(key) { return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key; }
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function toBnDigits(s) {
    if (lang !== 'bn') return s;
    return String(s).replace(/[0-9]/g, function (d) {
      return String.fromCharCode(0x09E6 + parseInt(d, 10));
    });
  }
  function fmtMoney(paisa) { return toBnDigits(TAKASIGN + C.paisaToString(paisa)); }
  function fmtPct(x) { return toBnDigits(x.toFixed(2) + '%'); }
  function fmtNum(n) { return toBnDigits(String(n)); }
  function esc(s) { return String(s == null ? '' : s); }

  // ---------- language ----------
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (n) { n.textContent = t(n.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (n) { n.setAttribute('placeholder', t(n.getAttribute('data-i18n-ph'))); });
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
  }

  // ---------- tabs ----------
  function showTab(name) {
    document.querySelectorAll('[data-tab]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === name);
    });
    document.querySelectorAll('[data-panel]').forEach(function (p) {
      p.hidden = p.getAttribute('data-panel') !== name;
    });
  }

  // ---------- dashboard ----------
  function renderDashboard() {
    var tot = C.portfolioTotals(state.holdings);
    $('stat-invested').textContent = fmtMoney(tot.invested);
    $('stat-value').textContent = fmtMoney(tot.value);
    $('stat-gain').textContent = fmtMoney(tot.gain);
    $('stat-gain-pct').textContent = '(' + fmtPct(tot.gainPct) + ')';
    $('stat-gain').className = 'stat-num ' + (tot.gain > 0 ? 'gain-pos' : tot.gain < 0 ? 'gain-neg' : '');
    var cashTotal = 0;
    state.dividends.forEach(function (d) { if (d.type === 'cash') cashTotal += d.amountPaisa; });
    $('stat-div').textContent = fmtMoney(cashTotal);
    $('stat-count').textContent = fmtNum(state.holdings.length);
    var best = null, worst = null;
    state.holdings.forEach(function (h) {
      var p = C.holdingGainPct(h);
      if (!best || p > best.pct) best = { ticker: h.ticker, pct: p };
      if (!worst || p < worst.pct) worst = { ticker: h.ticker, pct: p };
    });
    $('best-holding').textContent = best ? best.ticker + ' ' + fmtPct(best.pct) : '-';
    $('worst-holding').textContent = worst ? worst.ticker + ' ' + fmtPct(worst.pct) : '-';
    var host = $('alloc-host');
    host.innerHTML = '';
    var alloc = C.sectorAllocation(state.holdings);
    if (!alloc.length) { host.appendChild(el('p', 'empty', t('noHoldings'))); return; }
    alloc.forEach(function (a) {
      var row = el('div', 'alloc-row');
      row.appendChild(el('span', 'alloc-label', a.sector));
      var bar = el('div', 'alloc-bar');
      var fill = el('div', 'alloc-fill');
      fill.style.width = a.pct + '%';
      bar.appendChild(fill);
      row.appendChild(bar);
      row.appendChild(el('span', 'alloc-pct', fmtPct(a.pct)));
      host.appendChild(row);
    });
  }

  // ---------- holdings ----------
  var editingId = null;
  function cashDivFor(holdingId) {
    var sum = 0;
    state.dividends.forEach(function (d) { if (d.holdingId === holdingId && d.type === 'cash') sum += d.amountPaisa; });
    return sum;
  }
  function renderHoldings() {
    var body = $('holdings-body');
    body.innerHTML = '';
    $('holdings-empty').hidden = state.holdings.length > 0;
    state.holdings.forEach(function (h) {
      var tr = document.createElement('tr');
      var gain = C.holdingGain(h);
      var cells = [
        h.ticker, h.company || '-', h.sector, fmtNum(h.shares),
        fmtMoney(h.avgBuyPaisa), fmtMoney(h.currentPaisa),
        fmtMoney(C.holdingInvested(h)), fmtMoney(C.holdingValue(h)),
        fmtMoney(gain) + ' (' + fmtPct(C.holdingGainPct(h)) + ')',
        fmtMoney(cashDivFor(h.id))
      ];
      cells.forEach(function (c, i) {
        var td = el('td', null, c);
        if (i === 8) td.className = gain > 0 ? 'gain-pos' : gain < 0 ? 'gain-neg' : '';
        tr.appendChild(td);
      });
      var tdA = document.createElement('td');
      var bE = el('button', 'btn small', t('actEdit'));
      bE.setAttribute('data-edit', h.id);
      var bD = el('button', 'btn small danger', t('actDelete'));
      bD.setAttribute('data-del', h.id);
      tdA.appendChild(bE); tdA.appendChild(document.createTextNode(' ')); tdA.appendChild(bD);
      tr.appendChild(tdA);
      body.appendChild(tr);
    });
    body.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () { startEdit(b.getAttribute('data-edit')); });
    });
    body.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!window.confirm(t('confirmDeleteHolding'))) return;
        var id = b.getAttribute('data-del');
        state.holdings = state.holdings.filter(function (h) { return h.id !== id; });
        state.dividends = state.dividends.filter(function (d) { return d.holdingId !== id; });
        save(); renderAll();
      });
    });
  }
  function fillHoldingForm(h) {
    $('h-ticker').value = h ? h.ticker : '';
    $('h-company').value = h ? (h.company || '') : '';
    $('h-sector').value = h ? h.sector : SECTORS[0];
    $('h-shares').value = h ? h.shares : '';
    $('h-avg').value = h ? C.paisaToString(h.avgBuyPaisa) : '';
    $('h-current').value = h ? C.paisaToString(h.currentPaisa) : '';
    $('h-date').value = h ? (h.buyDate || '') : '';
  }
  function startEdit(id) {
    var h = state.holdings.find(function (x) { return x.id === id; });
    if (!h) return;
    editingId = id;
    fillHoldingForm(h);
    $('h-form-title').textContent = t('editHolding');
    $('h-submit').textContent = t('saveHolding');
    $('h-cancel').hidden = false;
    showTab('holdings');
    window.scrollTo(0, 0);
  }
  function submitHolding(ev) {
    ev.preventDefault();
    var ticker = $('h-ticker').value.trim().toUpperCase();
    var shares = parseInt($('h-shares').value, 10);
    var avg = C.toPaisa($('h-avg').value);
    var cur = C.toPaisa($('h-current').value);
    var errs = C.validateHolding({
      ticker: ticker, shares: shares, avgBuyPaisa: avg === null ? -1 : avg,
      currentPaisa: cur === null ? -1 : cur, buyDate: $('h-date').value
    });
    var msg = $('h-error');
    if (errs.length) {
      var map = { ticker: 'errTicker', shares: 'errShares', avgBuy: 'errAvgBuy', current: 'errCurrent', buyDate: 'errBuyDate' };
      msg.textContent = errs.map(function (e) { return t(map[e] || 'errTicker'); }).join(' ');
      return;
    }
    msg.textContent = '';
    var rec = {
      id: editingId || uid(), ticker: ticker, company: $('h-company').value.trim(),
      sector: $('h-sector').value, shares: shares, avgBuyPaisa: avg, currentPaisa: cur,
      buyDate: $('h-date').value || ''
    };
    if (editingId) {
      var i = state.holdings.findIndex(function (x) { return x.id === editingId; });
      if (i >= 0) state.holdings[i] = rec;
      editingId = null;
      $('h-form-title').textContent = t('addHolding');
      $('h-submit').textContent = t('addHolding');
      $('h-cancel').hidden = true;
    } else {
      state.holdings.push(rec);
    }
    save(); fillHoldingForm(null); renderAll();
  }

  // ---------- dividends ----------
  function renderDivForm() {
    var sel = $('d-holding');
    var cur = sel.value;
    sel.innerHTML = '';
    state.holdings.forEach(function (h) {
      var o = document.createElement('option');
      o.value = h.id; o.textContent = h.ticker + (h.company ? ' - ' + h.company : '');
      sel.appendChild(o);
    });
    if (cur) sel.value = cur;
    var isCash = $('d-type').value === 'cash';
    $('d-amount-wrap').hidden = !isCash;
    $('d-pct-wrap').hidden = isCash;
  }
  function renderDividends() {
    renderDivForm();
    var body = $('div-body');
    body.innerHTML = '';
    $('div-empty').hidden = state.dividends.length > 0;
    state.dividends.forEach(function (d) {
      var h = state.holdings.find(function (x) { return x.id === d.holdingId; });
      var tr = document.createElement('tr');
      var detail = d.type === 'cash' ? fmtMoney(d.amountPaisa)
        : fmtPct(d.pct) + ' (' + fmtNum(d.bonusShares) + ' ' + (lang === 'bn' ? '\u09ac\u09cb\u09a8\u09be\u09b8' : 'bonus') + ')';
      [h ? h.ticker : '?', t(d.type === 'cash' ? 'cashDivLabel' : 'stockDivLabel'),
       detail, d.date || '-', d.note || '-'].forEach(function (c) { tr.appendChild(el('td', null, c)); });
      var tdA = document.createElement('td');
      var bD = el('button', 'btn small danger', t('actDelete'));
      bD.addEventListener('click', function () {
        if (!window.confirm(t('confirmDeleteDiv'))) return;
        if (d.type === 'stock' && h) {
          h.shares = d.prevShares;
          h.avgBuyPaisa = d.prevAvgBuyPaisa;
        }
        state.dividends = state.dividends.filter(function (x) { return x.id !== d.id; });
        save(); renderAll();
      });
      tdA.appendChild(bD);
      tr.appendChild(tdA);
      body.appendChild(tr);
    });
  }
  function submitDividend(ev) {
    ev.preventDefault();
    var holdingId = $('d-holding').value;
    var type = $('d-type').value;
    var amount = type === 'cash' ? C.toPaisa($('d-amount').value) : null;
    var pct = type === 'stock' ? parseFloat($('d-pct').value) : null;
    var errs = C.validateDividend({
      holdingId: holdingId, type: type,
      amountPaisa: amount === null ? -1 : amount, pct: pct, date: $('d-date').value
    });
    var msg = $('d-error');
    if (errs.length) {
      var map = { holding: 'errHolding', amount: 'errAmount', pct: 'errPct', date: 'errDate', type: 'errHolding' };
      msg.textContent = errs.map(function (e) { return t(map[e] || 'errHolding'); }).join(' ');
      return;
    }
    msg.textContent = '';
    var h = state.holdings.find(function (x) { return x.id === holdingId; });
    var rec = { id: uid(), holdingId: holdingId, type: type, date: $('d-date').value || '',
      note: $('d-note').value.trim() };
    if (type === 'cash') {
      rec.amountPaisa = amount;
    } else {
      rec.pct = pct;
      rec.prevShares = h.shares;
      rec.prevAvgBuyPaisa = h.avgBuyPaisa;
      var res = C.applyStockDividend(h, pct);
      rec.bonusShares = res.bonusShares;
      h.shares = res.shares;
      h.avgBuyPaisa = res.avgBuyPaisa;
      $('d-msg').textContent = t('stockDivApplied');
    }
    state.dividends.push(rec);
    save();
    $('d-amount').value = ''; $('d-pct').value = ''; $('d-note').value = '';
    renderAll();
  }

  // ---------- watchlist ----------
  function renderWatchlist() {
    var body = $('watch-body');
    body.innerHTML = '';
    $('watch-empty').hidden = state.watchlist.length > 0;
    state.watchlist.forEach(function (w) {
      var tr = document.createElement('tr');
      tr.appendChild(el('td', null, w.ticker));
      tr.appendChild(el('td', null, fmtMoney(w.targetPaisa)));
      var tdC = document.createElement('td');
      var inp = document.createElement('input');
      inp.type = 'text'; inp.className = 'w-current'; inp.setAttribute('data-id', w.id);
      inp.value = w.currentPaisa == null ? '' : C.paisaToString(w.currentPaisa);
      inp.setAttribute('placeholder', t('phPrice'));
      inp.addEventListener('change', function () {
        var v = C.toPaisa(inp.value);
        if (inp.value.trim() === '') { w.currentPaisa = null; }
        else if (v !== null && v > 0) { w.currentPaisa = v; }
        save(); renderWatchlist();
      });
      tdC.appendChild(inp);
      tr.appendChild(tdC);
      var status = 'statusNone';
      if (w.currentPaisa != null) status = w.currentPaisa < w.targetPaisa ? 'statusBelow' : 'statusAbove';
      var tdS = el('td', null, t(status));
      tdS.className = status === 'statusBelow' ? 'gain-neg' : status === 'statusAbove' ? 'gain-pos' : '';
      tr.appendChild(tdS);
      tr.appendChild(el('td', null, w.note || '-'));
      var tdA = document.createElement('td');
      var bD = el('button', 'btn small danger', t('actDelete'));
      bD.addEventListener('click', function () {
        if (!window.confirm(t('confirmDeleteWatch'))) return;
        state.watchlist = state.watchlist.filter(function (x) { return x.id !== w.id; });
        save(); renderAll();
      });
      tdA.appendChild(bD);
      tr.appendChild(tdA);
      body.appendChild(tr);
    });
  }
  function submitWatch(ev) {
    ev.preventDefault();
    var ticker = $('w-ticker').value.trim().toUpperCase();
    var target = C.toPaisa($('w-target').value);
    var errs = C.validateWatch({ ticker: ticker, targetPaisa: target === null ? -1 : target });
    var msg = $('w-error');
    if (errs.length) {
      msg.textContent = errs.map(function (e) { return t(e === 'ticker' ? 'errTicker' : 'errTarget'); }).join(' ');
      return;
    }
    msg.textContent = '';
    state.watchlist.push({ id: uid(), ticker: ticker, targetPaisa: target,
      currentPaisa: null, note: $('w-note').value.trim() });
    save();
    $('w-ticker').value = ''; $('w-target').value = ''; $('w-note').value = '';
    renderAll();
  }

  // ---------- trade calculator ----------
  function calcTrade() {
    var side = $('t-side').value;
    var shares = parseInt($('t-shares').value, 10);
    var price = C.toPaisa($('t-price').value);
    var comm = parseFloat($('t-commission').value);
    var msg = $('t-error');
    if (!Number.isInteger(shares) || shares <= 0 || price === null || price <= 0 ||
        !isFinite(comm) || comm < 0) {
      msg.textContent = t('errTrade');
      $('trade-out').hidden = true;
      return;
    }
    msg.textContent = '';
    var r = C.tradeCost({ side: side, shares: shares, pricePaisa: price, commissionPct: comm });
    $('t-gross').textContent = fmtMoney(r.gross);
    $('t-commission-amt').textContent = fmtMoney(r.commission);
    $('t-total').textContent = fmtMoney(r.total);
    $('t-total-label').textContent = t(side === 'buy' ? 'tTotalBuy' : 'tTotalSell');
    $('trade-out').hidden = false;
  }

  // ---------- data tab ----------
  function exportJSON() {
    return JSON.stringify({ app: 'dse-portfolio-bd', version: 1, data: state }, null, 2);
  }
  function doExport() {
    var blob = new Blob([exportJSON()], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dse-portfolio-bd-export.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function doImport(text) {
    var msg = $('import-msg');
    var obj;
    try { obj = JSON.parse(text); } catch (e) { msg.textContent = t('importBad'); msg.className = 'err'; return false; }
    if (C.validateImport(obj).length) { msg.textContent = t('importBad'); msg.className = 'err'; return false; }
    state = { holdings: obj.data.holdings, dividends: obj.data.dividends, watchlist: obj.data.watchlist };
    save(); renderAll();
    msg.textContent = t('importOk'); msg.className = 'ok';
    return true;
  }

  // ---------- render all ----------
  function renderAll() {
    renderDashboard(); renderHoldings(); renderDividends(); renderWatchlist();
    var sel = $('t-holding');
    var cur = sel.value;
    sel.innerHTML = '';
    var none = document.createElement('option');
    none.value = ''; none.textContent = '-';
    sel.appendChild(none);
    state.holdings.forEach(function (h) {
      var o = document.createElement('option');
      o.value = h.id; o.textContent = h.ticker + ' (' + fmtMoney(h.currentPaisa) + ')';
      sel.appendChild(o);
    });
    if (cur) sel.value = cur;
  }

  // ---------- init ----------
  function init() {
    var sectorSel = $('h-sector');
    SECTORS.forEach(function (s) {
      var o = document.createElement('option');
      o.value = s; o.textContent = s;
      sectorSel.appendChild(o);
    });
    document.querySelectorAll('[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () { showTab(b.getAttribute('data-tab')); });
    });
    $('lang-btn').addEventListener('click', function () {
      lang = lang === 'en' ? 'bn' : 'en';
      localStorage.setItem(LANG_KEY, lang);
      applyI18n(); renderAll();
    });
    $('h-form').addEventListener('submit', submitHolding);
    $('h-cancel').addEventListener('click', function () {
      editingId = null; fillHoldingForm(null);
      $('h-form-title').textContent = t('addHolding');
      $('h-submit').textContent = t('addHolding');
      $('h-cancel').hidden = true;
    });
    $('d-form').addEventListener('submit', submitDividend);
    $('d-type').addEventListener('change', renderDivForm);
    $('w-form').addEventListener('submit', submitWatch);
    $('t-calc').addEventListener('click', calcTrade);
    $('t-holding').addEventListener('change', function () {
      var h = state.holdings.find(function (x) { return x.id === $('t-holding').value; });
      if (h) $('t-price').value = C.paisaToString(h.currentPaisa);
    });
    $('export-btn').addEventListener('click', doExport);
    $('import-btn').addEventListener('click', function () { doImport($('import-text').value); });
    $('import-file').addEventListener('change', function () {
      var f = $('import-file').files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () { $('import-text').value = String(r.result); doImport(String(r.result)); };
      r.readAsText(f);
    });
    $('erase-btn').addEventListener('click', function () {
      var msg = $('erase-msg');
      if ($('erase-confirm').value !== 'DELETE') { msg.textContent = t('eraseWrong'); msg.className = 'err'; return; }
      state = { holdings: [], dividends: [], watchlist: [] };
      save(); renderAll();
      $('erase-confirm').value = '';
      msg.textContent = t('eraseOk'); msg.className = 'ok';
    });
    applyI18n();
    renderAll();
    showTab('dashboard');
  }

  // Exposed for smoke tests only.
  window.DSEApp = {
    exportJSON: exportJSON,
    getState: function () { return state; },
    setLang: function (l) { lang = l; localStorage.setItem(LANG_KEY, l); applyI18n(); renderAll(); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
