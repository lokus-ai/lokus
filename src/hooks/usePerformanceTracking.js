import { useEffect, useRef, useCallback } from 'react';
import { perfTracker, EVENT_TYPES } from '../utils/performance';

/**
 * React hook for tracking component and module performance
 *
 * Usage:
 * ```jsx
 * function MyComponent() {
 *   const { trackOperation, startTimer, endTimer } = usePerformanceTracking('MyComponent');
 *
 *   useEffect(() => {
 *     trackOperation('Load Data', async () => {
 *       const data = await fetchData();
 *       setData(data);
 *     }, { itemCount: data.length });
 *   }, []);
 * }
 * ```
 */
export function usePerformanceTracking(moduleName, options = {}) {
  const {
    trackMount = false,
    trackUnmount = false,
    eventType = EVENT_TYPES.COMPONENT_RENDER
  } = options;

  const mountTimeRef = useRef(null);
  const unmountTimeRef = useRef(null);

  // Track component mount time
  useEffect(() => {
    if (trackMount) {
      mountTimeRef.current = performance.now();
    }

    return () => {
      if (trackUnmount && mountTimeRef.current) {
        const duration = Math.round(performance.now() - mountTimeRef.current);
        perfTracker.logEvent(
          eventType,
          `${moduleName} Lifecycle`,
          duration,
          { phase: 'unmount' }
        );
      }
    };
  }, [moduleName, trackMount, trackUnmount, eventType]);

  // Track an async operation
  const trackOperation = useCallback(
    async (label, fn, metadata = null) => {
      return perfTracker.trackAsync(
        `${moduleName}: ${label}`,
        fn,
        eventType,
        metadata
      );
    },
    [moduleName, eventType]
  );

  // Track a sync operation
  const trackOperationSync = useCallback(
    (label, fn, metadata = null) => {
      return perfTracker.trackSync(
        `${moduleName}: ${label}`,
        fn,
        eventType,
        metadata
      );
    },
    [moduleName, eventType]
  );

  // Start a timer
  const startTimer = useCallback(
    (label) => {
      perfTracker.startTimer(`${moduleName}: ${label}`);
    },
    [moduleName]
  );

  // End a timer
  const endTimer = useCallback(
    (label, metadata = null) => {
      perfTracker.endTimer(`${moduleName}: ${label}`, eventType, metadata);
    },
    [moduleName, eventType]
  );

  // Log a custom event
  const logEvent = useCallback(
    (operation, durationMs, metadata = null) => {
      perfTracker.logEvent(
        eventType,
        `${moduleName}: ${operation}`,
        durationMs,
        metadata
      );
    },
    [moduleName, eventType]
  );

  return {
    trackOperation,
    trackOperationSync,
    startTimer,
    endTimer,
    logEvent
  };
}

/**
 * Hook specifically for tracking module initialization during startup
 * Automatically tracks the time from hook mount to when you call markReady()
 *
 * Usage:
 * ```jsx
 * function ThemeProvider({ children }) {
 *   const { markReady } = useModuleStartup('Theme System');
 *
 *   useEffect(() => {
 *     // Do initialization work...
 *     loadThemes();
 *     applyTheme();
 *
 *     // Mark as ready
 *     markReady({ themeCount: themes.length });
 *   }, []);
 * }
 * ```
 */
export function useModuleStartup(moduleName) {
  const startTimeRef = useRef(performance.now());
  const markedRef = useRef(false);

  const markReady = useCallback(
    async (metadata = null) => {
      if (markedRef.current) return; // Already marked
      markedRef.current = true;

      const duration = Math.round(performance.now() - startTimeRef.current);
      await perfTracker.markStartupPhase(moduleName, duration);

      // Also queue as a regular event for the events stream
      perfTracker.logEvent(
        EVENT_TYPES.MODULE_INIT,
        moduleName,
        duration,
        metadata
      );
    },
    [moduleName]
  );

  return { markReady };
}

/**
 * Hook for tracking Context Provider initialization
 * Automatically marks as ready when deps change (usually when loading completes)
 *
 * Usage:
 * ```jsx
 * function PluginProvider({ children }) {
 *   const [plugins, setPlugins] = useState([]);
 *   const [loading, setLoading] = useState(true);
 *
 *   useProviderStartup('Plugin System', !loading, { pluginCount: plugins.length });
 *
 *   useEffect(() => {
 *     loadPlugins().then(p => {
 *       setPlugins(p);
 *       setLoading(false);
 *     });
 *   }, []);
 * }
 * ```
 */
export function useProviderStartup(moduleName, isReady, metadata = null) {
  const startTimeRef = useRef(performance.now());
  const markedRef = useRef(false);

  useEffect(() => {
    if (isReady && !markedRef.current) {
      markedRef.current = true;

      const duration = Math.round(performance.now() - startTimeRef.current);

      // Mark as startup phase
      perfTracker.markStartupPhase(moduleName, duration);

      // Also queue as regular event
      perfTracker.logEvent(
        EVENT_TYPES.MODULE_INIT,
        moduleName,
        duration,
        metadata
      );
    }
  }, [isReady, moduleName, metadata]);
}

/**
 * Hook for tracking file operations with automatic metadata
 *
 * Usage:
 * ```jsx
 * const { trackFileOp } = useFileOperationTracking();
 *
 * const loadFile = async (path) => {
 *   return trackFileOp('load', path, async () => {
 *     const content = await invoke('read_file', { path });
 *     return content;
 *   });
 * };
 * ```
 */
export function useFileOperationTracking() {
  const trackFileOp = useCallback(
    async (operation, filePath, fn) => {
      const fileName = filePath.split('/').pop();
      const extension = fileName.includes('.') ? fileName.split('.').pop() : 'unknown';

      return perfTracker.trackAsync(
        `File ${operation}: ${fileName}`,
        fn,
        EVENT_TYPES.FILE_OP,
        {
          operation,
          filePath,
          extension
        }
      );
    },
    []
  );

  return { trackFileOp };
}

/**
 * Hook for tracking search operations
 */
export function useSearchTracking(searchEngine = 'default') {
  const trackSearch = useCallback(
    async (query, fn) => {
      return perfTracker.trackAsync(
        `Search: ${query.substring(0, 30)}...`,
        fn,
        EVENT_TYPES.SEARCH,
        {
          query,
          queryLength: query.length,
          engine: searchEngine
        }
      );
    },
    [searchEngine]
  );

  return { trackSearch };
}

/**
 * Hook for tracking plugin actions
 */
export function usePluginTracking(pluginName) {
  const trackAction = useCallback(
    async (actionName, fn, metadata = null) => {
      return perfTracker.trackAsync(
        `${pluginName}: ${actionName}`,
        fn,
        EVENT_TYPES.PLUGIN_ACTION,
        {
          ...metadata,
          plugin: pluginName,
          action: actionName
        }
      );
    },
    [pluginName]
  );

  return { trackAction };
}
