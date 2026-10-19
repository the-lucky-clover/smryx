// Theme Studio: custom color theming for the options page.
// Renders into #bm-theme-studio, a container that lives outside of #app so it
// never conflicts with the bundled settings React app.
import {
  bindAction,
  applyColorMode,
  watchColorMode,
  applyStoredActiveTheme,
  importTheme,
  STORAGE_KEYS,
  storage,
  VAR_MAP,
  VAR_LABELS,
  SEASONAL_THEMES,
  getCustomThemes,
  saveCustomTheme,
  deleteCustomTheme,
  findAnyTheme,
  generateThemeId,
  applyThemeVars,
  setActiveTheme,
  encodeShareCode,
  decodeShareCode,
  isValidThemeVars,
} from "../shared/theme.js";

const on = (element, type, action) => bindAction(element, type, action, toast);

const root = document.getElementById("bm-theme-studio");
if (root) {
  root.innerHTML = `
    <div class="ts-header">
      <div>
        <div class="ts-title">🎨 Theme Studio</div>
      </div>
      <button id="ts-new-btn" class="ts-new-btn" type="button">✨ New custom theme</button>
    </div>
    <p class="ts-subtitle">
      Pick a season, remix it, or paint your own palette from scratch. Themes sync straight to
      the popup — save, edit, export, import, and share your favorites with friends.
    </p>

    <label class="ts-mode-label" for="ts-mode">Appearance
      <select id="ts-mode"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select>
    </label>
    <p class="ts-subtitle">Appearance controls the default theme. Custom palettes keep their chosen colors.</p>
    <div id="ts-grid" class="ts-grid"></div>

    <div id="ts-editor" class="ts-editor hidden"></div>

    <div class="ts-io">
      <div class="ts-io-title">Import / Export / Share</div>
      <div class="ts-io-row">
        <button id="ts-export-btn" class="ts-btn" type="button">⬇️ Export selected theme</button>
        <button id="ts-import-file-btn" class="ts-btn" type="button">⬆️ Import from file</button>
        <input id="ts-import-file-input" type="file" accept="application/json" hidden />
        <button id="ts-share-btn" class="ts-btn" type="button">🔗 Copy share code</button>
      </div>
      <div class="ts-io-row">
        <input id="ts-share-input" type="text" placeholder="Paste a shared theme code (BM1:...) here" />
        <button id="ts-share-import-btn" class="ts-btn primary" type="button">Import code</button>
      </div>
    </div>

    <div id="ts-toast" class="ts-toast" role="status" aria-live="polite"></div>
  `;

  init().catch(error => toast(error.message));
}

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

async function init() {
  await watchColorMode();
  await applyStoredActiveTheme();
  await renderGrid();
  wireStaticControls();
}

