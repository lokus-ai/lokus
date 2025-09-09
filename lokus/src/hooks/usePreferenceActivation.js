import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

// Expose both the open state and a setter so callers can close the view.
export function usePreferenceActivation() {
  const [isPrefsOpen, setPrefsOpen] = useState(false);

  useEffect(() => {
    // Also open if URL indicates the preferences view
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'prefs') {
        setPrefsOpen(true);
      }
    } catch {}

    const sub = listen("preferences:open", () => setPrefsOpen(true));
    return () => {
      sub.then((un) => un());
    };
  }, []);

  return { isPrefsOpen, setPrefsOpen };
}
