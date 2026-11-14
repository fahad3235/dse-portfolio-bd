// dse-portfolio-bd -- tests/smoke.js
// Headless-Chrome smoke test via raw CDP (no puppeteer). Usage: node tests/smoke.js
// Exits non-zero on any failed assertion; fails on page console errors.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 9365;
const BASE = 'file://' + path.resolve(__dirname, '..', 'index.html');
const TAKA = '\u09f3';
let failures = 0;
let count = 0;
const pageErrors = [];
function check(name, cond, extra) {
  count++;
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const CHROME_BIN = process.env.CHROME_BIN ||
    require('os').homedir() + '/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
  const chrome = spawn(CHROME_BIN, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/dse-smoke-' + process.pid,
    'about:blank',
  ], { stdio: 'ignore' });
  let targets = [];
  for (let i = 0; i < 50 && targets.length === 0; i++) {
    await wait(200);
    try {
      targets = JSON.parse(await new Promise((res, rej) => {
        http.get('http://127.0.0.1:' + PORT + '/json/list', (r) => {
          let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d));
        }).on('error', rej);
      }));
    } catch (e) { /* retry */ }
  }
  if (!targets.length) { console.log('FAIL - chrome did not start'); process.exit(2); }
  const wsUrl = targets[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise((res) => { ws.onopen = res; });
  let seq = 0; const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push('exception: ' + JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors.push('console.error: ' + JSON.stringify(msg.params.args).slice(0, 300));
    }
  };
  function send(method, params) {
    return new Promise((res) => {
      const id = ++seq;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const nav = async (url) => { await send('Page.navigate', { url }); await wait(1200); };
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) return { error: JSON.stringify(r.result.exceptionDetails).slice(0, 300) };
    return r.result ? r.result.result.value : undefined;
  };
  const clickTab = async (name) => ev(`document.querySelector('[data-tab="${name}"]').click()`);
  const setVal = async (id, v) => ev(
    `var el=document.getElementById('${id}'); el.value=${JSON.stringify(v)}; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true}))`);
  const holdings = async () => ev(`window.DSEApp.getState().holdings`);
  const rowText = async (i) => ev(`document.querySelectorAll('#holdings-body tr')[${i}] ? document.querySelectorAll('#holdings-body tr')[${i}].textContent : ''`);

  // ---- Load: empty state ----
  await nav(BASE);
  check('page title is DSE Portfolio BD', (await ev('document.title')) === 'DSE Portfolio BD');
  check('6 tabs present', (await ev(`document.querySelectorAll('[data-tab]').length`)) === 6);
  check('lang button shows Bangla label', (await ev(`document.getElementById('lang-btn').textContent`)) === '\u09ac\u09be\u0982\u09b2\u09be');
  check('empty holdings state shown', (await ev(`document.getElementById('holdings-empty').hidden`)) === false);
  check('dashboard invested 0 at start', (await ev(`document.getElementById('stat-invested').textContent`)).includes('0.00'));
  check('footer disclaimer mentions not investment advice', (await ev(`document.querySelector('footer').textContent`)).includes('not investment advice'));

  // ---- Add GP holding ----
  await clickTab('holdings');
  await setVal('h-ticker', 'gp');
  await setVal('h-company', 'Grameenphone');
  await setVal('h-sector', 'Telecommunication');
  await setVal('h-shares', '100');
  await setVal('h-avg', '320.00');
  await setVal('h-current', '345.50');
  await ev(`document.getElementById('h-submit').click()`);
  check('GP added: 1 holding', (await holdings()).length === 1);
  check('ticker auto-uppercased to GP', (await holdings())[0].ticker === 'GP');
  check('GP row shows invested 32,000.00', (await rowText(0)).includes('32,000.00'));
  check('GP row shows value 34,550.00', (await rowText(0)).includes('34,550.00'));
  check('GP row shows gain +2,550.00 (7.97%)', (await rowText(0)).includes('2,550.00') && (await rowText(0)).includes('7.97%'));

  // ---- Add SQURPHARMA holding ----
  await setVal('h-ticker', 'SQURPHARMA');
  await setVal('h-company', 'Square Pharmaceuticals');
  await setVal('h-sector', 'Pharmaceuticals');
  await setVal('h-shares', '50');
  await setVal('h-avg', '210.25');
  await setVal('h-current', '198.00');
  await ev(`document.getElementById('h-submit').click()`);
  check('SQURPHARMA added: 2 holdings', (await holdings()).length === 2);
  check('SQ row shows invested 10,512.50', (await rowText(1)).includes('10,512.50'));
  check('SQ row shows value 9,900.00', (await rowText(1)).includes('9,900.00'));
  check('SQ row shows gain -612.50 (-5.83%)', (await rowText(1)).includes('-612.50') && (await rowText(1)).includes('-5.83%'));

  // ---- Dashboard totals + allocation ----
  await clickTab('dashboard');
  check('dashboard invested 42,512.50', (await ev(`document.getElementById('stat-invested').textContent`)).includes('42,512.50'));
  check('dashboard value 44,450.00', (await ev(`document.getElementById('stat-value').textContent`)).includes('44,450.00'));
  check('dashboard gain +1,937.50', (await ev(`document.getElementById('stat-gain').textContent`)).includes('1,937.50'));
  check('dashboard gain pct 4.56%', (await ev(`document.getElementById('stat-gain-pct').textContent`)).includes('4.56%'));
  check('dashboard count 2', (await ev(`document.getElementById('stat-count').textContent`)) === '2');
  check('best holding GP 7.97%', (await ev(`document.getElementById('best-holding').textContent`)).includes('GP') && (await ev(`document.getElementById('best-holding').textContent`)).includes('7.97%'));
  check('worst holding SQURPHARMA -5.83%', (await ev(`document.getElementById('worst-holding').textContent`)).includes('SQURPHARMA') && (await ev(`document.getElementById('worst-holding').textContent`)).includes('-5.83%'));
  check('allocation Telecom 77.73%', (await ev(`document.getElementById('alloc-host').textContent`)).includes('77.73%'));
  check('allocation Pharma 22.27%', (await ev(`document.getElementById('alloc-host').textContent`)).includes('22.27%'));

  // ---- Cash dividend GP 1000 ----
  const gpId = (await holdings())[0].id;
  const sqId = (await holdings())[1].id;
  await clickTab('dividends');
  await setVal('d-holding', gpId);
  await setVal('d-type', 'cash');
  await setVal('d-amount', '1000');
  await ev(`document.querySelector('#d-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);
  check('cash dividend recorded', (await ev(`window.DSEApp.getState().dividends.length`)) === 1);
  await clickTab('dashboard');
  check('dividend income 1,000.00', (await ev(`document.getElementById('stat-div').textContent`)).includes('1,000.00'));
  await clickTab('holdings');
  check('GP row dividend income 1,000.00', (await rowText(0)).includes('1,000.00'));

  // ---- Stock dividend SQURPHARMA 10% ----
  await clickTab('dividends');
  await setVal('d-holding', sqId);
  await setVal('d-type', 'stock');
  await setVal('d-pct', '10');
  await ev(`document.querySelector('#d-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);
  const sqAfter = (await holdings()).find((h) => h.ticker === 'SQURPHARMA');
  check('stock div: SQ shares 55', sqAfter.shares === 55, JSON.stringify(sqAfter));
  check('stock div: SQ avg buy 19114 paisa (191.14)', sqAfter.avgBuyPaisa === 19114, JSON.stringify(sqAfter));
  await clickTab('holdings');
  check('SQ row shows 55 shares', (await rowText(1)).includes('55'));
  check('SQ row shows avg 191.14', (await rowText(1)).includes('191.14'));
  check('SQ row shows value 10,890.00', (await rowText(1)).includes('10,890.00'));

  // ---- Delete stock dividend reverses it ----
  await clickTab('dividends');
  await ev(`window.confirm=function(){return true}; document.querySelectorAll('#div-body tr')[1] ? document.querySelectorAll('#div-body tr')[1].querySelector('button').click() : null`);
  const sqRev = (await holdings()).find((h) => h.ticker === 'SQURPHARMA');
  check('delete stock div reverses shares to 50', sqRev.shares === 50, JSON.stringify(sqRev));
  check('delete stock div restores avg 210.25', sqRev.avgBuyPaisa === 21025, JSON.stringify(sqRev));
  // Re-apply so the export round-trip below includes the stock dividend.
  await setVal('d-holding', sqId);
  await setVal('d-type', 'stock');
  await setVal('d-pct', '10');
  await ev(`document.querySelector('#d-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);
  check('stock div re-applied: SQ shares 55', (await holdings()).find((h) => h.ticker === 'SQURPHARMA').shares === 55);

  // ---- Watchlist: BATBC target 400, current 385 -> Below target ----
  await clickTab('watchlist');
  await setVal('w-ticker', 'BATBC');
  await setVal('w-target', '400');
  await setVal('w-note', 'Cigarette maker, high dividend');
  await ev(`document.querySelector('#w-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);
  check('watchlist has 1 item', (await ev(`window.DSEApp.getState().watchlist.length`)) === 1);
  check('watchlist shows No price yet', (await ev(`document.querySelector('#watch-body').textContent`)).includes('No price yet'));
  const wId = (await ev(`window.DSEApp.getState().watchlist`))[0].id;
  await ev(`var el=document.querySelector('.w-current'); el.value='385'; el.dispatchEvent(new Event('change',{bubbles:true}))`);
  check('watchlist 385 vs 400 -> Below target', (await ev(`document.querySelector('#watch-body').textContent`)).includes('Below target'));
  await ev(`var el=document.querySelector('.w-current'); el.value='400'; el.dispatchEvent(new Event('change',{bubbles:true}))`);
  check('watchlist 400 vs 400 -> At or above target', (await ev(`document.querySelector('#watch-body').textContent`)).includes('At or above target'));
  check('watchlist current price persisted', (await ev(`window.DSEApp.getState().watchlist`))[0].currentPaisa === 40000);

  // ---- Trade calculator: buy/sell 100 x 345.50 @ 0.40% ----
  await clickTab('trade');
  await setVal('t-holding', gpId);
  check('trade prefill price 345.50 from GP', (await ev(`document.getElementById('t-price').value`)) === '345.50');
  await setVal('t-shares', '100');
  await setVal('t-commission', '0.40');
  await ev(`document.getElementById('t-calc').click()`);
  check('trade buy gross 34,550.00', (await ev(`document.getElementById('t-gross').textContent`)).includes('34,550.00'));
  check('trade buy commission 138.20', (await ev(`document.getElementById('t-commission-amt').textContent`)).includes('138.20'));
  check('trade buy total 34,688.20', (await ev(`document.getElementById('t-total').textContent`)).includes('34,688.20'));
  check('trade buy label Total cost', (await ev(`document.getElementById('t-total-label').textContent`)).includes('Total cost'));
  await setVal('t-side', 'sell');
  await ev(`document.getElementById('t-calc').click()`);
  check('trade sell net 34,411.80', (await ev(`document.getElementById('t-total').textContent`)).includes('34,411.80'));
  check('trade sell label Net proceeds', (await ev(`document.getElementById('t-total-label').textContent`)).includes('Net proceeds'));

  // ---- Validation blocks bad input ----
  await clickTab('holdings');
  await setVal('h-ticker', '');
  await setVal('h-shares', '10');
  await setVal('h-avg', '100');
  await setVal('h-current', '100');
  await ev(`document.getElementById('h-submit').click()`);
  check('empty ticker blocked with error', (await ev(`document.getElementById('h-error').textContent`)).length > 0 && (await holdings()).length === 2);
  await setVal('h-ticker', 'TEST');
  await setVal('h-shares', '0');
  await ev(`document.getElementById('h-submit').click()`);
  check('0 shares blocked with error', (await ev(`document.getElementById('h-error').textContent`)).length > 0 && (await holdings()).length === 2);
  await setVal('h-shares', '10');
  await setVal('h-date', '2999-01-01');
  await ev(`document.getElementById('h-submit').click()`);
  check('future buy date blocked with error', (await ev(`document.getElementById('h-error').textContent`)).length > 0 && (await holdings()).length === 2);

  // ---- Export -> erase -> import round-trip ----
  const exported = await ev(`window.DSEApp.exportJSON()`);
  check('export JSON has app envelope', exported.includes('"app": "dse-portfolio-bd"') && exported.includes('SQURPHARMA'));
  await clickTab('data');
  await setVal('erase-confirm', 'DELETE');
  await ev(`document.getElementById('erase-btn').click()`);
  check('erase clears holdings', (await holdings()).length === 0);
  check('erase shows confirmation', (await ev(`document.getElementById('erase-msg').textContent`)).length > 0);
  await setVal('import-text', exported);
  await ev(`document.getElementById('import-btn').click()`);
  check('import restores 2 holdings', (await holdings()).length === 2);
  check('import restores SQ 55 shares', (await holdings()).find((h) => h.ticker === 'SQURPHARMA').shares === 55);
  check('import restores watchlist', (await ev(`window.DSEApp.getState().watchlist.length`)) === 1);
  check('import shows success message', (await ev(`document.getElementById('import-msg').textContent`)).length > 0);
  // Malformed import rejected, data intact.
  await setVal('import-text', '{"app":"wrong-app","version":1,"data":{}}');
  await ev(`document.getElementById('import-btn').click()`);
  check('malformed import rejected with message', (await ev(`document.getElementById('import-msg').textContent`)).length > 0);
  check('malformed import leaves data intact (2 holdings)', (await holdings()).length === 2);

  // ---- Language toggle: Bengali title + digits, persists after reload ----
  await ev(`document.getElementById('lang-btn').click()`);
  check('BN toggle: title in Bengali', (await ev(`document.querySelector('.topbar h1').textContent`)) === (await ev(`window.DSE_I18N.bn.appTitle`)));
  await clickTab('dashboard');
  check('BN toggle: invested shows Bengali digits', (await ev(`document.getElementById('stat-invested').textContent`)).includes('\u09ea\u09e8'));
  await nav(BASE);
  check('BN toggle persists after reload', (await ev(`localStorage.getItem('dse-portfolio-bd-lang')`)) === 'bn');
  check('holdings still 2 after reload', (await holdings()).length === 2);
  await ev(`document.getElementById('lang-btn').click()`);
  check('back to EN', (await ev(`localStorage.getItem('dse-portfolio-bd-lang')`)) === 'en');

  // ---- Mobile 390px: no horizontal overflow on all 6 tabs ----
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await nav(BASE);
  for (const tab of ['dashboard', 'holdings', 'dividends', 'watchlist', 'trade', 'data']) {
    await clickTab(tab);
    await wait(300);
    const overflow = await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
    check('390px no overflow on ' + tab + ' tab', overflow <= 0, 'overflow=' + overflow);
  }

  // ---- Zero network requests: app is fully offline (only file:// loads) ----
  const reqs = await ev(`performance.getEntriesByType('resource').map(r => r.name).filter(n => !n.startsWith('file://')).length`);
  check('zero non-file network requests', reqs === 0, 'non-file=' + reqs);

  check('no console/page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  chrome.kill();
  console.log('\n' + count + ' checks, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL - harness error: ' + e.message); process.exit(2); });
