import { useTheme } from "../hooks/theme.jsx";

const SWATCHES = ["#ffd803","#90e0ef","#ff5c8a","#7bf1a8","#f59e0b","#a78bfa","#22c55e","#ef4444"];

export default function AccentPicker() {
  const { accent, setAccent } = useTheme();
  return (
    <div className="flex flex-wrap gap-2">
      {SWATCHES.map(c => (
        <button
          key={c}
          title={c}
          onClick={() => setAccent(c)}
          className={`w-6 h-6 rounded border ${accent === c ? "ring-2 ring-app-accent" : "border-app-border"}`}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}
