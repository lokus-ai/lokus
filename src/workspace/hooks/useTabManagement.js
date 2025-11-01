import { useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import { getFilename } from '../../utils/pathUtils.js';

/**
 * Maximum number of tabs that can be open simultaneously
 */
const MAX_OPEN_TABS = 10;

/**
 * Custom hook for managing workspace tabs
 *
 * Handles opening, closing, switching, and restoring tabs with support for:
 * - Tab state management (open tabs, active file)
 * - Unsaved changes tracking and confirmation dialogs
 * - Recently closed tabs history
 * - Special tab types (graph view, kanban, gmail, bases, plugins)
 * - Session persistence
 *
 * @param {Object} options - Configuration options
 * @param {string} options.workspacePath - Current workspace path
 * @param {Function} options.onTabContentChange - Callback when tab content changes
 * @param {Function} options.onRefreshFiles - Callback to refresh file tree
 *
 * @returns {Object} Tab management state and handlers
 */
export function useTabManagement({ workspacePath, onTabContentChange, onRefreshFiles }) {
  // Tab state
  const [openTabs, setOpenTabs] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [unsavedChanges, setUnsavedChanges] = useState(new Set());
  const [recentlyClosedTabs, setRecentlyClosedTabs] = useState([]);

  // Refs for debouncing and dialog state
  const lastCloseTimeRef = useRef(0);
  const isShowingDialogRef = useRef(false);
  const currentlyClosingPathRef = useRef(null);

  // State ref for accessing current state in callbacks
  const stateRef = useRef({});
  stateRef.current = {
    activeFile,
    openTabs,
    unsavedChanges,
  };

  /**
   * Gets display name for special tab types
   * @private
   */
  const getTabDisplayName = useCallback((tabPath) => {
    if (tabPath === '__graph__') return 'Graph View';
    if (tabPath === '__kanban__') return 'Task Board';
    if (tabPath === '__gmail__') return 'Gmail';
    if (tabPath === '__bases__') return 'Bases';
    if (tabPath.startsWith('__plugin_')) {
      return 'Plugin';
    }
    return tabPath.split('/').pop();
  }, []);

  /**
   * Opens a file or special view in a new tab
   * Moves tab to front if already open, respects MAX_OPEN_TABS limit
   *
   * @param {Object} file - File or view to open
   * @param {string} file.path - File path or special view identifier
   * @param {string} [file.name] - Display name for the tab
   * @param {number} [file.lineNumber] - Optional line number to jump to
   * @param {number} [file.column] - Optional column to jump to
   * @param {boolean} [file.is_directory] - Whether this is a directory
   * @param {Object} [file.plugin] - Plugin metadata for plugin tabs
   */
  const openTab = useCallback((file) => {
    // Handle search result format with line numbers
    if (file.path && file.lineNumber !== undefined) {
      const filePath = file.path;
      const fileName = getFilename(filePath);

      setOpenTabs(prevTabs => {
        const newTabs = prevTabs.filter(t => t.path !== filePath);
        newTabs.unshift({ path: filePath, name: fileName });
        if (newTabs.length > MAX_OPEN_TABS) {
          newTabs.pop();
        }
        return newTabs;
      });
      setActiveFile(filePath);

      // Notify parent to jump to line (handled by parent component with editor ref)
      if (onTabContentChange) {
        onTabContentChange({ type: 'jumpToLine', file: filePath, lineNumber: file.lineNumber, column: file.column });
      }
      return;
    }

    // Handle regular file format
    if (file.is_directory) return;

    setOpenTabs(prevTabs => {
      const newTabs = prevTabs.filter(t => t.path !== file.path);
      const fileName = getFilename(file.name || file.path);

      // Support for plugin tabs with metadata
      const tabData = file.plugin
        ? { path: file.path, name: fileName, plugin: file.plugin }
        : { path: file.path, name: fileName };

      newTabs.unshift(tabData);
      if (newTabs.length > MAX_OPEN_TABS) {
        newTabs.pop();
      }
      return newTabs;
    });
    setActiveFile(file.path);
  }, [onTabContentChange]);

  /**
   * Opens a special view tab (graph, kanban, gmail, bases)
   *
   * @param {string} viewType - Type of view ('graph', 'kanban', 'gmail', 'bases')
   */
  const openSpecialView = useCallback((viewType) => {
    const viewConfigs = {
      graph: { path: '__graph__', name: 'Graph View' },
      kanban: { path: '__kanban__', name: 'Task Board' },
      gmail: { path: '__gmail__', name: 'Gmail' },
      bases: { path: '__bases__', name: 'Bases' },
    };

    const config = viewConfigs[viewType];
    if (!config) return;

    setOpenTabs(prevTabs => {
      const newTabs = prevTabs.filter(t => t.path !== config.path);
      newTabs.unshift(config);
      if (newTabs.length > MAX_OPEN_TABS) {
        newTabs.pop();
      }
      return newTabs;
    });
    setActiveFile(config.path);
  }, []);

  /**
   * Opens a plugin detail tab
   *
   * @param {Object} plugin - Plugin metadata
   * @param {string} plugin.id - Plugin identifier
   * @param {string} plugin.name - Plugin display name
   */
  const openPluginTab = useCallback((plugin) => {
    const pluginPath = `__plugin_${plugin.id}__`;
    const pluginName = `${plugin.name} Plugin`;

    setOpenTabs(prevTabs => {
      const newTabs = prevTabs.filter(t => t.path !== pluginPath);
      newTabs.unshift({ path: pluginPath, name: pluginName, plugin });
      if (newTabs.length > MAX_OPEN_TABS) {
        newTabs.pop();
      }
      return newTabs;
    });
    setActiveFile(pluginPath);
  }, []);

  /**
   * Closes a tab, with confirmation if there are unsaved changes
   * Automatically switches to adjacent tab if closing active tab
   *
   * @param {string} path - Path of tab to close
   */
  const closeTab = useCallback(async (path) => {
    // Prevent closing the same tab multiple times
    if (currentlyClosingPathRef.current === path) {
      console.log('[TabClose] Already processing close for:', path);
      return;
    }

    // Prevent multiple dialogs from showing
    if (isShowingDialogRef.current) {
      console.log('[TabClose] Dialog already showing, ignoring close request');
      return;
    }

    // Global debounce: ignore ANY tab close within 200ms of the last one
    const now = Date.now();
    if (now - lastCloseTimeRef.current < 200) {
      console.log('[TabClose] Debounce: ignoring close within 200ms');
      return;
    }
    lastCloseTimeRef.current = now;

    console.log('[TabClose] Starting close process for:', path);

    const performClose = () => {
      setOpenTabs(prevTabs => {
        const tabIndex = prevTabs.findIndex(t => t.path === path);
        const closedTab = prevTabs.find(t => t.path === path);
        const newTabs = prevTabs.filter(t => t.path !== path);

        // Save the closed tab to recently closed list (max 10 items)
        // Don't track special tabs like graph, kanban
        if (closedTab && !closedTab.path.startsWith('__')) {
          setRecentlyClosedTabs(prev => {
            const newClosed = [{ ...closedTab, closedAt: Date.now() }, ...prev.slice(0, 9)];
            return newClosed;
          });
        }

        // Switch to adjacent tab if closing active tab
        if (stateRef.current.activeFile === path) {
          if (newTabs.length === 0) {
            setActiveFile(null);
          } else {
            const newActiveIndex = Math.max(0, tabIndex - 1);
            setActiveFile(newTabs[newActiveIndex].path);
          }
        }
        return newTabs;
      });

      // Clear unsaved changes for this tab
      setUnsavedChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(path);
        return newSet;
      });
    };

    // Check for unsaved changes and show confirmation dialog
    if (stateRef.current.unsavedChanges.has(path)) {
      try {
        console.log('[TabClose] Showing unsaved changes dialog for:', path);
        currentlyClosingPathRef.current = path;
        isShowingDialogRef.current = true;

        const confirmed = await confirm("You have unsaved changes. Close without saving?", {
          title: "Unsaved Changes",
          type: "warning",
        });

        console.log('[TabClose] Dialog result:', confirmed ? 'OK' : 'Cancel');
        if (confirmed) {
          console.log('[TabClose] User confirmed, closing tab');
          performClose();
        } else {
          console.log('[TabClose] User cancelled, keeping tab open');
        }
      } catch (error) {
        console.error('[TabClose] Error showing dialog:', error);
      } finally {
        console.log('[TabClose] Resetting dialog flags');
        isShowingDialogRef.current = false;
        currentlyClosingPathRef.current = null;
      }
    } else {
      currentlyClosingPathRef.current = path;
      performClose();
      currentlyClosingPathRef.current = null;
    }
  }, []);

  /**
   * Switches to a different tab
   *
   * @param {string} path - Path of tab to switch to
   */
  const switchTab = useCallback((path) => {
    setActiveFile(path);
  }, []);

  /**
   * Navigates to the next tab in the list
   * Wraps around to first tab if at the end
   */
  const nextTab = useCallback(() => {
    if (stateRef.current.openTabs.length <= 1) return;
    const currentIndex = stateRef.current.openTabs.findIndex(tab => tab.path === stateRef.current.activeFile);
    const nextIndex = (currentIndex + 1) % stateRef.current.openTabs.length;
    setActiveFile(stateRef.current.openTabs[nextIndex].path);
  }, []);

  /**
   * Navigates to the previous tab in the list
   * Wraps around to last tab if at the beginning
   */
  const previousTab = useCallback(() => {
    if (stateRef.current.openTabs.length <= 1) return;
    const currentIndex = stateRef.current.openTabs.findIndex(tab => tab.path === stateRef.current.activeFile);
    const prevIndex = currentIndex === 0 ? stateRef.current.openTabs.length - 1 : currentIndex - 1;
    setActiveFile(stateRef.current.openTabs[prevIndex].path);
  }, []);

  /**
   * Reopens the most recently closed tab
   * Removes it from the recently closed list
   */
  const reopenClosedTab = useCallback(() => {
    if (recentlyClosedTabs.length === 0) return;

    const [mostRecentTab, ...remaining] = recentlyClosedTabs;

    // Remove from recently closed list
    setRecentlyClosedTabs(remaining);

    // Reopen the tab
    openTab(mostRecentTab);
  }, [recentlyClosedTabs, openTab]);

  /**
   * Marks a file as having unsaved changes
   *
   * @param {string} path - Path of file with unsaved changes
   */
  const markUnsaved = useCallback((path) => {
    setUnsavedChanges(prev => {
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, []);

  /**
   * Marks a file as saved (no unsaved changes)
   *
   * @param {string} path - Path of saved file
   */
  const markSaved = useCallback((path) => {
    setUnsavedChanges(prev => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  /**
   * Loads session state from workspace
   * Restores previously open tabs and active file
   */
  const loadSession = useCallback(async () => {
    if (!workspacePath) return;

    try {
      const session = await invoke("load_session_state", { workspacePath });

      if (session && session.open_tabs) {
        const tabsWithNames = session.open_tabs.map(p => ({
          path: p,
          name: getTabDisplayName(p)
        }));

        setOpenTabs(tabsWithNames);

        if (tabsWithNames.length > 0) {
          setActiveFile(tabsWithNames[0].path);
        }
      }
    } catch (error) {
      console.error('[TabManagement] Failed to load session:', error);
    }
  }, [workspacePath, getTabDisplayName]);

  /**
   * Saves current session state to workspace
   * Persists open tabs for restoration on next launch
   */
  const saveSession = useCallback(async () => {
    if (!workspacePath) return;

    try {
      const tabPaths = openTabs.map(t => t.path);
      await invoke("save_session_state", {
        workspacePath,
        openTabs: tabPaths,
        expandedFolders: [] // Handled by parent component
      });
    } catch (error) {
      console.error('[TabManagement] Failed to save session:', error);
    }
  }, [workspacePath, openTabs]);

  /**
   * Closes all tabs
   */
  const closeAllTabs = useCallback(() => {
    // Check if any tabs have unsaved changes
    const hasUnsaved = openTabs.some(tab => unsavedChanges.has(tab.path));

    if (hasUnsaved) {
      // Would need to show confirmation dialog
      // For now, close tabs that don't have unsaved changes
      setOpenTabs(prevTabs => prevTabs.filter(tab => unsavedChanges.has(tab.path)));
      if (openTabs.length > 0 && !unsavedChanges.has(activeFile)) {
        setActiveFile(openTabs.find(tab => unsavedChanges.has(tab.path))?.path || null);
      }
    } else {
      setOpenTabs([]);
      setActiveFile(null);
    }
  }, [openTabs, unsavedChanges, activeFile]);

  /**
   * Closes all tabs except the specified one
   *
   * @param {string} exceptPath - Path of tab to keep open
   */
  const closeOtherTabs = useCallback(async (exceptPath) => {
    const tabsToClose = openTabs.filter(tab => tab.path !== exceptPath);

    for (const tab of tabsToClose) {
      if (unsavedChanges.has(tab.path)) {
        // Show confirmation for unsaved changes
        try {
          const confirmed = await confirm(
            `${tab.name} has unsaved changes. Close without saving?`,
            {
              title: "Unsaved Changes",
              type: "warning",
            }
          );

          if (!confirmed) continue;
        } catch (error) {
          console.error('[TabManagement] Error showing dialog:', error);
          continue;
        }
      }
    }

    // Close all tabs except the specified one
    setOpenTabs(prevTabs => prevTabs.filter(tab => tab.path === exceptPath));
    setActiveFile(exceptPath);
    setUnsavedChanges(prev => {
      const newSet = new Set();
      if (prev.has(exceptPath)) {
        newSet.add(exceptPath);
      }
      return newSet;
    });
  }, [openTabs, unsavedChanges]);

  /**
   * Gets tab metadata by path
   *
   * @param {string} path - Tab path
   * @returns {Object|null} Tab metadata or null if not found
   */
  const getTab = useCallback((path) => {
    return openTabs.find(tab => tab.path === path) || null;
  }, [openTabs]);

  /**
   * Checks if a tab is currently open
   *
   * @param {string} path - Tab path to check
   * @returns {boolean} True if tab is open
   */
  const isTabOpen = useCallback((path) => {
    return openTabs.some(tab => tab.path === path);
  }, [openTabs]);

  return {
    // State
    openTabs,
    activeFile,
    unsavedChanges,
    recentlyClosedTabs,

    // Tab operations
    openTab,
    openSpecialView,
    openPluginTab,
    closeTab,
    switchTab,
    nextTab,
    previousTab,
    reopenClosedTab,
    closeAllTabs,
    closeOtherTabs,

    // Unsaved changes
    markUnsaved,
    markSaved,

    // Session management
    loadSession,
    saveSession,

    // Utilities
    getTab,
    isTabOpen,
    getTabDisplayName,
  };
}
