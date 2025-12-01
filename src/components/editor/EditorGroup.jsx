import React, { useRef, useState } from 'react';
import Editor from "../../editor";
import Canvas from "../../views/Canvas";
import KanbanBoard from "../features/KanbanBoard.jsx";
import Gmail from "../../views/Gmail";
import BasesView from "../../bases/BasesView";
import PluginDetail from "../features/Plugins/PluginDetail";
import { ProfessionalGraphView } from "../../views/ProfessionalGraphView";
import DropZoneOverlay, { DropZoneHighlight } from "../ui/DropZoneOverlay.jsx";

/**
 * EditorGroup - A single editor pane that can contain multiple tabs
 * This is the core building block of the VSCode-style editor groups system
 */
export default function EditorGroup({
  group,
  isFocused,
  isDragActive,
  dropTarget,
  fileTree,
  workspacePath,
  unsavedChanges,
  onTabClick,
  onTabClose,
  onTabDragStart,
  onTabDragEnd,
  onDropZoneHover,
  onDrop,
  onContentChange,
  onFocus,
  onFileOpen,
  canvasManager,
  openTabs,
  TabBarComponent, // Pass the TabBar component from Workspace
}) {
  const [editorContent, setEditorContent] = useState('');
  const [editorTitle, setEditorTitle] = useState('');
  const editorRef = useRef(null);
  const scrollRef = useRef(null);

  const activeFile = group.activeTab;
  const tabs = group.tabs;

  // Determine if we should show drop zones
  const showDropZones = isDragActive;

  // Render the active file's content
  const renderContent = () => {
    if (!activeFile) {
      return (
        <div className="flex-1 flex items-center justify-center text-app-muted">
          No file selected
        </div>
      );
    }

    // Handle special views
    if (activeFile.endsWith('.canvas')) {
      return (
        <div className="flex-1 overflow-hidden">
          <Canvas
            canvasPath={activeFile}
            canvasName={tabs.find(tab => tab.path === activeFile)?.name}
            onSave={async (canvasData) => {
              try {
                await canvasManager.saveCanvas(activeFile, canvasData);
                onContentChange && onContentChange(activeFile, false); // Mark as saved
              } catch (error) {
                console.error('Failed to save canvas:', error);
              }
            }}
            onChange={() => {
              onContentChange && onContentChange(activeFile, true); // Mark as unsaved
            }}
          />
        </div>
      );
    }

    if (activeFile.endsWith('.kanban')) {
      return (
        <div className="flex-1 overflow-hidden">
          <KanbanBoard
            workspacePath={workspacePath}
            boardPath={activeFile}
            onFileOpen={onFileOpen}
          />
        </div>
      );
    }

    if (activeFile === '__graph__') {
      return (
        <div className="h-full">
          <ProfessionalGraphView
            isVisible={true}
            fileTree={fileTree}
            activeFile={activeFile}
            onFileOpen={onFileOpen}
            workspacePath={workspacePath}
            onOpenFile={onFileOpen}
          />
        </div>
      );
    }

    if (activeFile === '__gmail__') {
      return (
        <div className="h-full">
          <Gmail workspacePath={workspacePath} />
        </div>
      );
    }

    if (activeFile === '__bases__') {
      return (
        <div className="h-full">
          <BasesView isVisible={true} onFileOpen={onFileOpen} />
        </div>
      );
    }

    if (activeFile.startsWith('__plugin_')) {
      const activeTab = tabs.find(tab => tab.path === activeFile);
      return (
        <div className="flex-1 overflow-hidden">
          {activeTab?.plugin ? (
            <PluginDetail plugin={activeTab.plugin} />
          ) : (
            <div>Plugin not found</div>
          )}
        </div>
      );
    }

    // Regular markdown/text editor
    return (
      <div
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto"
      >
        <input
          type="text"
          value={editorTitle}
          onChange={(e) => {
            setEditorTitle(e.target.value);
            onContentChange && onContentChange(activeFile, true);
          }}
          className="w-full bg-transparent text-4xl font-bold mb-6 outline-none text-app-text"
          placeholder="Untitled"
        />
        <Editor
          key={`editor-${group.id}-${activeFile}`}
          ref={editorRef}
          content={editorContent}
          onContentChange={(content) => {
            setEditorContent(content);
            onContentChange && onContentChange(activeFile, true);
          }}
        />
      </div>
    );
  };

  return (
    <div
      className={`flex flex-col h-full relative ${
        isFocused ? 'ring-2 ring-app-accent' : ''
      }`}
      onClick={() => onFocus && onFocus(group.id)}
    >
      {/* Tab Bar */}
      {TabBarComponent && (
        <TabBarComponent
          tabs={tabs}
          activeTab={activeFile}
          onTabClick={(path) => onTabClick(group.id, path)}
          onTabClose={(path) => onTabClose(group.id, path)}
          unsavedChanges={unsavedChanges}
          onDragStart={(tab) => onTabDragStart && onTabDragStart(group.id, tab)}
          onDragEnd={() => onTabDragEnd && onTabDragEnd()}
          groupId={group.id}
        />
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {renderContent()}

        {/* Drop Zone Overlay */}
        {showDropZones && (
          <>
            <DropZoneOverlay
              isVisible={true}
              groupId={group.id}
              onDropZoneHover={onDropZoneHover}
              onDrop={onDrop}
            />
            {dropTarget && dropTarget.groupId === group.id && (
              <DropZoneHighlight dropTarget={dropTarget} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
