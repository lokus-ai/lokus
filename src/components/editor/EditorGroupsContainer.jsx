import React, { useState, useRef, useEffect } from 'react';
import EditorGroup from "./EditorGroup.jsx";

/**
 * EditorGroupsContainer - Recursively renders the layout tree
 * Handles both leaf nodes (EditorGroup) and branch nodes (split containers)
 */
export default function EditorGroupsContainer({
  node,
  focusedGroupId,
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
  onSizeChange,
  canvasManager,
  openTabs,
  TabBarComponent,
}) {
  const containerRef = useRef(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeIndex, setResizeIndex] = useState(null);

  // If this is a leaf node (group), render the EditorGroup
  if (node.type === 'group') {
    return (
      <EditorGroup
        group={node}
        isFocused={node.id === focusedGroupId}
        isDragActive={isDragActive}
        dropTarget={dropTarget}
        fileTree={fileTree}
        workspacePath={workspacePath}
        unsavedChanges={unsavedChanges}
        onTabClick={onTabClick}
        onTabClose={onTabClose}
        onTabDragStart={onTabDragStart}
        onTabDragEnd={onTabDragEnd}
        onDropZoneHover={onDropZoneHover}
        onDrop={onDrop}
        onContentChange={onContentChange}
        onFocus={onFocus}
        onFileOpen={onFileOpen}
        canvasManager={canvasManager}
        openTabs={openTabs}
        TabBarComponent={TabBarComponent}
      />
    );
  }

  // Otherwise, this is a container node with children
  const isVertical = node.direction === 'vertical';
  const sizes = node.sizes || node.children.map(() => 100 / node.children.length);

  // Handle mouse down on resizer
  const handleResizerMouseDown = (e, index) => {
    e.preventDefault();
    setIsResizing(true);
    setResizeIndex(index);

    const startPos = isVertical ? e.clientX : e.clientY;
    const containerSize = isVertical
      ? containerRef.current.offsetWidth
      : containerRef.current.offsetHeight;

    const startSizes = [...sizes];

    const handleMouseMove = (moveEvent) => {
      const currentPos = isVertical ? moveEvent.clientX : moveEvent.clientY;
      const delta = ((currentPos - startPos) / containerSize) * 100;

      // Update sizes
      const newSizes = [...startSizes];
      newSizes[index] = Math.max(10, Math.min(90, startSizes[index] + delta));
      newSizes[index + 1] = Math.max(10, Math.min(90, startSizes[index + 1] - delta));

      // Normalize to ensure they sum to 100
      const total = newSizes.reduce((a, b) => a + b, 0);
      const normalized = newSizes.map(s => (s / total) * 100);

      onSizeChange && onSizeChange(node.id, normalized);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeIndex(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      ref={containerRef}
      className={`flex ${isVertical ? 'flex-row' : 'flex-col'} h-full w-full`}
      style={{ cursor: isResizing ? (isVertical ? 'col-resize' : 'row-resize') : 'default' }}
    >
      {node.children.map((child, index) => (
        <React.Fragment key={child.id}>
          {/* Child container or group */}
          <div
            style={{
              [isVertical ? 'width' : 'height']: `${sizes[index]}%`,
              flex: 'none',
            }}
            className="overflow-hidden"
          >
            <EditorGroupsContainer
              node={child}
              focusedGroupId={focusedGroupId}
              isDragActive={isDragActive}
              dropTarget={dropTarget}
              fileTree={fileTree}
              workspacePath={workspacePath}
              unsavedChanges={unsavedChanges}
              onTabClick={onTabClick}
              onTabClose={onTabClose}
              onTabDragStart={onTabDragStart}
              onTabDragEnd={onTabDragEnd}
              onDropZoneHover={onDropZoneHover}
              onDrop={onDrop}
              onContentChange={onContentChange}
              onFocus={onFocus}
              onFileOpen={onFileOpen}
              onSizeChange={onSizeChange}
              canvasManager={canvasManager}
              openTabs={openTabs}
              TabBarComponent={TabBarComponent}
            />
          </div>

          {/* Resizer (between children, not after the last one) */}
          {index < node.children.length - 1 && (
            <div
              className={`flex-shrink-0 ${
                isVertical
                  ? 'w-1 cursor-col-resize hover:bg-app-accent'
                  : 'h-1 cursor-row-resize hover:bg-app-accent'
              } bg-app-border transition-colors duration-200`}
              onMouseDown={(e) => handleResizerMouseDown(e, index)}
              onDoubleClick={() => {
                // Reset to equal sizes
                const equalSizes = node.children.map(() => 100 / node.children.length);
                onSizeChange && onSizeChange(node.id, equalSizes);
              }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
