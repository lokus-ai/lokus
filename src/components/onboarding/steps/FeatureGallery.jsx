import { motion } from "framer-motion";
import { FEATURES } from "../data/features.js";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

export function FeatureGallery() {
  return (
    <div className="flex flex-col gap-5 px-2">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-app-text">What you can do with Lokus</h2>
        <p className="text-sm text-app-muted">Explore the features available in your workspace</p>
      </div>
      <motion.div variants={container} initial="hidden" animate="show" className="feature-grid">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <motion.div
              key={f.id}
              variants={cardVariant}
              className="onboarding-card p-3 flex items-start gap-3"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-app-accent/10 flex items-center justify-center">
                <Icon className="w-4 h-4 text-app-accent" />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-app-text text-sm">{f.title}</div>
                <div className="text-xs text-app-muted mt-0.5 leading-relaxed">{f.description}</div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
