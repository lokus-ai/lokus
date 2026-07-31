/**
 * Warm heavy lazily-loaded views while the app is idle.
 *
 * The big views (Bases, Kanban, Canvas, the maths graph editor, Preferences)
 * are behind `React.lazy` so they stay out of the boot payload. That keeps
 * startup fast, but it moves their cost to the first click — which is exactly
 * the moment the user is watching, so every one of them flashes a "Loading…"
 * fallback the first time it is opened.
 *
 * Warming fixes that without giving back the startup win. This is a desktop
 * app: the chunks are already on local disk behind Tauri's asset protocol, so
 * there is no network to pay for and no bandwidth to waste on something the
 * user might not open. Pulling them in while nothing else is happening costs
 * nothing anyone can feel, and by the time a view is clicked the module is
 * already in the loader's cache, so React never suspends.
 *
 * Deliberately sequential and idle-scheduled: firing every import at once
 * would contend with the workspace load the user is actually waiting on.
 */

// Specifiers must match the ones the lazy() call sites use, so that both
// resolve to the same module and the second caller gets a cache hit.
const LAZY_VIEWS = [
  () => import('../../bases/BasesView'),
  () => import('../../components/KanbanBoard'),
  () => import('../../views/Canvas'),
  () => import('../../components/MathGraph/MathGraphEditor.jsx'),
  () => import('../../components/Calendar'),
  () => import('../../components/DailyNotes'),
  () => import('../../views/Preferences'),
];

const onIdle =
  typeof globalThis.requestIdleCallback === 'function'
    ? (fn) => globalThis.requestIdleCallback(fn, { timeout: 4000 })
    : (fn) => setTimeout(fn, 1200);

let started = false;

/** Idempotent — safe to call from every mount, StrictMode included. */
export function warmLazyViews() {
  if (started) return;
  started = true;

  let i = 0;
  const next = () => {
    if (i >= LAZY_VIEWS.length) return;
    const load = LAZY_VIEWS[i++];
    // A failed prefetch is not an error: the real import will surface it.
    load().catch(() => {}).then(() => onIdle(next));
  };

  onIdle(next);
}

/** Test seam — lets a test observe a fresh run. */
export function __resetWarmLazyViews() {
  started = false;
}
