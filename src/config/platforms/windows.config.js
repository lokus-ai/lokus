/**
 * Windows Platform Configuration
 * 
 * All Windows-specific settings and defaults
 */

export const windowsConfig = {
  // Application settings
  app: {
    name: 'Lokus',
    executableName: 'lokus.exe',
    defaultInstallPath: 'C:\\Program Files\\Lokus',
    userDataPath: '%APPDATA%\\Lokus',
    tempPath: '%TEMP%\\Lokus'
  },

  // File management
  files: {
    defaultWorkspacePath: '%USERPROFILE%\\Documents\\Lokus',
    maxPathLength: 260,
    reservedNames: [
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ],
    invalidChars: '<>:"|?*',
    associations: {
      '.md': {
        progId: 'Lokus.Markdown',
        description: 'Markdown Document',
        icon: 'markdown.ico'
      },
      '.markdown': {
        progId: 'Lokus.Markdown',
        description: 'Markdown Document',
        icon: 'markdown.ico'
      }
    }
  },

  // Terminal configuration
  terminal: {
    preferences: [
      {
        name: 'Windows Terminal',
        command: 'wt',
        args: ['-d', '{path}'],
        available: null // Will be checked at runtime
      },
      {
        name: 'PowerShell',
        command: 'powershell',
        args: ['-NoExit', '-Command', 'cd "{path}"'],
        available: null
      },
      {
        name: 'Command Prompt',
        command: 'cmd',
        args: ['/k', 'cd /d "{path}"'],
        available: true // Always available
      }
    ]
  },

  // Keyboard shortcuts
  shortcuts: {
    // Use generic keys, will be converted by platform service
    global: {
      newWindow: 'Ctrl+Shift+N',
      closeWindow: 'Alt+F4',
      minimize: 'Win+Down',
      maximize: 'Win+Up'
    },
    editor: {
      // Windows-specific editor shortcuts
      selectWord: 'Ctrl+D',
      selectLine: 'Ctrl+L',
      deleteLine: 'Ctrl+Shift+K',
      duplicateLine: 'Ctrl+Shift+D',
      moveLineUp: 'Alt+Up',
      moveLineDown: 'Alt+Down'
    }
  },

  // UI/UX settings
  ui: {
    // Windows 11 style
    borderRadius: '8px',
    acrylic: {
      enabled: true,
      tint: 'rgba(255, 255, 255, 0.05)',
      blur: '20px'
    },
    // Windows snap layouts
    snapLayouts: {
      enabled: true,
      zones: ['half-left', 'half-right', 'quarter', 'three-quarter']
    },
    // Context menu style
    contextMenu: {
      style: 'windows11', // or 'classic'
      animations: true,
      icons: true
    }
  },

  // Shell integration
  shell: {
    // Context menu entries
    contextMenu: {
      enabled: true,
      entries: [
        {
          key: 'open_with_lokus',
          title: 'Open with Lokus',
          icon: '%INSTALLDIR%\\lokus.ico',
          command: '"%INSTALLDIR%\\lokus.exe" "%1"'
        }
      ]
    },
    // Jump list
    jumpList: {
      enabled: true,
      maxItems: 10,
      categories: ['Recent', 'Tasks']
    }
  },

  // Notifications
  notifications: {
    provider: 'windows-native',
    defaultSound: 'ms-winsoundevent:Notification.Default',
    badgeSupport: true,
    actionCenter: true
  },

  // Performance
  performance: {
    // Windows-specific performance settings
    directWrite: true,
    hardwareAcceleration: true,
    gpuRasterization: true
  },

  // Features
  features: {
    // Windows-specific features
    windowsHello: false, // Future: biometric authentication
    darkModeSync: true,
    taskbarProgress: true,
    thumbnailToolbar: true,
    aeroSnap: true
  }
};