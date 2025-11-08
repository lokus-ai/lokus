import { useEffect, useState } from "react";

// Determines whether the current window should render DevTools/SystemMonitor (dedicated window)
// Checks for ?view=devtools URL parameter
export function useDevtoolsActivation() {
  const [isDevtoolsWindow, setIsDevtoolsWindow] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'devtools') {
        setIsDevtoolsWindow(true);
      }
    } catch {}
  }, []);

  return { isDevtoolsWindow };
}
