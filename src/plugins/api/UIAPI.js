/**
 * UIAPI.js - Comprehensive UI Plugin Interface
 * 
 * Provides a flexible system for plugins to extend the Lokus UI with:
 * - Custom panels (sidebar-left, sidebar-right, bottom, floating, modal)
 * - Context menus and toolbars
 * - Command palette items
 * - Status bar components
 * - Editor overlays and decorations
 */

import { EventEmitter } from '../../utils/EventEmitter.js';

// Panel position constants
export const PANEL_POSITIONS = {
  SIDEBAR_LEFT: 'sidebar-left',
  SIDEBAR_RIGHT: 'sidebar-right', 
  BOTTOM: 'bottom',
  FLOATING: 'floating',
  MODAL: 'modal',
  EDITOR_OVERLAY: 'editor-overlay'
};

// Panel types
export const PANEL_TYPES = {
  WEBVIEW: 'webview',
  REACT: 'react',
  IFRAME: 'iframe',
  CUSTOM: 'custom'
};

// UI component types
export const UI_COMPONENT_TYPES = {
  PANEL: 'panel',
  TOOLBAR: 'toolbar',
  MENU: 'menu',
  STATUS_BAR_ITEM: 'statusBarItem',
  CONTEXT_MENU: 'contextMenu',
  COMMAND_PALETTE_ITEM: 'commandPaletteItem'
};

export class UIPanel {
  constructor(definition) {
    this.id = definition.id;
    this.pluginId = definition.pluginId;
    this.title = definition.title;
    this.type = definition.type || PANEL_TYPES.REACT;
    this.position = definition.position || PANEL_POSITIONS.SIDEBAR_LEFT;
    this.icon = definition.icon;
    this.component = definition.component;
    this.props = definition.props || {};
    this.initialSize = definition.initialSize || { width: 300, height: 400 };
    this.minSize = definition.minSize || { width: 200, height: 200 };
    this.maxSize = definition.maxSize || { width: 800, height: 600 };
    this.resizable = definition.resizable !== false;
    this.closable = definition.closable !== false;
    this.visible = definition.visible !== false;
    this.order = definition.order || 100;
    this.when = definition.when; // Conditional visibility
    this.settings = definition.settings || {};
    this.persistence = definition.persistence || { savePosition: true, saveSize: true, saveVisibility: true };
    
    // Panel state
    this.isActive = false;
    this.isDocked = true;
    this.currentSize = { ...this.initialSize };
    this.currentPosition = null;
    
    // Event emitter for panel events
    this.events = new EventEmitter();
  }

  // Panel lifecycle methods
  show() {
    this.visible = true;
    this.events.emit('visibility-changed', { visible: true });
  }

  hide() {
    this.visible = false;
    this.events.emit('visibility-changed', { visible: false });
  }

  toggle() {
    this.visible ? this.hide() : this.show();
  }

  activate() {
    this.isActive = true;
    this.events.emit('activated');
  }

  deactivate() {
    this.isActive = false;
    this.events.emit('deactivated');
  }

  resize(size) {
    const clampedSize = {
      width: Math.max(this.minSize.width, Math.min(this.maxSize.width, size.width)),
      height: Math.max(this.minSize.height, Math.min(this.maxSize.height, size.height))
    };
    this.currentSize = clampedSize;
    this.events.emit('resized', clampedSize);
  }

  updatePosition(position) {
    this.currentPosition = position;
    this.events.emit('position-changed', position);
  }

  dock() {
    this.isDocked = true;
    this.events.emit('docked');
  }

  undock() {
    this.isDocked = false;
    this.events.emit('undocked');
  }

  // Settings management
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.events.emit('settings-changed', this.settings);
  }

  getSetting(key, defaultValue = null) {
    return this.settings[key] !== undefined ? this.settings[key] : defaultValue;
  }

  // Serialization for persistence
  serialize() {
    return {
      id: this.id,
      pluginId: this.pluginId,
      visible: this.visible,
      isActive: this.isActive,
      isDocked: this.isDocked,
      currentSize: this.currentSize,
      currentPosition: this.currentPosition,
      settings: this.settings
    };
  }

  deserialize(data) {
    if (this.persistence.saveVisibility) this.visible = data.visible;
    if (this.persistence.saveSize) this.currentSize = data.currentSize || this.currentSize;
    if (this.persistence.savePosition) this.currentPosition = data.currentPosition;
    this.isActive = data.isActive || false;
    this.isDocked = data.isDocked !== false;
    this.settings = { ...this.settings, ...data.settings };
  }
}

