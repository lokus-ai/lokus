import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import LokusLogo from "../../LokusLogo.jsx";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export function WelcomeSplash({ next }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col items-center gap-6">
        <motion.div variants={item}>
          <LokusLogo className="w-16 h-16" />
        </motion.div>
        <motion.div variants={item} className="space-y-3">
          <h1 className="text-3xl font-bold text-app-text tracking-tight">Welcome to Lokus</h1>
          <p className="text-base text-app-muted max-w-xs">Your thoughts, beautifully organized</p>
        </motion.div>
        <motion.button
          variants={item}
          onClick={next}
          className="mt-6 px-6 py-2.5 bg-app-accent text-app-accent-fg rounded-lg font-medium text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          Get Started
          <ArrowRight className="w-4 h-4" />
        </motion.button>
      </motion.div>
    </div>
  );
}
