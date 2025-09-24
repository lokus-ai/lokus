/**
 * macOS Platform Configuration
 * 
 * All macOS-specific settings and defaults
 */

export const macosConfig = {
  // Application settings
  app: {
    name: 'Lokus',
    bundleId: 'com.lokus.app',
    defaultInstallPath: '/Applications/Lokus.app',
    userDataPath: '~/Library/Application Support/Lokus',
    tempPath: '~/Library/Caches/Lokus'
  },

  // File management
  files: {
    defaultWorkspacePath: '~/Documents/Lokus',
    maxPathLength: 1024, // HFS+ supports much longer paths
    invalidChars: ':/',
    hiddenFilePrefix: '.',
    associations: {
      '.md': {
        bundleId: 'com.lokus.markdown',
        description: 'Markdown Document',
        icon: 'markdown.icns'
      },
      '.markdown': {
        bundleId: 'com.lokus.markdown',
        description: 'Markdown Document',
        icon: 'markdown.icns'
      }
    }
  },

  // Terminal configuration
  terminal: {
    preferences: [
      {
        name: 'Terminal',
        command: 'open',
        args: ['-a', 'Terminal', '{path}'],
        available: true
      },
      {
        name: 'iTerm2',
        command: 'open',
        args: ['-a', 'iTerm', '{path}'],
        available: null // Will be checked at runtime
      }
    ]
  },

  // Keyboard shortcuts
  shortcuts: {
    // macOS system shortcuts
    global: {
      newWindow: 'Cmd+Shift+N',
      closeWindow: 'Cmd+Shift+W',
      minimize: 'Cmd+M',
      hideApp: 'Cmd+H',
      hideOthers: 'Cmd+Option+H',
      fullscreen: 'Cmd+Control+F'
    },
    editor: {
      // macOS-specific editor shortcuts
      selectWord: 'Cmd+D',
      selectLine: 'Cmd+L',
      deleteLine: 'Cmd+Shift+K',
      duplicateLine: 'Cmd+Shift+D',
      moveLineUp: 'Option+Up',
      moveLineDown: 'Option+Down',
      // macOS text navigation
      beginningOfLine: 'Cmd+Left',
      endOfLine: 'Cmd+Right',
      previousWord: 'Option+Left',
      nextWord: 'Option+Right'
    }
  },

  // UI/UX settings
  ui: {
    // macOS Big Sur+ style
    borderRadius: '10px',
    vibrancy: {
      enabled: true,
      material: 'sidebar', // 'sidebar', 'selection', 'menu', 'popover', 'header'
      blendingMode: 'behind-window'
    },
    // Traffic lights
    trafficLights: {
      position: { x: 12, y: 12 },
      spacing: 8
    },
    // Context menu style
    contextMenu: {
      style: 'native',
      backdropFilter: true,
      animations: true
    }
  },

  // Finder integration
  finder: {
    // Quick Look support
    quickLook: {
      enabled: true,
      generator: 'com.lokus.quicklook'
    },
    // Context menu
    contextMenu: {
      enabled: true,
      entries: [
        {
          title: 'Open with Lokus',
          command: 'open -a Lokus "%@"',
          when: 'markdown'
        }
      ]
    },
    // Tags support
    tags: {
      enabled: true,
      sync: true
    }
  },

  // Dock integration
  dock: {
    // Badge support
    badge: {
      enabled: true,
      type: 'count' // 'count' or 'dot'
    },
    // Progress indicator
    progress: {
      enabled: true
    },
    // Bounce on notification
    bounce: {
      enabled: true,
      critical: true
    }
  },

  // Touch Bar configuration
  touchBar: {
    enabled: true,
    items: [
      { type: 'button', id: 'new-note', label: 'New Note', icon: 'plus' },
      { type: 'button', id: 'search', label: 'Search', icon: 'search' },
      { type: 'spacer', size: 'flexible' },
      { type: 'colorPicker', id: 'highlight' },
      { type: 'button', id: 'preview', label: 'Preview', icon: 'eye' }
    ]
  },

  // Notifications
  notifications: {
    provider: 'macos-native',
    sound: 'default',
    badgeSupport: true,
    notificationCenter: true
  },

  // Performance
  performance: {
    // macOS-specific performance settings
    metalAcceleration: true,
    coreAnimation: true
  },

  // Features
  features: {
    // macOS-specific features
    continuity: {
      handoff: true,
      universalClipboard: true,
      continuityCamera: false
    },
    touchId: false, // Future: biometric authentication
    darkModeSync: true,
    quickNote: true,
    spotlight: {
      indexing: true,
      searchable: true
    },
    services: {
      enabled: true,
      entries: ['Create Lokus Note', 'Add to Lokus']
    }
  },

  // iCloud integration
  icloud: {
    enabled: false, // Future feature
    containerIdentifier: 'iCloud.com.lokus.app',
    syncFolders: ['Notes', 'Templates', 'Settings']
  }
};