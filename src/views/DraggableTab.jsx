import React from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

const Icon = ({ path, className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

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

  // Premium, understated look: flat tabs with bottom accent line for active,
  // subtle hover background, and separators between tabs.
  const baseClasses = "group h-10 -mb-[1px] mr-1 flex items-center gap-2 px-3 text-sm transition-colors cursor-pointer select-none border-b-2";
  const activeClasses = isActive
    ? "border-app-accent text-app-text"
    : "border-transparent text-app-muted hover:text-app-text hover:bg-app-bg/40";
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
        <div className="w-4 h-4 mr-1 flex-shrink-0">
          {tab.name.endsWith('.md') ? (
            <svg className="w-4 h-4 text-app-muted" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-app-muted" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
          )}
        </div>
        <span className="truncate max-w-[180px] text-sm">
          {tab.name.replace(/\.(md|txt|json|js|jsx|ts|tsx|py|html|css)$/, "") || tab.name}
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
            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-app-bg/60 transition-all duration-200 hidden group-hover:flex items-center justify-center"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        {/* right separator */}
        {!isActive && <div className="ml-1 h-4 w-px bg-app-border/50" />}
      </div>
    </div>
  );
}
