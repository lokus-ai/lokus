import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

export function usePreferenceActivation() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const sub = listen("preferences:open", () => setOpen(true));
    return () => { sub.then((un) => un()); };
  }, []);
  return open;
}
