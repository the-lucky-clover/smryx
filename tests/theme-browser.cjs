const { chromium } = require('playwright');
const { createServer } = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
  const server = createServer(async (req, res) => {
    const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    try {
      res.setHeader('Content-Type', ({'.js':'text/javascript', '.css':'text/css', '.html':'text/html'})[path.extname(file)] || 'application/octet-stream');
      res.end(await fs.readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless: true});
    const context = await browser.newContext({acceptDownloads: true});
    // Exercise the standalone theme surfaces with extension storage mocked.
    // The existing provider/settings bundles require a live extension context.
    await context.route(/\/(options|popup)\/index\.js$/, route => route.fulfill({contentType: 'text/javascript', body: ''}));
    await context.addInitScript(() => {
      const listeners = [];
      window.chrome = {storage: {local: {
        async get(key) {const value = localStorage.getItem(key); return value === null ? {} : {[key]: JSON.parse(value)};},
        async set(values) {
          const changes = {};
          for (const [key, value] of Object.entries(values)) {changes[key] = {newValue: value}; localStorage.setItem(key, JSON.stringify(value));}
          for (const listener of listeners) listener(changes, 'local');
        }
      }, onChanged: {addListener(fn) {listeners.push(fn);}}}};
      window.addEventListener('storage', event => {
        for (const listener of listeners) listener({[event.key]: {newValue: event.newValue === null ? undefined : JSON.parse(event.newValue)}}, 'local');
      });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(base + '/options/index.html');
    await page.waitForSelector('.ts-card');
    assert.equal(await page.locator('.ts-card').count(), 5);
    await page.click('#ts-new-btn');
    const name = '<img src=x onerror=alert(1)> "Rainbow"';
    await page.fill('#ts-name-input', name);
    await page.locator('[data-var-key="bgPrimary"]').evaluate(el => {el.value = '#123456'; el.dispatchEvent(new Event('input'));});
    await page.click('#ts-preview-btn');
    assert.equal(await page.locator('#bm-theme-studio').evaluate(el => getComputedStyle(el).getPropertyValue('--ts-bg').trim()), '#123456');
    await page.click('#ts-cancel-btn');
    assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--bg-primary')), '');
    await page.click('#ts-new-btn');
    await page.fill('#ts-name-input', name);
    await page.click('#ts-save-btn');
    await page.waitForFunction(() => document.querySelectorAll('.ts-card').length === 6);
    assert.equal(await page.locator('.ts-card img').count(), 0);
    const custom = page.locator('.ts-card').last();
    await custom.locator('[data-action="apply"]').click();
    await custom.locator('[data-action="edit"]').click();
    assert.equal(await page.inputValue('#ts-name-input'), name);
    await page.locator('[data-var-key="bgPrimary"]').evaluate(el => {el.value = '#123456'; el.dispatchEvent(new Event('input'));});
    await page.click('#ts-save-btn');
    await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--bg-primary') === '#123456');
    const downloadPromise = page.waitForEvent('download');
    await page.click('#ts-export-btn');
    const download = await downloadPromise;
    const exported = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
    assert.equal(exported.name, name);
    assert.equal(exported.vars.bgPrimary, '#123456');
    await page.locator('#ts-import-file-input').setInputFiles({name: 'theme.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported))});
    await page.waitForFunction(() => document.querySelectorAll('.ts-card').length === 7);
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {value: {writeText: async () => {throw Error('Unavailable');}}, configurable: true}));
    await page.click('#ts-share-btn');
    await page.waitForFunction(() => document.querySelector('#ts-share-input').value.startsWith('BM1:'));
    await page.click('#ts-share-import-btn');
    await page.waitForFunction(() => document.querySelectorAll('.ts-card').length === 8);
    await page.locator('#ts-import-file-input').setInputFiles({name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({...exported, vars: {...exported.vars, bgPrimary: 'red;display:none'}}))});
    await page.waitForFunction(() => document.querySelector('#ts-toast').textContent.includes('valid theme'));
    assert.equal(await page.locator('.ts-card').count(), 8);
    await page.locator('.ts-card.is-active [data-action="delete"]').click();
    await page.waitForFunction(() => document.querySelector('.ts-card.is-active').dataset.themeId === 'system');
    await page.reload();
    await page.waitForSelector('.ts-card');
    assert.equal(await page.locator('.ts-card').count(), 7);
    await page.emulateMedia({colorScheme: 'dark'});
    await page.selectOption('#ts-mode', 'light');
    await page.waitForFunction(() => document.documentElement.dataset.bmTheme === 'light');
    assert.equal(await page.locator('#bm-theme-studio').evaluate(el => getComputedStyle(el).getPropertyValue('--ts-bg').trim()), '#ffffff');
    await page.selectOption('#ts-mode', 'dark');
    await page.emulateMedia({colorScheme: 'light'});
    await page.waitForFunction(() => document.documentElement.dataset.bmTheme === 'dark');
    assert.equal(await page.locator('#bm-theme-studio').evaluate(el => getComputedStyle(el).getPropertyValue('--ts-bg').trim()), '#26272b');
    await page.selectOption('#ts-mode', 'system');
    await page.waitForFunction(() => document.documentElement.dataset.bmTheme === 'light');
    await page.emulateMedia({colorScheme: 'dark'});
    await page.waitForFunction(() => document.documentElement.dataset.bmTheme === 'dark');
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.bmTheme === 'dark');
    assert.equal(await page.inputValue('#ts-mode'), 'system');
    const popup = await context.newPage();
    popup.on('pageerror', error => errors.push(error.message));
    await popup.goto(base + '/popup/index.html');
    await page.selectOption('#ts-mode', 'dark');
    await popup.waitForFunction(() => document.documentElement.dataset.bmTheme === 'dark');
    assert.equal(await popup.getAttribute('#theme-toggle-btn', 'aria-pressed'), 'true');
    await popup.click('#theme-toggle-btn');
    await page.waitForFunction(() => document.documentElement.dataset.bmTheme === 'light');
    assert.equal(await page.inputValue('#ts-mode'), 'light');
    await page.click('#ts-new-btn');
    await page.fill('#ts-name-input', 'Must not silently save');
    await page.evaluate(() => {
      window.originalSet = chrome.storage.local.set;
      chrome.storage.local.set = async () => {throw Error('Disk full');};
    });
    await page.click('#ts-save-btn');
    await page.waitForFunction(() => document.querySelector('#ts-toast').textContent.includes('storage'));
    assert.equal(await page.locator('#ts-editor').isVisible(), true);
    assert.equal(await page.locator('#ts-save-btn').isEnabled(), true);
    assert.equal(await page.locator('.ts-card').count(), 7);
    await page.evaluate(() => {chrome.storage.local.set = window.originalSet;});
    await page.click('#ts-save-btn');
    await page.waitForFunction(() => document.querySelectorAll('.ts-card').length === 8);
    await popup.evaluate(() => {
      chrome.storage.local.set = async () => {throw Error('Disk full');};
    });
    await popup.click('#theme-toggle-btn');
    await popup.waitForFunction(() => document.querySelector('#bm-header-status')?.textContent.includes('storage'));
    assert.equal(await popup.getAttribute('#theme-toggle-btn', 'aria-pressed'), 'false');
    assert.equal(await popup.locator('#theme-toggle-btn').isEnabled(), true);
    // Use the bundle's root/tab/scroll structure to verify the popup's CSS geometry.
    await popup.locator('#app').evaluate(app => {
      app.innerHTML = `<div class="bm-app flex h-full flex-col"><div>Summary tools</div><div class="bm-workspace"><nav>Summary · Ask a question</nav><div class="bm-content-scroll h-full overflow-y-auto"><div role="tabpanel"><article class="prose max-w-none px-4" id="gpt-answer"><h1>Summary</h1>${'<p>A detailed summary uses the available reading area.</p>'.repeat(100)}</article></div></div></div></div>`;
    });
    for (const [width, height, scale] of [[700, 600, 1], [1100, 850, 1], [360, 480, 1.3]]) {
      await popup.setViewportSize({width, height});
      await popup.evaluate(scale => document.documentElement.style.setProperty('--font-scale', scale), scale);
      const geometry = await popup.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect();
        const scroll = document.querySelector('.bm-content-scroll');
        return {bodyWidth: rect('body').width, appWidth: rect('#app').width, scrollBottom: rect('.bm-content-scroll').bottom, scrollHeight: scroll.clientHeight, contentHeight: scroll.scrollHeight, pageHeight: document.documentElement.scrollHeight, fontSize: getComputedStyle(document.documentElement).fontSize};
      });
      assert.equal(geometry.bodyWidth, width);
      assert.equal(geometry.appWidth, width);
      assert.ok(Math.abs(geometry.scrollBottom - height) < 1, JSON.stringify(geometry));
      assert.ok(geometry.contentHeight > geometry.scrollHeight);
      assert.equal(geometry.pageHeight, height);
      assert.equal(geometry.fontSize, `${15 * scale}px`);
    }
    await popup.click('#text-size-btn');
    await popup.waitForTimeout(200);
    assert.equal(await popup.locator('#text-size-slider').evaluate(el => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return hit === el;
    }), true);
    await page.setViewportSize({width: 360, height: 780});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    console.log('PASS: Theme Studio create, preview/cancel, save, apply, edit, export, import, share fallback, invalid input, delete, reload, and safe name rendering.');
    console.log('PASS: explicit light/dark, system changes, persisted mode, popup synchronization in both directions, and narrow layout.');
    console.log('PASS: failed storage writes show errors, preserve the draft and active mode, re-enable controls, and allow retry without unhandled errors.');
    console.log('PASS: popup fills 700x600, 1100x850, and 360x480 frames, scrolls internally, scales text, and keeps the text-size popover reachable.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