export class UIToolbar {
  constructor(definition) {
    this.id = definition.id;
    this.pluginId = definition.pluginId;
    this.title = definition.title;
    this.location = definition.location || 'main'; // main, editor, floating
    this.items = definition.items || [];
    this.order = definition.order || 100;
    this.visible = definition.visible !== false;
    this.when = definition.when;
    this.orientation = definition.orientation || 'horizontal'; // horizontal, vertical
  }

  addItem(item) {
    this.items.push(item);
  }

  removeItem(itemId) {
    this.items = this.items.filter(item => item.id !== itemId);
  }

  updateItem(itemId, updates) {
    const item = this.items.find(item => item.id === itemId);
    if (item) {
      Object.assign(item, updates);
    }
  }
}

export class UIContextMenu {
  constructor(definition) {
    this.id = definition.id;
    this.pluginId = definition.pluginId;
    this.target = definition.target; // CSS selector or element type
    this.items = definition.items || [];
    this.when = definition.when;
    this.order = definition.order || 100;
  }

  addItem(item) {
    this.items.push(item);
  }

  removeItem(itemId) {
    this.items = this.items.filter(item => item.id !== itemId);
  }
}

export class UIStatusBarItem {
  constructor(definition) {
    this.id = definition.id;
    this.pluginId = definition.pluginId;
    this.text = definition.text || '';
    this.tooltip = definition.tooltip;
    this.command = definition.command;
    this.icon = definition.icon;
    this.alignment = definition.alignment || 'left'; // left, center, right
    this.priority = definition.priority || 100;
    this.when = definition.when;
    this.style = definition.style || {};
    this.visible = definition.visible !== false;
  }

  updateText(text) {
    this.text = text;
  }

  updateTooltip(tooltip) {
    this.tooltip = tooltip;
  }

  updateStyle(style) {
    this.style = { ...this.style, ...style };
  }
}

/**
 * Main UIAPI class for managing all UI extensions
 */
export class UIAPI extends EventEmitter {
  constructor() {
    super();
    
    // Registries for different UI components
    this.panels = new Map();
    this.toolbars = new Map();
    this.contextMenus = new Map();
    this.statusBarItems = new Map();
    this.commandPaletteItems = new Map();
    
    // Plugin tracking
    this.pluginContributions = new Map();
    
    // UI state
    this.activePanel = null;
    this.panelLayout = this.getDefaultLayout();
    this.theme = 'default';
    
    // Settings
    this.settings = {
      enableAnimations: true,
      enablePersistence: true,
      maxFloatingPanels: 5,
      defaultPanelSize: { width: 300, height: 400 }
    };
  }

  // === PANEL MANAGEMENT ===

  /**
   * Register a new UI panel
   */
  registerPanel(pluginId, panelDefinition) {
    this.validatePluginId(pluginId);
    this.validatePanelDefinition(panelDefinition);

    const panelId = `${pluginId}.${panelDefinition.id}`;
    const panel = new UIPanel({
      ...panelDefinition,
      id: panelId,
      pluginId
    });

    // Check for existing panel
    if (this.panels.has(panelId)) {
      throw new Error(`Panel ${panelId} is already registered`);
    }

    this.panels.set(panelId, panel);
    this.trackContribution(pluginId, UI_COMPONENT_TYPES.PANEL, panelId);

    // Load persisted state if available
    if (this.settings.enablePersistence) {
      const persistedState = this.loadPanelState(panelId);
      if (persistedState) {
        panel.deserialize(persistedState);
      }
    }

    this.emit('panel-registered', { pluginId, panel });
    return panel;
  }

  /**
   * Unregister a panel
   */
  unregisterPanel(panelId) {
    const panel = this.panels.get(panelId);
    if (!panel) {
      throw new Error(`Panel ${panelId} not found`);
    }

    // Save state before removal
    if (this.settings.enablePersistence) {
      this.savePanelState(panelId, panel.serialize());
    }

    this.panels.delete(panelId);
    this.emit('panel-unregistered', { panelId, panel });
  }

  /**
   * Get a panel by ID
   */
  getPanel(panelId) {
    return this.panels.get(panelId);
  }

