import {test} from "node:test";
import assert from "node:assert/strict";
import {createWorker} from "../analytics-server/worker.mjs";
const origin = "chrome-extension://onjmcmgcffeimccdjjolinhhhjigmmdi";
const environment = () => ({GA_API_SECRET: "fake-server-secret", GA_MEASUREMENT_ID: "G-WV65497MC0", ALLOWED_EXTENSION_ORIGINS: origin, EVENT_RATE_LIMITER: {limit: async () => ({success: true})}});
const payload = {name: "batch_started", client_id: "123.456", session_id: 123, params: {count: 2, extension_version: "1.9.9", question: "private-question", url: "private-url"}};
const request = (body = payload, source = origin) => new Request("https://relay.example/events", {method: "POST", headers: {Origin: source, "Content-Type": "application/json"}, body: JSON.stringify(body)});

test("Worker exposes readiness without secrets and fails closed until configured", async () => {
  const worker = createWorker(() => {throw Error("No upstream requests expected");});
  const env = environment(); delete env.GA_API_SECRET;
  const health = await worker.fetch(new Request("https://relay.example/health", {headers: {Origin: origin}}), env);
  const body = await health.json();
  assert.equal(body.configured, false); assert.equal(body.originAllowed, true);
  assert.equal(body.measurementId, "G-WV65497MC0"); assert.ok(!JSON.stringify(body).includes("secret"));
  assert.equal((await worker.fetch(request(), env)).status, 503);
  assert.equal((await worker.fetch(request(payload, "https://unknown.example"), env)).status, 403);
  const noOrigin = new Request("https://relay.example/health", {headers: {"X-Beast-Mode-Extension": origin.slice("chrome-extension://".length)}});
  assert.equal((await (await worker.fetch(noOrigin, env)).json()).originAllowed, true);
  const spoofedOrigin = new Request("https://relay.example/events", {method:"POST", headers:{Origin:"https://unknown.example", "X-Beast-Mode-Extension":origin.slice("chrome-extension://".length)}});
  assert.equal((await worker.fetch(spoofedOrigin, env)).status, 403);
});
test("Worker forwards only allowlisted data and keeps credentials on the server", async () => {
  const calls = [];
  const worker = createWorker(async (url, options) => {calls.push({url, options}); return new Response(null, {status: 204});});
  const response = await worker.fetch(request(), environment());
  assert.equal(response.status, 204); assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal(calls.length, 1); assert.equal(calls[0].url.searchParams.get("measurement_id"), "G-WV65497MC0");
  assert.equal(calls[0].url.searchParams.get("api_secret"), "fake-server-secret");
  const data = JSON.parse(calls[0].options.body);
  assert.equal(data.events[0].params.count, 2);
  assert.deepEqual(data.consent, {ad_user_data: "DENIED", ad_personalization: "DENIED"});
  assert.ok(!JSON.stringify(data).includes("private-"));
  const options = await worker.fetch(new Request("https://relay.example/events", {method: "OPTIONS", headers: {Origin: origin}}), environment());
  assert.equal(options.status, 204); assert.equal(options.headers.get("Access-Control-Max-Age"), "600");
});
test("Worker rejects oversized/invalid input and honors edge rate limits", async () => {
  const worker = createWorker(() => {throw Error("No upstream requests expected");});
  assert.equal((await worker.fetch(request({name: "unknown"}), environment())).status, 400);
  assert.equal((await worker.fetch(request({text: "x".repeat(2100)}), environment())).status, 413);
  const env = environment(); env.EVENT_RATE_LIMITER.limit = async () => ({success: false});
  assert.equal((await worker.fetch(request(), env)).status, 429);
});
