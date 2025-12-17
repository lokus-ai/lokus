import React, { useRef, useEffect, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { X, Maximize2, Copy } from 'lucide-react';
import Editor from '../../editor';
import Canvas from '../../views/Canvas.jsx';
import PluginDetail from '../../views/PluginDetail.jsx';
import { ProfessionalGraphView } from '../../views/ProfessionalGraphView.jsx';
import KanbanBoard from '../../components/KanbanBoard.jsx';
import BasesView from '../../bases/BasesView.jsx';

const EditorPane = ({
  pane,
  isActive,
  openTabs,
  activeFile,
  onFileChange,
  onTabClose,
  unsavedChanges,
  editorContent,
  editorTitle,
  onEditorChange,
  onTitleChange,
  onSave,
  onFocus,
  onClose,
  editorRef
}) => {
  const paneRef = useRef(null);
  const localEditorRef = useRef(null);
  const [localContent, setLocalContent] = useState('');
  const [localTitle, setLocalTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Make this pane droppable for tabs
  const { setNodeRef, isOver } = useDroppable({
    id: `pane-${pane.id}`,
    data: { type: 'pane', paneId: pane.id }
  });

  // Load content when file changes
  useEffect(() => {
    if (pane.file && pane.file !== activeFile) {
      loadFileContent(pane.file);
    } else if (pane.file === activeFile) {
      setLocalContent(editorContent);
      setLocalTitle(editorTitle);
    }
  }, [pane.file, activeFile, editorContent, editorTitle]);

  const loadFileContent = async (filePath) => {
    if (!filePath) return;
    
    setIsLoading(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const content = await invoke('read_file_content', { path: filePath });
      const fileName = filePath.split('/').pop();
      
      setLocalContent(content);
      setLocalTitle(fileName?.replace(/\.md$/, '') || '');
    } catch (error) {
      setLocalContent('');
      setLocalTitle('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocalContentChange = (newContent) => {
    setLocalContent(newContent);
    if (isActive) {
      onEditorChange(newContent);
    }
  };

  const handleLocalTitleChange = (newTitle) => {
    setLocalTitle(newTitle);
    if (isActive) {
      onTitleChange(newTitle);
    }
  };

  const handlePaneClick = () => {
    if (!isActive) {
      onFocus();
      if (pane.file && pane.file !== activeFile) {
        onFileChange(pane.file);
      }
    }
  };

  const handleSavePane = async () => {
    if (isActive) {
      onSave();
    } else {
      // Handle save for inactive pane
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('write_file_content', { 
          path: pane.file, 
          content: localContent 
        });
      } catch { }
    }
  };

  const getFileDisplayName = () => {
    if (!pane.file) return 'Empty Pane';
    const tab = openTabs.find(t => t.path === pane.file);
    return tab?.name || pane.file.split('/').pop() || 'Unknown File';
  };

  const renderContent = () => {
    if (!pane.file) {
      return (
        <div className="flex-1 flex items-center justify-center text-app-muted">
          <div className="text-center">
            <Maximize2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Drag a tab here to split</p>
          </div>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-app-accent border-t-transparent"></div>
        </div>
      );
    }

    // Handle special views
    if (pane.file === '__kanban__') {
      return (
        <div className="flex-1 bg-app-panel overflow-hidden">
          <KanbanBoard
            workspacePath={window.__LOKUS_WORKSPACE_PATH__ || ''}
            onFileOpen={onFileChange}
          />
        </div>
      );
    }

    if (pane.file === '__bases__') {
      return (
        <div className="flex-1 bg-app-panel overflow-hidden">
          <BasesView isVisible={true} onFileOpen={onFileOpen} />
        </div>
      );
    }

    if (pane.file.endsWith('.canvas')) {
      return (
        <div className="flex-1 overflow-hidden">
          <Canvas
            canvasPath={pane.file}
            canvasName={getFileDisplayName()}
            onSave={async (canvasData) => {
              try {
                const { invoke } = await import('@tauri-apps/api/core');
                await invoke('write_file_content', { 
                  path: pane.file, 
                  content: JSON.stringify(canvasData, null, 2) 
                });
              } catch { }
            }}
            onContentChange={() => {
              // Mark as unsaved
            }}
            initialData={null}
          />
        </div>
      );
    }

    if (pane.file === '__graph__') {
      return (
        <div className="flex-1 h-full overflow-hidden">
          <ProfessionalGraphView 
            isVisible={true}
            workspacePath={window.__LOKUS_WORKSPACE_PATH__ || ''}
            onOpenFile={onFileChange}
          />
        </div>
      );
    }

    if (pane.file.startsWith('__plugin_')) {
      const activeTab = openTabs.find(tab => tab.path === pane.file);
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

    // Regular file editor
    return (
      <div className="flex-1 p-8 md:p-12 overflow-y-auto">
        <div className="max-w-full mx-auto h-full">
          <input
            type="text"
            value={localTitle}
            onChange={(e) => handleLocalTitleChange(e.target.value)}
            className="w-full bg-transparent text-4xl font-bold mb-6 outline-none text-app-text"
          />
          <Editor
            ref={isActive ? editorRef : localEditorRef}
            content={localContent}
            onContentChange={handleLocalContentChange}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        paneRef.current = node;
      }}
      onClick={handlePaneClick}
      className={`editor-pane ${isActive ? 'active' : ''} ${isOver ? 'drop-over' : ''}`}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--app-panel)',
        border: isActive ? '2px solid var(--app-accent)' : '1px solid var(--app-border)',
        borderRadius: '8px',
        overflow: 'hidden',
        minHeight: '200px',
      }}
    >
      {/* Pane header */}
      <div className="pane-header">
        <div className="flex items-center justify-between px-4 py-2 bg-app-surface border-b border-app-border">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-2 h-2 rounded-full bg-app-accent opacity-60"></div>
            <span className="text-sm font-medium text-app-text truncate">
              {getFileDisplayName()}
            </span>
            {unsavedChanges.has(pane.file) && (
              <div className="w-1.5 h-1.5 rounded-full bg-app-accent"></div>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {/* Save button for inactive panes */}
            {!isActive && unsavedChanges.has(pane.file) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSavePane();
                }}
                className="p-1 rounded hover:bg-app-hover text-app-muted hover:text-app-text"
                title="Save"
              >
                <Copy className="w-3 h-3" />
              </button>
            )}
            
            {/* Close pane button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 rounded hover:bg-app-hover text-app-muted hover:text-app-text"
              title="Close Pane"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Pane content */}
      {renderContent()}

      {/* Drop overlay */}
      {isOver && (
        <div className="absolute inset-0 bg-app-accent bg-opacity-10 border-2 border-app-accent border-dashed rounded-lg pointer-events-none z-10 flex items-center justify-center">
          <div className="text-app-accent font-medium">Drop tab here</div>
        </div>
      )}
    </div>
  );
};

export default EditorPane;