import { useState, useRef, useCallback, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { isMobile } from '../../platform';
import '../../styles/pull-to-refresh.css';

export const PULL_THRESHOLD = 80;
export const MAX_PULL_DISTANCE = 120;
const RUBBER_BAND_FACTOR = 0.5;

export function PullToRefresh({ children, onRefresh, disabled = false }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const containerRef = useRef(null);
  const touchStartY = useRef(0);
  const isAtTop = useRef(true);

  if (!isMobile()) {
    return children;
  }

  const checkScrollPosition = useCallback(() => {
    if (containerRef.current) {
      isAtTop.current = containerRef.current.scrollTop <= 0;
    }
  }, []);

  const calculatePullDistance = useCallback((rawDistance) => {
    if (rawDistance <= PULL_THRESHOLD) {
      return rawDistance;
    }
    const overflow = rawDistance - PULL_THRESHOLD;
    return PULL_THRESHOLD + (overflow * RUBBER_BAND_FACTOR);
  }, []);

  const handleTouchStart = useCallback((e) => {
    if (disabled || isRefreshing) return;
    checkScrollPosition();
    if (!isAtTop.current) return;
    touchStartY.current = e.touches[0].clientY;
    setIsPulling(true);
  }, [disabled, isRefreshing, checkScrollPosition]);

  const handleTouchMove = useCallback((e) => {
    if (disabled || isRefreshing || !isPulling) return;
    if (!isAtTop.current) {
      setPullDistance(0);
      return;
    }
    const currentY = e.touches[0].clientY;
    const rawDistance = currentY - touchStartY.current;
    if (rawDistance > 0) {
      const distance = calculatePullDistance(rawDistance);
      setPullDistance(Math.min(distance, MAX_PULL_DISTANCE));
      if (distance > 0) {
        e.preventDefault();
      }
    } else {
      setPullDistance(0);
    }
  }, [disabled, isRefreshing, isPulling, calculatePullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (disabled || isRefreshing) return;
    setIsPulling(false);
    if (pullDistance >= PULL_THRESHOLD) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD);
      try {
        await onRefresh?.();
      } catch {
        // Error handled - just reset state
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [disabled, isRefreshing, pullDistance, onRefresh]);

  const handleScroll = useCallback(() => {
    checkScrollPosition();
  }, [checkScrollPosition]);

  useEffect(() => {
    return () => {
      setPullDistance(0);
      setIsRefreshing(false);
      setIsPulling(false);
    };
  }, []);

  const indicatorOpacity = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const indicatorRotation = (pullDistance / PULL_THRESHOLD) * 180;
  const shouldTrigger = pullDistance >= PULL_THRESHOLD;

  return (
    <div
      ref={containerRef}
      className="pull-to-refresh-container"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onScroll={handleScroll}
      data-testid="pull-to-refresh-container"
      data-pulling={isPulling}
      data-refreshing={isRefreshing}
    >
      <div
        className="pull-to-refresh-indicator"
        style={{
          transform: `translateY(${pullDistance - 40}px)`,
          opacity: indicatorOpacity,
        }}
        data-testid="pull-to-refresh-indicator"
      >
        <RefreshCw
          className={`pull-to-refresh-icon ${isRefreshing ? 'animate-spin' : ''} ${shouldTrigger ? 'ready' : ''}`}
          style={{
            transform: isRefreshing ? 'none' : `rotate(${indicatorRotation}deg)`,
          }}
          size={24}
          data-testid="pull-to-refresh-icon"
        />
        <span className="pull-to-refresh-text">
          {isRefreshing ? 'Refreshing...' : shouldTrigger ? 'Release to refresh' : 'Pull to refresh'}
        </span>
      </div>
      <div
        className="pull-to-refresh-content"
        style={{
          transform: `translateY(${pullDistance}px)`,
        }}
        data-testid="pull-to-refresh-content"
      >
        {children}
      </div>
    </div>
  );
}

export default PullToRefresh;
