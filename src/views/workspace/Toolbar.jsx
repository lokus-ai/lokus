import React from 'react';
import { useLayoutStore } from '../../stores/layout';
import { useEditorGroupStore } from '../../stores/editorGroups';
import { useUIVisibility, useFeatureFlags } from '../../contexts/RemoteConfigContext';
import { ResponsiveTabBar } from '../../components/TabBar/ResponsiveTabBar';
import {
  FilePlus as FilePlusCorner, FolderOpen, SquareKanban,
  SquareSplitHorizontal, PanelRightOpen, PanelRightClose, Plus,
} from 'lucide-react';
import platformService from '../../services/platform/PlatformService';

/**
 * Toolbar — fixed titlebar with action buttons and responsive tab bar.
 */
export default function Toolbar({ onCreateFile, onCreateFolder, onCreateCanvas }) {
  const showLeft = useLayoutStore((s) => s.showLeft);
  const showRight = useLayoutStore((s) => s.showRight);
  const leftW = useLayoutStore((s) => s.leftW);
  const rightW = useLayoutStore((s) => s.rightW);
  const uiVisibility = useUIVisibility();
  const featureFlags = useFeatureFlags();

  // Get tabs from focused group
  const focusedGroup = useEditorGroupStore((s) => s.getFocusedGroup());
  const tabs = focusedGroup?.tabs || [];
  const activeTab = focusedGroup?.activeTab || null;
  const focusedGroupId = useEditorGroupStore((s) => s.focusedGroupId);

  const handleTabClick = (path) => {
    if (focusedGroupId) {
      useEditorGroupStore.getState().setActiveTab(focusedGroupId, path);
    }
  };

  const handleTabClose = (path) => {
    if (focusedGroupId) {
      const tab = tabs.find((t) => t.path === path);
      if (tab) useEditorGroupStore.getState().addRecentlyClosed(tab);
      useEditorGroupStore.getState().removeTab(focusedGroupId, path);
    }
  };

  const handleSplit = () => {
    if (focusedGroupId) {
      useEditorGroupStore.getState().splitGroup(focusedGroupId, 'vertical');
    }
  };

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

      {/* Center: responsive tab bar */}
      <div
        className="absolute flex items-center overflow-hidden px-2"
        style={{
          left: showLeft ? `${leftW + 57}px` : `${platformService.isMacOS() ? 200 : 120}px`,
          right: showRight ? `${rightW + 120}px` : '120px',
          top: 0,
          height: '32px',
        }}
      >
        <ResponsiveTabBar
          tabs={tabs}
          activeTab={activeTab}
          onTabClick={handleTabClick}
          onTabClose={handleTabClose}
          reservedSpace={0}
        />
      </div>

      {/* Right: split, sidebar toggle, new tab */}
      <div className="flex items-center gap-1">
        {uiVisibility.toolbar_split_view && (
          <button
            onClick={handleSplit}
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
          {showRight ? <PanelRightClose className="w-5 h-5" strokeWidth={2} /> : <PanelRightOpen className="w-5 h-5" strokeWidth={2} />}
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
