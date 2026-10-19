import "../shared/analytics-schema.js";

export function createWorker(fetchImpl = fetch) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      // Privileged extension fetches can omit Origin. The public extension ID
      // is a fallback identifier, never authentication against non-browser clients.
      const extensionId = request.headers.get("X-Beast-Mode-Extension") || "";
      const origin = request.headers.get("Origin") || (/^[a-p]{32}$/.test(extensionId) ? `chrome-extension://${extensionId}` : "");
      const origins = (env.ALLOWED_EXTENSION_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean);
      const allowed = origins.includes(origin);
      const configured = Boolean(env.GA_API_SECRET && /^G-[A-Z0-9]+$/.test(env.GA_MEASUREMENT_ID || "") && origins.length);
      const headers = {"Cache-Control": "no-store", "Vary": "Origin"};
      if (allowed) headers["Access-Control-Allow-Origin"] = origin;
      const respond = (status, body) => new Response(body ? JSON.stringify(body) : null, {status, headers: body ? {...headers, "Content-Type": "application/json"} : headers});
      if (url.pathname === "/health" && request.method === "GET") {
        return respond(200, {ok: true, configured, measurementId: env.GA_MEASUREMENT_ID, originAllowed: allowed});
      }
      if (url.pathname !== "/events" || url.search) return respond(404);
      if (!allowed) return respond(403);
      if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: {...headers, "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type, X-Beast-Mode-Extension", "Access-Control-Max-Age": "600"}});
      if (request.method !== "POST") return respond(405);
      if (!configured || !env.EVENT_RATE_LIMITER) return respond(503);
      if (!/^application\/json(?:;|$)/i.test(request.headers.get("Content-Type") || "")) return respond(415);
      try {
        const reader = request.body?.getReader();
        if (!reader) return respond(400);
        let size = 0;
        const chunks = [];
        while (true) {
          const {done, value} = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 2048) {await reader.cancel(); return respond(413);}
          chunks.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
        let data;
        try {data = JSON.parse(new TextDecoder().decode(bytes));} catch {return respond(400);}
        if (!data || typeof data !== "object") return respond(400);
        const event = globalThis.bmAnalyticsSchema.sanitize(data.name, data.params);
        if (!event || !/^\d{1,20}\.\d{1,20}$/.test(data.client_id || "") || !Number.isSafeInteger(data.session_id) || data.session_id <= 0) return respond(400);
        const limit = await env.EVENT_RATE_LIMITER.limit({key: `beast-mode-analytics:${data.client_id}`});
        if (!limit.success) return respond(429);
        const target = new URL("https://www.google-analytics.com/mp/collect");
        target.searchParams.set("measurement_id", env.GA_MEASUREMENT_ID);
        target.searchParams.set("api_secret", env.GA_API_SECRET);
        const response = await fetchImpl(target, {
          method: "POST", headers: {"Content-Type": "application/json"},
          signal: AbortSignal.timeout(2500),
          body: JSON.stringify({client_id: data.client_id, consent: {ad_user_data: "DENIED", ad_personalization: "DENIED"}, events: [{name: event.name, params: {...event.params, session_id: data.session_id, engagement_time_msec: 100}}]}),
        });
        return respond(response.ok ? 204 : 502);
      } catch {return respond(502);}
    },
  };
}

export default createWorker();