  /**
   * Get all panels for a specific position
   */
  getPanelsForPosition(position) {
    return Array.from(this.panels.values())
      .filter(panel => panel.position === position && panel.visible)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Get all visible panels
   */
  getVisiblePanels() {
    return Array.from(this.panels.values()).filter(panel => panel.visible);
  }

  /**
   * Show a panel
   */
  showPanel(panelId) {
    const panel = this.getPanel(panelId);
    if (!panel) {
      throw new Error(`Panel ${panelId} not found`);
    }

    panel.show();
    this.emit('panel-shown', { panelId, panel });
  }

  /**
   * Hide a panel
   */
  hidePanel(panelId) {
    const panel = this.getPanel(panelId);
    if (!panel) {
      throw new Error(`Panel ${panelId} not found`);
    }

    panel.hide();
    this.emit('panel-hidden', { panelId, panel });
  }

  /**
   * Toggle panel visibility
   */
  togglePanel(panelId) {
    const panel = this.getPanel(panelId);
    if (!panel) {
      throw new Error(`Panel ${panelId} not found`);
    }

    panel.toggle();
    this.emit('panel-toggled', { panelId, panel, visible: panel.visible });
  }

  /**
   * Activate a panel (bring to front, focus)
   */
  activatePanel(panelId) {
    const panel = this.getPanel(panelId);
    if (!panel) {
      throw new Error(`Panel ${panelId} not found`);
    }

    // Deactivate current active panel
    if (this.activePanel && this.activePanel !== panel) {
      this.activePanel.deactivate();
    }

    panel.activate();
    this.activePanel = panel;
    this.emit('panel-activated', { panelId, panel });
  }

  /**
   * Resize a panel
   */
  resizePanel(panelId, size) {
    const panel = this.getPanel(panelId);
    if (!panel) {
      throw new Error(`Panel ${panelId} not found`);
    }

    if (!panel.resizable) {
      throw new Error(`Panel ${panelId} is not resizable`);
    }

    panel.resize(size);
    this.emit('panel-resized', { panelId, panel, size });
  }

  /**
   * Move a panel to a new position
   */
  movePanel(panelId, newPosition, coordinates = null) {
    const panel = this.getPanel(panelId);
    if (!panel) {
      throw new Error(`Panel ${panelId} not found`);
    }

    const oldPosition = panel.position;
    panel.position = newPosition;
    
    if (coordinates) {
      panel.updatePosition(coordinates);
    }

    this.emit('panel-moved', { panelId, panel, oldPosition, newPosition, coordinates });
  }

  // === TOOLBAR MANAGEMENT ===

  /**
   * Register a toolbar
   */
  registerToolbar(pluginId, toolbarDefinition) {
    this.validatePluginId(pluginId);
    
    const toolbarId = `${pluginId}.${toolbarDefinition.id}`;
    const toolbar = new UIToolbar({
      ...toolbarDefinition,
      id: toolbarId,
      pluginId
    });

    if (this.toolbars.has(toolbarId)) {
      throw new Error(`Toolbar ${toolbarId} is already registered`);
    }

    this.toolbars.set(toolbarId, toolbar);
    this.trackContribution(pluginId, UI_COMPONENT_TYPES.TOOLBAR, toolbarId);

    this.emit('toolbar-registered', { pluginId, toolbar });
    return toolbar;
  }

  /**
   * Get toolbars for a specific location
   */
  getToolbarsForLocation(location) {
    return Array.from(this.toolbars.values())
      .filter(toolbar => toolbar.location === location && toolbar.visible)
      .sort((a, b) => a.order - b.order);
  }

  // === CONTEXT MENU MANAGEMENT ===

  /**
   * Register a context menu
   */
  registerContextMenu(pluginId, contextMenuDefinition) {
    this.validatePluginId(pluginId);
    
    const menuId = `${pluginId}.${contextMenuDefinition.id}`;
    const contextMenu = new UIContextMenu({
      ...contextMenuDefinition,
      id: menuId,
      pluginId
    });

    if (this.contextMenus.has(menuId)) {
      throw new Error(`Context menu ${menuId} is already registered`);
    }

    this.contextMenus.set(menuId, contextMenu);
    this.trackContribution(pluginId, UI_COMPONENT_TYPES.CONTEXT_MENU, menuId);

    this.emit('context-menu-registered', { pluginId, contextMenu });
    return contextMenu;
  }

  /**
   * Get context menus for a specific target
   */
  getContextMenusForTarget(target) {
    return Array.from(this.contextMenus.values())
      .filter(menu => this.matchesTarget(menu.target, target))
      .sort((a, b) => a.order - b.order);
  }

  // === STATUS BAR MANAGEMENT ===

  /**
   * Register a status bar item
   */
  registerStatusBarItem(pluginId, statusBarDefinition) {
    this.validatePluginId(pluginId);
    
    const itemId = `${pluginId}.${statusBarDefinition.id}`;
    const statusBarItem = new UIStatusBarItem({
      ...statusBarDefinition,
      id: itemId,
      pluginId
    });

    if (this.statusBarItems.has(itemId)) {
      throw new Error(`Status bar item ${itemId} is already registered`);
    }

    this.statusBarItems.set(itemId, statusBarItem);
    this.trackContribution(pluginId, UI_COMPONENT_TYPES.STATUS_BAR_ITEM, itemId);

    this.emit('status-bar-item-registered', { pluginId, statusBarItem });
    return statusBarItem;
  }

  /**
   * Get status bar items by alignment
   */
  getStatusBarItemsByAlignment(alignment) {
    return Array.from(this.statusBarItems.values())
      .filter(item => item.alignment === alignment && item.visible)
      .sort((a, b) => a.priority - b.priority);
  }

  // === COMMAND PALETTE MANAGEMENT ===

  /**
   * Register a command palette item
   */
  registerCommandPaletteItem(pluginId, commandDefinition) {
    this.validatePluginId(pluginId);
    
    const commandId = `${pluginId}.${commandDefinition.id}`;
    const command = {
      ...commandDefinition,
      id: commandId,
      pluginId
    };

    if (this.commandPaletteItems.has(commandId)) {
      throw new Error(`Command palette item ${commandId} is already registered`);
    }

    this.commandPaletteItems.set(commandId, command);
    this.trackContribution(pluginId, UI_COMPONENT_TYPES.COMMAND_PALETTE_ITEM, commandId);

    this.emit('command-palette-item-registered', { pluginId, command });
    return command;
  }

  /**
   * Search command palette items
   */
  searchCommandPaletteItems(query) {
    const items = Array.from(this.commandPaletteItems.values());
    if (!query) return items;

    const queryLower = query.toLowerCase();
    return items.filter(item => 
      item.title.toLowerCase().includes(queryLower) ||
      item.description?.toLowerCase().includes(queryLower) ||
      item.keywords?.some(keyword => keyword.toLowerCase().includes(queryLower))
    );
  }

  // === LAYOUT MANAGEMENT ===

  /**
   * Get default panel layout
   */
  getDefaultLayout() {
    return {
      [PANEL_POSITIONS.SIDEBAR_LEFT]: {
        visible: true,
        width: 300,
        panels: []
      },
      [PANEL_POSITIONS.SIDEBAR_RIGHT]: {
        visible: false,
        width: 300,
        panels: []
      },
      [PANEL_POSITIONS.BOTTOM]: {
        visible: false,
        height: 200,
        panels: []
      },
      [PANEL_POSITIONS.FLOATING]: {
        panels: []
      },
      [PANEL_POSITIONS.MODAL]: {
        panels: []
      }
    };
  }

  /**
   * Save current layout
   */
  saveLayout() {
    if (!this.settings.enablePersistence) return;

    const layout = {
      ...this.panelLayout,
      panels: Object.fromEntries(
        Array.from(this.panels.entries()).map(([id, panel]) => [
          id, panel.serialize()
        ])
      )
    };

    try {
      localStorage.setItem('lokus-ui-layout', JSON.stringify(layout));
    } catch (error) {
      console.warn('Failed to save UI layout:', error);
    }
  }

  /**
   * Load saved layout
   */
  loadLayout() {
    if (!this.settings.enablePersistence) return;

    try {
      const saved = localStorage.getItem('lokus-ui-layout');
      if (saved) {
        const layout = JSON.parse(saved);
        this.panelLayout = { ...this.getDefaultLayout(), ...layout };
        
        // Restore panel states
        if (layout.panels) {
          for (const [panelId, panelState] of Object.entries(layout.panels)) {
            const panel = this.panels.get(panelId);
            if (panel) {
              panel.deserialize(panelState);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load UI layout:', error);
    }
  }

  // === THEME SUPPORT ===

  /**
   * Set UI theme
   */
  setTheme(theme) {
    this.theme = theme;
    this.emit('theme-changed', { theme });
  }

  /**
   * Get current theme
   */
  getTheme() {
    return this.theme;
  }

  // === UTILITY METHODS ===

  /**
   * Validate plugin ID
   */
  validatePluginId(pluginId) {
    if (!pluginId || typeof pluginId !== 'string') {
      throw new Error('Plugin ID must be a non-empty string');
    }
  }

  /**
   * Validate panel definition
   */
  validatePanelDefinition(definition) {
    if (!definition || typeof definition !== 'object') {
      throw new Error('Panel definition must be an object');
    }

    if (!definition.id || typeof definition.id !== 'string') {
      throw new Error('Panel definition must have a valid ID');
    }

    if (!definition.title || typeof definition.title !== 'string') {
      throw new Error('Panel definition must have a valid title');
    }

    if (definition.position && !Object.values(PANEL_POSITIONS).includes(definition.position)) {
      throw new Error(`Invalid panel position: ${definition.position}`);
    }

    if (definition.type && !Object.values(PANEL_TYPES).includes(definition.type)) {
      throw new Error(`Invalid panel type: ${definition.type}`);
    }
  }

  /**
   * Track plugin contributions for cleanup
   */
  trackContribution(pluginId, type, contributionId) {
    if (!this.pluginContributions.has(pluginId)) {
      this.pluginContributions.set(pluginId, new Set());
    }
    
    this.pluginContributions.get(pluginId).add(`${type}:${contributionId}`);
  }

  /**
   * Check if target matches menu target selector
   */
  matchesTarget(selector, target) {
    if (typeof selector === 'string') {
      // CSS selector
      return target.matches && target.matches(selector);
    } else if (typeof selector === 'function') {
      // Function that returns boolean
      return selector(target);
    }
    return false;
  }

  /**
   * Save panel state to localStorage
   */
  savePanelState(panelId, state) {
    try {
      const key = `lokus-panel-${panelId}`;
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn(`Failed to save panel state for ${panelId}:`, error);
    }
  }

  /**
   * Load panel state from localStorage
   */
  loadPanelState(panelId) {
    try {
      const key = `lokus-panel-${panelId}`;
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.warn(`Failed to load panel state for ${panelId}:`, error);
      return null;
    }
  }

  // === CLEANUP ===

  /**
   * Unregister all contributions from a plugin
   */
  unregisterPlugin(pluginId) {
    const contributions = this.pluginContributions.get(pluginId);
    if (!contributions) return;

    for (const contribution of contributions) {
      const [type, id] = contribution.split(':', 2);
      
      switch (type) {
        case UI_COMPONENT_TYPES.PANEL:
          this.panels.delete(id);
          break;
        case UI_COMPONENT_TYPES.TOOLBAR:
          this.toolbars.delete(id);
          break;
        case UI_COMPONENT_TYPES.CONTEXT_MENU:
          this.contextMenus.delete(id);
          break;
        case UI_COMPONENT_TYPES.STATUS_BAR_ITEM:
          this.statusBarItems.delete(id);
          break;
        case UI_COMPONENT_TYPES.COMMAND_PALETTE_ITEM:
          this.commandPaletteItems.delete(id);
          break;
      }
    }

    this.pluginContributions.delete(pluginId);
    this.emit('plugin-unregistered', { pluginId });
  }

  /**
   * Get statistics about registered UI components
   */
  getStats() {
    return {
      panels: this.panels.size,
      toolbars: this.toolbars.size,
      contextMenus: this.contextMenus.size,
      statusBarItems: this.statusBarItems.size,
      commandPaletteItems: this.commandPaletteItems.size,
      totalPlugins: this.pluginContributions.size,
      visiblePanels: this.getVisiblePanels().length,
      activePanel: this.activePanel?.id || null
    };
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    // Save current state
    this.saveLayout();
    
    // Clear all registrations
    this.panels.clear();
    this.toolbars.clear();
    this.contextMenus.clear();
    this.statusBarItems.clear();
    this.commandPaletteItems.clear();
    this.pluginContributions.clear();
    
    // Remove event listeners
    this.removeAllListeners();
  }
}

// Export singleton instance
export const uiAPI = new UIAPI();

// Export default
export default {
  UIAPI,
  UIPanel,
  UIToolbar,
  UIContextMenu,
  UIStatusBarItem,
  PANEL_POSITIONS,
  PANEL_TYPES,
  UI_COMPONENT_TYPES,
  uiAPI
};