/**
 * PanelManager.js - Comprehensive Panel Lifecycle Management
 * 
 * Manages the complete lifecycle of UI panels including:
 * - Panel registration and lifecycle
 * - Layout management and persistence
 * - Drag and drop support
 * - Resizing and docking
 * - Focus and z-index management
 * - Integration with Lokus theme system
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { uiAPI, PANEL_POSITIONS, PANEL_TYPES } from '../api/UIAPI.js';

// Panel Manager Context
const PanelManagerContext = createContext();

// Hook to use panel manager
export const usePanelManager = () => {
  const context = useContext(PanelManagerContext);
  if (!context) {
    throw new Error('usePanelManager must be used within a PanelManagerProvider');
  }
  return context;
};

// Panel position utilities
const POSITION_CLASSES = {
  [PANEL_POSITIONS.SIDEBAR_LEFT]: 'left-0 top-0 h-full border-r border-app-border',
  [PANEL_POSITIONS.SIDEBAR_RIGHT]: 'right-0 top-0 h-full border-l border-app-border',
  [PANEL_POSITIONS.BOTTOM]: 'bottom-0 left-0 right-0 border-t border-app-border',
  [PANEL_POSITIONS.FLOATING]: 'absolute shadow-xl border border-app-border rounded-lg',
  [PANEL_POSITIONS.MODAL]: 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50',
  [PANEL_POSITIONS.EDITOR_OVERLAY]: 'absolute z-40'
};

/**
 * Panel Container Component
 * Renders individual panels with proper styling and behavior
 */
