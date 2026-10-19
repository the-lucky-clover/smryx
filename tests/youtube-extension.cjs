const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const root = path.resolve(__dirname, '..');
  const videoId = 'GAqL-uDExDI';
  const watchURL = `https://www.youtube.com/watch?v=${videoId}`;
  const captionURL = `https://www.youtube.com/api/timedtext?v=${videoId}`;
  const captionJSON = JSON.stringify({events: [{tStartMs: 0, dDurationMs: 1000, segs: [{utf8: 'Verified video transcript'}]}]});
  const captionXML = '<transcript><text start="0" dur="1">Verified XML transcript</text></transcript>';
  let mode = 'json', captionRequests = 0, watchRequests = 0;
  let context;
  try {
    context = await chromium.launchPersistentContext('', {
      channel: 'chromium', headless: true,
      args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
    });
    context.setDefaultTimeout(15000);
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    await worker.evaluate(() => chrome.storage.local.set({showSummarizeButton: false, showYoutubeButton: false}));
    const warnings = [], errors = [];
    const capture = page => {
      page.on('console', message => {
        if (['warning', 'error'].includes(message.type())) warnings.push(message.text());
      });
      page.on('pageerror', error => errors.push(error.message));
    };
    worker.on('console', message => {
      if (['warning', 'error'].includes(message.type())) warnings.push(message.text());
    });
    await context.route('https://www.youtube.com/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/timedtext') {
        captionRequests++;
        if (mode === 'hang') return; // Leave pending until the content script's abort timer fires.
        if (mode === 'network-error') return route.abort('failed');
        return route.fulfill({contentType: mode === 'xml' ? 'text/xml' : 'application/json', body: mode === 'empty' ? '' : mode === 'xml' ? captionXML : captionJSON});
      }
      if (url.pathname === '/watch') {
        watchRequests++;
        const metadata = {videoDetails: {videoId: url.searchParams.get('v')}, captions: {playerCaptionsTracklistRenderer: {captionTracks: mode === 'missing' ? [] : [{baseUrl: captionURL}]}}};
        const body = `<!doctype html><html><head><title>Caption test - YouTube</title></head><body><main>Controlled video page</main><button class="ytp-subtitles-button" aria-pressed="false" onclick="window.captionClicks++; this.setAttribute('aria-pressed', this.getAttribute('aria-pressed') === 'true' ? 'false' : 'true')">Captions</button><script>window.captionClicks=0; var ytInitialPlayerResponse=${JSON.stringify(metadata)};</script></body></html>`;
        return route.fulfill({contentType: 'text/html', body});
      }
      return route.fulfill({body: ''});
    });
    const page = await context.newPage();
    capture(page);
    const request = () => worker.evaluate(async watchURL => {
      const [tab] = await chrome.tabs.query({url: watchURL});
      return chrome.tabs.sendMessage(tab.id, {type: 'GET_PAGE_SUBTITLES', to: 'content-script'});
    }, watchURL);
    for (const next of ['json', 'xml', 'empty', 'missing', 'hang', 'network-error']) {
      mode = next;
      captionRequests = watchRequests = 0;
      await page.goto(watchURL);
      const start = Date.now();
      const result = await request();
      if (mode === 'json' || mode === 'xml') {
        assert.equal(result.videoId, videoId);
        assert.equal(result.text, mode === 'xml' ? captionXML : captionJSON);
      } else {
        assert.ok(result == null, `Unexpected transcript for ${mode}`);
      }
      assert.equal(await page.evaluate(() => window.captionClicks), 0);
      assert.equal(await page.locator('.ytp-subtitles-button').getAttribute('aria-pressed'), 'false');
      if (mode === 'missing') assert.equal(captionRequests, 0);
      else assert.equal(captionRequests, 1, `Duplicate caption fetch for ${mode}`);
      if (mode === 'hang') assert.ok(Date.now() - start < 10000, 'Caption fetch did not abort promptly');
      console.log(`PASS loaded extension: ${mode}`);
    }
    // Real runtime delivery of an observed caption URL, without inline metadata.
    mode = 'json';
    await page.goto(watchURL);
    await page.locator('script').evaluateAll(scripts => scripts.forEach(script => script.remove()));
    watchRequests = 0;
    assert.equal((await request()).text, captionJSON);
    assert.equal(watchRequests, 1);
    console.log('PASS loaded extension: fetched watch metadata');
    await worker.evaluate(async ({watchURL, captionURL}) => {
      const [tab] = await chrome.tabs.query({url: watchURL});
      await chrome.tabs.sendMessage(tab.id, {type: 'GET_SUBTITLES_URL', to: 'content-script', url: captionURL});
    }, {watchURL, captionURL});
    watchRequests = 0;
    assert.equal((await request()).text, captionJSON);
    assert.equal(watchRequests, 0);
    console.log('PASS loaded extension: captured URL cache');
    assert.deepEqual(errors, []);
    // Network failures are browser diagnostics; extension warnings must stay empty.
    assert.deepEqual(warnings.filter(message => !message.startsWith('Failed to load resource:')), []);
    console.log('PASS no extension warnings or uncaught errors');
  } finally {
    await context?.close();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
