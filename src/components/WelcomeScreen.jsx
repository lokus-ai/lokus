import { FilePlus2, FolderPlus, Layers, Search } from 'lucide-react';
import { useFeatureFlags } from '../contexts/RemoteConfigContext';
import { isDesktop } from '../platform/index.js';
import platformService from '../services/platform/PlatformService.js';
import LokusLogo from './LokusLogo.jsx';

function formatAccelerator(accel) {
  return accel
    .replace('CommandOrControl', platformService.getModifierSymbol())
    .replace('+', '');
}

/**
 * WelcomeScreen — shown when no file is open.
 * VS Code-inspired landing with quick actions, recent files, and tips.
 */
export default function WelcomeScreen({
  onCreateFile,
  onCreateFolder,
  onCreateCanvas,
  onOpenCommandPalette,
  recentFiles = [],
  onFileOpen,
}) {
  const featureFlags = useFeatureFlags();

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl w-full mx-auto min-h-full flex flex-col justify-center">

          {/* Header Section */}
          <div className="text-center mb-10">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-app-accent/20 to-app-accent/10 border border-app-accent/20 flex items-center justify-center">
              <LokusLogo className="w-10 h-10 text-app-accent" />
            </div>
            <h1 className="text-3xl font-bold text-app-text mb-2">Welcome to Lokus</h1>
            <p className="text-app-muted text-lg">Your modern knowledge management platform</p>
          </div>

          {/* Quick Actions */}
          <div className="mb-12">
            <h2 className="text-lg font-semibold text-app-text mb-6">Start</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={onCreateFile}
                className="group p-6 rounded-xl border border-app-border bg-app-panel/30 hover:bg-app-panel/50 hover:border-app-accent/40 transition-all duration-200 text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-app-accent/10 group-hover:bg-app-accent/20 flex items-center justify-center mb-4 transition-colors">
                  <FilePlus2 className="w-5 h-5 text-app-accent" />
                </div>
                <h3 className="font-medium text-app-text mb-2">New Note</h3>
                <p className="text-sm text-app-muted">Create your first note and start writing</p>
                {isDesktop() && (<div className="mt-3 text-xs text-app-muted/70">{formatAccelerator("CommandOrControl+N")}</div>)}
              </button>

              {featureFlags.enable_canvas && (
                <button
                  onClick={onCreateCanvas}
                  className="group p-6 rounded-xl border border-app-border bg-app-panel/30 hover:bg-app-panel/50 hover:border-app-accent/40 transition-all duration-200 text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-app-accent/10 group-hover:bg-app-accent/20 flex items-center justify-center mb-4 transition-colors">
                    <Layers className="w-5 h-5 text-app-accent" />
                  </div>
                  <h3 className="font-medium text-app-text mb-2">New Canvas</h3>
                  <p className="text-sm text-app-muted">Create visual mind maps and diagrams</p>
                </button>
              )}

              <button
                onClick={onCreateFolder}
                className="group p-6 rounded-xl border border-app-border bg-app-panel/30 hover:bg-app-panel/50 hover:border-app-accent/40 transition-all duration-200 text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-app-accent/10 group-hover:bg-app-accent/20 flex items-center justify-center mb-4 transition-colors">
                  <FolderPlus className="w-5 h-5 text-app-accent" />
                </div>
                <h3 className="font-medium text-app-text mb-2">New Folder</h3>
                <p className="text-sm text-app-muted">Organize your notes with folders</p>
                {isDesktop() && (<div className="mt-3 text-xs text-app-muted/70">{formatAccelerator("CommandOrControl+Shift+N")}</div>)}
              </button>

              <button
                onClick={onOpenCommandPalette}
                className="group p-6 rounded-xl border border-app-border bg-app-panel/30 hover:bg-app-panel/50 hover:border-app-accent/40 transition-all duration-200 text-left"
                data-tour="templates"
              >
                <div className="w-10 h-10 rounded-lg bg-app-accent/10 group-hover:bg-app-accent/20 flex items-center justify-center mb-4 transition-colors">
                  <Search className="w-5 h-5 text-app-accent" />
                </div>
                <h3 className="font-medium text-app-text mb-2">Command Palette</h3>
                <p className="text-sm text-app-muted">Quick access to all commands</p>
                {isDesktop() && (<div className="mt-3 text-xs text-app-muted/70">{formatAccelerator("CommandOrControl+K")}</div>)}
              </button>
            </div>
          </div>

          {/* Recent & Help */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-lg font-semibold text-app-text mb-4">Recent</h2>
              <div className="space-y-2">
                {recentFiles.length > 0 ? (
                  recentFiles.map((file, idx) => (
                    <button
                      key={idx}
                      onClick={() => onFileOpen?.(file)}
                      className="w-full p-3 rounded-lg bg-app-panel/20 border border-app-border/50 hover:bg-app-panel/40 hover:border-app-accent/50 transition-all text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4 text-app-muted group-hover:text-app-accent transition-colors" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm font-medium text-app-text group-hover:text-app-accent transition-colors truncate">
                          {file.name?.replace(/\.(md|txt|canvas)$/, '') ?? file.path?.split('/').pop()}
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 rounded-lg bg-app-panel/20 border border-app-border/50">
                    <p className="text-sm text-app-muted">No recent files yet. Start by creating your first note!</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-app-text mb-4">Learn</h2>
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-app-panel/20 border border-app-border/50">
                  <h3 className="font-medium text-app-text text-sm mb-2">Features</h3>
                  <ul className="text-sm text-app-muted space-y-1">
                    <li>Rich text editing with math equations</li>
                    <li>Wiki-style linking with <code className="px-1 py-0.5 bg-app-bg/50 rounded text-xs">[[brackets]]</code></li>
                    <li>Task management and kanban boards</li>
                    <li>Plugin system for extensibility</li>
                  </ul>
                </div>
                {isDesktop() && (
                <div className="p-4 rounded-lg bg-app-panel/20 border border-app-border/50">
                  <h3 className="font-medium text-app-text text-sm mb-2">Quick Tips</h3>
                  <ul className="text-sm text-app-muted space-y-1">
                    <li><kbd className="px-1.5 py-0.5 bg-app-bg/50 rounded text-xs">{platformService.getModifierSymbol()}+K</kbd> Command palette</li>
                    <li><kbd className="px-1.5 py-0.5 bg-app-bg/50 rounded text-xs">{platformService.getModifierSymbol()}+S</kbd> Save current file</li>
                    <li><kbd className="px-1.5 py-0.5 bg-app-bg/50 rounded text-xs">{platformService.getModifierSymbol()}+P</kbd> Quick file open</li>
                    <li>Drag files to move them between folders</li>
                  </ul>
                </div>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
