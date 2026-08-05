import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '../ui/dropdown-menu';
import { MoreHorizontal, Calendar } from 'lucide-react';
import { ColoredFileIcon } from '../FileIcon.jsx';

/** Icons for synthetic view tabs (tab.kind) that aren't backed by a file. */
const VIEW_TAB_ICONS = { calendar: Calendar };

/**
 * ResponsiveTabBar — scrollable tab strip (browser/Notion style).
 *
 * The previous version budgeted tabs into a visible set + a "…" overflow
 * menu, but never prioritized the active tab, so the tab you were ON could
 * sit invisible inside the menu. Now:
 *  - every tab lives in one horizontally scrollable strip (trackpad swipe
 *    or mouse wheel scrolls it; the scrollbar itself stays hidden)
 *  - gradient fades on either edge signal there are more tabs that way
 *  - the active tab is auto-scrolled into view whenever it changes
 *  - the "…" menu remains as a jump list of ALL tabs when overflowing
 */
export function ResponsiveTabBar({
  tabs = [],
  activeTab = null,
  onTabClick,
  onTabClose,
  onNewTab,
  unsavedChanges = new Set(),
  reservedSpace = 0, // kept for API compatibility
}) {
  const [hoveredTab, setHoveredTab] = useState(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollerRef = useRef(null);

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  // Keep the fade indicators in sync with scroll position and size changes.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScrollState) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro?.disconnect();
    };
  }, [updateScrollState]);

  useEffect(() => {
    updateScrollState();
  }, [tabs, updateScrollState]);

  // The selected tab must always be visible: scroll it into view on change.
  useEffect(() => {
    if (!activeTab) return;
    const el = scrollerRef.current?.querySelector(`[data-tab-path="${CSS.escape(activeTab)}"]`);
    el?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [activeTab, tabs.length]);

  // Vertical mouse-wheel scrolls the strip horizontally (trackpads already
  // send deltaX for horizontal swipes).
  const handleWheel = useCallback((e) => {
    const el = scrollerRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
    }
  }, []);

  const isTabActive = (path) => path === activeTab;

  const renderTab = (tab, index) => {
    const isActive = isTabActive(tab.path);
    const isHovered = hoveredTab === tab.path;
    const hasUnsavedChanges = unsavedChanges.has(tab.path);

    return (
      <div
        key={tab.path}
        data-tab-path={tab.path}
        role="button"
        tabIndex={0}
        onClick={() => onTabClick?.(tab.path)}
        onKeyDown={(e) => e.key === 'Enter' && onTabClick?.(tab.path)}
        data-tauri-drag-region="false"
        className={`
          responsive-tab relative flex items-center gap-2 px-3 text-[13px] font-medium whitespace-nowrap cursor-pointer
          ${isActive ? 'responsive-tab-active z-10' : 'z-0'}
        `}
        style={{
          pointerEvents: 'auto',
          marginLeft: index > 0 ? '2px' : '0',
          maxWidth: '240px',
          minWidth: '140px',
          flexShrink: 0,
        }}
        onMouseEnter={() => !isActive && setHoveredTab(tab.path)}
        onMouseLeave={() => setHoveredTab(null)}
      >
        {VIEW_TAB_ICONS[tab.kind] ? (
          React.createElement(VIEW_TAB_ICONS[tab.kind], { className: 'tab-file-icon text-app-muted' })
        ) : (
          <ColoredFileIcon
            fileName={tab.name}
            isDirectory={false}
            className="tab-file-icon"
            showChevron={false}
          />
        )}
        <span className="truncate flex-1">{tab.name}</span>
        {hasUnsavedChanges && (
          <span className="w-2 h-2 rounded-full bg-app-accent flex-shrink-0" />
        )}
        {tab.closable !== false && (
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
        )}
      </div>
    );
  };

  const hasOverflow = canScrollLeft || canScrollRight;

  /** "…" menu: jump list of every tab (overflow affordance + quick nav). */
  const renderAllTabsMenu = () => {
    if (!hasOverflow) return null;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="overflow-menu-button hover:bg-app-panel"
            title="All tabs"
            data-tauri-drag-region="false"
          >
            <MoreHorizontal className="w-4 h-4 text-app-text" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[200px] max-h-[60vh] overflow-y-auto">
          <div className="px-2 py-1.5 text-xs font-medium text-app-muted">
            All Tabs ({tabs.length})
          </div>
          <DropdownMenuSeparator />
          {tabs.map((tab) => {
            const isActive = isTabActive(tab.path);
            const hasUnsavedChanges = unsavedChanges.has(tab.path);

            return (
              <DropdownMenuItem
                key={tab.path}
                onClick={() => onTabClick?.(tab.path)}
                className="flex items-center justify-between gap-2"
              >
                <ColoredFileIcon
                  fileName={tab.name}
                  isDirectory={false}
                  className="tab-file-icon"
                  showChevron={false}
                />
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
      className="responsive-tab-bar"
      data-tauri-drag-region
      style={{
        width: '100%',
        minWidth: 0,
        display: 'flex',
        alignItems: 'stretch',
        paddingTop: '6px',
        height: '40px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Scrollable strip + edge fades */}
      <div className="relative flex items-stretch" style={{ minWidth: 0, flexShrink: 1 }}>
        <div
          ref={scrollerRef}
          onWheel={handleWheel}
          className="no-scrollbar flex items-stretch"
          data-tauri-drag-region
          style={{ minWidth: 0, overflowX: 'auto', scrollBehavior: 'smooth' }}
        >
          {tabs.map((tab, index) => renderTab(tab, index))}
        </div>
        {canScrollLeft && <div className="tab-strip-fade tab-strip-fade-left" />}
        {canScrollRight && <div className="tab-strip-fade tab-strip-fade-right" />}
      </div>

      {/* All-tabs menu (only when overflowing) */}
      {renderAllTabsMenu()}

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
