import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { USE_CASES } from "../data/use-cases.js";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const cardVariant = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

export function UseCaseSelection({ selections, updateSelection }) {
  const selected = selections.useCases;

  const toggle = (id) => {
    const next = selected.includes(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id];
    updateSelection("useCases", next);
  };

  return (
    <div className="flex flex-col gap-5 px-2">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-app-text">How will you use Lokus?</h2>
        <p className="text-sm text-app-muted">Select all that apply</p>
      </div>
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 gap-3">
        {USE_CASES.map((uc) => {
          const isSelected = selected.includes(uc.id);
          const Icon = uc.icon;
          return (
            <motion.button
              key={uc.id}
              variants={cardVariant}
              onClick={() => toggle(uc.id)}
              whileTap={{ scale: 0.98 }}
              className={`onboarding-card p-4 text-left relative flex items-start gap-3 ${isSelected ? "selected" : ""}`}
            >
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-app-accent/10 flex items-center justify-center">
                <Icon className="w-5 h-5 text-app-accent" />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-app-text text-sm">{uc.title}</div>
                <div className="text-xs text-app-muted mt-0.5 leading-relaxed">{uc.description}</div>
              </div>
              <div className="onboarding-check absolute top-2 right-2 w-5 h-5 rounded-full bg-app-accent flex items-center justify-center">
                <Check className="w-3 h-3 text-app-accent-fg" />
              </div>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
