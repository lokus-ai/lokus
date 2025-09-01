import { useEffect, useState } from "react";
import { setGlobalActiveTheme, listAvailableThemes, readGlobalVisuals } from "../core/theme/manager.js";

export default function Preferences() {
  const [themes, setThemes] = useState([]);
  const [activeTheme, setActiveTheme] = useState("");

  useEffect(() => {
    async function loadData() {
      const available = await listAvailableThemes();
      setThemes(available);
      const visuals = await readGlobalVisuals();
      setActiveTheme(visuals.theme || "");
    }
    loadData().catch(console.error);
  }, []);

  const handleThemeChange = (e) => {
    const themeId = e.target.value;
    setActiveTheme(themeId);
    // This is the central function that now handles applying or reverting to built-in.
    setGlobalActiveTheme(themeId).catch(console.error);
  };

  return (
    <div className="h-screen bg-app-bg text-app-text flex flex-col">
      <header className="h-12 px-4 flex items-center border-b border-app-border">
        <div className="font-medium">Preferences</div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <section>
          <h2 className="text-sm uppercase tracking-wide text-app-muted mb-3">Theme</h2>
          <select
            className="h-9 px-3 w-full rounded-md bg-app-panel border border-app-border outline-none"
            value={activeTheme}
            onChange={handleThemeChange}
          >
            <option value="">Built-in</option>
            {themes.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-app-muted mt-2">
            Add more themes to <code>~/Library/Application Support/Lokus/themes/</code>
          </p>
        </section>
      </div>
    </div>
  );
}