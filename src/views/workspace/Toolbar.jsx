import { useLayoutStore } from '../../stores/layout';
import { useViewStore } from '../../stores/views';
import { useEditorGroupStore } from '../../stores/editorGroups';
import { useTabMetaStore, selectGroupDirtyPaths } from '../../stores/tabMeta';
import { useShallow } from 'zustand/shallow';
import { useUIVisibility, useFeatureFlags } from '../../contexts/RemoteConfigContext';
import { ResponsiveTabBar } from '../../components/TabBar/ResponsiveTabBar.jsx';
import {
  PanelLeft,
  Search,
  SquareSplitHorizontal,
  PanelRightOpen,
  PanelRightClose,
  Plus,
} from 'lucide-react';
import platformService from '../../services/platform/PlatformService.js';
import { closeTabWithGuard } from '../../features/tabs/closeGuard';
import TeamCollaborationControls from '../../components/team/TeamCollaborationControls.jsx';

/** Stand-in tab shown when the group is empty. Never enters the store. */
const WELCOME_TAB = '__welcome__';

/** Stand-in tab for full-pane views that replace the editor (calendar…).
    Presentational only — closing it returns to the editor view. */
const CALENDAR_TAB = '__view_calendar__';

/**
 * Toolbar — fixed titlebar with action buttons and responsive tab bar.
 *
 * Left section: New File, New Folder, New Canvas buttons.
 * Center section: responsive tab bar for the focused editor group.
 * Right section: Split View, Right Sidebar toggle, New Tab buttons.
 *
 * Uses useEditorGroupStore for focused group tabs and useLayoutStore
 * for sidebar widths and toggle actions.
 */
