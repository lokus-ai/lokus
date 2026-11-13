/** @part-of ui.shell */
import { createStore } from "./store";

/** Choices that belong to this device, not to a vault. */
export interface Preferences {
  theme: "system" | "light" | "dark";
  editorFont: "sans" | "serif" | "mono";
}

const KEY = "lokus.preferences";
const FONTS = { sans: "var(--font-ui)", serif: "var(--font-serif)", mono: "var(--font-mono)" };

function read(): Preferences {
  try {
    return { theme: "system", editorFont: "sans", ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Preferences>) };
  } catch {
    return { theme: "system", editorFont: "sans" };
  }
}

export const preferences = createStore<Preferences>(read());

function apply(): void {
  const { theme, editorFont } = preferences.get();
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  root.style.setProperty("--font-editor", FONTS[editorFont]);
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  preferences.set({ [key]: value } as Partial<Preferences>);
  localStorage.setItem(KEY, JSON.stringify(preferences.get()));
  apply();
}

apply();
