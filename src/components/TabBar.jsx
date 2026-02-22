import React from "react";
import { ColoredFileIcon } from "./FileIcon.jsx";

import { isMobile } from "../platform/index.js";

/**
 * TabBar - Simplified tab bar for editor groups
 * Displays tabs for a single editor group
 */
export default function TabBar({
  tabs,
  activeTab,
  onTabClick,
  onTabClose,
  unsavedChanges,
  onDragStart,
  onDragEnd,
  groupId,
}) {
  const handleTabDragStart = (e, tab) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/json", JSON.stringify(tab));
    onDragStart && onDragStart(tab);
  };

  const handleTabDragEnd = (e) => {
    onDragEnd && onDragEnd();
  };

  const mobile = isMobile();

  if (!tabs || tabs.length === 0) {
    return (
      <div className="h-12 shrink-0 flex items-end bg-app-panel border-b border-app-border px-2">
        <div className="flex-1 flex items-center text-app-muted text-sm">
          No tabs open
        </div>
      </div>
    );
  }

  return (
    <div className="h-12 shrink-0 flex items-end bg-app-panel border-b border-app-border px-0">
      <div className="flex-1 flex items-center overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <div
            key={tab.path}
            draggable={true}
            onDragStart={(e) => handleTabDragStart(e, tab)}
            onDragEnd={handleTabDragEnd}
            onClick={() => onTabClick(tab.path)}
            className={`
              group relative h-9 px-4 flex items-center gap-2 cursor-pointer
              transition-all duration-150 border-r border-app-border
              ${
                activeTab === tab.path
                  ? "bg-app-bg text-app-text border-b-2 border-b-app-accent"
                  : "bg-app-panel text-app-muted hover:bg-app-bg/50 hover:text-app-text"
              }
            `}
          >
            <ColoredFileIcon
              fileName={tab.name}
              isDirectory={false}
              className="w-4 h-4 flex-shrink-0"
              showChevron={false}
            />
            <span className="text-sm truncate max-w-[150px]">{tab.name}</span>

            {/* Unsaved indicator */}
            {unsavedChanges && unsavedChanges.has(tab.path) && (
              <span
                className="w-2 h-2 rounded-full bg-app-accent"
                title="Unsaved changes"
              />
            )}

            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.path);
              }}
              className={`
                ${
                  mobile
                    ? "opacity-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    : "opacity-0 group-hover:opacity-100"
                }
                transition-opacity hover:bg-app-border rounded
              `}
              title="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-3 h-3"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
