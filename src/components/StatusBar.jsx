
import React, { useMemo, useState } from 'react';
import { useStatusBar } from '../hooks/useStatusBar';
import SyncStatus from './Auth/SyncStatus.jsx';
import StatusBarContextMenu from './StatusBarContextMenu.jsx';
import pluginStateAdapter from '../core/plugins/PluginStateAdapter.js';

/**
 * Pluginable Status Bar Component
 * Supports left and right sections with priority-based ordering of widgets
 * Compatible with VS Code-style plugin s tatus bar items
 */
export default function StatusBar({ activeFile, unsavedChanges, openTabs = [], editor, readingSpeed = 200 }) {
  const { leftItems, rightItems } = useStatusBar();

  // Context Menu State
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    position: { x: 0, y: 0 },
    pluginId: null,
    commands: []
  });

  const handleContextMenu = (e, pluginId) => {
    e.preventDefault();

    // Get plugin commands
    const plugin = pluginStateAdapter.getPlugin(pluginId);
    const commands = plugin?.manifest?.contributes?.commands || [];

    if (commands.length > 0) {
      setContextMenu({
        isOpen: true,
        position: { x: e.clientX, y: e.clientY },
        pluginId,
        commands
      });
    }
  };

  const handleExecuteCommand = async (commandId) => {
    if (typeof window !== 'undefined' && window.lokus && window.lokus.commands) {
      // Execute via global command registry
      window.lokus.commands.executeCommand(commandId);
    } else {
    }
  };

  const stats = useMemo(() => {
    if (!editor) return null;

    let wordCount = 0;
    let charCount = 0;

    const nodes = editor?.state.doc?.content?.content;

    const wordRegex =
      /^(?:\(?\+?\d{1,3}\)?[ -]?)?(?:\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4})$|^[\w@.'’+-]+$/;

    nodes?.forEach((node) => {
      const contentArray = node?.content?.content;

      // Skip empty nodes
      if (!contentArray || contentArray.length === 0) return;

      // Combine all text segments in the node into a single string
      // This ensures word/char counts include every segment, not just the first
      const text = contentArray.map(seg => seg.text || "").join(" ");

      // Count characters including everything
      charCount += text.length;

      // Split into words and filter out words without alphanumeric characters
      const words = text
        .trim()
        .split(/\s+/)
        .map((w) => w.replace(/^[^\w@]+|[^\w@]+$/g, "")) // remove punctuation from edges
        .filter((w) => w.length > 0)
        .filter((word) => wordRegex.test(word));

      wordCount += words.length;
    });

    const minutes = wordCount ? Math.max(1, Math.ceil(wordCount / readingSpeed)) : 0;

    return { wordCount, charCount, minutes };

  }, [editor?.state?.doc, readingSpeed]);

  // DEBUG: Log status bar items

  const renderStatusBarItem = (item) => {
    const { id, component: Component, text, icon, tooltip, command, priority, className, pluginId } = item;

    // If it's a React component, render it directly
    if (Component) {
      // Validate that Component is actually a valid React component
      if (typeof Component === 'function' || (typeof Component === 'object' && Component.$$typeof)) {
        return (
          <div
            key={id}
            className="status-bar-plugin-item"
            onContextMenu={(e) => pluginId && handleContextMenu(e, pluginId)}
          >
            <Component />
          </div>
        );
      } else {
        return (
          <div key={id} className="status-bar-plugin-item">
            <span className="text-red-500 text-xs">Invalid Component</span>
          </div>
        );
      }
    }

    // Otherwise render as a basic status bar item
    return (
      <div
        key={id}
        className={`obsidian - status - bar - item ${command ? 'clickable' : ''} ${className || ''} `}
        title={tooltip}
        onClick={command ? () => handleCommand(command) : undefined}
        onContextMenu={(e) => pluginId && handleContextMenu(e, pluginId)}
      >
        {icon && <span className="w-3 h-3 mr-1">{icon}</span>}
        {text && <span>{text}</span>}
      </div>
    );
  };

  const handleCommand = (command) => {
    // Execute command through plugin system
    if (typeof window !== 'undefined' && window.pluginRuntime) {
      window.pluginRuntime.executeCommand(command);
    }
  };

  // Sort items by priority (higher priority first)
  const sortedLeftItems = [...leftItems].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const sortedRightItems = [...rightItems].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  return (
    <div className="obsidian-status-bar">
      {/* Left section - plugin items and core items */}
      <div className="obsidian-status-bar-section">
        {/* Core status items - hide on small screens */}
        <div className="obsidian-status-bar-item hidden md:flex">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>Ready</span>
        </div>

        {activeFile && (
          <>
            <div className="obsidian-status-bar-separator hidden md:block" />
            <div className="obsidian-status-bar-item hidden lg:flex">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
              <span className="truncate max-w-[150px]">{activeFile.split('/').pop()}</span>
            </div>
          </>
        )}

        <div className="obsidian-status-bar-separator hidden md:block" />
        <div className="obsidian-status-bar-item hidden md:flex">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
          <span>{openTabs.length} {openTabs.length === 1 ? 'file' : 'files'}</span>
        </div>

        {/* Plugin items in left section */}
        {sortedLeftItems.length > 0 && (
          <>
            <div className="obsidian-status-bar-separator" />
            {sortedLeftItems.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && <div className="obsidian-status-bar-separator" />}
                {renderStatusBarItem(item)}
              </React.Fragment>
            ))}
          </>
        )}
      </div>

      {/* Right section - plugin items and core items */}
      <div className="obsidian-status-bar-section">
        {/* Plugin items in right section */}
        {sortedRightItems.map((item, index) => (
          <React.Fragment key={item.id}>
            {renderStatusBarItem(item)}
            {index < sortedRightItems.length - 1 && <div className="obsidian-status-bar-separator" />}
          </React.Fragment>
        ))}

        {/* Core status items */}
        {(sortedRightItems.length > 0 || unsavedChanges.size > 0) && (
          <div className="obsidian-status-bar-separator" />
        )}

        {unsavedChanges.size > 0 && (
          <>
            <div className="obsidian-status-bar-item active">
              <div className="w-2 h-2 rounded-full bg-current" />
              <span>{unsavedChanges.size} unsaved</span>
            </div>
          </>
        )}

        {/* Editor status - hide on small screens */}
        {editor && (
          <>
            <div className="obsidian-status-bar-separator hidden lg:block" />
            <div className="obsidian-status-bar-item hidden lg:flex">
              <span>Words: {stats?.wordCount.toLocaleString()}</span>
            </div>
            <div className="obsidian-status-bar-separator hidden xl:block" />
            <div className="obsidian-status-bar-item hidden xl:flex">
              <span>Chars: {stats?.charCount.toLocaleString()}</span>
            </div>
            <div className="obsidian-status-bar-separator hidden xl:block" />
            <div className="obsidian-status-bar-item hidden xl:flex">
              <span>~{stats?.minutes} min</span>
            </div>
          </>
        )}

        <div className="obsidian-status-bar-item clickable">
          {/* GitHub/Markdown icon */}
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          <span className="hidden md:inline">Markdown</span>
        </div>
        <div className="obsidian-status-bar-separator hidden lg:block" />
        <div className="obsidian-status-bar-item clickable hidden lg:flex">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
          <span>Settings</span>
        </div>

        {/* Sync Component */}
        <div className="obsidian-status-bar-separator" />
        <SyncStatus />
      </div>

      <StatusBarContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        pluginId={contextMenu.pluginId}
        commands={contextMenu.commands}
        onClose={() => setContextMenu(prev => ({ ...prev, isOpen: false }))}
        onExecuteCommand={handleExecuteCommand}
      />
    </div>
  );
}