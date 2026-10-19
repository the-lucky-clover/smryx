(() => {
  if (window !== window.top) return;
  const viewport = window.visualViewport;
  function update() {
    const panel = document.getElementById("chatgpt-summarize-popup");
    if (!panel) return;
    panel.style.setProperty("--bm-safari-visible-height", `${viewport?.height || innerHeight}px`);
    panel.style.setProperty("--bm-safari-visible-width", `${viewport?.width || innerWidth}px`);
    panel.style.setProperty("--bm-safari-visible-top", `${viewport?.offsetTop || 0}px`);
    panel.style.setProperty("--bm-safari-visible-left", `${viewport?.offsetLeft || 0}px`);
  }
  viewport?.addEventListener("resize", update);
  viewport?.addEventListener("scroll", update);
  window.addEventListener("resize", update);
  new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes].some(node => node.id === "chatgpt-summarize-popup"))) update();
  }).observe(document, {childList: true, subtree: true});
})();
