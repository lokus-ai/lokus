import React from 'react';
import { useLayoutStore } from '../stores/layout';

export default function WorkspaceShell({ children }) {
  const showLeft = useLayoutStore((s) => s.showLeft);
  const showRight = useLayoutStore((s) => s.showRight);
  const leftW = useLayoutStore((s) => s.leftW);
  const rightW = useLayoutStore((s) => s.rightW);

  const gridCols = [
    '48px',
    showLeft ? `${leftW}px` : '0px',
    '1fr',
    showRight ? `${rightW}px` : '0px',
  ].join(' ');

  return (
    <div
      className="h-screen w-screen overflow-hidden grid grid-rows-[auto_1fr_auto]"
      style={{ gridTemplateColumns: gridCols }}
    >
      {children}
    </div>
  );
}