const PanelContainer = ({ panel, onResize, onMove, onClose, onActivate, style = {} }) => {
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef(null);
  const resizeHandleRef = useRef(null);
  const dragStartRef = useRef(null);

  // Handle panel resize
  const handleResizeStart = useCallback((e) => {
    if (!panel.resizable) return;
    
    e.preventDefault();
    setIsResizing(true);
    
    const startSize = panel.currentSize;
    const startX = e.clientX;
    const startY = e.clientY;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      const newSize = {
        width: Math.max(panel.minSize.width, Math.min(panel.maxSize.width, startSize.width + deltaX)),
        height: Math.max(panel.minSize.height, Math.min(panel.maxSize.height, startSize.height + deltaY))
      };
      
      onResize(panel.id, newSize);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panel, onResize]);

  // Handle panel drag
  const handleDragStart = useCallback((e) => {
    if (panel.isDocked || !panel.closable) return;
    
    e.preventDefault();
    setIsDragging(true);
    onActivate(panel.id);
    
    const rect = panelRef.current.getBoundingClientRect();
    dragStartRef.current = {
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top
    };

    const handleMouseMove = (e) => {
      const newPosition = {
        x: e.clientX - dragStartRef.current.offsetX,
        y: e.clientY - dragStartRef.current.offsetY
      };
      
      onMove(panel.id, newPosition);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panel, onMove, onActivate]);

  // Panel header
  const renderHeader = () => (
    <div 
      className={`
        flex items-center justify-between p-3 border-b border-app-border bg-app-panel
        ${!panel.isDocked ? 'cursor-move' : ''}
      `}
      onMouseDown={handleDragStart}
    >
      <div className="flex items-center gap-2">
        {panel.icon && (
          <div className="w-4 h-4 text-app-muted">
            {typeof panel.icon === 'string' ? (
              <img src={panel.icon} alt="" className="w-full h-full" />
            ) : (
              panel.icon
            )}
          </div>
        )}
        <span className="text-sm font-medium text-app-text">{panel.title}</span>
      </div>
      
      <div className="flex items-center gap-1">
        {panel.closable && (
          <button
            onClick={() => onClose(panel.id)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-app-border/50 text-app-muted hover:text-app-text transition-colors"
            title="Close panel"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>
    </div>
  );

  // Panel content
  const renderContent = () => {
    switch (panel.type) {
      case PANEL_TYPES.REACT:
        if (panel.component) {
          const Component = panel.component;
          return <Component {...panel.props} panel={panel} />;
        }
        break;
        
      case PANEL_TYPES.WEBVIEW:
        return (
          <div 
            className="w-full h-full"
            dangerouslySetInnerHTML={{ __html: panel.html || '' }}
          />
        );
        
      case PANEL_TYPES.IFRAME:
        return (
          <iframe
            src={panel.src}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            title={panel.title}
          />
        );
        
      default:
        return (
          <div className="p-4 text-app-muted text-center">
            <p>Panel type "{panel.type}" not supported</p>
          </div>
        );
    }
  };

  // Resize handle
  const renderResizeHandle = () => {
    if (!panel.resizable || panel.position === PANEL_POSITIONS.MODAL) return null;
    
    return (
      <div
        ref={resizeHandleRef}
        className={`
          absolute bg-transparent hover:bg-app-accent/30 transition-colors cursor-se-resize
          ${panel.position === PANEL_POSITIONS.SIDEBAR_LEFT ? 'right-0 top-0 w-1 h-full' : ''}
          ${panel.position === PANEL_POSITIONS.SIDEBAR_RIGHT ? 'left-0 top-0 w-1 h-full' : ''}
          ${panel.position === PANEL_POSITIONS.BOTTOM ? 'top-0 left-0 right-0 h-1' : ''}
          ${panel.position === PANEL_POSITIONS.FLOATING ? 'bottom-0 right-0 w-4 h-4' : ''}
        `}
        onMouseDown={handleResizeStart}
      />
    );
  };

  const positionClasses = POSITION_CLASSES[panel.position] || '';
  
  return (
    <div
      ref={panelRef}
      className={`
        bg-app-bg ${positionClasses}
        ${panel.isActive ? 'z-40' : 'z-30'}
        ${isResizing ? 'select-none' : ''}
        ${isDragging ? 'select-none opacity-90' : ''}
        transition-opacity duration-200
      `}
      style={{
        width: panel.position === PANEL_POSITIONS.FLOATING ? panel.currentSize.width : undefined,
        height: panel.position === PANEL_POSITIONS.FLOATING ? panel.currentSize.height : undefined,
        left: panel.currentPosition?.x,
        top: panel.currentPosition?.y,
        ...style
      }}
      onClick={() => onActivate(panel.id)}
    >
      {renderHeader()}
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
      {renderResizeHandle()}
    </div>
  );
};

/**
 * Panel Group Component
 * Manages multiple panels in the same position (tabs, stacks)
 */
const PanelGroup = ({ position, panels, onResize, onMove, onClose, onActivate }) => {
  const [activeTab, setActiveTab] = useState(0);
  
  if (panels.length === 0) return null;
  
  if (panels.length === 1) {
    return (
      <PanelContainer
        panel={panels[0]}
        onResize={onResize}
        onMove={onMove}
        onClose={onClose}
        onActivate={onActivate}
      />
    );
  }

  // Multiple panels - render as tabs
  const activePanel = panels[activeTab];
  
  return (
    <div className="flex flex-col h-full bg-app-bg">
      {/* Tab bar */}
      <div className="flex border-b border-app-border bg-app-panel">
        {panels.map((panel, index) => (
          <button
            key={panel.id}
            onClick={() => setActiveTab(index)}
            className={`
              flex items-center gap-2 px-3 py-2 text-sm border-r border-app-border
              ${index === activeTab 
                ? 'bg-app-bg text-app-text border-b-2 border-app-accent' 
                : 'text-app-muted hover:text-app-text hover:bg-app-border/50'
              }
              transition-colors
            `}
          >
            {panel.icon && (
              <div className="w-4 h-4">
                {typeof panel.icon === 'string' ? (
                  <img src={panel.icon} alt="" className="w-full h-full" />
                ) : (
                  panel.icon
                )}
              </div>
            )}
            <span>{panel.title}</span>
            {panel.closable && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(panel.id);
                }}
                className="w-4 h-4 hover:bg-app-danger/20 hover:text-app-danger rounded transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </button>
        ))}
      </div>
      
      {/* Active panel content */}
      <div className="flex-1 overflow-auto">
        {activePanel && (
          <PanelContainer
            panel={activePanel}
            onResize={onResize}
            onMove={onMove}
            onClose={onClose}
            onActivate={onActivate}
          />
        )}
      </div>
    </div>
  );
};

/**
 * Panel Manager Component
 * Main component that manages all panels and their layout
 */
export const PanelManager = ({ children }) => {
  const [panels, setPanels] = useState(new Map());
  const [layout, setLayout] = useState(uiAPI.getDefaultLayout());
  const [activePanel, setActivePanel] = useState(null);
  const layoutVersion = useRef(0);

  // Initialize panel manager
  useEffect(() => {
    // Load saved layout
    uiAPI.loadLayout();
    setLayout({ ...uiAPI.panelLayout });
    
    // Set up event listeners
    const handlePanelRegistered = ({ panel }) => {
      setPanels(prev => new Map(prev).set(panel.id, panel));
      layoutVersion.current += 1;
    };

    const handlePanelUnregistered = ({ panelId }) => {
      setPanels(prev => {
        const newMap = new Map(prev);
        newMap.delete(panelId);
        return newMap;
      });
      layoutVersion.current += 1;
    };

    const handlePanelActivated = ({ panel }) => {
      setActivePanel(panel.id);
    };

    uiAPI.on('panel-registered', handlePanelRegistered);
    uiAPI.on('panel-unregistered', handlePanelUnregistered);
    uiAPI.on('panel-activated', handlePanelActivated);

    // Cleanup
    return () => {
      uiAPI.off('panel-registered', handlePanelRegistered);
      uiAPI.off('panel-unregistered', handlePanelUnregistered);
      uiAPI.off('panel-activated', handlePanelActivated);
    };
  }, []);

  // Save layout when panels change
  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      uiAPI.saveLayout();
    }, 1000);

    return () => clearTimeout(saveTimeout);
  }, [panels, layout]);

  // Panel operations
  const handlePanelResize = useCallback((panelId, size) => {
    uiAPI.resizePanel(panelId, size);
    layoutVersion.current += 1;
  }, []);

  const handlePanelMove = useCallback((panelId, position) => {
    const panel = panels.get(panelId);
    if (panel && panel.position === PANEL_POSITIONS.FLOATING) {
      panel.updatePosition(position);
      layoutVersion.current += 1;
    }
  }, [panels]);

  const handlePanelClose = useCallback((panelId) => {
    uiAPI.hidePanel(panelId);
  }, []);

  const handlePanelActivate = useCallback((panelId) => {
    uiAPI.activatePanel(panelId);
  }, []);

  // Get panels for each position
  const getPanelsForPosition = useCallback((position) => {
    return Array.from(panels.values())
      .filter(panel => panel.position === position && panel.visible)
      .sort((a, b) => a.order - b.order);
  }, [panels]);

  // Context value
  const contextValue = {
    panels: Array.from(panels.values()),
    layout,
    activePanel,
    registerPanel: uiAPI.registerPanel.bind(uiAPI),
    unregisterPanel: uiAPI.unregisterPanel.bind(uiAPI),
    showPanel: uiAPI.showPanel.bind(uiAPI),
    hidePanel: uiAPI.hidePanel.bind(uiAPI),
    togglePanel: uiAPI.togglePanel.bind(uiAPI),
    activatePanel: handlePanelActivate,
    resizePanel: handlePanelResize,
    movePanel: handlePanelMove,
    getPanelsForPosition
  };

  return (
    <PanelManagerContext.Provider value={contextValue}>
      <div className="relative w-full h-full">
        {children}
        
        {/* Render floating panels */}
        {getPanelsForPosition(PANEL_POSITIONS.FLOATING).map(panel => (
          <PanelContainer
            key={panel.id}
            panel={panel}
            onResize={handlePanelResize}
            onMove={handlePanelMove}
            onClose={handlePanelClose}
            onActivate={handlePanelActivate}
          />
        ))}
        
        {/* Render modal panels */}
        {getPanelsForPosition(PANEL_POSITIONS.MODAL).map(panel => (
          <div key={panel.id} className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="max-w-4xl max-h-4xl w-full h-full m-4">
              <PanelContainer
                panel={panel}
                onResize={handlePanelResize}
                onMove={handlePanelMove}
                onClose={handlePanelClose}
                onActivate={handlePanelActivate}
                style={{ position: 'relative', width: '100%', height: '100%' }}
              />
            </div>
          </div>
        ))}
      </div>
    </PanelManagerContext.Provider>
  );
};

