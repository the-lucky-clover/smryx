import "../shared/analytics-config.js";
import {trackUsage} from "../shared/analytics-client.js";
const key = "bm_analytics_enabled";
const checkbox = document.getElementById("analytics-enabled");
const status = document.getElementById("analytics-status");
const check = document.getElementById("analytics-check");
function update(state) {
  const enabled = state === undefined || state === true;
  checkbox.checked = enabled;
  status.textContent = !globalThis.bmAnalyticsConfig.endpoint
    ? "Analytics is not connected yet. No usage events are being sent."
    : enabled ? "Usage analytics is enabled." : "Usage analytics is off.";
}
check.addEventListener("click", async () => {
  check.disabled = true;
  status.textContent = "Checking the analytics connection…";
  try {
    const result = await chrome.runtime.sendMessage({type: "BM_ANALYTICS_STATUS", to: "background"});
    const messages = {
      ready: checkbox.checked ? "Connected to your Google Analytics property. Usage analytics is enabled." : "Connected to your Google Analytics property. Enable usage statistics above to start sharing.",
      needs_secret: "The relay is online. Add GA_API_SECRET in the Cloudflare Worker’s Variables and Secrets, deploy it, then check again.",
      wrong_extension: `The relay does not recognize this installation. Add chrome-extension://${chrome.runtime.id} to ALLOWED_EXTENSION_ORIGINS in the Cloudflare Worker.`,
      wrong_property: "The relay is connected to a different Google Analytics property. Check its GA_MEASUREMENT_ID setting.",
      unconfigured: "The analytics relay URL has not been configured.",
      unavailable: "The analytics relay could not be reached. Please try again.",
    };
    status.textContent = messages[result?.state] || messages.unavailable;
  } catch {status.textContent = "The analytics relay could not be reached. Please reload the extension and try again.";}
  finally {check.disabled = false;}
});
try {
  update((await chrome.storage.local.get(key))[key]);
  checkbox.disabled = false;
  checkbox.addEventListener("change", async () => {
    try {await chrome.storage.local.set({[key]: checkbox.checked}); update(checkbox.checked);}
    catch {checkbox.checked = !checkbox.checked; status.textContent = "Could not save your preference. Please try again.";}
  });
  chrome.storage.onChanged.addListener((changes, area) => {if (area === "local" && changes[key]) update(changes[key].newValue);});
  trackUsage("settings_opened");
} catch {status.textContent = "Could not load your analytics preference.";}
