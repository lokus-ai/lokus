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
        <span className="truncate max-w-[220px]">{tab.name.replace(/\.md$/, "")}</span>
        <div className="w-5 h-5 ml-1 flex items-center justify-center rounded hover:bg-app-bg/50">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(tab.path);
            }}
            className="p-0.5 rounded hidden group-hover:flex items-center justify-center"
          >
            <Icon path="M6 18L18 6M6 6l12 12" className="w-3.5 h-3.5" />
          </button>
          {isUnsaved && (
            <div className="w-1.5 h-1.5 rounded-full bg-app-accent group-hover:hidden"></div>
          )}
        </div>
        {/* right separator */}
        {!isActive && <div className="ml-1 h-4 w-px bg-app-border/50" />}
      </div>
    </div>
  );
}
