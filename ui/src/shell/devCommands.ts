/** @part-of ui.shell */
import { type Command, registerCommands } from "./commands";
import { readAddress } from "../bridge/dev";
import { resolveImage } from "./workspace";

/**
 * Dev builds only. These let `lokus app ui.*` poke the real window the way a
 * person would (pointer events, not shortcuts) and measure the result.
 */
function find(args: Record<string, unknown>): HTMLElement {
  let el: Element | null = null;
  if (typeof args.selector === "string") {
    el = document.querySelector(args.selector);
  } else if (typeof args.text === "string") {
    const want = args.text;
    el =
      [...document.querySelectorAll("button, a, [role=button], .tab, .tree-row, .palette-row, .cm-tooltip-autocomplete li")].find(
        (e) => (e as HTMLElement).innerText.split("\n").some((line) => line.trim() === want),
      ) ?? null;
  }
  if (!(el instanceof HTMLElement)) {
    throw Object.assign(new Error(`nothing matches ${JSON.stringify(args)}`), { code: "not_found" });
  }
  return el;
}

/** The middle of an element, or the exact point given as `x` and `y` (for a canvas, where the target is drawn). */
const centre = (el: HTMLElement, args: Record<string, unknown> = {}) => {
  const r = el.getBoundingClientRect();
  if (args.x !== undefined && args.y !== undefined) return { x: Number(args.x), y: Number(args.y) };
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

function fire(target: EventTarget, type: string, x: number, y: number, buttons = 1, meta = false): void {
  const init = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, buttons, pointerId: 1, metaKey: meta };
  target.dispatchEvent(type.startsWith("pointer") ? new PointerEvent(type, init) : new MouseEvent(type, init));
}

const rect = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
};

const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

const commands: Command[] = [
  {
    id: "ui.click",
    title: "Click an element",
    hidden: true,
    run(args) {
      const el = find(args);
      const { x, y } = centre(el, args);
      // `meta=true` holds Cmd, which is how a link is opened in a new tab.
      for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) fire(el, type, x, y, 1, Boolean(args.meta));
      return rect(el);
    },
  },
  {
    id: "ui.rightClick",
    title: "Right-click an element",
    hidden: true,
    run(args) {
      const el = find(args);
      const { x, y } = centre(el, args);
      el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2 }));
      return rect(el);
    },
  },
  {
    id: "ui.key",
    title: "Press a key in whatever has focus",
    hidden: true,
    run(args) {
      const key = String(args.key ?? "");
      const focused = document.activeElement;
      const target = focused && focused !== document.body ? focused : (document.querySelector(".cm-content") ?? document.body);
      const init = { key, bubbles: true, cancelable: true, metaKey: Boolean(args.meta), ctrlKey: Boolean(args.ctrl), shiftKey: Boolean(args.shift) };
      target.dispatchEvent(new KeyboardEvent("keydown", init));
      target.dispatchEvent(new KeyboardEvent("keyup", init));
      return { key, target: target.tagName.toLowerCase() };
    },
  },
  {
    id: "ui.fill",
    title: "Type into a text box (the focused one, or `selector`)",
    hidden: true,
    run(args) {
      const el = typeof args.selector === "string" ? document.querySelector(args.selector) : document.activeElement;
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) throw Object.assign(new Error("no text box there"), { code: "not_found" });
      el.focus();
      const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")!.set!;
      set.call(el, String(args.text ?? ""));
      // A text box reports typing; a drop-down reports a choice.
      el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
      return { value: el.value };
    },
  },
  {
    id: "ui.hover",
    title: "Hover an element",
    hidden: true,
    run(args) {
      const el = find(args);
      const { x, y } = centre(el, args);
      for (const type of ["pointerover", "mouseover", "pointermove", "mousemove"]) fire(el, type, x, y, 0);
      return rect(el);
    },
  },
  {
    id: "ui.attach",
    title: "Give a file chooser a picture from the vault",
    hidden: true,
    // A script cannot work the system's file dialog, so this hands the chooser a file directly.
    async run(args) {
      const input = find(args);
      if (!(input instanceof HTMLInputElement) || input.type !== "file") throw new Error("that is not a file chooser");
      const address = resolveImage(String(args.vault ?? ""));
      if (!address) throw new Error("no such picture in the vault");
      const blob = await readAddress(address);
      const name = String(args.vault).split("/").pop() ?? "picture";
      const files = new DataTransfer();
      files.items.add(new File([blob], name, { type: blob.type || "image/jpeg" }));
      input.files = files.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return { name, bytes: blob.size };
    },
  },
  {
    id: "ui.drag",
    title: "Drag an element horizontally and vertically",
    hidden: true,
    async run(args) {
      const el = find(args);
      const { x, y } = centre(el, args);
      const toX = x + Number(args.dx ?? 0);
      const toY = y + Number(args.dy ?? 0);
      fire(el, "pointerdown", x, y);
      for (let i = 1; i <= 8; i++) {
        fire(window, "pointermove", x + ((toX - x) * i) / 8, y + ((toY - y) * i) / 8);
        await frame();
      }
      fire(window, "pointerup", toX, toY, 0);
      return { from: { x, y }, to: { x: toX, y: toY } };
    },
  },
  {
    // Put the update pop-up or "What's new" into any state, to look at it without a real release.
    id: "updates.pretend",
    title: "Show an update state",
    hidden: true,
    async run(args) {
      const { updates } = await import("../features/updates/updates");
      const { posts, ...rest } = args as Record<string, unknown>;
      updates.set({ ...rest, ...(Array.isArray(posts) ? { posts } : {}) });
      const { posts: all, ...state } = updates.get();
      return { ...state, posts: all.map((p) => p.id) };
    },
  },
  {
    id: "ui.measure",
    title: "Position and size of elements",
    hidden: true,
    run(args) {
      const selectors = String(args.selectors ?? args.selector ?? "").split(",");
      const out: Record<string, unknown> = {
        window: { width: window.innerWidth, height: window.innerHeight },
        horizontalScroll: document.documentElement.scrollWidth > window.innerWidth,
      };
      for (const s of selectors.map((x) => x.trim()).filter(Boolean)) {
        const el = document.querySelector(s);
        out[s] = el ? { ...rect(el), text: (el as HTMLElement).innerText?.slice(0, 300), src: el.getAttribute("src") ?? undefined, natural: el instanceof HTMLImageElement ? el.naturalWidth : undefined } : null;
      }
      return out;
    },
  },
];

export function registerDevCommands(): void {
  registerCommands(commands);
}