function toast(message) {
  const el = document.getElementById("ts-toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("visible"), 2200);
}

function swatchesHtml(vars) {
  const order = ["bgPrimary", "bgSecondary", "accentPrimary", "accentHover", "textPrimary"];
  return order.map((key) => `<span style="background:${vars[key] ?? "#ccc"}"></span>`).join("");
}

async function renderGrid() {
  const grid = document.getElementById("ts-grid");
  if (!grid) return;
  const customThemes = await getCustomThemes();
  const activeId = await storage.get(STORAGE_KEYS.activeThemeId, "system");
  const allThemes = [
    { id: "system", name: "Default", emoji: "🌗", season: "System", tagline: "Follows your light/dark preference.", builtIn: true, vars: null },
    ...SEASONAL_THEMES,
    ...customThemes,
  ];

  grid.innerHTML = allThemes
    .map((theme) => {
      const isActive = theme.id === activeId;
      const isCustom = !theme.builtIn;
      return `
        <div class="ts-card${isActive ? " is-active" : ""}" data-theme-id="${escapeHtml(theme.id)}">
          ${theme.vars ? `<div class="ts-card-swatches">${swatchesHtml(theme.vars)}</div>` : `<div class="ts-card-swatches" style="background:var(--ts-panel-2)"></div>`}
          <div class="ts-card-season">${escapeHtml(theme.season ?? (isCustom ? "Custom" : ""))}</div>
          <div class="ts-card-name">${escapeHtml(theme.emoji ?? "🎨")} ${escapeHtml(theme.name)}</div>
          <div class="ts-card-tagline">${escapeHtml(theme.tagline ?? "Your own hand-mixed palette.")}</div>
          <div class="ts-card-actions">
            <button class="ts-btn primary" data-action="apply" data-theme-id="${escapeHtml(theme.id)}">${isActive ? "Active" : "Apply"}</button>
            ${isCustom ? `<button class="ts-btn" data-action="edit" data-theme-id="${escapeHtml(theme.id)}">Edit</button>` : ""}
            ${isCustom ? `<button class="ts-btn danger" data-action="delete" data-theme-id="${escapeHtml(theme.id)}">Delete</button>` : ""}
          </div>
        </div>`;
    })
    .join("");

  grid.querySelectorAll("button[data-action]").forEach((btn) => {
    on(btn, "click", async () => {
      const id = btn.getAttribute("data-theme-id");
      const action = btn.getAttribute("data-action");
      if (action === "apply") {
        const theme = id === "system" ? null : await findAnyTheme(id);
        await setActiveTheme(theme);
        toast(theme ? `${theme.emoji ?? ""} ${theme.name} applied` : "Back to default 🌗");
        await renderGrid();
      } else if (action === "edit") {
        const theme = await findAnyTheme(id);
        if (theme) openEditor(theme);
      } else if (action === "delete") {
        await deleteCustomTheme(id);
        const activeId2 = await storage.get(STORAGE_KEYS.activeThemeId, "system");
        if (activeId2 === id) await setActiveTheme(null);
        toast("Theme deleted");
        await renderGrid();
      }
    });
  });
}

function defaultDraftVars() {
  const base = SEASONAL_THEMES[0].vars;
  return { ...base };
}

function openEditor(theme) {
  applyStoredActiveTheme().catch(error => toast(error.message));
  const draft = {
    id: theme?.id ?? generateThemeId(),
    name: theme?.name ?? "",
    emoji: theme?.emoji ?? "🎨",
    vars: theme?.vars ? { ...theme.vars } : defaultDraftVars(),
  };

  const editor = document.getElementById("ts-editor");
  if (!editor) return;
  editor.classList.remove("hidden");
  editor.innerHTML = `
    <div class="ts-editor-row">
      <label class="ts-field">
        Theme name
        <input id="ts-name-input" type="text" placeholder="e.g. Midnight Bubblegum" value="${escapeHtml(draft.name)}" />
      </label>
      <label class="ts-field">
        Emoji
        <input id="ts-emoji-input" type="text" maxlength="16" value="${escapeHtml(draft.emoji)}" />
      </label>
    </div>
    <div class="ts-color-grid">
      ${Object.keys(VAR_MAP)
        .map(
          (key) => `
        <label class="ts-color-field">
          <input type="color" data-var-key="${key}" value="${draft.vars[key]}" />
          <span>${VAR_LABELS[key]}</span>
        </label>`
        )
        .join("")}
    </div>
    <div class="ts-editor-actions">
      <button id="ts-save-btn" class="ts-btn primary" type="button">💾 Save theme</button>
      <button id="ts-preview-btn" class="ts-btn" type="button">👁️ Preview live</button>
      <button id="ts-cancel-btn" class="ts-btn" type="button">Cancel</button>
    </div>
  `;

  editor.querySelectorAll("input[data-var-key]").forEach((input) => {
    on(input, "input", () => {
      draft.vars[input.getAttribute("data-var-key")] = input.value;
    });
  });

  on(document.getElementById("ts-preview-btn"), "click", () => {
    applyThemeVars(draft.vars);
    toast("Previewing — remember to Save or Apply another theme");
  });

  on(document.getElementById("ts-cancel-btn"), "click", async () => {
    editor.classList.add("hidden");
    await applyStoredActiveTheme();
  });

  on(document.getElementById("ts-save-btn"), "click", async () => {
    draft.name = document.getElementById("ts-name-input")?.value.trim() || "My Theme";
    draft.emoji = document.getElementById("ts-emoji-input")?.value.trim() || "🎨";
    if (!isValidThemeVars(draft.vars)) {
      toast("Please set all colors before saving");
      return;
    }
    await saveCustomTheme(draft);
    editor.classList.add("hidden");
    await applyStoredActiveTheme();
    toast(`${draft.emoji} ${draft.name} saved`);
    await renderGrid();
  });
}

function wireStaticControls() {
  on(document.getElementById("ts-mode"), "change", async event => {
    try {
      await storage.set(STORAGE_KEYS.theme, event.target.value);
      applyColorMode(event.target.value);
    } catch (error) {
      applyColorMode(await storage.get(STORAGE_KEYS.theme, "system"));
      throw error;
    }
  });
  storage.onChange(changes => {
    if (STORAGE_KEYS.activeThemeVars in changes || STORAGE_KEYS.activeThemeId in changes) applyStoredActiveTheme().catch(error => toast(error.message));
    if (STORAGE_KEYS.customThemes in changes || STORAGE_KEYS.activeThemeId in changes) renderGrid().catch(error => toast(error.message));
  });
  on(document.getElementById("ts-new-btn"), "click", () => openEditor(null));

  on(document.getElementById("ts-export-btn"), "click", async () => {
    const activeId = await storage.get(STORAGE_KEYS.activeThemeId, "system");
    const theme = activeId === "system" ? null : await findAnyTheme(activeId);
    if (!theme) {
      toast("Apply a theme first, then export it");
      return;
    }
    const blob = new Blob([JSON.stringify(theme, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${theme.name.toLowerCase().replace(/\s+/g, "-")}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  on(document.getElementById("ts-import-file-btn"), "click", () => {
    document.getElementById("ts-import-file-input")?.click();
  });

  on(document.getElementById("ts-import-file-input"), "change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 100000) { toast("Theme files must be smaller than 100 KB"); event.target.value = ""; return; }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!isValidThemeVars(parsed.vars)) throw new Error("Missing color values");
      await saveCustomTheme(importTheme(parsed));
      toast("Theme imported");
      await renderGrid();
    } catch (error) {
      toast(error.message.includes("storage") ? error.message : "That file doesn't look like a valid theme");
    } finally {
      event.target.value = "";
    }
  });

  on(document.getElementById("ts-share-btn"), "click", async () => {
    const activeId = await storage.get(STORAGE_KEYS.activeThemeId, "system");
    const theme = activeId === "system" ? null : await findAnyTheme(activeId);
    if (!theme) {
      toast("Apply a theme first, then share it");
      return;
    }
    const code = encodeShareCode(theme);
    try {
      await navigator.clipboard.writeText(code);
      toast("Share code copied to clipboard 🔗");
    } catch {
      const input = document.getElementById("ts-share-input");
      if (input) input.value = code;
      toast("Copy the code from the box below");
    }
  });

  on(document.getElementById("ts-share-import-btn"), "click", async () => {
    const input = document.getElementById("ts-share-input");
    const code = input?.value.trim();
    if (!code) return;
    try {
      const parsed = decodeShareCode(code);
      if (!isValidThemeVars(parsed.vars)) throw new Error("Missing color values");
      await saveCustomTheme(importTheme(parsed));
      if (input) input.value = "";
      toast("Shared theme imported");
      await renderGrid();
    } catch (error) {
      toast(error.message.includes("storage") ? error.message : "That share code couldn't be read");
    }
  });
}
