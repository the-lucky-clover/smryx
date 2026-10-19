// Shared theme engine used by both the popup header controls and the
// options page "Theme Studio". Keeping this in one place means a theme
// saved/applied in Settings shows up in the popup and vice versa.

export const STORAGE_KEYS = {
  theme: "bm_theme", // "light" | "dark" | "system" (base light/dark mode)
  fontScale: "bm_font_scale",
  activeThemeId: "bm_active_theme_id", // "system" | preset id | custom theme id
  activeThemeVars: "bm_active_theme_vars", // resolved vars for the active preset/custom theme
  customThemes: "bm_custom_themes", // array of user-saved themes
};

// camelCase key -> CSS custom property name
export const VAR_MAP = {
  bgPrimary: "--bg-primary",
  bgSecondary: "--bg-secondary",
  bgTertiary: "--bg-tertiary",
  textPrimary: "--text-primary",
  textSecondary: "--text-secondary",
  textMuted: "--text-muted",
  accentPrimary: "--accent-primary",
  accentHover: "--accent-hover",
  accentLight: "--accent-light",
  borderColor: "--border-color",
};

export const VAR_LABELS = {
  bgPrimary: "Background",
  bgSecondary: "Panel background",
  bgTertiary: "Recessed background",
  textPrimary: "Primary text",
  textSecondary: "Secondary text",
  textMuted: "Muted text",
  accentPrimary: "Accent",
  accentHover: "Accent (hover)",
  accentLight: "Accent (light wash)",
  borderColor: "Border",
};

// Four seasons, wrought with love: soothing yet seductive palettes.
export const SEASONAL_THEMES = [
  {
    id: "season-spring-bloom-bestie",
    name: "Bloom Bestie",
    emoji: "🌸",
    season: "Spring",
    tagline: "Petal-soft pinks & mint, blooming with main-character energy.",
    builtIn: true,
    vars: {
      bgPrimary: "#fff6fb",
      bgSecondary: "#fdeef7",
      bgTertiary: "#f7e0f0",
      textPrimary: "#3a1f33",
      textSecondary: "#7a4d6e",
      textMuted: "#a781a0",
      accentPrimary: "#ff6fae",
      accentHover: "#ff4f97",
      accentLight: "#ffe0ef",
      borderColor: "#f3d4ea",
    },
  },
  {
    id: "season-summer-disco-tangerine",
    name: "Disco Tangerine",
    emoji: "🍹",
    season: "Summer",
    tagline: "Sun-drenched coral & citrus, dancing on the last day of June.",
    builtIn: true,
    vars: {
      bgPrimary: "#fffaf3",
      bgSecondary: "#fff1de",
      bgTertiary: "#ffe6c2",
      textPrimary: "#2b2320",
      textSecondary: "#6b5b46",
      textMuted: "#92806a",
      accentPrimary: "#ff5e5b",
      accentHover: "#ff3d3a",
      accentLight: "#ffe1cf",
      borderColor: "#ffd9a8",
    },
  },
  {
    id: "season-autumn-pumpkin-spice-icon",
    name: "Pumpkin Spice Icon",
    emoji: "🍂",
    season: "Autumn",
    tagline: "Amber, rust & burgundy — cozy, confident, unbothered.",
    builtIn: true,
    vars: {
      bgPrimary: "#fbf3ec",
      bgSecondary: "#f3e3d4",
      bgTertiary: "#ecd3b8",
      textPrimary: "#3c2415",
      textSecondary: "#6e4a30",
      textMuted: "#93704f",
      accentPrimary: "#c2542b",
      accentHover: "#a8431f",
      accentLight: "#f4d9c3",
      borderColor: "#e3c19e",
    },
  },
  {
    id: "season-winter-frost-queen",
    name: "Frost Queen",
    emoji: "❄️",
    season: "Winter",
    tagline: "Icy blues with a hot-magenta wink. Cool exterior, warm heart.",
    builtIn: true,
    vars: {
      bgPrimary: "#f3f8ff",
      bgSecondary: "#e7f1fc",
      bgTertiary: "#d8e9f8",
      textPrimary: "#101826",
      textSecondary: "#3f5771",
      textMuted: "#6b859c",
      accentPrimary: "#6d6ee8",
      accentHover: "#ff4fd8",
      accentLight: "#e4e6ff",
      borderColor: "#cfe0f2",
    },
  },
];

