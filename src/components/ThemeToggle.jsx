import { useTheme } from "../hooks/theme.jsx";

export default function ThemeToggle() {
  const { mode, setMode, accent, setAccent } = useTheme();

  const nextMode = () => {
    setMode(mode === "light" ? "dark" : mode === "dark" ? "system" : "light");
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={nextMode}
        title={`Theme: ${mode}`}
        className="text-xs px-2 py-1 rounded border border-app-border hover:bg-app-panel transition"
      >
        {mode === "system" ? "System" : mode === "light" ? "Light" : "Dark"}
      </button>

      {/* quick accent swatches */}
      <div className="flex items-center gap-1">
        {["violet","indigo","blue","emerald","amber","pink"].map((key) => (
          <button
            key={key}
            onClick={() => setAccent(key)}
            className={`h-4 w-4 rounded border border-app-border ${accent===key ? "ring-2 ring-app-accent": ""}`}
            style={{ backgroundColor:
              key === "violet" ? "rgb(139 92 246)"
            : key === "indigo" ? "rgb(99 102 241)"
            : key === "blue" ? "rgb(59 130 246)"
            : key === "emerald" ? "rgb(16 185 129)"
            : key === "amber" ? "rgb(245 158 11)"
            : "rgb(236 72 153)" }}
            title={key}
          />
        ))}
      </div>
    </div>
  );
}
