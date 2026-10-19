import {storage} from "./theme.js";

export const POPUP_LAYOUT_KEY = "bm_popup_layout";
export const POPUP_LAYOUTS = ["classic", "city-console"];
export const normalizePopupLayout = value => POPUP_LAYOUTS.includes(value) ? value : "classic";

export async function getPopupLayout() {
  return normalizePopupLayout(await storage.get(POPUP_LAYOUT_KEY, "classic"));
}

export async function setPopupLayout(value) {
  if (!POPUP_LAYOUTS.includes(value)) throw new Error("Choose an available popup design.");
  await storage.set(POPUP_LAYOUT_KEY, value);
}

export async function watchPopupLayout(apply) {
  // Subscribe before reading so an update cannot be lost during startup.
  let revision = 0;
  storage.onChange(changes => {
    if (!(POPUP_LAYOUT_KEY in changes)) return;
    revision++;
    apply(normalizePopupLayout(changes[POPUP_LAYOUT_KEY].newValue));
  });
  const initial = await getPopupLayout();
  if (!revision) apply(initial);
}
