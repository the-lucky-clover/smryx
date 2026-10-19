(() => {
  const api = globalThis.chrome || globalThis.browser;
  if (!globalThis.chrome) globalThis.chrome = api;
  const mobile = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // iOS has no desktop context menus or browser-window focus operation.
  const event = () => ({addListener() {}, removeListener() {}, hasListener() {return false;}});
  for (const namespace of new Set([api, globalThis.browser].filter(Boolean))) {
    if (mobile || !namespace.contextMenus) namespace.contextMenus = {
      create(properties, done) {done?.(); return properties.id;},
      update(id, properties, done) {done?.();},
      onClicked: event(),
    };
    if (!namespace.windows) namespace.windows = {};
    if (mobile || !namespace.windows.update) namespace.windows.update = async () => undefined;
    if (!namespace.runtime.setUninstallURL) namespace.runtime.setUninstallURL = async () => undefined;
    if (!namespace.runtime.onStartup) namespace.runtime.onStartup = event();
  }
})();
