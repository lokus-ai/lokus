import { useEffect, useState } from "react";
import { X, Keyboard } from "lucide-react";
import { formatAccelerator } from "../core/shortcuts/registry.js";
import { isDesktop } from '../platform/index.js';

export default function ShortcutHelpModal({ isOpen, onClose }) {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent || ""));
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Only show actually working shortcuts
  const shortcuts = [
    {
      category: "File Operations",
      items: [
        { action: "Save File", shortcut: "CommandOrControl+S" },
        { action: "New File", shortcut: "CommandOrControl+N" },
        { action: "New Folder", shortcut: "CommandOrControl+Shift+N" },
        { action: "New Canvas", shortcut: "CommandOrControl+Shift+C" },
        { action: "Close Tab", shortcut: "CommandOrControl+W" },
        { action: "Reopen Closed Tab", shortcut: "CommandOrControl+Shift+T" },
        { action: "Next Tab", shortcut: "CommandOrControl+Alt+Right" },
        { action: "Previous Tab", shortcut: "CommandOrControl+Alt+Left" },
      ]
    },
    {
      category: "Navigation",
      items: [
        { action: "Command Palette", shortcut: "CommandOrControl+K" },
        { action: "Toggle Sidebar", shortcut: "CommandOrControl+B" },
        { action: "Open Preferences", shortcut: "CommandOrControl+," },
        { action: "Find in Note", shortcut: "CommandOrControl+F" },
        { action: "Global Search", shortcut: "CommandOrControl+Shift+F" },
        { action: "Insert WikiLink", shortcut: "CommandOrControl+L" },
        { action: "Show Keyboard Shortcuts", shortcut: "F1" },
        { action: "Open Graph View", shortcut: "CommandOrControl+Shift+G" },
        { action: "Open Kanban Board", shortcut: "CommandOrControl+Shift+K" },
        { action: "Refresh File Tree", shortcut: "F5" },
      ]
    },
    {
      category: "Editor",
      items: [
        { action: "Copy", shortcut: "CommandOrControl+C" },
        { action: "Cut", shortcut: "CommandOrControl+X" },
        { action: "Paste", shortcut: "CommandOrControl+V" },
        { action: "Select All", shortcut: "CommandOrControl+A" },
      ]
    },
    {
      category: "Graph View", 
      items: [
        { action: "Search Nodes", shortcut: "CommandOrControl+K" },
        { action: "Reset View", shortcut: "CommandOrControl+R" },
        { action: "2D View Mode", shortcut: "CommandOrControl+1" },
        { action: "3D View Mode", shortcut: "CommandOrControl+2" },
        { action: "Force Layout Mode", shortcut: "CommandOrControl+3" },
        { action: "Toggle Layout", shortcut: "Space" },
        { action: "Close Graph", shortcut: "Escape" },
      ]
    },
    {
      category: "Canvas",
      items: [
        { action: "Save Canvas", shortcut: "CommandOrControl+S" },
        { action: "Close Canvas", shortcut: "Escape" },
      ]
    },
    {
      category: "Modal Controls",
      items: [
        { action: "Close Modal", shortcut: "Escape" },
        { action: "Confirm Action", shortcut: "Enter" },
        { action: "Show This Help", shortcut: "CommandOrControl+/" },
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="relative w-full max-w-4xl max-h-[80vh] rounded-lg shadow-xl overflow-hidden" style={{ backgroundColor: 'rgb(var(--bg))', border: '1px solid rgb(var(--border))' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid rgb(var(--border))' }}>
          <div className="flex items-center gap-3">
            <Keyboard className="w-6 h-6" style={{ color: 'rgb(var(--accent))' }} />
            <h2 className="text-xl font-semibold" style={{ color: 'rgb(var(--text))' }}>
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="obsidian-button icon-only"
            style={{ color: 'rgb(var(--muted))' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {shortcuts.map((section, index) => (
              <div key={index} className="space-y-4">
                <h3 className="text-lg font-medium pb-2" style={{ color: 'rgb(var(--text))', borderBottom: '1px solid rgb(var(--border))' }}>
                  {section.category}
                </h3>
                <div className="space-y-2">
                  {section.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex items-center justify-between py-2 px-3 rounded-lg transition-colors" style={{ 
                      ':hover': { backgroundColor: 'rgb(var(--panel-secondary) / 0.5)' }
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(var(--panel-secondary) / 0.5)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <span className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                        {item.action}
                      </span>
                      <kbd className="px-2 py-1 text-xs font-mono rounded" style={{
                        color: 'rgb(var(--text))',
                        backgroundColor: 'rgb(var(--panel))',
                        border: '1px solid rgb(var(--border))'
                      }}>
                        {formatAccelerator(item.shortcut)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Note about broken shortcuts */}
          <div className="mt-8 p-4 rounded-lg" style={{ 
            backgroundColor: 'rgb(var(--warning) / 0.1)', 
            border: '1px solid rgb(var(--warning) / 0.3)' 
          }}>
            <h4 className="text-sm font-medium mb-2" style={{ color: 'rgb(var(--warning))' }}>
              Note
            </h4>
            <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
              These are the currently working shortcuts. Graph shortcuts work when the graph view is active. Tab navigation (Cmd+Tab) and some advanced editor shortcuts are not yet implemented.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6" style={{ 
          borderTop: '1px solid rgb(var(--border))', 
          backgroundColor: 'rgb(var(--panel))' 
        }}>
          <div className="text-sm" style={{ color: 'rgb(var(--muted))' }}>
            Press <kbd className="px-1 py-0.5 text-xs rounded" style={{
              backgroundColor: 'rgb(var(--panel-secondary))',
              border: '1px solid rgb(var(--border))',
              color: 'rgb(var(--text))'
            }}>Esc</kbd> to close
          </div>
          {isDesktop() && (<div className="text-sm" style={{ color: 'rgb(var(--muted))' }}>
            {isMac ? '⌘' : 'Ctrl'} = Command/Control key
          </div>)}
        </div>
      </div>
    </div>
  );
}