import React, { useMemo } from 'react';
import { useStatusBar } from '../../hooks/useStatusBar';
import { useResponsiveStatusBar, STATUS_BAR_PRIORITY } from '../../hooks/useResponsiveStatusBar';
import SyncStatus from '../Auth/SyncStatus.jsx';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '../ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';

/**
 * ResponsiveStatusBar - Adaptive status bar with priority-based progressive hiding
 * Maintains all StatusBar functionality while adding overflow menus for hidden items
 */
export default function ResponsiveStatusBar({
  activeFile,
  unsavedChanges,
  openTabs = [],
  editor,
  readingSpeed = 200
}) {
  const { leftItems, rightItems } = useStatusBar();

  // Count words and characters
  function countFinder(editor) {
    let wordCount = 0;
    let charCount = 0;

    const nodes = editor?.state.doc?.content?.content;
    const wordRegex = /^(?:\(?\+?\d{1,3}\)?[ -]?)?(?:\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4})$|^[\w@.''+-]+$/;

    nodes?.forEach((node) => {
      const contentArray = node?.content?.content;
      if (!contentArray || contentArray.length === 0) return;

      const text = contentArray.map(seg => seg.text || "").join(" ");
      charCount += text.length;

      const words = text
        .trim()
        .split(/\s+/)
        .map((w) => w.replace(/^[^\w@]+|[^\w@]+$/g, ""))
        .filter((w) => w.length > 0)
        .filter((word) => wordRegex.test(word));

      wordCount += words.length;
    });

    return { wordCount, charCount };
  }

  const stats = useMemo(() => {
    if (!editor) return null;
    const { wordCount, charCount } = countFinder(editor);
    const minutes = wordCount ? Math.max(1, Math.ceil(wordCount / readingSpeed)) : 0;
    return { wordCount, charCount, minutes };
  }, [editor?.state?.doc, readingSpeed]);

  // Build status bar items with priorities
  const leftStatusItems = useMemo(() => {
    const items = [];

    // Ready status
    items.push({
      id: 'ready-status',
      priority: STATUS_BAR_PRIORITY.readyStatus,
      estimatedWidth: 80,
      render: () => (
        <div className="obsidian-status-bar-item">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>Ready</span>
        </div>
      )
    });

    // Active file
    if (activeFile) {
      items.push({
        id: 'active-file',
        priority: STATUS_BAR_PRIORITY.activeFile,
        estimatedWidth: 150,
        render: () => (
          <>
            <div className="obsidian-status-bar-separator" />
            <div className="obsidian-status-bar-item">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
              <span className="truncate max-w-[150px]">{activeFile.split('/').pop()}</span>
            </div>
          </>
        )
      });
    }

    // Open tabs count
    items.push({
      id: 'tabs-count',
      priority: STATUS_BAR_PRIORITY.activeFile,
      estimatedWidth: 80,
      render: () => (
        <>
          <div className="obsidian-status-bar-separator" />
          <div className="obsidian-status-bar-item">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
            <span>{openTabs.length} {openTabs.length === 1 ? 'file' : 'files'}</span>
          </div>
        </>
      )
    });

    // Plugin items
    leftItems.forEach((item) => {
      items.push({
        id: `plugin-left-${item.id}`,
        priority: item.priority || STATUS_BAR_PRIORITY.pluginDefault,
        estimatedWidth: 100,
        render: () => (
          <>
            <div className="obsidian-status-bar-separator" />
            {renderStatusBarItem(item)}
          </>
        )
      });
    });

    return items;
  }, [activeFile, openTabs, leftItems]);

  const rightStatusItems = useMemo(() => {
    const items = [];

    // Plugin items
    rightItems.forEach((item, index) => {
      items.push({
        id: `plugin-right-${item.id}`,
        priority: item.priority || STATUS_BAR_PRIORITY.pluginDefault,
        estimatedWidth: 100,
        render: () => (
          <React.Fragment key={item.id}>
            {renderStatusBarItem(item)}
            {index < rightItems.length - 1 && <div className="obsidian-status-bar-separator" />}
          </React.Fragment>
        )
      });
    });

    // Unsaved changes (CRITICAL - always visible)
    if (unsavedChanges.size > 0) {
      items.push({
        id: 'unsaved-changes',
        priority: STATUS_BAR_PRIORITY.unsavedChanges,
        estimatedWidth: 100,
        render: () => (
          <>
            {(rightItems.length > 0) && <div className="obsidian-status-bar-separator" />}
            <div className="obsidian-status-bar-item active">
              <div className="w-2 h-2 rounded-full bg-current" />
              <span>{unsavedChanges.size} unsaved</span>
            </div>
          </>
        )
      });
    }

    // Word count
    if (editor && stats) {
      items.push({
        id: 'word-count',
        priority: STATUS_BAR_PRIORITY.wordCount,
        estimatedWidth: 100,
        render: () => (
          <>
            <div className="obsidian-status-bar-separator" />
            <div className="obsidian-status-bar-item">
              <span>Words: {stats.wordCount.toLocaleString()}</span>
            </div>
          </>
        )
      });

      // Char count
      items.push({
        id: 'char-count',
        priority: STATUS_BAR_PRIORITY.charCount,
        estimatedWidth: 100,
        render: () => (
          <>
            <div className="obsidian-status-bar-separator" />
            <div className="obsidian-status-bar-item">
              <span>Chars: {stats.charCount.toLocaleString()}</span>
            </div>
          </>
        )
      });

      // Reading time
      items.push({
        id: 'reading-time',
        priority: STATUS_BAR_PRIORITY.readingTime,
        estimatedWidth: 80,
        render: () => (
          <>
            <div className="obsidian-status-bar-separator" />
            <div className="obsidian-status-bar-item">
              <span>~{stats.minutes} min</span>
            </div>
          </>
        )
      });
    }

    // Markdown indicator
    items.push({
      id: 'markdown-indicator',
      priority: STATUS_BAR_PRIORITY.markdownIndicator,
      estimatedWidth: 90,
      render: () => (
        <div className="obsidian-status-bar-item clickable">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          <span>Markdown</span>
        </div>
      )
    });

    // Settings button
    items.push({
      id: 'settings-button',
      priority: STATUS_BAR_PRIORITY.settingsButton,
      estimatedWidth: 90,
      render: () => (
        <>
          <div className="obsidian-status-bar-separator" />
          <div className="obsidian-status-bar-item clickable">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            <span>Settings</span>
          </div>
        </>
      )
    });

    return items;
  }, [rightItems, unsavedChanges, editor, stats]);

  // Use responsive hook
  const {
    leftContainerRef,
    rightContainerRef,
    visibleLeftItems,
    overflowLeftItems,
    hasLeftOverflow,
    visibleRightItems,
    overflowRightItems,
    hasRightOverflow
  } = useResponsiveStatusBar({
    leftItems: leftStatusItems,
    rightItems: rightStatusItems,
    minWidth: 480
  });

  // Render plugin or core status bar item
  const renderStatusBarItem = (item) => {
    const { id, component: Component, text, icon, tooltip, command, priority, className } = item;

    if (Component) {
      if (typeof Component === 'function' || (typeof Component === 'object' && Component.$$typeof)) {
        return (
          <div key={id} className="status-bar-plugin-item">
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

    return (
      <div
        key={id}
        className={`obsidian-status-bar-item ${command ? 'clickable' : ''} ${className || ''}`}
        title={tooltip}
        onClick={command ? () => handleCommand(command) : undefined}
      >
        {icon && <span className="w-3 h-3 mr-1">{icon}</span>}
        {text && <span>{text}</span>}
      </div>
    );
  };

  const handleCommand = (command) => {
    if (typeof window !== 'undefined' && window.pluginRuntime) {
      window.pluginRuntime.executeCommand(command);
    }
  };

  // Render overflow menu
  const renderOverflowMenu = (items, side = 'left') => {
    if (items.length === 0) return null;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="overflow-menu-button hover:bg-app-panel"
            title="More status items"
          >
            <MoreHorizontal className="w-3 h-3 text-app-muted" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={side === 'left' ? 'start' : 'end'} className="min-w-[180px]">
          <DropdownMenuLabel>Hidden Items</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {items.map((item) => (
            <DropdownMenuItem key={item.id} className="text-xs">
              {item.render()}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="obsidian-status-bar responsive-status-bar">
      {/* Left section */}
      <div ref={leftContainerRef} className="obsidian-status-bar-section responsive-status-bar-section">
        {visibleLeftItems.map((item) => (
          <React.Fragment key={item.id}>
            {item.render()}
          </React.Fragment>
        ))}
        {hasLeftOverflow && renderOverflowMenu(overflowLeftItems, 'left')}
      </div>

      {/* Right section */}
      <div ref={rightContainerRef} className="obsidian-status-bar-section responsive-status-bar-section">
        {hasRightOverflow && renderOverflowMenu(overflowRightItems, 'right')}
        {visibleRightItems.map((item) => (
          <React.Fragment key={item.id}>
            {item.render()}
          </React.Fragment>
        ))}

        {/* Sync Status (CRITICAL - always visible) */}
        <div className="obsidian-status-bar-separator" />
        <SyncStatus />
      </div>
    </div>
  );
}
