import { useCallback } from 'react';
import { useLayoutStore } from '../../../stores/layout';
import { beginDragGuard } from '../dragGuard';

export function useColumnResize({ minLeft = 220, maxLeft = 500, minRight = 220, maxRight = 500 }) {
  const leftW = useLayoutStore((s) => s.leftW);
  const rightW = useLayoutStore((s) => s.rightW);
  const setLeftW = useLayoutStore((s) => s.setLeftW);
  const setRightW = useLayoutStore((s) => s.setRightW);

  const startLeftDrag = useCallback((e) => {
    e.preventDefault(); // don't let the drag start a text selection
    const startX = e.clientX;
    const startW = useLayoutStore.getState().leftW;
    const endGuard = beginDragGuard('col-resize');

    function onMove(e) {
      setLeftW(Math.min(maxLeft, Math.max(minLeft, startW + (e.clientX - startX))));
    }
    function onUp() {
      endGuard();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [maxLeft, minLeft, setLeftW]);

  const startRightDrag = useCallback((e) => {
    e.preventDefault(); // don't let the drag start a text selection
    const startX = e.clientX;
    const startW = useLayoutStore.getState().rightW;
    const endGuard = beginDragGuard('col-resize');

    function onMove(e) {
      setRightW(Math.min(maxRight, Math.max(minRight, startW - (e.clientX - startX))));
    }
    function onUp() {
      endGuard();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [maxRight, minRight, setRightW]);

  return { leftW, rightW, startLeftDrag, startRightDrag };
}
