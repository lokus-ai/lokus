import { useEffect, useState } from "react";

// Determines whether the current window should render Preferences (dedicated window)
// and ignores global "preferences:open" events to avoid hijacking other windows.
export function usePreferenceActivation() {
  const [isPrefsWindow, setIsPrefsWindow] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'prefs') {
        setIsPrefsWindow(true);
      }
    } catch {}
  }, []);

  return { isPrefsWindow };
}
