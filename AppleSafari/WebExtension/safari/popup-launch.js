// The source Chrome UI normally starts through an in-page iframe handshake.
// Safari's toolbar popover is top-level and needs its own START handshake.
(() => {
  if (window.top !== window) return;
  document.documentElement.classList.add("bm-safari-native-popup");
  const api = globalThis.chrome || globalThis.browser;
  const ready = event => {
    if (event.source !== window || event.data?.type !== "READY" || event.data.runtimeId !== api.runtime.id) return;
    window.removeEventListener("message", ready);
    window.postMessage({type: "START", runtimeId: api.runtime.id}, location.origin);
  };
  window.addEventListener("message", ready);
})();