export default function Toolbar({
  workspacePath,
  onCreateFile,
  onCreateFolder,
  onCreateCanvas,
  onToggleSplitView,
}) {
  const showLeft = useLayoutStore((s) => s.showLeft);
  const showRight = useLayoutStore((s) => s.showRight);
  const leftW = useLayoutStore((s) => s.leftW);
  const rightW = useLayoutStore((s) => s.rightW);
  const uiVisibility = useUIVisibility();
  const featureFlags = useFeatureFlags();

  // Tabs from the focused editor group
  const focusedGroup = useEditorGroupStore((s) => {
    const { layout, focusedGroupId } = s;
    if (!focusedGroupId) return null;
    const findGroup = (node) => {
      if (node.type === 'group' && node.id === focusedGroupId) return node;
      if (node.type === 'container') {
        for (const child of node.children) {
          const found = findGroup(child);
          if (found) return found;
        }
      }
      return null;
    };
    return findGroup(layout);
  });

  // Single group = tabs in titlebar. Split = each pane has its own tab bar.
  const isSingleGroup = useEditorGroupStore((s) => s.layout.type === 'group');

  const openTabs = focusedGroup?.tabs ?? [];
  const activeFile = focusedGroup?.activeTab ?? null;
  const hasActiveTabs = openTabs.length > 0;

  // With nothing open the titlebar is a bare strip with a lone "+", which
  // reads as broken. Stand in a non-closable Welcome tab so the bar always
  // has something in it. Presentational only — it is never added to the
  // group, so `activeFile` stays null and EditorGroup keeps rendering
  // WelcomeScreen underneath it.
  // Full-pane views (calendar) replace the editor content, so the tab strip
  // must show them as the active "tab" — otherwise it claims a file is open
  // while the calendar is on screen.
  const currentView = useViewStore((s) => s.currentView);
  const isCalendarView = currentView === 'calendar';

  let displayTabs = hasActiveTabs
    ? openTabs
    : [{ path: WELCOME_TAB, name: 'Welcome', closable: false }];
  let displayActiveTab = hasActiveTabs ? activeFile : WELCOME_TAB;
  if (isCalendarView) {
    displayTabs = [...(hasActiveTabs ? openTabs : []), { path: CALENDAR_TAB, name: 'Calendar', kind: 'calendar' }];
    displayActiveTab = CALENDAR_TAB;
  }
  // Dirty flags live in the tabMeta store (off the layout tree) — subscribe
  // to a shallow-compared array of dirty paths for the focused group.
  const dirtyPaths = useTabMetaStore(useShallow(selectGroupDirtyPaths(focusedGroup?.id)));
  const unsavedChanges = new Set(dirtyPaths);

  const handleTabClick = (path) => {
    if (path === WELCOME_TAB || path === CALENDAR_TAB) return; // already showing
    // Clicking a file tab while a full-pane view is up returns to the editor.
    if (useViewStore.getState().currentView !== 'editor') {
      useViewStore.getState().switchView('editor');
    }
    const groupId = useEditorGroupStore.getState().focusedGroupId;
    if (groupId) {
      useEditorGroupStore.getState().setActiveTab(groupId, path);
    }
  };

  const handleTabClose = (path) => {
    if (path === WELCOME_TAB) return; // not closable
    if (path === CALENDAR_TAB) {
      useViewStore.getState().switchView('editor');
      return;
    }
    const groupId = useEditorGroupStore.getState().focusedGroupId;
    if (groupId) {
      closeTabWithGuard(groupId, path);
    }
  };

  // Tab-strip "+" creates a file via the explorer's inline input — make sure
  // the sidebar is visible or the action looks like a no-op.
  const handleNewTab = () => {
    if (!useLayoutStore.getState().showLeft) {
      useLayoutStore.getState().toggleLeft();
    }
    onCreateFile?.();
  };

  // ── Split mode: panes extend to the top, each pane has its own tab bar.
  //    Only render a small floating overlay with action buttons at top-right. ──
  if (!isSingleGroup) {
    return (
      <div
        className="fixed top-0 right-0 flex items-center gap-1 z-50"
        data-tauri-drag-region
        style={{
          height: '32px',
          paddingRight: '8px',
          paddingLeft: '8px',
          backgroundColor: 'rgb(var(--panel) / 0.85)',
          borderBottomLeftRadius: '6px',
          backdropFilter: 'blur(8px)',
        }}
      >
        <TeamCollaborationControls workspacePath={workspacePath} />
        {uiVisibility.toolbar_split_view && hasActiveTabs && (
          <button
            onClick={() => {
              const { focusedGroupId, splitGroup } = useEditorGroupStore.getState();
              if (focusedGroupId) splitGroup(focusedGroupId, 'vertical');
            }}
            className="obsidian-button icon-only small"
            title="Split View"
            data-tauri-drag-region="false"
            data-tour="split-view"
            style={{ pointerEvents: 'auto' }}
          >
            <SquareSplitHorizontal className="w-4 h-4" strokeWidth={1.5} />
          </button>
        )}
        <button
          onClick={() => useLayoutStore.getState().toggleRight()}
          className={`obsidian-button icon-only small ${showRight ? 'active' : ''}`}
          title={showRight ? 'Hide Right Sidebar' : 'Show Right Sidebar'}
          data-tauri-drag-region="false"
          style={{ pointerEvents: 'auto' }}
        >
          {showRight ? (
            <PanelRightClose className="w-4 h-4" strokeWidth={1.5} />
          ) : (
            <PanelRightOpen className="w-4 h-4" strokeWidth={1.5} />
          )}
        </button>
        <button
          onClick={onCreateFile}
          className="obsidian-button icon-only small"
          title="New Tab"
          data-tauri-drag-region="false"
          style={{ pointerEvents: 'auto' }}
        >
          <Plus className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>
    );
  }

  // ── Single-group mode: full toolbar bar with tab bar in the titlebar ──
  return (
    <div
      className="fixed top-0 left-0 right-0 flex items-center justify-between z-50"
      data-tauri-drag-region
      style={{
        height: '40px',
        paddingLeft: platformService.isMacOS() ? '80px' : '8px',
        paddingRight: '8px',
        backgroundColor: 'rgb(var(--panel))',
        borderBottom: '1px solid rgb(var(--border))',
      }}
    >
      {/* Left: sidebar toggle + search (Vellum cluster) */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => useLayoutStore.getState().toggleLeft()}
          className={`obsidian-button icon-only small ${showLeft ? 'active' : ''}`}
          title={showLeft ? 'Hide Sidebar' : 'Show Sidebar'}
          data-tauri-drag-region="false"
          style={{ pointerEvents: 'auto' }}
        >
          <PanelLeft className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button
          onClick={() => useViewStore.getState().togglePanel('showCommandPalette')}
          className="obsidian-button icon-only small"
          title={`Search (${platformService.getModifierSymbol()}+K)`}
          data-tauri-drag-region="false"
          style={{ pointerEvents: 'auto' }}
        >
          <Search className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Center: tab bar in titlebar */}
      <div
        className="absolute flex items-stretch overflow-hidden px-2"
        data-tauri-drag-region
        style={{
          left: showLeft
            ? `${leftW + 53}px`
            : `${platformService.isMacOS() ? 160 : 84}px`,
          right: showRight ? `${rightW + 84}px` : '84px',
          top: 0,
          height: '40px',
        }}
      >
        <ResponsiveTabBar
          tabs={displayTabs}
          activeTab={displayActiveTab}
          onTabClick={handleTabClick}
          onTabClose={handleTabClose}
          onNewTab={handleNewTab}
          unsavedChanges={unsavedChanges}
          reservedSpace={40}
        />
      </div>

      {/* Right: split view toggle, sidebar toggle */}
      <div className="flex items-center gap-1">
        <TeamCollaborationControls workspacePath={workspacePath} />
        {uiVisibility.toolbar_split_view && hasActiveTabs && (
          <button
            onClick={() => {
              const { focusedGroupId, splitGroup } = useEditorGroupStore.getState();
              if (focusedGroupId) splitGroup(focusedGroupId, 'vertical');
            }}
            className="obsidian-button icon-only small"
            title="Split View"
            data-tauri-drag-region="false"
            data-tour="split-view"
            style={{ pointerEvents: 'auto' }}
          >
            <SquareSplitHorizontal className="w-4 h-4" strokeWidth={1.5} />
          </button>
        )}
        <button
          onClick={() => useLayoutStore.getState().toggleRight()}
          className={`obsidian-button icon-only small ${showRight ? 'active' : ''}`}
          title={showRight ? 'Hide Right Sidebar' : 'Show Right Sidebar'}
          data-tauri-drag-region="false"
          style={{ pointerEvents: 'auto' }}
        >
          {showRight ? (
            <PanelRightClose className="w-4 h-4" strokeWidth={1.5} />
          ) : (
            <PanelRightOpen className="w-4 h-4" strokeWidth={1.5} />
          )}
        </button>
      </div>
    </div>
  );
}