/**
 * Panel Region Component
 * Renders panels for a specific position (sidebar, bottom, etc.)
 */
export const PanelRegion = ({ position, className = '', style = {} }) => {
  const { getPanelsForPosition } = usePanelManager();
  const panels = getPanelsForPosition(position);
  
  if (panels.length === 0) return null;

  return (
    <div className={`panel-region ${className}`} style={style}>
      <PanelGroup
        position={position}
        panels={panels}
        onResize={(panelId, size) => uiAPI.resizePanel(panelId, size)}
        onMove={(panelId, pos) => uiAPI.movePanel(panelId, position, pos)}
        onClose={(panelId) => uiAPI.hidePanel(panelId)}
        onActivate={(panelId) => uiAPI.activatePanel(panelId)}
      />
    </div>
  );
};

/**
 * Panel Toolbar Component
 * Renders toolbar with panel controls
 */
export const PanelToolbar = ({ position, className = '' }) => {
  const { getPanelsForPosition, togglePanel } = usePanelManager();
  const availablePanels = Array.from(uiAPI.panels.values())
    .filter(panel => panel.position === position);

  if (availablePanels.length === 0) return null;

  return (
    <div className={`panel-toolbar flex items-center gap-1 p-2 ${className}`}>
      {availablePanels.map(panel => (
        <button
          key={panel.id}
          onClick={() => togglePanel(panel.id)}
          className={`
            flex items-center gap-2 px-3 py-1 rounded text-sm transition-colors
            ${panel.visible 
              ? 'bg-app-accent text-app-accent-fg' 
              : 'text-app-muted hover:text-app-text hover:bg-app-border/50'
            }
          `}
          title={panel.title}
        >
          {panel.icon && (
            <div className="w-4 h-4">
              {typeof panel.icon === 'string' ? (
                <img src={panel.icon} alt="" className="w-full h-full" />
              ) : (
                panel.icon
              )}
            </div>
          )}
          <span>{panel.title}</span>
        </button>
      ))}
    </div>
  );
};

export default PanelManager;