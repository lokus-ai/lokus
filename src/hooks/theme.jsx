import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  applyTokens,
  applyInitialTheme,
  readGlobalVisuals,
  setGlobalActiveTheme,
} from "../core/theme/manager.js";
import { useThemeOverrides } from "../contexts/RemoteConfigContext";
import analytics from "../services/analytics.js";

// Apply server-side theme overrides as CSS variables
const applyThemeOverrides = (overrides) => {
  if (!overrides) return;

  const tokenMap = {
    accent: '--accent',
    accent_fg: '--accent-fg',
    bg: '--bg',
    panel: '--panel',
    border: '--border',
    text: '--text',
    muted: '--muted',
    danger: '--danger',
    success: '--success',
    warning: '--warning',
    info: '--info',
  };

  Object.entries(overrides).forEach(([key, value]) => {
    if (value && tokenMap[key]) {
      document.documentElement.style.setProperty(tokenMap[key], value);
    }
  });
};

const ThemeCtx = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(null);
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);
  const themeOverrides = useThemeOverrides();

  // Apply server-side theme overrides whenever they change
  useEffect(() => {
    if (isThemeLoaded && themeOverrides) {
      applyThemeOverrides(themeOverrides);
    }
  }, [isThemeLoaded, themeOverrides]);

  // Load initial theme from config with better error handling
  useEffect(() => {
    async function loadInitial() {
      try {
        // Apply initial theme immediately to prevent flash of unthemed content
        await applyInitialTheme();

        // Then read the actual configured theme
        const visuals = await readGlobalVisuals();
        if (visuals && visuals.theme) {
          setTheme(visuals.theme);
          // Re-apply theme if it's different from the initial
          await setGlobalActiveTheme(visuals.theme);
        } else {
          // Fallback to a default theme if none is configured
          setTheme('default');
        }

        setIsThemeLoaded(true);
      } catch (error) {
        // Ensure we still mark as loaded to prevent infinite loading
        setIsThemeLoaded(true);
      }
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
      return () => {
        unlistenPromise.then(unlisten => {
          if (typeof unlisten === 'function') unlisten();
        }).catch(() => {});
      };
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
    analytics.trackThemeChange(newTheme);
  }, []);

  const value = {
    theme,
    setTheme: handleSetTheme,
    isThemeLoaded,
  };

  // Optionally show a loading state while theme is being loaded
  // This prevents flash of unthemed content on initial load
  if (!isThemeLoaded) {
    return (
      <ThemeCtx.Provider value={value}>
        <div className="fixed inset-0 bg-app-bg" style={{ visibility: 'hidden' }}>
          {children}
        </div>
      </ThemeCtx.Provider>
    );
  }

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeCtx);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}