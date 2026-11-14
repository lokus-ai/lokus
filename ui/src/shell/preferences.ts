/** @part-of ui.shell */
import { describe, track } from "../bridge/analytics";
import { createStore } from "./store";

/** Choices that belong to this device, not to a vault. */
export interface Preferences {
  theme: "system" | "light" | "dark";
  /** The typeface notes are written in; "custom" uses `customFont`. */
  editorFont: "sans" | "serif" | "mono" | "custom";
  /** The name of any font installed on this computer. */
  customFont: string;
  /** Note text size in pixels. */
  fontSize: number;
  /** Space between lines, as a multiple of the text size. */
  lineHeight: number;
  /** How wide the column of text is. */
  pageWidth: "narrow" | "regular" | "wide" | "full";
  /** How much room rows, cards and lists take. */
  density: "roomy" | "regular" | "compact";
  /** How much is shown about each thing: only what matters, or all there is. */
  detail: "essentials" | "balanced" | "everything";
  /** What is on screen when Lokus opens: only the page, the page and sidebar, or the assistant too. */
  layout: "focused" | "standard" | "everything";
}

const KEY = "lokus.preferences";
const DEFAULTS: Preferences = { theme: "system", editorFont: "sans", customFont: "", fontSize: 16, lineHeight: 1.6, pageWidth: "regular", density: "regular", detail: "balanced", layout: "standard" };
const FONTS = { sans: "var(--font-ui)", serif: "var(--font-serif)", mono: "var(--font-mono)" };
const WIDTHS = { narrow: "600px", regular: "720px", wide: "920px", full: "100vw" };

function read(): Preferences {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Preferences>) };
  } catch {
    return DEFAULTS;
  }
}

export const preferences = createStore<Preferences>(read());

/** The CSS font stack for the chosen note typeface. */
export function noteFont(p: Preferences): string {
  if (p.editorFont !== "custom") return FONTS[p.editorFont];
  const name = p.customFont.trim().replace(/["\\]/g, "");
  return name ? `"${name}", var(--font-ui)` : FONTS.sans;
}

function apply(): void {
  const p = preferences.get();
  const root = document.documentElement;
  if (p.theme === "system") delete root.dataset.theme;
  else root.dataset.theme = p.theme;
  root.dataset.density = p.density;
  root.dataset.detail = p.detail;
  root.style.setProperty("--font-editor", noteFont(p));
  root.style.setProperty("--text-note", `${p.fontSize}px`);
  root.style.setProperty("--line-note", String(p.lineHeight));
  root.style.setProperty("--column-width", WIDTHS[p.pageWidth]);
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  preferences.set({ [key]: value } as Partial<Preferences>);
  localStorage.setItem(KEY, JSON.stringify(preferences.get()));
  apply();
  if (key !== "customFont") {
    track("preference_changed", { key, value: String(value) });
    describe({ [key]: String(value) });
  }
}

apply();

// A change made in another window (the theme, the note font) arrives here as a storage event.
window.addEventListener("storage", (e) => {
  if (e.key !== KEY) return;
  preferences.set(read());
  apply();
});
