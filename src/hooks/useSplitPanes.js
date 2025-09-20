import { useState, useCallback, useRef, useEffect } from 'react';

const generateId = () => Math.random().toString(36).substr(2, 9);

export const useSplitPanes = ({ initialFile, onFileChange }) => {
  // Initialize with a single pane
  const [panes, setPanes] = useState([{
    id: generateId(),
    file: initialFile,
    size: 100,
    position: { row: 1, col: 1, rowSpan: 1, colSpan: 1 }
  }]);
  
  const [activePaneId, setActivePaneId] = useState(panes[0]?.id);
  const [layout, setLayout] = useState({ rows: 1, cols: 1 });
  
  const layoutRef = useRef({ rows: 1, cols: 1 });

  // Update layout ref when layout changes
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  // Create a new split pane
  const createSplit = useCallback((filePath, direction, position = 'after', relativeToPaneId = null) => {
    setPanes(currentPanes => {
      const targetPaneId = relativeToPaneId || activePaneId;
      const targetPane = currentPanes.find(p => p.id === targetPaneId);
      
      if (!targetPane) return currentPanes;

      const newPaneId = generateId();
      let newPanes = [...currentPanes];
      
      if (direction === 'vertical') {
        // Split vertically (side by side)
        const newLayout = {
          rows: layout.rows,
          cols: layout.cols + 1
        };
        
        // Adjust existing panes
        newPanes = newPanes.map(pane => {
          if (position === 'before' && pane.position.col >= targetPane.position.col) {
            return {
              ...pane,
              position: {
                ...pane.position,
                col: pane.position.col + 1
              }
            };
          } else if (position === 'after' && pane.position.col > targetPane.position.col) {
            return {
              ...pane,
              position: {
                ...pane.position,
                col: pane.position.col + 1
              }
            };
          }
          return pane;
        });
        
        // Add new pane
        const newCol = position === 'before' ? targetPane.position.col : targetPane.position.col + 1;
        newPanes.push({
          id: newPaneId,
          file: filePath,
          size: 50,
          position: {
            row: targetPane.position.row,
            col: newCol,
            rowSpan: targetPane.position.rowSpan,
            colSpan: 1
          }
        });
        
        setLayout(newLayout);
      } else {
        // Split horizontally (top and bottom)
        const newLayout = {
          rows: layout.rows + 1,
          cols: layout.cols
        };
        
        // Adjust existing panes
        newPanes = newPanes.map(pane => {
          if (position === 'before' && pane.position.row >= targetPane.position.row) {
            return {
              ...pane,
              position: {
                ...pane.position,
                row: pane.position.row + 1
              }
            };
          } else if (position === 'after' && pane.position.row > targetPane.position.row) {
            return {
              ...pane,
              position: {
                ...pane.position,
                row: pane.position.row + 1
              }
            };
          }
          return pane;
        });
        
        // Add new pane
        const newRow = position === 'before' ? targetPane.position.row : targetPane.position.row + 1;
        newPanes.push({
          id: newPaneId,
          file: filePath,
          size: 50,
          position: {
            row: newRow,
            col: targetPane.position.col,
            rowSpan: 1,
            colSpan: targetPane.position.colSpan
          }
        });
        
        setLayout(newLayout);
      }
      
      setActivePaneId(newPaneId);
      return newPanes;
    });
  }, [activePaneId, layout]);

  // Close a split pane
  const closeSplit = useCallback((paneId) => {
    setPanes(currentPanes => {
      if (currentPanes.length <= 1) return currentPanes;
      
      const paneToRemove = currentPanes.find(p => p.id === paneId);
      if (!paneToRemove) return currentPanes;
      
      const remainingPanes = currentPanes.filter(p => p.id !== paneId);
      
      // If closing the active pane, switch to another
      if (paneId === activePaneId && remainingPanes.length > 0) {
        setActivePaneId(remainingPanes[0].id);
      }
      
      // Simplify layout if possible
      const maxRow = Math.max(...remainingPanes.map(p => p.position.row));
      const maxCol = Math.max(...remainingPanes.map(p => p.position.col));
      
      setLayout({ rows: maxRow, cols: maxCol });
      
      return remainingPanes;
    });
  }, [activePaneId]);

  // Move a file to a specific pane
  const moveToPane = useCallback((filePath, targetPaneId) => {
    setPanes(currentPanes => {
      return currentPanes.map(pane => {
        if (pane.id === targetPaneId) {
          return { ...pane, file: filePath };
        }
        return pane;
      });
    });
    
    setActivePaneId(targetPaneId);
    onFileChange?.(filePath);
  }, [onFileChange]);

  // Set active pane
  const setActivePane = useCallback((paneId) => {
    const pane = panes.find(p => p.id === paneId);
    if (pane) {
      setActivePaneId(paneId);
      if (pane.file) {
        onFileChange?.(pane.file);
      }
    }
  }, [panes, onFileChange]);

  // Resize a pane
  const resizePane = useCallback((paneId, newSize) => {
    setPanes(currentPanes => {
      return currentPanes.map(pane => {
        if (pane.id === paneId) {
          return { ...pane, size: newSize };
        }
        return pane;
      });
    });
  }, []);

  // Get CSS Grid layout configuration
  const getPaneLayout = useCallback(() => {
    const { rows, cols } = layout;
    
    // Create CSS grid template
    const columns = `repeat(${cols}, 1fr)`;
    const rowsTemplate = `repeat(${rows}, 1fr)`;
    
    return {
      columns,
      rows: rowsTemplate,
      orientation: cols > rows ? 'horizontal' : 'vertical'
    };
  }, [layout]);

  // Get pane style for CSS Grid placement
  const getPaneStyle = useCallback((pane) => {
    return {
      gridRow: `${pane.position.row} / span ${pane.position.rowSpan}`,
      gridColumn: `${pane.position.col} / span ${pane.position.colSpan}`,
    };
  }, []);

  // Split current pane vertically
  const splitVertical = useCallback((filePath = null) => {
    createSplit(filePath, 'vertical', 'after', activePaneId);
  }, [createSplit, activePaneId]);

  // Split current pane horizontally
  const splitHorizontal = useCallback((filePath = null) => {
    createSplit(filePath, 'horizontal', 'after', activePaneId);
  }, [createSplit, activePaneId]);

  // Close current pane
  const closeCurrentPane = useCallback(() => {
    if (activePaneId) {
      closeSplit(activePaneId);
    }
  }, [closeSplit, activePaneId]);

  // Navigate between panes
  const focusNextPane = useCallback(() => {
    const currentIndex = panes.findIndex(p => p.id === activePaneId);
    const nextIndex = (currentIndex + 1) % panes.length;
    setActivePaneId(panes[nextIndex].id);
  }, [panes, activePaneId]);

  const focusPreviousPane = useCallback(() => {
    const currentIndex = panes.findIndex(p => p.id === activePaneId);
    const prevIndex = currentIndex === 0 ? panes.length - 1 : currentIndex - 1;
    setActivePaneId(panes[prevIndex].id);
  }, [panes, activePaneId]);

  // Focus pane by number (1-based)
  const focusPaneByNumber = useCallback((number) => {
    if (number >= 1 && number <= panes.length) {
      setActivePaneId(panes[number - 1].id);
    }
  }, [panes]);

  // Get serializable state for persistence
  const getSerializableState = useCallback(() => {
    return {
      panes: panes.map(pane => ({
        id: pane.id,
        file: pane.file,
        size: pane.size,
        position: pane.position
      })),
      activePaneId,
      layout
    };
  }, [panes, activePaneId, layout]);

  // Restore state from serialized data
  const restoreState = useCallback((serializedState) => {
    if (serializedState?.panes?.length > 0) {
      setPanes(serializedState.panes);
      setActivePaneId(serializedState.activePaneId);
      setLayout(serializedState.layout);
    }
  }, []);

  return {
    // State
    panes,
    activePaneId,
    layout,
    
    // Actions
    createSplit,
    closeSplit,
    moveToPane,
    setActivePane,
    resizePane,
    
    // Convenience methods
    splitVertical,
    splitHorizontal,
    closeCurrentPane,
    focusNextPane,
    focusPreviousPane,
    focusPaneByNumber,
    
    // Layout helpers
    getPaneLayout,
    getPaneStyle,
    
    // Persistence
    getSerializableState,
    restoreState,
  };
};