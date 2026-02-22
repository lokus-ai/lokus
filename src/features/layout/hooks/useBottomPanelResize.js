import { useCallback, useRef } from 'react';
import { useWorkspaceStore } from '../../../stores/workspace';

export function useBottomPanelResize({ min = 150, max = 600 }) {
  const isResizingRef = useRef(false);
  const setBottomHeight = useWorkspaceStore((s) => s.setBottomHeight);

  const startResize = useCallback((e) => {
    isResizingRef.current = true;
    const startY = e.clientY;
    const startH = useWorkspaceStore.getState().bottomPanelHeight;

    function onMove(e) {
      if (!isResizingRef.current) return;
      const newH = Math.min(max, Math.max(min, startH - (e.clientY - startY)));
      setBottomHeight(newH);
    }
    function onUp() {
      isResizingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [min, max, setBottomHeight]);

  return { startResize, isResizingRef };
}
