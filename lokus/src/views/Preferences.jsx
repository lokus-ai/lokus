import { useEffect, useState } from "react";
import { setGlobalActiveTheme, listAvailableThemes, readGlobalVisuals } from "../core/theme/manager.js";
import { useTheme } from "../hooks/theme.jsx";
import AccentPicker from "../components/AccentPicker.jsx";

export default function Preferences() {
  const [themes, setThemes] = useState([]);
  const [activeTheme, setActiveTheme] = useState("");
  const [section, setSection] = useState("Appearance");
  const { mode, setMode } = useTheme();

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
    setGlobalActiveTheme(themeId).catch(console.error);
  };

  return (
    <div className="h-screen bg-app-bg text-app-text flex flex-col">
      <header className="h-12 px-4 flex items-center border-b border-app-border bg-app-panel">
        <div className="font-medium">Preferences</div>
      </header>

      <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: "220px 1px 1fr" }}>
        {/* Sidebar */}
        <aside className="bg-app-panel/50 p-3">
          {[
            "General",
            "Appearance",
            "Shortcuts",
          ].map((name) => (
            <button
              key={name}
              onClick={() => setSection(name)}
              className={`w-full text-left px-3 py-2 rounded-md mb-1 transition-colors ${
                section === name ? "bg-app-accent text-app-accent-fg" : "text-app-text hover:bg-app-bg"
              }`}
            >
              {name}
            </button>
          ))}
        </aside>
        <div className="bg-app-border/20 w-px" />

        {/* Content */}
        <main className="p-6 overflow-auto">
          {section === "Appearance" && (
            <div className="space-y-8 max-w-xl">
              <section>
                <h2 className="text-sm uppercase tracking-wide text-app-muted mb-3">Mode</h2>
                <div className="inline-flex rounded-md border border-app-border overflow-hidden">
                  {["system","light","dark"].map(m => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`px-3 py-1 text-sm ${mode===m?"bg-app-accent text-app-accent-fg":"bg-app-panel hover:bg-app-bg"}`}
                    >
                      {m[0].toUpperCase()+m.slice(1)}
                    </button>
                  ))}
                </div>
              </section>

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

              <section>
                <h2 className="text-sm uppercase tracking-wide text-app-muted mb-3">Accent</h2>
                <AccentPicker />
              </section>
            </div>
          )}

          {section === "General" && (
            <div className="text-app-muted">General settings coming soon.</div>
          )}

          {section === "Shortcuts" && (
            <div className="text-app-muted">Shortcut customization coming soon.</div>
          )}
        </main>
      </div>
    </div>
  );
}
