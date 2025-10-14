/**
 * OptimizedComponents.jsx
 *
 * Performance-optimized React components using memo, lazy loading, and virtualization
 */

import React, { memo, lazy, Suspense, useCallback, useMemo } from 'react';

/**
 * Loading fallback component with smooth animation
 */
export const LoadingFallback = memo(({ message = "Loading..." }) => (
  <div className="flex items-center justify-center h-full">
    <div className="flex flex-col items-center gap-3">
      <div className="w-12 h-12 border-4 border-app-accent/30 border-t-app-accent rounded-full animate-spin" />
      <p className="text-sm text-app-muted">{message}</p>
    </div>
  </div>
));
LoadingFallback.displayName = 'LoadingFallback';

/**
 * Lazy-loaded heavy components for code splitting
 */
export const LazyEditor = lazy(() => import('../../editor'));
export const LazyGraph = lazy(() => import('../../views/ProfessionalGraphView.jsx').then(m => ({ default: m.ProfessionalGraphView })));
export const LazyCanvas = lazy(() => import('../../views/Canvas.jsx'));
export const LazyKanban = lazy(() => import('../KanbanBoard.jsx'));
export const LazyGmail = lazy(() => import('../../views/Gmail.jsx'));
export const LazyBasesView = lazy(() => import('../../bases/BasesView.jsx'));
export const LazyPreferences = lazy(() => import('../../views/Preferences.jsx'));

/**
 * Optimized sidebar component with memoization
 */
export const OptimizedSidebar = memo(({
  files,
  selectedFile,
  onFileSelect,
  onCreateFile,
  onCreateFolder,
  searchQuery
}) => {
  // Memoize filtered files based on search query
  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files;
    const query = searchQuery.toLowerCase();
    return files.filter(f =>
      f.name.toLowerCase().includes(query) ||
      f.path.toLowerCase().includes(query)
    );
  }, [files, searchQuery]);

  // Memoize click handlers
  const handleFileClick = useCallback((file) => {
    onFileSelect?.(file);
  }, [onFileSelect]);

  return (
    <div className="h-full overflow-auto">
      {filteredFiles.map(file => (
        <FileItem
          key={file.path}
          file={file}
          isSelected={selectedFile?.path === file.path}
          onClick={handleFileClick}
        />
      ))}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return (
    prevProps.selectedFile?.path === nextProps.selectedFile?.path &&
    prevProps.searchQuery === nextProps.searchQuery &&
    prevProps.files.length === nextProps.files.length &&
    prevProps.files === nextProps.files // Reference equality check
  );
});
OptimizedSidebar.displayName = 'OptimizedSidebar';

/**
 * Memoized file item component
 */
const FileItem = memo(({ file, isSelected, onClick }) => {
  const handleClick = useCallback(() => {
    onClick(file);
  }, [file, onClick]);

  return (
    <div
      className={`px-4 py-2 cursor-pointer hover:bg-app-accent/10 ${
        isSelected ? 'bg-app-accent/20' : ''
      }`}
      onClick={handleClick}
    >
      <span className="text-sm text-app-text truncate">{file.name}</span>
    </div>
  );
});
FileItem.displayName = 'FileItem';

/**
 * Optimized tab bar with memoization
 */
export const OptimizedTabBar = memo(({
  tabs,
  activeTab,
  onTabSelect,
  onTabClose,
  maxTabs = 10
}) => {
  // Memoize visible tabs
  const visibleTabs = useMemo(() =>
    tabs.slice(0, maxTabs),
    [tabs, maxTabs]
  );

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {visibleTabs.map(tab => (
        <Tab
          key={tab.id}
          tab={tab}
          isActive={activeTab === tab.id}
          onSelect={onTabSelect}
          onClose={onTabClose}
        />
      ))}
      {tabs.length > maxTabs && (
        <span className="px-2 text-xs text-app-muted">
          +{tabs.length - maxTabs} more
        </span>
      )}
    </div>
  );
});
OptimizedTabBar.displayName = 'OptimizedTabBar';

/**
 * Memoized tab component
 */
