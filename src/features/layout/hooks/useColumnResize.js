import { useCallback } from 'react';
import { useWorkspaceStore } from '../../../stores/workspace';

export function useColumnResize({ minLeft = 220, maxLeft = 500, minRight = 220, maxRight = 500 }) {
  const leftW = useWorkspaceStore((s) => s.leftW);
  const rightW = useWorkspaceStore((s) => s.rightW);
  const setLeftW = useWorkspaceStore((s) => s.setLeftW);
  const setRightW = useWorkspaceStore((s) => s.setRightW);

  const startLeftDrag = useCallback((e) => {
    const startX = e.clientX;
    const startW = useWorkspaceStore.getState().leftW;

    function onMove(e) {
      setLeftW(Math.min(maxLeft, Math.max(minLeft, startW + (e.clientX - startX))));
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [maxLeft, minLeft, setLeftW]);

  const startRightDrag = useCallback((e) => {
    const startX = e.clientX;
    const startW = useWorkspaceStore.getState().rightW;

    function onMove(e) {
      setRightW(Math.min(maxRight, Math.max(minRight, startW - (e.clientX - startX))));
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [maxRight, minRight, setRightW]);

  return { leftW, rightW, startLeftDrag, startRightDrag };
}
