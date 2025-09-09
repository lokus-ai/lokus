import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  applyTokens,
  applyInitialTheme,
  readGlobalVisuals,
  setGlobalActiveTheme,
  setGlobalVisuals,
  broadcastTheme,
} from "../core/theme/manager.js";

const ThemeCtx = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(null);
  const [mode, setMode] = useState("system");
  const [accent, setAccent] = useState("violet");

  // Load initial theme from config
  useEffect(() => {
    async function loadInitial() {
      const visuals = await readGlobalVisuals();
      setTheme(visuals.theme);
      setMode(visuals.mode || "system");
      setAccent(visuals.accent || "violet");
      await applyInitialTheme();
    }
    loadInitial();
  }, []);

  // Listen for theme changes from other windows
  useEffect(() => {
    let isTauri = false; try { isTauri = !!(window.__TAURI_INTERNALS__ || window.__TAURI_METADATA__); } catch {}
    if (isTauri) {
      const unlistenPromise = listen("theme:apply", (e) => {
        const p = (e.payload || {});
        if (p.tokens) applyTokens(p.tokens);
        if (p.visuals) {
          setTheme(p.visuals.theme);
          setMode(p.visuals.mode);
          setAccent(p.visuals.accent);
        }
      });
      return () => { unlistenPromise.then(unlisten => unlisten()); };
    } else {
      const onDom = (e) => {
        const p = (e.detail || {});
        if (p.tokens) applyTokens(p.tokens);
        if (p.visuals) {
          setTheme(p.visuals.theme);
          setMode(p.visuals.mode);
          setAccent(p.visuals.accent);
        }
      };
      window.addEventListener('theme:apply', onDom);
      return () => window.removeEventListener('theme:apply', onDom);
    }
  }, []);

  // Apply the data-theme attribute to the root element
  useEffect(() => {
    console.log("Current mode:", mode);
    if (mode === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", mode);
    }
  }, [mode]);

  const handleSetTheme = useCallback(async (newTheme) => {
    console.log("Setting theme:", newTheme);
    setTheme(newTheme);
    await setGlobalActiveTheme(newTheme);
    const visuals = await readGlobalVisuals();
    await broadcastTheme({ visuals });
  }, []);

  const handleSetMode = useCallback(async (newMode) => {
    setMode(newMode);
    await setGlobalVisuals({ mode: newMode });
  }, []);

  const handleSetAccent = useCallback(async (newAccent) => {
    setAccent(newAccent);
    await setGlobalVisuals({ accent: newAccent });
  }, []);

  const value = {
    theme,
    setTheme: handleSetTheme,
    mode,
    setMode: handleSetMode,
    accent,
    setAccent: handleSetAccent,
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
