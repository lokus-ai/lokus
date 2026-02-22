/**
 * OptimizedWrapper.jsx
 *
 * Simple React performance optimizations that actually work
 * No BS, just proven techniques for a seamless experience
 */

import React, { memo, lazy, Suspense, useCallback, useMemo, useRef, useEffect, useState } from 'react';

/**
 * Simple loading component
 */
export const Loading = () => (
  <div className="flex items-center justify-center h-full select-none">
    <div className="text-xl font-bold tracking-tight text-app-accent animate-pulse">Lokus</div>
  </div>
);

/**
 * Lazy load heavy components - this actually helps!
 */
export const LazyEditor = lazy(() => import('../editor'));
export const LazyGraph = lazy(() =>
  import('../views/ProfessionalGraphView.jsx').then(m => ({
    default: m.ProfessionalGraphView
  }))
);
export const LazyCanvas = lazy(() => import('../views/Canvas.jsx'));
export const LazyKanban = lazy(() => import('../components/KanbanBoard.jsx'));
export const LazyPreferences = lazy(() => import('../views/Preferences.jsx'));

/**
 * Simple debounced input that actually works
 */
export const DebouncedInput = memo(({ value, onChange, placeholder = "Search...", delay = 300, ...props }) => {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef();

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback((e) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, delay);
  }, [onChange, delay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <input
      {...props}
      type="text"
      value={localValue}
      onChange={handleChange}
      placeholder={placeholder}
      className="px-3 py-1.5 text-sm bg-app-bg border border-app-border rounded text-app-text placeholder-app-muted focus:outline-none focus:border-app-accent"
    />
  );
});
DebouncedInput.displayName = 'DebouncedInput';

/**
 * Virtual scroll for long lists - simple and effective
 */
export const VirtualScroll = memo(({
  items,
  height = 400,
  itemHeight = 40,
  renderItem,
  overscan = 3
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef();

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + height) / itemHeight) + overscan
  );

  const visibleItems = useMemo(() => {
    const visible = [];
    for (let i = startIndex; i <= endIndex; i++) {
      visible.push(
        <div
          key={i}
          style={{
            position: 'absolute',
            top: i * itemHeight,
            height: itemHeight,
            width: '100%'
          }}
        >
          {renderItem(items[i], i)}
        </div>
      );
    }
    return visible;
  }, [items, startIndex, endIndex, itemHeight, renderItem]);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  return (
    <div
      ref={scrollElementRef}
      onScroll={handleScroll}
      style={{ height, overflow: 'auto', position: 'relative' }}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        {visibleItems}
      </div>
    </div>
  );
});
VirtualScroll.displayName = 'VirtualScroll';

/**
 * Intersection observer wrapper for lazy loading
 */
export const LazyLoad = memo(({ children, rootMargin = '100px', placeholder = <Loading /> }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin]);

  return (
    <div ref={ref}>
      {isVisible ? children : placeholder}
    </div>
  );
});
LazyLoad.displayName = 'LazyLoad';

/**
 * Simple cache hook for expensive computations
 */
export const useCache = (key, fetcher, deps = []) => {
  const cacheRef = useRef(new Map());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cacheKey = JSON.stringify([key, ...deps]);

    if (cacheRef.current.has(cacheKey)) {
      setData(cacheRef.current.get(cacheKey));
      return;
    }

    setLoading(true);

    const fetchData = async () => {
      try {
        const result = await fetcher();
        cacheRef.current.set(cacheKey, result);

        // Limit cache size
        if (cacheRef.current.size > 100) {
          const firstKey = cacheRef.current.keys().next().value;
          cacheRef.current.delete(firstKey);
        }

        setData(result);
      } catch { } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [key, ...deps]);

  return { data, loading };
};

/**
 * Optimized file list with virtual scrolling
 */
export const OptimizedFileList = memo(({ files, selectedFile, onSelect }) => {
  const handleSelect = useCallback((file) => {
    onSelect?.(file);
  }, [onSelect]);

  const renderItem = useCallback((file) => (
    <div
      className={`px-4 py-2 cursor-pointer hover:bg-app-accent/10 ${selectedFile?.path === file.path ? 'bg-app-accent/20' : ''
        }`}
      onClick={() => handleSelect(file)}
    >
      <div className="text-sm text-app-text truncate">{file.name}</div>
    </div>
  ), [selectedFile, handleSelect]);

  // Use virtual scrolling for large file lists
  if (files.length > 100) {
    return (
      <VirtualScroll
        items={files}
        height={600}
        itemHeight={36}
        renderItem={renderItem}
      />
    );
  }

  // Regular rendering for small lists
  return (
    <div className="overflow-auto h-full">
      {files.map((file) => (
        <div key={file.path}>{renderItem(file)}</div>
      ))}
    </div>
  );
});
OptimizedFileList.displayName = 'OptimizedFileList';

/**
 * Request idle callback hook for non-critical updates
 */
export const useIdleCallback = (callback, deps = []) => {
  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const handle = requestIdleCallback(callback);
      return () => cancelIdleCallback(handle);
    } else {
      const handle = setTimeout(callback, 1);
      return () => clearTimeout(handle);
    }
  }, deps);
};

/**
 * Simple performance monitor
 */
export const usePerformance = () => {
  const marks = useRef(new Map());

  const mark = useCallback((name) => {
    performance.mark(name);
    marks.current.set(name, performance.now());
  }, []);

  const measure = useCallback((name, startMark, endMark) => {
    try {
      performance.measure(name, startMark, endMark);
      const measures = performance.getEntriesByName(name, 'measure');
      const duration = measures[measures.length - 1]?.duration || 0;
      return duration;
    } catch (e) {
      return 0;
    }
  }, []);

  return { mark, measure };
};

// Export everything
export default {
  Loading,
  LazyEditor,
  LazyGraph,
  LazyCanvas,
  LazyKanban,
  LazyPreferences,
  DebouncedInput,
  VirtualScroll,
  LazyLoad,
  useCache,
  OptimizedFileList,
  useIdleCallback,
  usePerformance
};