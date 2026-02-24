import React, { useState, useRef } from 'react';
import EditorGroup from './EditorGroup';
import ErrorBoundary from './ErrorBoundary';
import { useEditorGroupStore } from '../stores/editorGroups';

/**
 * EditorGroupsContainer - Recursively renders the layout tree.
 * Reads from useEditorGroupStore instead of prop drilling.
 * Each EditorGroup leaf is wrapped in an ErrorBoundary.
 */
export default function EditorGroupsContainer({ node, workspacePath, isSingleGroup = false, welcomeProps }) {
  const containerRef = useRef(null);
  const [isResizing, setIsResizing] = useState(false);

  const focusedGroupId = useEditorGroupStore((s) => s.focusedGroupId);

  // Leaf node: render EditorGroup wrapped in ErrorBoundary
  if (node.type === 'group') {
    return (
      <ErrorBoundary key={node.id} name={`group-${node.id}`} message="This pane crashed">
        <EditorGroup
          group={node}
          isFocused={node.id === focusedGroupId}
          workspacePath={workspacePath}
          hideTabBar={isSingleGroup}
          {...welcomeProps}
        />
      </ErrorBoundary>
    );
  }

  // Container node: render children with resize bars
  const isVertical = node.direction === 'vertical';
  const sizes = node.sizes || node.children.map(() => 100 / node.children.length);

  const handleResizerMouseDown = (e, index) => {
    e.preventDefault();
    setIsResizing(true);

    const startPos = isVertical ? e.clientX : e.clientY;
    const containerSize = isVertical
      ? containerRef.current.offsetWidth
      : containerRef.current.offsetHeight;

    const startSizes = [...sizes];

    const handleMouseMove = (moveEvent) => {
      const currentPos = isVertical ? moveEvent.clientX : moveEvent.clientY;
      const delta = ((currentPos - startPos) / containerSize) * 100;

      const newSizes = [...startSizes];
      newSizes[index] = Math.max(10, Math.min(90, startSizes[index] + delta));
      newSizes[index + 1] = Math.max(10, Math.min(90, startSizes[index + 1] - delta));

      const total = newSizes.reduce((a, b) => a + b, 0);
      const normalized = newSizes.map(s => (s / total) * 100);

      useEditorGroupStore.getState().updateSizes(node.id, normalized);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
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
          <div
            style={{
              [isVertical ? 'width' : 'height']: `${sizes[index]}%`,
              flex: 'none',
            }}
            className="overflow-hidden"
          >
            <EditorGroupsContainer
              node={child}
              workspacePath={workspacePath}
              welcomeProps={welcomeProps}
            />
          </div>

          {index < node.children.length - 1 && (
            <div
              className={`flex-shrink-0 ${
                isVertical
                  ? 'w-1 cursor-col-resize hover:bg-app-accent'
                  : 'h-1 cursor-row-resize hover:bg-app-accent'
              } bg-app-border transition-colors duration-200`}
              onMouseDown={(e) => handleResizerMouseDown(e, index)}
              onDoubleClick={() => {
                const equalSizes = node.children.map(() => 100 / node.children.length);
                useEditorGroupStore.getState().updateSizes(node.id, equalSizes);
              }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
