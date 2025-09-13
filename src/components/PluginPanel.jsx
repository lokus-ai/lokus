import { useEffect, useState, useRef, useMemo } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Settings, 
  RefreshCcw,
  AlertCircle,
  Maximize2,
  Minimize2,
  MoreVertical,
  Pin,
  PinOff
} from "lucide-react";

// Plugin Panel Container for dynamic plugin UI components
export default function PluginPanel({
  plugins = [],
  activePanel = null,
  onPanelChange,
  onPanelClose,
  position = "right", // "left", "right", "bottom"
  collapsed = false,
  onToggleCollapse,
  width = 280,
  height = 200,
  resizable = true,
  pinned = false,
  onTogglePin,
  className = ""
}) {
  const [pluginStates, setPluginStates] = useState({});
  const [errors, setErrors] = useState({});
  const [isResizing, setIsResizing] = useState(false);
  const [dimensions, setDimensions] = useState({ width, height });
  const panelRef = useRef(null);
  const resizeRef = useRef(null);

  // Filter enabled plugins that provide UI components
  const availablePanels = useMemo(() => 
    plugins.filter(plugin => plugin.enabled && plugin.ui?.panels?.length > 0)
  , [plugins]);

  // Get current active panel plugin
  const currentPanel = useMemo(() => {
    if (!activePanel) return null;
    return availablePanels.find(plugin => 
      plugin.ui.panels.some(panel => panel.id === activePanel)
    );
  }, [availablePanels, activePanel]);

  // Get current panel definition
  const currentPanelDef = useMemo(() => {
    if (!currentPanel || !activePanel) return null;
    return currentPanel.ui.panels.find(panel => panel.id === activePanel);
  }, [currentPanel, activePanel]);

  // Initialize plugin states
  useEffect(() => {
    const initialStates = {};
    availablePanels.forEach(plugin => {
      if (!pluginStates[plugin.id]) {
        initialStates[plugin.id] = plugin.initialState || {};
      }
    });
    
    if (Object.keys(initialStates).length > 0) {
      setPluginStates(prev => ({ ...prev, ...initialStates }));
    }
  }, [availablePanels]);

  // Handle plugin state updates
  const updatePluginState = (pluginId, updates) => {
    setPluginStates(prev => ({
      ...prev,
      [pluginId]: { ...prev[pluginId], ...updates }
    }));
  };

  // Handle plugin errors
  const handlePluginError = (pluginId, error) => {
    console.error(`Plugin ${pluginId} error:`, error);
    setErrors(prev => ({ ...prev, [pluginId]: error.message }));
  };

  // Clear plugin error
  const clearError = (pluginId) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[pluginId];
      return newErrors;
    });
  };

  // Resize handling
  useEffect(() => {
    if (!resizable || !isResizing) return;

    const handleMouseMove = (e) => {
      if (!panelRef.current) return;

      const rect = panelRef.current.getBoundingClientRect();
      
      if (position === "right") {
        const newWidth = window.innerWidth - e.clientX;
        setDimensions(prev => ({ 
          ...prev, 
          width: Math.max(200, Math.min(600, newWidth))
        }));
      } else if (position === "left") {
        const newWidth = e.clientX;
        setDimensions(prev => ({ 
          ...prev, 
          width: Math.max(200, Math.min(600, newWidth))
        }));
      } else if (position === "bottom") {
        const newHeight = window.innerHeight - e.clientY;
        setDimensions(prev => ({ 
          ...prev, 
          height: Math.max(150, Math.min(400, newHeight))
        }));
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, position]);

  // Render plugin component
  const renderPluginComponent = (plugin, panelDef) => {
    try {
      const state = pluginStates[plugin.id] || {};
      const error = errors[plugin.id];

      if (error) {
        return (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
            <div className="text-sm text-red-600 mb-3">{error}</div>
            <button
              onClick={() => clearError(plugin.id)}
              className="px-3 py-1 text-xs bg-red-500/10 text-red-600 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors"
            >
              Retry
            </button>
          </div>
        );
      }

      // Mock plugin component rendering - in real implementation, this would
      // use a plugin system to dynamically load and render components
      switch (panelDef.type) {
        case 'iframe':
          return (
            <iframe
              src={panelDef.src}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
              title={panelDef.title}
            />
          );

        case 'react-component':
          // This would dynamically load the plugin's React component
          return (
            <div className="p-4 h-full overflow-auto">
              <div className="text-sm text-app-muted mb-2">
                Plugin Component: {panelDef.component}
              </div>
              <div className="text-xs text-app-muted">
                State: {JSON.stringify(state, null, 2)}
              </div>
            </div>
          );

        case 'webview':
          return (
            <div className="p-4 h-full">
              <div className="text-sm text-app-muted">
                Webview: {panelDef.url}
              </div>
            </div>
          );

        default:
          return (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Settings className="w-8 h-8 mx-auto mb-2 text-app-muted" />
                <div className="text-sm text-app-muted">Unknown panel type</div>
              </div>
            </div>
          );
      }
    } catch (error) {
      handlePluginError(plugin.id, error);
      return null;
    }
  };

  if (availablePanels.length === 0) {
    return null;
  }

  const positionClasses = {
    right: `fixed top-0 right-0 h-full border-l border-app-border`,
    left: `fixed top-0 left-0 h-full border-r border-app-border`,
    bottom: `fixed bottom-0 left-0 right-0 border-t border-app-border`
  };

  const resizeHandleClasses = {
    right: `absolute left-0 top-0 w-1 h-full cursor-col-resize hover:bg-app-accent/50`,
    left: `absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-app-accent/50`,
    bottom: `absolute top-0 left-0 right-0 h-1 cursor-row-resize hover:bg-app-accent/50`
  };

  return (
    <div
      ref={panelRef}
      className={`${positionClasses[position]} bg-app-panel text-app-text z-40 flex flex-col ${className}`}
      style={{
        width: position !== "bottom" ? dimensions.width : undefined,
        height: position === "bottom" ? dimensions.height : undefined,
        transform: collapsed ? (
          position === "right" ? `translateX(${dimensions.width - 40}px)` :
          position === "left" ? `translateX(-${dimensions.width - 40}px)` :
          `translateY(${dimensions.height - 40}px)`
        ) : undefined,
        transition: 'transform 0.2s ease-in-out'
      }}
    >
      {/* Resize Handle */}
      {resizable && !collapsed && (
        <div
          className={resizeHandleClasses[position]}
          onMouseDown={() => setIsResizing(true)}
        />
      )}

      {/* Panel Header */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-app-border bg-app-panel/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 min-w-0">
          {availablePanels.length > 1 && !collapsed && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const currentIndex = availablePanels.findIndex(p => 
                    p.ui.panels.some(panel => panel.id === activePanel)
                  );
                  const prevIndex = currentIndex > 0 ? currentIndex - 1 : availablePanels.length - 1;
                  const prevPanel = availablePanels[prevIndex].ui.panels[0];
                  onPanelChange?.(prevPanel.id);
                }}
                className="p-1 hover:bg-app-bg rounded transition-colors"
                title="Previous panel"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  const currentIndex = availablePanels.findIndex(p => 
                    p.ui.panels.some(panel => panel.id === activePanel)
                  );
                  const nextIndex = (currentIndex + 1) % availablePanels.length;
                  const nextPanel = availablePanels[nextIndex].ui.panels[0];
                  onPanelChange?.(nextPanel.id);
                }}
                className="p-1 hover:bg-app-bg rounded transition-colors"
                title="Next panel"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {!collapsed && currentPanelDef && (
            <span className="text-sm font-medium truncate">
              {currentPanelDef.title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {!collapsed && (
            <>
              {pinned !== undefined && (
                <button
                  onClick={onTogglePin}
                  className={`p-1 hover:bg-app-bg rounded transition-colors ${
                    pinned ? 'text-app-accent' : 'text-app-muted'
                  }`}
                  title={pinned ? 'Unpin panel' : 'Pin panel'}
                >
                  {pinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
                </button>
              )}
              
              <button
                onClick={() => {
                  if (currentPanel) {
                    clearError(currentPanel.id);
                    // Trigger plugin refresh
                  }
                }}
                className="p-1 hover:bg-app-bg rounded transition-colors text-app-muted"
                title="Refresh panel"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
              
              <button
                onClick={onPanelClose}
                className="p-1 hover:bg-app-bg rounded transition-colors text-app-muted"
                title="Close panel"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
          
          <button
            onClick={onToggleCollapse}
            className="p-1 hover:bg-app-bg rounded transition-colors text-app-muted"
            title={collapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {collapsed ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Panel Content */}
      {!collapsed && (
        <div className="flex-1 min-h-0 overflow-hidden">
          {currentPanel && currentPanelDef ? (
            renderPluginComponent(currentPanel, currentPanelDef)
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Settings className="w-8 h-8 mx-auto mb-2 text-app-muted" />
                <div className="text-sm text-app-muted">No panel selected</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Hook for managing plugin panels
export function usePluginPanels() {
  const [panels, setPanels] = useState([]);
  const [activePanel, setActivePanel] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [pinned, setPinned] = useState(false);

  // Load available plugin panels
  useEffect(() => {
    // This would integrate with the plugin system to load available panels
    // For now, return mock data
    const mockPanels = [
      {
        id: 'git-integration',
        name: 'Git Integration',
        enabled: true,
        ui: {
          panels: [
            {
              id: 'git-status',
              title: 'Git Status',
              type: 'react-component',
              component: 'GitStatusPanel'
            }
          ]
        }
      },
      {
        id: 'ai-assistant',
        name: 'AI Assistant',
        enabled: true,
        ui: {
          panels: [
            {
              id: 'ai-chat',
              title: 'AI Chat',
              type: 'react-component',
              component: 'AiChatPanel'
            }
          ]
        }
      }
    ];
    
    setPanels(mockPanels);
    
    // Auto-select first available panel
    if (mockPanels.length > 0 && !activePanel) {
      setActivePanel(mockPanels[0].ui.panels[0].id);
    }
  }, []);

  const openPanel = (panelId) => {
    setActivePanel(panelId);
    setCollapsed(false);
  };

  const closePanel = () => {
    setActivePanel(null);
  };

  const toggleCollapse = () => {
    setCollapsed(!collapsed);
  };

  const togglePin = () => {
    setPinned(!pinned);
  };

  return {
    panels,
    activePanel,
    collapsed,
    pinned,
    openPanel,
    closePanel,
    toggleCollapse,
    togglePin,
    setActivePanel
  };
}