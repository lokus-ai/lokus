/** @part-of ui.shell */
import { type Command, registerCommands } from "./commands";

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

const centre = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

function fire(target: EventTarget, type: string, x: number, y: number, buttons = 1): void {
  const init = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, buttons, pointerId: 1 };
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
      const { x, y } = centre(el);
      for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) fire(el, type, x, y);
      return rect(el);
    },
  },
  {
    id: "ui.rightClick",
    title: "Right-click an element",
    hidden: true,
    run(args) {
      const el = find(args);
      const { x, y } = centre(el);
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
      const init = { key, bubbles: true, cancelable: true, metaKey: Boolean(args.meta), shiftKey: Boolean(args.shift) };
      target.dispatchEvent(new KeyboardEvent("keydown", init));
      target.dispatchEvent(new KeyboardEvent("keyup", init));
      return { key, target: target.tagName.toLowerCase() };
    },
  },
  {
    id: "ui.fill",
    title: "Type into the focused text box",
    hidden: true,
    run(args) {
      const el = document.activeElement;
      if (!(el instanceof HTMLInputElement)) throw Object.assign(new Error("no text box has focus"), { code: "not_found" });
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      set.call(el, String(args.text ?? ""));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return { value: el.value };
    },
  },
  {
    id: "ui.hover",
    title: "Hover an element",
    hidden: true,
    run(args) {
      const el = find(args);
      const { x, y } = centre(el);
      for (const type of ["pointerover", "mouseover", "pointermove", "mousemove"]) fire(el, type, x, y, 0);
      return rect(el);
    },
  },
  {
    id: "ui.drag",
    title: "Drag an element horizontally and vertically",
    hidden: true,
    async run(args) {
      const el = find(args);
      const { x, y } = centre(el);
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
        out[s] = el ? rect(el) : null;
      }
      return out;
    },
  },
];

export function registerDevCommands(): void {
  registerCommands(commands);
}
