import React, { useState } from 'react';
import { useResponsiveTabBar } from '../../hooks/useResponsiveTabBar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '../ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';

/**
 * ResponsiveTabBar - Adaptive tab bar with overflow menu
 * Maintains Obsidian-style tab appearance while handling responsive overflow
 */
export function ResponsiveTabBar({
  tabs = [],
  activeTab = null,
  onTabClick,
  onTabClose,
  onNewTab,
  unsavedChanges = new Set(),
  reservedSpace = 0
}) {
  const [hoveredTab, setHoveredTab] = useState(null);

  const {
    containerRef,
    visibleTabs,
    overflowTabs,
    hasOverflow,
    actualTabWidth,
    handleOverflowTabClick,
    isTabActive
  } = useResponsiveTabBar({
    tabs,
    activeTabPath: activeTab,
    reservedSpace
  });

  /**
   * Render a single tab button with Obsidian styling
   */
  const renderTab = (tab, index, isVisible = true) => {
    const isActive = isTabActive(tab.path);
    const isHovered = hoveredTab === tab.path;
    const hasUnsavedChanges = unsavedChanges.has(tab.path);

    return (
      <div
        key={tab.path}
        role="button"
        tabIndex={0}
        onClick={() => onTabClick?.(tab.path)}
        onKeyDown={(e) => e.key === 'Enter' && onTabClick?.(tab.path)}
        data-tauri-drag-region="false"
        className={`
          responsive-tab relative flex items-center gap-2 px-3 text-[13px] font-medium whitespace-nowrap cursor-pointer
          max-w-[80px] sm:max-w-[100px] md:max-w-[180px]
          min-w-[60px] sm:min-w-[80px] md:min-w-[120px]
          ${isActive ? 'responsive-tab-active z-10' : 'z-0'}
        `}
        style={{
          pointerEvents: 'auto',
          marginLeft: index > 0 && isVisible ? '2px' : '0',
          flexShrink: 1,
        }}
        onMouseEnter={() => !isActive && setHoveredTab(tab.path)}
        onMouseLeave={() => setHoveredTab(null)}
      >
        <span className="truncate flex-1">{tab.name}</span>
        {hasUnsavedChanges && (
          <span className="w-2 h-2 rounded-full bg-app-accent flex-shrink-0" />
        )}
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onTabClose?.(tab.path);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onTabClose?.(tab.path);
            }
          }}
          className="ml-1 hover:bg-white/10 rounded p-1 flex-shrink-0 transition-opacity cursor-pointer"
          style={{
            opacity: isActive || isHovered ? 0.7 : 0,
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = isActive ? '0.7' : '0'}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
      </div>
    );
  };

  /**
   * Render overflow menu for hidden tabs
   */
  const renderOverflowMenu = () => {
    if (!hasOverflow) return null;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="overflow-menu-button hover:bg-app-panel"
            title="More tabs"
            data-tauri-drag-region="false"
          >
            <MoreHorizontal className="w-4 h-4 text-app-text" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[200px]">
          <div className="px-2 py-1.5 text-xs font-medium text-app-muted">
            Hidden Tabs ({overflowTabs.length})
          </div>
          <DropdownMenuSeparator />
          {overflowTabs.map((tab) => {
            const isActive = isTabActive(tab.path);
            const hasUnsavedChanges = unsavedChanges.has(tab.path);

            return (
              <DropdownMenuItem
                key={tab.path}
                onClick={() => handleOverflowTabClick(tab.path, onTabClick)}
                className="flex items-center justify-between gap-2"
              >
                <span className="truncate flex-1">{tab.name}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {hasUnsavedChanges && (
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                  )}
                  {isActive && (
                    <span className="text-xs text-app-muted">Active</span>
                  )}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTabClose?.(tab.path);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        onTabClose?.(tab.path);
                      }
                    }}
                    className="hover:bg-white/10 rounded p-1 cursor-pointer"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </span>
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div
      ref={containerRef}
      className="responsive-tab-bar"
      data-tauri-drag-region
      style={{
        width: '100%',
        minWidth: 0,
        display: 'flex',
        alignItems: 'stretch',
        paddingTop: '6px',
        height: '40px',
        overflow: 'hidden'
      }}
    >
      {/* Visible tabs */}
      <div className="flex items-stretch" style={{ minWidth: 0 }}>
        {visibleTabs.map((tab, index) => renderTab(tab, index, true))}
      </div>

      {/* Overflow menu */}
      {renderOverflowMenu()}

      {/* New tab — sits right after the tabs (Vellum), not at the window edge */}
      {onNewTab && (
        <button
          onClick={onNewTab}
          title="New Tab"
          data-tauri-drag-region="false"
          className="self-center grid place-items-center w-[30px] h-[30px] ml-1 rounded-[7px] bg-transparent text-app-muted hover:bg-[rgb(var(--text)/0.07)] hover:text-app-text transition-colors flex-none"
          style={{ pointerEvents: 'auto' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M8 3.5v9M3.5 8h9" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default ResponsiveTabBar;
