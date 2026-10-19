import {getPopupLayout, setPopupLayout, watchPopupLayout} from "../shared/popup-layout.js";

const fieldset = document.getElementById("popup-design-choices");
const status = document.getElementById("popup-design-status");
let saved = "classic";
function select(layout) {
  saved = layout;
  for (const radio of fieldset.querySelectorAll("input")) radio.checked = radio.value === layout;
}
try {
  await watchPopupLayout(select);
  fieldset.disabled = false;
} catch (error) { status.textContent = error.message; }

fieldset.addEventListener("change", async event => {
  if (!event.target.matches('input[name="popup-design"]')) return;
  const next = event.target.value;
  fieldset.disabled = true;
  try {
    await setPopupLayout(next);
    select(await getPopupLayout());
    status.textContent = next === "classic" ? "Classic design restored." : "City Console applied. Open popups update immediately.";
  } catch (error) {
    select(saved);
    status.textContent = error.message;
  } finally {
    fieldset.disabled = false;
    if (document.activeElement === document.body) event.target.focus({preventScroll: true});
  }
});
