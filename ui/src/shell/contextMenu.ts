/** @part-of ui.shell */
import { runCommand } from "./commands";
import { app, GRAPH_TAB, isNotePath, notify } from "./workspace";

export interface ContextMenuItem {
  id: string;
  label: string;
  disabled?: boolean;
  danger?: boolean;
}

export interface ContextMenuTarget {
  valid(): boolean;
  /** Notify after a change that could invalidate this captured target. */
  subscribe(check: () => void): () => void;
  restoreFocus(): void;
  /** Dispatch an existing command against the captured target, not current selection. */
  run(id: string): void;
}

let dismiss: ((restoreFocus?: boolean) => void) | undefined;

export function dismissContextMenu(restoreFocus = false): void {
  dismiss?.(restoreFocus);
}

/** One command menu; ordinary text inputs keep their native context menus. */
export function showContextMenu(
  at: { x: number; y: number },
  label: string,
  items: (ContextMenuItem | null)[],
  target: ContextMenuTarget,
): () => void {
  dismiss?.();
  if (!target.valid() || !items.some((item) => item && !item.disabled)) return () => {};
  const menu = document.body.appendChild(document.createElement("div"));
  menu.className = "menu context-menu";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", label);
  const events = new AbortController();
  let unsubscribe = () => {};
  let closed = false;
  const close = (restore = false) => {
    if (closed) return;
    closed = true;
    events.abort();
    unsubscribe();
    menu.remove();
    if (dismiss === close) dismiss = undefined;
    if (restore && target.valid()) target.restoreFocus();
  };
  dismiss = close;
  const buttons: HTMLButtonElement[] = [];
  for (const item of items) {
    if (!item) {
      const separator = menu.appendChild(document.createElement("hr"));
      separator.setAttribute("role", "separator");
      continue;
    }
    const button = menu.appendChild(document.createElement("button"));
    button.type = "button";
    button.setAttribute("role", "menuitem");
    button.dataset.command = item.id;
    button.textContent = item.label;
    button.disabled = Boolean(item.disabled);
    button.tabIndex = -1;
    if (item.danger) button.className = "danger";
    button.addEventListener("pointermove", () => { if (!button.disabled) button.focus({ preventScroll: true }); }, { signal: events.signal });
    button.addEventListener("click", () => {
      if (closed) return;
      const valid = target.valid();
      close();
      if (valid && !item.disabled) target.run(item.id);
    }, { signal: events.signal });
    if (!item.disabled) buttons.push(button);
  }
  const keydown = (event: KeyboardEvent) => {
    if (event.isComposing) return;
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | undefined;
    if (event.key === "ArrowDown") next = (index + 1) % buttons.length;
    if (event.key === "ArrowUp") next = (index + buttons.length - 1) % buttons.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = buttons.length - 1;
    if (event.key === "Escape" || event.key === "Tab") close(true);
    else if (event.key === "Enter" || event.key === " ") buttons[index]?.click();
    else if (next !== undefined) buttons[next].focus({ preventScroll: true });
    else return;
    event.preventDefault();
    event.stopPropagation();
  };
  const options = { capture: true, signal: events.signal };
  menu.addEventListener("keydown", keydown, { signal: events.signal });
  menu.addEventListener("contextmenu", (event) => event.preventDefault(), { signal: events.signal });
  window.addEventListener("pointerdown", (event) => {
    if (!menu.contains(event.target as Node)) close();
  }, options);
  window.addEventListener("focusin", (event) => {
    if (!menu.contains(event.target as Node)) close();
  }, options);
  window.addEventListener("scroll", (event) => {
    if (!(event.target instanceof Node) || !menu.contains(event.target)) close();
  }, options);
  window.addEventListener("resize", () => close(), options);
  window.addEventListener("blur", (event) => { if (event.target === window) close(); }, options);
  unsubscribe = target.subscribe(() => { if (!target.valid()) close(); });
  if (closed) { unsubscribe(); return close; }
  const style = getComputedStyle(menu);
  const xInset = parseFloat(style.paddingLeft);
  const yInset = parseFloat(style.paddingTop);
  menu.style.maxWidth = `${Math.max(0, innerWidth - xInset * 2)}px`;
  menu.style.maxHeight = `${Math.max(0, innerHeight - yInset * 2)}px`;
  menu.style.left = `${Math.max(xInset, Math.min(at.x, innerWidth - menu.offsetWidth - xInset))}px`;
  menu.style.top = `${Math.max(yInset, Math.min(at.y, innerHeight - menu.offsetHeight - yInset))}px`;
  buttons[0].focus({ preventScroll: true });
  if (!target.valid()) close();
  return close;
}

