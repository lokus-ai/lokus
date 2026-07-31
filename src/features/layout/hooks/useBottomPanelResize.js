import { useCallback, useRef } from 'react';
import { useLayoutStore } from '../../../stores/layout';
import { beginDragGuard } from '../dragGuard';

export function useBottomPanelResize({ min = 150, max = 600 }) {
  const isResizingRef = useRef(false);
  const setBottomHeight = useLayoutStore((s) => s.setBottomHeight);

  const startResize = useCallback((e) => {
    e.preventDefault(); // don't let the drag start a text selection
    isResizingRef.current = true;
    const startY = e.clientY;
    const startH = useLayoutStore.getState().bottomPanelHeight;
    const endGuard = beginDragGuard('ns-resize');

    function onMove(e) {
      if (!isResizingRef.current) return;
      const newH = Math.min(max, Math.max(min, startH - (e.clientY - startY)));
      setBottomHeight(newH);
    }
    function onUp() {
      isResizingRef.current = false;
      endGuard();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [min, max, setBottomHeight]);

  return { startResize, isResizingRef };
}
