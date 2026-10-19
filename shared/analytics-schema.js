(() => {
  const events = new Set([
    "popup_opened", "settings_opened", "batch_opened",
    "summary_requested", "summary_completed", "question_asked",
    "batch_started", "batch_completed", "batch_paused",
  ]);
  function sanitize(name, input = {}) {
    if (!events.has(name)) return null;
    input = input && typeof input === "object" ? input : {};
    const params = {};
    if (typeof input.extension_version === "string" && /^\d+(?:\.\d+){1,3}$/.test(input.extension_version)) params.extension_version = input.extension_version;
    if (Number.isInteger(input.count) && input.count >= 0 && input.count <= 5000) params.count = input.count;
    return {name, params};
  }
  globalThis.bmAnalyticsSchema = Object.freeze({sanitize});
  if (typeof module === "object") module.exports = globalThis.bmAnalyticsSchema;
})();
