import { useState } from "react";
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { DraggableTab } from "../../views/DraggableTab";
import platformService from "../../services/platform/PlatformService.js";

export function OldTabBar({ tabs, activeTab, onTabClick, onTabClose, unsavedChanges, onDragEnd, onNewTab, onSplitDragStart, onSplitDragEnd, useSplitView, onToggleSplitView, splitDirection, onToggleSplitDirection, syncScrolling, onToggleSyncScrolling, onResetPaneSize, isLeftPane = true, onToggleRightSidebar, showRightSidebar }) {
  const [activeId, setActiveId] = useState(null);
  const [draggedTab, setDraggedTab] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );

  const handleDragStart = (event) => {
    const { active } = event;
    setActiveId(active.id);
    const tab = tabs.find(t => t.path === active.id);
    setDraggedTab(tab);
    onSplitDragStart?.(tab);
  };

  const handleDragEnd = (event) => {
    setActiveId(null);
    setDraggedTab(null);
    onSplitDragEnd?.(draggedTab);
    onDragEnd(event);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div data-tauri-drag-region className="h-12 shrink-0 flex items-end bg-app-panel border-b border-app-border px-0">
        <div data-tauri-drag-region="false" className="flex-1 flex items-center overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <DraggableTab
              key={tab.path}
              tab={tab}
              isActive={activeTab === tab.path}
              isUnsaved={unsavedChanges.has(tab.path)}
              onTabClick={onTabClick}
              onTabClose={onTabClose}
              onSplitDragStart={onSplitDragStart}
              onSplitDragEnd={onSplitDragEnd}
            />
          ))}
        </div>
        <div data-tauri-drag-region="false" className="flex items-center gap-1">
          <button
            onClick={onToggleSplitView}
            title={useSplitView ? "Exit split view" : "Enter split view"}
            className={`obsidian-button icon-only mb-1 ${useSplitView ? 'active' : ''}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </button>

          {/* Split direction toggle - only show in split view and on left pane */}
          {useSplitView && isLeftPane && (
            <>
              <button
                onClick={onToggleSplitDirection}
                title={`Switch to ${splitDirection === 'vertical' ? 'horizontal' : 'vertical'} split`}
                className="obsidian-button icon-only mb-1"
              >
                {splitDirection === 'vertical' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6-6 6 6" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 15l6 6 6-6" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l-6 6 6 6" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 6l6 6-6 6" />
                  </svg>
                )}
              </button>

              <button
                onClick={onResetPaneSize}
                title="Reset pane sizes (50/50)"
                className="obsidian-button icon-only mb-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>

              <button
                onClick={onToggleSyncScrolling}
                title={`${syncScrolling ? 'Disable' : 'Enable'} synchronized scrolling`}
                className={`obsidian-button icon-only mb-1 ${syncScrolling ? 'active' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
              </button>
            </>
          )}

          {/* Outline toggle button - only show on main pane */}
          {isLeftPane && onToggleRightSidebar && (
            <button
              onClick={onToggleRightSidebar}
              title={showRightSidebar ? "Hide outline" : "Show outline"}
              className={`obsidian-button icon-only mb-1 ${showRightSidebar ? 'active' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
              </svg>
            </button>
          )}

          <button
            onClick={onNewTab}
            title={`New file (${platformService.getModifierSymbol()}+N)`}
            className="obsidian-button icon-only mb-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeId && draggedTab ? (
          <div className="dragging-tab-preview" style={{
            opacity: 0.9,
            transform: 'rotate(-2deg)',
            zIndex: 99999
          }}>
            <div className="flex items-center gap-2 px-3 py-1 bg-app-surface border border-app-border rounded-md shadow-lg">
              <svg className="w-4 h-4 text-app-muted" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-app-text">
                {draggedTab.name.replace(/\.(md|txt|json|js|jsx|ts|tsx|py|html|css|canvas)$/, "") || draggedTab.name}
              </span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
