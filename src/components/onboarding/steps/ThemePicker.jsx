import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useTheme } from "../../../hooks/theme.jsx";

const THEMES = [
  { id: "lokus-dark", name: "Lokus Dark", bg: "#18161f", text: "#e0ddf0", accent: "#e0a872", panel: "#201e29" },
  { id: "lokus-light", name: "Lokus Light", bg: "#f9f5ef", text: "#2b2738", accent: "#c27830", panel: "#f0ebe3" },
  { id: "rose-pine", name: "Rosé Pine", bg: "#191724", text: "#e0def4", accent: "#c4a7e7", panel: "#1f1d2e" },
  { id: "tokyo-night", name: "Tokyo Night", bg: "#1a1b26", text: "#a9b1d6", accent: "#7aa2f7", panel: "#1f2335" },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
};

const cardVariant = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: "easeOut" } },
};

export function ThemePicker({ selections, updateSelection }) {
  const { setTheme } = useTheme();
  const selectedTheme = selections.theme;

  const pick = (id) => {
    setTheme(id);
    updateSelection("theme", id);
  };

  return (
    <div className="flex flex-col gap-5 px-2">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-app-text">Pick your theme</h2>
        <p className="text-sm text-app-muted">You can always change this later in settings</p>
      </div>
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 gap-3">
        {THEMES.map((t) => {
          const isSelected = selectedTheme === t.id;
          return (
            <motion.button
              key={t.id}
              variants={cardVariant}
              onClick={() => pick(t.id)}
              whileTap={{ scale: 0.97 }}
              className={`theme-preview-card relative ${isSelected ? "selected" : ""}`}
            >
              <div className="p-3 rounded-t-[10px]" style={{ background: t.bg }}>
                <div className="space-y-1.5">
                  <div className="h-2 rounded-full w-3/4" style={{ background: t.text, opacity: 0.7 }} />
                  <div className="h-1.5 rounded-full w-full" style={{ background: t.text, opacity: 0.2 }} />
                  <div className="h-1.5 rounded-full w-5/6" style={{ background: t.text, opacity: 0.2 }} />
                  <div className="h-1.5 rounded-full w-2/3" style={{ background: t.text, opacity: 0.2 }} />
                </div>
              </div>
              <div className="px-3 py-2 flex items-center justify-between" style={{ background: t.panel }}>
                <span className="text-xs font-medium" style={{ color: t.text }}>{t.name}</span>
                <div className="w-3 h-3 rounded-full" style={{ background: t.accent }} />
              </div>
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-app-accent flex items-center justify-center shadow-lg"
                >
                  <Check className="w-3.5 h-3.5 text-app-accent-fg" />
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