export const storage = {
  async get(key, fallback) {
    try {
      if (typeof chrome !== "undefined" && chrome?.storage?.local) {
        const result = await chrome.storage.local.get(key);
        return key in result ? result[key] : fallback;
      }
    } catch (error) {
      throw new Error("Could not access theme storage. Please retry.", { cause: error });
    }
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  async set(key, value) {
    return this.setMany({ [key]: value });
  },
  async setMany(values) {
    try {
      if (typeof chrome !== "undefined" && chrome?.storage?.local) {
        await chrome.storage.local.set(values);
        return;
      }
    } catch (error) {
      throw new Error("Could not access theme storage. Please retry.", { cause: error });
    }
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, JSON.stringify(value));
  },
  onChange(callback) {
    try {
      chrome?.storage?.onChanged?.addListener((changes, area) => {
        if (area === "local") callback(changes);
      });
    } catch {
      /* no-op when extension storage APIs are unavailable */
    }
  },
};

export function findPresetTheme(id) {
  return SEASONAL_THEMES.find((theme) => theme.id === id) ?? null;
}

export async function getCustomThemes() {
  const themes = await storage.get(STORAGE_KEYS.customThemes, []);
  return Array.isArray(themes) ? themes.filter(theme => theme && typeof theme.id === "string" && typeof theme.name === "string" && isValidThemeVars(theme.vars)) : [];
}

export async function saveCustomTheme(theme) {
  if (!theme || !isValidThemeVars(theme.vars) || typeof theme.name !== "string" || !theme.name.trim()) throw new Error("Enter a theme name and valid colors.");
  if (typeof theme.id !== "string" || !theme.id.startsWith("custom-")) throw new Error("Invalid custom theme ID.");
  theme = { id: theme.id, name: theme.name.trim().slice(0, 120), emoji: typeof theme.emoji === "string" ? theme.emoji.slice(0, 16) : "🎨", vars: Object.fromEntries(Object.keys(VAR_MAP).map(key => [key, theme.vars[key]])) };
  const themes = await getCustomThemes();
  const index = themes.findIndex((item) => item.id === theme.id);
  const now = Date.now();
  const next = index === -1
    ? [...themes, { ...theme, createdAt: now, updatedAt: now }]
    : themes.map((item, idx) => (idx === index ? { ...theme, createdAt: item.createdAt, updatedAt: now } : item));
  const active = await storage.get(STORAGE_KEYS.activeThemeId, "system");
  await storage.setMany({ [STORAGE_KEYS.customThemes]: next, ...(active === theme.id ? { [STORAGE_KEYS.activeThemeVars]: theme.vars } : {}) });
  if (active === theme.id) applyThemeVars(theme.vars);
  return next;
}

export async function deleteCustomTheme(id) {
  const themes = await getCustomThemes();
  const next = themes.filter((item) => item.id !== id);
  const active = await storage.get(STORAGE_KEYS.activeThemeId, "system");
  await storage.setMany({ [STORAGE_KEYS.customThemes]: next, ...(active === id ? { [STORAGE_KEYS.activeThemeId]: "system", [STORAGE_KEYS.activeThemeVars]: null } : {}) });
  if (active === id) applyThemeVars(null);
  return next;
}

export async function findAnyTheme(id) {
  return findPresetTheme(id) ?? (await getCustomThemes()).find((item) => item.id === id) ?? null;
}

