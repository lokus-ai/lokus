import { motion } from "framer-motion";
import { FilePlus, CalendarDays, Check, RotateCcw } from "lucide-react";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export function ReadyScreen({ complete }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col items-center gap-6">
        <motion.div variants={item}>
          <div className="w-14 h-14 rounded-full bg-app-accent/15 flex items-center justify-center">
            <Check className="w-7 h-7 text-app-accent" />
          </div>
        </motion.div>

        <motion.div variants={item} className="space-y-2">
          <h2 className="text-2xl font-bold text-app-text tracking-tight">You're all set</h2>
          <p className="text-sm text-app-muted max-w-sm">
            Your workspace is ready. What would you like to do first?
          </p>
        </motion.div>

        <motion.div variants={item} className="flex gap-3">
          <button
            onClick={complete}
            className="px-5 py-2 bg-app-accent text-app-accent-fg rounded-lg font-medium text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <FilePlus className="w-4 h-4" />
            Create a note
          </button>
          <button
            onClick={complete}
            className="px-5 py-2 border border-app-border text-app-text rounded-lg font-medium text-sm hover:bg-app-bg transition-colors flex items-center gap-2"
          >
            <CalendarDays className="w-4 h-4" />
            Daily note
          </button>
        </motion.div>

        <motion.p variants={item} className="text-xs text-app-muted flex items-center gap-1.5 mt-2">
          <RotateCcw className="w-3 h-3" />
          You can restart this anytime from Settings
        </motion.p>
      </motion.div>
    </div>
  );
}
