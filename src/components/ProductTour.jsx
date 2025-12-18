import { useEffect } from 'react';
import { useProductTour } from '../hooks/useProductTour.js';

export default function ProductTour({ autoStart = true, delay = 1500 }) {
  const { hasSeenTour, isLoading, startTour, startFullTour, resetTour } = useProductTour();

  // Expose tour controls globally for development/testing
  useEffect(() => {
    window.lokusDevTour = {
      start: startTour,
      startFull: startFullTour,
      reset: async () => {
        await resetTour();
      },
      clearConfig: () => {
        localStorage.removeItem('lokus:config');
      }
    };

    return () => {
      delete window.lokusDevTour;
    };
  }, [startTour, startFullTour, resetTour]);

  useEffect(() => {

    if (isLoading) {
      return;
    }

    if (!hasSeenTour && autoStart) {
      // Delay tour start to let UI fully render
      const timer = setTimeout(() => {
        startTour();
      }, delay);

      return () => clearTimeout(timer);
    } else {
      if (hasSeenTour) {
      }
    }
  }, [hasSeenTour, isLoading, autoStart, delay, startTour]);

  return null; // This component doesn't render anything
}

// Export the hook so components can manually trigger the tour
export { useProductTour };
