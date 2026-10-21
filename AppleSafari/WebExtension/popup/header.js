// Controls for the static popup header (theme toggle + text-size popover).
// Deliberately isolated from index.js so it never depends on / interferes with
// the bundled app that mounts into #app.
import { STORAGE_KEYS, storage, applyStoredActiveTheme, applyColorMode, watchColorMode, bindAction } from "../shared/theme.js";
import {trackUsage} from "../shared/analytics-client.js";
trackUsage("popup_opened");


function showError(message) {
  let status = document.getElementById("bm-header-status");
  if (!status) {
    status = document.createElement("p");
    status.id = "bm-header-status";
    status.setAttribute("role", "status");
    document.querySelector(".popup-header")?.append(status);
  }
  status.textContent = message;
}
const on = (element, type, action) => bindAction(element, type, action, showError);

on(document.getElementById("settings-btn"), "click", () => chrome.runtime.openOptionsPage());
on(document.getElementById("close-btn"), "click", () => {
  if (window.parent !== window) window.parent.postMessage({type: "CLOSE_IFRAME", runtimeId: chrome.runtime.id}, "*");
  else window.close();
});

// Screen coordinates stay stable while the parent moves this iframe.
document.querySelector(".popup-header")?.addEventListener("pointerdown", event => {
  if (event.button !== 0 || event.target.closest("button, input, a, .popover") || window.parent === window) return;
  event.preventDefault();
  window.parent.postMessage({type: "POPUP_DRAG_START", screenX: event.screenX, screenY: event.screenY, runtimeId: chrome.runtime.id}, "*");
});

// Remove info/refresh buttons from summary header, keep only copy
const summaryActionsObserver = new MutationObserver(() => {
  document.querySelectorAll(".summary-actions button, .summary-meta button").forEach(btn => {
    const isCopy = btn.classList.contains("primary") ||
                   btn.querySelector(".sr-only")?.textContent?.toLowerCase().includes("copy");
    if (!isCopy) {
      btn.remove();
    }
  });
});
summaryActionsObserver.observe(document.body, {subtree: !0, childList: !0});

function applyFontScale(percent) {
  percent = Number.isFinite(Number(percent)) ? Math.min(130, Math.max(85, Number(percent))) : 100;
  document.documentElement.style.setProperty("--font-scale", String(percent / 100));
  const label = document.getElementById("text-size-value");
  if (label) label.textContent = String(percent);
  const slider = document.getElementById("text-size-slider");
  if (slider && Number(slider.value) !== percent) slider.value = String(percent);
}

async function initTheme() {
  await watchColorMode();

  const toggleBtn = document.getElementById("theme-toggle-btn");
  on(toggleBtn, "click", async () => {
    const current = await storage.get(STORAGE_KEYS.theme, "system");
    const currentlyDark =
      current === "dark" ||
      (current !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const next = currentlyDark ? "light" : "dark";
    // A custom palette pins its surface colors. Switch to the default palette
    // atomically so the mode toggle always produces a visible change.
    await storage.setMany({
      [STORAGE_KEYS.theme]: next,
      [STORAGE_KEYS.activeThemeId]: "system",
      [STORAGE_KEYS.activeThemeVars]: null,
    });
    await applyStoredActiveTheme();
    applyColorMode(next);
  });
}

async function initFontSize() {
  const stored = await storage.get(STORAGE_KEYS.fontScale, 100);
  applyFontScale(stored);

  const btn = document.getElementById("text-size-btn");
  const popover = document.getElementById("text-size-popover");
  const slider = document.getElementById("text-size-slider");

  const closePopover = () => {
    popover?.classList.add("hidden");
    btn?.setAttribute("aria-expanded", "false");
  };

  on(btn, "click", (event) => {
    event.stopPropagation();
    const isHidden = popover?.classList.contains("hidden");
    if (isHidden) {
      popover?.classList.remove("hidden");
      btn.setAttribute("aria-expanded", "true");
    } else {
      closePopover();
    }
  });

  document.addEventListener("click", (event) => {
    if (!popover || popover.classList.contains("hidden")) return;
    if (event.target === btn || popover.contains(event.target)) return;
    closePopover();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePopover();
  });

  on(slider, "input", async (event) => {
    const percent = Number(event.target.value);
    applyFontScale(percent);
    await storage.set(STORAGE_KEYS.fontScale, percent);
  });
}

// Keep batch results in their own full-size tab.
document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
    event.preventDefault();
    chrome.runtime.sendMessage({type:"OPEN_BATCH_RESULTS",to:"background"}).catch(error => showError(error.message));
  }
});

Promise.all([initTheme(), initFontSize(), applyStoredActiveTheme()]).catch(error => showError(error.message));
storage.onChange((changes) => {
  if (STORAGE_KEYS.fontScale in changes) applyFontScale(changes[STORAGE_KEYS.fontScale].newValue ?? 100);
  if (STORAGE_KEYS.activeThemeVars in changes || STORAGE_KEYS.activeThemeId in changes) {
    applyStoredActiveTheme().catch(error => showError(error.message));
  }
});
