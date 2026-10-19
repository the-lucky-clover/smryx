const {createServer} = require("node:http");
const {sanitize} = require("../shared/analytics-schema.js");
const MEASUREMENT_ID = "G-WV65497MC0";

function createHandler({secret, measurementId = MEASUREMENT_ID, allowedOrigins = [], fetchImpl = fetch, now = Date.now, maxPerMinute = 1000}) {
  if (!secret || !/^G-[A-Z0-9]+$/.test(measurementId) || !allowedOrigins.length) throw new Error("Configure GA_API_SECRET, GA_MEASUREMENT_ID and ALLOWED_EXTENSION_ORIGINS on the server.");
  const origins = new Set(allowedOrigins);
  let windowStart = now(), count = 0;
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const finish = status => {res.statusCode = status; res.end();};
    if (req.url !== "/events") return finish(404);
    const extensionId = req.headers["x-beast-mode-extension"] || "";
    const origin = req.headers.origin || (/^[a-p]{32}$/.test(extensionId) ? `chrome-extension://${extensionId}` : "");
    if (!origins.has(origin)) return finish(403);
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "POST");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Beast-Mode-Extension");
      return finish(204);
    }
    if (req.method !== "POST") return finish(405);
    if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || "")) return finish(415);
    if (now() - windowStart >= 60000) {windowStart = now(); count = 0;}
    if (++count > maxPerMinute) return finish(429);
    try {
      let body = "", size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 2048) return finish(413);
        body += chunk.toString("utf8");
      }
      let data;
      try {data = JSON.parse(body);} catch {return finish(400);}
      if (!data || typeof data !== "object") return finish(400);
      const event = sanitize(data.name, data.params);
      if (!event || !/^\d{1,20}\.\d{1,20}$/.test(data.client_id || "") || !Number.isSafeInteger(data.session_id) || data.session_id <= 0) return finish(400);
      // Rebuild the payload: URLs, prompts, credentials and arbitrary fields
      // received by this public endpoint can never be forwarded to Google.
      const payload = {
        client_id: data.client_id,
        consent: {ad_user_data: "DENIED", ad_personalization: "DENIED"},
        events: [{name: event.name, params: {...event.params, session_id: data.session_id, engagement_time_msec: 100}}],
      };
      const target = new URL("https://www.google-analytics.com/mp/collect");
      target.searchParams.set("measurement_id", measurementId);
      target.searchParams.set("api_secret", secret);
      const response = await fetchImpl(target, {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload), signal: AbortSignal.timeout(2500),
      });
      return finish(response.ok ? 204 : 502);
    } catch {return finish(502);}
  };
}

if (require.main === module) {
  const handler = createHandler({
    secret: process.env.GA_API_SECRET,
    measurementId: process.env.GA_MEASUREMENT_ID || MEASUREMENT_ID,
    allowedOrigins: (process.env.ALLOWED_EXTENSION_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean),
  });
  createServer(handler).listen(Number(process.env.PORT || 3000), process.env.HOST || "127.0.0.1", () => console.log("Analytics relay listening"));
}
module.exports = {createHandler};
