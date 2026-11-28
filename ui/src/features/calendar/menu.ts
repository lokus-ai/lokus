/** @part-of ui.calendar */
import { showContextMenu } from "../../shell/contextMenu";

/** The app's own menu, opened under a button: `items` are [value, name] or null for a line; the chosen one is ticked. */
export function pickMenu(under: HTMLElement, label: string, items: ([value: string, name: string] | null)[], chosen: string | null, onPick: (value: string) => void, look?: { swatches?: Record<string, string>; fill?: HTMLElement | null }): void {
  const box = under.getBoundingClientRect();
  showContextMenu(
    { x: box.left, y: box.bottom + 4 },
    label,
    items.map((item) => item && { id: item[0], label: `${chosen === null ? "" : item[0] === chosen ? "✓  " : "     "}${item[1]}` }),
    { valid: () => under.isConnected, subscribe: () => () => undefined, restoreFocus: () => under.focus(), run: onPick },
  );
  const menu = document.querySelector<HTMLElement>(".menu.context-menu");
  if (menu && look) {
    menu.classList.add("cal-menu");
    // As wide as the panel it belongs to, and no wider: a long name is cut with an ellipsis.
    const fill = look.fill?.getBoundingClientRect();
    if (fill) Object.assign(menu.style, { left: `${fill.left + 8}px`, width: `${fill.width - 16}px`, maxWidth: `${fill.width - 16}px`, minWidth: "0" });
    for (const button of menu.querySelectorAll<HTMLButtonElement>("button")) {
      button.title = button.textContent?.trim() ?? "";
      // "Name · account": the account goes on a second, smaller line, so two calendars of one name are told apart.
      const [name, ...rest] = (button.textContent ?? "").split(" · ");
      if (rest.length) {
        const second = document.createElement("small");
        second.textContent = rest.join(" · ");
        const first = document.createElement("span");
        first.textContent = name;
        button.replaceChildren(first, second);
        button.classList.add("two");
      }
      const colour = look.swatches?.[button.dataset.command ?? ""];
      if (!colour) continue;
      const dot = document.createElement("i");
      dot.style.background = colour;
      button.prepend(dot);
    }
  }
  // The chosen one is brought into view in a long list (the time zones).
  document.querySelector<HTMLElement>(`.menu [data-command="${CSS.escape(chosen ?? "")}"]`)?.focus();
}
