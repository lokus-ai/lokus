/**
 * Canvas Customization Configuration
 * This shows the extensive customization possibilities for the tldraw canvas
 */

// Custom shapes and tools that can be added
export const customShapeUtils = []
export const customBindingUtils = []

// Custom tool configurations
export const customTools = [
  // You can add custom tools like:
  // {
  //   id: 'custom-tool',
  //   icon: 'custom-icon',
  //   label: 'Custom Tool',
  //   onSelect: () => { /* custom logic */ }
  // }
]

// Canvas appearance configurations
export const canvasConfigs = {
  // Grid configurations
  grid: {
    enabled: true,
    size: 'small', // 'small', 'medium', 'large'
    color: 'rgba(0,0,0,0.1)', // Custom grid color
    style: 'dots', // 'dots', 'lines', 'cross'
  },
  
  // Background patterns
  background: {
    type: 'solid', // 'solid', 'pattern', 'image'
    color: '#ffffff',
    pattern: 'dots', // 'dots', 'lines', 'grid'
    opacity: 0.1
  },
  
  // Canvas bounds and constraints
  bounds: {
    infinite: true,
    minZoom: 0.1,
    maxZoom: 8,
    centerOnLoad: true
  },
  
  // UI customizations
  ui: {
    toolbar: {
      position: 'top', // 'top', 'bottom', 'left', 'right', 'floating'
      style: 'minimal', // 'minimal', 'full', 'compact'
      customTools: true
    },
    panels: {
      showProperties: true,
      showLayers: true,
      showHistory: true
    },
    minimap: {
      enabled: false,
      position: 'bottom-right'
    }
  }
}

// Theme-specific configurations
export const themeConfigs = {
  light: {
    background: 'rgb(var(--canvas-bg))',
    grid: 'var(--canvas-grid)',
    selection: 'var(--accent)',
    text: 'var(--app-text)'
  },
  dark: {
    background: 'rgb(var(--canvas-bg))',
    grid: 'var(--canvas-grid)',
    selection: 'var(--accent)',
    text: 'var(--app-text)'
  }
}

// Custom shape definitions (examples of what's possible)
export const customShapeExamples = {
  // Sticky note shape
  stickyNote: {
    type: 'sticky-note',
    props: {
      w: 200,
      h: 200,
      color: 'yellow',
      text: '',
      font: 'sans',
      size: 'm'
    }
  },
  
  // Flow chart shapes
  flowChart: {
    decision: { type: 'diamond', props: { color: 'blue' } },
    process: { type: 'rectangle', props: { color: 'green' } },
    start_end: { type: 'ellipse', props: { color: 'red' } }
  },
  
  // Mind map node
  mindMapNode: {
    type: 'mind-map-node',
    props: {
      branches: [],
      level: 0,
      expanded: true
    }
  }
}

// Event handlers for customization
export const canvasEvents = {
  onCanvasMount: (editor) => {
    // Custom initialization logic
  },
  
  onShapeCreate: (shape) => {
    // Custom shape creation logic
  },
  
  onSelectionChange: (selection) => {
    // Custom selection handling
  }
}

// Plugin system for extending functionality
export const canvasPlugins = {
  // Auto-save plugin
  autoSave: {
    enabled: true,
    interval: 30000, // 30 seconds
    onSave: (data) => {
    }
  },
  
  // Collaboration plugin
  collaboration: {
    enabled: false,
    server: 'ws://localhost:8080',
    onUserJoin: (user) => {},
    onUserLeave: (user) => {}
  },
  
  // Export plugin
  export: {
    formats: ['png', 'svg', 'pdf', 'json'],
    quality: 'high',
    onExport: (format, data) => {
    }
  }
}

// Animation and interaction configs
export const interactionConfigs = {
  animations: {
    enabled: true,
    duration: 200,
    easing: 'ease-out'
  },
  
  gestures: {
    pinchToZoom: true,
    panToMove: true,
    doubleClickToEdit: true
  },
  
  keyboard: {
    shortcuts: {
      'cmd+z': 'undo',
      'cmd+y': 'redo',
      'cmd+a': 'select-all',
      'cmd+d': 'duplicate',
      'delete': 'delete-selected'
    }
  }
}

// Performance optimizations
export const performanceConfigs = {
  rendering: {
    throttleDraw: true,
    maxShapesVisible: 1000,
    levelOfDetail: true
  },
  
  memory: {
    cacheShapes: true,
    garbageCollect: true,
    maxHistorySize: 100
  }
}

// Integration with Lokus features
export const lokusIntegrations = {
  // Link to markdown files
  markdownLinks: {
    enabled: true,
    onLinkClick: (path) => {
      // Integration with Lokus file system
    }
  },
  
  // Embed other file types
  fileEmbeds: {
    images: ['png', 'jpg', 'svg'],
    videos: ['mp4', 'webm'],
    documents: ['pdf', 'md']
  },
  
  // Search integration
  search: {
    indexContent: true,
    searchableFields: ['text', 'title', 'tags']
  }
}