/** What a mouse or key event, from React or the page itself, has in common. */
export interface MenuEvent {
  key?: string;
  shiftKey?: boolean;
  clientX?: number;
  clientY?: number;
  target: EventTarget | null;
  currentTarget: EventTarget | null;
  preventDefault(): void;
  stopPropagation(): void;
}

interface MenuOptions {
  /** Passed to every command, with the folder that was open when the menu opened as `root`. */
  args?: Record<string, unknown>;
  /** More that must still hold for the thing the menu is about. */
  valid?(): boolean;
  /** The thing itself, when it is not the element the listener is on. */
  element?: HTMLElement;
  focus?(): void;
}

// A right-click on a word selects it on a Mac, so what counts is what was selected before it.
let selected: Node | null = null;
document.addEventListener(
  "mousedown",
  (e) => {
    const selection = getSelection();
    if (e.button === 2) selected = selection && !selection.isCollapsed ? selection.anchorNode : null;
  },
  true,
);

/**
 * The menu of one thing on screen, for a right-click, the Menu key or Shift+F10. It closes when
 * the thing leaves the screen or another folder opens, and its commands never run after that.
 * Text boxes and selected text keep the system's own menu.
 */
export function openMenu(event: MenuEvent, label: string, items: (ContextMenuItem | null)[], options: MenuOptions = {}): void {
  if (event.key !== undefined && event.key !== "ContextMenu" && !(event.key === "F10" && event.shiftKey)) return;
  const element = options.element ?? (event.currentTarget as HTMLElement);
  if ((event.target as Element).closest?.("input:not([type=checkbox]), textarea, select")) return;
  if (event.key === undefined && selected && element.contains(selected)) return;
  if (event.key === undefined && element.contains(getSelection()?.anchorNode ?? null)) getSelection()?.removeAllRanges();
  event.preventDefault();
  event.stopPropagation();
  const root = app.get().vault?.root;
  const box = element.getBoundingClientRect();
  showContextMenu(event.key === undefined && event.clientX ? { x: event.clientX, y: event.clientY ?? 0 } : { x: box.left, y: box.bottom }, label, items, {
    valid: () => element.isConnected && app.get().vault?.root === root && !app.get().settings && (options.valid?.() ?? true),
    subscribe: (check) => {
      element.classList.add("context-target");
      const stop = app.subscribe(check);
      return () => { stop(); element.classList.remove("context-target"); };
    },
    restoreFocus: options.focus ?? (() => element.focus({ preventScroll: true })),
    run: (id) => { void runCommand(id, { ...options.args, root }).catch(() => notify("That could not be done.")); },
  });
}

/** The menu of a note or a file, the same wherever it is shown; the sidebar adds its own to it. */
export function fileMenu(event: MenuEvent, path: string, where: "tab" | "row" | "tree" | "draft" = "row", folder?: string): void {
  const name = path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
  openMenu(event, path === GRAPH_TAB ? "Graph" : name, path === GRAPH_TAB ? [{ id: "note.close", label: "Close tab" }] : [
    where === "tab" ? { id: "note.close", label: "Close tab" } : { id: "note.open", label: "Open" },
    ...(where === "tree" ? [{ id: "tree.newNote", label: "New note" }, { id: "tree.newFolder", label: "New folder" }] : [{ id: "tree.revealActive", label: "Reveal in sidebar" }]),
    null,
    { id: "tree.rename", label: "Rename" },
    ...(isNotePath(path) || where === "draft" ? [] : [{ id: "ai.attach", label: "Ask the assistant about this" }]),
    where === "draft" ? { id: "ai.detach", label: "Remove from message" } : { id: "note.trash", label: "Move to trash", danger: true },
  ], { args: { path, folder } });
}
