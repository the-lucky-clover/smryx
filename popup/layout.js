import {watchPopupLayout} from "../shared/popup-layout.js";

const actions = document.querySelector(".header-actions");
const originalParent = actions.parentElement;
const container = document.querySelector(".popup-container");
let dock;

function applyLayout(layout) {
  document.documentElement.dataset.bmLayout = layout;
  const focused = actions.contains(document.activeElement) ? document.activeElement : null;
  if (layout === "city-console" && !dock) {
    dock = document.createElement("footer");
    dock.className = "city-control-dock";
    dock.setAttribute("aria-label", "Popup controls");
    container.append(dock);
    dock.append(actions);
  } else if (layout === "classic" && dock) {
    originalParent.append(actions);
    dock.remove();
    dock = null;
  }
  focused?.focus({preventScroll: true});
  // A popover opened above the console dock should not remain open when its
  // control moves back to the original header (or vice versa).
  document.getElementById("text-size-popover")?.classList.add("hidden");
  document.getElementById("text-size-btn")?.setAttribute("aria-expanded", "false");
}

watchPopupLayout(applyLayout).catch(error => {
  applyLayout("classic");
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.id = "popup-layout-status";
  status.textContent = error.message;
  document.querySelector(".popup-header").append(status);
});
