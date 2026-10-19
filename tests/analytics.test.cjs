const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {createServer} = require("node:http");
const {createHandler} = require("../analytics-server/server.cjs");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
function client({enabled, endpoint = "https://relay.example/events", fetchImpl} = {}) {
  const local = {bm_analytics_enabled: enabled, "oai-deviceId": "chatgpt-device"}, session = {};
  const requests = [], listeners = [];
  const area = data => ({
    async get(keys) {return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, data[key]]));},
    async set(values) {Object.assign(data, values);},
    async remove(key) {delete data[key];},
  });
  const context = vm.createContext({
    URL, AbortController, AbortSignal, crypto: require("node:crypto").webcrypto, setTimeout, clearTimeout,
    chrome: {runtime: {id:"onjmcmgcffeimccdjjolinhhhjigmmdi", getManifest: () => ({version: "1.9.9"})}, storage: {local: area(local), session: area(session), onChanged: {addListener: listener => listeners.push(listener)}}},
    fetch: async (url, options) => {requests.push({url, options}); return fetchImpl ? fetchImpl(url, options) : {ok: true};},
  });
  vm.runInContext(read("shared/analytics-config.js"), context);
  context.bmAnalyticsConfig = {...context.bmAnalyticsConfig, endpoint};
  vm.runInContext(read("shared/analytics-schema.js"), context);
  vm.runInContext(read("background/analytics.js"), context);
  return {local, session, requests, track: context.bmAnalytics.track, status: context.bmAnalytics.status, change(value) {
    local.bm_analytics_enabled = value;
    listeners.forEach(listener => listener({bm_analytics_enabled: {newValue: value}}, "local"));
  }};
}

test("unconfigured, insecure, and explicitly disabled analytics create no ID and send nothing", async () => {
  for (const options of [{enabled: false}, {enabled: null}, {enabled: true, endpoint: ""}, {enabled: true, endpoint: "http://relay.example/events"}]) {
    const c = client(options);
    assert.equal(await c.track("summary_requested"), false);
    assert.equal(c.requests.length, 0); assert.equal(c.local.bm_analytics_client_id, undefined);
  }
});
test("analytics is enabled when no preference exists, but a saved opt-out survives reload", async () => {
  const fresh = client();
  assert.equal(await fresh.track("popup_opened"), true);
  assert.equal(fresh.requests.length, 1);
  const optedOut = client({enabled: false});
  assert.equal(await optedOut.track("popup_opened"), false);
  assert.equal(optedOut.requests.length, 0);
});
test("concurrent opted-in events use an independent ID and strip all content", async () => {
  const c = client({enabled: true});
  await Promise.all([c.track("summary_requested", {url: "private-url", text: "private-text", question: "private-question", error: "private-error"}), c.track("batch_started", {count: 4})]);
  const bodies = c.requests.map(request => JSON.parse(request.options.body));
  assert.equal(bodies[0].client_id, bodies[1].client_id);
  assert.match(bodies[0].client_id, /^\d+\.\d+$/);
  assert.equal(c.local["oai-deviceId"], "chatgpt-device");
  assert.equal(bodies[1].params.count, 4);
  assert.equal(c.requests[0].options.credentials, "omit");
  assert.ok(!JSON.stringify(bodies).includes("private-"));
  assert.equal(await c.track("arbitrary_event", {count: 1}), false);
  assert.equal(c.requests.length, 2);
});
test("opt-out aborts an in-flight request, drops queued events, and removes IDs", async () => {
  let started;
  const ready = new Promise(resolve => {started = resolve;});
  const c = client({enabled: true, fetchImpl: (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new Error("aborted")), {once: true}); started();
  })});
  const first = c.track("summary_requested"), second = c.track("question_asked");
  await ready; c.change(false);
  assert.equal(await first, false); assert.equal(await second, false);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.requests.length, 1); assert.equal(c.local.bm_analytics_client_id, undefined);
  assert.equal(c.session.bm_analytics_session, undefined); assert.equal(c.local["oai-deviceId"], "chatgpt-device");
});
test("network failure is best-effort and never retried", async () => {
  const c = client({enabled: true, fetchImpl: () => {throw Error("offline");}});
  assert.equal(await c.track("popup_opened"), false); assert.equal(c.requests.length, 1);
});
test("connection checks report readiness, missing secrets, and origin/property mismatches without creating IDs", async () => {
  for (const [health, state] of [
    [{ok:true, measurementId:"G-WV65497MC0", originAllowed:true, configured:true}, "ready"],
    [{ok:true, measurementId:"G-WV65497MC0", originAllowed:true, configured:false}, "needs_secret"],
    [{ok:true, measurementId:"G-WV65497MC0", originAllowed:false, configured:true}, "wrong_extension"],
    [{ok:true, measurementId:"G-OTHER", originAllowed:true, configured:true}, "wrong_property"],
  ]) {
    const c = client({fetchImpl: async () => ({ok:true, json:async () => health})});
    assert.equal((await c.status()).state, state);
    assert.equal(c.requests[0].url, "https://relay.example/health");
    assert.equal(c.local.bm_analytics_client_id, undefined);
  }
});
test("property configuration and analytics sources match the Safari resources", () => {
  assert.ok(read("shared/analytics-config.js").includes('"G-WV65497MC0"'));
  for (const file of ["background/analytics.js", "shared/analytics-config.js", "shared/analytics-schema.js", "shared/analytics-client.js"])
    assert.equal(read(file), read("SafariPort/SummarizeSafariExtension/Resources/" + file));
});
test("relay validates origins and input; only safe fields reach the owner property", async () => {
  const forwarded = [];
  const origin = "chrome-extension://test-extension";
  const server = createServer(createHandler({secret: "server-only-test-secret", allowedOrigins: [origin], maxPerMinute: 20, fetchImpl: async (url, options) => {forwarded.push({url, options}); return {ok: true};}}));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/events`;
    const post = (data, requestOrigin = origin) => fetch(url, {method: "POST", headers: {"Content-Type": "application/json", Origin: requestOrigin}, body: typeof data === "string" ? data : JSON.stringify(data)});
    assert.equal((await post({}, "https://unrelated.example")).status, 403);
    assert.equal((await post("not-json")).status, 400);
    assert.equal((await post({name: "unknown"})).status, 400);
    assert.equal((await post("x".repeat(2050))).status, 413);
    const response = await post({client_id: "123.456", session_id: 123, name: "batch_started", url: "private-url", params: {count: 3, extension_version: "1.9.9", text: "private-content", api_secret: "attacker-secret"}});
    assert.equal(response.status, 204); assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.equal(forwarded.length, 1);
    assert.equal(forwarded[0].url.searchParams.get("measurement_id"), "G-WV65497MC0");
    assert.equal(forwarded[0].url.searchParams.get("api_secret"), "server-only-test-secret");
    const payload = JSON.parse(forwarded[0].options.body);
    assert.equal(payload.events[0].params.count, 3);
    assert.deepEqual(payload.consent, {ad_user_data: "DENIED", ad_personalization: "DENIED"});
    assert.ok(!JSON.stringify(payload).includes("private-")); assert.ok(!JSON.stringify(payload).includes("secret"));
  } finally {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}
});
