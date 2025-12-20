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

    const baseStyles = {
      pointerEvents: 'auto',
      marginLeft: index > 0 && isVisible ? '-12px' : '0',
      width: isVisible ? '180px' : 'auto',
      minWidth: isVisible ? '80px' : 'auto',
      maxWidth: isVisible ? '200px' : 'auto',
      flexShrink: 1,
      paddingTop: '6px',
      paddingBottom: '6px',
      backgroundColor: isActive ? '#3d3d3d' : (isHovered ? '#353535' : '#2a2a2a'),
      color: isActive ? '#ffffff' : (isHovered ? '#ffffff' : '#808080'),
      borderTopLeftRadius: '8px',
      borderTopRightRadius: '8px',
      borderBottomLeftRadius: '0',
      borderBottomRightRadius: '0',
      border: '1px solid #555555',
      borderBottom: isActive ? '2px solid #3d3d3d' : '1px solid #555555',
      boxShadow: isActive
        ? '0 -2px 8px rgba(0, 0, 0, 0.4), 0 1px 0 0 #3d3d3d'
        : (isHovered ? '0 -1px 4px rgba(0, 0, 0, 0.2)' : '0 0 0 0 transparent'),
      transform: isHovered && !isActive ? 'translateY(-1px)' : 'translateY(0)',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
    };

    return (
      <div
        key={tab.path}
        role="button"
        tabIndex={0}
        onClick={() => onTabClick?.(tab.path)}
        onKeyDown={(e) => e.key === 'Enter' && onTabClick?.(tab.path)}
        data-tauri-drag-region="false"
        className={`
          relative flex items-center gap-2 px-4 h-8 text-xs whitespace-nowrap cursor-pointer
          ${isActive ? 'z-10' : 'z-0'}
        `}
        style={baseStyles}
        onMouseEnter={() => !isActive && setHoveredTab(tab.path)}
        onMouseLeave={() => setHoveredTab(null)}
      >
        <span className="truncate flex-1">{tab.name}</span>
        {hasUnsavedChanges && (
          <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
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
      style={{
        width: '100%',
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        height: '32px',
        overflow: 'hidden'
      }}
    >
      {/* Visible tabs */}
      <div className="flex items-center" style={{ minWidth: 0 }}>
        {visibleTabs.map((tab, index) => renderTab(tab, index, true))}
      </div>

      {/* Overflow menu */}
      {renderOverflowMenu()}
    </div>
  );
}

export default ResponsiveTabBar;
