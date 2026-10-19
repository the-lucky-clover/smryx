const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../content-script/index.js'), 'utf8');
const code = source.slice(source.indexOf('const bmCaptionURLs'), source.indexOf('function we(){'));
const videoId = 'GAqL-uDExDI';
const url = `https://www.youtube.com/api/timedtext?v=${videoId}`;
const captions = JSON.stringify({events: [{segs: [{utf8: 'Actual transcript'}]}]});
function setup({scripts = [], button = null, response = '', html = '', ok = true, fetchImpl} = {}) {
  const listeners = new Set(), timers = new Set(), requests = [];
  const ctx = vm.createContext({URL, AbortController, DOMParser: class {parseFromString() {return {querySelector: () => true};}},
    Z: href => new URL(href).searchParams.get('v'), window: {location: {href: `https://www.youtube.com/watch?v=${videoId}`}, addEventListener() {}},
    console: {warn: () => assert.fail('Caption fallback must not emit extension warnings'), error: () => assert.fail('Caption fallback must not emit extension errors')},
    document: {querySelector: () => button, querySelectorAll: () => scripts.map(textContent => ({textContent}))},
    ae: {default: {runtime: {onMessage: {addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn)}}}},
    setTimeout: fn => {timers.add(fn); return fn;}, clearTimeout: fn => timers.delete(fn),
    fetch: async (target, options) => {requests.push(target); return fetchImpl ? fetchImpl(target, options) : {ok, text: async () => target.includes('/api/timedtext') ? response : html};}
  });
  vm.runInContext(code, ctx);
  return {ctx, listeners, timers, requests};
}
test('cached caption requests work without a caption button', async () => {
  const {ctx, listeners, requests} = setup({response: captions});
  for (const listener of listeners) listener({type: 'GET_SUBTITLES_URL', url});
  assert.equal((await ctx.Ne()).text, captions);
  assert.deepEqual(requests, [url]);
});
test('metadata fallback runs without a caption button and tries all tracks', async () => {
  const metadata = {videoDetails: {videoId}, captions: {playerCaptionsTracklistRenderer: {captionTracks: [{baseUrl: 'https://example.test/invalid'}, {baseUrl: url}]}}};
  const {ctx} = setup({scripts: ['var ytInitialPlayerResponse = ' + JSON.stringify(metadata) + ';'], response: captions});
  assert.equal((await ctx.Ne()).text, captions);
});
test('balanced metadata parser handles nested braces and escaped strings', () => {
  const {ctx} = setup();
  const data = {title: 'A }; and "quoted" title', nested: {value: 1}};
  assert.equal(JSON.stringify(ctx.bmPlayerResponse('ytInitialPlayerResponse = ' + JSON.stringify(data) + '; trailing')), JSON.stringify(data));
});
test('failed, empty, HTML, and unrelated caption responses are rejected', async () => {
  for (const response of ['', '<html>Blocked</html>', '{}', '{"events":[]}']) {
    assert.equal(await setup({response}).ctx.zt(url, videoId), undefined);
  }
  assert.equal(await setup({ok: false, response: captions}).ctx.zt(url, videoId), undefined);
  assert.equal(await setup({response: captions}).ctx.zt(url + 'other', videoId), undefined);
});
test('missing captions return without toggling the player or waiting for interception', async () => {
  let pressed = 'false';
  const button = {getAttribute: name => name === 'aria-pressed' ? pressed : null, click: () => {pressed = pressed === 'true' ? 'false' : 'true';}};
  const {ctx, timers, listeners} = setup({button});
  assert.equal(await ctx.Ne(), undefined);
  assert.equal(pressed, 'false');
  assert.equal(listeners.size, 1);
  assert.equal(timers.size, 0);
});

test('a hanging watch request aborts and clears its timer without warning', async () => {
  const {ctx, timers, listeners} = setup({fetchImpl: (target, {signal}) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('Aborted')), {once: true});
  })});
  const pending = ctx.Ne();
  assert.equal(timers.size, 1);
  for (const timer of [...timers]) timer();
  assert.equal(await pending, undefined);
  assert.equal(timers.size, 0);
  assert.equal(listeners.size, 1);
});

test('watch HTML supplies captions when inline metadata is stale after navigation', async () => {
  const metadata = {videoDetails: {videoId}, captions: {playerCaptionsTracklistRenderer: {captionTracks: [{baseUrl: url}]}}};
  const stale = {...metadata, videoDetails: {videoId: 'another-video'}};
  const {ctx, requests} = setup({scripts: ['ytInitialPlayerResponse = ' + JSON.stringify(stale)], html: 'ytInitialPlayerResponse = ' + JSON.stringify(metadata), response: captions});
  assert.equal((await ctx.Ne()).text, captions);
  assert.deepEqual(requests, [`https://www.youtube.com/watch?v=${videoId}`, url]);
});

test('navigation during caption fetching cannot return the previous video transcript', async () => {
  let complete;
  const {ctx, listeners, requests, timers} = setup({fetchImpl: () => new Promise(resolve => {complete = resolve;})});
  for (const listener of listeners) listener({type: 'GET_SUBTITLES_URL', url});
  const pending = ctx.Ne();
  ctx.window.location.href = 'https://www.youtube.com/watch?v=other-video';
  complete({ok: true, text: async () => captions});
  assert.equal(await pending, undefined);
  assert.deepEqual(requests, [url]);
  assert.equal(timers.size, 0);
});

test('duplicate tracks are fetched once across inline and fetched metadata', async () => {
  const metadata = 'ytInitialPlayerResponse = ' + JSON.stringify({videoDetails: {videoId}, captions: {playerCaptionsTracklistRenderer: {captionTracks: [{baseUrl: url}, {baseUrl: url}]}}});
  const {ctx, requests} = setup({scripts: [metadata, metadata], html: metadata});
  assert.equal(await ctx.Ne(), undefined);
  assert.equal(requests.filter(target => target === url).length, 1);
});
