export function trackUsage(name, params) {
  return chrome.runtime.sendMessage({type: "BM_ANALYTICS_EVENT", to: "background", name, params}).catch(() => false);
}
