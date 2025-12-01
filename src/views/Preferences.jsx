import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Settings as SettingsIcon,
  Palette,
  Type,
  FileText,
  Calendar,
  Command,
  GitBranch,
  User,
  Bot,
  Download,
  RefreshCw,
  Link
} from "lucide-react";
import { useAuth } from "../core/auth/AuthContext";

// Import extracted components
import AppearanceSettings from "../components/preferences/AppearanceSettings.jsx";
import EditorSettings from "../components/preferences/EditorSettings.jsx";
import MarkdownSettings from "../components/preferences/MarkdownSettings.jsx";
import DailyNotesSettings from "../components/preferences/DailyNotesSettings.jsx";
import ShortcutsSettings from "../components/preferences/ShortcutsSettings.jsx";
import ConnectionsSettings from "../components/preferences/ConnectionsSettings.jsx";
import AccountSettings from "../components/preferences/AccountSettings.jsx";
import SyncSettings from "../components/preferences/SyncSettings.jsx";
import ImportSection from "../components/preferences/ImportSection.jsx";
import UpdatesSection from "../components/preferences/UpdatesSection.jsx";
import AIAssistant from "../components/preferences/AIAssistant.jsx";

export default function Preferences() {
  const [section, setSection] = useState("Appearance");
  const [workspacePath, setWorkspacePath] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    async function loadWorkspacePath() {
      try {
        const path = await invoke('get_workspace_path');
        setWorkspacePath(path);
      } catch (e) {
        console.error('Failed to get workspace path:', e);
      }
    }
    loadWorkspacePath();
  }, []);

  const navItems = [
    { id: "Appearance", icon: Palette, label: "Appearance" },
    { id: "Editor", icon: Type, label: "Editor" },
    { id: "Markdown", icon: FileText, label: "Markdown" },
    { id: "Daily Notes", icon: Calendar, label: "Daily Notes" },
    { id: "Shortcuts", icon: Command, label: "Shortcuts" },
    { id: "Sync", icon: GitBranch, label: "Sync" },
    { id: "Connections", icon: Link, label: "Connections" },
    { id: "Account", icon: User, label: "Account" },
    { id: "AI Assistant", icon: Bot, label: "AI Assistant" },
    { id: "Import", icon: Download, label: "Import" },
    { id: "Updates", icon: RefreshCw, label: "Updates" },
  ];

  return (
    <div className="flex h-full bg-app-bg text-app-text overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-app-border bg-app-panel flex flex-col">
        <div className="p-6 border-b border-app-border">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-app-accent" />
            Settings
          </h1>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${section === item.id
                  ? "bg-app-accent text-app-accent-fg"
                  : "text-app-muted hover:bg-app-bg hover:text-app-text"
                }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        {user && (
          <div className="p-4 border-t border-app-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-app-accent/20 flex items-center justify-center text-app-accent font-bold text-xs">
                {user.email ? user.email[0].toUpperCase() : 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.email}</p>
                <p className="text-xs text-app-muted">Pro Plan</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          <header className="mb-8">
            <h2 className="text-2xl font-bold">{section}</h2>
            <p className="text-app-muted mt-1">
              Manage your {section.toLowerCase()} settings and preferences
            </p>
          </header>

          <main>
            {section === "Appearance" && <AppearanceSettings />}
            {section === "Editor" && <EditorSettings />}
            {section === "Markdown" && <MarkdownSettings />}
            {section === "Daily Notes" && <DailyNotesSettings />}
            {section === "Shortcuts" && <ShortcutsSettings />}
            {section === "Sync" && <SyncSettings workspacePath={workspacePath} />}
            {section === "Connections" && <ConnectionsSettings />}
            {section === "Account" && <AccountSettings />}
            {section === "AI Assistant" && <AIAssistant />}
            {section === "Import" && <ImportSection workspacePath={workspacePath} />}
            {section === "Updates" && <UpdatesSection />}
          </main>
        </div>
      </div>
    </div>
  );
}