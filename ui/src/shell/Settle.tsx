/** @part-of ui.shell */
import { type HTMLAttributes, useRef } from "react";

/**
 * A group of choices that send or delete something. A click that comes within a moment of the
 * group appearing was aimed at what stood there before, so it is ignored, and so is every click
 * of the same burst.
 */
export function Settle(p: HTMLAttributes<HTMLDivElement>) {
  const quiet = useRef(performance.now() + 500);
  return (
    <div
      {...p}
      onClickCapture={(e) => {
        if (performance.now() >= quiet.current) return;
        quiet.current = performance.now() + 500;
        e.stopPropagation();
        e.preventDefault();
      }}
    />
  );
}
