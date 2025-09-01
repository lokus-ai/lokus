import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  applyTokens,
  readGlobalVisuals,
  setGlobalActiveTheme, // Use the master function
} from "../core/theme/manager.js";

const ThemeCtx = createContext(null);

export function ThemeProvider({ children }) {
  // This provider now only needs to worry about listening for changes.
  // The manager handles all the logic.

  useEffect(() => {
    // Listen for theme changes broadcast from any window and apply them.
    const sub = listen("theme:apply", (e) => {
      const p = (e.payload || {});
      if (p.tokens) {
        applyTokens(p.tokens);
      }
    });
    return () => { sub.then((un) => un()); };
  }, []);

  // The context value doesn't need to expose much anymore.
  // Components should use the specific manager functions.
  const value = useMemo(() => ({
    // You could add mode/accent logic back here if needed,
    // but for themes, the manager is the source of truth.
  }), []);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
