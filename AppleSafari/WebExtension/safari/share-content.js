(() => {
  if (window !== window.top) return;
  const api = globalThis.chrome || globalThis.browser;
  window.addEventListener("message", event => {
    const message = event.data;
    if (event.source !== window || event.origin !== location.origin || message?.type !== "BM_SAFARI_SHARE_OPEN") return;
    if (message.url !== location.href || !/^[0-9a-f-]{36}$/i.test(message.token || "")) return;
    // The worker/native handler must consume the single-use token before opening.
    api.runtime.sendMessage({to: "safari-share", type: "BM_SAFARI_SHARE_OPEN", token: message.token, url: location.href}).catch(() => {});
  });
})();
