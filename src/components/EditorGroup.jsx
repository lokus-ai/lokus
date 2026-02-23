import React, { useRef, useCallback } from 'react';
import Editor from '../editor';
import Canvas from '../views/Canvas';
import { useEditorGroupStore } from '../stores/editorGroups';
import { ResponsiveTabBar } from './TabBar/ResponsiveTabBar';
import { canvasManager } from '../core/canvas/manager';
import DropZoneOverlay, { DropZoneHighlight } from './DropZoneOverlay';

/**
 * EditorGroup — a single editor pane with its own tabs, content cache,
 * and TipTap instance. Reads all state from useEditorGroupStore.
 *
 * The root cause of tab cross-contamination was local useState for content.
 * Now content is stored per-tab in the group's contentByTab cache.
 */
export default function EditorGroup({ group, isFocused, workspacePath }) {
  const editorRef = useRef(null);

  const activeFile = group.activeTab;
  const tabs = group.tabs;
  const cachedContent = group.contentByTab?.[activeFile];

  const handleTabClick = useCallback((path) => {
    useEditorGroupStore.getState().setActiveTab(group.id, path);
  }, [group.id]);

  const handleTabClose = useCallback((path) => {
    const tab = tabs.find((t) => t.path === path);
    if (tab) {
      useEditorGroupStore.getState().addRecentlyClosed(tab);
    }
    useEditorGroupStore.getState().removeTab(group.id, path);
  }, [group.id, tabs]);

  const handleFocus = useCallback(() => {
    useEditorGroupStore.getState().setFocusedGroupId(group.id);
  }, [group.id]);

  const handleContentChange = useCallback((content) => {
    useEditorGroupStore.getState().setTabContent(group.id, activeFile, {
      prosemirrorDoc: content,
      dirty: true,
    });
    useEditorGroupStore.getState().markTabDirty(group.id, activeFile, true);
  }, [group.id, activeFile]);

  const renderContent = () => {
    if (!activeFile) {
      return (
        <div className="flex-1 flex items-center justify-center text-app-muted">
          No file selected
        </div>
      );
    }

    // Canvas files
    if (activeFile.endsWith('.canvas')) {
      return (
        <div className="flex-1 overflow-hidden">
          <Canvas
            canvasPath={activeFile}
            canvasName={tabs.find(tab => tab.path === activeFile)?.name}
            onSave={async (canvasData) => {
              try {
                await canvasManager.saveCanvas(activeFile, canvasData);
                useEditorGroupStore.getState().markTabDirty(group.id, activeFile, false);
              } catch { /* ignore */ }
            }}
            onChange={() => {
              useEditorGroupStore.getState().markTabDirty(group.id, activeFile, true);
            }}
          />
        </div>
      );
    }

    // Regular markdown/text editor
    return (
      <div className="flex-1 p-4 overflow-y-auto">
        <Editor
          key={`editor-${group.id}-${activeFile}`}
          ref={editorRef}
          content={cachedContent?.prosemirrorDoc || ''}
          onContentChange={handleContentChange}
        />
      </div>
    );
  };

  return (
    <div
      className={`flex flex-col h-full relative ${isFocused ? 'ring-2 ring-app-accent' : ''}`}
      onClick={handleFocus}
    >
      {/* Tab Bar */}
      <ResponsiveTabBar
        tabs={tabs}
        activeTab={activeFile}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
        groupId={group.id}
      />

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {renderContent()}
      </div>
    </div>
  );
}