export function generateThemeId() {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Applies (or clears, when vars is null) a theme's CSS custom properties to the document root. */
export function applyThemeVars(vars) {
  const root = document.documentElement;
  if (vars && !isValidThemeVars(vars)) vars = null;
  root.toggleAttribute("data-bm-palette", Boolean(vars));
  for (const [key, cssVar] of Object.entries(VAR_MAP)) {
    if (vars && vars[key]) {
      root.style.setProperty(cssVar, vars[key]);
    } else {
      root.style.removeProperty(cssVar);
    }
  }
}

/** Applies whichever theme is currently marked active in storage; call on every page load. */
export async function applyStoredActiveTheme() {
  const activeId = await storage.get(STORAGE_KEYS.activeThemeId, "system");
  if (activeId === "system") {
    applyThemeVars(null);
    return;
  }
  const vars = await storage.get(STORAGE_KEYS.activeThemeVars, null);
  applyThemeVars(vars);
}

export async function setActiveTheme(themeOrNull) {
  if (!themeOrNull) {
    await storage.setMany({ [STORAGE_KEYS.activeThemeId]: "system", [STORAGE_KEYS.activeThemeVars]: null });
    applyThemeVars(null);
    return;
  }
  if (!isValidThemeVars(themeOrNull.vars)) throw new Error("Invalid theme colors.");
  await storage.setMany({ [STORAGE_KEYS.activeThemeId]: themeOrNull.id, [STORAGE_KEYS.activeThemeVars]: themeOrNull.vars });
  applyThemeVars(themeOrNull.vars);
}

export function encodeShareCode(theme) {
  const payload = { name: theme.name, emoji: theme.emoji, vars: theme.vars };
  return `BM1:${btoa(unescape(encodeURIComponent(JSON.stringify(payload))))}`;
}

export function decodeShareCode(code) {
  const trimmed = code.trim();
  const withoutPrefix = trimmed.startsWith("BM1:") ? trimmed.slice(4) : trimmed;
  const payload = JSON.parse(decodeURIComponent(escape(atob(withoutPrefix))));
  if (!payload || typeof payload !== "object" || !payload.vars) {
    throw new Error("That code doesn't look like a valid theme.");
  }
  return payload;
}

export function isValidThemeVars(vars) {
  if (!vars || typeof vars !== "object") return false;
  return Object.keys(VAR_MAP).every((key) => typeof vars[key] === "string" && /^#[0-9a-f]{6}$/i.test(vars[key]));
}

export function importTheme(payload) {
  if (!payload || typeof payload.name !== "string" || !payload.name.trim() || !isValidThemeVars(payload.vars)) throw new Error("Use a theme with a name and all ten hex colors.");
  return { id: generateThemeId(), name: payload.name, emoji: typeof payload.emoji === "string" ? payload.emoji : "🎨", vars: payload.vars };
}

/** Keep the mode attribute, bundled Tailwind styles, and native controls in agreement. */
export function applyColorMode(preference) {
  const mode = ["light", "dark", "system"].includes(preference) ? preference : "system";
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.bmTheme = dark ? "dark" : "light";
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  document.getElementById("theme-toggle-btn")?.setAttribute("aria-pressed", String(dark));
  const selector = document.getElementById("ts-mode");
  if (selector) selector.value = mode;
}

export async function watchColorMode() {
  let preference = await storage.get(STORAGE_KEYS.theme, "system");
  applyColorMode(preference);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyColorMode(preference));
  storage.onChange(changes => {
    if (STORAGE_KEYS.theme in changes) {
      preference = changes[STORAGE_KEYS.theme].newValue;
      applyColorMode(preference);
    }
  });
}

/** Report async UI failures and prevent duplicate clicks while a write is pending. */
export function bindAction(element, type, action, onError) {
  element?.addEventListener(type, async event => {
    const button = element.tagName === "BUTTON";
    if (button) element.disabled = true;
    try { await action(event); }
    catch (error) { onError(error instanceof Error ? error.message : "Something went wrong. Please retry."); }
    finally { if (button) element.disabled = false; }
  });
}
