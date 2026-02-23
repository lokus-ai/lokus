import { Suspense } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  Loading,
  LazyGraph,
  LazyCanvas,
  LazyPDFViewer,
  LazyPluginDetail,
  LazyCalendarView,
  LazyImageViewer,
} from "../../components/OptimizedWrapper";
import Editor from "../../editor";
import KanbanBoard from "../../components/KanbanBoard.jsx";
import BasesView from "../../bases/BasesView.jsx";
import Breadcrumbs from "../../components/FileTree/Breadcrumbs.jsx";
import { Network } from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "../../components/ui/context-menu.jsx";
import { formatAccelerator } from "../../core/shortcuts/registry.js";
import { isDesktop } from "../../platform/index.js";
import { isImageFile } from "../../utils/imageUtils.js";
import { getFilename } from "../../utils/pathUtils.js";
import { canvasManager } from "../../core/canvas/manager.js";
import { WelcomeScreen } from "./WelcomeScreen.jsx";
import { invoke } from "@tauri-apps/api/core";
import EditorErrorBoundary from "../../components/error/EditorErrorBoundary.jsx";
import RawEditorFallback from "../../editor/components/RawEditorFallback.jsx";

// --- Editor Drop Zone Component ---
function EditorDropZone({ children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'editor-drop-zone',
    data: { type: 'editor-area' }
  });

  return (
    <div
      ref={setNodeRef}
      className={`relative w-full h-full ${isOver ? 'bg-app-accent bg-opacity-10' : ''}`}
      style={{ position: 'relative' }}
    >
      {children}
      {isOver && (
        <div className="absolute inset-4 border-2 border-dashed border-app-accent bg-app-accent bg-opacity-5 rounded-lg flex items-center justify-center pointer-events-none z-10">
          <div className="text-app-accent font-medium text-lg">
            Drop here to create split view
          </div>
        </div>
      )}
    </div>
  );
}

