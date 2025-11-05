import React from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ColoredFileIcon } from "../components/FileIcon.jsx";

export function DraggableTab({ tab, isActive, isUnsaved, onTabClick, onTabClose }) {
  const { attributes, listeners, setNodeRef: draggableRef, transform, isDragging } = useDraggable({
    id: tab.path,
    data: { type: "tab", path: tab.path },
  });

  const { setNodeRef: droppableRef, isOver } = useDroppable({
    id: tab.path,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? "none" : undefined,
  };

  // Obsidian-style tabs with proper spacing
  const baseClasses = "obsidian-tab group";
  const activeClasses = isActive ? "active" : "";
  const draggingClasses = isDragging ? "opacity-50 z-10" : "";

  return (
    <div ref={droppableRef} className="relative h-full flex items-center">
      {isOver && !isDragging && (
        <div className="absolute top-1/2 -translate-y-1/2 left-0 h-3/4 w-0.5 bg-app-accent z-20 rounded-full" />
      )}
      <div
        ref={draggableRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={() => onTabClick(tab.path)}
        className={`${baseClasses} ${activeClasses} ${draggingClasses}`}
      >
        {/* File type icon */}
        <ColoredFileIcon
          fileName={tab.name}
          isDirectory={false}
          className="obsidian-file-icon"
          showChevron={false}
        />
        <span className="truncate flex-1 text-sm font-medium">
          {tab.name.replace(/\.(md|txt|json|js|jsx|ts|tsx|py|html|css|canvas)$/, "") || tab.name}
        </span>
        <div className="w-4 h-4 ml-auto flex items-center justify-center">
          {/* Unsaved indicator - always show if unsaved */}
          {isUnsaved && (
            <div className="w-2 h-2 rounded-full bg-app-accent group-hover:hidden"></div>
          )}
          
          {/* Close button - show on hover */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(tab.path);
            }}
            className="obsidian-tab-close"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}