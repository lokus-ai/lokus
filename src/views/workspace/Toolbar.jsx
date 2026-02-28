import { useLayoutStore } from '../../stores/layout';
import { useEditorGroupStore } from '../../stores/editorGroups';
import { useUIVisibility, useFeatureFlags } from '../../contexts/RemoteConfigContext';
import { ResponsiveTabBar } from '../../components/TabBar/ResponsiveTabBar.jsx';
import {
  FilePlus as FilePlusCorner,
  FolderOpen,
  SquareKanban,
  SquareSplitHorizontal,
  PanelRightOpen,
  PanelRightClose,
  Plus,
} from 'lucide-react';
import platformService from '../../services/platform/PlatformService.js';

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
  const unsavedChanges = new Set(
    Object.entries(focusedGroup?.contentByTab ?? {})
      .filter(([, data]) => data?.dirty)
      .map(([path]) => path)
  );

  const handleTabClick = (path) => {
    const groupId = useEditorGroupStore.getState().focusedGroupId;
    if (groupId) {
      useEditorGroupStore.getState().setActiveTab(groupId, path);
    }
  };

  const handleTabClose = (path) => {
    const groupId = useEditorGroupStore.getState().focusedGroupId;
    if (groupId) {
      useEditorGroupStore.getState().removeTab(groupId, path);
    }
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
            <SquareSplitHorizontal className="w-5 h-5" strokeWidth={2} />
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
            <PanelRightClose className="w-5 h-5" strokeWidth={2} />
          ) : (
            <PanelRightOpen className="w-5 h-5" strokeWidth={2} />
          )}
        </button>
        <button
          onClick={onCreateFile}
          className="obsidian-button icon-only small"
          title="New Tab"
          data-tauri-drag-region="false"
          style={{ pointerEvents: 'auto' }}
        >
          <Plus className="w-5 h-5" strokeWidth={2.5} />
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
        height: '29px',
        paddingLeft: platformService.isMacOS() ? '80px' : '8px',
        paddingRight: '8px',
        backgroundColor: 'rgb(var(--panel))',
        borderBottom: '1px solid rgb(var(--border))',
      }}
    >
      {/* Left: action buttons */}
      <div className="flex items-center gap-1">
        {uiVisibility.toolbar_new_file && (
          <button
            onClick={onCreateFile}
            className="obsidian-button icon-only small"
            title={`New File (${platformService.getModifierSymbol()}+N)`}
            data-tauri-drag-region="false"
            data-tour="create-note"
            style={{ pointerEvents: 'auto' }}
          >
            <FilePlusCorner className="w-5 h-5" strokeWidth={2} />
          </button>
        )}
        {uiVisibility.toolbar_new_folder && (
          <button
            onClick={onCreateFolder}
            className="obsidian-button icon-only small"
            title={`New Folder (${platformService.getModifierSymbol()}+Shift+N)`}
            data-tauri-drag-region="false"
            style={{ pointerEvents: 'auto' }}
          >
            <FolderOpen className="w-5 h-5" strokeWidth={2} />
          </button>
        )}
        {featureFlags.enable_canvas && uiVisibility.toolbar_new_canvas && (
          <button
            onClick={onCreateCanvas}
            className="obsidian-button icon-only small"
            title="New Canvas"
            data-tauri-drag-region="false"
            style={{ pointerEvents: 'auto' }}
          >
            <SquareKanban className="w-5 h-5" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Center: tab bar in titlebar */}
      <div
        className="absolute flex items-center overflow-hidden px-2"
        data-tauri-drag-region
        style={{
          left: showLeft
            ? `${leftW + 57}px`
            : `${platformService.isMacOS() ? 200 : 120}px`,
          right: showRight ? `${rightW + 120}px` : '120px',
          top: 0,
          height: '32px',
        }}
      >
        <ResponsiveTabBar
          tabs={openTabs}
          activeTab={activeFile}
          onTabClick={handleTabClick}
          onTabClose={handleTabClose}
          unsavedChanges={unsavedChanges}
          reservedSpace={0}
        />
      </div>

      {/* Right: split view toggle, sidebar toggle, new tab */}
      <div className="flex items-center gap-1">
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
            <SquareSplitHorizontal className="w-5 h-5" strokeWidth={2} />
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
            <PanelRightClose className="w-5 h-5" strokeWidth={2} />
          ) : (
            <PanelRightOpen className="w-5 h-5" strokeWidth={2} />
          )}
        </button>
        <button
          onClick={onCreateFile}
          className="obsidian-button icon-only small"
          title="New Tab"
          data-tauri-drag-region="false"
          style={{ pointerEvents: 'auto' }}
        >
          <Plus className="w-5 h-5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
