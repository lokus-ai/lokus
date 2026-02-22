import { motion } from "framer-motion";
import { FolderOpen, CalendarDays, Download } from "lucide-react";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

export function WorkspaceSetup({ selections, updateSelection }) {
  return (
    <div className="flex flex-col gap-5 px-2">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-app-text">Set up your workspace</h2>
        <p className="text-sm text-app-muted">Configure your vault and preferences</p>
      </div>
      <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-4">
        {/* Vault Name */}
        <motion.div variants={item} className="onboarding-card p-4 flex items-start gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-app-accent/10 flex items-center justify-center">
            <FolderOpen className="w-5 h-5 text-app-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <label className="font-medium text-app-text text-sm block mb-1.5">Vault Name</label>
            <input
              type="text"
              value={selections.vaultName}
              onChange={(e) => updateSelection("vaultName", e.target.value)}
              placeholder="My Vault"
              className="w-full px-3 py-2 rounded-lg bg-app-bg border border-app-border text-app-text text-sm focus:outline-none focus:border-app-accent transition-colors"
            />
            <p className="text-xs text-app-muted mt-1">A vault is a folder where all your notes live</p>
          </div>
        </motion.div>

        {/* Daily Notes Toggle */}
        <motion.div variants={item} className="onboarding-card p-4 flex items-center gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-app-accent/10 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-app-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-app-text text-sm">Daily Notes</div>
            <p className="text-xs text-app-muted mt-0.5">Auto-create a fresh note each day for journaling and tasks</p>
          </div>
          <button
            onClick={() => updateSelection("dailyNotes", !selections.dailyNotes)}
            className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
              selections.dailyNotes ? "bg-app-accent" : "bg-app-border"
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                selections.dailyNotes ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </motion.div>

        {/* Import - Coming Soon */}
        <motion.div variants={item} className="onboarding-card p-4 flex items-center gap-3 opacity-50">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-app-accent/10 flex items-center justify-center">
            <Download className="w-5 h-5 text-app-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-app-text text-sm">Import from other apps</div>
            <p className="text-xs text-app-muted mt-0.5">Obsidian, Notion, and more</p>
          </div>
          <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-app-accent/10 text-app-accent text-xs font-medium">
            Coming Soon
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}
