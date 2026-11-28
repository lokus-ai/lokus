/** @part-of ui.calendar */
import { showContextMenu } from "../../shell/contextMenu";

/** The app's own menu, opened under a button: `items` are [value, name] or null for a line; the chosen one is ticked. */
export function pickMenu(under: HTMLElement, label: string, items: ([value: string, name: string] | null)[], chosen: string | null, onPick: (value: string) => void): void {
  const box = under.getBoundingClientRect();
  showContextMenu(
    { x: box.left, y: box.bottom + 4 },
    label,
    items.map((item) => item && { id: item[0], label: `${chosen === null ? "" : item[0] === chosen ? "✓  " : "     "}${item[1]}` }),
    { valid: () => under.isConnected, subscribe: () => () => undefined, restoreFocus: () => under.focus(), run: onPick },
  );
  // The chosen one is brought into view in a long list (the time zones).
  document.querySelector<HTMLElement>(`.menu [data-command="${CSS.escape(chosen ?? "")}"]`)?.focus();
}