export function MainContent({
  workspacePath,
  featureFlags,
  activeFile,
  editorTitle,
  editorContent,
  isLoadingContent,
  openTabs,
  useSplitView,
  splitDirection,
  leftPaneSize,
  rightPaneFile,
  rightPaneContent,
  rightPaneTitle,
  filteredFileTree,
  isLoadingGraph,
  graphData,
  allImageFiles,
  keymap,
  recentFiles,
  stateRef,
  editorRef,
  leftPaneScrollRef,
  rightPaneScrollRef,
  onEditorChange,
  onEditorTitleChange,
  onSave,
  onTabClose,
  onFileOpen,
  onGraphStateChange,
  onMouseDown,
  onResetPaneSize,
  onLeftPaneScroll,
  onRightPaneScroll,
  toggleFolder,
  setEditorTitle,
  setEditorContent,
  setUnsavedChanges,
  setActiveFile,
  setOpenTabs,
  setRightPaneFile,
  setRightPaneTitle,
  setRightPaneContent,
  setEditor,
  onCreateFile,
  onCreateCanvas,
  onCreateFolder,
  onOpenCommandPalette,
  sourceModePaths,
  savedContent,
  onExitSourceMode,
}) {
  return (
    <main className="min-w-0 min-h-0 flex flex-col bg-app-bg">
      {/* Main content area */}
      <>
        {useSplitView ? (
          /* Split View - Two Complete Panes */
          <div className={`h-full overflow-hidden ${splitDirection === 'vertical' ? 'flex' : 'flex flex-col'}`}>
            {/* Left/Top Pane */}
            <div
              className={`flex flex-col overflow-hidden ${splitDirection === 'vertical'
                ? 'border-r border-app-border'
                : 'border-b border-app-border'
                }`}
              style={{
                [splitDirection === 'vertical' ? 'width' : 'height']: `${leftPaneSize}%`
              }}
            >
              {/* Left/Top Pane Content */}
              {activeFile ? (
                sourceModePaths?.has(activeFile) ? (
                  <RawEditorFallback
                    content={savedContent || editorContent}
                    onContentChange={onEditorChange}
                    onRetry={() => onExitSourceMode?.(activeFile)}
                  />
                ) : (
                <div
                  ref={leftPaneScrollRef}
                  className="flex-1 p-4 overflow-y-auto"
                  onScroll={onLeftPaneScroll}
                >
                  <input
                    type="text"
                    value={editorTitle}
                    onChange={(e) => setEditorTitle(e.target.value)}
                    className="w-full bg-transparent text-4xl font-bold mb-6 outline-none text-app-text"
                  />
                  <EditorErrorBoundary
                    key={activeFile}
                    filePath={activeFile}
                    fallback={({ error }) => (
                      <RawEditorFallback
                        content={savedContent || editorContent}
                        onContentChange={onEditorChange}
                        onRetry={() => onExitSourceMode?.(activeFile)}

                      />
                    )}
                  >
                    <Editor
                      ref={editorRef}
                      content={editorContent}
                      onContentChange={onEditorChange}
                      onEditorReady={setEditor}
                      isLoading={isLoadingContent}
                    />
                  </EditorErrorBoundary>
                </div>
                )
              ) : (
                <div className="flex-1 flex items-center justify-center text-app-muted">
                  No file selected
                </div>
              )}
            </div>

            {/* Resizer */}
            <div
              className={`${splitDirection === 'vertical'
                ? 'w-1 cursor-col-resize hover:bg-app-accent'
                : 'h-1 cursor-row-resize hover:bg-app-accent'
                } bg-app-border transition-colors duration-200 flex-shrink-0`}
              onMouseDown={onMouseDown}
              onDoubleClick={onResetPaneSize}
            />

            {/* Right/Bottom Pane */}
            <div
              className="flex flex-col overflow-hidden"
              style={{
                [splitDirection === 'vertical' ? 'width' : 'height']: `${100 - leftPaneSize}%`
              }}
            >
              {/* Right/Bottom Pane Content */}
              {rightPaneFile ? (
                featureFlags.enable_canvas && rightPaneFile && rightPaneFile.endsWith('.canvas') ? (
                  <div className="flex-1 overflow-hidden">
                    <Suspense fallback={<Loading />}>
                      <LazyCanvas
                        canvasPath={rightPaneFile}
                        canvasName={openTabs.find(tab => tab.path === rightPaneFile)?.name}
                        onSave={async (canvasData) => {
                          try {
                            await canvasManager.saveCanvas(rightPaneFile, canvasData);
                            setUnsavedChanges(prev => {
                              const newSet = new Set(prev);
                              newSet.delete(rightPaneFile);
                              return newSet;
                            });
                          } catch { }
                        }}
                        onChange={() => {
                          setUnsavedChanges(prev => new Set(prev).add(rightPaneFile));
                        }}
                      />
                    </Suspense>
                  </div>
                ) : rightPaneFile && rightPaneFile.endsWith('.kanban') ? (
                  <div className="flex-1 overflow-hidden">
                    <KanbanBoard
                      workspacePath={workspacePath}
                      boardPath={rightPaneFile}
                      onFileOpen={onFileOpen}
                    />
                  </div>
                ) : rightPaneFile && rightPaneFile.endsWith('.pdf') ? (
                  <div className="flex-1 overflow-hidden">
                    <Suspense fallback={<Loading />}>
                      <LazyPDFViewer
                        file={rightPaneFile}
                        onClose={() => {
                          setOpenTabs(prev => prev.filter(tab => tab.path !== rightPaneFile));
                          setRightPaneFile(null);
                        }}
                      />
                    </Suspense>
                  </div>
                ) : rightPaneFile.startsWith('__graph__') ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                    <Suspense fallback={<Loading />}>
                      <LazyGraph
                        fileTree={filteredFileTree}
                        activeFile={rightPaneFile}
                        onFileOpen={onFileOpen}
                        workspacePath={workspacePath}
                      />
                    </Suspense>
                  </div>
                ) : rightPaneFile === '__bases__' ? (
                  <div className="h-full">
                    <BasesView isVisible={true} onFileOpen={onFileOpen} />
                  </div>
                ) : featureFlags.enable_plugins && rightPaneFile.startsWith('__plugin_') ? (
                  <div className="flex-1 overflow-hidden">
                    {(() => {
                      const activeTab = openTabs.find(tab => tab.path === rightPaneFile);
                      return activeTab?.plugin ? <Suspense fallback={<Loading />}><LazyPluginDetail plugin={activeTab.plugin} /></Suspense> : <div>Plugin not found</div>;
                    })()}
                  </div>
                ) : sourceModePaths?.has(rightPaneFile) ? (
                  <RawEditorFallback
                    content={rightPaneContent}
                    onContentChange={(content) => setRightPaneContent(content)}
                    onRetry={() => onExitSourceMode?.(rightPaneFile)}
                  />
                ) : (
                  <div
                    ref={rightPaneScrollRef}
                    className="flex-1 p-4 overflow-y-auto"
                    onScroll={onRightPaneScroll}
                  >
                    <input
                      type="text"
                      value={rightPaneTitle}
                      onChange={(e) => setRightPaneTitle(e.target.value)}
                      className="w-full bg-transparent text-4xl font-bold mb-6 outline-none text-app-text"
                    />
                    <EditorErrorBoundary
                      key={rightPaneFile}
                      filePath={rightPaneFile}
                      fallback={({ error }) => (
                        <RawEditorFallback
                          content={rightPaneContent}
                          onContentChange={(content) => setRightPaneContent(content)}
                          onRetry={() => onExitSourceMode?.(rightPaneFile)}
  
                        />
                      )}
                    >
                      <Editor
                        key={`right-pane-${rightPaneFile}`}
                        content={rightPaneContent}
                        onContentChange={(content) => setRightPaneContent(content)}
                        onEditorReady={setEditor}
                      />
                    </EditorErrorBoundary>
                  </div>
                )
              ) : (
                <div className="flex-1 flex items-center justify-center text-app-muted">
                  Click a tab to open file in this pane
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Single View */
          <>
            {featureFlags.enable_canvas && activeFile && activeFile.endsWith('.canvas') ? (
              <div className="flex-1 overflow-hidden">
                <Suspense fallback={<Loading />}>
                  <LazyCanvas
                    canvasPath={activeFile}
                    canvasName={openTabs.find(tab => tab.path === activeFile)?.name}
                    onSave={async (canvasData) => {
                      try {
                        await canvasManager.saveCanvas(activeFile, canvasData);
                        setUnsavedChanges(prev => {
                          const newSet = new Set(prev);
                          newSet.delete(activeFile);
                          return newSet;
                        });
                      } catch { }
                    }}
                    onContentChange={(canvasData) => {
                      setUnsavedChanges(prev => {
                        const newSet = new Set(prev);
                        newSet.add(activeFile);
                        return newSet;
                      });
                    }}
                    initialData={null} // Will be loaded by Canvas component
                  />
                </Suspense>
              </div>
            ) : activeFile && activeFile.endsWith('.kanban') ? (
              <div className="flex-1 overflow-hidden">
                <KanbanBoard
                  workspacePath={workspacePath}
                  boardPath={activeFile}
                  onFileOpen={onFileOpen}
                />
              </div>
            ) : activeFile && activeFile.endsWith('.pdf') ? (
              <div className="flex-1 overflow-hidden">
                <Suspense fallback={<Loading />}>
                  <LazyPDFViewer
                    file={activeFile}
                    onClose={() => {
                      setOpenTabs(prev => prev.filter(tab => tab.path !== activeFile));
                      setActiveFile(null);
                    }}
                  />
                </Suspense>
              </div>
            ) : activeFile && isImageFile(activeFile) ? (
              <div className="flex-1 overflow-hidden">
                <Suspense fallback={<Loading />}>
                  <LazyImageViewer
                    imagePath={activeFile}
                    allImageFiles={allImageFiles}
                    onImageChange={(newPath) => {
                      // Update active file and tab name when navigating between images
                      setActiveFile(newPath);
                      setOpenTabs(prevTabs => {
                        return prevTabs.map(tab =>
                          tab.path === activeFile
                            ? { ...tab, path: newPath, name: getFilename(newPath) }
                            : tab
                        );
                      });
                    }}
                  />
                </Suspense>
              </div>
            ) : activeFile === '__graph__' ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                <Suspense fallback={<Loading />}>
                  <LazyGraph
                    isVisible={true}
                    fileTree={filteredFileTree}
                    workspacePath={workspacePath}
                    onOpenFile={onFileOpen}
                    onGraphStateChange={onGraphStateChange}
                  />
                </Suspense>
              </div>
            ) : activeFile === '__bases__' ? (
              <div className="flex-1 h-full overflow-hidden">
                <BasesView isVisible={true} onFileOpen={onFileOpen} />
              </div>
            ) : activeFile === '__calendar__' ? (
              <div className="flex-1 h-full overflow-hidden">
                <Suspense fallback={<Loading />}>
                  <LazyCalendarView
                    workspacePath={workspacePath}
                    onClose={() => {
                      const remaining = openTabs.filter(t => t.path !== '__calendar__');
                      setOpenTabs(remaining);
                      setActiveFile(remaining[0]?.path || null);
                    }}
                    onOpenSettings={async () => {
                      try {
                        await invoke('open_preferences_window', { workspacePath: workspacePath, section: 'Connections' });
                      } catch (e) {
                        console.error('Failed to open preferences:', e);
                      }
                    }}
                  />
                </Suspense>
              </div>
            ) : featureFlags.enable_plugins && activeFile && activeFile.startsWith('__plugin_') ? (
              <div className="flex-1 p-8 md:p-12 overflow-y-auto">
                <div className="max-w-full mx-auto h-full">
                  <div className="flex-1 overflow-hidden">
                    {(() => {
                      const activeTab = openTabs.find(tab => tab.path === activeFile);
                      return activeTab?.plugin ? <Suspense fallback={<Loading />}><LazyPluginDetail plugin={activeTab.plugin} /></Suspense> : <div>Plugin not found</div>;
                    })()}
                  </div>
                </div>
              </div>
            ) : activeFile === '__old_graph__' ? (
              <div className="flex-1 p-8 md:p-12 overflow-y-auto">
                <div className="max-w-full mx-auto h-full">
                  <div className="h-full flex flex-col">
                    {isLoadingGraph ? (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin w-8 h-8 border-2 border-app-accent border-t-transparent rounded-full mx-auto mb-4"></div>
                          <h2 className="text-xl font-medium text-app-text mb-2">Building Graph</h2>
                          <p className="text-app-muted">Processing your workspace files...</p>
                        </div>
                      </div>
                    ) : graphData ? (
                      <div className="flex-1 h-full">
                        <div>Old Graph View - REMOVED</div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                        <div className="mb-6">
                          <Network className="w-16 h-16 text-app-muted/50 mx-auto mb-4" />
                          <h2 className="text-xl font-medium text-app-text mb-2">Graph View</h2>
                          <p className="text-app-muted mb-6 max-w-md">
                            {isLoadingGraph
                              ? 'Building your knowledge graph...'
                              : 'Visualize the connections between your notes and discover hidden relationships in your knowledge base.'
                            }
                          </p>
                        </div>
                        {isLoadingGraph && (
                          <div className="flex items-center gap-2 text-app-accent">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                            <span>Processing notes...</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : activeFile ? (
              sourceModePaths?.has(activeFile) ? (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  <Breadcrumbs
                    activeFile={activeFile}
                    workspacePath={workspacePath}
                    onNavigate={(folderPath) => {
                      if (folderPath !== workspacePath) {
                        toggleFolder(folderPath);
                      }
                    }}
                  />
                  <RawEditorFallback
                    content={savedContent || editorContent}
                    onContentChange={onEditorChange}
                    onRetry={() => onExitSourceMode?.(activeFile)}
                  />
                </div>
              ) : (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Breadcrumb navigation at top of editor */}
                <Breadcrumbs
                  activeFile={activeFile}
                  workspacePath={workspacePath}
                  onNavigate={(folderPath) => {
                    // Expand the folder and scroll to it
                    if (folderPath !== workspacePath) {
                      toggleFolder(folderPath);
                    }
                  }}
                />

                <div className="flex-1 overflow-y-auto">
                  <div className="p-8 md:p-12 max-w-full mx-auto">
                    <EditorDropZone>
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div>
                            <input
                              type="text"
                              value={editorTitle}
                              onChange={(e) => setEditorTitle(e.target.value)}
                              className="w-full bg-transparent text-4xl font-bold mb-4 outline-none text-app-text"
                            />
                            <div data-tour="editor">
                              <EditorErrorBoundary
                                key={activeFile}
                                filePath={activeFile}
                                fallback={({ error }) => (
                                  <RawEditorFallback
                                    content={savedContent || editorContent}
                                    onContentChange={onEditorChange}
                                    onRetry={() => onExitSourceMode?.(activeFile)}
            
                                  />
                                )}
                              >
                                <Editor
                                  ref={editorRef}
                                  content={editorContent}
                                  onContentChange={onEditorChange}
                                  onEditorReady={setEditor}
                                  isLoading={isLoadingContent}
                                />
                              </EditorErrorBoundary>
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem onClick={onSave}>
                            Save
                            {isDesktop() && <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['save-file'])}</span>}
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => stateRef.current.activeFile && onTabClose(stateRef.current.activeFile)}>
                            Close Tab
                            {isDesktop() && <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['close-tab'])}</span>}
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem onClick={() => document.execCommand && document.execCommand('selectAll')}>Select All</ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </EditorDropZone>
                  </div>
                </div>
              </div>
              )
            ) : (
              <WelcomeScreen
                featureFlags={featureFlags}
                recentFiles={recentFiles}
                onCreateFile={onCreateFile}
                onCreateCanvas={onCreateCanvas}
                onCreateFolder={onCreateFolder}
                onFileOpen={onFileOpen}
                onOpenCommandPalette={onOpenCommandPalette}
              />
            )}
          </>
        )}
      </>
    </main>
  );
}
