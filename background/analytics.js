// Loaded only in the worker. Tracking never blocks inference or stores content.
(() => {
  const api = globalThis.browser || globalThis.chrome;
  const enabledKey = "bm_analytics_enabled", clientKey = "bm_analytics_client_id", sessionKey = "bm_analytics_session";
  const enabled = value => value === undefined || value === true;
  let chain = Promise.resolve(), pending = 0, active, generation = 0;
  function endpoint() {
    try {
      const url = new URL(globalThis.bmAnalyticsConfig.endpoint);
      return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash ? url.href : "";
    } catch { return ""; }
  }
  async function send(event, consentGeneration) {
    const target = endpoint();
    if (!target || generation !== consentGeneration) return false;
    const state = await api.storage.local.get([enabledKey, clientKey]);
    if (!enabled(state[enabledKey])) return false;
    let client = state[clientKey];
    if (!/^\d+\.\d+$/.test(client || "")) {
      client = `${crypto.getRandomValues(new Uint32Array(1))[0] || 1}.${Math.floor(Date.now() / 1000)}`;
      await api.storage.local.set({[clientKey]: client});
    }
    const now = Date.now();
    const stored = api.storage.session ? await api.storage.session.get(sessionKey) : {};
    const previous = stored[sessionKey];
    const session = previous && now - previous.updatedAt < 1800000 ? previous : {id: Math.floor(now / 1000), updatedAt: now};
    session.updatedAt = now;
    await api.storage.session?.set({[sessionKey]: session});
    // Recheck after asynchronous storage work in case the user opted out.
    if (!enabled((await api.storage.local.get(enabledKey))[enabledKey]) || generation !== consentGeneration) return false;
    const controller = new AbortController(); active = controller;
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(target, {
        method: "POST", credentials: "omit", referrerPolicy: "no-referrer",
        headers: {"Content-Type": "application/json", "X-Beast-Mode-Extension": api.runtime.id}, signal: controller.signal,
        body: JSON.stringify({client_id: client, session_id: session.id, ...event}),
      });
      return response.ok;
    } finally { clearTimeout(timeout); if (active === controller) active = undefined; }
  }
  globalThis.bmAnalytics = Object.freeze({
    async status() {
      const target = endpoint();
      if (!target) return {state: "unconfigured"};
      const url = new URL(target); url.pathname = "/health";
      try {
        const response = await fetch(url.href, {headers: {"X-Beast-Mode-Extension": api.runtime.id}, credentials: "omit", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(5000)});
        if (!response.ok) return {state: "unavailable"};
        const health = await response.json();
        if (!health.ok || health.measurementId !== globalThis.bmAnalyticsConfig.measurementId) return {state: "wrong_property"};
        if (!health.originAllowed) return {state: "wrong_extension"};
        return {state: health.configured ? "ready" : "needs_secret"};
      } catch {return {state: "unavailable"};}
    },
    track(name, params) {
      const event = globalThis.bmAnalyticsSchema.sanitize(name, {...params, extension_version: api.runtime.getManifest().version});
      if (!event || pending >= 20) return Promise.resolve(false);
      const consentGeneration = generation;
      pending++;
      const task = chain.then(() => send(event, consentGeneration)).catch(() => false).finally(() => {pending--;});
      chain = task;
      return task;
    },
  });
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[enabledKey] || enabled(changes[enabledKey].newValue)) return;
    generation++;
    active?.abort();
    // Run after pending sends so opting out cannot leave a newly created ID.
    chain = chain.then(async () => {
      await api.storage.local.remove(clientKey);
      await api.storage.session?.remove(sessionKey);
    }).catch(() => {});
  });
})();
