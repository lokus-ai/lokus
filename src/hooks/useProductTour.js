import { useEffect, useState, useCallback } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { readConfig, updateConfig } from '../core/config/store.js';

export function useProductTour() {
  const [hasSeenTour, setHasSeenTour] = useState(true); // Default to true until we check
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user has seen the tour
    const checkTourStatus = async () => {
      try {
        const config = await readConfig();
        // IMPORTANT: Default to false (show tour) for first-time users
        const seen = config?.hasSeenProductTour ?? false;
        console.log('📊 Tour status check:', {
          configExists: !!config,
          hasSeenProductTour: config?.hasSeenProductTour,
          willShowTour: !seen
        });
        setHasSeenTour(seen);
      } catch (error) {
        console.error('Failed to check tour status:', error);
        console.log('✅ Defaulting to show tour on error (first-time user experience)');
        setHasSeenTour(false); // Default to showing tour on error
      } finally {
        setIsLoading(false);
      }
    };

    checkTourStatus();
  }, []);

  const markTourAsComplete = useCallback(async () => {
    try {
      await updateConfig({ hasSeenProductTour: true });
      setHasSeenTour(true);
    } catch (error) {
      console.error('Failed to mark tour as complete:', error);
    }
  }, []);

  const startFullTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      popoverClass: 'lokus-tour-popover',
      overlayColor: 'rgba(0, 0, 0, 0.5)',
      allowClose: true,
      stagePadding: 4,
      stageRadius: 8,
      onCloseClick: () => {
        driverObj.destroy();
      },
      onPopoverRender: (popover) => {
        popover.wrapper.addEventListener('click', (e) => {
          e.stopPropagation();
        });
      },
      steps: [
        {
          element: '[data-tour="create-note"]',
          popover: {
            title: 'Create Notes',
            description: 'Click here to create new notes. You can create markdown notes, canvases, or use templates to get started quickly.',
            side: "bottom",
            align: 'start',
            onNextClick: () => {
              const createBtn = document.querySelector('[data-tour="create-note"]');
              if (createBtn) {
                createBtn.click();
                setTimeout(() => driverObj.moveNext(), 300);
              } else {
                driverObj.moveNext();
              }
            }
          }
        },
        {
          element: '[data-tour="files"]',
          popover: {
            title: 'File Explorer',
            description: 'Browse all your notes and folders here. Create, organize, and manage your knowledge base with an intuitive file system.',
            side: "right",
            align: 'start'
          }
        },
        {
          element: '[data-tour="editor"]',
          popover: {
            title: 'Wiki-Style Linking',
            description: 'Type [[ to create links between notes. This creates a connected knowledge graph automatically.',
            side: "top",
            align: 'start',
            onNextClick: () => {
              // Close the file
              const tabs = document.querySelectorAll('[role="tab"]');
              if (tabs.length > 0) {
                const closeBtn = tabs[0].querySelector('button');
                if (closeBtn) closeBtn.click();
              }
              setTimeout(() => driverObj.moveNext(), 300);
            }
          }
        },
        {
          element: '[data-tour="templates"]',
          popover: {
            title: 'Command Palette & Templates',
            description: 'Press Cmd/Ctrl+K to access templates, search, and all features.',
            side: "top",
            align: 'start',
            onNextClick: () => {
              const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
              const event = new KeyboardEvent('keydown', {
                key: 'k',
                code: 'KeyK',
                keyCode: 75,
                metaKey: isMac,
                ctrlKey: !isMac,
                bubbles: true,
                cancelable: true
              });
              document.dispatchEvent(event);
              setTimeout(() => {
                const escEvent = new KeyboardEvent('keydown', {
                  key: 'Escape',
                  code: 'Escape',
                  keyCode: 27,
                  bubbles: true
                });
                document.dispatchEvent(escEvent);
                setTimeout(() => driverObj.moveNext(), 200);
              }, 1200);
            }
          }
        },
        {
          element: '[data-tour="graph"]',
          popover: {
            title: 'Graph View',
            description: 'Visualize connections between your notes in an interactive graph.',
            side: "right",
            align: 'start',
            onNextClick: () => {
              const graphBtn = document.querySelector('[data-tour="graph"]');
              if (graphBtn) graphBtn.click();
              setTimeout(() => driverObj.moveNext(), 800);
            }
          }
        },
        {
          element: '[data-tour="daily-notes"]',
          popover: {
            title: 'Daily Notes',
            description: 'Perfect for journaling, task tracking, and daily routines.',
            side: "right",
            align: 'start',
            onNextClick: () => {
              const dailyBtn = document.querySelector('[data-tour="daily-notes"]');
              if (dailyBtn) dailyBtn.click();
              setTimeout(() => driverObj.moveNext(), 500);
            }
          }
        },
        {
          element: '[data-tour="bases"]',
          popover: {
            title: 'Bases (Database)',
            description: 'Create structured databases with tables, views, and custom fields.',
            side: "right",
            align: 'start',
            onNextClick: () => {
              const basesBtn = document.querySelector('[data-tour="bases"]');
              if (basesBtn) basesBtn.click();
              setTimeout(() => driverObj.moveNext(), 500);
            }
          }
        },
        {
          popover: {
            title: 'You\'re All Set!',
            description: 'Start building your knowledge base. Press Cmd/Ctrl+K for the command palette anytime!',
          }
        }
      ],
      onDestroyed: () => {
        markTourAsComplete();
      },
      onDestroyStarted: () => {
        markTourAsComplete();
        driverObj.destroy();
        return true;
      }
    });

    driverObj.drive();
  }, [markTourAsComplete]);

  const startTour = useCallback(() => {
    let createdFilePath = null;

    const driverObj = driver({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      popoverClass: 'lokus-tour-popover',
      overlayColor: 'rgba(0, 0, 0, 0.5)',
      allowClose: true,
      stagePadding: 4,
      stageRadius: 8,
      onCloseClick: () => {
        driverObj.destroy();
      },
      onPopoverRender: (popover) => {
        // Prevent clicks from closing the tour
        popover.wrapper.addEventListener('click', (e) => {
          e.stopPropagation();
        });
      },
      steps: [
        {
          element: '[data-tour="create-note"]',
          popover: {
            title: 'Welcome to Lokus!',
            description: 'Let\'s take a quick tour. We\'ll create a note to show you the editor.',
            side: "bottom",
            align: 'start',
            onNextClick: () => {
              // Click to create a new file
              const createBtn = document.querySelector('[data-tour="create-note"]');
              if (createBtn) {
                createBtn.click();
                // Wait for file to be created
                setTimeout(() => driverObj.moveNext(), 300);
              } else {
                driverObj.moveNext();
              }
            }
          }
        },
        {
          element: '[data-tour="editor"]',
          popover: {
            title: 'Wiki-Style Linking',
            description: 'Type [[ to create links between notes. This builds your knowledge graph automatically.',
            side: "top",
            align: 'start',
            onNextClick: () => {
              // Close the file to return to welcome screen
              const tabs = document.querySelectorAll('[role="tab"]');
              if (tabs.length > 0) {
                // Find and click the close button on the first tab
                const closeBtn = tabs[0].querySelector('button');
                if (closeBtn) closeBtn.click();
              }
              setTimeout(() => driverObj.moveNext(), 300);
            }
          }
        },
        {
          element: '[data-tour="templates"]',
          popover: {
            title: 'Command Palette',
            description: 'Press Cmd/Ctrl+K or click here to access templates, search, and all features.',
            side: "top",
            align: 'start',
            onNextClick: () => {
              // Try to trigger command palette with keyboard event
              const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
              const event = new KeyboardEvent('keydown', {
                key: 'k',
                code: 'KeyK',
                keyCode: 75,
                which: 75,
                metaKey: isMac,
                ctrlKey: !isMac,
                bubbles: true,
                cancelable: true
              });
              document.dispatchEvent(event);

              setTimeout(() => {
                // Close command palette
                const escEvent = new KeyboardEvent('keydown', {
                  key: 'Escape',
                  code: 'Escape',
                  keyCode: 27,
                  bubbles: true,
                  cancelable: true
                });
                document.dispatchEvent(escEvent);
                setTimeout(() => driverObj.moveNext(), 200);
              }, 1200);
            }
          }
        },
        {
          element: '[data-tour="daily-notes"]',
          popover: {
            title: 'Daily Notes',
            description: 'Perfect for journaling and daily task tracking.',
            side: "right",
            align: 'start',
            onNextClick: () => {
              // Click daily notes button
              const dailyBtn = document.querySelector('[data-tour="daily-notes"]');
              if (dailyBtn) dailyBtn.click();
              setTimeout(() => driverObj.moveNext(), 300);
            }
          }
        },
        {
          popover: {
            title: 'Quick Tour Complete!',
            description: 'Want to see more features in detail? Click "Next" for a full demo, or "Close" to start using Lokus.',
          }
        },
        {
          element: '[data-tour="files"]',
          popover: {
            title: 'File Explorer',
            description: 'Browse all your notes and folders here. Create, organize, and manage your knowledge base.',
            side: "right",
            align: 'start'
          }
        },
        {
          element: '[data-tour="graph"]',
          popover: {
            title: 'Graph View',
            description: 'Visualize connections between your notes in an interactive graph.',
            side: "right",
            align: 'start',
            onNextClick: () => {
              // Click graph button
              const graphBtn = document.querySelector('[data-tour="graph"]');
              if (graphBtn) graphBtn.click();
              setTimeout(() => driverObj.moveNext(), 800);
            }
          }
        },
        {
          element: '[data-tour="bases"]',
          popover: {
            title: 'Bases (Database)',
            description: 'Create structured databases with tables, views, and custom fields. Perfect for project management and data organization.',
            side: "right",
            align: 'start',
            onNextClick: () => {
              // Click bases button
              const basesBtn = document.querySelector('[data-tour="bases"]');
              if (basesBtn) basesBtn.click();
              setTimeout(() => driverObj.moveNext(), 500);
            }
          }
        },
        {
          popover: {
            title: 'You\'re All Set!',
            description: 'Start building your knowledge base. Press Cmd/Ctrl+K for the command palette anytime!',
          }
        }
      ],
      onDestroyed: () => {
        markTourAsComplete();
      },
      onDestroyStarted: () => {
        markTourAsComplete();
        driverObj.destroy();
        return true;
      }
    });

    driverObj.drive();
  }, [markTourAsComplete]);

  const resetTour = useCallback(async () => {
    try {
      await updateConfig({ hasSeenProductTour: false });
      setHasSeenTour(false);
    } catch (error) {
      console.error('Failed to reset tour:', error);
    }
  }, []);

  return {
    hasSeenTour,
    isLoading,
    startTour,
    startFullTour,
    markTourAsComplete,
    resetTour
  };
}
