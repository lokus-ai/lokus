import { useTheme } from "../state/theme.jsx";

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
          className="w-8 h-8 border-3 border-black rounded-nb shadow-nb active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          style={{ background: c, outline: accent === c ? "3px solid black" : "none" }}
        />
      ))}
    </div>
  );
}
