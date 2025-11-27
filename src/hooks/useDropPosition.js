import { useState, useCallback } from 'react';

export function useDropPosition() {
  const [dropPosition, setDropPosition] = useState(null);

  const updateDropPosition = useCallback((rect, elementType = 'file') => {
    if (!rect) {
      setDropPosition(null);
      return;
    }

    setDropPosition({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      type: elementType,
    });
  }, []);

  const clearDropPosition = useCallback(() => {
    setDropPosition(null);
  }, []);

  return {
    dropPosition,
    updateDropPosition,
    clearDropPosition,
  };
}
