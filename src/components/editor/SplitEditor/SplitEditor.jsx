import React, { useState, useRef, useCallback, useEffect } from 'react';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import EditorPane from "./EditorPane.jsx";
import DropZoneOverlay from "../../ui/DropZoneOverlay.jsx";
import PaneResizer from "./PaneResizer.jsx";
import { useSplitPanes } from "../../../hooks/useSplitPanes.js";
import './split-editor.css';

const SplitEditor = ({
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
  editorRef,
  splitInitData,
  onSplitInitComplete
}) => {
  const {
    panes,
    activePaneId,
    createSplit,
    closeSplit,
    moveToPane,
    setActivePane,
    resizePane,
    getPaneLayout
  } = useSplitPanes({
    initialFile: activeFile,
    onFileChange
  });

  const [draggedTab, setDraggedTab] = useState(null);
  const [dropZone, setDropZone] = useState(null);
  const [isShowingDropZones, setIsShowingDropZones] = useState(false);

  const splitEditorRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );

  // Handle initial split creation when a tab is dragged to create split
  useEffect(() => {
    if (splitInitData && splitInitData.draggedTab && onSplitInitComplete) {
      createSplit(splitInitData.draggedTab.path, 'vertical', 'after');
      onSplitInitComplete();
    }
  }, [splitInitData, createSplit, onSplitInitComplete]);

  // Handle tab drag start
  const handleDragStart = useCallback((event) => {
    const { active } = event;
    const tab = openTabs.find(t => t.path === active.id);
    if (tab) {
      setDraggedTab(tab);
      setIsShowingDropZones(true);
    }
  }, [openTabs]);

  // Handle tab drag over editor area
  const handleDragOver = useCallback((event) => {
    if (!draggedTab || !splitEditorRef.current) return;

    const { x, y } = event.delta;
    const rect = splitEditorRef.current.getBoundingClientRect();
    const relativeX = event.active.rect.current.translated.left - rect.left;
    const relativeY = event.active.rect.current.translated.top - rect.top;

    // Calculate drop zone based on position
    const zone = calculateDropZone(relativeX, relativeY, rect);
    setDropZone(zone);
  }, [draggedTab]);

  // Handle tab drag end
  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;

    setDraggedTab(null);
    setIsShowingDropZones(false);
    setDropZone(null);

    if (!over || !draggedTab) return;

    // Check if dropped on a pane or split zone
    if (over.id.startsWith('pane-')) {
      const paneId = over.id.replace('pane-', '');
      moveToPane(draggedTab.path, paneId);
    } else if (over.id.startsWith('split-')) {
      const splitType = over.id.replace('split-', '');
      handleSplitCreate(draggedTab.path, splitType);
    }
  }, [draggedTab, moveToPane]);

  // Calculate drop zone based on cursor position
  const calculateDropZone = (x, y, rect) => {
    const { width, height } = rect;
    const threshold = 100; // pixels from edge

    if (x < threshold) return 'left';
    if (x > width - threshold) return 'right';
    if (y < threshold) return 'top';
    if (y > height - threshold) return 'bottom';

    return 'center';
  };

  // Handle creating a new split
  const handleSplitCreate = (filePath, splitType) => {
    const direction = splitType === 'left' || splitType === 'right' ? 'vertical' : 'horizontal';
    const position = splitType === 'left' || splitType === 'top' ? 'before' : 'after';

    createSplit(filePath, direction, position, activePaneId);
  };

  // Handle pane resize
  const handlePaneResize = useCallback((paneId, newSize) => {
    resizePane(paneId, newSize);
  }, [resizePane]);

  // Handle pane focus
  const handlePaneFocus = useCallback((paneId) => {
    setActivePane(paneId);
  }, [setActivePane]);

  // Get layout configuration for CSS
  const layoutConfig = getPaneLayout();

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        ref={splitEditorRef}
        className="split-editor-container"
        style={{
          display: 'grid',
          gridTemplateColumns: layoutConfig.columns,
          gridTemplateRows: layoutConfig.rows,
          gap: '2px',
          height: '100%',
          width: '100%'
        }}
      >
        {/* Render panes */}
        {panes.map((pane, index) => (
          <React.Fragment key={pane.id}>
            <EditorPane
              pane={pane}
              isActive={pane.id === activePaneId}
              openTabs={openTabs}
              activeFile={pane.file}
              onFileChange={(file) => moveToPane(file, pane.id)}
              onTabClose={onTabClose}
              unsavedChanges={unsavedChanges}
              editorContent={pane.file === activeFile ? editorContent : ''}
              editorTitle={pane.file === activeFile ? editorTitle : ''}
              onEditorChange={pane.id === activePaneId ? onEditorChange : () => { }}
              onTitleChange={pane.id === activePaneId ? onTitleChange : () => { }}
              onSave={onSave}
              onFocus={() => handlePaneFocus(pane.id)}
              onClose={() => closeSplit(pane.id)}
              editorRef={pane.id === activePaneId ? editorRef : null}
            />

            {/* Render resizers between panes */}
            {index < panes.length - 1 && (
              <PaneResizer
                orientation={layoutConfig.orientation}
                onResize={(delta) => handlePaneResize(pane.id, delta)}
              />
            )}
          </React.Fragment>
        ))}

        {/* Drop zone overlay */}
        {isShowingDropZones && (
          <DropZoneOverlay
            activeZone={dropZone}
            panes={panes}
          />
        )}
      </div>

      {/* Drag overlay for visual feedback */}
      <DragOverlay>
        {draggedTab && (
          <div className="dragging-tab-preview">
            <span className="truncate text-sm font-medium">
              {draggedTab.name.replace(/\.(md|txt|json|js|jsx|ts|tsx|py|html|css|canvas)$/, "")}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default SplitEditor;