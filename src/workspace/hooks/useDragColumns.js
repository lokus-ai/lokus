/**
 * Custom hook for resizable columns via drag
 * Manages left and right column widths with drag handlers
 */
import { useState, useRef, useCallback } from "react";

function useDragColumns({ minLeft = 220, maxLeft = 500, minRight = 220, maxRight = 500 }) {
  const [leftW, setLeftW] = useState(280);
  const [rightW, setRightW] = useState(280);
  const dragRef = useRef(null);

  const startLeftDrag = useCallback((e) => {
    dragRef.current = { side: "left", startX: e.clientX, left0: leftW, right0: rightW };

    function onMove(e) {
      const d = dragRef.current;
      if (!d) return;
      setLeftW(Math.min(maxLeft, Math.max(minLeft, d.left0 + (e.clientX - d.startX))));
    }
    function onUp() {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [leftW, rightW, maxLeft, minLeft]);

  const startRightDrag = useCallback((e) => {
    dragRef.current = { side: "right", startX: e.clientX, left0: leftW, right0: rightW };

    function onMove(e) {
      const d = dragRef.current;
      if (!d) return;
      setRightW(Math.min(maxRight, Math.max(minRight, d.right0 - (e.clientX - d.startX))));
    }
    function onUp() {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [leftW, rightW, maxRight, minRight]);

  return { leftW, rightW, startLeftDrag, startRightDrag };
}

export default useDragColumns;
