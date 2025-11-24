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
        console.log('✅ Tour reset! Reload the page to see it again.');
      },
      clearConfig: () => {
        localStorage.removeItem('lokus:config');
        console.log('✅ Config cleared! Reload the page.');
      }
    };

    console.log('💡 Dev Tools Available:');
    console.log('  - window.lokusDevTour.start() - Start quick tour (with option for full demo)');
    console.log('  - window.lokusDevTour.startFull() - Start full demo directly');
    console.log('  - window.lokusDevTour.reset() - Reset tour status');
    console.log('  - window.lokusDevTour.clearConfig() - Clear entire config');

    return () => {
      delete window.lokusDevTour;
    };
  }, [startTour, startFullTour, resetTour]);

  useEffect(() => {
    console.log('🎯 ProductTour effect:', { isLoading, hasSeenTour, autoStart });

    if (isLoading) {
      console.log('⏳ Still loading tour status...');
      return;
    }

    if (!hasSeenTour && autoStart) {
      console.log('✅ FIRST-TIME USER DETECTED - Starting tour in', delay, 'ms');
      console.log('   This tour will auto-start for all new users');
      // Delay tour start to let UI fully render
      const timer = setTimeout(() => {
        console.log('▶️ Starting tour NOW for first-time user');
        startTour();
      }, delay);

      return () => clearTimeout(timer);
    } else {
      console.log('❌ Tour not starting:', { hasSeenTour, autoStart });
      if (hasSeenTour) {
        console.log('   User has already seen the tour');
      }
      console.log('💡 To reset and see the tour, run: window.lokusDevTour.clearConfig()');
    }
  }, [hasSeenTour, isLoading, autoStart, delay, startTour]);

  return null; // This component doesn't render anything
}

// Export the hook so components can manually trigger the tour
export { useProductTour };
