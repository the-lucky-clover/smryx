// Remove identifiers left by earlier releases. Never touch ChatGPT session data.
(async () => {
  const api = globalThis.browser || globalThis.chrome;
  try {
    await Promise.all([
      api.storage.local.remove("clientId"),
      api.storage.session?.remove("sessionData"),
    ]);
  } catch (error) {
    console.warn("Could not clear legacy usage identifiers", error);
  }
})();
