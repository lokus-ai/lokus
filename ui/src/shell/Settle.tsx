/** @part-of ui.shell */
import { type HTMLAttributes, useRef } from "react";

/**
 * A group of choices that send or delete something. A click that comes within a moment of the
 * group appearing was aimed at what stood there before, so it is ignored. The moment is fixed: half a second
 * from appearing, however often it is clicked meanwhile.
 */
export function Settle(p: HTMLAttributes<HTMLDivElement>) {
  const quiet = useRef(performance.now() + 500);
  return (
    <div
      {...p}
      onClickCapture={(e) => {
        if (performance.now() >= quiet.current) return;
        e.stopPropagation();
        e.preventDefault();
      }}
    />
  );
}
