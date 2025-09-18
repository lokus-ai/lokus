import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  applyTokens,
  applyInitialTheme,
  readGlobalVisuals,
  setGlobalActiveTheme,
} from "../core/theme/manager.js";

const ThemeCtx = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(null);

  // Load initial theme from config
  useEffect(() => {
    async function loadInitial() {
      const visuals = await readGlobalVisuals();
      setTheme(visuals.theme);
      await applyInitialTheme();
    }
    loadInitial();
  }, []);

  // Listen for theme changes from other windows
  useEffect(() => {
    let isTauri = false; try {
      const w = window;
      isTauri = !!(
        (w.__TAURI_INTERNALS__ && typeof w.__TAURI_INTERNALS__.invoke === 'function') ||
        w.__TAURI_METADATA__ ||
        (navigator?.userAgent || '').includes('Tauri')
      );
    } catch {}
    if (isTauri) {
      const unlistenPromise = listen("theme:apply", (e) => {
        const p = (e.payload || {});
        if (p.tokens) applyTokens(p.tokens);
        if (p.visuals && p.visuals.theme !== undefined) {
          setTheme(p.visuals.theme);
        }
      });
      return () => { unlistenPromise.then(unlisten => unlisten()); };
    } else {
      const onDom = (e) => {
        const p = (e.detail || {});
        if (p.tokens) applyTokens(p.tokens);
        if (p.visuals && p.visuals.theme !== undefined) {
          setTheme(p.visuals.theme);
        }
      };
      window.addEventListener('theme:apply', onDom);
      return () => window.removeEventListener('theme:apply', onDom);
    }
  }, []);

  // Theme application is now handled entirely by theme files

  const handleSetTheme = useCallback(async (newTheme) => {
    setTheme(newTheme);
    await setGlobalActiveTheme(newTheme);
  }, []);

  const value = {
    theme,
    setTheme: handleSetTheme,
  };

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeCtx);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}