const Tab = memo(({ tab, isActive, onSelect, onClose }) => {
  const handleSelect = useCallback(() => {
    onSelect?.(tab.id);
  }, [tab.id, onSelect]);

  const handleClose = useCallback((e) => {
    e.stopPropagation();
    onClose?.(tab.id);
  }, [tab.id, onClose]);

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded ${
        isActive ? 'bg-app-accent text-white' : 'bg-app-surface hover:bg-app-accent/10'
      }`}
      onClick={handleSelect}
    >
      <span className="text-sm truncate max-w-[150px]">{tab.title}</span>
      <button
        onClick={handleClose}
        className="p-0.5 hover:bg-black/10 rounded"
      >
        ×
      </button>
    </div>
  );
});
Tab.displayName = 'Tab';

/**
 * Virtual scroll wrapper for large lists
 */
export const VirtualList = memo(({
  items,
  itemHeight = 40,
  renderItem,
  height = 400
}) => {
  const [scrollTop, setScrollTop] = React.useState(0);

  // Calculate visible range
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.ceil((scrollTop + height) / itemHeight);
  const visibleItems = items.slice(startIndex, endIndex + 1);

  const totalHeight = items.length * itemHeight;

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  return (
    <div
      className="overflow-auto"
      style={{ height }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map((item, index) => (
          <div
            key={startIndex + index}
            style={{
              position: 'absolute',
              top: (startIndex + index) * itemHeight,
              height: itemHeight,
              width: '100%'
            }}
          >
            {renderItem(item, startIndex + index)}
          </div>
        ))}
      </div>
    </div>
  );
});
VirtualList.displayName = 'VirtualList';

/**
 * Debounced search input for better performance
 */
export const DebouncedSearchInput = memo(({
  placeholder = "Search...",
  delay = 300,
  onSearch
}) => {
  const [value, setValue] = React.useState('');
  const timeoutRef = React.useRef(null);

  const handleChange = useCallback((e) => {
    const newValue = e.target.value;
    setValue(newValue);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      onSearch?.(newValue);
    }, delay);
  }, [delay, onSearch]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className="px-3 py-2 bg-app-surface border border-app-border rounded text-app-text placeholder-app-muted focus:outline-none focus:border-app-accent"
    />
  );
});
DebouncedSearchInput.displayName = 'DebouncedSearchInput';

/**
 * Optimized heavy computation wrapper using Web Worker
 */
export const useWebWorker = (workerScript) => {
  const workerRef = React.useRef(null);
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    workerRef.current = new Worker(workerScript);

    workerRef.current.onmessage = (e) => {
      setResult(e.data);
      setLoading(false);
    };

    workerRef.current.onerror = (e) => {
      setError(e);
      setLoading(false);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, [workerScript]);

  const execute = useCallback((data) => {
    setLoading(true);
    setError(null);
    workerRef.current?.postMessage(data);
  }, []);

  return { execute, result, loading, error };
};

/**
 * Request idle callback wrapper for non-critical updates
 */
export const useIdleCallback = (callback, deps = []) => {
  React.useEffect(() => {
    let handle;

    if ('requestIdleCallback' in window) {
      handle = requestIdleCallback(callback);
    } else {
      handle = setTimeout(callback, 1);
    }

    return () => {
      if ('cancelIdleCallback' in window) {
        cancelIdleCallback(handle);
      } else {
        clearTimeout(handle);
      }
    };
  }, deps);
};

/**
 * Intersection observer for lazy loading
 */
export const LazyLoadWrapper = memo(({ children, rootMargin = '100px' }) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref}>
      {isVisible ? children : <LoadingFallback />}
    </div>
  );
});
LazyLoadWrapper.displayName = 'LazyLoadWrapper';

export default {
  LoadingFallback,
  LazyEditor,
  LazyGraph,
  LazyCanvas,
  LazyKanban,
  LazyGmail,
  LazyBasesView,
  LazyPreferences,
  OptimizedSidebar,
  OptimizedTabBar,
  VirtualList,
  DebouncedSearchInput,
  useWebWorker,
  useIdleCallback,
  LazyLoadWrapper
};