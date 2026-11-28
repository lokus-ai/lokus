/** @part-of ui.calendar */

/** Shows what an element's `title` says in the app's own look, instead of the system's grey box. Returns how to stop. */
export function ownTips(root: HTMLElement): () => void {
  const tip = document.body.appendChild(document.createElement("div"));
  tip.className = "cal-hint";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  let wait = 0;
  let pressed: HTMLElement | null = null;
  const hide = () => (window.clearTimeout(wait), (tip.hidden = true));
  const over = (e: Event) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[title], [data-tip]");
    // Not for what was just pressed: the answer to a click is the click's own.
    if (!el || !root.contains(el) || el === pressed) return hide();
    // The words move off `title` so the system shows nothing of its own; a control named only by them keeps its name.
    const said = el.getAttribute("title");
    if (said !== null) {
      el.dataset.tip = said;
      el.removeAttribute("title");
      if (!el.getAttribute("aria-label") && !el.textContent?.trim()) el.setAttribute("aria-label", said);
    }
    const text = el.dataset.tip;
    hide();
    if (!text) return;
    wait = window.setTimeout(() => {
      if (!el.isConnected) return;
      tip.textContent = text;
      tip.hidden = false;
      // Measured from the corner, so the edge of the window does not narrow it first.
      Object.assign(tip.style, { left: "0px", top: "0px" });
      const box = el.getBoundingClientRect();
      const mine = tip.getBoundingClientRect();
      const below = box.bottom + 6 + mine.height <= window.innerHeight;
      tip.style.left = `${Math.max(8, Math.min(window.innerWidth - mine.width - 8, box.left + box.width / 2 - mine.width / 2))}px`;
      tip.style.top = `${Math.max(8, below ? box.bottom + 6 : box.top - 6 - mine.height)}px`;
    }, 500);
  };
  const stop = new AbortController();
  for (const name of ["pointerover", "focusin"]) root.addEventListener(name, over, { signal: stop.signal });
  root.addEventListener("pointerdown", (e) => ((pressed = (e.target as HTMLElement).closest<HTMLElement>("[title], [data-tip]")), hide()), { signal: stop.signal });
  root.addEventListener("pointerout", (e) => (e.target as HTMLElement).closest("[data-tip]") === pressed && !pressed?.contains(e.relatedTarget as Node) && (pressed = null), { signal: stop.signal });
  for (const name of ["pointerleave", "focusout", "keydown"]) root.addEventListener(name, hide, { signal: stop.signal });
  window.addEventListener("scroll", hide, { signal: stop.signal, capture: true });
  return () => (stop.abort(), hide(), tip.remove());
}
