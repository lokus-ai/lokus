/**
 * Hook for Windows-specific features
 */

import { useEffect, useState, useCallback } from 'react';
import platformService from '../services/platform/PlatformService';
import { windowsFeatures } from '../platform/windows';

export function useWindowsFeatures() {
  const [isWindows] = useState(() => platformService.isWindows());
  const [taskbarProgress, setTaskbarProgress] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(() => 
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  // Initialize Windows features on mount
  useEffect(() => {
    if (!isWindows) return;

    const initFeatures = async () => {
      try {
        const results = await windowsFeatures.initializeWindowsFeatures({
          fileAssociations: true,
          contextMenu: true,
          darkModeSync: true
        });
        
        // Sync dark mode
        const darkMode = await windowsFeatures.themeIntegration.syncDarkMode();
        setIsDarkMode(darkMode);

        // Listen for theme changes
        const unlisten = await windowsFeatures.themeIntegration.onThemeChange((isDark) => {
          setIsDarkMode(isDark);
          // Update document theme attribute
          document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        });

        return () => {
          if (unlisten) unlisten();
          windowsFeatures.cleanupWindowsFeatures();
        };
      } catch { }
    };

    initFeatures();
  }, [isWindows]);

  // Update jump list with recent workspaces
  const updateJumpList = useCallback(async (recentWorkspaces) => {
    if (!isWindows) return;
    
    try {
      await windowsFeatures.jumpList.update(recentWorkspaces);
    } catch { }
  }, [isWindows]);

  // Show Windows notification
  const showNotification = useCallback(async (options) => {
    if (!isWindows) {
      // Fallback to browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(options.title, {
          body: options.body,
          icon: options.icon
        });
      }
      return;
    }

    try {
      return await windowsFeatures.notifications.show(options);
    } catch { }
  }, [isWindows]);

  // Set taskbar progress
  const setProgress = useCallback(async (progress, state = 'normal') => {
    if (!isWindows) return;
    
    setTaskbarProgress(progress);
    
    try {
      await windowsFeatures.taskbarProgress.setProgress(progress, state);
    } catch { }
  }, [isWindows]);

  // Clear taskbar progress
  const clearProgress = useCallback(async () => {
    if (!isWindows) return;
    
    setTaskbarProgress(0);
    
    try {
      await windowsFeatures.taskbarProgress.clear();
    } catch { }
  }, [isWindows]);

  return {
    isWindows,
    isDarkMode,
    taskbarProgress,
    updateJumpList,
    showNotification,
    setProgress,
    clearProgress
  };
}